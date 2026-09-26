//! fanotify 执行拦截守护进程
//!
//! 在命令真正 `execve` 之前通过 fanotify 的 permission event 做裁决，
//! 补上用户态 /proc 轮询拦不住瞬时命令的缺口。
//!
//! 两类策略，默认全部放行，只拦命中的：
//!   --deny-prefix <PATH>      可执行文件路径以该前缀开头 → 拒绝（可重复）
//!   --lockdown-agent <PAT>    进程任一祖先的 cmdline 命中 → 拒绝（可重复）
//!
//! 运行时控制（默认开启，--no-socket 可关）：
//!   Unix socket，默认 /run/ai-guardian/enforcer.sock，建不了就回退
//!   /tmp/ai-guardian-enforcer.sock；--socket 可显式指定。
//!   每行一个 JSON 请求：
//!     {"op":"status"}
//!     {"op":"apply","policy":{"deny_prefixes":[],"lockdown_agents":[],"watch_paths":["/"]}}
//!
//! 需要 root（CAP_SYS_ADMIN）。每条裁决输出一行 JSON 审计日志。

#[cfg(target_os = "linux")]
mod imp {
    use std::collections::HashSet;
    use std::ffi::CString;
    use std::io::{self, Write};
    use std::os::fd::RawFd;
    use std::path::Path;
    use std::sync::Arc;
    use std::{fs, process};

    use libc::{
        c_void, fanotify_event_metadata, fanotify_init, fanotify_mark, fanotify_response, poll,
        pollfd, sockaddr_un, AF_UNIX, FAN_ALLOW, FAN_CLASS_CONTENT, FAN_DENY, FAN_EVENT_ON_CHILD,
        FAN_MARK_ADD, FAN_MARK_FILESYSTEM, FAN_MARK_FLUSH, FAN_MARK_MOUNT, FAN_OPEN_EXEC_PERM,
        FAN_UNLIMITED_QUEUE, O_CLOEXEC, O_RDONLY, POLLERR, POLLHUP, POLLIN, SOCK_CLOEXEC,
        SOCK_NONBLOCK, SOCK_STREAM,
    };
    use parking_lot::RwLock;
    use serde::{Deserialize, Serialize};

    const DEFAULT_SOCKET_RUN: &str = "/run/ai-guardian/enforcer.sock";
    const DEFAULT_SOCKET_TMP: &str = "/tmp/ai-guardian-enforcer.sock";
    const MAX_CLIENT_BUF: usize = 65536;

    #[derive(Default, Clone, Serialize, Deserialize)]
    #[serde(default)]
    struct Policy {
        deny_prefixes: Vec<String>,
        lockdown_agents: Vec<String>,
        watch_paths: Vec<String>,
    }

    #[derive(Default)]
    struct Shared {
        policy: Policy,
        allowed: u64,
        denied: u64,
    }
    type State = Arc<RwLock<Shared>>;

    enum Decision {
        Allow,
        Deny(String),
    }

    impl Policy {
        fn decide(&self, pid: i32, exec_path: &str) -> Decision {
            for prefix in &self.deny_prefixes {
                if exec_path.starts_with(prefix) {
                    return Decision::Deny(format!("exec path matches deny prefix {prefix}"));
                }
            }
            self.match_lockdown(&ancestor_cmdlines(pid))
        }

        /// 纯逻辑：给定祖先 cmdline 列表，判断是否命中锁定的 agent
        fn match_lockdown(&self, ancestors: &[String]) -> Decision {
            if self.lockdown_agents.is_empty() {
                return Decision::Allow;
            }
            for ancestor in ancestors {
                let low = ancestor.to_lowercase();
                for pat in &self.lockdown_agents {
                    if low.contains(pat) {
                        return Decision::Deny(format!(
                            "spawned under locked-down agent matching \"{pat}\""
                        ));
                    }
                }
            }
            Decision::Allow
        }
    }

    /// 沿 ppid 链向上，返回每个祖先的 cmdline
    fn ancestor_cmdlines(pid: i32) -> Vec<String> {
        let mut out = Vec::new();
        let mut cur = pid;
        let mut seen = HashSet::new();
        while cur > 1 && seen.insert(cur) {
            if let Ok(cmd) = fs::read(format!("/proc/{cur}/cmdline")) {
                let joined = cmd
                    .split(|b| *b == 0)
                    .flat_map(|p| {
                        let mut part = p.to_vec();
                        part.push(b' ');
                        part
                    })
                    .collect::<Vec<u8>>();
                let text = String::from_utf8_lossy(&joined).trim().to_string();
                if !text.is_empty() {
                    out.push(text);
                }
            }
            cur = match read_ppid(cur) {
                Some(p) => p,
                None => break,
            };
        }
        out
    }

    fn read_ppid(pid: i32) -> Option<i32> {
        let stat = fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
        let after = &stat[stat.rfind(')')? + 2..];
        after.split_whitespace().nth(1)?.parse().ok()
    }

    struct BootConfig {
        policy: Policy,
        /// None(外层) = 默认自动；Some(None) = 关闭；Some(Some(path)) = 显式路径
        socket: Option<Option<String>>,
    }

    fn parse_args() -> BootConfig {
        let mut policy = Policy::default();
        let mut socket: Option<Option<String>> = None;
        let mut args = std::env::args().skip(1);
        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--deny-prefix" => {
                    if let Some(v) = args.next() {
                        policy.deny_prefixes.push(v);
                    }
                }
                "--lockdown-agent" => {
                    if let Some(v) = args.next() {
                        policy.lockdown_agents.push(v.to_lowercase());
                    }
                }
                "--watch" => {
                    if let Some(v) = args.next() {
                        policy.watch_paths.push(v);
                    }
                }
                "--socket" => socket = Some(args.next()),
                "--no-socket" => socket = Some(None),
                other => eprintln!("ignoring unknown argument: {other}"),
            }
        }
        if policy.watch_paths.is_empty() {
            policy.watch_paths.push("/".to_string());
        }
        BootConfig { policy, socket }
    }

    fn fan_fd() -> io::Result<RawFd> {
        // FAN_UNLIMITED_QUEUE 需要 CAP_SYS_ADMIN；permission event 本身也要求该能力
        let fd = unsafe {
            fanotify_init(
                FAN_CLASS_CONTENT | FAN_UNLIMITED_QUEUE,
                (O_RDONLY | O_CLOEXEC) as u32,
            )
        };
        if fd < 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(fd)
    }

    fn mark(fd: RawFd, target: &str, mask: u64, flags: u32) -> io::Result<()> {
        let path = CString::new(target).unwrap();
        let rc = unsafe { fanotify_mark(fd, flags, mask, libc::AT_FDCWD, path.as_ptr()) };
        if rc < 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }

    fn exec_mask() -> u64 {
        FAN_OPEN_EXEC_PERM | FAN_EVENT_ON_CHILD
    }

    fn apply_marks(fd: RawFd, policy: &Policy) -> io::Result<()> {
        let mask = exec_mask();
        for path in &policy.watch_paths {
            // 同一文件系统内，MOUNT 标记覆盖该挂载点，FILESYSTEM 标记覆盖整个文件系统
            mark(fd, path, mask, FAN_MARK_ADD | FAN_MARK_MOUNT)?;
            mark(fd, path, mask, FAN_MARK_ADD | FAN_MARK_FILESYSTEM)?;
        }
        Ok(())
    }

    fn flush_marks(fd: RawFd, policy: &Policy) {
        for path in &policy.watch_paths {
            let _ = mark(fd, path, 0, FAN_MARK_FLUSH | FAN_MARK_MOUNT);
            let _ = mark(fd, path, 0, FAN_MARK_FLUSH | FAN_MARK_FILESYSTEM);
        }
    }

    /// 监听点变更：先整体清掉旧标记，再按新策略重建
    fn replace_watches(fd: RawFd, old: &Policy, new: &Policy) -> io::Result<()> {
        flush_marks(fd, old);
        apply_marks(fd, new)
    }

    fn bind_listener(path: &str) -> io::Result<RawFd> {
        let _ = fs::remove_file(path);
        if let Some(parent) = Path::new(path).parent() {
            fs::create_dir_all(parent)?;
        }
        let lfd = unsafe { libc::socket(AF_UNIX, SOCK_STREAM | SOCK_NONBLOCK | SOCK_CLOEXEC, 0) };
        if lfd < 0 {
            return Err(io::Error::last_os_error());
        }

        let mut addr: sockaddr_un = unsafe { std::mem::zeroed() };
        addr.sun_family = AF_UNIX as _;
        let bytes = path.as_bytes();
        if bytes.len() >= addr.sun_path.len() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "socket path too long",
            ));
        }
        unsafe {
            std::ptr::copy_nonoverlapping(
                bytes.as_ptr() as *const c_void,
                addr.sun_path.as_mut_ptr() as *mut c_void,
                bytes.len(),
            );
        }
        let len = std::mem::offset_of!(sockaddr_un, sun_path) + bytes.len();
        let rc = unsafe { libc::bind(lfd, (&addr as *const sockaddr_un).cast(), len as u32) };
        if rc < 0 {
            return Err(io::Error::last_os_error());
        }
        let cpath = CString::new(path).unwrap();
        // 本机任何用户都能连进来下发策略：信任边界等同本机登录，文档里写明
        unsafe {
            libc::chmod(cpath.as_ptr(), 0o666);
        }
        let rc = unsafe { libc::listen(lfd, 8) };
        if rc < 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(lfd)
    }

    fn open_listener(cfg: Option<Option<String>>) -> Option<(RawFd, String)> {
        match cfg {
            Some(Some(p)) => match bind_listener(&p) {
                Ok(fd) => Some((fd, p)),
                Err(e) => {
                    eprintln!("fanotify enforcer: cannot bind control socket {p}: {e}");
                    None
                }
            },
            Some(None) => None,
            None => {
                for p in [DEFAULT_SOCKET_RUN, DEFAULT_SOCKET_TMP] {
                    if let Ok(fd) = bind_listener(p) {
                        return Some((fd, p.to_string()));
                    }
                }
                eprintln!("fanotify enforcer: no control socket available");
                None
            }
        }
    }

    fn json_ok(v: serde_json::Value) -> String {
        serde_json::json!({"ok": true, "result": v}).to_string()
    }

    fn json_err(e: &str) -> String {
        serde_json::json!({"ok": false, "error": e}).to_string()
    }

    fn handle_request(line: &str, state: &State, fan: RawFd) -> String {
        let req: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(e) => return json_err(&format!("invalid json: {e}")),
        };
        match req.get("op").and_then(|v| v.as_str()) {
            Some("status") => {
                let s = state.read();
                let body = serde_json::json!({
                    "policy": s.policy,
                    "allowed": s.allowed,
                    "denied": s.denied,
                    "pid": process::id(),
                });
                json_ok(body)
            }
            Some("apply") => {
                let policy: Policy = match req.get("policy").cloned() {
                    Some(v) => match serde_json::from_value::<Policy>(v) {
                        Ok(mut p) => {
                            if p.watch_paths.is_empty() {
                                p.watch_paths.push("/".to_string());
                            }
                            p
                        }
                        Err(e) => return json_err(&format!("invalid policy: {e}")),
                    },
                    None => return json_err("missing policy"),
                };
                let old = state.read().policy.clone();
                if let Err(e) = replace_watches(fan, &old, &policy) {
                    return json_err(&format!("failed to update watches: {e}"));
                }
                state.write().policy = policy;
                json_ok(serde_json::Value::String("applied".to_string()))
            }
            Some(other) => json_err(&format!("unknown op: {other}")),
            None => json_err("missing op"),
        }
    }

    struct Client {
        fd: RawFd,
        buf: String,
    }

    fn read_available(fd: RawFd) -> io::Result<Vec<u8>> {
        let mut all = Vec::new();
        let mut chunk = [0u8; 4096];
        loop {
            let n = unsafe { libc::read(fd, chunk.as_mut_ptr() as *mut c_void, chunk.len()) };
            if n < 0 {
                let err = io::Error::last_os_error();
                if err.raw_os_error() == Some(libc::EAGAIN)
                    || err.raw_os_error() == Some(libc::EWOULDBLOCK)
                {
                    break;
                }
                return Err(err);
            }
            if n == 0 {
                if all.is_empty() {
                    return Err(io::Error::new(io::ErrorKind::UnexpectedEof, "eof"));
                }
                break;
            }
            all.extend_from_slice(&chunk[..n as usize]);
            if (n as usize) < chunk.len() {
                break;
            }
        }
        Ok(all)
    }

    fn write_response(fd: RawFd, resp: &str) {
        let data = format!("{resp}\n");
        let _ = unsafe { libc::write(fd, data.as_ptr() as *const c_void, data.len()) };
    }

    fn exec_path_of(event_fd: RawFd) -> String {
        // event fd 在守护进程自己的 fd 表里，读 /proc/self/fd；
        // 不能去目标进程的 fd 表找（那个编号不属于它）
        let link = format!("/proc/self/fd/{event_fd}");
        match fs::read_link(link) {
            Ok(p) => p.to_string_lossy().into_owned(),
            Err(_) => String::from("<unknown>"),
        }
    }

    fn respond(fd: RawFd, event_fd: RawFd, allow: bool) -> io::Result<()> {
        let resp = fanotify_response {
            fd: event_fd,
            response: if allow { FAN_ALLOW } else { FAN_DENY },
        };
        let bytes = unsafe {
            std::slice::from_raw_parts(
                &resp as *const fanotify_response as *const u8,
                std::mem::size_of::<fanotify_response>(),
            )
        };
        let n = unsafe { libc::write(fd, bytes.as_ptr() as *const c_void, bytes.len()) };
        if n < 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }

    fn handle_fan(fan: RawFd, buf: &mut [u8], state: &State) -> io::Result<()> {
        let n = unsafe { libc::read(fan, buf.as_mut_ptr() as *mut c_void, buf.len()) };
        if n < 0 {
            let err = io::Error::last_os_error();
            if err.raw_os_error() == Some(libc::EINTR) {
                return Ok(());
            }
            return Err(err);
        }
        let len = n as usize;
        // 每轮事件克隆一份策略快照，裁决期间不持锁，避免 /proc 遍历阻塞控制通道
        let policy = state.read().policy.clone();

        let mut meta = buf.as_ptr() as *const fanotify_event_metadata;
        let mut remaining = len;
        while event_ok(meta, remaining) {
            let m = unsafe { &*meta };

            let is_exec = m.mask & FAN_OPEN_EXEC_PERM != 0 && m.pid != 0;
            let path = if is_exec {
                exec_path_of(m.fd)
            } else {
                String::new()
            };
            let (allow, reason) = if is_exec {
                match policy.decide(m.pid, &path) {
                    Decision::Allow => {
                        state.write().allowed += 1;
                        (true, "allow".to_string())
                    }
                    Decision::Deny(r) => {
                        state.write().denied += 1;
                        (false, r)
                    }
                }
            } else {
                (true, format!("non-exec event mask=0x{:x}", m.mask))
            };
            println!(
                "{}",
                serde_json::json!({
                    "pid": m.pid,
                    "path": path,
                    "mask": format!("0x{:x}", m.mask),
                    "decision": if allow { "allow" } else { "deny" },
                    "reason": reason,
                })
            );
            io::stdout().flush().ok();
            respond(fan, m.fd, allow)?;
            unsafe { libc::close(m.fd) };

            // FAN_EVENT_NEXT
            let event_len = m.event_len as usize;
            remaining -= event_len;
            meta = unsafe { (meta as *const u8).add(event_len) as *const fanotify_event_metadata };
        }
        Ok(())
    }

    pub(crate) fn run() -> anyhow::Result<()> {
        if unsafe { libc::geteuid() } != 0 {
            eprintln!("fanotify-enforcer must run as root (needs CAP_SYS_ADMIN)");
            process::exit(1);
        }
        let boot = parse_args();
        let fan = fan_fd()?;
        apply_marks(fan, &boot.policy)?;
        for path in &boot.policy.watch_paths {
            eprintln!("fanotify enforcer: watching exec under {path}");
        }

        let listener = open_listener(boot.socket);
        let sock_path = listener.as_ref().map(|(_, p)| p.clone());
        if let Some(ref p) = sock_path {
            eprintln!("fanotify enforcer: control socket at {p}");
        }
        eprintln!("fanotify enforcer started");

        let state: State = Arc::new(RwLock::new(Shared {
            policy: boot.policy,
            allowed: 0,
            denied: 0,
        }));

        // 独立线程 sigwait 收 SIGTERM/SIGINT：按当前策略清标记、删 socket 后退出
        {
            let state = state.clone();
            std::thread::spawn(move || {
                let mut set: libc::sigset_t = unsafe { std::mem::zeroed() };
                unsafe {
                    libc::sigemptyset(&mut set);
                    libc::sigaddset(&mut set, libc::SIGTERM);
                    libc::sigaddset(&mut set, libc::SIGINT);
                    libc::pthread_sigmask(libc::SIG_BLOCK, &set, std::ptr::null_mut());
                    let mut sig: i32 = 0;
                    loop {
                        if libc::sigwait(&set, &mut sig) == 0
                            && matches!(sig, libc::SIGTERM | libc::SIGINT)
                        {
                            let policy = state.read().policy.clone();
                            flush_marks(fan, &policy);
                            libc::close(fan);
                            if let Some(p) = &sock_path {
                                let _ = fs::remove_file(p);
                            }
                            process::exit(0);
                        }
                    }
                }
            });
        }

        let mut el = EventLoop::new(fan, listener.map(|(lfd, _)| lfd));
        loop {
            if let Err(e) = el.step(&state) {
                if e.raw_os_error() == Some(libc::EINTR) {
                    continue;
                }
                return Err(e.into());
            }
        }
    }

    /// fanotify fd + 控制 listener + 已接受 client 的单次 poll 循环
    struct EventLoop {
        fan: RawFd,
        listener: Option<RawFd>,
        clients: Vec<Client>,
        buf: [u8; 8192],
    }

    impl EventLoop {
        fn new(fan: RawFd, listener: Option<RawFd>) -> Self {
            Self {
                fan,
                listener,
                clients: Vec::new(),
                buf: [0u8; 8192],
            }
        }

        fn step(&mut self, state: &State) -> io::Result<()> {
            let mut pfds: Vec<pollfd> = Vec::with_capacity(2 + self.clients.len());
            pfds.push(pollfd {
                fd: self.fan,
                events: POLLIN,
                revents: 0,
            });
            let client_base = match self.listener {
                Some(lfd) => {
                    pfds.push(pollfd {
                        fd: lfd,
                        events: POLLIN,
                        revents: 0,
                    });
                    2
                }
                None => 1,
            };
            for c in &self.clients {
                pfds.push(pollfd {
                    fd: c.fd,
                    events: POLLIN,
                    revents: 0,
                });
            }
            // 本轮只处理 poll 时已存在的 client；accept 阶段新加入的下一轮再处理，
            // 否则 pfds 里没有它们的位置会越界
            let polled_clients = self.clients.len();

            let pr = unsafe { poll(pfds.as_mut_ptr(), pfds.len() as u64, 250) };
            if pr < 0 {
                return Err(io::Error::last_os_error());
            }

            if pfds[0].revents & POLLIN != 0 {
                handle_fan(self.fan, &mut self.buf, state)?;
            }

            if let Some(lfd) = self.listener {
                if pfds[1].revents & POLLIN != 0 {
                    loop {
                        let cfd = unsafe {
                            libc::accept4(
                                lfd,
                                std::ptr::null_mut(),
                                std::ptr::null_mut(),
                                SOCK_CLOEXEC | SOCK_NONBLOCK,
                            )
                        };
                        if cfd < 0 {
                            break;
                        }
                        self.clients.push(Client {
                            fd: cfd,
                            buf: String::new(),
                        });
                    }
                }
            }

            let mut close_idx: Vec<usize> = Vec::new();
            for i in 0..polled_clients {
                let c = &mut self.clients[i];
                let pidx = client_base + i;
                if pfds[pidx].revents & (POLLIN | POLLHUP | POLLERR) != 0 {
                    let mut eof = false;
                    match read_available(c.fd) {
                        Ok(bytes) => c.buf.push_str(&String::from_utf8_lossy(&bytes)),
                        Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => eof = true,
                        Err(_) => {
                            close_idx.push(i);
                            continue;
                        }
                    }
                    if c.buf.len() > MAX_CLIENT_BUF {
                        write_response(c.fd, &json_err("request too large"));
                        close_idx.push(i);
                        continue;
                    }
                    let line = match c.buf.find('\n') {
                        Some(nl) => c.buf[..nl].to_string(),
                        None if eof && !c.buf.is_empty() => c.buf.clone(),
                        None => continue,
                    };
                    let line = line.trim();
                    if line.is_empty() {
                        close_idx.push(i);
                        continue;
                    }
                    let resp = handle_request(line, state, self.fan);
                    write_response(c.fd, &resp);
                    close_idx.push(i);
                }
            }
            for i in close_idx.into_iter().rev() {
                let c = self.clients.remove(i);
                unsafe { libc::close(c.fd) };
            }
            Ok(())
        }
    }

    fn event_ok(meta: *const fanotify_event_metadata, len: usize) -> bool {
        let meta_len = std::mem::size_of::<fanotify_event_metadata>();
        if len < meta_len {
            return false;
        }
        let m = unsafe { &*meta };
        m.event_len as usize >= meta_len && (m.event_len as usize) <= len
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn deny_prefix_matches() {
            let p = Policy {
                deny_prefixes: vec!["/tmp/guardfan/deny".to_string()],
                ..Policy::default()
            };
            assert!(matches!(
                p.decide(999999, "/tmp/guardfan/deny/true"),
                Decision::Deny(_)
            ));
        }

        #[test]
        fn lockdown_matches_ancestor_cmdline() {
            let p = Policy {
                lockdown_agents: vec!["claude-code".to_string()],
                ..Policy::default()
            };
            let ancestors = vec![
                "bash -c echo x".to_string(),
                "claude-code /tmp/fast-agent.sh".to_string(),
            ];
            assert!(matches!(p.match_lockdown(&ancestors), Decision::Deny(_)));

            let clean = vec!["bash -c echo x".to_string(), "sshd: user".to_string()];
            assert!(matches!(p.match_lockdown(&clean), Decision::Allow));
        }

        #[test]
        fn default_policy_allows() {
            let p = Policy::default();
            assert!(matches!(
                p.match_lockdown(&["anything".to_string()]),
                Decision::Allow
            ));
        }

        #[test]
        fn policy_json_roundtrip() {
            let p = Policy {
                deny_prefixes: vec!["/a".to_string()],
                lockdown_agents: vec!["claude".to_string()],
                watch_paths: vec!["/".to_string()],
            };
            let text = serde_json::to_string(&p).unwrap();
            let back: Policy = serde_json::from_str(&text).unwrap();
            assert_eq!(back.deny_prefixes, p.deny_prefixes);
            assert_eq!(back.lockdown_agents, p.lockdown_agents);
            assert_eq!(back.watch_paths, p.watch_paths);
        }

        #[test]
        fn status_request_shape() {
            let st: State = Arc::new(RwLock::new(Shared::default()));
            let raw = handle_request("{\"op\":\"status\"}", &st, -1);
            let v: serde_json::Value = serde_json::from_str(&raw).unwrap();
            assert_eq!(v["ok"], true);
            assert!(v["result"]["policy"].is_object());
            assert_eq!(v["result"]["allowed"], 0);
        }

        #[test]
        fn unknown_op_errors() {
            let st: State = Arc::new(RwLock::new(Shared::default()));
            let raw = handle_request("{\"op\":\"nope\"}", &st, -1);
            let v: serde_json::Value = serde_json::from_str(&raw).unwrap();
            assert_eq!(v["ok"], false);
        }

        /// 真实 EventLoop + 真实 Unix socket 端到端：
        /// 连接在某一步被 accept，下一步必须被服务，不能越界崩溃
        #[test]
        fn event_loop_serves_socket() {
            use std::io::{Read, Write};
            use std::os::unix::net::UnixStream;
            use std::thread;
            use std::time::Duration;

            let path = format!("/tmp/guard-el-{}.sock", process::id());
            let lfd = bind_listener(&path).unwrap();
            let st: State = Arc::new(RwLock::new(Shared::default()));
            let mut el = EventLoop::new(-1, Some(lfd));

            let server = thread::spawn(move || {
                for _ in 0..100 {
                    el.step(&st).unwrap();
                    thread::sleep(Duration::from_millis(5));
                }
            });

            thread::sleep(Duration::from_millis(30));
            let mut c = UnixStream::connect(&path).unwrap();
            c.write_all(b"{\"op\":\"status\"}\n").unwrap();
            c.set_read_timeout(Some(Duration::from_secs(2))).unwrap();
            let mut buf = [0u8; 2048];
            let n = c.read(&mut buf).unwrap();
            let raw = String::from_utf8_lossy(&buf[..n]);
            let line = raw.lines().next().unwrap();
            let v: serde_json::Value = serde_json::from_str(line).unwrap();
            assert_eq!(v["ok"], true);
            assert!(v["result"]["policy"].is_object());
            assert!(v["result"]["pid"].is_number());

            let _ = fs::remove_file(&path);
            server.join().unwrap();
        }
    }
}

#[cfg(target_os = "linux")]
fn main() -> anyhow::Result<()> {
    imp::run()
}

#[cfg(not(target_os = "linux"))]
fn main() {
    eprintln!("fanotify-enforcer is only supported on Linux");
    std::process::exit(1);
}
