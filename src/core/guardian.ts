/**
 * AI Guardian - 主控制器
 * 
 * 整合所有模块，提供统一的防御接口
 */

import type { 
  ToolRequest, 
  Decision, 
  SimulationResult,
  CommandContext,
  ExecParams 
} from './types.js';
import { mentalSimulation } from '../simulation/mental-simulation.js';
import { riskAnalyzer } from '../analysis/risk-analyzer.js';
import { decisionEngine } from '../decision/decision-engine.js';
import { bodyCamera } from '../audit/body-camera.js';

/**
 * Guardian 配置选项
 */
export interface GuardianOptions {
  // 决策阈值
  allowThreshold?: number;
  observeThreshold?: number;
  denyThreshold?: number;
  
  // 审计配置
  auditLogPath?: string;
  maxAuditFileSize?: number;
  
  // 上下文配置
  maxHistorySize?: number;
  contextWindowMs?: number;
}

/**
 * AI Guardian 主类
 */
export class AIGuardian {
  private options: Required<GuardianOptions>;
  private commandHistory: string[] = [];
  private recentOperations: Array<{
    timestamp: number;
    toolName: string;
    description: string;
    riskScore: number;
  }> = [];

  constructor(options: GuardianOptions = {}) {
    this.options = {
      allowThreshold: 30,
      observeThreshold: 70,
      denyThreshold: 100,
      auditLogPath: './logs/audit.log',
      maxAuditFileSize: 10 * 1024 * 1024,
      maxHistorySize: 100,
      contextWindowMs: 60000,  // 1分钟
      ...options
    };
    
    // 配置决策引擎
    decisionEngine.setThresholds({
      allow: this.options.allowThreshold,
      observe: this.options.observeThreshold,
      deny: this.options.denyThreshold
    });
  }

  /**
   * 评估工具调用
   * 
   * 核心方法：对 AI Agent 的工具调用进行安全评估
   */
  async evaluate(request: ToolRequest): Promise<Decision> {
    const startTime = Date.now();
    
    // 1. 提取命令信息
    const { toolName, params } = request;
    const command = this.extractCommand(toolName, params);
    
    console.log(`\n🔍 AI Guardian 正在评估: ${toolName}`);
    if (command) {
      console.log(`   命令: ${command}`);
    }
    
    // 2. 推演预判（在脑海中推演，不真正执行）
    console.log('🧠 正在推演命令效果...');
    const simulation = this.simulate(toolName, params);
    
    // 3. 构建上下文
    const context = this.buildContext();
    
    // 4. 风险分析
    console.log('📊 正在分析风险...');
    const riskAnalysis = riskAnalyzer.analyze(simulation, context);
    
    // 5. 做出决策
    console.log('⚖️ 正在做出决策...');
    const decision = decisionEngine.decide(riskAnalysis, simulation, context);
    
    // 6. 记录执法日志
    bodyCamera.record(toolName, params, decision, simulation, context);
    
    // 7. 更新历史
    this.updateHistory(toolName, command || toolName, riskAnalysis.score);
    
    // 8. 输出结果
    const duration = Date.now() - startTime;
    this.outputDecision(decision, duration);
    
    return decision;
  }

  /**
   * 快速评估（用于性能敏感场景）
   */
  quickEvaluate(command: string): Decision {
    // 使用快速决策
    const action = decisionEngine.quickDecide(command);
    
    // 构建简化版决策
    const riskAnalysis = {
      score: action === 'deny' ? 100 : action === 'observe' ? 50 : 10,
      level: (action === 'deny' ? 'critical' : action === 'observe' ? 'high' : 'low') as 'low' | 'medium' | 'high' | 'critical',
      factors: [],
      recommendations: []
    };
    
    const simulation: SimulationResult = {
      command,
      predictedEffects: [],
      riskIndicators: [],
      metadata: {
        parsedCommands: [],
        environmentVariables: [],
        networkTargets: [],
        filePaths: [],
        duration: 0
      }
    };
    
    const decision = decisionEngine.decide(riskAnalysis, simulation);
    
    // 记录
    bodyCamera.record('exec', { command }, decision, simulation);
    
    return decision;
  }

  /**
   * 推演命令效果
   */
  private simulate(toolName: string, params: Record<string, unknown>): SimulationResult {
    // 根据工具类型进行推演
    switch (toolName) {
      case 'exec':
        if (typeof params.command === 'string') {
          return mentalSimulation.simulate(params.command, params as unknown as ExecParams);
        }
        return this.simulateGeneric(toolName, params);
        
      case 'browser':
        return this.simulateBrowserAction(params);
        
      case 'read':
      case 'write':
      case 'edit':
        return this.simulateFileOperation(toolName, params);
        
      default:
        return this.simulateGeneric(toolName, params);
    }
  }

  /**
   * 推演浏览器操作
   */
  private simulateBrowserAction(params: Record<string, unknown>): SimulationResult {
    const action = params.action as string;
    const url = params.url as string | undefined;
    
    const effects = [];
    const indicators = [];
    
    // 截图操作
    if (action === 'screenshot') {
      effects.push({
        type: 'file_create' as const,
        target: 'screenshot',
        description: '将捕获屏幕截图',
        severity: 'medium' as const
      });
      
      indicators.push({
        category: 'data_exfiltration' as const,
        description: '截图可能包含敏感信息',
        severity: 'medium' as const,
        evidence: ['screenshot action']
      });
    }
    
    // 导航操作
    if (action === 'navigate' && url) {
      effects.push({
        type: 'network_request' as const,
        target: url,
        description: `将导航到: ${url}`,
        severity: this.assessUrlRisk(url)
      });
    }
    
    return {
      command: `browser ${action}`,
      predictedEffects: effects,
      riskIndicators: indicators,
      metadata: {
        parsedCommands: [],
        environmentVariables: [],
        networkTargets: url ? [url] : [],
        filePaths: [],
        duration: 0
      }
    };
  }

  /**
   * 推演文件操作
   */
  private simulateFileOperation(
    operation: string,
    params: Record<string, unknown>
  ): SimulationResult {
    const path = params.path as string;
    
    const effects = [];
    const indicators = [];
    
    // 根据操作类型
    switch (operation) {
      case 'read':
        effects.push({
          type: 'file_modify' as const,  // 读取也是一种修改访问
          target: path,
          description: `将读取文件: ${path}`,
          severity: this.assessPathRisk(path)
        });
        break;
        
      case 'write':
        effects.push({
          type: 'file_create' as const,
          target: path,
          description: `将写入文件: ${path}`,
          severity: this.assessPathRisk(path)
        });
        break;
        
      case 'edit':
        effects.push({
          type: 'file_modify' as const,
          target: path,
          description: `将修改文件: ${path}`,
          severity: this.assessPathRisk(path)
        });
        break;
    }
    
    // 检查敏感路径
    if (this.isSensitivePath(path)) {
      indicators.push({
        category: 'data_exfiltration' as const,
        description: '访问敏感文件路径',
        severity: 'high' as const,
        evidence: [path]
      });
    }
    
    return {
      command: `${operation} ${path}`,
      predictedEffects: effects,
      riskIndicators: indicators,
      metadata: {
        parsedCommands: [],
        environmentVariables: [],
        networkTargets: [],
        filePaths: [path],
        duration: 0
      }
    };
  }

  /**
   * 通用推演
   */
  private simulateGeneric(
    toolName: string,
    params: Record<string, unknown>
  ): SimulationResult {
    return {
      command: `${toolName} ${JSON.stringify(params)}`,
      predictedEffects: [],
      riskIndicators: [],
      metadata: {
        parsedCommands: [],
        environmentVariables: [],
        networkTargets: [],
        filePaths: [],
        duration: 0
      }
    };
  }

  /**
   * 提取命令字符串
   */
  private extractCommand(toolName: string, params: Record<string, unknown>): string | null {
    if (toolName === 'exec' && params.command) {
      return params.command as string;
    }
    return null;
  }

  /**
   * 构建上下文
   */
  private buildContext(): CommandContext {
    return {
      workingDirectory: process.cwd(),
      environmentVariables: { ...process.env } as Record<string, string>,
      commandHistory: [...this.commandHistory],
      recentOperations: this.recentOperations.filter(
        op => Date.now() - op.timestamp < this.options.contextWindowMs
      )
    };
  }

  /**
   * 更新历史
   */
  private updateHistory(toolName: string, description: string, riskScore: number): void {
    // 更新命令历史
    this.commandHistory.push(`${toolName}: ${description}`);
    if (this.commandHistory.length > this.options.maxHistorySize) {
      this.commandHistory.shift();
    }
    
    // 更新最近操作
    this.recentOperations.push({
      timestamp: Date.now(),
      toolName,
      description,
      riskScore
    });
    
    // 清理过期操作
    this.recentOperations = this.recentOperations.filter(
      op => Date.now() - op.timestamp < this.options.contextWindowMs
    );
  }

  /**
   * 输出决策结果
   */
  private outputDecision(decision: Decision, duration: number): void {
    console.log('\n' + '='.repeat(50));
    
    const emoji = {
      'allow': '✅',
      'observe': '⚡',
      'deny': '🚫'
    }[decision.action];
    
    console.log(`${emoji} 决策: ${decision.action.toUpperCase()}`);
    console.log(`📊 风险评分: ${decision.riskAnalysis.score}/100 (${decision.riskAnalysis.level})`);
    console.log(`⏱️  评估耗时: ${duration}ms`);
    
    if (decision.alternatives && decision.alternatives.length > 0) {
      console.log('\n💡 替代方案:');
      decision.alternatives.forEach((alt, i) => {
        console.log(`   ${i + 1}. ${alt}`);
      });
    }
    
    console.log('='.repeat(50) + '\n');
  }

  /**
   * 评估 URL 风险
   */
  private assessUrlRisk(url: string): 'low' | 'medium' | 'high' | 'critical' {
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      return 'low';
    }
    if (url.startsWith('https://')) {
      return 'medium';
    }
    if (url.startsWith('http://')) {
      return 'high';
    }
    return 'medium';
  }

  /**
   * 评估路径风险
   */
  private assessPathRisk(path: string): 'low' | 'medium' | 'high' | 'critical' {
    if (this.isSensitivePath(path)) {
      return 'high';
    }
    if (path.startsWith('/etc') || path.startsWith('/usr')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * 判断是否是敏感路径
   */
  private isSensitivePath(path: string): boolean {
    const sensitivePatterns = [
      '~/.ssh', '/etc/shadow', '/etc/passwd', '/etc/sudoers',
      '.env', 'id_rsa', 'id_dsa', '.pem', '.key',
      'password', 'secret', 'token', 'credential'
    ];
    
    return sensitivePatterns.some(pattern => 
      path.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * 生成审计报告
   */
  async generateAuditReport(format: 'json' | 'text' | 'html' = 'text'): Promise<string> {
    return bodyCamera.generateReport({ format });
  }

  /**
   * 查询审计日志
   */
  async queryAuditLog(options: {
    startTime?: number;
    endTime?: number;
    toolName?: string;
    limit?: number;
  } = {}) {
    return bodyCamera.query(options);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      historySize: this.commandHistory.length,
      recentOperations: this.recentOperations.length,
      auditStats: bodyCamera.getStats()
    };
  }
}

// 导出单例
export const aiGuardian = new AIGuardian();
