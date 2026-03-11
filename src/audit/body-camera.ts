/**
 * 执法记录仪系统 - Body Camera System
 * 
 * 像360/金山毒霸一样，全程不间断记录所有操作
 * 支持事后追溯，防篡改保护
 */

import { 
  appendFileSync, 
  existsSync, 
  mkdirSync,
  statSync,
  renameSync
} from 'fs';
import { dirname, join } from 'path';
import { createSign, randomBytes } from 'crypto';
import type { 
  AuditLogEntry, 
  Decision,
  SimulationResult,
  CommandContext 
} from '../core/types.js';

/**
 * 执法记录仪配置
 */
interface BodyCameraConfig {
  logPath: string;
  maxFileSize: number;      // 单个日志文件最大大小 (字节)
  maxFiles: number;         // 最大保留文件数
  enableSignature: boolean; // 是否启用数字签名
  privateKey?: string;      // 签名私钥
}

/**
 * 执法记录仪类
 */
export class BodyCamera {
  private config: BodyCameraConfig;
  private currentLogFile: string;
  private entryCount: number = 0;
  private lastRotation: number = Date.now();

  constructor(config?: Partial<BodyCameraConfig>) {
    this.config = {
      logPath: './logs/audit.log',
      maxFileSize: 10 * 1024 * 1024,  // 10MB
      maxFiles: 10,
      enableSignature: true,
      ...config
    };
    
    this.currentLogFile = this.config.logPath;
    this.ensureLogDirectory();
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogDirectory(): void {
    const dir = dirname(this.config.logPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 记录操作
   * 
   * 核心方法：像执法记录仪一样记录所有操作
   */
  record(
    toolName: string,
    params: Record<string, unknown>,
    decision: Decision,
    simulation?: SimulationResult,
    context?: CommandContext
  ): AuditLogEntry {
    // 检查是否需要轮转
    this.checkRotation();
    
    // 创建日志条目
    const entry: AuditLogEntry = {
      id: this.generateEntryId(),
      timestamp: Date.now(),
      sessionId: this.getSessionId(),
      agentId: this.getAgentId(),
      toolName,
      params: this.sanitizeParams(params),
      decision,
      simulationResult: simulation,
      context: context || this.getDefaultContext()
    };
    
    // 写入日志
    this.writeEntry(entry);
    
    this.entryCount++;
    
    return entry;
  }

  /**
   * 生成条目 ID
   */
  private generateEntryId(): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(4).toString('hex');
    return `${timestamp}-${random}`;
  }

  /**
   * 获取会话 ID
   */
  private getSessionId(): string {
    // 从环境变量或生成新的
    return process.env.AI_GUARDIAN_SESSION_ID || this.generateEntryId();
  }

  /**
   * 获取 Agent ID
   */
  private getAgentId(): string | undefined {
    return process.env.AI_GUARDIAN_AGENT_ID;
  }

  /**
   * 清理敏感参数
   */
  private sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...params };
    
    // 隐藏敏感字段
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'apiKey'];
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***REDACTED***';
      }
    }
    
    return sanitized;
  }

  /**
   * 获取默认上下文
   */
  private getDefaultContext(): CommandContext {
    return {
      workingDirectory: process.cwd(),
      environmentVariables: {},
      commandHistory: [],
      recentOperations: []
    };
  }

  /**
   * 检查是否需要轮转
   */
  private checkRotation(): void {
    // 检查文件大小
    if (existsSync(this.currentLogFile)) {
      const stats = statSync(this.currentLogFile);
      
      if (stats.size >= this.config.maxFileSize) {
        this.rotateLog();
      }
    }
    
    // 每天轮转一次
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    if (now - this.lastRotation > oneDay) {
      this.rotateLog();
      this.lastRotation = now;
    }
  }

  /**
   * 轮转日志
   */
  private rotateLog(): void {
    // 重命名当前日志
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newPath = `${this.config.logPath}.${timestamp}`;
    
    if (existsSync(this.currentLogFile)) {
      renameSync(this.currentLogFile, newPath);
    }
    
    // 清理旧日志
    this.cleanupOldLogs();
  }

  /**
   * 清理旧日志
   */
  private async cleanupOldLogs(): Promise<void> {
    const { readdirSync, unlinkSync } = await import('fs');
    const dir = dirname(this.config.logPath);
    const baseName = this.config.logPath.split('/').pop() || 'audit.log';
    
    // 获取所有日志文件
    const files = readdirSync(dir)
      .filter(f => f.startsWith(baseName))
      .map(f => ({
        name: f,
        path: join(dir, f),
        time: statSync(join(dir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);
    
    // 删除超出保留数量的旧日志
    if (files.length > this.config.maxFiles) {
      for (const file of files.slice(this.config.maxFiles)) {
        try {
          unlinkSync(file.path);
        } catch {
          // 忽略删除错误
        }
      }
    }
  }

  /**
   * 写入日志条目
   */
  private writeEntry(entry: AuditLogEntry): void {
    const logLine = this.formatEntry(entry);
    
    // 追加到文件
    appendFileSync(this.currentLogFile, logLine + '\n', 'utf-8');
    
    // 如果启用签名，添加签名
    if (this.config.enableSignature && this.config.privateKey) {
      this.signEntry(entry);
    }
  }

  /**
   * 格式化日志条目
   */
  private formatEntry(entry: AuditLogEntry): string {
    const data = {
      ...entry,
      _meta: {
        version: '1.0',
        format: 'json'
      }
    };
    
    return JSON.stringify(data);
  }

  /**
   * 签名条目
   */
  private signEntry(entry: AuditLogEntry): void {
    if (!this.config.privateKey) return;
    
    try {
      const data = JSON.stringify(entry);
      const sign = createSign('SHA256');
      sign.update(data);
      sign.end();
      
      const signature = sign.sign(this.config.privateKey, 'hex');
      
      // 追加签名
      const signatureLine = JSON.stringify({
        _type: 'signature',
        entryId: entry.id,
        signature,
        algorithm: 'SHA256'
      });
      
      appendFileSync(this.currentLogFile, signatureLine + '\n', 'utf-8');
    } catch {
      // 签名失败不阻止日志记录
    }
  }

  /**
   * 查询日志
   */
  async query(options: {
    startTime?: number;
    endTime?: number;
    toolName?: string;
    minRiskScore?: number;
    maxRiskScore?: number;
    sessionId?: string;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    const results: AuditLogEntry[] = [];
    const { createReadStream } = await import('fs');
    const { createInterface } = await import('readline');
    
    // 读取当前日志文件
    if (!existsSync(this.currentLogFile)) {
      return results;
    }
    
    const stream = createReadStream(this.currentLogFile, 'utf-8');
    const rl = createInterface({ input: stream });
    
    for await (const line of rl) {
      if (!line.trim()) continue;
      
      try {
        const entry: AuditLogEntry = JSON.parse(line);
        
        // 过滤条件
        if (options.startTime && entry.timestamp < options.startTime) continue;
        if (options.endTime && entry.timestamp > options.endTime) continue;
        if (options.toolName && entry.toolName !== options.toolName) continue;
        if (options.sessionId && entry.sessionId !== options.sessionId) continue;
        
        if (options.minRiskScore !== undefined && 
            entry.decision.riskAnalysis.score < options.minRiskScore) continue;
        if (options.maxRiskScore !== undefined && 
            entry.decision.riskAnalysis.score > options.maxRiskScore) continue;
        
        results.push(entry);
        
        // 限制数量
        if (options.limit && results.length >= options.limit) {
          break;
        }
      } catch {
        // 忽略解析错误
      }
    }
    
    return results;
  }

  /**
   * 生成审计报告
   */
  async generateReport(options: {
    startTime?: number;
    endTime?: number;
    format?: 'json' | 'text' | 'html';
  } = {}): Promise<string> {
    const entries = await this.query({
      startTime: options.startTime,
      endTime: options.endTime
    });
    
    const stats = this.calculateStats(entries);
    
    switch (options.format) {
      case 'text':
        return this.formatTextReport(stats, entries);
      case 'html':
        return this.formatHtmlReport(stats, entries);
      case 'json':
      default:
        return JSON.stringify({ stats, entries }, null, 2);
    }
  }

  /**
   * 计算统计信息
   */
  private calculateStats(entries: AuditLogEntry[]) {
    const stats = {
      total: entries.length,
      byAction: { allow: 0, observe: 0, deny: 0 },
      byTool: {} as Record<string, number>,
      byRiskLevel: { low: 0, medium: 0, high: 0, critical: 0 },
      averageRiskScore: 0,
      timeRange: { start: 0, end: 0 }
    };
    
    if (entries.length === 0) {
      return stats;
    }
    
    let totalRiskScore = 0;
    let minTime = Infinity;
    let maxTime = 0;
    
    for (const entry of entries) {
      // 按动作统计
      stats.byAction[entry.decision.action]++;
      
      // 按工具统计
      stats.byTool[entry.toolName] = (stats.byTool[entry.toolName] || 0) + 1;
      
      // 按风险等级统计
      stats.byRiskLevel[entry.decision.riskAnalysis.level]++;
      
      // 风险分数
      totalRiskScore += entry.decision.riskAnalysis.score;
      
      // 时间范围
      minTime = Math.min(minTime, entry.timestamp);
      maxTime = Math.max(maxTime, entry.timestamp);
    }
    
    stats.averageRiskScore = Math.round(totalRiskScore / entries.length);
    stats.timeRange = { start: minTime, end: maxTime };
    
    return stats;
  }

  /**
   * 格式化文本报告
   */
  private formatTextReport(stats: any, entries: AuditLogEntry[]): string {
    const lines: string[] = [];
    
    lines.push('========================================');
    lines.push('      AI Guardian 审计报告');
    lines.push('========================================');
    lines.push('');
    
    lines.push('📊 统计概览');
    lines.push(`   总记录数: ${stats.total}`);
    lines.push(`   平均风险分: ${stats.averageRiskScore}`);
    lines.push(`   时间范围: ${new Date(stats.timeRange.start).toLocaleString()} - ${new Date(stats.timeRange.end).toLocaleString()}`);
    lines.push('');
    
    lines.push('📈 按决策类型');
    lines.push(`   ✅ 放行: ${stats.byAction.allow}`);
    lines.push(`   ⚡ 观察: ${stats.byAction.observe}`);
    lines.push(`   🚫 拦截: ${stats.byAction.deny}`);
    lines.push('');
    
    lines.push('⚠️ 按风险等级');
    lines.push(`   🔵 低风险: ${stats.byRiskLevel.low}`);
    lines.push(`   🟡 中风险: ${stats.byRiskLevel.medium}`);
    lines.push(`   🟠 高风险: ${stats.byRiskLevel.high}`);
    lines.push(`   🔴 严重: ${stats.byRiskLevel.critical}`);
    lines.push('');
    
    lines.push('🔧 按工具类型');
    for (const [tool, count] of Object.entries(stats.byTool)) {
      lines.push(`   ${tool}: ${count}`);
    }
    lines.push('');
    
    if (entries.length > 0) {
      lines.push('📝 详细记录（最近10条）');
      lines.push('');
      
      for (const entry of entries.slice(-10)) {
        const emoji = {
          'allow': '✅',
          'observe': '⚡',
          'deny': '🚫'
        }[entry.decision.action];
        
        lines.push(`${emoji} [${new Date(entry.timestamp).toLocaleTimeString()}] ${entry.toolName}`);
        lines.push(`   风险: ${entry.decision.riskAnalysis.score}/100 (${entry.decision.riskAnalysis.level})`);
        lines.push(`   决策: ${entry.decision.action}`);
        lines.push('');
      }
    }
    
    return lines.join('\n');
  }

  /**
   * 格式化 HTML 报告
   */
  private formatHtmlReport(stats: any, entries: AuditLogEntry[]): string {
    // 简化实现
    return `<html><body><pre>${this.formatTextReport(stats, entries)}</pre></body></html>`;
  }

  /**
   * 导出日志
   */
  async exportToFile(outputPath: string): Promise<void> {
    const { copyFileSync } = await import('fs');
    copyFileSync(this.currentLogFile, outputPath);
  }

  /**
   * 获取统计信息
   */
  getStats(): { entryCount: number; currentLogFile: string } {
    return {
      entryCount: this.entryCount,
      currentLogFile: this.currentLogFile
    };
  }
}

// 导出单例
export const bodyCamera = new BodyCamera();
