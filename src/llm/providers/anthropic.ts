/**
 * Anthropic Claude 提供商
 */

import { BaseLLMProvider, type LLMRequest, type LLMResponse } from './base.js';

export class AnthropicProvider extends BaseLLMProvider {
  protected defineCapabilities() {
    return {
      supportsStreaming: true,
      supportsSystemPrompt: true,
      supportsContext: true,
      maxContextLength: 200000,
      supportedModels: [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307'
      ]
    };
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || 'https://api.anthropic.com/v1';
    
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    
    if (request.context) {
      for (let i = 0; i < request.context.length; i++) {
        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: request.context[i]
        });
      }
    }
    
    messages.push({ role: 'user', content: request.prompt });

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature
    };
    
    if (request.systemPrompt) {
      body.system = request.systemPrompt;
    }

    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as AnthropicResponse;
    
    return {
      content: data.content[0].text,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens
      },
      model: data.model,
      provider: 'anthropic'
    };
  }

  async validateConfig(): Promise<boolean> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  getProviderName(): string {
    return 'Anthropic';
  }
}

// Anthropic API 类型定义
interface AnthropicResponse {
  content: Array<{ text: string }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  model: string;
}
