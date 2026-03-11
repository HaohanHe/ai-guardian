# AI Guardian V2 架构设计

> **AI 专用 EDR - 系统级终端检测与响应**

## 核心理念转变

### ❌ 旧思路（错误）
- MCP/Skill 上层拦截
- 只能拦 MCP 请求
- AI 可以直接绕过

### ✅ 新思路（正确）
- **系统级 EDR**
- 和 360、火绒、Defender 同一级别
- 监控所有系统调用
- **管理员/root 权限**

## 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: 用户界面 (TypeScript/Electron)                     │
│  - 配置管理                                                  │
│  - 日志展示                                                  │
│  - 告警通知                                                  │
│  - 策略设置                                                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│  Layer 2: 核心引擎 (Rust)                                    │
│  - 进程监控 (Process Monitor)                                │
│  - 文件监控 (File Monitor)                                   │
│  - 网络监控 (Network Monitor)                                │
│  - AI 决策引擎                                               │
│  - 实时响应 (阻断/放行)                                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ FFI / IPC
┌──────────────────────────▼──────────────────────────────────┐
│  Layer 1: 系统驱动 (C/C++/eBPF)                              │
│  Windows: ETW + Minifilter + API Hooking                     │
│  Linux: eBPF + Audit + LD_PRELOAD                            │
│  Mac: Endpoint Security + KEXT                               │
└─────────────────────────────────────────────────────────────┘
```

## 技术选型

### Windows
- **ETW** (Event Tracing for Windows) - 进程/线程监控
- **Minifilter** - 文件系统过滤
- **WFP** (Windows Filtering Platform) - 网络过滤
- **Detours** / **EasyHook** - API Hooking

### Linux
- **eBPF** - 内核级监控
- **Audit** - 系统调用审计
- **LD_PRELOAD** - 用户态 Hook
- **Seccomp** - 系统调用过滤

### Mac
- **Endpoint Security** - 系统事件监控
- **KEXT** / **System Extension** - 内核扩展

## 核心功能

### 1. 进程监控
```rust
// 监控所有进程创建
fn on_process_create(pid: u32, path: &str, cmdline: &str) {
    // AI 分析
    let risk = ai_analyze(cmdline);
    
    if risk.score > 70 {
        // 阻断进程
        terminate_process(pid);
        
        // 通知用户
        notify_user(risk);
    }
}
```

### 2. 文件监控
```rust
// 监控敏感文件操作
fn on_file_access(pid: u32, path: &str, operation: FileOp) {
    if is_sensitive_path(path) {
        let risk = ai_analyze_file_op(path, operation);
        
        if risk.score > 70 {
            block_file_op();
        }
    }
}
```

### 3. 网络监控
```rust
// 监控网络连接
fn on_network_connect(pid: u32, dest_ip: &str, port: u16) {
    if is_suspicious_connection(dest_ip, port) {
        let risk = ai_analyze_network(dest_ip, port);
        
        if risk.score > 70 {
            block_connection();
        }
    }
}
```

## AI 决策引擎

### 本地推理
- **Llama.cpp** / **llama-rs** - 本地 LLM
- 无需联网，保护隐私
- 低延迟 (< 100ms)

### 决策流程
```
系统事件 → 特征提取 → AI 推理 → 风险评估 → 响应动作
              ↓
         行为模式库
         威胁情报
         用户白名单
```

## 部署方式

### 开发模式
```bash
# 以管理员权限运行
sudo ai-guardian --dev
```

### 生产模式
```bash
# 安装为系统服务
sudo ai-guardian install

# 开机自启
sudo systemctl enable ai-guardian
```

## 性能目标

| 指标 | 目标 |
|------|------|
| 进程监控延迟 | < 1ms |
| 文件监控延迟 | < 0.1ms |
| AI 推理延迟 | < 100ms |
| CPU 占用 | < 5% |
| 内存占用 | < 500MB |

## 安全目标

- **零误报** - 正常操作不受影响
- **零绕过** - AI 无法绕过监控
- **零延迟** - 用户无感知

## 下一步

1. **Rust 核心引擎** - 跨平台、高性能
2. **Windows ETW 原型** - 进程监控
3. **AI 决策引擎** - 本地 LLM
4. **Electron UI** - 配置界面

---

**这才是真正的 AI 专用 EDR！** 🛡️
