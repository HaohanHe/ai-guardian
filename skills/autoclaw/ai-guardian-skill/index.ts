/**
 * AI Guardian Skill for AutoClaw
 * 
 * AutoClaw/OpenCode Skill 格式
 * 在 before_tool_call 中拦截所有工具调用
 */

import type { Skill, SkillContext, ToolCallEvent } from "@opencode/skill-sdk";

interface GuardianConfig {
  guardianUrl: string;
  guardianToken: string;
  alertThreshold: number;
  autoBlock: boolean;
}

const aiGuardianSkill: Skill = {
  id: "ai-guardian",
  name: "AI Guardian",
  description: "AI Agent 安全防御系统 - 实时监控、风险评估、自动阻断",
  version: "1.0.0",

  async activate(ctx: SkillContext) {
    const config: GuardianConfig = {
      guardianUrl: ctx.config.guardianUrl || "http://localhost:3456",
      guardianToken: ctx.config.guardianToken || "",
      alertThreshold: ctx.config.alertThreshold || 70,
      autoBlock: ctx.config.autoBlock !== false
    };

    ctx.logger.info("🛡️ AI Guardian Skill activated");
    ctx.logger.info(`   Threshold: ${config.alertThreshold}/100`);
    ctx.logger.info(`   Auto-block: ${config.autoBlock}`);

    // 注册 before_tool_call hook
    ctx.on("before_tool_call", async (event: ToolCallEvent) => {
      const { toolName, params } = event;

      // 只处理 exec 工具
      if (toolName !== "exec") {
        return { continue: true };
      }

      const command = params?.command;
      if (!command) {
        return { continue: true };
      }

      // 跳过安全命令
      if (isSafeCommand(command)) {
        return { continue: true };
      }

      ctx.logger.info(`[Guardian] Analyzing: ${command.substring(0, 50)}...`);

      // 调用 Guardian API
      const analysis = await analyzeCommand(command, config, ctx.logger);

      if (analysis.shouldBlock) {
        ctx.logger.error(`[Guardian] BLOCKED: ${command}`);
        ctx.logger.error(`[Guardian] Risk: ${analysis.riskScore}/100 - ${analysis.reason}`);

        if (config.autoBlock) {
          return {
            continue: false,
            error: `🚫 AI Guardian blocked this command (Risk: ${analysis.riskScore}/100)\nReason: ${analysis.reason}\nAlternatives: ${analysis.alternatives.join(", ")}`
          };
        }
      }

      if (analysis.riskScore >= 31) {
        ctx.logger.warn(`[Guardian] Medium risk (${analysis.riskScore}/100): ${command}`);
      }

      return { continue: true };
    });
  }
};

async function analyzeCommand(
  command: string,
  config: GuardianConfig,
  logger: any
): Promise<any> {
  try {
    const response = await fetch(`${config.guardianUrl}/api/evaluate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.guardianToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ command })
    });

    if (!response.ok) {
      return { riskScore: 0, shouldBlock: false };
    }

    const result = await response.json();
    return {
      riskScore: result.riskScore || 0,
      reason: result.reason || "Unknown",
      alternatives: result.alternatives || [],
      shouldBlock: result.decision === "deny" || result.riskScore >= config.alertThreshold
    };
  } catch (error) {
    logger.error(`[Guardian] API error: ${error}`);
    return { riskScore: 0, shouldBlock: false };
  }
}

function isSafeCommand(command: string): boolean {
  const safePatterns = [
    /^ls\s/i, /^dir\s/i, /^cd\s/i, /^pwd$/i,
    /^echo\s/i, /^cat\s/i, /^type\s/i,
    /^clear$/i, /^cls$/i, /^date$/i, /^time$/i,
    /^whoami$/i, /^hostname$/i,
    /^git\sstatus/i, /^git\slog/i, /^git\sdiff/i
  ];
  return safePatterns.some(p => p.test(command.trim()));
}

export default aiGuardianSkill;
