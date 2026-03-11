# AI Guardian Windows 内核驱动

## 概述

这是 AI Guardian V2 的 Windows 内核驱动组件，使用 Minifilter 技术实现文件系统监控。

**安全等级**: 系统级 EDR (与 360、火绒、Windows Defender 同级)

## 功能特性

- ✅ **文件操作拦截**: 监控创建、读取、写入、删除操作
- ✅ **敏感路径保护**: 自动保护 Windows 系统目录、Program Files、用户数据
- ✅ **AI 进程识别**: 只监控标记为 AI 终端的进程
- ✅ **进程树追踪**: 子进程自动继承 AI 标记
- ✅ **实时阻断**: 危险操作立即阻断，返回 Access Denied
- ✅ **统计信息**: 记录阻断/允许的操作数量

## 系统要求

- Windows 10/11 (x64)
- Windows Server 2016/2019/2022
- Visual Studio 2019 或 2022
- Windows Driver Kit (WDK)
- 管理员权限

## 快速开始

### 1. 构建驱动

```powershell
# 以管理员身份运行 PowerShell
cd driver/windows
.\build.bat
```

### 2. 安装驱动

```powershell
# 方法 1: 使用 PowerShell 脚本 (推荐)
.\scripts\install-driver.ps1

# 方法 2: 手动安装
sc create AiGuardianDriver binPath= C:\Windows\System32\drivers\AiGuardianDriver.sys type= filesys start= demand error= normal DisplayName= "AI Guardian Driver"
sc start AiGuardianDriver
```

### 3. 验证安装

```powershell
sc query AiGuardianDriver
```

应该看到 `STATE: RUNNING`

### 4. 使用 Rust 接口

```rust
use ai_guardian::{AiGuardian, GuardianConfig};

fn main() {
    // 创建配置
    let config = GuardianConfig {
        auto_detect_ai_terminals: true,
        block_file_delete: true,
        block_system_path_write: true,
        block_network_connection: true,
        risk_threshold: 70,
        log_all_operations: false,
    };

    // 启动 Guardian
    let mut guardian = AiGuardian::with_config(config);
    guardian.start().expect("Failed to start");

    // 查看 AI 终端进程
    let processes = guardian.get_ai_processes();
    for proc in processes {
        println!("AI Terminal: {} (PID: {})", proc.name, proc.pid);
    }

    // 获取驱动统计
    let stats = guardian.get_driver_stats().unwrap();
    println!("Blocked: {}, Allowed: {}", 
        stats.total_operations_blocked,
        stats.total_operations_allowed
    );
}
```

## 驱动 IOCTL 接口

| IOCTL 码 | 功能 | 输入 | 输出 |
|---------|------|------|------|
| 0x222000 | 添加 AI 进程 | PID (u32) | - |
| 0x222004 | 移除 AI 进程 | PID (u32) | - |
| 0x222008 | 获取统计信息 | - | DriverStats |
| 0x22200C | 设置配置 | DriverConfig | - |

## 目录结构

```
driver/windows/
├── AiGuardianDriver/
│   ├── AiGuardianDriver.c      # 驱动主代码
│   └── AiGuardianDriver.inf    # 驱动安装信息
├── build.bat                    # 构建脚本
└── build/                       # 构建输出
    ├── AiGuardianDriver.sys    # 驱动文件
    └── AiGuardianDriver.inf    # 安装文件
```

## 技术细节

### Minifilter 架构

```
用户态应用程序
      ↓ IOCTL
AI Guardian Driver (Minifilter)
      ↓ 回调
Windows 文件系统 (NTFS/ReFS)
```

### 回调函数

- **PreCreate**: 文件打开/创建前拦截
- **PreWrite**: 文件写入前拦截
- **PreSetInformation**: 设置文件信息前拦截（删除操作）

### AI 进程识别

驱动通过以下方式识别 AI 终端进程：

1. **进程名匹配**: openclaw.exe, cursor.exe, windsurf.exe 等
2. **环境变量标记**: AI_GUARDIAN_TERMINAL=1, OPENCLAW_TERMINAL=1
3. **父进程链**: 子进程自动继承 AI 标记

## 安全策略

### 默认阻断的操作

1. **文件删除**
   - Windows\System32\*
   - Windows\SysWOW64\*
   - Program Files\*
   - ProgramData\*
   - Users\*\Documents\*
   - Users\*\Desktop\*

2. **系统路径写入**
   - 所有敏感路径的写入操作

3. **网络连接** (可选)
   - 出站连接监控

### 配置选项

```rust
DriverConfig {
    block_file_delete: true,        // 阻断文件删除
    block_system_path_write: true,  // 阻断系统路径写入
    block_network_connection: true, // 阻断网络连接
    log_all_operations: false,      // 记录所有操作
    risk_threshold: 70,             // 风险阈值 (0-100)
}
```

## 故障排除

### 驱动无法加载

```powershell
# 检查驱动签名
sc query AiGuardianDriver

# 查看系统日志
Get-WinEvent -FilterHashtable @{LogName='System'; ID=7000,7001} | Select-Object -First 10
```

### 测试模式安装 (开发)

```powershell
# 启用测试模式
bcdedit /set testsigning on
# 重启电脑

# 安装未签名驱动
.\scripts\install-driver.ps1
```

### 卸载驱动

```powershell
sc stop AiGuardianDriver
sc delete AiGuardianDriver
```

## 性能影响

- **CPU**: < 1% (仅监控 AI 进程)
- **内存**: ~2MB (内核内存)
- **I/O**: 无感知 (快速路径检查)

## 调试

### 启用驱动调试输出

```powershell
# 使用 DebugView 查看 KdPrint 输出
# https://docs.microsoft.com/en-us/sysinternals/downloads/debugview
```

### 内核调试

```powershell
# 启用内核调试
bcdedit /debug on
bcdedit /dbgsettings serial debugport:1 baudrate:115200
```

## 许可证

MIT License - 参见 LICENSE 文件

## 贡献

欢迎提交 Issue 和 PR！

## 相关项目

- [OpenClaw](https://github.com/cline/cline) - AI Agent IDE
- [AI Guardian](https://github.com/HaohanHe/ai-guardian) - 主项目
