/**
 * OpenClaw 特定参数分析器
 * 
 * 深度分析 OpenClaw 特有的 exec 参数和配置
 * 检测 elevated mode、security settings 等危险配置
 */

import type { ParsedCommand } from '../core/types.js';

export interface OpenClawAnalysis {
  isOpenClawCommand: boolean;
  params: OpenClawExecParams;
  riskIndicators: OpenClawRiskIndicator[];
  riskScore: number;
  recommendations: string[];
}

export interface OpenClawExecParams {
  elevated?: 'on' | 'ask' | 'full' | 'off';
  security?: 'deny' | 'allowlist' | 'full';
  ask?: 'off' | 'on-miss' | 'always';
  host?: 'sandbox' | 'gateway' | string;
  node?: string;
  autoAllowSkills?: boolean;
}

export interface OpenClawRiskIndicator {
  type: 'elevated' | 'security' | 'ask' | 'host' | 'skills' | 'mcp';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  param: string;
  value: string | boolean;
}

/**
 * OpenClaw 分析器类
 */
export class OpenClawAnalyzer {
  /**
   * 分析命令中的 OpenClaw 特定参数
   */
  analyze(command: string, _parsed?: ParsedCommand): OpenClawAnalysis {
    const params = this.extractParams(command);
    const riskIndicators: OpenClawRiskIndicator[] = [];
    let riskScore = 0;

    // 1. 分析 elevated 参数
    if (params.elevated) {
      const elevatedRisk = this.analyzeElevated(params.elevated);
      riskIndicators.push(...elevatedRisk.indicators);
      riskScore += elevatedRisk.score;
    }

    // 2. 分析 security 参数
    if (params.security) {
      const securityRisk = this.analyzeSecurity(params.security);
      riskIndicators.push(...securityRisk.indicators);
      riskScore += securityRisk.score;
    }

    // 3. 分析 ask 参数
    if (params.ask) {
      const askRisk = this.analyzeAsk(params.ask);
      riskIndicators.push(...askRisk.indicators);
      riskScore += askRisk.score;
    }

    // 4. 分析 host 参数
    if (params.host) {
      const hostRisk = this.analyzeHost(params.host);
      riskIndicators.push(...hostRisk.indicators);
      riskScore += hostRisk.score;
    }

    // 5. 分析 autoAllowSkills 参数
    if (params.autoAllowSkills !== undefined) {
      const skillsRisk = this.analyzeAutoAllowSkills(params.autoAllowSkills);
      riskIndicators.push(...skillsRisk.indicators);
      riskScore += skillsRisk.score;
    }

    // 6. 检测 MCP 配置注入
    const mcpRisk = this.analyzeMCPInjection(command);
    if (mcpRisk.indicators.length > 0) {
      riskIndicators.push(...mcpRisk.indicators);
      riskScore += mcpRisk.score;
    }

    // 7. 组合风险分析
    const combinedRisk = this.analyzeCombinationRisk(params);
    if (combinedRisk.score > 0) {
      riskIndicators.push(...combinedRisk.indicators);
      riskScore += combinedRisk.score;
    }

    // 生成建议
    const recommendations = this.generateRecommendations(params, riskIndicators);

    return {
      isOpenClawCommand: this.isOpenClawCommand(command, params),
      params,
      riskIndicators,
      riskScore: Math.min(100, riskScore),
      recommendations
    };
  }

  /**
   * 提取 OpenClaw 参数
   */
  private extractParams(command: string): OpenClawExecParams {
    const params: OpenClawExecParams = {};

    // 使用正则表达式提取参数
    const patterns = [
      { key: 'elevated', regex: /elevated=(\w+)/i },
      { key: 'security', regex: /security=(\w+)/i },
      { key: 'ask', regex: /ask=(\w+-?\w*)/i },
      { key: 'host', regex: /host=(\w+)/i },
      { key: 'node', regex: /node=([\w-]+)/i },
      { key: 'autoAllowSkills', regex: /autoAllowSkills=(true|false)/i }
    ];

    for (const { key, regex } of patterns) {
      const match = command.match(regex);
      if (match) {
        const value = match[1];
        switch (key) {
          case 'elevated':
            params.elevated = value as OpenClawExecParams['elevated'];
            break;
          case 'security':
            params.security = value as OpenClawExecParams['security'];
            break;
          case 'ask':
            params.ask = value as OpenClawExecParams['ask'];
            break;
          case 'host':
            params.host = value;
            break;
          case 'node':
            params.node = value;
            break;
          case 'autoAllowSkills':
            params.autoAllowSkills = value === 'true';
            break;
        }
      }
    }

    return params;
  }

  /**
   * 分析 elevated 参数
   */
  private analyzeElevated(elevated: string): { indicators: OpenClawRiskIndicator[]; score: number } {
    const indicators: OpenClawRiskIndicator[] = [];
    let score = 0;

    switch (elevated) {
      case 'full':
        indicators.push({
          type: 'elevated',
          severity: 'critical',
          description: 'elevated=full 完全绕过 exec 审批系统，命令将自动执行',
          param: 'elevated',
          value: 'full'
        });
        score = 100;
        break;
      case 'on':
      case 'ask':
        indicators.push({
          type: 'elevated',
          severity: 'high',
          description: 'elevated=on/ask 在网关主机上执行，保持审批',
          param: 'elevated',
          value: elevated
        });
        score = 60;
        break;
      case 'off':
        indicators.push({
          type: 'elevated',
          severity: 'low',
          description: 'elevated=off 禁用提升模式',
          param: 'elevated',
          value: 'off'
        });
        score = 0;
        break;
    }

    return { indicators, score };
  }

  /**
   * 分析 security 参数
   */
  private analyzeSecurity(security: string): { indicators: OpenClawRiskIndicator[]; score: number } {
    const indicators: OpenClawRiskIndicator[] = [];
    let score = 0;

    switch (security) {
      case 'full':
        indicators.push({
          type: 'security',
          severity: 'critical',
          description: 'security=full 允许执行任意命令，无白名单限制',
          param: 'security',
          value: 'full'
        });
        score = 90;
        break;
      case 'allowlist':
        indicators.push({
          type: 'security',
          severity: 'medium',
          description: 'security=allowlist 仅允许白名单中的命令',
          param: 'security',
          value: 'allowlist'
        });
        score = 30;
        break;
      case 'deny':
        indicators.push({
          type: 'security',
          severity: 'low',
          description: 'security=deny 完全禁止命令执行',
          param: 'security',
          value: 'deny'
        });
        score = 0;
        break;
    }

    return { indicators, score };
  }

  /**
   * 分析 ask 参数
   */
  private analyzeAsk(ask: string): { indicators: OpenClawRiskIndicator[]; score: number } {
    const indicators: OpenClawRiskIndicator[] = [];
    let score = 0;

    switch (ask) {
      case 'off':
        indicators.push({
          type: 'ask',
          severity: 'high',
          description: 'ask=off 执行前不询问确认',
          param: 'ask',
          value: 'off'
        });
        score = 70;
        break;
      case 'on-miss':
        indicators.push({
          type: 'ask',
          severity: 'medium',
          description: 'ask=on-miss 白名单未命中时询问',
          param: 'ask',
          value: 'on-miss'
        });
        score = 40;
        break;
      case 'always':
        indicators.push({
          type: 'ask',
          severity: 'low',
          description: 'ask=always 总是询问确认',
          param: 'ask',
          value: 'always'
        });
        score = 10;
        break;
    }

    return { indicators, score };
  }

  /**
   * 分析 host 参数
   */
  private analyzeHost(host: string): { indicators: OpenClawRiskIndicator[]; score: number } {
    const indicators: OpenClawRiskIndicator[] = [];
    let score = 0;

    if (host === 'gateway') {
      indicators.push({
        type: 'host',
        severity: 'high',
        description: 'host=gateway 在网关主机上直接执行，绕过沙箱保护',
        param: 'host',
        value: 'gateway'
      });
      score = 60;
    } else if (host === 'sandbox') {
      indicators.push({
        type: 'host',
        severity: 'low',
        description: 'host=sandbox 在 Docker 沙箱中执行',
        param: 'host',
        value: 'sandbox'
      });
      score = 10;
    } else {
      indicators.push({
        type: 'host',
        severity: 'medium',
        description: `host=${host} 在指定节点执行`,
        param: 'host',
        value: host
      });
      score = 40;
    }

    return { indicators, score };
  }

  /**
   * 分析 autoAllowSkills 参数
   */
  private analyzeAutoAllowSkills(autoAllow: boolean): { indicators: OpenClawRiskIndicator[]; score: number } {
    const indicators: OpenClawRiskIndicator[] = [];

    if (autoAllow) {
      indicators.push({
        type: 'skills',
        severity: 'critical',
        description: 'autoAllowSkills=true 自动允许技能二进制执行，存在供应链攻击风险',
        param: 'autoAllowSkills',
        value: true
      });
      return { indicators, score: 80 };
    } else {
      indicators.push({
        type: 'skills',
        severity: 'low',
        description: 'autoAllowSkills=false 需要显式批准技能执行',
        param: 'autoAllowSkills',
        value: false
      });
      return { indicators, score: 0 };
    }
  }

  /**
   * 分析 MCP 配置注入
   */
  private analyzeMCPInjection(command: string): { indicators: OpenClawRiskIndicator[]; score: number } {
    const indicators: OpenClawRiskIndicator[] = [];
    let score = 0;

    // 检测 MCP 服务器配置
    const mcpPatterns = [
      {
        pattern: /mcpServers\s*[=:]/i,
        description: '检测到 MCP 服务器配置'
      },
      {
        pattern: /"mcpServers"\s*:/,
        description: 'JSON 格式的 MCP 配置'
      },
      {
        pattern: /session\/new|session\/load/i,
        description: 'MCP 会话操作'
      }
    ];

    for (const { pattern, description } of mcpPatterns) {
      if (pattern.test(command)) {
        indicators.push({
          type: 'mcp',
          severity: 'medium',
          description,
          param: 'mcp',
          value: 'detected'
        });
        score += 30;
      }
    }

    // 检测可疑的 MCP 命令
    const suspiciousMCPCommands = [
      { pattern: /curl.*\|.*bash/i, desc: 'MCP 配置中包含管道到 shell' },
      { pattern: /eval\s*\(/i, desc: 'MCP 配置中包含 eval' },
      { pattern: /child_process/i, desc: 'MCP 配置中使用 child_process' },
      { pattern: /fs\.unlink|fs\.rmdir/i, desc: 'MCP 配置中包含文件删除' }
    ];

    for (const { pattern, desc } of suspiciousMCPCommands) {
      if (pattern.test(command)) {
        indicators.push({
          type: 'mcp',
          severity: 'high',
          description: desc,
          param: 'mcp',
          value: 'suspicious'
        });
        score += 40;
      }
    }

    return { indicators, score };
  }

  /**
   * 分析组合风险
   */
  private analyzeCombinationRisk(params: OpenClawExecParams): { indicators: OpenClawRiskIndicator[]; score: number } {
    const indicators: OpenClawRiskIndicator[] = [];
    let score = 0;

    // 检测最危险的组合
    if (params.elevated === 'full' && params.security === 'full') {
      indicators.push({
        type: 'elevated',
        severity: 'critical',
        description: '致命组合：elevated=full + security=full，完全绕过所有安全控制',
        param: 'combination',
        value: 'elevated=full,security=full'
      });
      score += 100;
    }

    if (params.elevated === 'full' && params.ask === 'off') {
      indicators.push({
        type: 'elevated',
        severity: 'critical',
        description: '高危组合：elevated=full + ask=off，自动执行无确认',
        param: 'combination',
        value: 'elevated=full,ask=off'
      });
      score += 50;
    }

    if (params.host === 'gateway' && params.security === 'full') {
      indicators.push({
        type: 'host',
        severity: 'critical',
        description: '高危组合：host=gateway + security=full，在主机上执行任意命令',
        param: 'combination',
        value: 'host=gateway,security=full'
      });
      score += 70;
    }

    if (params.autoAllowSkills && params.elevated === 'full') {
      indicators.push({
        type: 'skills',
        severity: 'critical',
        description: '高危组合：autoAllowSkills=true + elevated=full，技能自动执行',
        param: 'combination',
        value: 'autoAllowSkills=true,elevated=full'
      });
      score += 60;
    }

    return { indicators, score };
  }

  /**
   * 生成建议
   */
  private generateRecommendations(
    params: OpenClawExecParams, 
    indicators: OpenClawRiskIndicator[]
  ): string[] {
    const recommendations: string[] = [];

    // 基于风险指标生成建议
    const hasCritical = indicators.some(i => i.severity === 'critical');
    const hasHigh = indicators.some(i => i.severity === 'high');

    if (hasCritical) {
      recommendations.push('🚨 检测到关键安全风险，建议立即拦截');
      recommendations.push('🔒 请审查 OpenClaw 配置，避免使用 elevated=full 和 security=full');
    } else if (hasHigh) {
      recommendations.push('⚠️ 检测到高风险配置，建议谨慎处理');
      recommendations.push('🔍 请确认这些参数设置是否符合预期');
    }

    // 针对具体参数的建议
    if (params.elevated === 'full') {
      recommendations.push('💡 建议：使用 elevated=ask 替代 elevated=full');
    }

    if (params.security === 'full') {
      recommendations.push('💡 建议：使用 security=allowlist 限制可执行命令');
    }

    if (params.ask === 'off') {
      recommendations.push('💡 建议：启用 ask=always 确保执行前确认');
    }

    if (params.host === 'gateway') {
      recommendations.push('💡 建议：使用 host=sandbox 在隔离环境中执行');
    }

    if (params.autoAllowSkills) {
      recommendations.push('💡 建议：禁用 autoAllowSkills，手动审核技能');
    }

    return recommendations;
  }

  /**
   * 判断是否是 OpenClaw 命令
   */
  private isOpenClawCommand(command: string, params: OpenClawExecParams): boolean {
    // 检查是否包含 OpenClaw 特有参数
    const hasOpenClawParams = 
      params.elevated !== undefined ||
      params.security !== undefined ||
      params.ask !== undefined ||
      params.host !== undefined ||
      params.autoAllowSkills !== undefined;

    // 检查命令中是否包含 OpenClaw 特有标识
    const openClawIndicators = [
      /openclaw/i,
      /clawbot/i,
      /moltbot/i,
      /exec\s+\w+=\w+/  // OpenClaw 特有的 exec 参数格式
    ];

    const hasIndicator = openClawIndicators.some(pattern => pattern.test(command));

    return hasOpenClawParams || hasIndicator;
  }

  /**
   * 解析 exec-approvals 配置
   */
  parseExecApprovals(config: string): { isValid: boolean; risks: string[] } {
    const risks: string[] = [];

    try {
      const parsed = JSON.parse(config);

      // 检查 defaults
      if (parsed.defaults) {
        if (parsed.defaults.security === 'full') {
          risks.push('默认安全级别为 full，允许任意命令');
        }
        if (parsed.defaults.ask === 'off') {
          risks.push('默认不询问确认');
        }
        if (parsed.defaults.autoAllowSkills === true) {
          risks.push('默认自动允许技能执行');
        }
      }

      // 检查 agents 配置
      if (parsed.agents) {
        for (const [agent, config] of Object.entries(parsed.agents)) {
          const agentConfig = config as { security?: string; ask?: string; autoAllowSkills?: boolean };
          if (agentConfig.security === 'full') {
            risks.push(`Agent ${agent} 配置了 security=full`);
          }
          if (agentConfig.autoAllowSkills === true) {
            risks.push(`Agent ${agent} 配置了 autoAllowSkills=true`);
          }
        }
      }

      return { isValid: true, risks };
    } catch {
      return { isValid: false, risks: ['配置文件格式错误'] };
    }
  }

  /**
   * 生成安全加固建议
   */
  generateHardeningConfig(): string {
    return JSON.stringify({
      version: 1,
      defaults: {
        security: 'allowlist',
        ask: 'always',
        autoAllowSkills: false
      },
      agents: {
        '*': {
          security: 'allowlist',
          ask: 'always',
          allowlist: [
            { pattern: '/usr/bin/ls' },
            { pattern: '/bin/cat' },
            { pattern: '/usr/bin/git' }
          ]
        }
      }
    }, null, 2);
  }
}

// 导出单例
export const openClawAnalyzer = new OpenClawAnalyzer();
