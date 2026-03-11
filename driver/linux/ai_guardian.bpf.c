/*
 * AI Guardian Linux eBPF Program
 * 
 * 功能：
 * 1. 监控系统调用 (execve, open, write, connect)
 * 2. 识别 AI Agent 终端进程
 * 3. 拦截危险操作
 */

#include "vmlinux.h"
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>
#include <bpf/bpf_core_read.h>

#define AI_GUARDIAN_MAX_PROCESSES 1024
#define PATH_MAX 256
#define TASK_COMM_LEN 16

/* 事件类型 */
enum event_type {
    EVENT_PROCESS_EXEC,
    EVENT_FILE_OPEN,
    EVENT_FILE_WRITE,
    EVENT_FILE_DELETE,
    EVENT_NETWORK_CONNECT,
    EVENT_PROCESS_EXIT,
};

/* 事件结构 */
struct event {
    u32 type;
    u32 pid;
    u32 ppid;
    u32 uid;
    u64 timestamp;
    u64 risk_score;
    char comm[TASK_COMM_LEN];
    char path[PATH_MAX];
    u32 remote_ip;
    u16 remote_port;
    u8 blocked;
};

/* AI 终端进程列表 */
struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, AI_GUARDIAN_MAX_PROCESSES);
    __type(key, u32);
    __type(value, u64); /* 注册时间戳 */
} ai_processes SEC(".maps");

/* 事件环形缓冲区 */
struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 256 * 1024); /* 256KB */
} events SEC(".maps");

/* 配置 */
struct guardian_config {
    u32 block_file_delete;
    u32 block_system_path_write;
    u32 block_network_connection;
    u32 log_all_operations;
    u32 risk_threshold;
};

struct {
    __uint(type, BPF_MAP_TYPE_ARRAY);
    __uint(max_entries, 1);
    __type(key, u32);
    __type(value, struct guardian_config);
} config_map SEC(".maps");

/* 统计信息 */
struct stats {
    u64 operations_blocked;
    u64 operations_allowed;
    u64 ai_process_count;
};

struct {
    __uint(type, BPF_MAP_TYPE_ARRAY);
    __uint(max_entries, 1);
    __type(key, u32);
    __type(value, struct stats);
} stats_map SEC(".maps");

/* 敏感路径列表 */
static const char sensitive_paths[][32] = {
    "/bin",
    "/sbin",
    "/usr/bin",
    "/usr/sbin",
    "/etc",
    "/boot",
    "/lib",
    "/lib64",
    "/usr/lib",
    "/usr/lib64",
    "/var/log",
    "/root",
    "/home",
};

/* 检查是否是 AI 终端进程 */
static __always_inline bool is_ai_process(u32 pid)
{
    u64 *ts = bpf_map_lookup_elem(&ai_processes, &pid);
    return ts != NULL;
}

/* 检查路径是否是敏感路径 */
static __always_inline bool is_sensitive_path(const char *path)
{
    #pragma unroll
    for (int i = 0; i < sizeof(sensitive_paths) / sizeof(sensitive_paths[0]); i++) {
        if (bpf_strncmp(path, 32, sensitive_paths[i]) == 0) {
            return true;
        }
    }
    return false;
}

/* 获取当前配置 */
static __always_inline struct guardian_config *get_config(void)
{
    u32 key = 0;
    return bpf_map_lookup_elem(&config_map, &key);
}

/* 更新统计 */
static __always_inline void update_stats(bool blocked)
{
    u32 key = 0;
    struct stats *s = bpf_map_lookup_elem(&stats_map, &key);
    if (s) {
        if (blocked) {
            __sync_fetch_and_add(&s->operations_blocked, 1);
        } else {
            __sync_fetch_and_add(&s->operations_allowed, 1);
        }
    }
}

/* 提交事件 */
static __always_inline void submit_event(struct event *e)
{
    bpf_ringbuf_submit(e, 0);
}

/* 获取父进程 PID */
static __always_inline u32 get_ppid(struct task_struct *task)
{
    struct task_struct *parent;
    bpf_probe_read_kernel(&parent, sizeof(parent), &task->real_parent);
    u32 ppid;
    bpf_probe_read_kernel(&ppid, sizeof(ppid), &parent->tgid);
    return ppid;
}

/* ==================== 系统调用探针 ==================== */

/* execve 入口 - 监控进程执行 */
SEC("tp/syscalls/sys_enter_execve")
int trace_execve_enter(struct trace_event_raw_sys_enter *ctx)
{
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    /* 只监控 AI 终端进程 */
    if (!is_ai_process(pid)) {
        return 0;
    }
    
    struct event *e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
    if (!e) {
        return 0;
    }
    
    e->type = EVENT_PROCESS_EXEC;
    e->pid = pid;
    e->ppid = get_ppid((struct task_struct *)bpf_get_current_task());
    e->uid = bpf_get_current_uid_gid() & 0xFFFFFFFF;
    e->timestamp = bpf_ktime_get_ns();
    e->blocked = 0;
    
    bpf_get_current_comm(&e->comm, sizeof(e->comm));
    
    /* 读取执行路径 */
    const char *filename = (const char *)ctx->args[0];
    bpf_probe_read_user_str(&e->path, sizeof(e->path), filename);
    
    submit_event(e);
    update_stats(false);
    
    return 0;
}

/* openat 入口 - 监控文件打开 */
SEC("tp/syscalls/sys_enter_openat")
int trace_openat_enter(struct trace_event_raw_sys_enter *ctx)
{
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    if (!is_ai_process(pid)) {
        return 0;
    }
    
    int dfd = ctx->args[0];
    const char *filename = (const char *)ctx->args[1];
    int flags = ctx->args[2];
    
    char path[PATH_MAX];
    bpf_probe_read_user_str(&path, sizeof(path), filename);
    
    /* 检查是否是删除操作 (O_TRUNC) */
    if (flags & 01000) { /* O_TRUNC */
        struct guardian_config *cfg = get_config();
        if (cfg && cfg->block_file_delete && is_sensitive_path(path)) {
            /* 阻断操作 */
            struct event *e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
            if (e) {
                e->type = EVENT_FILE_DELETE;
                e->pid = pid;
                e->timestamp = bpf_ktime_get_ns();
                e->blocked = 1;
                bpf_get_current_comm(&e->comm, sizeof(e->comm));
                __builtin_memcpy(&e->path, path, sizeof(e->path));
                submit_event(e);
            }
            update_stats(true);
            return -EPERM;
        }
    }
    
    struct event *e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
    if (e) {
        e->type = EVENT_FILE_OPEN;
        e->pid = pid;
        e->timestamp = bpf_ktime_get_ns();
        e->blocked = 0;
        bpf_get_current_comm(&e->comm, sizeof(e->comm));
        __builtin_memcpy(&e->path, path, sizeof(e->path));
        submit_event(e);
    }
    
    update_stats(false);
    return 0;
}

/* unlinkat 入口 - 监控文件删除 */
SEC("tp/syscalls/sys_enter_unlinkat")
int trace_unlinkat_enter(struct trace_event_raw_sys_enter *ctx)
{
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    if (!is_ai_process(pid)) {
        return 0;
    }
    
    struct guardian_config *cfg = get_config();
    if (!cfg || !cfg->block_file_delete) {
        return 0;
    }
    
    const char *pathname = (const char *)ctx->args[1];
    char path[PATH_MAX];
    bpf_probe_read_user_str(&path, sizeof(path), pathname);
    
    /* 检查是否是敏感路径 */
    if (is_sensitive_path(path)) {
        struct event *e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
        if (e) {
            e->type = EVENT_FILE_DELETE;
            e->pid = pid;
            e->timestamp = bpf_ktime_get_ns();
            e->blocked = 1;
            bpf_get_current_comm(&e->comm, sizeof(e->comm));
            __builtin_memcpy(&e->path, path, sizeof(e->path));
            submit_event(e);
        }
        update_stats(true);
        return -EPERM; /* 阻断删除 */
    }
    
    struct event *e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
    if (e) {
        e->type = EVENT_FILE_DELETE;
        e->pid = pid;
        e->timestamp = bpf_ktime_get_ns();
        e->blocked = 0;
        bpf_get_current_comm(&e->comm, sizeof(e->comm));
        __builtin_memcpy(&e->path, path, sizeof(e->path));
        submit_event(e);
    }
    
    update_stats(false);
    return 0;
}

/* write 入口 - 监控文件写入 */
SEC("tp/syscalls/sys_enter_write")
int trace_write_enter(struct trace_event_raw_sys_enter *ctx)
{
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    if (!is_ai_process(pid)) {
        return 0;
    }
    
    struct guardian_config *cfg = get_config();
    if (!cfg || !cfg->log_all_operations) {
        return 0;
    }
    
    /* 这里可以添加更多写入监控逻辑 */
    
    return 0;
}

/* connect 入口 - 监控网络连接 */
SEC("tp/syscalls/sys_enter_connect")
int trace_connect_enter(struct trace_event_raw_sys_enter *ctx)
{
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    if (!is_ai_process(pid)) {
        return 0;
    }
    
    struct guardian_config *cfg = get_config();
    if (!cfg || !cfg->block_network_connection) {
        return 0;
    }
    
    struct sockaddr *addr = (struct sockaddr *)ctx->args[1];
    
    struct event *e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
    if (!e) {
        return 0;
    }
    
    e->type = EVENT_NETWORK_CONNECT;
    e->pid = pid;
    e->timestamp = bpf_ktime_get_ns();
    e->blocked = 0;
    bpf_get_current_comm(&e->comm, sizeof(e->comm));
    
    /* 读取目标地址 */
    sa_family_t family;
    bpf_probe_read_user(&family, sizeof(family), &addr->sa_family);
    
    if (family == AF_INET) {
        struct sockaddr_in *sin = (struct sockaddr_in *)addr;
        bpf_probe_read_user(&e->remote_ip, sizeof(e->remote_ip), &sin->sin_addr.s_addr);
        bpf_probe_read_user(&e->remote_port, sizeof(e->remote_port), &sin->sin_port);
        e->remote_port = __builtin_bswap16(e->remote_port);
    }
    
    /* 检查是否是可疑端口 */
    if (e->remote_port == 4444 || e->remote_port == 5555 || 
        e->remote_port == 6666 || e->remote_port == 31337) {
        e->blocked = 1;
        submit_event(e);
        update_stats(true);
        return -EPERM; /* 阻断可疑连接 */
    }
    
    submit_event(e);
    update_stats(false);
    return 0;
}

/* exit_group 入口 - 监控进程退出 */
SEC("tp/syscalls/sys_enter_exit_group")
int trace_exit_group_enter(struct trace_event_raw_sys_enter *ctx)
{
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    if (!is_ai_process(pid)) {
        return 0;
    }
    
    /* 从 AI 进程列表中移除 */
    bpf_map_delete_elem(&ai_processes, &pid);
    
    struct event *e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
    if (e) {
        e->type = EVENT_PROCESS_EXIT;
        e->pid = pid;
        e->timestamp = bpf_ktime_get_ns();
        e->blocked = 0;
        bpf_get_current_comm(&e->comm, sizeof(e->comm));
        submit_event(e);
    }
    
    return 0;
}

/* LSM 安全钩子 - 更细粒度的控制 */
#ifdef CONFIG_SECURITY

/* 文件打开安全检查 */
SEC("lsm/file_open")
int BPF_PROG(ai_guardian_file_open, struct file *file)
{
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    if (!is_ai_process(pid)) {
        return 0;
    }
    
    /* 可以在这里添加更复杂的检查 */
    
    return 0;
}

/* 进程执行安全检查 */
SEC("lsm/bprm_check_security")
int BPF_PROG(ai_guardian_bprm_check, struct linux_binprm *bprm)
{
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    if (!is_ai_process(pid)) {
        return 0;
    }
    
    /* 检查执行的程序 */
    
    return 0;
}

#endif /* CONFIG_SECURITY */

char LICENSE[] SEC("license") = "GPL";
