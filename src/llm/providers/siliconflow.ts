/**
 * SiliconFlow (硅基流动) Provider
 *
 * 硅基流动提供与 OpenAI 兼容的接口，平台上托管了 DeepSeek、Qwen、
 * GLM 等多家开源模型。文档：https://docs.siliconflow.cn
 */

import { BaseLLMProvider } from './base.js';
import type { LLMRequest, LLMResponse, ProviderCapabilities } from './base.js';

const DEFAULT_BASE_URL = 'https://api.siliconflow.cn/v1';

export class SiliconFlowProvider extends BaseLLMProvider {
  protected defineCapabilities(): ProviderCapabilities {
    return {
      supportedModels: [
        'deepseek-ai/DeepSeek-V3.2',
        'deepseek-ai/DeepSeek-R1',
        'Qwen/Qwen3-8B',
        'Qwen/Qwen2.5-7B-Instruct',
        'zai-org/GLM-4.5-Air'
      ],
      maxContextLength: 128000,
      supportsStreaming: true,
      supportsSystemPrompt: true,
      supportsContext: true
    };
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;

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
        Authorization: `Bearer ${this.config.apiKey}`,
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
      throw new Error(`SiliconFlow API error: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as SiliconFlowResponse;

    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      },
      model: data.model,
      provider: 'siliconflow'
    };
  }

  async validateConfig(): Promise<boolean> {
    try {
      const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  getProviderName(): string {
    return 'SiliconFlow (硅基流动)';
  }
}

// SiliconFlow 兼容 OpenAI 的响应结构
interface SiliconFlowResponse {
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
