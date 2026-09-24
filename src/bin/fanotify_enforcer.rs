//! fanotify 执行拦截守护进程
//!
//! 在命令真正 `execve` 之前通过 fanotify 的 permission event 做裁决，
//! 补上用户态 /proc 轮询拦不住瞬时命令的缺口。
//!
//! 两类策略，默认全部放行，只拦命中的：
//!   --deny-prefix <PATH>      可执行文件路径以该前缀开头 → 拒绝（可重复）
//!   --lockdown-agent <PAT>    进程任一祖先的 cmdline 命中 → 拒绝（可重复）
//!
//! 需要 root（CAP_SYS_ADMIN）。每条裁决输出一行 JSON 审计日志。

use std::collections::HashSet;
use std::ffi::CString;
use std::io::{self, Write};
use std::os::fd::RawFd;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::{fs, process};

use libc::{
    c_void, fanotify_event_metadata, fanotify_init, fanotify_mark, fanotify_response, FAN_ALLOW,
    FAN_CLASS_CONTENT, FAN_DENY, FAN_EVENT_ON_CHILD, FAN_MARK_ADD, FAN_MARK_FLUSH, FAN_MARK_MOUNT,
    FAN_OPEN_EXEC_PERM, FAN_UNLIMITED_QUEUE, O_CLOEXEC, O_RDONLY,
};

#[derive(Default)]
struct Policy {
    deny_prefixes: Vec<String>,
    lockdown_agents: Vec<String>,
}

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

fn parse_args() -> Policy {
    let mut policy = Policy::default();
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
            other => eprintln!("ignoring unknown argument: {other}"),
        }
    }
    policy
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

fn mark_mount(fd: RawFd, mount: &str, mask: u64, flags: u32) -> io::Result<()> {
    let path = CString::new(mount.as_bytes()).unwrap();
    let rc = unsafe { fanotify_mark(fd, flags, mask, libc::AT_FDCWD, path.as_ptr()) };
    if rc < 0 {
        return Err(io::Error::last_os_error());
    }
    Ok(())
}

fn exec_path_of(pid: i32, event_fd: RawFd) -> String {
    let link = format!("/proc/{pid}/fd/{event_fd}");
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

fn main() -> anyhow::Result<()> {
    if unsafe { libc::geteuid() } != 0 {
        eprintln!("fanotify-enforcer must run as root (needs CAP_SYS_ADMIN)");
        process::exit(1);
    }
    let policy = parse_args();
    let fan = fan_fd()?;
    mark_mount(
        fan,
        "/",
        FAN_OPEN_EXEC_PERM | FAN_EVENT_ON_CHILD,
        FAN_MARK_ADD | FAN_MARK_MOUNT,
    )?;
    eprintln!("fanotify enforcer started: watching exec on / mount");

    // 用 sigwait 在独立线程收 SIGTERM/SIGINT，收到后清标记再退出
    let stop = Arc::new(AtomicBool::new(false));
    {
        let stop = stop.clone();
        std::thread::spawn(move || {
            let mut set: libc::sigset_t = unsafe { std::mem::zeroed() };
            unsafe {
                libc::sigemptyset(&mut set);
                libc::sigaddset(&mut set, libc::SIGTERM);
                libc::sigaddset(&mut set, libc::SIGINT);
                libc::pthread_sigmask(libc::SIG_BLOCK, &set, std::ptr::null_mut());
                let mut sig: i32 = 0;
                libc::sigwait(&set, &mut sig);
            }
            stop.store(true, Ordering::SeqCst);
            let _ = mark_mount(fan, "/", 0, FAN_MARK_FLUSH | FAN_MARK_MOUNT);
            unsafe { libc::close(fan) };
            process::exit(0);
        });
    }

    let mut allowed: u64 = 0;
    let mut denied: u64 = 0;
    let mut buf = [0u8; 8192];

    loop {
        if stop.load(Ordering::SeqCst) {
            break;
        }
        let n = unsafe { libc::read(fan, buf.as_mut_ptr() as *mut c_void, buf.len()) };
        if n < 0 {
            let err = io::Error::last_os_error();
            if err.raw_os_error() == Some(libc::EINTR) {
                continue;
            }
            return Err(err.into());
        }
        let len = n as usize;

        let mut meta = buf.as_ptr() as *const fanotify_event_metadata;
        let mut remaining = len;
        while event_ok(meta, remaining) {
            let m = unsafe { &*meta };

            if m.mask & FAN_OPEN_EXEC_PERM != 0 && m.pid != 0 {
                let path = exec_path_of(m.pid, m.fd);
                let (allow, reason) = match policy.decide(m.pid, &path) {
                    Decision::Allow => {
                        allowed += 1;
                        (true, "allow".to_string())
                    }
                    Decision::Deny(r) => {
                        denied += 1;
                        (false, r)
                    }
                };
                println!(
                    "{}",
                    serde_json::json!({
                        "pid": m.pid,
                        "path": path,
                        "decision": if allow { "allow" } else { "deny" },
                        "reason": reason,
                    })
                );
                io::stdout().flush().ok();
                respond(fan, m.fd, allow)?;
            } else {
                respond(fan, m.fd, true)?;
            }
            unsafe { libc::close(m.fd) };

            // FAN_EVENT_NEXT
            let event_len = m.event_len as usize;
            remaining -= event_len;
            meta = unsafe { (meta as *const u8).add(event_len) as *const fanotify_event_metadata };
        }
    }

    // 退出前清掉挂载标记，避免遗留裁决点
    let _ = mark_mount(fan, "/", 0, FAN_MARK_FLUSH | FAN_MARK_MOUNT);
    unsafe { libc::close(fan) };
    eprintln!("fanotify enforcer stopped: allowed={allowed} denied={denied}");
    Ok(())
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
}
