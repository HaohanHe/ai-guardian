# AI Guardian Wiki

> 知识库和技术文档

---

## 目录

1. [架构设计](#架构设计)
2. [核心算法](#核心算法)
3. [安全模型](#安全模型)
4. [性能优化](#性能优化)
5. [扩展开发](#扩展开发)
6. [对比分析](#对比分析)

---

## 架构设计

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AI Guardian 架构                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        输入层 (Input Layer)                          │   │
│  │  - MCP 协议请求                                                      │   │
│  │  - CLI 命令输入                                                      │   │
│  │  - API 调用                                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Agent 检测层 (Agent Detection)                  │   │
│  │  - 识别 Trae/Cursor/VSCode                                          │   │
│  │  - 识别 OpenClaw/Clawbot/MoltBot                                    │   │
│  │  - 识别 Claude Code                                                 │   │
│  │  - 评估 Agent 风险等级                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    推演预判引擎 (Mental Simulation)                  │   │
│  │  - 命令解析 (Shell Parser)                                          │   │
│  │  - 效果预测 (Effect Prediction)                                     │   │
│  │  - 风险指标识别 (Risk Indicators)                                   │   │
│  │  - 绝不真正执行 (No Real Execution)                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    风险分析引擎 (Risk Analysis)                      │   │
│  │  - 危险模式匹配 (Pattern Matching)                                  │   │
│  │  - 敏感路径检测 (Sensitive Path Detection)                          │   │
│  │  - 权限提升识别 (Privilege Escalation)                              │   │
│  │  - 数据外泄评估 (Data Exfiltration)                                 │   │
│  │  - 持久化行为检测 (Persistence Detection)                           │   │
│  │  - 上下文风险关联 (Contextual Risk)                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    LLM 语义分析 (LLM Analysis)                       │   │
│  │  - OpenAI / Anthropic / DeepSeek                                    │   │
│  │  - 小米 MiMoFlash                                                   │   │
│  │  - Ollama 本地模型                                                  │   │
│  │  - 深度语义理解                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    决策引擎 (Decision Engine)                        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│  │  │  全自动放行  │  │  半自动观察  │  │  手动拦截    │                 │   │
│  │  │  (0-30分)   │  │  (31-70分)  │  │  (71-100分) │                 │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    执法记录仪 (Body Camera)                          │   │
│  │  - 全程记录 (Full Logging)                                          │   │
│  │  - 数字签名 (Digital Signature)                                     │   │
│  │  - 防篡改 (Tamper-proof)                                            │   │
│  │  - 远程备份 (Remote Backup)                                         │   │
│  │  - 事后追溯 (Forensics)                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        输出层 (Output)                               │   │
│  │  - 决策结果 (Decision)                                              │   │
│  │  - 风险报告 (Risk Report)                                           │   │
│  │  - 替代建议 (Alternatives)                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 数据流图

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  Command │ → │  Parse  │ → │ Simulate│ → │ Analyze │ → │ Decide  │
│  Input   │    │  Shell  │    │ Effects │    │  Risk   │    │ Action  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │              │
     │              │              │              │              │
     ▼              ▼              ▼              ▼              ▼
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  Raw    │    │ Parsed  │    │ Predicted│   │  Risk   │    │ Decision│
│  Text   │    │ Command │    │ Effects  │   │  Score  │    │ Result  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
```

---

## 核心算法

### 1. 命令解析算法

```typescript
// 分词算法
function tokenize(command: string): Token[] {
  const tokens: Token[] = [];
  let current = '';
  let inQuote: string | null = null;
  
  for (const char of command) {
    if (isQuote(char) && !inQuote) {
      // 开始引号
      saveToken(current);
      inQuote = char;
    } else if (char === inQuote) {
      // 结束引号
      saveToken(current, 'quoted');
      inQuote = null;
    } else if (isWhitespace(char) && !inQuote) {
      // 分词
      saveToken(current);
    } else {
      current += char;
    }
  }
  
  return tokens;
}

// 管道分割
function splitPipeline(command: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  
  for (const char of command) {
    if (char === '(' || char === '[' || char === '{') depth++;
    if (char === ')' || char === ']' || char === '}') depth--;
    
    if (char === '|' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  return parts;
}
```

### 2. 风险评分算法

```typescript
// 多维度风险评分
function calculateRiskScore(simulation: Simulation): number {
  const weights = {
    commandType: 0.20,
    permissionEscalation: 0.25,
    dataExfiltration: 0.25,
    persistence: 0.15,
    network: 0.10,
    context: 0.05
  };
  
  const scores = {
    commandType: assessCommandType(simulation),
    permissionEscalation: assessPermission(simulation),
    dataExfiltration: assessDataExfiltration(simulation),
    persistence: assessPersistence(simulation),
    network: assessNetwork(simulation),
    context: assessContext(simulation)
  };
  
  // 加权平均
  let totalScore = 0;
  for (const [dimension, score] of Object.entries(scores)) {
    totalScore += score * weights[dimension];
  }
  
  // 致命风险检测
  if (hasFatalRisk(scores)) {
    return 100;
  }
  
  return Math.min(100, Math.round(totalScore));
}
```

### 3. 上下文关联算法

```typescript
// 攻击链识别
function detectAttackChain(history: Command[]): AttackChain | null {
  const patterns: AttackChainPattern[] = [
    {
      name: 'Reconnaissance → Exploitation → Exfiltration',
      stages: [
        { patterns: ['ls', 'find', 'cat'], type: 'recon' },
        { patterns: ['curl', 'wget', 'nc'], type: 'exploit' },
        { patterns: ['base64', 'tar', 'scp'], type: 'exfil' }
      ]
    }
  ];
  
  for (const pattern of patterns) {
    if (matchesPattern(history, pattern)) {
      return {
        name: pattern.name,
        confidence: calculateConfidence(history, pattern),
        severity: 'critical'
      };
    }
  }
  
  return null;
}

// 时间窗口分析
function analyzeTimeWindow(commands: Command[], windowMs: number): RiskAdjustment {
  const recentCommands = commands.filter(
    cmd => Date.now() - cmd.timestamp < windowMs
  );
  
  const sensitiveCount = recentCommands.filter(
    cmd => cmd.riskScore > 50
  ).length;
  
  if (sensitiveCount > 3) {
    return { adjustment: 15, reason: 'High frequency sensitive operations' };
  }
  
  return { adjustment: 0, reason: '' };
}
```

---

## 安全模型

### 威胁模型

```
┌─────────────────────────────────────────────────────────────┐
│                        威胁模型                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  攻击者类型：                                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ 外部攻击者   │  │ 内部威胁     │  │ AI Agent    │         │
│  │ (External)  │  │ (Insider)   │  │ (Compromised)│        │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  攻击向量：                                                  │
│  1. 提示词注入 (Prompt Injection)                           │
│  2. 命令注入 (Command Injection)                            │
│  3. 权限提升 (Privilege Escalation)                         │
│  4. 数据外泄 (Data Exfiltration)                            │
│  5. 持久化后门 (Persistence)                                │
│  6. 社会工程学 (Social Engineering)                         │
│                                                             │
│  防御策略：                                                  │
│  - 推演预判：不执行，只预测                                  │
│  - 多层防御：规则 + ML + LLM                                │
│  - 最小权限：默认拒绝，显式允许                              │
│  - 全程审计：不可抵赖，可追溯                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 安全等级

| 等级 | 描述 | 示例 |
|------|------|------|
| 🔴 Critical | 系统毁灭性操作 | `rm -rf /`, `mkfs` |
| 🟠 High | 敏感数据访问 | `cat /etc/shadow`, `~/.ssh/id_rsa` |
| 🟡 Medium | 权限变更 | `sudo`, `chmod 777` |
| 🟢 Low | 常规操作 | `ls`, `cat README.md` |

---

## 性能优化

### 性能指标

| 指标 | 目标 | 实际 |
|------|------|------|
| 推演延迟 | < 100ms | ~20ms |
| 风险分析 | < 50ms | ~15ms |
| 决策时间 | < 10ms | ~5ms |
| 日志写入 | < 10ms | ~3ms |
| 总延迟 | < 200ms | ~50ms |

### 优化策略

1. **缓存机制**
   - 命令解析结果缓存
   - 风险评分缓存
   - LLM 响应缓存

2. **并行处理**
   - 多维度风险分析并行
   - 异步日志写入

3. **增量计算**
   - 上下文增量更新
   - 风险评分增量调整

---

## 扩展开发

### 添加新的 LLM 提供商

```typescript
// 1. 创建提供商类
export class CustomProvider extends BaseLLMProvider {
  protected defineCapabilities() {
    return {
      supportsStreaming: true,
      supportsSystemPrompt: true,
      maxContextLength: 128000,
      supportedModels: ['model-1', 'model-2']
    };
  }
  
  async complete(request: LLMRequest): Promise<LLMResponse> {
    // 实现 API 调用
  }
}

// 2. 注册到工厂
export function createLLMProvider(config: LLMConfig): BaseLLMProvider {
  switch (config.provider) {
    case 'custom':
      return new CustomProvider(config);
    // ...
  }
}
```

### 添加新的风险检测规则

```typescript
// 在 RiskAnalyzer 中添加
private assessCustomRisk(simulation: SimulationResult): number {
  let risk = 0;
  
  // 自定义检测逻辑
  if (this.matchesCustomPattern(simulation)) {
    risk += 50;
  }
  
  return risk;
}
```

---

## 对比分析

### 与 OpenClaw 对比

| 特性 | OpenClaw | AI Guardian |
|------|----------|-------------|
| 主要功能 | AI Agent 执行 | AI Agent 防御 |
| 执行方式 | 实际执行 | 推演预判 |
| 安全策略 | 可选审批 | 强制防御 |
| 风险识别 | 基础 | 多维度深度分析 |
| 审计日志 | 有 | 更完善（数字签名）|
| LLM 支持 | 多种 | 更多（含国内）|

### 与传统安全工具对比

| 工具类型 | 代表 | 优势 | 劣势 |
|---------|------|------|------|
| 杀毒软件 | 360/金山毒霸 | 恶意软件检测 | 无法防御 AI Agent |
| EDR | CrowdStrike | 端点检测 | 反应滞后 |
| 沙盒 | FireEye | 隔离执行 | 性能开销大 |
| AI Guardian | - | 主动防御 AI | 新兴技术 |

---

## 技术栈

- **语言**: TypeScript 5.x
- **运行时**: Node.js 18+
- **测试**: Vitest
- **构建**: TypeScript Compiler
- **协议**: MCP (Model Context Protocol)

---

## 参考资源

- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [MCP Specification](https://github.com/modelcontextprotocol)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [MITRE ATT&CK](https://attack.mitre.org/)

---

**持续更新中...**
