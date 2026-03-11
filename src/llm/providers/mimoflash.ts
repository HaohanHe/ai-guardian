/**
 * 小米 MiMoFlash 提供商
 */

import { BaseLLMProvider, type LLMRequest, type LLMResponse } from './base.js';

export class MiMoFlashProvider extends BaseLLMProvider {
  protected defineCapabilities() {
    return {
      supportsStreaming: true,
      supportsSystemPrompt: true,
      supportsContext: true,
      maxContextLength: 32000,
      supportedModels: [
        'mimoflash-v2',
        'mimoflash-v1',
        'mimo-v2-flash',
        'mimo-v1-flash'
      ]
    };
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || 'https://api.xiaomimimo.com/v1';
    
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

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model || 'mimo-v2-flash',
          messages,
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.maxTokens ?? 4096
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MiMoFlash API error: ${response.status} ${errorText}`);
      }

      const data = await response.json() as MiMoFlashResponse;

      return {
        content: data.choices[0].message.content,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0
        },
        model: data.model || this.config.model || 'mimo-v2-flash',
        provider: 'mimoflash'
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('fetch failed')) {
        throw new Error(`MiMoFlash API connection failed. Please check your network connection and API key. Original error: ${error.message}`);
      }
      throw error;
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      const response = await fetch('https://api.mi.com/ai/v1/models', {
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
    return 'MiMoFlash (小米)';
  }
}

// MiMoFlash API 类型定义
interface MiMoFlashResponse {
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
