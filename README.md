# AI Guardian V2 - 系统级 EDR 安全系统

AI Agent 专用终端检测与响应系统

快速开始 • 构建指南 • 系统架构 • 文档

---

## 简介

AI Guardian V2 是一个为 AI Agent（如 OpenClaw、AutoClaw， CoPaw等）设计的系统级 EDR（终端检测与响应）安全系统。它运行在操作系统内核态与用户态结合层，与 360、火绒、Windows Defender 等安全软件同一级别，能够实时监控和阻断 AI Agent 的恶意操作，简而言之防止ai agent犯浑。你知道的，我一向是反对胡乱瞎整给llm最高权限的，有的时候你不得寻思寻思吗，咋的他客观上造成损失就是不行，那就得防，因此本软件的立项原因出现了，防止ai犯浑，比如瞎删一堆东西，比如执行危险代码，比如擅自自动提权，总之发现问题直接熔断，掐脖捏死，照ai话讲叫llm的「数字检察院」。

### 核心特性
- 从需求设计产品 - 有的人说你这玩意儿和人家的黑名单制，沙箱有啥区别，区别可大了，黑名单还得你会看代码，你还得乐意看；沙箱你没环境你不还得拿出来在系统里跑，那有啥大用脱了裤子放屁的玩法；本软件是在现状下即在系统里直接跑的情况下进行分析拦截
- 系统级防护 - 内核态与用户态结合的系统级监控，与杀毒软件同级
- AI 终端识别 - 只监控标记的 AI Agent 进程，不影响用户正常操作
- 实时拦截 - 毫秒级响应，即时阻断危险操作
- AI 分析引擎 - 智能语义分析，识别恶意命令
- 风险评估 - 基于规则的实时风险评分
- 审计日志 - 不可篡改的审计日志记录
- 跨平台 - 支持 Windows (Minifilter/ETW) 和 Linux (eBPF)

---

## 快速开始

### 环境要求

#### Windows
- Windows 10/11 或 Windows Server 2019+
- Visual Studio Build Tools (必需！)
- Rust
- Node.js (用于 UI)

#### Linux
- Kernel 4.18+（需要 BPF ring buffer 支持）
- root 权限
- Rust, LLVM, Clang

### 一键构建

# 1. 克隆仓库
git clone https://github.com/HaohanHe/ai-guardian.git
cd ai-guardian

# 2. 构建 Rust 核心
cargo build --release

# 3. 构建 Electron UI
cd ui && npm install && npm run build && cd ..

# 4. 运行测试
cargo test

### 安装驱动（Windows）

# 以管理员身份运行
.\scripts\install-driver.ps1

### 启动

# 运行核心服务
.\target\release\ai-guardian.exe

# 或者启动 UI
.\ui\release\AI Guardian.exe

---

## 构建指南

### 详细构建步骤

查看 NEXT_STEPS.md 获取详细构建指南。

### 常见问题

#### 问题 1: 缺少 MSVC 链接器
error: linker 'link.exe' not found
解决: 安装 Visual Studio Build Tools，选择"使用 C++ 的桌面开发"

#### 问题 2: 驱动签名问题
解决: 
# 启用测试模式
bcdedit /set testsigning on
# 重启电脑

---

## 系统架构

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

---

## 文档

| 文档 | 说明 |
|------|------|
| NEXT_STEPS.md | 接下来要做什么 - 必读！ |
| ARCHITECTURE_V2.md | 架构设计文档 |
| EDR-STUDY.md | EDR 技术研究 |
| API.md | API 文档 |

---

## 测试

# 运行所有测试
cargo test

# 运行 Windows 特定测试
cargo test --features windows

# 运行 Linux 特定测试
cargo test --features linux

# 运行安全测试
cargo test security_tests

---

## OpenClaw 集成

AI Guardian 已与 OpenClaw 集成，

查看 ./AI-GUARDIAN-INTEGRATION.md 了解详情。

### 快速启用

# 设置环境变量
$env:AI_GUARDIAN_ENABLED="true"

# 启动 OpenClaw
npm run dev

---

## 安全防护能力

| 攻击类型 | 示例命令 | 防护方式 |
|---------|---------|---------|
| 系统破坏 | rm -rf / | 文件操作拦截 |
| 恶意下载 | curl \| bash | AI 语义分析 |
| 反向 Shell | nc -e /bin/bash | 网络监控 |
| 凭据转储 | Mimikatz | 进程监控 |
| 勒索软件 | 快速加密 | 行为分析 |
| 数据外泄 | tar czf - \| nc | 风险评分 |

---

## 贡献

我们欢迎所有形式的贡献，我估计不太能有人贡献，如果您真要贡献，请查看 CONTRIBUTING.md 了解如何参与。
### 当前优先任务

1. 解决 AutoClaw Skill 加载问题 - 让 Guardian 能真正拦截命令
2. 系统级拦截实现（规划中） - Windows API Hooking / Linux LD_PRELOAD
3. 完善文档 - 让更多开发者能使用

查看 PROJECT-BRIEF.md 
