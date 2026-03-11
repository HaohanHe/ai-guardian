/**
 * 推演预判引擎 - Mental Simulation Engine
 * 
 * 核心理念：在脑海中推演命令执行效果，绝不真正执行
 * 像人类一样思考："如果我执行这个命令，会发生什么？"
 */

import type { 
  SimulationResult, 
  PredictedEffect, 
  RiskIndicator,
  SimulationMetadata,
  ParsedCommand,
  ExecParams 
} from '../core/types.js';
import { commandParser } from './command-parser.js';

/**
 * 推演引擎类
 */
export class MentalSimulationEngine {
  private startTime: number = 0;

  /**
   * 推演命令执行效果
   * 
   * 这是核心方法：在脑海中推演，不真正执行
   */
  simulate(command: string, params?: ExecParams): SimulationResult {
    this.startTime = Date.now();
    
    // 1. 解析命令
    const parsed = commandParser.parse(command);
    
    // 2. 预测效果
    const predictedEffects = this.predictEffects(parsed, params);
    
    // 3. 识别风险指标
    const riskIndicators = this.identifyRisks(parsed, params, predictedEffects);
    
    // 4. 收集元数据
    const metadata = this.collectMetadata(parsed);
    
    return {
      command,
      predictedEffects,
      riskIndicators,
      metadata
    };
  }

  /**
   * 预测命令执行效果
   */
  private predictEffects(parsed: ParsedCommand, params?: ExecParams): PredictedEffect[] {
    const effects: PredictedEffect[] = [];
    
    // 如果是管道或命令链，递归处理
    if (parsed.pipes) {
      for (const pipe of parsed.pipes) {
        effects.push(...this.predictSingleCommandEffects(pipe, params));
      }
    } else {
      effects.push(...this.predictSingleCommandEffects(parsed, params));
    }
    
    return effects;
  }

  /**
   * 预测单条命令的效果
   */
  private predictSingleCommandEffects(
    parsed: ParsedCommand, 
    params?: ExecParams
  ): PredictedEffect[] {
    const effects: PredictedEffect[] = [];
    const cmd = parsed.command;
    const args = parsed.args;
    
    // 文件操作命令
    if (this.isFileOperationCommand(cmd)) {
      effects.push(...this.predictFileEffects(cmd, args, parsed.redirects));
    }
    
    // 网络操作命令
    if (this.isNetworkCommand(cmd)) {
      effects.push(...this.predictNetworkEffects(cmd, args));
    }
    
    // 权限操作命令
    if (this.isPermissionCommand(cmd)) {
      effects.push(...this.predictPermissionEffects(cmd, args));
    }
    
    // 进程操作命令
    if (this.isProcessCommand(cmd)) {
      effects.push(...this.predictProcessEffects(cmd, args));
    }
    
    // 检查 elevated 权限
    if (params?.elevated || params?.security === 'full') {
      effects.push({
        type: 'permission_change',
        target: 'system',
        description: `命令将以提升权限执行 (${params.elevated ? 'elevated' : params.security})`,
        severity: 'high'
      });
    }
    
    return effects;
  }

  /**
   * 预测文件操作效果
   */
  private predictFileEffects(
    cmd: string, 
    args: string[],
    redirects?: Array<{ type: string; target: string }>
  ): PredictedEffect[] {
    const effects: PredictedEffect[] = [];
    
    // 提取文件路径
    const paths = this.extractFilePathsFromArgs(cmd, args);
    
    switch (cmd) {
      case 'rm':
        for (const path of paths) {
          const severity = this.assessPathSeverity(path);
          effects.push({
            type: 'file_delete',
            target: path,
            description: `将删除文件/目录: ${path}`,
            severity: severity === 'critical' ? 'critical' : 'high'
          });
        }
        break;
        
      case 'cp':
        if (paths.length >= 2) {
          const source = paths[0];
          const dest = paths[paths.length - 1];
          effects.push({
            type: 'file_create',
            target: dest,
            description: `将复制 ${source} 到 ${dest}`,
            severity: this.assessPathSeverity(dest)
          });
        }
        break;
        
      case 'mv':
        if (paths.length >= 2) {
          const source = paths[0];
          const dest = paths[paths.length - 1];
          effects.push({
            type: 'file_modify',
            target: source,
            description: `将移动 ${source} 到 ${dest}`,
            severity: this.assessPathSeverity(source)
          });
          effects.push({
            type: 'file_create',
            target: dest,
            description: `将在目标位置创建: ${dest}`,
            severity: this.assessPathSeverity(dest)
          });
        }
        break;
        
      case 'touch':
        for (const path of paths) {
          effects.push({
            type: 'file_create',
            target: path,
            description: `将创建文件: ${path}`,
            severity: 'low'
          });
        }
        break;
        
      case 'mkdir':
        for (const path of paths) {
          effects.push({
            type: 'file_create',
            target: path,
            description: `将创建目录: ${path}`,
            severity: 'low'
          });
        }
        break;
        
      case 'cat':
      case 'less':
      case 'more':
      case 'head':
 case 'tail':
        for (const path of paths) {
          effects.push({
            type: 'file_modify', // 读取也算一种"修改"访问
            target: path,
            description: `将读取文件: ${path}`,
            severity: this.assessPathSeverity(path)
          });
        }
        break;
        
      case 'chmod':
      case 'chown':
      case 'chgrp':
        for (const path of paths) {
          effects.push({
            type: 'permission_change',
            target: path,
            description: `将修改 ${path} 的权限/所有者`,
            severity: this.assessPathSeverity(path)
          });
        }
        break;
    }
    
    // 处理重定向
    if (redirects) {
      for (const redirect of redirects) {
        if (redirect.type === '>' || redirect.type === '>>') {
          effects.push({
            type: redirect.type === '>' ? 'file_modify' : 'file_create',
            target: redirect.target,
            description: `将${redirect.type === '>' ? '覆盖' : '追加'}写入: ${redirect.target}`,
            severity: this.assessPathSeverity(redirect.target)
          });
        }
      }
    }
    
    return effects;
  }

  /**
   * 预测网络操作效果
   */
  private predictNetworkEffects(cmd: string, args: string[]): PredictedEffect[] {
    const effects: PredictedEffect[] = [];
    
    // 提取网络目标
    const targets = commandParser.extractNetworkTargets({
      raw: '',
      command: cmd,
      args
    });
    
    for (const target of targets) {
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
      
      // 评估目标风险
      if (target.includes('localhost') || target.includes('127.0.0.1')) {
        severity = 'medium';
      } else if (/^\d+\.\d+\.\d+\.\d+$/.test(target)) {
        // IP 地址
        severity = 'high';
      } else if (target.includes('internal') || target.includes('private')) {
        severity = 'high';
      }
      
      effects.push({
        type: 'network_request',
        target,
        description: `将发起网络请求到: ${target}`,
        severity
      });
    }
    
    return effects;
  }

  /**
   * 预测权限操作效果
   */
  private predictPermissionEffects(cmd: string, _args: string[]): PredictedEffect[] {
    const effects: PredictedEffect[] = [];
    
    if (cmd === 'sudo' || cmd === 'su' || cmd === 'doas') {
      effects.push({
        type: 'permission_change',
        target: 'process',
        description: `将提升进程权限 (${cmd})`,
        severity: 'high'
      });
    }
    
    return effects;
  }

  /**
   * 预测进程操作效果
   */
  private predictProcessEffects(cmd: string, args: string[]): PredictedEffect[] {
    const effects: PredictedEffect[] = [];
    
    // 后台运行
    if (args.some(arg => arg === '&')) {
      effects.push({
        type: 'process_spawn',
        target: cmd,
        description: `将在后台启动进程: ${cmd}`,
        severity: 'medium'
      });
    }
    
    return effects;
  }

  /**
   * 识别风险指标
   */
  private identifyRisks(
    parsed: ParsedCommand,
    params?: ExecParams,
    _effects?: PredictedEffect[]
  ): RiskIndicator[] {
    const indicators: RiskIndicator[] = [];
    
    // 1. 命令类型风险
    if (commandParser.isDangerousCommand(parsed)) {
      indicators.push({
        category: 'command_type',
        description: '命令属于高风险类型',
        severity: 'high',
        evidence: [parsed.command]
      });
    }
    
    // 2. 递归/强制标志
    if (commandParser.hasRecursiveOrForceFlag(parsed)) {
      indicators.push({
        category: 'command_type',
        description: '命令包含递归或强制选项',
        severity: 'critical',
        evidence: ['-r/-f flags detected']
      });
    }
    
    // 3. 权限提升
    if (params?.elevated || parsed.command === 'sudo' || parsed.command === 'su') {
      indicators.push({
        category: 'permission_escalation',
        description: '命令将提升执行权限',
        severity: 'high',
        evidence: [params?.elevated ? 'elevated=true' : parsed.command]
      });
    }
    
    // 4. 敏感路径访问
    const filePaths = commandParser.extractFilePaths(parsed);
    const sensitivePaths = filePaths.filter(p => this.isSensitivePath(p));
    if (sensitivePaths.length > 0) {
      indicators.push({
        category: 'data_exfiltration',
        description: '命令访问敏感文件路径',
        severity: 'critical',
        evidence: sensitivePaths
      });
    }
    
    // 5. 网络外连
    const networkTargets = commandParser.extractNetworkTargets(parsed);
    const externalTargets = networkTargets.filter(t => 
      !t.includes('localhost') && 
      !t.includes('127.0.0.1') &&
      !t.startsWith('10.') &&
      !t.startsWith('192.168.')
    );
    if (externalTargets.length > 0) {
      indicators.push({
        category: 'data_exfiltration',
        description: '命令将连接外部网络',
        severity: 'high',
        evidence: externalTargets
      });
    }
    
    // 6. 持久化行为检测
    if (this.isPersistenceCommand(parsed)) {
      indicators.push({
        category: 'persistence',
        description: '命令可能用于建立持久化后门',
        severity: 'critical',
        evidence: [parsed.command, ...parsed.args]
      });
    }
    
    return indicators;
  }

  /**
   * 收集元数据
   */
  private collectMetadata(parsed: ParsedCommand): SimulationMetadata {
    const parsedCommands: ParsedCommand[] = [];
    
    // 扁平化命令列表
    if (parsed.pipes) {
      parsedCommands.push(...parsed.pipes);
    } else {
      parsedCommands.push(parsed);
    }
    
    return {
      parsedCommands,
      environmentVariables: commandParser.extractEnvironmentVariables(parsed.raw),
      networkTargets: commandParser.extractNetworkTargets(parsed),
      filePaths: commandParser.extractFilePaths(parsed),
      duration: Date.now() - this.startTime
    };
  }

  /**
   * 判断是否是文件操作命令
   */
  private isFileOperationCommand(cmd: string): boolean {
    const fileCommands = [
      'cat', 'less', 'more', 'head', 'tail',
      'rm', 'cp', 'mv', 'touch', 'mkdir', 'rmdir',
      'chmod', 'chown', 'chgrp', 'tar', 'zip', 'unzip',
      'ls', 'find', 'grep', 'awk', 'sed'
    ];
    return fileCommands.includes(cmd);
  }

  /**
   * 判断是否是网络命令
   */
  private isNetworkCommand(cmd: string): boolean {
    const networkCommands = [
      'curl', 'wget', 'nc', 'ncat', 'telnet', 'ssh', 'scp',
      'ping', 'host', 'dig', 'nslookup'
    ];
    return networkCommands.includes(cmd);
  }

  /**
   * 判断是否是权限命令
   */
  private isPermissionCommand(cmd: string): boolean {
    return ['sudo', 'su', 'doas', 'chmod', 'chown', 'chgrp'].includes(cmd);
  }

  /**
   * 判断是否是进程命令
   */
  private isProcessCommand(cmd: string): boolean {
    return ['nohup', 'bg', 'fg', 'jobs', 'kill', 'pkill'].includes(cmd);
  }

  /**
   * 判断是否是持久化命令
   */
  private isPersistenceCommand(parsed: ParsedCommand): boolean {
    const persistenceCommands = [
      'crontab', 'systemctl', 'service', 'launchctl',
      'defaults', 'reg', 'schtasks'
    ];
    
    // 检查主命令
    if (persistenceCommands.includes(parsed.command)) {
      return true;
    }
    
    // 检查是否修改启动文件
    const startupFiles = [
      '.bashrc', '.zshrc', '.bash_profile', '.profile',
      'config.json', 'settings.json'
    ];
    
    const filePaths = commandParser.extractFilePaths(parsed);
    return filePaths.some(p => 
      startupFiles.some(f => p.includes(f))
    );
  }

  /**
   * 从参数中提取文件路径
   */
  private extractFilePathsFromArgs(_cmd: string, args: string[]): string[] {
    // 过滤掉选项，保留路径
    return args.filter(arg => 
      !arg.startsWith('-') && 
      !arg.startsWith('--') &&
      (arg.includes('/') || arg.includes('\\') || arg.includes('.'))
    );
  }

  /**
   * 评估路径严重程度
   */
  private assessPathSeverity(path: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalPaths = [
      '/etc/passwd', '/etc/shadow', '/etc/sudoers',
      '~/.ssh', '/root', '/System', 'C:\\Windows',
      'registry', 'HKEY'
    ];
    
    const highPaths = [
      '/etc', '/usr', '/bin', '/sbin',
      '~/.bashrc', '~/.profile', '~/.zshrc',
      'Program Files', 'System32'
    ];
    
    if (criticalPaths.some(p => path.includes(p))) {
      return 'critical';
    }
    
    if (highPaths.some(p => path.includes(p))) {
      return 'high';
    }
    
    if (path.startsWith('/') || path.includes(':\\')) {
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
      'password', 'secret', 'token', 'credential',
      'wallet', 'private'
    ];
    
    return sensitivePatterns.some(pattern => 
      path.toLowerCase().includes(pattern.toLowerCase())
    );
  }
}

// 导出单例
export const mentalSimulation = new MentalSimulationEngine();
