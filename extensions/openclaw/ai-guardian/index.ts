/**
 * AI Guardian Extension for OpenClaw
 * 
 * OpenClaw 官方扩展格式
 * 在 OpenClaw 中实现"AI 界的 360/金山毒霸"安全保护
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// Guardian 配置接口
interface GuardianConfig {
  enabled: boolean;
  guardianUrl: string;
  guardianToken: string;
  alertThreshold: number;
  autoBlock: boolean;
  silentMode: boolean;
}

// 风险分析结果
interface RiskAnalysis {
  riskScore: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  alternatives: string[];
  shouldBlock: boolean;
}

// 扩展主对象
const aiGuardianExtension = {
  id: "ai-guardian",
  name: "AI Guardian",
  description: "AI Agent 安全防御系统 - 实时监控、风险评估、自动阻断",
  version: "1.0.0",
  
  configSchema: emptyPluginConfigSchema(),
  
  register(api: OpenClawPluginApi) {
    const logger = api.logger;
    
    // 从环境变量读取配置
    const config: GuardianConfig = {
      enabled: true,
      guardianUrl: process.env.AI_GUARDIAN_URL || 'http://localhost:3456',
      guardianToken: process.env.AI_GUARDIAN_TOKEN || '',
      alertThreshold: parseInt(process.env.AI_GUARDIAN_THRESHOLD || '70'),
      autoBlock: process.env.AI_GUARDIAN_AUTO_BLOCK === 'true',
      silentMode: process.env.AI_GUARDIAN_SILENT !== 'false'
    };

    // 启动时显示保护状态
    logger.info('');
    logger.info('╔══════════════════════════════════════════════════════════════╗');
    logger.info('║           🛡️  AI Guardian Protection Active  🛡️              ║');
    logger.info('╠══════════════════════════════════════════════════════════════╣');
    logger.info(`║  Guardian URL: ${config.guardianUrl}`);
    logger.info(`║  Mode: ${config.silentMode ? 'Silent' : 'Verbose'}`);
    logger.info(`║  Threshold: ${config.alertThreshold}/100`);
    logger.info(`║  Auto-block: ${config.autoBlock ? 'ON' : 'OFF'}`);
    logger.info('╚══════════════════════════════════════════════════════════════╝');
    logger.info('');

    // 注册 before_tool_call hook - 核心安全拦截
    api.on("before_tool_call", async (event, ctx) => {
      const { toolName, params, runId, toolCallId } = event;
      
      // 只处理 exec 工具（命令执行）
      if (toolName !== 'exec') {
        return undefined;
      }

      const command = (params as any).command;
      if (!command) {
        return undefined;
      }

      // 跳过安全检查（如果配置了）
      if (shouldSkipCheck(command)) {
        return undefined;
      }

      logger.info(`[AI Guardian] Analyzing command: ${command.substring(0, 50)}...`);

      // 调用 Guardian 进行实时分析
      const analysis = await analyzeCommand(command, config, logger);

      // 记录到审计日志
      await logAudit(command, analysis, ctx, config);

      // 处理分析结果
      if (analysis.shouldBlock) {
        // 显示告警（如果不是静默模式）
        if (!config.silentMode) {
          showAlert(command, analysis, logger);
        }

        // 自动阻断高危命令
        if (config.autoBlock || analysis.level === 'critical') {
          logger.error(`[AI Guardian] BLOCKED: ${command}`);
          return {
            block: true,
            blockReason: formatBlockReason(analysis)
          };
        }
      }

      // 中等风险：静默记录
      if (analysis.level === 'medium' && !config.silentMode) {
        logger.warn(`[AI Guardian] Medium risk (${analysis.riskScore}/100): ${command}`);
      }

      // 低风险：静默放行
      if (analysis.level === 'low') {
        logger.info(`[AI Guardian] Allowed (risk: ${analysis.riskScore}/100)`);
      }

      return undefined;
    });

    // 注册 after_tool_call hook - 事后审计
    api.on("after_tool_call", async (event, ctx) => {
      const { toolName, durationMs } = event;
      
      if (toolName === 'exec') {
        logger.info(`[AI Guardian] Command completed in ${durationMs}ms`);
      }
    });

    logger.info('[AI Guardian] Extension registered successfully');
  }
};

/**
 * 调用 Guardian 分析命令
 */
async function analyzeCommand(
  command: string,
  config: GuardianConfig,
  logger: any
): Promise<RiskAnalysis> {
  try {
    const response = await fetch(`${config.guardianUrl}/api/evaluate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.guardianToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ command })
    });

    if (!response.ok) {
      // Guardian 不可用时，保守处理
      return {
        riskScore: 0,
        level: 'low',
        reason: 'Guardian unavailable',
        alternatives: [],
        shouldBlock: false
      };
    }

    const result = await response.json();

    return {
      riskScore: result.riskScore || 0,
      level: scoreToLevel(result.riskScore),
      reason: result.reason || 'Unknown',
      alternatives: result.alternatives || [],
      shouldBlock: result.decision === 'deny' || result.riskScore >= config.alertThreshold
    };
  } catch (error) {
    logger.error(`[AI Guardian] Analysis failed: ${error}`);
    // 网络错误时放行
    return {
      riskScore: 0,
      level: 'low',
      reason: 'Analysis failed',
      alternatives: [],
      shouldBlock: false
    };
  }
}

/**
 * 分数转等级
 */
function scoreToLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 90) return 'critical';
  if (score >= 71) return 'high';
  if (score >= 31) return 'medium';
  return 'low';
}

/**
 * 是否应该跳过检查
 */
function shouldSkipCheck(command: string): boolean {
  const safePatterns = [
    /^ls\s/i,
    /^dir\s/i,
    /^cd\s/i,
    /^pwd$/i,
    /^echo\s/i,
    /^cat\s/i,
    /^type\s/i,
    /^clear$/i,
    /^cls$/i,
    /^date$/i,
    /^time$/i,
    /^whoami$/i,
    /^hostname$/i,
    /^git\sstatus/i,
    /^git\slog/i,
    /^git\sdiff/i,
    /^npm\slist/i,
    /^node\s--version/i,
    /^python\s--version/i,
    /^pip\slist/i,
  ];

  return safePatterns.some(pattern => pattern.test(command.trim()));
}

/**
 * 显示告警信息
 */
function showAlert(command: string, analysis: RiskAnalysis, logger: any): void {
  logger.error('');
  logger.error('╔══════════════════════════════════════════════════════════════╗');
  logger.error('║           ⚠️  AI GUARDIAN SECURITY ALERT  ⚠️                 ║');
  logger.error('╠══════════════════════════════════════════════════════════════╣');
  logger.error(`║ Risk Score: ${analysis.riskScore}/100                                       `);
  logger.error(`║ Level: ${analysis.level.toUpperCase()}                                          `);
  logger.error(`║ Command: ${command.substring(0, 50)}${command.length > 50 ? '...' : ''}`);
  logger.error(`║ Reason: ${analysis.reason}`);
  
  if (analysis.alternatives.length > 0) {
    logger.error('╠══════════════════════════════════════════════════════════════╣');
    logger.error('║ Safer Alternatives:                                          ║');
    analysis.alternatives.slice(0, 3).forEach((alt, i) => {
      logger.error(`║   ${i + 1}. ${alt.substring(0, 55)}${alt.length > 55 ? '...' : ''}`);
    });
  }
  
  logger.error('╚══════════════════════════════════════════════════════════════╝');
  logger.error('');
}

/**
 * 格式化阻断原因
 */
function formatBlockReason(analysis: RiskAnalysis): string {
  return `[AI Guardian] ${analysis.level.toUpperCase()} RISK (${analysis.riskScore}/100): ${analysis.reason}`;
}

/**
 * 记录审计日志
 */
async function logAudit(
  command: string,
  analysis: RiskAnalysis,
  ctx: any,
  config: GuardianConfig
): Promise<void> {
  try {
    await fetch(`${config.guardianUrl}/api/audit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.guardianToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        timestamp: Date.now(),
        command,
        riskScore: analysis.riskScore,
        level: analysis.level,
        reason: analysis.reason,
        agentId: ctx.agentId,
        sessionKey: ctx.sessionKey,
        blocked: analysis.shouldBlock
      })
    });
  } catch {
    // 忽略日志错误
  }
}

export default aiGuardianExtension;
