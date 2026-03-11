/**
 * LLM 提供商基类
 * 
 * 统一的 LLM 接口，支持多种云服务提供商
 */

import type { LLMAnalysis } from '../../core/types.js';

/**
 * LLM 配置
 */
export interface LLMConfig {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

/**
 * LLM 请求
 */
export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  context?: string[];
}

/**
 * LLM 响应
 */
export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
}

/**
 * 提供商特性
 */
export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsSystemPrompt: boolean;
  supportsContext: boolean;
  maxContextLength: number;
  supportedModels: string[];
}

/**
 * LLM 提供商基类
 */
export abstract class BaseLLMProvider {
  protected config: LLMConfig;
  protected capabilities: ProviderCapabilities;

  constructor(config: LLMConfig) {
    this.config = {
      temperature: 0,
      maxTokens: 500,
      timeout: 30000,
      ...config
    };
    
    this.capabilities = this.defineCapabilities();
  }

  /**
   * 定义提供商特性
   */
  protected abstract defineCapabilities(): ProviderCapabilities;

  /**
   * 发送请求
   */
  abstract complete(request: LLMRequest): Promise<LLMResponse>;

  /**
   * 分析命令
   */
  async analyzeCommand(command: string, context?: string[]): Promise<LLMAnalysis> {
    const systemPrompt = `你是一个 AI 安全分析专家。请分析以下命令的安全风险。

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

    const prompt = `请分析以下命令：\n\n${command}\n\n${context ? `上下文：\n${context.join('\n')}` : ''}`;

    const response = await this.complete({
      prompt,
      systemPrompt,
      context
    });

    return this.parseAnalysisResponse(response, command);
  }

  /**
   * 解析分析响应
   */
  protected parseAnalysisResponse(response: LLMResponse, _command: string): LLMAnalysis {
    const content = response.content;
    
    // 提取意图
    const intentMatch = content.match(/意图[：:]\s*(.+?)(?=\n|$)/);
    const intent = intentMatch ? intentMatch[1].trim() : '未知';
    
    // 提取风险
    const riskMatches = content.match(/风险[：:]\s*([\s\S]*?)(?=建议|$)/);
    const hiddenRisks: string[] = [];
    if (riskMatches) {
      const risks = riskMatches[1].trim().split('\n');
      for (const risk of risks) {
        const trimmed = risk.trim();
        if (trimmed && !trimmed.startsWith('风险')) {
          hiddenRisks.push(trimmed.replace(/^[-•*]\s*/, ''));
        }
      }
    }
    
    return {
      intent,
      hiddenRisks: hiddenRisks.length > 0 ? hiddenRisks : ['未识别到明显风险'],
      tokenUsage: {
        prompt: response.usage.promptTokens,
        completion: response.usage.completionTokens,
        total: response.usage.totalTokens
      }
    };
  }

  /**
   * 获取特性
   */
  getCapabilities(): ProviderCapabilities {
    return this.capabilities;
  }

  /**
   * 验证配置
   */
  abstract validateConfig(): Promise<boolean>;

  /**
   * 获取提供商名称
   */
  abstract getProviderName(): string;
}
