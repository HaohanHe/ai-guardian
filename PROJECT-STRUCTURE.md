# AI Guardian V2 项目结构

## 项目概述

AI Guardian V2 是一个系统级 EDR（终端检测与响应）系统，专门用于保护 AI Agent（如 OpenClaw、Cursor、Windsurf 等）不被恶意命令攻击。

**安全等级**: 内核级 (与 360、火绒、Windows Defender 同级)

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      用户态 (User Mode)                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   CLI 工具    │  │ Electron UI  │  │   MCP Server  │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │               │
│  ┌──────▼─────────────────▼─────────────────▼───────┐       │
│  │              Rust 核心引擎 (ai_guardian)           │       │
│  │  ┌─────────────────────────────────────────────┐  │       │
│  │  │  策略引擎 │ 风险评估 │ 行为分析 │ 日志记录    │  │       │
│  │  └─────────────────────────────────────────────┘  │       │
│  └──────┬────────────────────────────────────────────┘       │
│         │ IOCTL / DeviceIoControl                           │
├─────────┼───────────────────────────────────────────────────┤
│         ▼ 内核态 (Kernel Mode)                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         AI Guardian Driver (Minifilter)             │    │
│  │  ┌─────────────────────────────────────────────┐   │    │
│  │  │  PreCreate │ PreWrite │ PreSetInformation   │   │    │
│  │  └─────────────────────────────────────────────┘   │    │
│  │  ┌─────────────────────────────────────────────┐   │    │
│  │  │  AI 进程哈希表 │ 敏感路径列表 │ 配置数据    │   │    │
│  │  └─────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Windows 文件系统 (NTFS)                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 目录结构

```
ai-guardian/
├── Cargo.toml                    # Rust 项目配置
├── Cargo.lock                    # 依赖锁定
├── README.md                     # 项目主文档
├── README-WINDOWS-DRIVER.md      # Windows 驱动文档
├── PROJECT-STRUCTURE.md          # 本文件
├── LICENSE                       # 许可证
│
├── src/                          # Rust 源代码
│   ├── lib.rs                    # 库入口，AiGuardian 主控制器
│   ├── main.rs                   # 可执行文件入口
│   │
│   ├── core/                     # 核心模块
│   │   ├── mod.rs
│   │   ├── config.rs             # 配置管理
│   │   ├── policy.rs             # 策略引擎
│   │   └── risk.rs               # 风险评估
│   │
│   ├── driver/                   # 驱动接口模块
│   │   ├── mod.rs
│   │   ├── windows/              # Windows 驱动接口
│   │   │   └── mod.rs            # WindowsDriver, DriverConfig, DriverStats
│   │   └── linux/                # Linux 驱动接口 (TODO)
│   │       └── mod.rs
│   │
│   └── monitor/                  # 监控模块
│       ├── mod.rs
│       ├── windows/              # Windows 监控
│       │   ├── mod.rs            # WindowsMonitor
│       │   └── etw.rs            # ETW 进程监控
│       └── linux/                # Linux 监控 (TODO)
│           └── mod.rs
│
├── driver/                       # 内核驱动代码
│   └── windows/                  # Windows 驱动
│       ├── build.bat             # 构建脚本
│       ├── AiGuardianDriver/
│       │   ├── AiGuardianDriver.c    # 驱动主代码 (Minifilter)
│       │   └── AiGuardianDriver.inf  # 驱动安装信息
│       └── build/                # 构建输出
│           ├── AiGuardianDriver.sys
│           └── AiGuardianDriver.inf
│
├── scripts/                      # 实用脚本
│   └── install-driver.ps1        # 驱动安装脚本
│
├── examples/                     # 示例代码
│   └── cli.rs                    # CLI 示例
│
├── docs/                         # 文档
│   ├── ARCHITECTURE_V2.md        # V2 架构设计
│   └── EDR-STUDY.md              # EDR 技术研究
│
├── research/                     # 研究成果
│   └── terminal-marking-analysis.md  # 终端标记分析
│
└── tests/                        # 测试代码
    └── integration_tests.rs
```

## 核心组件

### 1. AiGuardian (src/lib.rs)

主控制器，提供统一的 API：

```rust
pub struct AiGuardian {
    monitor: Option<WindowsMonitor>,  // 平台特定
    config: GuardianConfig,
    running: Arc<Mutex<bool>>,
}
```

**主要方法**:
- `start()` - 启动监控
- `stop()` - 停止监控
- `get_ai_processes()` - 获取 AI 终端进程列表
- `add_ai_process()` - 手动添加 AI 进程
- `get_driver_stats()` - 获取驱动统计

### 2. WindowsDriver (src/driver/windows/mod.rs)

Windows 内核驱动接口：

```rust
pub struct WindowsDriver {
    device_handle: HANDLE,
}
```

**IOCTL 接口**:
- `IOCTL_AI_GUARDIAN_ADD_PROCESS` (0x222000) - 添加 AI 进程
- `IOCTL_AI_GUARDIAN_REMOVE_PROCESS` (0x222004) - 移除 AI 进程
- `IOCTL_AI_GUARDIAN_GET_STATS` (0x222008) - 获取统计
- `IOCTL_AI_GUARDIAN_SET_CONFIG` (0x22200C) - 设置配置

### 3. WindowsMonitor (src/monitor/windows/mod.rs)

Windows 监控管理器，整合 ETW 和驱动：

```rust
pub struct WindowsMonitor {
    process_monitor: EtwProcessMonitor,
    driver: Option<WindowsDriver>,
    auto_sync: bool,
}
```

### 4. EtwProcessMonitor (src/monitor/windows/etw.rs)

ETW 进程监控，自动识别 AI 终端：

```rust
pub struct EtwProcessMonitor {
    ai_processes: Arc<Mutex<HashMap<u32, ProcessInfo>>>,
    running: Arc<Mutex<bool>>,
}
```

**AI 识别方式**:
1. 进程名匹配: openclaw.exe, cursor.exe, windsurf.exe
2. 环境变量标记: AI_GUARDIAN_TERMINAL=1
3. 父进程链追踪

### 5. 内核驱动 (driver/windows/AiGuardianDriver.c)

Minifilter 驱动，701 行 C 代码：

**主要功能**:
- AI 进程哈希表管理 (256 桶)
- PreCreate 回调 - 拦截文件打开/创建
- PreWrite 回调 - 拦截文件写入
- PreSetInformation 回调 - 拦截删除操作

**敏感路径**:
- \\Windows\\System32
- \\Windows\\SysWOW64
- \\Program Files
- \\ProgramData
- \\Users\\*

## 数据流

### 1. AI 进程检测流程

```
AI Agent 启动 (如 OpenClaw)
    ↓
node-pty 创建终端进程 (带环境变量标记)
    ↓
EtwProcessMonitor 检测到新进程
    ↓
检查进程名/环境变量/父进程链
    ↓
识别为 AI 终端进程
    ↓
通过 IOCTL 通知内核驱动
    ↓
驱动将 PID 加入监控列表
```

### 2. 文件操作拦截流程

```
AI 终端进程执行文件操作
    ↓
Windows 内核调用 Minifilter 回调
    ↓
驱动检查 PID 是否在 AI 列表中
    ↓
检查操作类型和路径
    ↓
如果是危险操作 → 返回 STATUS_ACCESS_DENIED
    ↓
应用程序收到 "Access Denied" 错误
```

## 构建流程

### Windows 驱动构建

```powershell
cd driver/windows
.\build.bat
```

**输出**:
- `build/AiGuardianDriver.sys` - 驱动文件
- `build/AiGuardianDriver.inf` - 安装信息

### Rust 项目构建

```bash
# 调试构建
cargo build

# 发布构建
cargo build --release

# 运行示例
cargo run --example cli -- start
```

## 安装流程

### 1. 安装驱动

```powershell
# 方法 1: 使用脚本
.\scripts\install-driver.ps1

# 方法 2: 手动
sc create AiGuardianDriver binPath= C:\Windows\System32\drivers\AiGuardianDriver.sys type= filesys
sc start AiGuardianDriver
```

### 2. 验证安装

```powershell
sc query AiGuardianDriver
# 应该显示 STATE: RUNNING
```

### 3. 运行用户态程序

```bash
cargo run --example cli -- monitor
```

## 配置选项

### GuardianConfig

```rust
pub struct GuardianConfig {
    pub auto_detect_ai_terminals: bool,    // 自动识别 AI 终端
    pub block_file_delete: bool,           // 阻断文件删除
    pub block_system_path_write: bool,     // 阻断系统路径写入
    pub block_network_connection: bool,    // 阻断网络连接
    pub risk_threshold: u32,               // 风险阈值 (0-100)
    pub log_all_operations: bool,          // 记录所有操作
}
```

## 测试

### 单元测试

```bash
cargo test
```

### 集成测试

```bash
# 1. 安装驱动
.\scripts\install-driver.ps1

# 2. 启动监控
cargo run --example cli -- start

# 3. 启动 OpenClaw 并执行测试命令
# 4. 验证阻断是否生效
```

## 性能指标

- **CPU 占用**: < 1% (仅监控 AI 进程)
- **内存占用**: ~2MB (内核) + ~10MB (用户态)
- **I/O 延迟**: 无感知 (快速路径检查)
- **进程检测延迟**: < 500ms

## 安全特性

1. **内核级拦截**: 无法被用户态绕过
2. **最小权限**: 仅监控 AI 终端，不影响普通程序
3. **进程树追踪**: 子进程自动继承保护
4. **实时阻断**: 危险操作立即阻止
5. **审计日志**: 所有拦截操作记录

## 待实现功能

- [ ] Linux eBPF 驱动
- [ ] Electron 管理界面
- [ ] WFP 网络过滤
- [ ] 机器学习风险评分
- [ ] 云端策略同步

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交代码
4. 创建 Pull Request

## 许可证

MIT License
