/**
 * AI Guardian - AI Agent 数字孪生防御系统
 * 
 * 师夷长技以制夷 - 学习 OpenClaw 的优秀设计，构建 AI 安全防御系统
 * 
 * 核心理念：
 * - 推演预判：在脑海中推演命令效果，绝不真正执行危险命令
 * - 手自一体：全自动放行 + 半自动观察 + 手动拦截
 * - 执法记录仪：像 360/金山毒霸一样全程记录
 * - 上下文感知：分析命令链，不孤立看待单个命令
 */

// 核心类型
export * from './core/types.js';

// 主控制器
export { AIGuardian, aiGuardian } from './core/guardian.js';

// 推演引擎
export { MentalSimulationEngine, mentalSimulation } from './simulation/mental-simulation.js';
export { CommandParser, commandParser } from './simulation/command-parser.js';

// 风险分析
export { RiskAnalyzer, riskAnalyzer } from './analysis/risk-analyzer.js';
export { ObfuscationDetector, obfuscationDetector } from './analysis/obfuscation-detector.js';
export { OpenClawAnalyzer, openClawAnalyzer } from './analysis/openclaw-analyzer.js';
export type { ObfuscationResult, ObfuscationTechnique } from './analysis/obfuscation-detector.js';
export type { OpenClawAnalysis, OpenClawExecParams, OpenClawRiskIndicator } from './analysis/openclaw-analyzer.js';

// Skill Supply Chain
export { SkillSupplyChainAnalyzer, skillSupplyChainAnalyzer } from './analysis/skill-supply-chain.js';
export type { SkillManifest, SkillCodeAnalysis, SkillSupplyChainResult, DangerousPattern, SensitiveAPICall, ManifestRisk } from './analysis/skill-supply-chain.js';

// MCP Injection Detection
export { MCPInjectionDetector, mcpInjectionDetector } from './analysis/mcp-injection-detector.js';
export type { MCPConfig, MCPValidationResult, MCPValidationError, MCPValidationWarning, MCPInjectionCheck, EnvAuditResult } from './analysis/mcp-injection-detector.js';

// Prompt Injection Detection
export { PromptInjectionDetector, promptInjectionDetector } from './analysis/prompt-injection-detector.js';
export type { PromptInjectionResult, PromptInjectionType, URLPrefetchResult } from './analysis/prompt-injection-detector.js';

// i18n
export { i18n, t, format } from './i18n/index.js';
export type { Language, Translations } from './i18n/index.js';

// 决策引擎
export { DecisionEngine, decisionEngine } from './decision/decision-engine.js';

// 执法记录仪
export { BodyCamera, bodyCamera } from './audit/body-camera.js';

// Agent 检测器
export { AgentDetector, agentDetector } from './core/agent-detector.js';
export type { AgentType, AgentInfo, AgentFeatures, RequestContext } from './core/agent-detector.js';

// 急停按钮
export { EmergencyStopManager, emergencyStop } from './core/emergency-stop.js';
export type { EmergencyStopState, EmergencyStopHistory } from './core/emergency-stop.js';

// 环境感知
export { EnvironmentContext, environmentContext } from './core/environment-context.js';
export type { EnvironmentInfo, AdaptivePrompt } from './core/environment-context.js';

// 平台功能
export { StartupManager, startupManager } from './platform/startup-manager.js';
export type { StartupConfig } from './platform/startup-manager.js';
export { NotificationManager, notificationManager } from './platform/notification-manager.js';
export type { GuardianNotification, NotificationAction, NotificationResponse } from './platform/notification-manager.js';

// Web API (Legacy)
export { WebAPIServer, webAPIServer } from './web/api-server.js';
export type { PendingRequest, APIResponse } from './web/api-server.js';

// Web UI Server (New)
export { GuardianWebServer, guardianWebServer } from './web/server.js';
export type { PendingWebRequest, WebServerConfig, ChatMessage } from './web/server.js';

// Config
export { llmConfigManager } from './config/llm-config.js';
export type { ProviderConfig, LLMConfigFile } from './config/llm-config.js';

// LLM 提供商
export * from './llm/providers/index.js';

// 版本信息
export const VERSION = '0.1.0';
export const NAME = 'AI Guardian';
export const DESCRIPTION = 'AI Agent 数字孪生防御系统 - AI 界的 360/金山毒霸';

// 支持的云服务提供商
export { SUPPORTED_PROVIDERS, getAllProviders, getProviderInfo } from './llm/providers/index.js';
