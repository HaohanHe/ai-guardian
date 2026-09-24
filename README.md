# AI Guardian

[中文](#中文) ｜ [日本語](#日本語) ｜ [English](#english)

## 中文

AI Guardian 是一个给 AI Agent 用的终端防护工具。简单说就是：跑在系统里的 Agent 可能会瞎删文件、执行危险命令、偷偷提权，这个工具负责盯着它，发现不对就掐断。

Windows 端的文件系统过滤驱动已经写好了（Minifilter，701 行 C），能识别标记过的 AI Agent 进程并拦截敏感路径上的删除/写入操作。Linux 端的 eBPF 骨架在仓库里，但还没有实际实现。

### 这是什么

这不是黑名单也不是沙箱。黑名单得你自己读代码知道该拦什么；沙箱要求你把 Agent 放进隔离环境跑。AI Guardian 的思路是：Agent 本来就在你系统里跑着，那就在它旁边加一层监控，区分哪些进程是 AI 终端，只盯这些进程的行为。

目前 Windows 路径是可用的：Minifilter 驱动加载后，通过 IOCTL 告诉驱动哪些 PID 是 AI 终端，驱动在文件系统回调里检查这些进程碰敏感路径的操作，该拦就返回 `STATUS_ACCESS_DENIED`。

### 核心功能

- Windows Minifilter 文件系统过滤：PreCreate / PreWrite / PreSetInformation 回调，AI 进程哈希表（256 桶，最多 1024 个 PID），敏感路径检测（System32、Program Files、用户数据目录），直接在内核态阻断删除操作
- ETW 进程监控：用 ToolHelp32 扫描进程列表，自动识别 AI 终端（按进程名/路径匹配），把 PID 注册给驱动
- TS 分析模块：prompt injection 检测、混淆命令检测、MCP injection 检测、skill 供应链检查、风险评分。这些跑在用户态，对命令行输出做语义分析
- Rust 核心引擎：主控制器、审计日志、风险引擎、配置管理，axum 跑 Web API
- MCP server：可以作为 MCP 工具接入 OpenClaw 等 Agent 框架

### 目录结构

```
ai-guardian/
├── driver/windows/AiGuardianDriver.c   # Windows Minifilter 驱动（C，701 行）
├── driver/linux/ai_guardian.bpf.c       # Linux eBPF（骨架，未实现）
├── src/
│   ├── core/                           # Rust 核心：guardian、risk_engine、audit_logger
│   ├── driver/windows/mod.rs           # 驱动 IOCTL 封装
│   ├── monitor/windows/etw.rs          # ETW 进程监控
│   ├── analysis/                       # TS 分析模块（prompt-injection 等）
│   ├── web/                            # axum Web API
│   ├── mcp/                            # MCP server
│   └── cli.ts                          # CLI 入口
├── ui/                                 # Electron + Vite + Tailwind 前端
├── config/default.yaml                 # 默认配置
└── scripts/install-driver.ps1          # Windows 驱动安装脚本
```

### 构建和运行

**Windows（可用路径）：**

```powershell
# 需要 Visual Studio Build Tools（C++ 桌面开发）和 Rust
cargo build --release

# 安装驱动（管理员 PowerShell）
.\scripts\install-driver.ps1

# 运行核心
.\target\release\ai-guardian.exe
```

如果驱动签名有问题，测试模式下跑：

```powershell
bcdedit /set testsigning on
# 重启
```

**Linux：** eBPF 部分只有骨架，需要 Kernel 4.18+ 和 root，但当前不能实际拦截。

**TS 侧：**

```bash
npm install
npm run dev      # 开发模式
npm run build    # 编译 TS
```

Node.js >= 18。

### 状态说明

| 组件 | 状态 |
|------|------|
| Windows Minifilter 驱动 | 已实现 |
| ETW 进程识别 | 已实现 |
| Rust 核心 + Web API | 已实现 |
| TS 分析模块 | 已实现 |
| Linux eBPF | 骨架预留，未实现 |
| Electron UI | 目录在，未完成 |

### 许可证

MIT License，详见 [LICENSE](LICENSE)。

---

## 日本語

AI Guardian は AI エージェント向けのエンドポイント保護ツールです。要するに、システム上で動いているエージェントがファイルを消したり危険なコマンドを実行したりするのを監視して、おかしいと思ったら遮断します。

Windows 向けのファイルシステムフィルタドライバは実装済みです（Minifilter、C で 701 行）。登録された AI エージェントのプロセスを識別して、センシティブなパスへの削除・書き込み操作をブロックします。Linux 向けの eBPF は骨組みだけ置いてあり、まだ実装されていません。

### これは何か

ブラックリストでもサンドボックスでもありません。ブラックリストは何をブロックすべきか自分でコードを読んで知っておく必要があります。サンドボックスはエージェントを隔離環境に入れて動かす必要があります。AI Guardian の考え方はこうです：エージェントはもともと自分のシステムで動いているのだから、その横に監視レイヤーを置いて、どのプロセスが AI 端末かを区別し、そのプロセスの挙動だけを監視します。

現在使えるのは Windows 側です。Minifilter ドライバをロードしたあと、IOCTL 経由でどの PID が AI 端末かをドライバに教えます。ドライバはファイルシステムのコールバックでそれらのプロセスがセンシティブパスに触る操作をチェックし、必要なら `STATUS_ACCESS_DENIED` を返して遮断します。

### 機能

- Windows Minifilter フィルタリング：PreCreate / PreWrite / PreSetInformation コールバック、AI プロセスのハッシュテーブル（256 バケット、最大 1024 PID）、センシティブパスの判定（System32、Program Files、ユーザーデータ）、カーネルモードでの削除操作のブロック
- ETW プロセス監視：ToolHelp32 API でプロセス一覧をスキャンし、プロセス名・パスから AI 端末を自動識別してドライバに PID を登録
- TypeScript 分析モジュール：プロンプトインジェクション検出、難読化コマンド検出、MCP インジェクション検出、スキルサプライチェーンチェック、リスクスコアリング。ユーザーモードでコマンド出力を解析します
- Rust コアエンジン：メインコントローラー、監査ログ、リスクエンジン、設定管理。axum で Web API を提供
- MCP サーバー：OpenClaw などのエージェントフレームワークに MCP ツールとして組み込めます

### ディレクトリ構成

```
ai-guardian/
├── driver/windows/AiGuardianDriver.c   # Windows Minifilter ドライバ（C、701 行）
├── driver/linux/ai_guardian.bpf.c       # Linux eBPF（骨組みのみ、未実装）
├── src/
│   ├── core/                           # Rust コア：guardian、risk_engine、audit_logger
│   ├── driver/windows/mod.rs           # ドライバ IOCTL ラッパー
│   ├── monitor/windows/etw.rs          # ETW プロセス監視
│   ├── analysis/                       # TS 分析モジュール（prompt-injection など）
│   ├── web/                            # axum Web API
│   ├── mcp/                            # MCP サーバー
│   └── cli.ts                          # CLI エントリー
├── ui/                                 # Electron + Vite + Tailwind フロントエンド
├── config/default.yaml                 # デフォルト設定
└── scripts/install-driver.ps1          # Windows ドライバインストールスクリプト
```

### ビルドと実行

**Windows（動く経路）：**

```powershell
# Visual Studio Build Tools（C++ デスクトップ開発）と Rust が必要
cargo build --release

# ドライバのインストール（管理者 PowerShell）
.\scripts\install-driver.ps1

# コアの実行
.\target\release\ai-guardian.exe
```

ドライバ署名の問題が出たらテストモードで起動します：

```powershell
bcdedit /set testsigning on
# 再起動
```

**Linux：** eBPF 部分は骨組みだけで、カーネル 4.18 以上と root 権限が必要ですが、現状では実際の遮断はできません。

**TypeScript 側：**

```bash
npm install
npm run dev      # 開発モード
npm run build    # TS コンパイル
```

Node.js 18 以上が必要です。

### 実装状況

| コンポーネント | 状態 |
|------|------|
| Windows Minifilter ドライバ | 実装済み |
| ETW プロセス識別 | 実装済み |
| Rust コア + Web API | 実装済み |
| TS 分析モジュール | 実装済み |
| Linux eBPF | 骨組みのみ、未実装 |
| Electron UI | ディレクトリはあるが未完成 |

### ライセンス

MIT License。詳細は [LICENSE](LICENSE) を参照してください。

---

## English

AI Guardian is an endpoint protection tool built for AI agents. The problem it tries to solve is straightforward: when an agent runs inside your actual system, it may delete files it should not, run dangerous commands, or escalate privileges on its own. This tool watches the agent's behavior and cuts it off when something goes wrong.

The Windows file system filter driver is done (Minifilter, 701 lines of C). It can identify registered AI agent processes and block delete or write operations on sensitive paths. The Linux eBPF skeleton exists in the repo but is not implemented yet.

### What this is

This is not a blocklist and not a sandbox. A blocklist requires you to read code yourself and know what to stop. A sandbox requires you to run the agent inside an isolated environment. AI Guardian takes a different approach: the agent is already running in your system, so it puts a monitoring layer next to it. It figures out which processes are AI terminals and only watches those.

The working path today is Windows. After the Minifilter driver loads, you tell it which PIDs are AI terminals through IOCTL calls. The driver hooks file system callbacks and checks whether those processes touch sensitive paths, returning `STATUS_ACCESS_DENIED` when a block is needed.

### Features

- Windows Minifilter filtering: PreCreate, PreWrite, and PreSetInformation callbacks, an AI process hash table (256 buckets, up to 1024 PIDs), sensitive path detection (System32, Program Files, user data directories), and direct kernel-mode blocking of delete operations
- ETW process monitoring: scans the process list via ToolHelp32, identifies AI terminals by process name and path, then registers their PIDs with the driver
- TypeScript analysis modules: prompt injection detection, obfuscation detection, MCP injection detection, skill supply chain checks, and risk scoring. These run in user space and analyze command output
- Rust core engine: main controller, audit logger, risk engine, and config management, with axum serving a Web API
- MCP server: can be plugged into agent frameworks like OpenClaw as an MCP tool

### Project structure

```
ai-guardian/
├── driver/windows/AiGuardianDriver.c   # Windows Minifilter driver (C, 701 lines)
├── driver/linux/ai_guardian.bpf.c       # Linux eBPF (skeleton only, not implemented)
├── src/
│   ├── core/                           # Rust core: guardian, risk_engine, audit_logger
│   ├── driver/windows/mod.rs           # Driver IOCTL wrapper
│   ├── monitor/windows/etw.rs          # ETW process monitor
│   ├── analysis/                       # TS analysis modules (prompt-injection, etc.)
│   ├── web/                            # axum Web API
│   ├── mcp/                            # MCP server
│   └── cli.ts                          # CLI entry point
├── ui/                                 # Electron + Vite + Tailwind frontend
├── config/default.yaml                 # Default configuration
└── scripts/install-driver.ps1          # Windows driver install script
```

### Build and run

**Windows (working path):**

```powershell
# Requires Visual Studio Build Tools (C++ desktop development) and Rust
cargo build --release

# Install the driver (admin PowerShell)
.\scripts\install-driver.ps1

# Run the core service
.\target\release\ai-guardian.exe
```

If you hit driver signing issues, enable test signing:

```powershell
bcdedit /set testsigning on
# Reboot
```

**Linux:** The eBPF side is a skeleton. It needs Kernel 4.18+ and root, but it does not actually block anything yet.

**TypeScript side:**

```bash
npm install
npm run dev      # Development mode
npm run build    # Compile TypeScript
```

Requires Node.js 18 or later.

### Implementation status

| Component | Status |
|-----------|--------|
| Windows Minifilter driver | Implemented |
| ETW process identification | Implemented |
| Rust core + Web API | Implemented |
| TS analysis modules | Implemented |
| Linux eBPF | Skeleton only, not implemented |
| Electron UI | Directory exists, unfinished |

### License

MIT License. See [LICENSE](LICENSE) for details.
