/**
 * 手自一体决策引擎 - Auto-Manual Decision Engine
 * 
 * 三级决策机制：
 * - 全自动放行 (0-30分)
 * - 半自动观察 (31-70分)  
 * - 手动拦截 (71-100分)
 */

import type { 
  Decision, 
  RiskAnalysis, 
  SimulationResult,
  DecisionAction,
  CommandContext 
} from '../core/types.js';

/**
 * 决策阈值配置
 */
interface DecisionThresholds {
  allow: number;    // 自动放行阈值 (默认30)
  observe: number;  // 观察模式阈值 (默认70)
  deny: number;     // 拦截阈值 (默认100)
}

/**
 * 决策引擎类
 */
export class DecisionEngine {
  private thresholds: DecisionThresholds;

  constructor(thresholds?: Partial<DecisionThresholds>) {
    this.thresholds = {
      allow: 30,
      observe: 70,
      deny: 100,
      ...thresholds
    };
  }

  /**
   * 做出决策
   * 
   * 核心方法：根据风险评分决定是放行、观察还是拦截
   */
  decide(
    riskAnalysis: RiskAnalysis,
    simulation: SimulationResult,
    context?: CommandContext
  ): Decision {
    const score = riskAnalysis.score;
    
    // 1. 全自动放行 (0-30分)
    if (score <= this.thresholds.allow) {
      return this.makeAllowDecision(riskAnalysis, simulation);
    }
    
    // 2. 半自动观察 (31-70分)
    if (score <= this.thresholds.observe) {
      return this.makeObserveDecision(riskAnalysis, simulation, context);
    }
    
    // 3. 手动拦截 (71-100分)
    return this.makeDenyDecision(riskAnalysis, simulation);
  }

  /**
   * 全自动放行决策
   */
  private makeAllowDecision(
    riskAnalysis: RiskAnalysis,
    simulation: SimulationResult
  ): Decision {
    return {
      action: 'allow' as DecisionAction,
      reason: this.generateAllowReason(riskAnalysis),
      riskAnalysis,
      alternatives: this.generateAlternatives(simulation, 'allow'),
      requiresConfirmation: false
    };
  }

  /**
   * 半自动观察决策
   */
  private makeObserveDecision(
    riskAnalysis: RiskAnalysis,
    simulation: SimulationResult,
    context?: CommandContext
  ): Decision {
    const enhancedMonitoring = this.shouldEnhanceMonitoring(riskAnalysis, context);
    
    return {
      action: 'observe' as DecisionAction,
      reason: this.generateObserveReason(riskAnalysis, enhancedMonitoring),
      riskAnalysis,
      alternatives: this.generateAlternatives(simulation, 'observe'),
      requiresConfirmation: false  // 观察模式不需要确认，但会增强监控
    };
  }

  /**
   * 手动拦截决策
   */
  private makeDenyDecision(
    riskAnalysis: RiskAnalysis,
    simulation: SimulationResult
  ): Decision {
    return {
      action: 'deny' as DecisionAction,
      reason: this.generateDenyReason(riskAnalysis),
      riskAnalysis,
      alternatives: this.generateAlternatives(simulation, 'deny'),
      requiresConfirmation: true  // 拦截需要人工确认
    };
  }

  /**
   * 生成放行理由
   */
  private generateAllowReason(riskAnalysis: RiskAnalysis): string {
    const reasons: string[] = [
      `✅ 风险评分 ${riskAnalysis.score} 分，处于低风险区间 (0-${this.thresholds.allow})`
    ];
    
    // 添加主要风险因子说明
    const significantFactors = riskAnalysis.factors.filter(
      f => f.contribution > 5
    );
    
    if (significantFactors.length === 0) {
      reasons.push('📊 未发现显著风险因子');
    } else {
      reasons.push('📊 风险因子分析：');
      for (const factor of significantFactors) {
        reasons.push(`   • ${factor.name}: ${factor.description}`);
      }
    }
    
    return reasons.join('\n');
  }

  /**
   * 生成观察理由
   */
  private generateObserveReason(
    riskAnalysis: RiskAnalysis,
    enhancedMonitoring: boolean
  ): string {
    const reasons: string[] = [
      `⚡ 风险评分 ${riskAnalysis.score} 分，处于中风险区间 (${this.thresholds.allow + 1}-${this.thresholds.observe})`
    ];
    
    // 添加主要风险因子
    const significantFactors = riskAnalysis.factors.filter(
      f => f.contribution > 10
    );
    
    if (significantFactors.length > 0) {
      reasons.push('⚠️ 发现以下风险因子：');
      for (const factor of significantFactors) {
        reasons.push(`   • ${factor.name} (${Math.round(factor.contribution)}分): ${factor.description}`);
      }
    }
    
    if (enhancedMonitoring) {
      reasons.push('👁️ 已启用增强监控模式');
    }
    
    return reasons.join('\n');
  }

  /**
   * 生成拦截理由
   */
  private generateDenyReason(riskAnalysis: RiskAnalysis): string {
    const reasons: string[] = [
      `🚫 风险评分 ${riskAnalysis.score} 分，处于高风险区间 (${this.thresholds.observe + 1}-100)`
    ];
    
    // 添加所有风险因子
    reasons.push('❌ 检测到以下高风险因子：');
    for (const factor of riskAnalysis.factors) {
      if (factor.contribution > 0) {
        reasons.push(`   • ${factor.name} (${Math.round(factor.contribution)}分): ${factor.description}`);
      }
    }
    
    // 添加建议
    if (riskAnalysis.recommendations.length > 0) {
      reasons.push('\n💡 建议：');
      for (const rec of riskAnalysis.recommendations) {
        reasons.push(`   ${rec}`);
      }
    }
    
    return reasons.join('\n');
  }

  /**
   * 生成替代方案
   */
  private generateAlternatives(
    simulation: SimulationResult,
    decisionType: 'allow' | 'observe' | 'deny'
  ): string[] {
    const alternatives: string[] = [];
    const command = simulation.command;
    
    // 根据命令类型提供替代方案
    if (command.includes('rm -rf')) {
      alternatives.push('使用 "rm -i" 进行交互式删除，逐个确认');
      alternatives.push('先使用 "ls" 查看要删除的内容');
      alternatives.push('使用 "mv" 移动到回收站而非直接删除');
    }
    
    if (command.includes('sudo') || command.includes('su')) {
      alternatives.push('检查是否可以使用更细粒度的权限（如特定命令的 sudo 规则）');
      alternatives.push('考虑使用容器或沙盒环境执行');
    }
    
    if (command.includes('curl') || command.includes('wget')) {
      alternatives.push('先使用 "curl -I" 检查 URL 而不下载');
      alternatives.push('在沙盒环境中测试下载内容');
      alternatives.push('使用 "--max-time" 限制下载时间');
    }
    
    if (command.includes('chmod 777')) {
      alternatives.push('使用最小权限原则，只授予必要的权限');
      alternatives.push('考虑使用 ACL 进行更细粒度的权限控制');
    }
    
    // 通用建议
    if (decisionType === 'deny') {
      alternatives.push('联系系统管理员获取帮助');
      alternatives.push('在测试环境中先验证命令效果');
    }
    
    return alternatives;
  }

  /**
   * 判断是否需要增强监控
   */
  private shouldEnhanceMonitoring(
    riskAnalysis: RiskAnalysis,
    context?: CommandContext
  ): boolean {
    // 如果最近有高风险操作，增强监控
    if (context) {
      const recentHighRisk = context.recentOperations.filter(
        op => op.riskScore > 50
      ).length;
      
      if (recentHighRisk > 0) {
        return true;
      }
    }
    
    // 如果有敏感操作，增强监控
    const hasSensitiveFactor = riskAnalysis.factors.some(
      f => f.name.includes('敏感') || f.name.includes('外泄')
    );
    
    if (hasSensitiveFactor) {
      return true;
    }
    
    // 如果评分接近拦截阈值，增强监控
    if (riskAnalysis.score > this.thresholds.observe - 10) {
      return true;
    }
    
    return false;
  }

  /**
   * 快速决策（基于简单规则）
   * 
   * 用于性能敏感的场景，跳过完整的分析流程
   */
  quickDecide(command: string): DecisionAction {
    // 危险命令直接拦截
    const dangerousPatterns = [
      'rm -rf /', 'rm -rf /*', 'rm -rf ~',
      'dd if=/dev/zero', 'mkfs', 'fdisk',
      ':(){ :|:& };:'
    ];
    
    for (const pattern of dangerousPatterns) {
      if (command.includes(pattern)) {
        return 'deny';
      }
    }
    
    // 敏感路径访问需要观察
    const sensitivePatterns = [
      '/etc/shadow', '/etc/passwd', '~/.ssh'
    ];
    
    for (const pattern of sensitivePatterns) {
      if (command.includes(pattern)) {
        return 'observe';
      }
    }
    
    // 其他命令放行
    return 'allow';
  }

  /**
   * 更新阈值
   */
  setThresholds(thresholds: Partial<DecisionThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * 获取当前阈值
   */
  getThresholds(): DecisionThresholds {
    return { ...this.thresholds };
  }

  /**
   * 格式化决策报告
   */
  formatDecisionReport(decision: Decision): string {
    const lines: string[] = [];
    
    // 决策结果
    const actionEmoji = {
      'allow': '✅',
      'observe': '⚡',
      'deny': '🚫'
    };
    
    lines.push(`${actionEmoji[decision.action]} 决策结果: ${this.translateAction(decision.action)}`);
    lines.push('');
    
    // 理由
    lines.push('📋 决策理由：');
    lines.push(decision.reason);
    lines.push('');
    
    // 风险分析
    lines.push(`📊 风险评分: ${decision.riskAnalysis.score}/100 (${decision.riskAnalysis.level})`);
    lines.push('');
    
    // 替代方案
    if (decision.alternatives && decision.alternatives.length > 0) {
      lines.push('💡 替代方案：');
      for (let i = 0; i < decision.alternatives.length; i++) {
        lines.push(`   ${i + 1}. ${decision.alternatives[i]}`);
      }
      lines.push('');
    }
    
    // 是否需要确认
    if (decision.requiresConfirmation) {
      lines.push('⏸️ 此操作需要人工确认后才能执行');
    }
    
    return lines.join('\n');
  }

  /**
   * 翻译决策动作
   */
  private translateAction(action: DecisionAction): string {
    const translations: Record<DecisionAction, string> = {
      'allow': '放行',
      'observe': '观察',
      'deny': '拦截'
    };
    
    return translations[action];
  }
}

// 导出单例
export const decisionEngine = new DecisionEngine();
