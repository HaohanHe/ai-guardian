/**
 * Alibaba Qwen (通义千问) Provider
 * 
 * 支持阿里云通义千问 API (qwen-max, qwen-plus, qwen-turbo 等)
 */

import { BaseLLMProvider } from './base.js';
import type { LLMRequest, LLMResponse, ProviderCapabilities } from './base.js';

export class QwenProvider extends BaseLLMProvider {
  protected defineCapabilities(): ProviderCapabilities {
    return {
      supportedModels: [
        'qwen-max',
        'qwen-max-latest',
        'qwen-plus',
        'qwen-plus-latest',
        'qwen-turbo',
        'qwen-turbo-latest',
        'qwen-coder-plus',
        'qwen-coder-turbo',
        'qwen-math-plus',
        'qwen-math-turbo'
      ],
      maxContextLength: 32000, // qwen-max 支持 32k 上下文
      supportsStreaming: true,
      supportsSystemPrompt: true,
      supportsContext: true
    };
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || 'https://dashscope.aliyuncs.com/api/v1';
    const model = this.config.model || 'qwen-max';
    
    // 构建 Qwen 格式的请求
    const qwenRequest = this.buildQwenRequest(request, model);
    
    const response = await fetch(`${baseUrl}/services/aigc/text-generation/generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(qwenRequest)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Qwen API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as QwenResponse;
    return this.parseQwenResponse(data);
  }

  /**
   * 构建 Qwen 请求格式
   */
  private buildQwenRequest(request: LLMRequest, model: string): QwenRequest {
    const messages: QwenMessage[] = [];

    // 系统提示词
    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.systemPrompt
      });
    }

    // 添加上下文作为历史消息
    if (request.context && request.context.length > 0) {
      // 将上下文作为 system message 的一部分
      const contextMessage = messages.find(m => m.role === 'system');
      const contextText = '\n\n[上下文信息]\n' + request.context.join('\n---\n');
      
      if (contextMessage) {
        contextMessage.content += contextText;
      } else {
        messages.push({
          role: 'system',
          content: `[上下文信息]\n${request.context.join('\n---\n')}`
        });
      }
    }

    // 用户提示词
    messages.push({
      role: 'user',
      content: request.prompt
    });

    return {
      model,
      input: {
        messages
      },
      parameters: {
        result_format: 'message',
        max_tokens: 2048,
        temperature: 0.3,
        top_p: 0.8,
        top_k: 40,
        enable_search: false // 关闭联网搜索以获得更稳定的输出
      }
    };
  }

  /**
   * 解析 Qwen 响应
   */
  private parseQwenResponse(data: QwenResponse): LLMResponse {
    if (data.code) {
      throw new Error(`Qwen API error: ${data.code} - ${data.message}`);
    }

    if (!data.output || !data.output.choices || data.output.choices.length === 0) {
      throw new Error('Empty response from Qwen API');
    }

    const choice = data.output.choices[0];
    const message = choice.message;

    return {
      content: message.content,
      model: data.output.model || 'qwen',
      provider: 'qwen',
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      }
    };
  }

  getProviderName(): string {
    return 'Alibaba Qwen (通义千问)';
  }

  async validateConfig(): Promise<boolean> {
    try {
      // 尝试一个简单的请求来验证配置
      await this.complete({
        prompt: '你好'
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取模型描述
   */
  getModelDescription(model: string): string {
    const descriptions: Record<string, string> = {
      'qwen-max': '通义千问 Max - 最强模型，适合复杂任务',
      'qwen-max-latest': '通义千问 Max 最新版',
      'qwen-plus': '通义千问 Plus - 平衡性能和成本',
      'qwen-plus-latest': '通义千问 Plus 最新版',
      'qwen-turbo': '通义千问 Turbo - 快速响应，成本较低',
      'qwen-turbo-latest': '通义千问 Turbo 最新版',
      'qwen-coder-plus': '通义千问 Coder Plus - 专为编程优化',
      'qwen-coder-turbo': '通义千问 Coder Turbo - 快速编程助手',
      'qwen-math-plus': '通义千问 Math Plus - 数学推理专用',
      'qwen-math-turbo': '通义千问 Math Turbo - 快速数学助手'
    };
    return descriptions[model] || model;
  }
}

// Qwen API 类型定义
interface QwenRequest {
  model: string;
  input: {
    messages: QwenMessage[];
  };
  parameters: {
    result_format: 'message' | 'text';
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    enable_search?: boolean;
  };
}

interface QwenMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface QwenResponse {
  code?: string;
  message?: string;
  output?: {
    model?: string;
    choices: Array<{
      message: QwenMessage;
      finish_reason: string;
    }>;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}
