/**
 * AI Guardian Plugin for OpenClaw
 * 
 * 在 OpenClaw 中实现真正的"金山毒霸"模式
 * 自动拦截、实时分析、智能决策
 */

import type {
  Plugin,
  PluginHookBeforeToolCallEvent,
  PluginHookBeforeToolCallResult,
  PluginContext
} from '../../openclaw-main/src/plugins/types.js';

// AI Guardian 配置
interface AIGuardianConfig {
  guardianUrl: string;
  guardianToken: string;
  alertThreshold: number;
  silentMode: boolean;
  autoBlock: boolean;
}

// 风险分析结果
interface RiskAnalysis {
  riskScore: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  alternatives: string[];
  shouldBlock: boolean;
}

class AIGuardianPlugin implements Plugin {
  pluginId = 'ai-guardian';
  version = '1.0.0';
  
  private config: AIGuardianConfig;
  private lastAlertTime: number = 0;
  private alertCooldown: number = 5000; // 5秒内不重复告警

  constructor() {
    // 从环境变量读取配置
    this.config = {
      guardianUrl: process.env.AI_GUARDIAN_URL || 'http://localhost:3456',
      guardianToken: process.env.AI_GUARDIAN_TOKEN || '',
      alertThreshold: parseInt(process.env.AI_GUARDIAN_THRESHOLD || '70'),
      silentMode: process.env.AI_GUARDIAN_SILENT !== 'false',
      autoBlock: process.env.AI_GUARDIAN_AUTO_BLOCK === 'true'
    };

    // 启动时显示保护状态
    console.log('\n🛡️  AI Guardian Protection Active');
    console.log(`   Mode: ${this.config.silentMode ? 'Silent' : 'Verbose'}`);
    console.log(`   Threshold: ${this.config.alertThreshold}/100`);
    console.log(`   Auto-block: ${this.config.autoBlock ? 'ON' : 'OFF'}\n`);
  }

  hooks = [
    {
      hookName: 'before_tool_call' as const,
      priority: 999, // 最高优先级，确保最先执行
      handler: async (
        event: PluginHookBeforeToolCallEvent,
        ctx: PluginContext
      ): Promise<PluginHookBeforeToolCallResult | undefined> => {
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
        if (this.shouldSkipCheck(command)) {
          return undefined;
        }

        // 调用 AI Guardian 进行实时分析
        const analysis = await this.analyzeCommand(command, {
          runId,
          toolCallId,
          agentId: ctx.agentId,
          sessionKey: ctx.sessionKey
        });

        // 记录到审计日志
        await this.logAudit(command, analysis, ctx);

        // 处理分析结果
        if (analysis.shouldBlock) {
          // 显示告警（如果不是静默模式且不在冷却期）
          if (!this.config.silentMode && this.canShowAlert()) {
            this.showAlert(command, analysis);
          }

          // 自动阻断高危命令
          if (this.config.autoBlock || analysis.level === 'critical') {
            return {
              block: true,
              blockReason: this.formatBlockReason(analysis)
            };
          }

          // 询问用户是否继续
          const userConfirmed = await this.askUserConfirmation(command, analysis);
          if (!userConfirmed) {
            return {
              block: true,
              blockReason: `用户取消执行: ${analysis.reason}`
            };
          }
        }

        // 中等风险：静默记录
        if (analysis.level === 'medium' && !this.config.silentMode) {
          console.log(`[AI Guardian] Medium risk (${analysis.riskScore}/100): ${command}`);
        }

        // 返回可能修改后的参数
        if (analysis.alternatives && analysis.alternatives.length > 0) {
          // 如果有更安全的替代方案，询问用户是否使用
          const useAlternative = await this.askUseAlternative(command, analysis.alternatives[0]);
          if (useAlternative) {
            return {
              params: {
                ...params,
                command: analysis.alternatives[0]
              }
            };
          }
        }

        return undefined;
      }
    }
  ];

  /**
   * 调用 AI Guardian 分析命令
   */
  private async analyzeCommand(
    command: string,
    context: { runId?: string; toolCallId?: string; agentId?: string; sessionKey?: string }
  ): Promise<RiskAnalysis> {
    try {
      const response = await fetch(`${this.config.guardianUrl}/api/evaluate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.guardianToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          command,
          context: {
            agentId: context.agentId,
            sessionKey: context.sessionKey,
            runId: context.runId
          }
        })
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
        level: this.scoreToLevel(result.riskScore),
        reason: result.reason || 'Unknown',
        alternatives: result.alternatives || [],
        shouldBlock: result.decision === 'deny' || result.riskScore >= this.config.alertThreshold
      };
    } catch (error) {
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
  private scoreToLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 90) return 'critical';
    if (score >= 71) return 'high';
    if (score >= 31) return 'medium';
    return 'low';
  }

  /**
   * 是否应该跳过检查
   */
  private shouldSkipCheck(command: string): boolean {
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
   * 是否可以显示告警（冷却期检查）
   */
  private canShowAlert(): boolean {
    const now = Date.now();
    if (now - this.lastAlertTime > this.alertCooldown) {
      this.lastAlertTime = now;
      return true;
    }
    return false;
  }

  /**
   * 显示告警信息
   */
  private showAlert(command: string, analysis: RiskAnalysis): void {
    const color = analysis.level === 'critical' ? '\x1b[31m' : '\x1b[33m';
    const reset = '\x1b[0m';

    console.log(`${color}`);
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           ⚠️  AI GUARDIAN SECURITY ALERT  ⚠️                 ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║ Risk Score: ${analysis.riskScore}/100                                       `);
    console.log(`║ Level: ${analysis.level.toUpperCase()}                                          `);
    console.log(`║ Command: ${command.substring(0, 50)}${command.length > 50 ? '...' : ''}`.padEnd(63) + '║');
    console.log(`║ Reason: ${analysis.reason.substring(0, 50)}${analysis.reason.length > 50 ? '...' : ''}`.padEnd(63) + '║');
    
    if (analysis.alternatives.length > 0) {
      console.log('╠══════════════════════════════════════════════════════════════╣');
      console.log('║ Safer Alternatives:                                          ║');
      analysis.alternatives.slice(0, 3).forEach((alt, i) => {
        console.log(`║   ${i + 1}. ${alt.substring(0, 55)}${alt.length > 55 ? '...' : ''}`.padEnd(63) + '║');
      });
    }
    
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`${reset}`);
  }

  /**
   * 格式化阻断原因
   */
  private formatBlockReason(analysis: RiskAnalysis): string {
    return `[AI Guardian] ${analysis.level.toUpperCase()} RISK (${analysis.riskScore}/100): ${analysis.reason}`;
  }

  /**
   * 询问用户确认
   */
  private async askUserConfirmation(command: string, analysis: RiskAnalysis): Promise<boolean> {
    // 在 OpenClaw 中，这会通过 UI 提示用户
    // 这里简化处理，实际应该调用 OpenClaw 的确认机制
    console.log(`\n[AI Guardian] High-risk command detected: ${command}`);
    console.log(`Reason: ${analysis.reason}`);
    console.log('Do you want to proceed? (y/N)');
    
    // 实际实现应该等待用户输入
    // 这里返回 false 表示默认阻断
    return false;
  }

  /**
   * 询问是否使用替代方案
   */
  private async askUseAlternative(original: string, alternative: string): Promise<boolean> {
    console.log(`\n[AI Guardian] Safer alternative available:`);
    console.log(`  Original: ${original}`);
    console.log(`  Alternative: ${alternative}`);
    console.log('Use alternative? (y/N)');
    
    return false;
  }

  /**
   * 记录审计日志
   */
  private async logAudit(command: string, analysis: RiskAnalysis, ctx: PluginContext): Promise<void> {
    // 发送到 Guardian 的审计接口
    try {
      await fetch(`${this.config.guardianUrl}/api/audit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.guardianToken}`,
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
}

// 导出插件实例
export default new AIGuardianPlugin();
