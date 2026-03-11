/**
 * 命令解析器 - 推演预判引擎的核心
 * 
 * 学习 OpenClaw 的设计，实现 Shell 命令的静态分析
 * 绝不真正执行命令，只在脑海中推演
 */

import type { ParsedCommand, Redirect } from '../core/types.js';

/**
 * 命令解析器类
 */
export class CommandParser {
  /**
   * 解析命令字符串
   */
  parse(command: string): ParsedCommand {
    const trimmed = command.trim();
    
    // 首先检查管道
    if (trimmed.includes('|')) {
      return this.parsePipeline(trimmed);
    }
    
    // 检查命令分隔符
    if (trimmed.includes(';') || trimmed.includes('&&') || trimmed.includes('||')) {
      return this.parseCommandChain(trimmed);
    }
    
    // 单条命令
    return this.parseSingleCommand(trimmed);
  }

  /**
   * 解析管道命令
   */
  private parsePipeline(command: string): ParsedCommand {
    const parts = this.splitByPipe(command);
    const commands = parts.map(part => this.parseSingleCommand(part.trim()));
    
    return {
      raw: command,
      command: 'pipeline',
      args: [],
      pipes: commands
    };
  }

  /**
   * 按管道分割，考虑引号
   */
  private splitByPipe(command: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuote: string | null = null;
    
    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      
      // 处理引号
      if ((char === '"' || char === "'") && !inQuote) {
        inQuote = char;
        current += char;
      } else if (char === inQuote) {
        inQuote = null;
        current += char;
      } else if (char === '|' && !inQuote) {
        // 检查是否是 || 操作符
        if (command[i + 1] === '|') {
          current += char;
        } else {
          parts.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      parts.push(current.trim());
    }
    
    return parts;
  }

  /**
   * 解析命令链 (使用 ; && ||)
   */
  private parseCommandChain(command: string): ParsedCommand {
    // 简化处理：先按 ; 分割
    const parts = command.split(';').map(p => p.trim()).filter(p => p);
    
    if (parts.length === 1) {
      return this.parseSingleCommand(parts[0]);
    }
    
    return {
      raw: command,
      command: 'chain',
      args: [],
      pipes: parts.map(p => this.parse(p))
    };
  }

  /**
   * 解析单条命令
   */
  private parseSingleCommand(command: string): ParsedCommand {
    // 提取重定向
    const { command: cmdWithoutRedirect, redirects } = this.extractRedirects(command);
    
    // 分词
    const tokens = this.tokenize(cmdWithoutRedirect);
    
    if (tokens.length === 0) {
      return {
        raw: command,
        command: '',
        args: [],
        redirects
      };
    }
    
    return {
      raw: command,
      command: tokens[0],
      args: tokens.slice(1),
      redirects
    };
  }

  /**
   * 提取重定向
   */
  private extractRedirects(command: string): { command: string; redirects: Redirect[] } {
    const redirects: Redirect[] = [];
    let remaining = command;
    
    // 匹配重定向模式
    const redirectPatterns = [
      { regex: /2>>\s*(\S+)/g, type: '2>>' as const },
      { regex: /2>\s*(\S+)/g, type: '2>' as const },
      { regex: />>\s*(\S+)/g, type: '>>' as const },
      { regex: />\s*(\S+)/g, type: '>' as const },
      { regex: /<\s*(\S+)/g, type: '<' as const }
    ];
    
    for (const { regex, type } of redirectPatterns) {
      let match;
      while ((match = regex.exec(command)) !== null) {
        redirects.push({
          type,
          target: match[1]
        });
        remaining = remaining.replace(match[0], '');
      }
    }
    
    return { command: remaining.trim(), redirects };
  }

  /**
   * 分词
   */
  private tokenize(command: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuote: string | null = null;
    
    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      
      if ((char === '"' || char === "'") && !inQuote) {
        // 开始引号
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
        inQuote = char;
      } else if (char === inQuote) {
        // 结束引号
        tokens.push(current);
        current = '';
        inQuote = null;
      } else if (char === ' ' && !inQuote) {
        // 空格分隔
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      tokens.push(current.trim());
    }
    
    return tokens;
  }

  /**
   * 获取命令中的文件路径
   */
  extractFilePaths(command: ParsedCommand): string[] {
    const paths: string[] = [];
    
    // 递归处理管道
    if (command.pipes) {
      for (const pipe of command.pipes) {
        paths.push(...this.extractFilePaths(pipe));
      }
    }
    
    // 提取重定向中的路径
    if (command.redirects) {
      for (const redirect of command.redirects) {
        paths.push(redirect.target);
      }
    }
    
    // 根据命令类型提取路径
    const fileCommands = [
      'cat', 'less', 'more', 'head', 'tail', 'grep', 'awk', 'sed',
      'rm', 'cp', 'mv', 'touch', 'mkdir', 'rmdir', 'ls', 'find',
      'chmod', 'chown', 'chgrp', 'tar', 'zip', 'unzip',
      'source', '.', 'sh', 'bash', 'python', 'node', 'ruby'
    ];
    
    if (fileCommands.includes(command.command)) {
      // 过滤掉选项，保留路径参数
      for (const arg of command.args) {
        if (!arg.startsWith('-') && !arg.startsWith('--')) {
          paths.push(arg);
        }
      }
    }
    
    return [...new Set(paths)]; // 去重
  }

  /**
   * 获取网络目标
   */
  extractNetworkTargets(command: ParsedCommand): string[] {
    const targets: string[] = [];
    
    // 递归处理管道
    if (command.pipes) {
      for (const pipe of command.pipes) {
        targets.push(...this.extractNetworkTargets(pipe));
      }
    }
    
    // 网络命令
    const networkCommands: Record<string, (args: string[]) => string[]> = {
      'curl': (args) => this.extractUrlsFromArgs(args, ['-u', '--user', '-H', '--header', '-d', '--data']),
      'wget': (args) => this.extractUrlsFromArgs(args, ['-O', '--output-document', '-U', '--user-agent']),
      'nc': (args) => this.extractHostPort(args),
      'ncat': (args) => this.extractHostPort(args),
      'ssh': (args) => args.filter(a => !a.startsWith('-') && a.includes('@')).map(a => a.split('@')[1]),
      'scp': (args) => args.filter(a => a.includes(':') && !a.startsWith('-')).map(a => a.split(':')[0]),
      'ping': (args) => args.filter(a => !a.startsWith('-') && !a.startsWith('--')),
      'host': (args) => args.filter(a => !a.startsWith('-')),
      'dig': (args) => args.filter(a => !a.startsWith('-') && !a.startsWith('+'))
    };
    
    const extractor = networkCommands[command.command];
    if (extractor) {
      targets.push(...extractor(command.args));
    }
    
    return [...new Set(targets)];
  }

  /**
   * 从参数中提取 URL
   */
  private extractUrlsFromArgs(args: string[], optionValues: string[]): string[] {
    const urls: string[] = [];
    let skipNext = false;
    
    for (let i = 0; i < args.length; i++) {
      if (skipNext) {
        skipNext = false;
        continue;
      }
      
      const arg = args[i];
      
      // 跳过选项值
      if (optionValues.includes(arg)) {
        skipNext = true;
        continue;
      }
      
      // 跳过以 - 开头的选项
      if (arg.startsWith('-')) {
        continue;
      }
      
      // 看起来像是 URL
      if (arg.startsWith('http://') || arg.startsWith('https://') || 
          arg.startsWith('ftp://') || arg.includes('.')) {
        urls.push(arg);
      }
    }
    
    return urls;
  }

  /**
   * 提取主机和端口
   */
  private extractHostPort(args: string[]): string[] {
    const targets: string[] = [];
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      // 跳过选项
      if (arg.startsWith('-')) {
        continue;
      }
      
      // 检查是否是主机:端口格式
      if (/^[\w.-]+(:\d+)?$/.test(arg)) {
        targets.push(arg);
      }
    }
    
    return targets;
  }

  /**
   * 获取环境变量
   */
  extractEnvironmentVariables(command: string): string[] {
    const vars: string[] = [];
    const pattern = /\$\{?(\w+)\}?/g;
    let match;
    
    while ((match = pattern.exec(command)) !== null) {
      vars.push(match[1]);
    }
    
    return [...new Set(vars)];
  }

  /**
   * 检查是否是危险命令
   */
  isDangerousCommand(command: ParsedCommand): boolean {
    const dangerousCommands = [
      'rm', 'dd', 'mkfs', 'fdisk', 'format',
      'sudo', 'su', 'doas',
      'chmod', 'chown', 'chgrp', 'chattr',
      'wget', 'curl', 'nc', 'ncat', 'telnet'
    ];
    
    // 检查主命令
    if (dangerousCommands.includes(command.command)) {
      return true;
    }
    
    // 递归检查管道
    if (command.pipes) {
      return command.pipes.some(pipe => this.isDangerousCommand(pipe));
    }
    
    return false;
  }

  /**
   * 检查是否包含递归/强制选项
   */
  hasRecursiveOrForceFlag(command: ParsedCommand): boolean {
    const dangerousFlags = ['-r', '-R', '--recursive', '-f', '--force', '-rf', '-fr'];
    
    for (const arg of command.args) {
      if (dangerousFlags.some(flag => arg.includes(flag))) {
        return true;
      }
    }
    
    // 递归检查管道
    if (command.pipes) {
      return command.pipes.some(pipe => this.hasRecursiveOrForceFlag(pipe));
    }
    
    return false;
  }
}

// 导出单例
export const commandParser = new CommandParser();
