# AI Guardian 项目结构

```
ai-guardian/
├── src/                          # 源代码
│   ├── core/                     # 核心模块
│   │   ├── types.ts              # 类型定义
│   │   └── guardian.ts           # 主控制器
│   │
│   ├── simulation/               # 推演预判引擎
│   │   ├── command-parser.ts     # 命令解析器
│   │   └── mental-simulation.ts  # 推演引擎
│   │
│   ├── analysis/                 # 风险分析引擎
│   │   └── risk-analyzer.ts      # 风险分析器
│   │
│   ├── decision/                 # 手自一体决策
│   │   └── decision-engine.ts    # 决策引擎
│   │
│   ├── audit/                    # 执法记录仪
│   │   └── body-camera.ts        # 审计日志系统
│   │
│   ├── llm/                      # LLM 语义分析 (预留)
│   │   └── README.md
│   │
│   ├── utils/                    # 工具函数 (预留)
│   │   └── README.md
│   │
│   ├── index.ts                  # 主入口
│   └── cli.ts                    # 命令行接口
│
├── config/                       # 配置文件
│   └── default.yaml              # 默认配置
│
├── tests/                        # 测试文件
│   ├── command-parser.test.ts    # 命令解析器测试
│   └── risk-analyzer.test.ts     # 风险分析器测试
│
├── docs/                         # 文档 (预留)
│   └── README.md
│
├── package.json                  # 项目配置
├── tsconfig.json                 # TypeScript 配置
├── README.md                     # 项目说明
├── PROJECT_STRUCTURE.md          # 本文件
└── demo.ts                       # 演示脚本
```

## 模块依赖关系

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI (cli.ts)                         │
│                         Demo (demo.ts)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    AIGuardian (core/guardian.ts)             │
│                    主控制器，整合所有模块                      │
└─────────────────────────────────────────────────────────────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│Mental    │   │Risk      │   │Decision  │   │Body      │
│Simulation│   │Analyzer  │   │Engine    │   │Camera    │
│Engine    │   │          │   │          │   │          │
│(推演预判) │   │(风险分析) │   │(手自一体) │   │(执法记录) │
└──────────┘   └──────────┘   └──────────┘   └──────────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Command Parser                            │
│                    (命令解析基础组件)                         │
└─────────────────────────────────────────────────────────────┘
```

## 核心流程

```
AI Agent 工具调用
       │
       ▼
┌─────────────────┐
│ 1. 拦截请求      │
│    (MCP Layer)  │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ 2. 推演预判      │
│    (Mental      │
│    Simulation)  │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ 3. 风险分析      │
│    (Risk        │
│    Analysis)    │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ 4. 做出决策      │
│    (Decision)   │
│    allow/observe│
│    /deny        │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ 5. 记录执法日志  │
│    (Body Camera)│
└─────────────────┘
       │
       ▼
   返回决策结果
```

## 文件说明

### 核心文件

- **src/core/types.ts** - 所有 TypeScript 类型定义
- **src/core/guardian.ts** - AIGuardian 主类，整合所有功能
- **src/index.ts** - 库的主入口，导出所有公共 API
- **src/cli.ts** - 命令行接口

### 推演预判引擎

- **src/simulation/command-parser.ts** - Shell 命令解析器
  - 支持管道、重定向、引号
  - 提取文件路径、网络目标
  - 识别危险命令模式

- **src/simulation/mental-simulation.ts** - 推演引擎
  - 在脑海中推演命令效果
  - 预测文件/网络/权限影响
  - 绝不真正执行命令

### 风险分析引擎

- **src/analysis/risk-analyzer.ts** - 风险分析器
  - 多维度风险评分 (0-100)
  - 危险命令模式匹配
  - 敏感路径检测
  - 上下文风险评估

### 决策引擎

- **src/decision/decision-engine.ts** - 决策引擎
  - 三级决策：放行/观察/拦截
  - 自动生成决策理由
  - 提供替代方案建议

### 执法记录仪

- **src/audit/body-camera.ts** - 审计日志系统
  - 全程记录所有操作
  - 数字签名防篡改
  - 支持查询和报告生成

## 设计理念

1. **师夷长技以制夷** - 学习 OpenClaw 的优秀设计
2. **推演预判** - 在脑海中推演，绝不真正执行
3. **手自一体** - 全自动 + 半自动 + 手动的三级决策
4. **执法记录** - 像 360/金山毒霸一样全程记录
5. **上下文感知** - 分析命令链，不孤立看待单个命令

## 扩展点

### 添加新的推演规则

在 `src/simulation/mental-simulation.ts` 中添加：

```typescript
private predictCustomEffects(parsed: ParsedCommand): PredictedEffect[] {
  // 你的自定义推演逻辑
}
```

### 添加新的风险因子

在 `src/analysis/risk-analyzer.ts` 中添加：

```typescript
private assessCustomRisk(simulation: SimulationResult): number {
  // 你的自定义风险分析
}
```

### 添加新的决策策略

在 `src/decision/decision-engine.ts` 中修改：

```typescript
private makeCustomDecision(...): Decision {
  // 你的自定义决策逻辑
}
```

## 测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- command-parser
npm test -- risk-analyzer
```

## 构建

```bash
# 开发模式
npm run dev

# 构建
npm run build

# 运行演示
npx tsx demo.ts
```
