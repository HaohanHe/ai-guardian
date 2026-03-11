# 开源 EDR/杀毒软件架构学习

> **学习已有开源方案，站在巨人肩膀上**

---

## 1. ClamAV - 最经典的开源杀毒软件

### 架构
```
┌─────────────────────────────────────────────────────────────┐
│  用户层 (C/C++)                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ clamscan     │  │ clamd        │  │ freshclam    │      │
│  │ (命令行扫描) │  │ (守护进程)   │  │ (病毒库更新) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└──────────────────────────┬──────────────────────────────────┘
                           │ Unix Socket / TCP
┌──────────────────────────▼──────────────────────────────────┐
│  引擎层 (C)                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  • 病毒特征匹配引擎                                  │   │
│  │  • 启发式分析                                        │   │
│  │  • 文件解压 (支持 30+ 格式)                          │   │
│  │  • 缓存系统                                          │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ 系统调用
┌──────────────────────────▼──────────────────────────────────┐
│  系统层                                                     │
│  Linux: inotify/fanotify (文件监控)                         │
│  Windows: Minifilter (文件过滤驱动)                         │
│  Mac: Endpoint Security                                     │
└─────────────────────────────────────────────────────────────┘
```

### 关键学习点

1. **clamd 守护进程模式**
   - 常驻内存，避免重复加载病毒库
   - 通过 Unix Socket / TCP 接收扫描请求
   - 多线程处理

2. **On-Access Scanning (实时监控)**
   ```c
   // Linux: fanotify
   fanotify_mark(fd, FAN_MARK_ADD | FAN_MARK_MOUNT,
                 FAN_ACCESS | FAN_MODIFY | FAN_OPEN,
                 AT_FDCWD, "/");
   
   // 监控所有文件访问，然后扫描
   ```

3. **权限要求**
   - 需要 **root** 权限才能监控全系统
   - 普通用户只能扫描自己的文件

---

## 2. OSSEC - 开源 HIDS/EDR

### 架构
```
┌─────────────────────────────────────────────────────────────┐
│  OSSEC Server (中央管理)                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  • 日志分析引擎                                      │   │
│  │  • 规则引擎 (XML 规则)                               │   │
│  │  • 告警管理                                          │   │
│  │  • 数据库 (MySQL/PostgreSQL)                         │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ 加密通信 (1514/udp)
┌──────────────────────────▼──────────────────────────────────┐
│  OSSEC Agent (终端代理)                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  • 文件完整性监控 (FIM)                              │   │
│  │  • 日志监控                                          │   │
│  │  • Rootkit 检测                                      │   │
│  │  • 主动响应 (阻断 IP、删除文件)                      │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ 系统调用
┌──────────────────────────▼──────────────────────────────────┐
│  系统层                                                     │
│  • inotify/fanotify (Linux)                                 │
│  • Event Log (Windows)                                      │
│  • Audit Framework                                          │
└─────────────────────────────────────────────────────────────┘
```

### 关键学习点

1. **Agent-Server 架构**
   - Agent 收集数据，Server 分析决策
   - 适合企业级部署

2. **主动响应 (Active Response)**
   ```xml
   <active-response>
     <command>firewall-drop</command>
     <location>local</location>
     <level>6</level>
   </active-response>
   ```
   - 检测到威胁后自动执行脚本
   - 可以阻断 IP、删除文件、停止进程

3. **文件完整性监控 (FIM)**
   - 监控关键系统文件的变化
   - 使用哈希值比对

---

## 3. Wazuh - OSSEC 的分支，现代化 EDR

### 改进点
- 基于 OSSEC，但完全重写
- 支持 Elastic Stack (ELK)
- 更现代化的 API
- 支持 Docker、Kubernetes

### 架构
```
┌─────────────────────────────────────────────────────────────┐
│  Wazuh Indexer (Elasticsearch)                              │
│  Wazuh Dashboard (Kibana)                                   │
│  Wazuh Server (分析引擎)                                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Wazuh Agent                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  • 日志收集器                                        │   │
│  │  • 文件完整性监控                                    │   │
│  │  • 配置评估 (CIS Benchmark)                          │   │
│  │  • 威胁检测 (MITRE ATT&CK)                           │   │
│  │  • 漏洞检测                                          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Windows 驱动级监控技术

### Minifilter (文件监控)
```c
// 注册 Minifilter 驱动
FLT_REGISTRATION filterRegistration = {
    sizeof(FLT_REGISTRATION),
    FLT_REGISTRATION_VERSION,
    0,
    NULL,
    callbacks,
    FilterUnload,
    FilterSetup,
    ...
};

// 拦截文件操作
FLT_PREOP_CALLBACK_STATUS
PreCreateCallback(
    _Inout_ PFLT_CALLBACK_DATA Data,
    _In_ PCFLT_RELATED_OBJECTS FltObjects,
    _Flt_CompletionContext_Outptr_ PVOID *CompletionContext
) {
    // 检查文件路径
    // 如果是敏感文件，阻止访问
    if (IsSensitiveFile(Data)) {
        Data->IoStatus.Status = STATUS_ACCESS_DENIED;
        return FLT_PREOP_COMPLETE;
    }
    return FLT_PREOP_SUCCESS_WITH_CALLBACK;
}
```

### ETW (Event Tracing for Windows)
```c
// 监控进程创建
void EnableProcessMonitor() {
    TRACEHANDLE sessionHandle;
    EVENT_TRACE_PROPERTIES properties = {0};
    
    // 启用 Microsoft-Windows-Kernel-Process 提供程序
    EnableTraceEx2(
        sessionHandle,
        &ProcessProviderGuid,
        EVENT_CONTROL_CODE_ENABLE_PROVIDER,
        TRACE_LEVEL_INFORMATION,
        0, 0, 0, NULL
    );
}

// 回调函数
void ProcessEventCallback(PEVENT_RECORD event) {
    if (event->EventHeader.EventDescriptor.Opcode == 1) {
        // 进程创建事件
        DWORD pid = GetProcessId(event);
        wchar_t* cmdline = GetCommandLine(event);
        
        // 发送到用户层分析
        SendToUserMode(pid, cmdline);
    }
}
```

### WFP (Windows Filtering Platform)
```c
// 监控网络连接
void RegisterWfpFilter() {
    FWPM_FILTER filter = {0};
    filter.layerKey = FWPM_LAYER_ALE_AUTH_CONNECT_V4;
    filter.action.type = FWP_ACTION_CALLOUT_TERMINATING;
    filter.action.calloutKey = MY_CALLOUT_GUID;
    
    // 添加过滤规则
    FwpmFilterAdd(engineHandle, &filter, NULL, &filterId);
}

// 网络连接回调
void NetworkConnectCallback(
    _In_ const FWPS_INCOMING_VALUES* inFixedValues,
    _In_ const FWPS_INCOMING_METADATA_VALUES* inMetaValues,
    _Inout_ void* layerData,
    _In_ const void* classifyContext,
    _In_ const FWPS_FILTER* filter,
    _In_ UINT64 flowContext,
    _Inout_ FWPS_CLASSIFY_OUT* classifyOut
) {
    // 获取目标 IP 和端口
    UINT32 remoteAddr = inFixedValues->incomingValue[
        FWPS_FIELD_ALE_AUTH_CONNECT_V4_IP_REMOTE_ADDRESS].value.uint32;
    UINT16 remotePort = inFixedValues->incomingValue[
        FWPS_FIELD_ALE_AUTH_CONNECT_V4_IP_REMOTE_PORT].value.uint16;
    
    // 判断是否阻断
    if (ShouldBlock(remoteAddr, remotePort)) {
        classifyOut->actionType = FWP_ACTION_BLOCK;
    }
}
```

---

## 5. Linux eBPF 监控

### 监控进程创建
```c
#include <linux/bpf.h>
#include <linux/sched.h>

SEC("tracepoint/sched/sched_process_exec")
int trace_exec(struct trace_event_raw_sched_process_exec *ctx) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    // 获取进程名
    char comm[16];
    bpf_get_current_comm(&comm, sizeof(comm));
    
    // 发送到用户空间
    struct event e = {};
    e.pid = pid;
    __builtin_memcpy(e.comm, comm, sizeof(comm));
    
    bpf_perf_event_output(ctx, &events, BPF_F_CURRENT_CPU, &e, sizeof(e));
    
    return 0;
}
```

### 监控文件操作
```c
SEC("kprobe/vfs_open")
int trace_vfs_open(struct pt_regs *ctx) {
    struct file *file = (struct file *)PT_REGS_PARM1(ctx);
    
    // 获取文件路径
    char path[256];
    bpf_probe_read_str(path, sizeof(path), 
                       file->f_path.dentry->d_name.name);
    
    // 检查是否是敏感文件
    if (is_sensitive(path)) {
        // 记录并告警
    }
    
    return 0;
}
```

---

## 6. 关键学习总结

### 权限要求
| 功能 | Windows | Linux | Mac |
|------|---------|-------|-----|
| 文件监控 | Minifilter (内核驱动) | fanotify/inotify (root) | Endpoint Security |
| 进程监控 | ETW (管理员) | eBPF/Audit (root) | Endpoint Security |
| 网络监控 | WFP (内核驱动) | netfilter/eBPF (root) | NKE |
| 系统调用 | Kernel Driver | eBPF/kprobe (root) | KEXT |

### 架构模式
1. **用户态 Agent** - 收集数据，发送到服务端分析
2. **内核态 Driver** - 监控系统调用，拦截危险操作
3. **混合模式** - 内核收集，用户态决策，内核执行

### AI Guardian 应该采用的架构
```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: 用户界面 (Electron)                               │
│  - 配置管理  - 日志展示  - 告警通知                         │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│  Layer 2: 核心引擎 (Rust)                                   │
│  - 接收内核事件                                            │
│  - AI 分析决策                                             │
│  - 发送阻断指令                                            │
└──────────────────────────┬──────────────────────────────────┘
                           │ FFI / IOCTL
┌──────────────────────────▼──────────────────────────────────┐
│  Layer 1: 内核驱动 (C/C++)                                  │
│  Windows: Minifilter + ETW + WFP                           │
│  Linux: eBPF + Audit                                       │
│  Mac: Endpoint Security + KEXT                             │
└─────────────────────────────────────────────────────────────┘
```

### 核心要点
1. **必须管理员/root 权限** - 否则监控不了系统
2. **必须内核态驱动** - 用户态 Hook 容易被绕过
3. **必须开机自启** - 作为系统服务运行
4. **低延迟** - 不能影响系统性能
5. **AI 决策在用户态** - 内核只做收集和拦截

---

## 参考项目

- **ClamAV**: https://github.com/Cisco-Talos/clamav
- **OSSEC**: https://github.com/ossec/ossec-hids
- **Wazuh**: https://github.com/wazuh/wazuh
- **Sysmon** (Windows): https://docs.microsoft.com/sysmon
- **Auditd** (Linux): https://github.com/linux-audit

---

**下一步：基于这些学习，设计 AI Guardian V2 的具体实现！** 🛡️
