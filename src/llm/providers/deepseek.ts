/**
 * DeepSeek 提供商
 */

import { BaseLLMProvider, type LLMRequest, type LLMResponse } from './base.js';

export class DeepSeekProvider extends BaseLLMProvider {
  protected defineCapabilities() {
    return {
      supportsStreaming: true,
      supportsSystemPrompt: true,
      supportsContext: true,
      maxContextLength: 64000,
      supportedModels: [
        'deepseek-chat',
        'deepseek-reasoner',
        'deepseek-coder'
      ]
    };
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || 'https://api.deepseek.com/v1';
    
    const messages: Array<{ role: string; content: string }> = [];
    
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    
    if (request.context) {
      for (const ctx of request.context) {
        messages.push({ role: 'user', content: ctx });
      }
    }
    
    messages.push({ role: 'user', content: request.prompt });

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as DeepSeekResponse;

    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      },
      model: data.model,
      provider: 'deepseek'
    };
  }

  async validateConfig(): Promise<boolean> {
    try {
      const response = await fetch('https://api.deepseek.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  getProviderName(): string {
    return 'DeepSeek';
  }
}

// DeepSeek API 类型定义
interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}
