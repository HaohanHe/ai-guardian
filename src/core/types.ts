/**
 * AI Guardian - 核心类型定义
 * 
 * 师夷长技以制夷 - 学习 OpenClaw 的优秀设计
 */

// 命令执行环境
export type ExecHost = 'sandbox' | 'gateway' | 'node';

// 安全级别
export type SecurityLevel = 'deny' | 'allowlist' | 'full';

// 决策结果
export type DecisionAction = 'allow' | 'observe' | 'deny';

// 风险评分 (0-100)
export type RiskScore = number;

// 工具类型
export type ToolType = 'exec' | 'browser' | 'read' | 'write' | 'edit' | 'message' | 'unknown';

/**
 * MCP 工具调用请求
 */
export interface ToolRequest {
  id: string;
  toolName: string;
  params: Record<string, unknown>;
  timestamp: number;
  sessionId: string;
  agentId?: string;
}

/**
 * 命令执行参数
 */
export interface ExecParams {
  command: string;
  host?: ExecHost;
  security?: SecurityLevel;
  elevated?: boolean;
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

/**
 * 浏览器操作参数
 */
export interface BrowserParams {
  action: 'screenshot' | 'click' | 'navigate' | 'type' | 'scroll';
  url?: string;
  selector?: string;
  text?: string;
  fullPage?: boolean;
}

/**
 * 文件操作参数
 */
export interface FileParams {
  path: string;
  content?: string;
  encoding?: string;
}

/**
 * 推演结果
 */
export interface SimulationResult {
  command: string;
  predictedEffects: PredictedEffect[];
  riskIndicators: RiskIndicator[];
  metadata: SimulationMetadata;
}

/**
 * 预测效果
 */
export interface PredictedEffect {
  type: 'file_create' | 'file_modify' | 'file_delete' | 'network_request' | 'permission_change' | 'process_spawn';
  target: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 风险指标
 */
export interface RiskIndicator {
  category: 'command_type' | 'permission_escalation' | 'data_exfiltration' | 'persistence' | 'network' | 'context';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string[];
}

/**
 * 推演元数据
 */
export interface SimulationMetadata {
  parsedCommands: ParsedCommand[];
  environmentVariables: string[];
  networkTargets: string[];
  filePaths: string[];
  duration: number;
}

/**
 * 解析后的命令
 */
export interface ParsedCommand {
  raw: string;
  command: string;
  args: string[];
  pipes?: ParsedCommand[];
  redirects?: Redirect[];
}

/**
 * 重定向
 */
export interface Redirect {
  type: '>' | '>>' | '<' | '2>' | '2>>';
  target: string;
}

/**
 * 风险分析结果
 */
export interface RiskAnalysis {
  score: RiskScore;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  recommendations: string[];
}

/**
 * 风险因子
 */
export interface RiskFactor {
  name: string;
  weight: number;
  contribution: number;
  description: string;
}

/**
 * 决策结果
 */
export interface Decision {
  action: DecisionAction;
  reason: string;
  riskAnalysis: RiskAnalysis;
  alternatives?: string[];
  requiresConfirmation?: boolean;
}

/**
 * 审计日志条目
 */
export interface AuditLogEntry {
  id: string;
  timestamp: number;
  sessionId: string;
  agentId?: string;
  toolName: string;
  params: Record<string, unknown>;
  decision: Decision;
  simulationResult?: SimulationResult;
  context: CommandContext;
}

/**
 * 命令上下文
 */
export interface CommandContext {
  workingDirectory: string;
  environmentVariables: Record<string, string>;
  commandHistory: string[];
  recentOperations: RecentOperation[];
}

/**
 * 最近操作
 */
export interface RecentOperation {
  timestamp: number;
  toolName: string;
  description: string;
  riskScore: RiskScore;
}

/**
 * LLM 分析结果
 */
export interface LLMAnalysis {
  intent: string;
  hiddenRisks: string[];
  commandChainAnalysis?: string;
  contextualRisk?: string;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 *  Guardian 配置
 */
export interface GuardianConfig {
  // MCP 拦截配置
  mcp: {
    port: number;
    host: string;
    targetEndpoint: string;
  };
  
  // 决策阈值
  thresholds: {
    allow: number;    // 0-30
    observe: number;  // 31-70
    deny: number;     // 71-100
  };
  
  // LLM 配置
  llm: {
    provider: 'mimoflash' | 'ollama' | 'openai';
    apiKey?: string;
    baseUrl?: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  
  // 审计配置
  audit: {
    logPath: string;
    maxFileSize: number;
    retentionDays: number;
    remoteBackup?: {
      enabled: boolean;
      endpoint: string;
      apiKey: string;
    };
  };
  
  // 敏感路径
  sensitivePaths: string[];
  
  // 危险命令模式
  dangerousPatterns: string[];
}

/**
 * 攻击链模式
 */
export interface AttackChainPattern {
  name: string;
  description: string;
  stages: AttackStage[];
  severity: 'medium' | 'high' | 'critical';
}

/**
 * 攻击阶段
 */
export interface AttackStage {
  order: number;
  patterns: string[];
  description: string;
}
