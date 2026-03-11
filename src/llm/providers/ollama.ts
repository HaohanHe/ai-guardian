/**
 * Ollama 本地模型提供商
 */

import { BaseLLMProvider, type LLMRequest, type LLMResponse } from './base.js';

export class OllamaProvider extends BaseLLMProvider {
  protected defineCapabilities() {
    return {
      supportsStreaming: true,
      supportsSystemPrompt: true,
      supportsContext: true,
      maxContextLength: 128000,
      supportedModels: [
        'llama2',
        'llama3',
        'llama3.1',
        'llama3.2',
        'mistral',
        'codellama',
        'qwen',
        'qwen2',
        'gemma',
        'gemma2',
        'phi3',
        'phi4'
      ]
    };
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || 'http://localhost:11434';
    
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

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: false,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as OllamaResponse;

    // Ollama 不返回 token 使用量，需要估算
    const promptText = messages.map(m => m.content).join(' ');
    const completionText = data.message.content;
    const estimatedPromptTokens = Math.ceil(promptText.length / 4);
    const estimatedCompletionTokens = Math.ceil(completionText.length / 4);

    return {
      content: data.message.content,
      usage: {
        promptTokens: estimatedPromptTokens,
        completionTokens: estimatedCompletionTokens,
        totalTokens: estimatedPromptTokens + estimatedCompletionTokens
      },
      model: this.config.model,
      provider: 'ollama'
    };
  }

  async validateConfig(): Promise<boolean> {
    try {
      const baseUrl = this.config.baseUrl || 'http://localhost:11434';
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET'
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  getProviderName(): string {
    return 'Ollama (本地)';
  }
}

// Ollama API 类型定义
interface OllamaResponse {
  message: {
    content: string;
  };
}
