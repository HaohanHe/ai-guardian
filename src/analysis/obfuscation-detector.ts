/**
 * 命令混淆检测器 - Command Obfuscation Detector
 * 
 * 检测各种命令混淆技术，防止绕过安全审查
 * 参考 OpenClaw 的 exec-obfuscation-detect.ts 实现
 */

export interface ObfuscationResult {
  detected: boolean;
  techniques: ObfuscationTechnique[];
  riskScore: number;
  deobfuscated?: string;
}

export interface ObfuscationTechnique {
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string[];
}

/**
 * 混淆检测器类
 */
export class ObfuscationDetector {
  // 混淆模式定义
  private patterns: Array<{
    name: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    regex: RegExp;
  }> = [
    {
      name: 'base64_decode_execution',
      description: 'Base64 编码命令解码执行',
      severity: 'critical',
      regex: /echo\s+['"]?[A-Za-z0-9+/]{20,}=*['"]?\s*\|\s*base64\s+-d/i
    },
    {
      name: 'base64_decode_shell',
      description: 'Base64 解码后通过 shell 执行',
      severity: 'critical',
      regex: /base64\s+-d.*\|\s*(bash|sh|zsh)/i
    },
    {
      name: 'hex_escape_sequences',
      description: '十六进制转义序列',
      severity: 'high',
      regex: /\\x[0-9a-fA-F]{2}/
    },
    {
      name: 'octal_escape_sequences',
      description: '八进制转义序列',
      severity: 'high',
      regex: /\\[0-7]{3}/
    },
    {
      name: 'unicode_escape',
      description: 'Unicode 转义序列',
      severity: 'high',
      regex: /\\u[0-9a-fA-F]{4}/
    },
    {
      name: 'command_substitution_backtick',
      description: '反引号命令替换',
      severity: 'medium',
      regex: /`[^`]+`/
    },
    {
      name: 'command_substitution_dollar',
      description: '$() 命令替换',
      severity: 'medium',
      regex: /\$\([^)]+\)/
    },
    {
      name: 'variable_expansion_brace',
      description: '${} 变量扩展',
      severity: 'low',
      regex: /\$\{[^}]+\}/
    },
    {
      name: 'variable_expansion_simple',
      description: '$变量 扩展',
      severity: 'low',
      regex: /\$[a-zA-Z_][a-zA-Z0-9_]*/
    },
    {
      name: 'malicious_alias',
      description: '恶意别名定义',
      severity: 'high',
      regex: /alias\s+\w+\s*=\s*['"]?[^'"]*(?:rm|chmod|curl|wget|eval)/i
    },
    {
      name: 'eval_execution',
      description: 'eval 执行动态内容',
      severity: 'critical',
      regex: /eval\s*\$?\(?/i
    },
    {
      name: 'exec_execution',
      description: 'exec 执行动态内容',
      severity: 'critical',
      regex: /exec\s+\$?\(?/i
    },
    {
      name: 'source_execution',
      description: 'source 执行外部文件',
      severity: 'medium',
      regex: /(?:source|\.)\s+\$?\(?/i
    },
    {
      name: 'printf_format_execution',
      description: 'printf 格式化执行',
      severity: 'high',
      regex: /printf\s+['"].*['"]\s*\|\s*(bash|sh)/i
    },
    {
      name: 'paste_command_concatenation',
      description: 'paste 命令拼接',
      severity: 'medium',
      regex: /paste\s+.*\|\s*(bash|sh)/i
    },
    {
      name: 'rev_command_reversal',
      description: 'rev 命令反转',
      severity: 'medium',
      regex: /echo\s+['"]?[^'"]*['"]?\s*\|\s*rev/i
    },
    {
      name: 'tr_command_translation',
      description: 'tr 命令字符替换',
      severity: 'medium',
      regex: /tr\s+['"][^'"]*['"]\s+['"][^'"]*['"]/
    },
    {
      name: 'sed_command_substitution',
      description: 'sed 命令替换',
      severity: 'medium',
      regex: /sed\s+['"]?s\/[^\/]*\/[^\/]*\/['"]?/
    },
    {
      name: 'awk_command_execution',
      description: 'awk 系统调用',
      severity: 'high',
      regex: /awk\s+.*system\s*\(/i
    },
    {
      name: 'perl_command_execution',
      description: 'perl 系统调用',
      severity: 'high',
      regex: /perl\s+.*system\s*\(/i
    },
    {
      name: 'python_command_execution',
      description: 'python 系统调用',
      severity: 'high',
      regex: /python.*(?:os\.system|subprocess|exec\s*\()/i
    },
    {
      name: 'node_command_execution',
      description: 'node 系统调用',
      severity: 'high',
      regex: /node.*(?:child_process|exec\s*\()/i
    },
    {
      name: 'here_document_execution',
      description: 'Here Document 执行',
      severity: 'medium',
      regex: /<<\s*['"]?\w+['"]?[\s\S]*?(bash|sh|zsh)\s*$/m
    },
    {
      name: 'process_substitution',
      description: '进程替换',
      severity: 'medium',
      regex: /<\s*\([^)]+\)/
    },
    {
      name: 'double_encoding',
      description: '双重编码',
      severity: 'critical',
      regex: /(?:base64|hex|url).*?(?:base64|hex|url)/i
    }
  ];

  // 危险命令模式（用于检测混淆后的命令）
  private dangerousCommands = [
    'rm', 'dd', 'mkfs', 'fdisk', 'format',
    'chmod', 'chown', 'chattr', 'chgrp',
    'wget', 'curl', 'nc', 'ncat', 'telnet',
    'eval', 'exec', 'system', 'popen'
  ];

  /**
   * 检测命令混淆
   */
  detect(command: string): ObfuscationResult {
    const techniques: ObfuscationTechnique[] = [];
    
    // 检测各种混淆技术
    for (const pattern of this.patterns) {
      const matches = this.findMatches(command, pattern.regex);
      if (matches.length > 0) {
        techniques.push({
          name: pattern.name,
          description: pattern.description,
          severity: pattern.severity,
          evidence: matches.slice(0, 3) // 最多保留3个证据
        });
      }
    }

    // 检测字符级混淆
    const charObfuscation = this.detectCharacterObfuscation(command);
    if (charObfuscation) {
      techniques.push(charObfuscation);
    }

    // 计算风险评分
    const riskScore = this.calculateRiskScore(techniques);

    // 尝试反混淆
    const deobfuscated = techniques.length > 0 
      ? this.attemptDeobfuscation(command, techniques)
      : undefined;

    return {
      detected: techniques.length > 0,
      techniques,
      riskScore,
      deobfuscated
    };
  }

  /**
   * 查找匹配项
   */
  private findMatches(command: string, regex: RegExp): string[] {
    const matches: string[] = [];
    let match;
    const globalRegex = new RegExp(regex.source, 'gi');
    
    while ((match = globalRegex.exec(command)) !== null) {
      matches.push(match[0]);
      // 防止无限循环
      if (match.index === globalRegex.lastIndex) {
        globalRegex.lastIndex++;
      }
    }
    
    return matches;
  }

  /**
   * 检测字符级混淆
   */
  private detectCharacterObfuscation(command: string): ObfuscationTechnique | null {
    const evidence: string[] = [];
    let severity: 'low' | 'medium' | 'high' = 'low';

    // 检测单引号包裹的字符拼接
    const singleQuotePattern = /'[^']'\s*\.\s*'[^']'/g;
    const singleQuoteMatches = command.match(singleQuotePattern);
    if (singleQuoteMatches) {
      evidence.push(...singleQuoteMatches.slice(0, 2));
      severity = 'medium';
    }

    // 检测双引号包裹的字符拼接
    const doubleQuotePattern = /"[^"]"\s*\.\s*"[^"]"/g;
    const doubleQuoteMatches = command.match(doubleQuotePattern);
    if (doubleQuoteMatches) {
      evidence.push(...doubleQuoteMatches.slice(0, 2));
      severity = 'medium';
    }

    // 检测过多的字符串拼接操作
    const concatCount = (command.match(/\+\s*['"]/g) || []).length;
    if (concatCount > 5) {
      evidence.push(`检测到 ${concatCount} 次字符串拼接`);
      severity = 'high';
    }

    if (evidence.length > 0) {
      return {
        name: 'character_concatenation',
        description: '字符拼接混淆',
        severity,
        evidence
      };
    }

    return null;
  }

  /**
   * 计算风险评分
   */
  private calculateRiskScore(techniques: ObfuscationTechnique[]): number {
    if (techniques.length === 0) return 0;

    const severityWeights = {
      critical: 40,
      high: 25,
      medium: 15,
      low: 5
    };

    let score = 0;
    for (const technique of techniques) {
      score += severityWeights[technique.severity];
    }

    // 多种技术组合增加风险
    if (techniques.length >= 3) {
      score += 20;
    }

    return Math.min(100, score);
  }

  /**
   * 尝试反混淆
   */
  private attemptDeobfuscation(
    command: string, 
    techniques: ObfuscationTechnique[]
  ): string | undefined {
    let deobfuscated = command;

    // 处理 Base64 解码
    if (techniques.some(t => t.name.includes('base64'))) {
      const base64Match = command.match(/['"]?([A-Za-z0-9+/]{20,}=*)['"]?/);
      if (base64Match) {
        try {
          const decoded = Buffer.from(base64Match[1], 'base64').toString('utf-8');
          if (decoded && decoded.length > 0) {
            return `[Base64解码结果]: ${decoded}`;
          }
        } catch {
          // 解码失败，忽略
        }
      }
    }

    // 处理十六进制转义
    if (techniques.some(t => t.name.includes('hex'))) {
      const hexPattern = /\\x([0-9a-fA-F]{2})/g;
      deobfuscated = deobfuscated.replace(hexPattern, (_, hex) => {
        try {
          return String.fromCharCode(parseInt(hex, 16));
        } catch {
          return _;
        }
      });
    }

    // 处理变量扩展（简化处理）
    if (techniques.some(t => t.name.includes('variable'))) {
      // 标记变量位置
      deobfuscated = deobfuscated.replace(/\$\{?\w+\}?/g, '[变量]');
    }

    // 如果反混淆后有变化，返回结果
    if (deobfuscated !== command) {
      return deobfuscated;
    }

    return undefined;
  }

  /**
   * 检测管道混淆
   */
  detectPipelineObfuscation(commands: string[]): ObfuscationResult {
    const techniques: ObfuscationTechnique[] = [];

    // 检测危险的管道模式
    const dangerousPatterns = [
      {
        pattern: /cat\s+.*\|\s*(bash|sh|zsh)/i,
        name: 'cat_to_shell',
        description: 'cat 文件内容传递给 shell 执行',
        severity: 'critical' as const
      },
      {
        pattern: /curl.*\|\s*(bash|sh|zsh)/i,
        name: 'curl_to_shell',
        description: 'curl 下载内容直接执行',
        severity: 'critical' as const
      },
      {
        pattern: /wget.*-O-\s*\|\s*(bash|sh|zsh)/i,
        name: 'wget_to_shell',
        description: 'wget 下载内容直接执行',
        severity: 'critical' as const
      },
      {
        pattern: /echo\s+.*\|\s*(sudo|su|doas)/i,
        name: 'echo_to_elevated',
        description: 'echo 内容传递给提权命令',
        severity: 'high' as const
      }
    ];

    const fullCommand = commands.join(' | ');

    for (const pattern of dangerousPatterns) {
      if (pattern.pattern.test(fullCommand)) {
        techniques.push({
          name: pattern.name,
          description: pattern.description,
          severity: pattern.severity,
          evidence: [fullCommand]
        });
      }
    }

    // 检测多阶段混淆
    if (commands.length >= 3) {
      const obfuscationCommands = ['base64', 'rev', 'tr', 'sed', 'awk', 'cut'];
      const obfuscationCount = commands.filter(cmd => 
        obfuscationCommands.some(oc => cmd.includes(oc))
      ).length;

      if (obfuscationCount >= 2) {
        techniques.push({
          name: 'multi_stage_obfuscation',
          description: '多阶段混淆处理',
          severity: 'high',
          evidence: [`检测到 ${obfuscationCount} 个混淆处理阶段`]
        });
      }
    }

    const riskScore = this.calculateRiskScore(techniques);

    return {
      detected: techniques.length > 0,
      techniques,
      riskScore
    };
  }

  /**
   * 添加自定义检测模式
   */
  addPattern(
    name: string, 
    description: string, 
    severity: 'low' | 'medium' | 'high' | 'critical',
    regex: RegExp
  ): void {
    this.patterns.push({ name, description, severity, regex });
  }

  /**
   * 获取检测到的危险命令
   */
  extractDangerousCommands(command: string): string[] {
    const found: string[] = [];
    
    for (const dangerous of this.dangerousCommands) {
      // 简单的字符串匹配（混淆检测后的命令）
      if (command.toLowerCase().includes(dangerous)) {
        found.push(dangerous);
      }
    }

    return [...new Set(found)];
  }
}

// 导出单例
export const obfuscationDetector = new ObfuscationDetector();
