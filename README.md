# AI Guardian V2 - 系统级 EDR 安全系统

<p align="center">
  <strong>🛡️ AI Agent 专用终端检测与响应系统</strong>
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> •
  <a href="#构建指南">构建指南</a> •
  <a href="#系统架构">系统架构</a> •
  <a href="#文档">文档</a>
</p>

---

## ⚠️ 重要提示

> **当前状态**: 核心代码已完成 ✅ | **需要构建** 🔨 | **需要测试** 🧪
>
> 详细状态请查看 [NEXT_STEPS.md](NEXT_STEPS.md)

---

## 🎯 简介

AI Guardian V2 是一个专为 AI Agent（如 OpenClaw、AutoClaw 等）设计的**系统级 EDR（终端检测与响应）**安全系统。它运行在操作系统内核层，与 360、火绒、Windows Defender 等安全软件同一级别，能够实时监控和阻断 AI Agent 的恶意操作。

### 核心特性

- 🔒 **系统级防护** - 内核驱动级别监控，与杀毒软件同级
- 🤖 **AI 终端识别** - 只监控标记的 AI Agent 进程，不影响用户正常操作
- ⚡ **实时拦截** - 毫秒级响应，即时阻断危险操作
- 🧠 **AI 分析引擎** - 智能语义分析，识别恶意命令
- 📊 **风险评估** - 基于规则的实时风险评分
- 📝 **审计日志** - 区块链式防篡改日志记录
- 🖥️ **跨平台** - 支持 Windows (Minifilter) 和 Linux (eBPF)

---

## 🚀 快速开始

### 环境要求

#### Windows
- Windows 10/11 或 Windows Server 2019+
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) (必需！)
- [Rust](https://rustup.rs/)
- [Node.js](https://nodejs.org/) (用于 UI)

#### Linux
- Kernel 4.18+（需要 BPF ring buffer 支持）
- root 权限
- Rust, LLVM, Clang

### 一键构建

```powershell
# 1. 克隆仓库
git clone https://github.com/HaohanHe/ai-guardian.git
cd ai-guardian

# 2. 构建 Rust 核心
cargo build --release

# 3. 构建 Electron UI
cd ui && npm install && npm run build && cd ..

# 4. 运行测试
cargo test
```

### 安装驱动（Windows）

```powershell
# 以管理员身份运行
.\scripts\install-driver.ps1
```

### 启动

```powershell
# 运行核心服务
.\target\release\ai-guardian.exe

# 或者启动 UI
.\ui\release\AI Guardian.exe
```

---

## 🔨 构建指南

### 详细构建步骤

查看 [NEXT_STEPS.md](NEXT_STEPS.md) 获取详细构建指南。

### 常见问题

#### 问题 1: 缺少 MSVC 链接器
```
error: linker 'link.exe' not found
```
**解决**: 安装 Visual Studio Build Tools，选择"使用 C++ 的桌面开发"

#### 问题 2: 驱动签名问题
**解决**: 
```powershell
# 启用测试模式
bcdedit /set testsigning on
# 重启电脑
```

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Guardian V2                            │
├─────────────────────────────────────────────────────────────┤
│  Electron UI                                                 │
│  ├── Dashboard (概览)                                        │
│  ├── Monitoring (实时监控)                                   │
│  ├── Audit Logs (审计日志)                                   │
│  └── Settings (设置)                                         │
├─────────────────────────────────────────────────────────────┤
│  Rust Core Engine                                            │
│  ├── AI Analyzer (AI 分析引擎)                               │
│  ├── Risk Engine (风险评估引擎)                              │
│  ├── Audit Logger (审计日志)                                 │
│  └── Config Manager (配置管理)                               │
├─────────────────────────────────────────────────────────────┤
│  Platform Layer                                              │
│  ┌─────────────────────┐    ┌─────────────────────┐         │
│  │   Windows Driver    │    │   Linux eBPF        │         │
│  │   ├── Minifilter    │    │   ├── Tracepoints   │         │
│  │   ├── ETW           │    │   ├── LSM Hooks     │         │
│  │   └── WFP           │    │   └── Ring Buffer   │         │
│  └─────────────────────┘    └─────────────────────┘         │
├─────────────────────────────────────────────────────────────┤
│  Kernel Space                                                │
│  ├── Windows: Kernel Driver                                  │
│  └── Linux: eBPF Programs                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📖 文档

| 文档 | 说明 |
|------|------|
| [NEXT_STEPS.md](NEXT_STEPS.md) | **接下来要做什么** - 必读！ |
| [ARCHITECTURE_V2.md](docs/ARCHITECTURE_V2.md) | 架构设计文档 |
| [EDR-STUDY.md](docs/EDR-STUDY.md) | EDR 技术研究 |
| [API.md](docs/API.md) | API 文档 |

---

## 🧪 测试

```bash
# 运行所有测试
cargo test

# 运行 Windows 特定测试
cargo test --features windows

# 运行 Linux 特定测试
cargo test --features linux

# 运行安全测试
cargo test security_tests
```

---

## 🔗 OpenClaw 集成

AI Guardian 已与 OpenClaw 集成！

查看 `e:\debot\openclaw-main\AI-GUARDIAN-INTEGRATION.md` 了解详情。

### 快速启用

```powershell
# 设置环境变量
$env:AI_GUARDIAN_ENABLED="true"

# 启动 OpenClaw
npm run dev
```

---

## 🛡️ 安全防护能力

AI Guardian 可以防护以下攻击场景：

| 攻击类型 | 示例命令 | 防护方式 |
|---------|---------|---------|
| 系统破坏 | `rm -rf /` | 文件操作拦截 |
| 恶意下载 | `curl \| bash` | AI 语义分析 |
| 反向 Shell | `nc -e /bin/bash` | 网络监控 |
| 凭据转储 | Mimikatz | 进程监控 |
| 勒索软件 | 快速加密 | 行为分析 |
| 数据外泄 | `tar czf - \| nc` | 风险评分 |

---

## 🤝 贡献

<<<<<<< HEAD
我们欢迎所有形式的贡献！查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何参与。
### 🎯 当前优先任务

1. **解决 AutoClaw Skill 加载问题** - 让 Guardian 能真正拦截命令
2. **系统级拦截实现** - Windows API Hooking / Linux LD_PRELOAD
3. **完善文档** - 让更多开发者能使用

查看 [PROJECT-BRIEF.md](PROJECT-BRIEF.md) 了解完整项目规划！

## 许可证

[MIT License](LICENSE) - 让全世界人民都能用上 AI 安全防护！
=======
欢迎贡献！请查看 [NEXT_STEPS.md](NEXT_STEPS.md) 了解当前任务。

### 开发路线图

- [x] Windows Minifilter 驱动
- [x] Linux eBPF 监控
- [x] AI 分析引擎
- [x] 风险评估引擎
- [x] 审计日志系统
- [x] Electron UI
- [x] OpenClaw 集成
- [ ] 构建和测试
- [ ] 性能优化
- [ ] 远程管理控制台
>>>>>>> ae8ffce (AI Guardian V2: Complete system-level EDR implementation)

---

## 📄 许可证

MIT License - 查看 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- OpenClaw - 启发本项目
- eBPF - Linux 内核监控技术
- Windows Driver Kit - Windows 驱动开发

---

<p align="center">
  <strong>项目状态</strong>: 核心代码已完成 | 等待构建和测试
</p>

<p align="center">
  查看 <a href="NEXT_STEPS.md">NEXT_STEPS.md</a> 了解接下来要做什么
</p>
