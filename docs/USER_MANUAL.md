# AI Guardian 使用说明书

> **AI Agent 数字孪生防御系统 - AI 界的 360/金山毒霸**

---

## 目录

1. [快速开始](#快速开始)
2. [核心概念](#核心概念)
3. [安装与配置](#安装与配置)
4. [命令行使用](#命令行使用)
5. [API 使用](#api-使用)
6. [云服务提供商配置](#云服务提供商配置)
7. [Agent 识别](#agent-识别)
8. [高级配置](#高级配置)
9. [故障排除](#故障排除)
10. [安全最佳实践](#安全最佳实践)

---

## 快速开始

### 1. 安装

```bash
# 克隆仓库
git clone https://github.com/yourusername/ai-guardian.git
cd ai-guardian

# 安装依赖
npm install

# 构建项目
npm run build
```

### 2. 运行演示

```bash
# 运行演示脚本
npx tsx demo.ts
```

### 3. 评估命令

```bash
# 评估单个命令
npx tsx src/cli.ts eval "ls -la"

# 评估危险命令
npx tsx src/cli.ts eval "rm -rf /"
```

---

## 核心概念

### 推演预判 (Mental Simulation)

AI Guardian 在**脑海中推演**命令执行效果，**绝不真正执行**危险命令。

```typescript
import { mentalSimulation } from 'ai-guardian';

const result = mentalSimulation.simulate('rm -rf /');
console.log(result.predictedEffects);
// 预测到：删除根目录，严重风险
```

### 手自一体 (Auto-Manual)

三级决策机制：

| 风险评分 | 决策 | 说明 |
|---------|------|------|
| 0-30 | ✅ 放行 | 全自动，无需干预 |
| 31-70 | ⚡ 观察 | 半自动，增强监控 |
| 71-100 | 🚫 拦截 | 手动，需人工确认 |

### 执法记录仪 (Body Camera)

像 360/金山毒霸一样，**全程记录**所有操作。

```typescript
import { bodyCamera } from 'ai-guardian';

// 记录操作
bodyCamera.record('exec', { command: 'ls' }, decision);

// 查询日志
const entries = await bodyCamera.query({ limit: 10 });

// 生成报告
const report = await bodyCamera.generateReport({ format: 'text' });
```

### 上下文感知 (Context Awareness)

不孤立看待单个命令，分析**命令链**。

```
ls ~/.ssh/        → 探测（低风险）
cat ~/.ssh/id_rsa → 窃取（高风险）
| base64          → 编码（中风险）
| curl -d @-      → 外发（严重）

组合风险：探测→窃取→编码→外发 = 数据外泄攻击链
```

---

## 安装与配置

### 系统要求

- Node.js >= 18.0.0
- npm >= 8.0.0
- Windows / Linux / macOS

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/yourusername/ai-guardian.git

# 2. 进入目录
cd ai-guardian

# 3. 安装依赖
npm install

# 4. 编译 TypeScript
npm run build

# 5. 运行测试
npm test

# 6. 运行演示
npx tsx demo.ts
```

### 配置文件

创建 `ai-guardian.yaml`：

```yaml
# 决策阈值
decision:
  thresholds:
    allow: 30      # 0-30: 全自动放行
    observe: 70    # 31-70: 半自动观察
    deny: 100      # 71-100: 手动拦截

# 审计配置
audit:
  logPath: ./logs/audit.log
  maxFileSize: 10485760  # 10MB
  enableSignature: true

# LLM 配置（可选）
llm:
  provider: deepseek     # openai | anthropic | deepseek | mimoflash | ollama
  apiKey: your-api-key
  model: deepseek-chat
  temperature: 0
```

---

## 命令行使用

### 基本命令

```bash
# 评估命令
ai-guardian eval <command>

# 批量评估
ai-guardian batch <command1> <command2> ...

# 交互模式
ai-guardian interactive

# 生成报告
ai-guardian report

# 查询日志
ai-guardian query

# 运行演示
ai-guardian demo

# 显示统计
ai-guardian stats
```

### 评估命令示例

```bash
# 低风险命令
$ ai-guardian eval "ls -la"
✅ 决策: ALLOW
📊 风险评分: 0/100 (low)

# 中风险命令
$ ai-guardian eval "cat ~/.ssh/config"
⚡ 决策: OBSERVE
📊 风险评分: 100/100 (critical)

# 高风险命令
$ ai-guardian eval "sudo rm -rf /"
🚫 决策: DENY
📊 风险评分: 100/100 (critical)
💡 替代方案:
   1. 使用 "rm -i" 进行交互式删除
   2. 先使用 "ls" 查看要删除的内容
```

### 交互模式

```bash
$ ai-guardian interactive

🛡️  AI Guardian 交互模式
输入命令进行安全评估，输入 "exit" 退出

guardian> ls -la
✅ 决策: ALLOW
📊 风险评分: 0/100 (low)

guardian> rm -rf /
🚫 决策: DENY
📊 风险评分: 100/100 (critical)

guardian> exit
👋 再见！
```

---

## API 使用

### 基础用法

```typescript
import { AIGuardian } from 'ai-guardian';

const guardian = new AIGuardian();

// 评估工具调用
const decision = await guardian.evaluate({
  id: '1',
  toolName: 'exec',
  params: {
    command: 'ls -la',
    host: 'gateway'
  },
  timestamp: Date.now(),
  sessionId: 'session-1'
});

console.log(decision.action);  // 'allow' | 'observe' | 'deny'
console.log(decision.riskAnalysis.score);  // 0-100
```

### 快速评估

```typescript
// 性能敏感场景使用快速评估
const decision = guardian.quickEvaluate('rm -rf /');
```

### 配置选项

```typescript
const guardian = new AIGuardian({
  allowThreshold: 30,      // 放行阈值
  observeThreshold: 70,    // 观察阈值
  auditLogPath: './logs/audit.log',
  maxHistorySize: 100,
  contextWindowMs: 60000
});
```

### 审计查询

```typescript
// 查询日志
const entries = await guardian.queryAuditLog({
  startTime: Date.now() - 86400000,  // 最近24小时
  toolName: 'exec',
  minRiskScore: 50,
  limit: 100
});

// 生成报告
const report = await guardian.generateAuditReport('text');
```

---

## 云服务提供商配置

### 支持的提供商

| 提供商 | ID | 模型 | 特点 |
|--------|-----|------|------|
| OpenAI | `openai` | gpt-4o, gpt-4-turbo, gpt-3.5-turbo | 通用能力强 |
| Anthropic | `anthropic` | claude-3-5-sonnet, claude-3-opus | 推理能力强 |
| DeepSeek | `deepseek` | deepseek-chat, deepseek-coder | 中文优化 |
| 小米 MiMoFlash | `mimoflash` | mimoflash-v2 | 速度快，成本低 |
| Ollama | `ollama` | llama3, mistral, qwen2 | 本地部署 |

### OpenAI 配置

```yaml
llm:
  provider: openai
  apiKey: sk-your-openai-api-key
  model: gpt-4o
  temperature: 0
  maxTokens: 500
```

### Anthropic Claude 配置

```yaml
llm:
  provider: anthropic
  apiKey: sk-ant-your-anthropic-api-key
  model: claude-3-5-sonnet-20241022
  temperature: 0
  maxTokens: 500
```

### DeepSeek 配置

```yaml
llm:
  provider: deepseek
  apiKey: your-deepseek-api-key
  model: deepseek-chat
  temperature: 0
  maxTokens: 500
```

### 小米 MiMoFlash 配置

```yaml
llm:
  provider: mimoflash
  apiKey: your-mimoflash-api-key
  model: mimoflash-v2
  temperature: 0
  maxTokens: 500
```

### Ollama 本地配置

```yaml
llm:
  provider: ollama
  baseUrl: http://localhost:11434
  model: llama3
  temperature: 0
  maxTokens: 500
```

### 使用 LLM 分析

```typescript
import { createLLMProvider } from 'ai-guardian';

const llm = createLLMProvider({
  provider: 'deepseek',
  apiKey: 'your-api-key',
  model: 'deepseek-chat'
});

const analysis = await llm.analyzeCommand('rm -rf /');
console.log(analysis.intent);
console.log(analysis.hiddenRisks);
```

---

## Agent 识别

### 自动识别

AI Guardian 自动识别请求来源：

```typescript
import { agentDetector } from 'ai-guardian';

const context = {
  userAgent: 'OpenClaw/1.0',
  headers: {
    'x-openclaw-version': '1.0.0'
  },
  sessionId: 'session-1',
  timestamp: Date.now()
};

const agentInfo = agentDetector.detectAgent(context);
console.log(agentInfo.type);      // 'openclaw'
console.log(agentInfo.name);      // 'OpenClaw'
console.log(agentInfo.riskLevel); // 'high'
```

### 支持的 Agent 类型

| Agent 类型 | 风险等级 | 特点 |
|-----------|---------|------|
| Trae IDE | medium | 受限环境，需确认 |
| Cursor IDE | medium | 受限环境，需确认 |
| VSCode AI | low | 受限环境，需确认 |
| Claude Code | high | 支持自动执行 |
| OpenClaw | high | 支持提权、浏览器控制 |
| 通用 MCP | medium | 标准 MCP 客户端 |
| 未知来源 | high | 严格审查 |

### Agent 特定建议

```typescript
const advice = agentDetector.generateAgentSpecificAdvice(agentInfo, 'exec');
// OpenClaw 建议：
// - ⚠️ OpenClaw 具有强大的系统控制能力，请格外谨慎
// - 🔍 建议检查 /elevated 模式和 exec approvals 配置
```

---

## 高级配置

### 自定义风险权重

```typescript
import { riskAnalyzer } from 'ai-guardian';

riskAnalyzer.setWeights({
  commandType: 0.25,
  permissionEscalation: 0.30,
  dataExfiltration: 0.30,
  persistence: 0.10,
  network: 0.05
});
```

### 自定义危险模式

```typescript
// 添加危险命令模式
riskAnalyzer.addDangerousPattern('custom-dangerous-pattern');

// 添加敏感路径
riskAnalyzer.addSensitivePath('/custom/sensitive/path');
```

### 自定义决策阈值

```typescript
import { decisionEngine } from 'ai-guardian';

decisionEngine.setThresholds({
  allow: 20,    // 更严格
  observe: 60,
  deny: 100
});
```

### 执法记录仪配置

```typescript
import { BodyCamera } from 'ai-guardian';

const camera = new BodyCamera({
  logPath: './logs/audit.log',
  maxFileSize: 10 * 1024 * 1024,  // 10MB
  maxFiles: 10,
  enableSignature: true,
  privateKey: 'your-private-key'
});
```

---

## 故障排除

### 常见问题

#### 1. 编译错误

```bash
# 错误：Cannot find module
npm install

# 错误：TypeScript 编译失败
npx tsc --noEmit
```

#### 2. 运行时错误

```bash
# 错误：Permission denied
chmod +x dist/cli.js

# 错误：Cannot find config
# 创建 ai-guardian.yaml 配置文件
```

#### 3. LLM API 错误

```bash
# 错误：API key invalid
# 检查配置文件中的 apiKey

# 错误：Rate limit exceeded
# 降低请求频率或使用本地模型 (Ollama)
```

### 调试模式

```bash
# 启用调试日志
DEBUG=ai-guardian:* npx tsx src/cli.ts eval "ls -la"
```

### 日志位置

- 审计日志：`./logs/audit.log`
- 应用日志：`./logs/guardian.log`

---

## 安全最佳实践

### 1. 生产环境部署

```yaml
# 生产环境配置
decision:
  thresholds:
    allow: 20      # 更严格
    observe: 50
    deny: 100

audit:
  enableSignature: true
  remoteBackup:
    enabled: true
    endpoint: https://your-backup-server.com
    apiKey: your-backup-api-key
```

### 2. 敏感路径保护

```yaml
riskAnalysis:
  sensitivePaths:
    - '~/.ssh'
    - '/etc/shadow'
    - '/custom/sensitive/data'
```

### 3. 定期审计

```bash
# 每日生成报告
0 0 * * * cd /path/to/ai-guardian && npx tsx src/cli.ts report -o daily-report.txt

# 每周清理旧日志
0 0 * * 0 cd /path/to/ai-guardian && rm -f logs/audit.log.*
```

### 4. 备份策略

```bash
# 备份审计日志
cp logs/audit.log /backup/audit-$(date +%Y%m%d).log

# 同步到远程
rsync -avz logs/audit.log backup-server:/backups/ai-guardian/
```

---

## 技术支持

### 获取帮助

```bash
# 显示帮助
ai-guardian --help

# 显示版本
ai-guardian --version
```

### 报告问题

请访问 [GitHub Issues](https://github.com/yourusername/ai-guardian/issues)

### 贡献代码

请阅读 [CONTRIBUTING.md](../CONTRIBUTING.md)

---

## 许可证

MIT License - 详见 [LICENSE](../LICENSE)

---

**AI Guardian - 让 AI Agent 更安全** 🛡️
