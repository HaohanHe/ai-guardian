# AI Guardian

[中文](#中文) ｜ [日本語](#日本語) ｜ [English](#english)

## 中文

AI Guardian 是一个给 AI Agent 用的终端防护工具。简单说就是：跑在系统里的 Agent 可能会瞎删文件、执行危险命令、偷偷提权，这个工具负责盯着它，发现不对就掐断。

Windows 端的文件系统过滤驱动已经写好了（Minifilter，701 行 C），能识别标记过的 AI Agent 进程并拦截敏感路径上的删除/写入操作。Linux 端这次补齐了一套用户态实时防御：扫描 /proc 识别运行中的 Agent 进程，用信号按进程树暂停、恢复或终止，急停按钮也接上了真实动作；eBPF 程序仍作为后续的高性能强制路径保留。

### 这是什么

这不是黑名单也不是沙箱。黑名单得你自己读代码知道该拦什么；沙箱要求你把 Agent 放进隔离环境跑。AI Guardian 的思路是：Agent 本来就在你系统里跑着，那就在它旁边加一层监控，区分哪些进程是 AI 终端，只盯这些进程的行为。

目前 Windows 路径是可用的：Minifilter 驱动加载后，通过 IOCTL 告诉驱动哪些 PID 是 AI 终端，驱动在文件系统回调里检查这些进程碰敏感路径的操作，该拦就返回 `STATUS_ACCESS_DENIED`。

### 核心功能

- Windows Minifilter 文件系统过滤：PreCreate / PreWrite / PreSetInformation 回调，AI 进程哈希表（256 桶，最多 1024 个 PID），敏感路径检测（System32、Program Files、用户数据目录），直接在内核态阻断删除操作
- ETW 进程监控：用 ToolHelp32 扫描进程列表，自动识别 AI 终端（按进程名/路径匹配），把 PID 注册给驱动
- Linux 实时进程防御：轮询 /proc 识别 Agent（内置十余种特征，子进程继承标记），跟踪运行/暂停状态；处置按进程树发 SIGSTOP / SIGCONT / SIGTERM（宽限后 SIGKILL）；急停激活自动暂停全部 Agent；CLI 提供 watch / agents 命令，Web 仪表盘通过 WebSocket 实时推送进程与事件，可在页面上直接暂停、恢复、终止
- Linux 内核级执行拦截（fanotify）：在 `execve` 真正执行前通过 permission event 裁决。两类策略，默认全部放行只拦命中的——`--deny-prefix` 按可执行文件路径前缀拒绝，`--lockdown-agent` 沿父进程链匹配 Agent 的命令行，命中后该 Agent 树下所有新进程（含毫秒级瞬时命令）在执行前被拒。策略支持运行时经 Unix socket 动态下发/解除，不用重启守护进程。不需要自定义内核模块，主线内核通用
- TS 分析模块：prompt injection 检测、混淆命令检测、MCP injection 检测、skill 供应链检查、风险评分。这些跑在用户态，对命令行输出做语义分析
- Rust 核心引擎：主控制器、审计日志、风险引擎、配置管理，axum 跑 Web API
- MCP server：可以作为 MCP 工具接入 OpenClaw 等 Agent 框架

### 目录结构

```
ai-guardian/
├── driver/windows/AiGuardianDriver.c   # Windows Minifilter 驱动（C，701 行）
├── driver/linux/ai_guardian.bpf.c       # Linux eBPF（后续高性能路径）
├── src/bin/fanotify_enforcer.rs         # Linux fanotify 执行拦截守护进程
├── src/
│   ├── core/
│   │   ├── live-defense.ts             # 实时防御编排（监控+处置+急停联动）
│   │   └── ...                          # Rust 核心：guardian、risk_engine、audit_logger
│   ├── platform/
│   │   ├── linux-process-monitor.ts    # /proc 扫描与 Agent 识别
│   │   └── linux-enforcer.ts           # 信号处置（SIGSTOP/CONT/TERM/KILL）
│   ├── driver/windows/mod.rs           # 驱动 IOCTL 封装
│   ├── monitor/windows/etw.rs          # ETW 进程监控
│   ├── analysis/                       # TS 分析模块（prompt-injection 等）
│   ├── web/                            # Web 服务与仪表盘（含 WebSocket）
│   ├── mcp/                            # MCP server
│   └── cli.ts                          # CLI 入口
├── tests/linux-runtime.test.ts         # Linux 运行时测试（12 项）
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

**Linux（用户态实时防御，无需内核模块）：**

```bash
npm install
npm run build
node dist/cli.js server -p 3456     # Web 仪表盘：实时进程、事件、处置按钮
node dist/cli.js watch              # 终端实时监控，x 急停（连按两次）/ c 恢复 / q 退出
node dist/cli.js agents             # 一次性列出当前 Agent
```

暂停或终止其他用户的进程需要相应权限。

**Linux 内核级执行拦截（需要 root / CAP_SYS_ADMIN）：**

```bash
cargo build --release --bin fanotify-enforcer
sudo ./target/release/fanotify-enforcer \
  --deny-prefix /opt/forbidden \
  --lockdown-agent claude-code
# 每条裁决输出一行 JSON：pid、路径、decision、reason
```

守护进程默认在 `/run/ai-guardian/enforcer.sock`（建不了就回退
`/tmp/ai-guardian-enforcer.sock`）开一个 Unix socket，运行时改策略不用重启。
每行一个 JSON 请求，处理完即断开：

```text
{"op":"status"}
{"op":"apply","policy":{"deny_prefixes":[],"lockdown_agents":["claude-code"],"watch_paths":["/"]}}
```

返回 `{"ok":true,"result": ...}`。TS 侧由 `KernelEnforcerClient` 封装：急停激活时
自动按当前识别到的 Agent 下发内核锁定，急停恢复不自动解除（需人工确认现场后在
仪表盘点 Clear），避免恢复的瞬间命令重新执行。注意 socket 默认权限是 0666，
本机任何用户都能下发策略，信任边界等同本机登录；多用户机器可用 `--socket`
指到受控目录或 `--no-socket` 关闭。

用户态轮询有个绕不开的缺口：两次 /proc 扫描之间（默认 2 秒），8~11 毫秒就跑完的瞬时命令已经结束，事后再暂停进程也改变不了它做过的事。fanotify 把裁决点挪到 `execve` 之前，这类命令在执行前直接被拒。eBPF LSM 仍作为后续更高性能、更细粒度的路径预留（骨架可编译，尚未加载使用）。

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
| Linux 实时进程防御（用户态） | 已实现，测试通过 |
| Linux 内核级执行拦截（fanotify） | 已实现，CI 中 sudo 实测通过 |
| Web 仪表盘实时进程 / 处置 | 已实现 |
| Linux eBPF | 骨架可编译，后续高性能路径 |
| Electron UI | 目录在，未完成 |

### 许可证

MIT License，详见 [LICENSE](LICENSE)。

---

## 日本語

AI Guardian は AI エージェント向けのエンドポイント保護ツールです。要するに、システム上で動いているエージェントがファイルを消したり危険なコマンドを実行したりするのを監視して、おかしいと思ったら遮断します。

Windows 向けのファイルシステムフィルタドライバは実装済みです（Minifilter、C で 701 行）。登録された AI エージェントのプロセスを識別して、センシティブなパスへの削除・書き込み操作をブロックします。Linux 向けには今回、ユーザーランドのリアルタイム防御を追加しました。/proc をスキャンして実行中のエージェントを識別し、プロセスツリー単位でシグナルによる一時停止・再開・終了を行い、緊急停止ボタンも実際のシグナルに連携します。eBPF プログラムは今後の高パフォーマンス強制経路として残しています。

### これは何か

ブラックリストでもサンドボックスでもありません。ブラックリストは何をブロックすべきか自分でコードを読んで知っておく必要があります。サンドボックスはエージェントを隔離環境に入れて動かす必要があります。AI Guardian の考え方はこうです：エージェントはもともと自分のシステムで動いているのだから、その横に監視レイヤーを置いて、どのプロセスが AI 端末かを区別し、そのプロセスの挙動だけを監視します。

現在使えるのは Windows 側です。Minifilter ドライバをロードしたあと、IOCTL 経由でどの PID が AI 端末かをドライバに教えます。ドライバはファイルシステムのコールバックでそれらのプロセスがセンシティブパスに触る操作をチェックし、必要なら `STATUS_ACCESS_DENIED` を返して遮断します。

### 機能

- Windows Minifilter フィルタリング：PreCreate / PreWrite / PreSetInformation コールバック、AI プロセスのハッシュテーブル（256 バケット、最大 1024 PID）、センシティブパスの判定（System32、Program Files、ユーザーデータ）、カーネルモードでの削除操作のブロック
- ETW プロセス監視：ToolHelp32 API でプロセス一覧をスキャンし、プロセス名・パスから AI 端末を自動識別してドライバに PID を登録
- Linux リアルタイムプロセス防御：/proc をポーリングしてエージェントを識別（10 種類以上のシグネチャを内蔵、子プロセスにも継承）し、実行／停止状態を追跡。プロセスツリー単位で SIGSTOP / SIGCONT / SIGTERM（猶予後に SIGKILL）を送信し、緊急停止で全エージェントを自動停止。CLI に watch / agents コマンド、Web ダッシュボードでは WebSocket でプロセスとイベントをリアルタイム表示し、画面上で一時停止・再開・終了が可能
- Linux カーネルレベルの実行ブロック（fanotify）：`execve` が実際に走る前に permission event で判定します。デフォルトは全許可で、命中したものだけ止める二つのポリシーがあります。`--deny-prefix` は実行ファイルのパス接頭辞で拒否し、`--lockdown-agent` は親プロセスをたどってエージェントのコマンドラインと照合し、一致するとその配下の新しいプロセスをミリ秒単位のコマンドも含めて実行前に拒否します。ポリシーは Unix socket で実行中に動的に適用・解除でき、デーモンの再起動は不要です。自作カーネルモジュールは不要で、メインラインカーネルで使えます
- TypeScript 分析モジュール：プロンプトインジェクション検出、難読化コマンド検出、MCP インジェクション検出、スキルサプライチェーンチェック、リスクスコアリング。ユーザーモードでコマンド出力を解析します
- Rust コアエンジン：メインコントローラー、監査ログ、リスクエンジン、設定管理。axum で Web API を提供
- MCP サーバー：OpenClaw などのエージェントフレームワークに MCP ツールとして組み込めます

### ディレクトリ構成

```
ai-guardian/
├── driver/windows/AiGuardianDriver.c   # Windows Minifilter ドライバ（C、701 行）
├── driver/linux/ai_guardian.bpf.c       # Linux eBPF（今後の高パフォーマンス経路）
├── src/bin/fanotify_enforcer.rs         # Linux fanotify 実行ブロックのデーモン
├── src/
│   ├── core/
│   │   ├── live-defense.ts             # リアルタイム防御の統合（監視＋処置＋緊急停止連携）
│   │   └── ...                          # Rust コア：guardian、risk_engine、audit_logger
│   ├── platform/
│   │   ├── linux-process-monitor.ts    # /proc スキャンとエージェント識別
│   │   └── linux-enforcer.ts           # シグナル処置（SIGSTOP/CONT/TERM/KILL）
│   ├── driver/windows/mod.rs           # ドライバ IOCTL ラッパー
│   ├── monitor/windows/etw.rs          # ETW プロセス監視
│   ├── analysis/                       # TS 分析モジュール（prompt-injection など）
│   ├── web/                            # Web サーバーとダッシュボード（WebSocket 含む）
│   ├── mcp/                            # MCP サーバー
│   └── cli.ts                          # CLI エントリー
├── tests/linux-runtime.test.ts         # Linux ランタイムのテスト（12 件）
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

**Linux（ユーザーランドのリアルタイム防御、カーネルモジュール不要）：**

```bash
npm install
npm run build
node dist/cli.js server -p 3456     # Web ダッシュボード：プロセス、イベント、処置ボタン
node dist/cli.js watch              # ターミナル監視、x で緊急停止（2 回押し）/ c で再開 / q で終了
node dist/cli.js agents             # 現在のエージェントを一覧表示
```

他ユーザーのプロセスを停止・終了するには相応の権限が必要です。

**Linux カーネルレベルの実行ブロック（root / CAP_SYS_ADMIN が必要）：**

```bash
cargo build --release --bin fanotify-enforcer
sudo ./target/release/fanotify-enforcer \
  --deny-prefix /opt/forbidden \
  --lockdown-agent claude-code
# 判定ごとに JSON が1行出力されます：pid、path、decision、reason
```

デーモンは既定で `/run/ai-guardian/enforcer.sock`（作れない場合は
`/tmp/ai-guardian-enforcer.sock`）に Unix socket を開き、再起動なしで実行中に
ポリシーを変更できます。1行に1つの JSON を送ると、処理後に切断されます。

```text
{"op":"status"}
{"op":"apply","policy":{"deny_prefixes":[],"lockdown_agents":["claude-code"],"watch_paths":["/"]}}
```

応答は `{"ok":true,"result": ...}` です。TypeScript 側は `KernelEnforcerClient`
が担当し、緊急停止が発動すると現在検出されているエージェントでカーネルロックを
自動適用します。緊急停止の復旧時にロックは自動解除されません。現場を確認して
からダッシュボードで Clear を押す設計で、復旧の瞬間にコマンドが再実行されるのを
防ぎます。socket の既定権限は 0666 で、マシン上のどのユーザーでもポリシーを
送れます。信頼境界はそのマシンへのログインと同じです。マルチユーザー環境では
`--socket` で管理されたディレクトリを指定するか、`--no-socket` で無効にできます。

ユーザーランドのポーリングには埋められない隙間があります。/proc のスキャン間隔（デフォルト2秒）の間に、8〜11ミリ秒で終わるコマンドは実行を終えてしまい、後からプロセスを止めても実行された操作は取り消せません。fanotify は判定点を `execve` の前に移すので、こうしたコマンドは実行前に拒否されます。eBPF LSM は、より高パフォーマンスで粒度の細かい今後の経路として残しています（骨組みはコンパイル可能、読み込みはまだ）。

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
| Linux リアルタイムプロセス防御（ユーザーランド） | 実装済み、テスト通過 |
| Linux カーネルレベル実行ブロック（fanotify） | 実装済み、CI で sudo 実測済み |
| Web ダッシュボードのリアルタイムプロセス / 処置 | 実装済み |
| Linux eBPF | 骨組みはコンパイル可能、今後の高パフォーマンス経路 |
| Electron UI | ディレクトリはあるが未完成 |

### ライセンス

MIT License。詳細は [LICENSE](LICENSE) を参照してください。

---

## English

AI Guardian is an endpoint protection tool built for AI agents. The problem it tries to solve is straightforward: when an agent runs inside your actual system, it may delete files it should not, run dangerous commands, or escalate privileges on its own. This tool watches the agent's behavior and cuts it off when something goes wrong.

The Windows file system filter driver is done (Minifilter, 701 lines of C). It can identify registered AI agent processes and block delete or write operations on sensitive paths. This round adds a userspace live defense on Linux: it scans /proc to identify running agent processes and uses signals to suspend, resume, or terminate them by process tree, and the emergency-stop button is now wired to real signals. The eBPF program remains as the future high-performance enforcement path.

### What this is

This is not a blocklist and not a sandbox. A blocklist requires you to read code yourself and know what to stop. A sandbox requires you to run the agent inside an isolated environment. AI Guardian takes a different approach: the agent is already running in your system, so it puts a monitoring layer next to it. It figures out which processes are AI terminals and only watches those.

The working path today is Windows. After the Minifilter driver loads, you tell it which PIDs are AI terminals through IOCTL calls. The driver hooks file system callbacks and checks whether those processes touch sensitive paths, returning `STATUS_ACCESS_DENIED` when a block is needed.

### Features

- Windows Minifilter filtering: PreCreate, PreWrite, and PreSetInformation callbacks, an AI process hash table (256 buckets, up to 1024 PIDs), sensitive path detection (System32, Program Files, user data directories), and direct kernel-mode blocking of delete operations
- ETW process monitoring: scans the process list via ToolHelp32, identifies AI terminals by process name and path, then registers their PIDs with the driver
- Linux live process defense: polls /proc to identify agents (over a dozen built-in signatures, inherited by child processes) and tracks running/stopped state. Enforcement is process-tree aware: SIGSTOP / SIGCONT / SIGTERM (SIGKILL after a grace period); emergency stop auto-suspends every agent. The CLI offers watch and agents commands, and the web dashboard pushes processes and events over WebSocket with on-page suspend/resume/terminate controls
- Linux kernel-level exec blocking (fanotify): decisions happen on a permission event before `execve` runs. Everything is allowed by default, and two policies only block what matches. `--deny-prefix` rejects by executable path prefix, and `--lockdown-agent` walks the parent chain against the agent's command line; once matched, every new process under that tree is rejected before it runs, including millisecond commands. Policy can be applied or cleared at runtime over a Unix socket without restarting the daemon. No custom kernel module is needed on mainline kernels
- TypeScript analysis modules: prompt injection detection, obfuscation detection, MCP injection detection, skill supply chain checks, and risk scoring. These run in user space and analyze command output
- Rust core engine: main controller, audit logger, risk engine, and config management, with axum serving a Web API
- MCP server: can be plugged into agent frameworks like OpenClaw as an MCP tool

### Project structure

```
ai-guardian/
├── driver/windows/AiGuardianDriver.c   # Windows Minifilter driver (C, 701 lines)
├── driver/linux/ai_guardian.bpf.c       # Linux eBPF (future high-performance path)
├── src/bin/fanotify_enforcer.rs         # Linux fanotify exec-blocking daemon
├── src/
│   ├── core/
│   │   ├── live-defense.ts             # Live defense orchestration (monitor + enforce + estop)
│   │   └── ...                          # Rust core: guardian, risk_engine, audit_logger
│   ├── platform/
│   │   ├── linux-process-monitor.ts    # /proc scan and agent identification
│   │   └── linux-enforcer.ts           # Signal enforcement (SIGSTOP/CONT/TERM/KILL)
│   ├── driver/windows/mod.rs           # Driver IOCTL wrapper
│   ├── monitor/windows/etw.rs          # ETW process monitor
│   ├── analysis/                       # TS analysis modules (prompt-injection, etc.)
│   ├── web/                            # Web server and dashboard (with WebSocket)
│   ├── mcp/                            # MCP server
│   └── cli.ts                          # CLI entry point
├── tests/linux-runtime.test.ts         # Linux runtime tests (12 cases)
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

**Linux (userspace live defense, no kernel module required):**

```bash
npm install
npm run build
node dist/cli.js server -p 3456     # Web dashboard: live processes, events, controls
node dist/cli.js watch              # Terminal monitoring, x estop (press twice) / c resume / q quit
node dist/cli.js agents             # List current agents once
```

Suspending or killing another user's processes requires appropriate privileges.

**Linux kernel-level exec blocking (requires root / CAP_SYS_ADMIN):**

```bash
cargo build --release --bin fanotify-enforcer
sudo ./target/release/fanotify-enforcer \
  --deny-prefix /opt/forbidden \
  --lockdown-agent claude-code
# Each decision prints one JSON line: pid, path, decision, reason
```

The daemon opens a Unix socket at `/run/ai-guardian/enforcer.sock` by default (it falls
back to `/tmp/ai-guardian-enforcer.sock`), so policy can change at runtime without a
restart. Send one JSON object per line; the connection closes after the response:

```text
{"op":"status"}
{"op":"apply","policy":{"deny_prefixes":[],"lockdown_agents":["claude-code"],"watch_paths":["/"]}}
```

It returns `{"ok":true,"result": ...}`. On the TypeScript side, `KernelEnforcerClient`
wraps this: an emergency stop automatically applies a kernel lockdown for the agents
currently detected. Resuming the emergency stop does not clear the lockdown. You confirm
the scene and press Clear on the dashboard, so commands cannot run again the moment
things resume. The socket is created with mode 0666, which means any local user can push
policy; the trust boundary is the same as local login. On a multi-user machine, point
`--socket` at a controlled directory or disable it with `--no-socket`.

Userspace polling has a gap it cannot close. Between two /proc scans (2 seconds by default), a command that finishes in 8 to 11 milliseconds is already gone; suspending the process afterward does not undo what it did. fanotify moves the decision point before `execve`, so those commands are rejected before they run. The eBPF LSM remains reserved as a later path with higher performance and finer granularity (the skeleton compiles, but it is not loaded yet).

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
| Linux live process defense (userspace) | Implemented, tests passing |
| Linux kernel-level exec blocking (fanotify) | Implemented, sudo-tested in CI |
| Dashboard live processes / enforcement | Implemented |
| Linux eBPF | Skeleton compiles, future high-performance path |
| Electron UI | Directory exists, unfinished |

### License

MIT License. See [LICENSE](LICENSE) for details.
