/**
 * AI Agent 检测器
 * 
 * 识别请求来源：AI IDE (Trae/Cursor/VSCode) / OpenClaw / 其他 MCP 客户端
 */



/**
 * Agent 类型
 */
export type AgentType = 
  | 'trae'           // Trae IDE
  | 'cursor'         // Cursor IDE
  | 'vscode'         // VSCode + AI 插件
  | 'claude-code'    // Claude Code
  | 'openclaw'       // OpenClaw
  | 'clawbot'        // Clawbot (旧版)
  | 'moltbot'        // MoltBot (旧版)
  | 'generic-mcp'    // 通用 MCP 客户端
  | 'unknown';       // 未知来源

/**
 * Agent 信息
 */
export interface AgentInfo {
  type: AgentType;
  name: string;
  version?: string;
  isTrusted: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  features: AgentFeatures;
}

/**
 * Agent 特性
 */
export interface AgentFeatures {
  supportsElevated: boolean;      // 是否支持提权
  supportsBrowser: boolean;       // 是否支持浏览器控制
  supportsFileEdit: boolean;      // 是否支持文件编辑
  supportsAutoExecution: boolean; // 是否支持自动执行
  requiresConfirmation: boolean;  // 是否需要确认
}

/**
 * 请求上下文
 */
export interface RequestContext {
  userAgent?: string;
  headers?: Record<string, string>;
  clientIp?: string;
  sessionId: string;
  timestamp: number;
}

/**
 * Agent 检测器
 */
export class AgentDetector {
  /**
   * 检测 Agent 类型
   */
  detectAgent(context: RequestContext): AgentInfo {
    const userAgent = context.userAgent || '';
    const headers = context.headers || {};
    
    // 1. 检测 Trae IDE
    if (this.isTrae(userAgent, headers)) {
      return this.createTraeInfo();
    }
    
    // 2. 检测 Cursor IDE
    if (this.isCursor(userAgent, headers)) {
      return this.createCursorInfo();
    }
    
    // 3. 检测 VSCode AI 插件
    if (this.isVSCode(userAgent, headers)) {
      return this.createVSCodeInfo();
    }
    
    // 4. 检测 Claude Code
    if (this.isClaudeCode(userAgent, headers)) {
      return this.createClaudeCodeInfo();
    }
    
    // 5. 检测 OpenClaw / Clawbot / MoltBot
    if (this.isOpenClaw(userAgent, headers)) {
      return this.createOpenClawInfo();
    }
    
    // 6. 检测通用 MCP 客户端
    if (this.isGenericMCP(userAgent, headers)) {
      return this.createGenericMCPInfo();
    }
    
    // 未知来源
    return this.createUnknownInfo();
  }

  /**
   * 检测 Trae IDE
   */
  private isTrae(userAgent: string, headers: Record<string, string>): boolean {
    const indicators = [
      'trae',
      'Trae',
      'TRAe',
      'trae-ai',
      'TraeAI'
    ];
    
    return indicators.some(i => 
      userAgent.includes(i) || 
      headers['x-ide-name']?.includes(i) ||
      headers['x-client-name']?.includes(i)
    );
  }

  /**
   * 检测 Cursor IDE
   */
  private isCursor(userAgent: string, headers: Record<string, string>): boolean {
    const indicators = [
      'cursor',
      'Cursor',
      'CURSOR',
      'cursor.sh',
      'cursor-ai'
    ];
    
    return indicators.some(i => 
      userAgent.includes(i) || 
      headers['x-ide-name']?.includes(i) ||
      headers['x-client-name']?.includes(i)
    );
  }

  /**
   * 检测 VSCode AI 插件
   */
  private isVSCode(userAgent: string, headers: Record<string, string>): boolean {
    const indicators = [
      'vscode',
      'VSCode',
      'visual-studio-code',
      'code-oss'
    ];
    
    const hasVSCodeIndicator = indicators.some(i => 
      userAgent.includes(i) || 
      headers['x-ide-name']?.includes(i)
    );
    
    // 检查是否有 AI 插件特征
    const hasAIPlugin = 
      !!headers['x-ai-plugin'] ||
      !!headers['x-copilot'] ||
      !!headers['x-ai-assistant'] ||
      userAgent.includes('copilot') ||
      userAgent.includes('github-copilot');
    
    return hasVSCodeIndicator && hasAIPlugin;
  }

  /**
   * 检测 Claude Code
   */
  private isClaudeCode(userAgent: string, headers: Record<string, string>): boolean {
    const indicators = [
      'claude-code',
      'Claude Code',
      'claude-code-cli',
      'anthropic-claude'
    ];
    
    return indicators.some(i => 
      userAgent.includes(i) || 
      headers['x-agent-name']?.includes(i) ||
      headers['x-client-name']?.includes(i)
    );
  }

  /**
   * 检测 OpenClaw / Clawbot / MoltBot
   */
  private isOpenClaw(userAgent: string, headers: Record<string, string>): boolean {
    const indicators = [
      'openclaw',
      'OpenClaw',
      'clawbot',
      'Clawbot',
      'moltbot',
      'MoltBot',
      'claw',
      'Claw'
    ];
    
    // 检查 User-Agent
    const hasUserAgent = indicators.some(i => userAgent.includes(i));
    
    // 检查特定 Header
    const hasHeader = 
      !!headers['x-openclaw-version'] ||
      !!headers['x-clawbot-version'] ||
      !!headers['x-moltbot-version'] ||
      !!headers['x-agent-type']?.includes('claw') ||
      !!headers['x-agent-type']?.includes('clawbot');
    
    // 检查 MCP 协议特征
    const hasMCPFeature = 
      !!headers['mcp-protocol-version'] ||
      !!headers['x-mcp-version'];
    
    return hasUserAgent || hasHeader || (hasMCPFeature && this.hasOpenClawBehavior(headers));
  }

  /**
   * 检测 OpenClaw 行为特征
   */
  private hasOpenClawBehavior(headers: Record<string, string>): boolean {
    // OpenClaw 特有的行为模式
    const behaviors = [
      'x-elevated-mode',
      'x-exec-approvals',
      'x-sandbox-config',
      'x-gateway-host',
      'x-node-registry'
    ];
    
    return behaviors.some(b => headers[b] !== undefined);
  }

  /**
   * 检测通用 MCP 客户端
   */
  private isGenericMCP(userAgent: string, headers: Record<string, string>): boolean {
    return !!(
      headers['mcp-protocol-version'] ||
      headers['x-mcp-version'] ||
      userAgent.includes('mcp') ||
      userAgent.includes('model-context-protocol')
    );
  }

  /**
   * 创建 Trae 信息
   */
  private createTraeInfo(): AgentInfo {
    return {
      type: 'trae',
      name: 'Trae IDE',
      isTrusted: true,
      riskLevel: 'medium',
      features: {
        supportsElevated: false,
        supportsBrowser: false,
        supportsFileEdit: true,
        supportsAutoExecution: false,
        requiresConfirmation: true
      }
    };
  }

  /**
   * 创建 Cursor 信息
   */
  private createCursorInfo(): AgentInfo {
    return {
      type: 'cursor',
      name: 'Cursor IDE',
      isTrusted: true,
      riskLevel: 'medium',
      features: {
        supportsElevated: false,
        supportsBrowser: false,
        supportsFileEdit: true,
        supportsAutoExecution: false,
        requiresConfirmation: true
      }
    };
  }

  /**
   * 创建 VSCode 信息
   */
  private createVSCodeInfo(): AgentInfo {
    return {
      type: 'vscode',
      name: 'VSCode AI',
      isTrusted: true,
      riskLevel: 'low',
      features: {
        supportsElevated: false,
        supportsBrowser: false,
        supportsFileEdit: true,
        supportsAutoExecution: false,
        requiresConfirmation: true
      }
    };
  }

  /**
   * 创建 Claude Code 信息
   */
  private createClaudeCodeInfo(): AgentInfo {
    return {
      type: 'claude-code',
      name: 'Claude Code',
      isTrusted: true,
      riskLevel: 'high',
      features: {
        supportsElevated: true,
        supportsBrowser: false,
        supportsFileEdit: true,
        supportsAutoExecution: true,
        requiresConfirmation: false
      }
    };
  }

  /**
   * 创建 OpenClaw 信息
   */
  private createOpenClawInfo(): AgentInfo {
    return {
      type: 'openclaw',
      name: 'OpenClaw',
      isTrusted: false,  // OpenClaw 需要更严格的审查
      riskLevel: 'high',
      features: {
        supportsElevated: true,
        supportsBrowser: true,
        supportsFileEdit: true,
        supportsAutoExecution: true,
        requiresConfirmation: false
      }
    };
  }

  /**
   * 创建通用 MCP 信息
   */
  private createGenericMCPInfo(): AgentInfo {
    return {
      type: 'generic-mcp',
      name: 'Generic MCP Client',
      isTrusted: false,
      riskLevel: 'medium',
      features: {
        supportsElevated: false,
        supportsBrowser: false,
        supportsFileEdit: true,
        supportsAutoExecution: false,
        requiresConfirmation: true
      }
    };
  }

  /**
   * 创建未知来源信息
   */
  private createUnknownInfo(): AgentInfo {
    return {
      type: 'unknown',
      name: 'Unknown Agent',
      isTrusted: false,
      riskLevel: 'high',
      features: {
        supportsElevated: false,
        supportsBrowser: false,
        supportsFileEdit: false,
        supportsAutoExecution: false,
        requiresConfirmation: true
      }
    };
  }

  /**
   * 根据 Agent 类型调整风险评分
   */
  adjustRiskByAgent(riskScore: number, agentInfo: AgentInfo): number {
    let adjustedScore = riskScore;
    
    // 根据 Agent 风险等级调整
    switch (agentInfo.riskLevel) {
      case 'high':
        // 高风险 Agent，提升评分
        adjustedScore = Math.min(100, adjustedScore * 1.2);
        break;
      case 'medium':
        // 中等风险，轻微提升
        adjustedScore = Math.min(100, adjustedScore * 1.1);
        break;
      case 'low':
        // 低风险，保持原评分
        break;
    }
    
    // 如果 Agent 支持自动执行且不需要确认，增加风险
    if (agentInfo.features.supportsAutoExecution && 
        !agentInfo.features.requiresConfirmation) {
      adjustedScore = Math.min(100, adjustedScore + 10);
    }
    
    // 如果 Agent 支持提权，增加风险
    if (agentInfo.features.supportsElevated) {
      adjustedScore = Math.min(100, adjustedScore + 5);
    }
    
    // 如果 Agent 不受信任，增加风险
    if (!agentInfo.isTrusted) {
      adjustedScore = Math.min(100, adjustedScore + 15);
    }
    
    return Math.round(adjustedScore);
  }

  /**
   * 生成 Agent 特定的建议
   */
  generateAgentSpecificAdvice(agentInfo: AgentInfo, toolName: string): string[] {
    const advice: string[] = [];
    
    switch (agentInfo.type) {
      case 'openclaw':
      case 'clawbot':
      case 'moltbot':
        advice.push('⚠️ OpenClaw 具有强大的系统控制能力，请格外谨慎');
        advice.push('🔍 建议检查 /elevated 模式和 exec approvals 配置');
        if (toolName === 'browser') {
          advice.push('🌐 OpenClaw 的浏览器控制可能访问敏感页面');
        }
        if (toolName === 'exec') {
          advice.push('💻 OpenClaw 可以执行任意系统命令');
        }
        break;
        
      case 'claude-code':
        advice.push('⚠️ Claude Code 支持自动执行，请确认操作意图');
        break;
        
      case 'trae':
      case 'cursor':
      case 'vscode':
        advice.push('✅ AI IDE 通常在受限环境中运行，风险相对较低');
        break;
        
      case 'unknown':
        advice.push('🚨 未知来源的请求，建议拒绝或严格审查');
        break;
    }
    
    return advice;
  }
}

// 导出单例
export const agentDetector = new AgentDetector();
