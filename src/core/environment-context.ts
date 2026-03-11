/**
 * 动态环境感知 - Environment Context
 *
 * 根据当前运行环境动态调整提示词和行为
 * "有则改之，无则加勉"
 */

import { homedir, hostname, platform, userInfo } from 'os';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface EnvironmentInfo {
  // 系统信息
  os: string;
  hostname: string;
  username: string;
  homeDir: string;
  isAdmin: boolean;

  // 运行环境
  isCI: boolean;
  isDocker: boolean;
  isVM: boolean;
  isProduction: boolean;

  // 安全环境
  hasFirewall: boolean;
  hasAntivirus: boolean;
  isTrustedNetwork: boolean;

  // OpenClaw 相关
  openClawInstalled: boolean;
  openClawRunning: boolean;
  openClawConfigPath?: string;

  // 时间上下文
  isBusinessHours: boolean;
  isWeekend: boolean;
  timezone: string;
}

export interface AdaptivePrompt {
  systemPrompt: string;
  riskThreshold: number;
  strictMode: boolean;
  additionalWarnings: string[];
}

/**
 * 环境感知管理器
 */
export class EnvironmentContext {
  private envInfo: EnvironmentInfo | null = null;

  constructor() {
    // 环境检测器
  }

  /**
   * 检测当前环境
   */
  async detect(): Promise<EnvironmentInfo> {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    this.envInfo = {
      // 系统信息
      os: platform(),
      hostname: hostname(),
      username: userInfo().username,
      homeDir: homedir(),
      isAdmin: await this.checkIsAdmin(),

      // 运行环境
      isCI: this.detectCI(),
      isDocker: this.detectDocker(),
      isVM: await this.detectVM(),
      isProduction: process.env.NODE_ENV === 'production',

      // 安全环境
      hasFirewall: await this.detectFirewall(),
      hasAntivirus: await this.detectAntivirus(),
      isTrustedNetwork: await this.detectTrustedNetwork(),

      // OpenClaw 相关
      openClawInstalled: await this.detectOpenClaw(),
      openClawRunning: await this.detectOpenClawRunning(),

      // 时间上下文
      isBusinessHours: hour >= 9 && hour < 18,
      isWeekend: day === 0 || day === 6,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    // 尝试读取 OpenClaw 配置路径
    if (this.envInfo.openClawInstalled) {
      this.envInfo.openClawConfigPath = await this.findOpenClawConfig();
    }

    return this.envInfo;
  }

  /**
   * 检查是否为管理员
   */
  private async checkIsAdmin(): Promise<boolean> {
    if (platform() === 'win32') {
      // Windows: 检查是否有管理员权限
      return process.env.PROMPT?.includes('#') || false;
    } else {
      // Unix: 检查 uid
      return process.getuid?.() === 0 || false;
    }
  }

  /**
   * 检测 CI 环境
   */
  private detectCI(): boolean {
    return !!(
      process.env.CI ||
      process.env.CONTINUOUS_INTEGRATION ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.TRAVIS ||
      process.env.CIRCLECI ||
      process.env.JENKINS_URL
    );
  }

  /**
   * 检测 Docker 环境
   */
  private detectDocker(): boolean {
    try {
      const fs = require('fs');
      const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
      return cgroup.includes('docker');
    } catch {
      return false;
    }
  }

  /**
   * 检测虚拟机
   */
  private async detectVM(): Promise<boolean> {
    // 简化检测，实际可以通过系统信息更精确判断
    return false;
  }

  /**
   * 检测防火墙
   */
  private async detectFirewall(): Promise<boolean> {
    // 简化实现
    return false;
  }

  /**
   * 检测杀毒软件
   */
  private async detectAntivirus(): Promise<boolean> {
    // 简化实现
    return false;
  }

  /**
   * 检测可信网络
   */
  private async detectTrustedNetwork(): Promise<boolean> {
    // 检查是否在公司网络或家庭网络
    // 简化实现，实际应该检查网络配置
    return false;
  }

  /**
   * 检测 OpenClaw 是否安装
   */
  private async detectOpenClaw(): Promise<boolean> {
    try {
      const openClawPaths = [
        join(homedir(), '.openclaw'),
        join(homedir(), 'openclaw'),
        '/usr/local/bin/openclaw',
        '/usr/bin/openclaw'
      ];

      for (const path of openClawPaths) {
        try {
          await fs.access(path);
          return true;
        } catch {
          continue;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 检测 OpenClaw 是否运行
   */
  private async detectOpenClawRunning(): Promise<boolean> {
    // 简化实现，实际应该检查进程
    return false;
  }

  /**
   * 查找 OpenClaw 配置
   */
  private async findOpenClawConfig(): Promise<string | undefined> {
    const configPaths = [
      join(homedir(), '.openclaw', 'config.json'),
      join(homedir(), '.openclaw', 'openclaw.json')
    ];

    for (const path of configPaths) {
      try {
        await fs.access(path);
        return path;
      } catch {
        continue;
      }
    }
    return undefined;
  }

  /**
   * 生成自适应提示词
   *
   * "有则改之，无则加勉" - 根据环境调整严格程度
   */
  generateAdaptivePrompt(): AdaptivePrompt {
    if (!this.envInfo) {
      return this.getDefaultPrompt();
    }

    const warnings: string[] = [];
    let strictMode = false;
    let riskThreshold = 50;

    // 根据环境调整
    if (this.envInfo.isAdmin) {
      warnings.push('⚠️ 当前以管理员身份运行，命令影响范围更大');
      riskThreshold -= 10;
    }

    if (this.envInfo.isProduction) {
      warnings.push('🏭 生产环境 detected，启用最高安全级别');
      strictMode = true;
      riskThreshold -= 20;
    }

    if (this.envInfo.openClawInstalled) {
      warnings.push('🦞 OpenClaw 已安装，注意防范 AI Agent 攻击');
      riskThreshold -= 10;
    }

    if (this.envInfo.isDocker) {
      warnings.push('🐳 Docker 环境 detected，注意容器逃逸风险');
    }

    if (!this.envInfo.isBusinessHours) {
      warnings.push('🌙 非工作时间，异常操作风险增加');
      riskThreshold -= 5;
    }

    if (this.envInfo.isWeekend) {
      warnings.push('📅 周末时间，建议谨慎操作生产环境');
      riskThreshold -= 5;
    }

    // 构建系统提示词
    const systemPrompt = this.buildSystemPrompt(warnings, strictMode);

    return {
      systemPrompt,
      riskThreshold: Math.max(0, Math.min(100, riskThreshold)),
      strictMode,
      additionalWarnings: warnings
    };
  }

  /**
   * 获取默认提示词
   */
  private getDefaultPrompt(): AdaptivePrompt {
    return {
      systemPrompt: this.buildSystemPrompt([], false),
      riskThreshold: 50,
      strictMode: false,
      additionalWarnings: []
    };
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(warnings: string[], strictMode: boolean): string {
    const basePrompt = `你是一个 AI 安全分析专家。请分析以下命令的安全风险。

分析维度：
1. 命令意图：这个命令想要做什么？
2. 隐藏风险：是否有不明显但危险的操作？
3. 数据流：如果涉及管道，数据如何流动？
4. 权限影响：是否会改变系统权限？
5. 持久化：是否会建立后门或持久化机制？

请用中文回复，格式如下：
意图：[命令的主要目的]
风险：[列出所有识别的风险]
建议：[安全建议]`;

    if (warnings.length === 0 && !strictMode) {
      return basePrompt;
    }

    const warningSection = warnings.length > 0
      ? `\n\n⚠️ 当前环境警告：\n${warnings.map(w => `- ${w}`).join('\n')}`
      : '';

    const strictSection = strictMode
      ? `\n\n🔒 严格模式已启用：\n- 任何风险评分 >30 的操作都需要人工确认\n- 禁止执行任何可能破坏系统的命令\n- 所有操作都会被完整记录`
      : '';

    return basePrompt + warningSection + strictSection;
  }

  /**
   * 获取环境摘要
   */
  getEnvironmentSummary(): string {
    if (!this.envInfo) {
      return '环境信息未加载';
    }

    const parts: string[] = [];

    parts.push(`🖥️ 系统: ${this.envInfo.os}`);
    parts.push(`👤 用户: ${this.envInfo.username}`);

    if (this.envInfo.isAdmin) parts.push('⚠️ 管理员权限');
    if (this.envInfo.isProduction) parts.push('🏭 生产环境');
    if (this.envInfo.isDocker) parts.push('🐳 Docker');
    if (this.envInfo.openClawInstalled) parts.push('🦞 OpenClaw 已安装');

    const timeContext = this.envInfo.isBusinessHours
      ? '工作时间'
      : this.envInfo.isWeekend
        ? '周末'
        : '非工作时间';
    parts.push(`⏰ ${timeContext}`);

    return parts.join(' | ');
  }

  /**
   * 获取环境信息
   */
  getEnvInfo(): EnvironmentInfo | null {
    return this.envInfo;
  }
}

// 导出单例
export const environmentContext = new EnvironmentContext();
