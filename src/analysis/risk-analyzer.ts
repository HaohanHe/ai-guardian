/**
 * 风险分析引擎 - Risk Analysis Engine
 * 
 * 基于规则和模式的智能风险评分系统
 */

import type { 
  SimulationResult, 
  RiskAnalysis, 
  RiskFactor,
  RiskScore,
  CommandContext 
} from '../core/types.js';

/**
 * 风险权重配置
 */
interface RiskWeights {
  commandType: number;
  permissionEscalation: number;
  dataExfiltration: number;
  persistence: number;
  network: number;
  context: number;
}

/**
 * 风险分析器类
 */
export class RiskAnalyzer {
  private weights: RiskWeights;
  
  // 危险命令模式
  private dangerousPatterns: string[] = [
    'rm -rf /', 'rm -rf /*', 'rm -rf ~', 'rm -rf $HOME',
    'dd if=/dev/zero', 'mkfs', 'fdisk',
    'chmod 777 /', 'chmod -R 777',
    '> /dev/sda', '> /dev/hda',
    ':(){ :|:& };:', // fork bomb
    'eval $(curl', 'eval $(wget',
    'curl .* | bash', 'curl .* | sh',
    'wget .* | bash', 'wget .* | sh'
  ];
  
  // 敏感路径模式
  private sensitivePathPatterns: string[] = [
    '/etc/passwd', '/etc/shadow', '/etc/sudoers', '/etc/hosts',
    '~/.ssh', '~/.gnupg', '~/.aws', '~/.azure',
    '/root', '/var/log',
    '.env', '.env.local', '.env.production',
    'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519',
    '.pem', '.key', '.p12', '.pfx',
    'password', 'secret', 'token', 'credential', 'apikey',
    'wallet', 'private', 'backup'
  ];

  constructor(weights?: Partial<RiskWeights>) {
    this.weights = {
      commandType: 0.20,
      permissionEscalation: 0.25,
      dataExfiltration: 0.25,
      persistence: 0.15,
      network: 0.10,
      context: 0.05,
      ...weights
    };
  }

  /**
   * 分析风险
   */
  analyze(
    simulation: SimulationResult, 
    context?: CommandContext
  ): RiskAnalysis {
    const factors: RiskFactor[] = [];
    
    // 1. 命令类型风险
    const commandTypeRisk = this.assessCommandTypeRisk(simulation);
    factors.push({
      name: '命令类型风险',
      weight: this.weights.commandType,
      contribution: commandTypeRisk * this.weights.commandType,
      description: this.getCommandTypeDescription(simulation)
    });
    
    // 2. 权限提升风险
    const permissionRisk = this.assessPermissionRisk(simulation);
    factors.push({
      name: '权限提升风险',
      weight: this.weights.permissionEscalation,
      contribution: permissionRisk * this.weights.permissionEscalation,
      description: this.getPermissionDescription(simulation)
    });
    
    // 3. 数据外泄风险
    const exfiltrationRisk = this.assessDataExfiltrationRisk(simulation);
    factors.push({
      name: '数据外泄风险',
      weight: this.weights.dataExfiltration,
      contribution: exfiltrationRisk * this.weights.dataExfiltration,
      description: this.getExfiltrationDescription(simulation)
    });
    
    // 4. 持久化风险
    const persistenceRisk = this.assessPersistenceRisk(simulation);
    factors.push({
      name: '持久化风险',
      weight: this.weights.persistence,
      contribution: persistenceRisk * this.weights.persistence,
      description: this.getPersistenceDescription(simulation)
    });
    
    // 5. 网络风险
    const networkRisk = this.assessNetworkRisk(simulation);
    factors.push({
      name: '网络风险',
      weight: this.weights.network,
      contribution: networkRisk * this.weights.network,
      description: this.getNetworkDescription(simulation)
    });
    
    // 6. 上下文风险
    const contextRisk = this.assessContextRisk(simulation, context);
    factors.push({
      name: '上下文风险',
      weight: this.weights.context,
      contribution: contextRisk * this.weights.context,
      description: this.getContextDescription(simulation, context)
    });
    
    // 检查是否有致命风险（直接返回100）
    const hasFatalRisk = factors.some(f => 
      (f.name === '命令类型风险' && f.contribution >= 20) ||
      (f.name === '权限提升风险' && f.contribution >= 25) ||
      (f.name === '数据外泄风险' && f.contribution >= 25)
    );
    
    if (hasFatalRisk) {
      const fatalFactor = factors.find(f => 
        (f.name === '命令类型风险' && f.contribution >= 20) ||
        (f.name === '权限提升风险' && f.contribution >= 25) ||
        (f.name === '数据外泄风险' && f.contribution >= 25)
      );
      
      if (fatalFactor) {
        const fatalScore = Math.round(fatalFactor.contribution / fatalFactor.weight);
        return {
          score: Math.min(100, fatalScore) as RiskScore,
          level: this.getRiskLevel(Math.min(100, fatalScore)),
          factors,
          recommendations: this.generateRecommendations(simulation, Math.min(100, fatalScore))
        };
      }
    }
    
    // 计算总分 - 使用加权平均
    const totalWeight = Object.values(this.weights).reduce((sum, w) => sum + w, 0);
    const weightedSum = factors.reduce((sum, f) => sum + f.contribution, 0);
    const totalScore = weightedSum / totalWeight;
    const normalizedScore = Math.min(100, Math.max(0, Math.round(totalScore)));
    
    return {
      score: normalizedScore as RiskScore,
      level: this.getRiskLevel(normalizedScore),
      factors,
      recommendations: this.generateRecommendations(simulation, normalizedScore)
    };
  }

  /**
   * 评估命令类型风险
   */
  private assessCommandTypeRisk(simulation: SimulationResult): number {
    let risk = 0;
    const command = simulation.command.toLowerCase();
    
    // 检查危险模式 - 直接返回最高风险
    if (command.includes('rm -rf /') || command.includes('rm -rf /*')) {
      return 100;
    }
    if (command.includes('rm -rf ~') || command.includes("rm -rf $home")) {
      return 100;
    }
    if (command.includes('dd if=/dev/zero') || command.includes('dd if=/dev/random')) {
      return 100;
    }
    if (command.includes('mkfs') || command.includes('fdisk')) {
      return 100;
    }
    if (command.includes(':(){ :|:& };:')) {
      return 100;
    }
    
    // 检查高风险模式
    if (command.includes('rm -rf')) {
      risk += 60;
    }
    if (command.includes('sudo')) {
      risk += 60;
    }
    if (command.includes('su -')) {
      risk += 60;
    }
    if (command.includes('chmod 777')) {
      risk += 60;
    }
    if (command.includes('curl') && (command.includes('| bash') || command.includes('| sh'))) {
      risk += 60;
    }
    if (command.includes('wget') && (command.includes('| bash') || command.includes('| sh'))) {
      risk += 60;
    }
    if (command.includes('eval') && command.includes('curl')) {
      risk += 60;
    }
    
    // 基于风险指标 - 增加权重
    for (const indicator of simulation.riskIndicators) {
      if (indicator.category === 'command_type') {
        switch (indicator.severity) {
          case 'critical':
            risk += 100;  // 直接加到100
            break;
          case 'high':
            risk += 70;
            break;
          case 'medium':
            risk += 35;
            break;
          case 'low':
            risk += 15;
            break;
        }
      }
    }
    
    // 基于预测效果 - 增加权重
    for (const effect of simulation.predictedEffects) {
      if (effect.type === 'file_delete') {
        switch (effect.severity) {
          case 'critical':
            risk += 90;
            break;
          case 'high':
            risk += 60;
            break;
          case 'medium':
            risk += 30;
            break;
        }
      }
    }
    
    return Math.min(100, risk);
  }

  /**
   * 评估权限提升风险
   */
  private assessPermissionRisk(simulation: SimulationResult): number {
    let risk = 0;
    const command = simulation.command.toLowerCase();
    
    // 直接检查权限提升命令
    if (command.includes('sudo ') || command.startsWith('sudo ')) {
      risk += 70;
    }
    
    if (command.includes('su -') || command.startsWith('su ')) {
      risk += 65;
    }
    
    if (command.includes('doas ')) {
      risk += 65;
    }
    
    if (command.includes('chmod 777') || command.includes('chmod -r 777')) {
      risk += 80;
    }
    
    // 基于风险指标
    for (const indicator of simulation.riskIndicators) {
      if (indicator.category === 'permission_escalation') {
        switch (indicator.severity) {
          case 'critical':
            risk += 90;
            break;
          case 'high':
            risk += 70;
            break;
          case 'medium':
            risk += 40;
            break;
        }
      }
    }
    
    // 检查预测效果中的权限变更
    for (const effect of simulation.predictedEffects) {
      if (effect.type === 'permission_change') {
        switch (effect.severity) {
          case 'critical':
            risk += 80;
            break;
          case 'high':
            risk += 60;
            break;
          case 'medium':
            risk += 30;
            break;
        }
      }
    }
    
    return Math.min(100, risk);
  }

  /**
   * 评估数据外泄风险
   */
  private assessDataExfiltrationRisk(simulation: SimulationResult): number {
    let risk = 0;
    const command = simulation.command.toLowerCase();
    
    // 检查敏感路径访问 - 大幅增加权重
    for (const indicator of simulation.riskIndicators) {
      if (indicator.category === 'data_exfiltration') {
        switch (indicator.severity) {
          case 'critical':
            risk += 100;
            break;
          case 'high':
            risk += 80;
            break;
          case 'medium':
            risk += 40;
            break;
        }
      }
    }
    
    // 检查敏感文件读取
    const hasSensitiveRead = simulation.predictedEffects.some(e => 
      e.type === 'file_modify' && this.isSensitivePath(e.target)
    );
    
    if (hasSensitiveRead) {
      risk += 60;
    }
    
    // 检查网络发送
    const hasNetworkSend = simulation.predictedEffects.some(e => 
      e.type === 'network_request'
    );
    
    if (hasNetworkSend) {
      risk += 40;
    }
    
    // 敏感文件读取 + 网络发送 = 数据外泄模式
    if (hasSensitiveRead && hasNetworkSend) {
      risk += 50; // 额外加分
    }
    
    // 检查命令中是否包含敏感路径
    for (const path of this.sensitivePathPatterns) {
      if (command.includes(path.toLowerCase())) {
        risk += 50;
        break;
      }
    }
    
    return Math.min(100, risk);
  }

  /**
   * 评估持久化风险
   */
  private assessPersistenceRisk(simulation: SimulationResult): number {
    let risk = 0;
    
    for (const indicator of simulation.riskIndicators) {
      if (indicator.category === 'persistence') {
        switch (indicator.severity) {
          case 'critical':
            risk += 80;
            break;
          case 'high':
            risk += 50;
            break;
          case 'medium':
            risk += 25;
            break;
        }
      }
    }
    
    return Math.min(100, risk);
  }

  /**
   * 评估网络风险
   */
  private assessNetworkRisk(simulation: SimulationResult): number {
    let risk = 0;
    
    const networkEffects = simulation.predictedEffects.filter(
      e => e.type === 'network_request'
    );
    
    for (const effect of networkEffects) {
      switch (effect.severity) {
        case 'critical':
          risk += 50;
          break;
        case 'high':
          risk += 30;
          break;
        case 'medium':
          risk += 15;
          break;
        case 'low':
          risk += 5;
          break;
      }
    }
    
    // 多个网络请求增加风险
    if (networkEffects.length > 2) {
      risk += 20;
    }
    
    return Math.min(100, risk);
  }

  /**
   * 评估上下文风险
   */
  private assessContextRisk(
    _simulation: SimulationResult, 
    context?: CommandContext
  ): number {
    let risk = 0;
    
    if (!context) {
      return 0;
    }
    
    // 检查命令历史中的可疑模式
    const recentHighRiskOps = context.recentOperations.filter(
      op => op.riskScore > 50
    );
    
    if (recentHighRiskOps.length > 0) {
      risk += 20 * recentHighRiskOps.length;
    }
    
    // 检查高频操作
    const recentCount = context.recentOperations.filter(
      op => Date.now() - op.timestamp < 10000
    ).length;
    
    if (recentCount > 3) {
      risk += 15;
    }
    
    return Math.min(100, risk);
  }

  /**
   * 获取风险等级
   */
  private getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 71) return 'critical';
    if (score >= 31) return 'high';
    if (score >= 11) return 'medium';
    return 'low';
  }

  /**
   * 生成建议
   */
  private generateRecommendations(
    simulation: SimulationResult, 
    score: number
  ): string[] {
    const recommendations: string[] = [];
    
    if (score >= 71) {
      recommendations.push('⚠️ 高风险操作，建议拦截');
      recommendations.push('🔍 请仔细审查命令意图');
    } else if (score >= 31) {
      recommendations.push('⚡ 中风险操作，建议观察');
      recommendations.push('👁️ 密切关注后续操作');
    } else {
      recommendations.push('✅ 低风险操作，可以放行');
    }
    
    // 基于具体风险给出建议
    for (const indicator of simulation.riskIndicators) {
      switch (indicator.category) {
        case 'permission_escalation':
          recommendations.push('🔐 避免使用 sudo，除非绝对必要');
          break;
        case 'data_exfiltration':
          recommendations.push('🔒 检查数据流向，防止敏感信息泄露');
          break;
        case 'persistence':
          recommendations.push('🚪 检查是否建立了后门或持久化机制');
          break;
      }
    }
    
    return recommendations;
  }

  /**
   * 获取命令类型描述
   */
  private getCommandTypeDescription(_simulation: SimulationResult): string {
    const indicators = _simulation.riskIndicators.filter(
      (i: { category: string }) => i.category === 'command_type'
    );
    
    if (indicators.length === 0) {
      return '命令类型风险较低';
    }
    
    return indicators.map((i: { description: string }) => i.description).join('; ');
  }

  /**
   * 获取权限描述
   */
  private getPermissionDescription(simulation: SimulationResult): string {
    const indicators = simulation.riskIndicators.filter(
      i => i.category === 'permission_escalation'
    );
    
    if (indicators.length === 0) {
      return '无权限提升';
    }
    
    return indicators.map(i => i.description).join('; ');
  }

  /**
   * 获取外泄描述
   */
  private getExfiltrationDescription(simulation: SimulationResult): string {
    const indicators = simulation.riskIndicators.filter(
      i => i.category === 'data_exfiltration'
    );
    
    if (indicators.length === 0) {
      return '无数据外泄风险';
    }
    
    return indicators.map(i => i.description).join('; ');
  }

  /**
   * 获取持久化描述
   */
  private getPersistenceDescription(_simulation: SimulationResult): string {
    const indicators = _simulation.riskIndicators.filter(
      (i: { category: string }) => i.category === 'persistence'
    );
    
    if (indicators.length === 0) {
      return '无持久化行为';
    }
    
    return indicators.map((i: { description: string }) => i.description).join('; ');
  }

  /**
   * 获取网络描述
   */
  private getNetworkDescription(simulation: SimulationResult): string {
    const networkEffects = simulation.predictedEffects.filter(
      e => e.type === 'network_request'
    );
    
    if (networkEffects.length === 0) {
      return '无网络操作';
    }
    
    return `将连接 ${networkEffects.length} 个网络目标`;
  }

  /**
   * 获取上下文描述
   */
  private getContextDescription(
    _simulation: SimulationResult, 
    context?: CommandContext
  ): string {
    if (!context) {
      return '无上下文信息';
    }
    
    const recentHighRisk = context.recentOperations.filter(
      op => op.riskScore > 50
    ).length;
    
    if (recentHighRisk > 0) {
      return `最近有 ${recentHighRisk} 个高风险操作`;
    }
    
    return '上下文正常';
  }

  /**
   * 判断是否是敏感路径
   */
  private isSensitivePath(path: string): boolean {
    return this.sensitivePathPatterns.some(pattern => 
      path.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * 更新权重
   */
  setWeights(weights: Partial<RiskWeights>): void {
    this.weights = { ...this.weights, ...weights };
  }

  /**
   * 添加危险模式
   */
  addDangerousPattern(pattern: string): void {
    this.dangerousPatterns.push(pattern);
  }

  /**
   * 添加敏感路径
   */
  addSensitivePath(path: string): void {
    this.sensitivePathPatterns.push(path);
  }
}

// 导出单例
export const riskAnalyzer = new RiskAnalyzer();
