/**
 * Google Gemini Provider
 * 
 * 支持 Google Gemini API (gemini-1.5-pro, gemini-1.5-flash 等)
 */

import { BaseLLMProvider } from './base.js';
import type { LLMRequest, LLMResponse, ProviderCapabilities } from './base.js';

export class GeminiProvider extends BaseLLMProvider {
  protected defineCapabilities(): ProviderCapabilities {
    return {
      supportedModels: [
        'gemini-1.5-pro',
        'gemini-1.5-pro-latest',
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.0-pro',
        'gemini-1.0-pro-vision'
      ],
      maxContextLength: 1000000, // Gemini 支持超长上下文
      supportsStreaming: true,
      supportsSystemPrompt: true,
      supportsContext: true
    };
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    const model = this.config.model || 'gemini-1.5-pro';
    
    // 构建 Gemini 格式的请求
    const geminiRequest = this.buildGeminiRequest(request);
    
    const response = await fetch(
      `${baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(geminiRequest)
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as GeminiResponse;
    return this.parseGeminiResponse(data);
  }

  /**
   * 构建 Gemini 请求格式
   */
  private buildGeminiRequest(request: LLMRequest): GeminiRequest {
    const contents: GeminiContent[] = [];

    // 系统提示词作为第一个用户消息的一部分
    let fullPrompt = request.prompt;
    if (request.systemPrompt) {
      fullPrompt = `[系统指令]\n${request.systemPrompt}\n\n[用户请求]\n${request.prompt}`;
    }

    // 添加上下文
    if (request.context && request.context.length > 0) {
      const contextText = request.context.join('\n---\n');
      fullPrompt = `[上下文]\n${contextText}\n\n${fullPrompt}`;
    }

    contents.push({
      role: 'user',
      parts: [{ text: fullPrompt }]
    });

    return {
      contents,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        topP: 0.8,
        topK: 40
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_NONE'
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_NONE'
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_NONE'
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_NONE'
        }
      ]
    };
  }

  /**
   * 解析 Gemini 响应
   */
  private parseGeminiResponse(data: GeminiResponse): LLMResponse {
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('Empty response from Gemini API');
    }

    const candidate = data.candidates[0];
    const content = candidate.content;
    
    if (!content || !content.parts || content.parts.length === 0) {
      throw new Error('Invalid response structure from Gemini API');
    }

    const text = content.parts.map(part => part.text).join('');

    return {
      content: text,
      model: 'gemini',
      provider: 'gemini',
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: (data.usageMetadata?.promptTokenCount || 0) +
                     (data.usageMetadata?.candidatesTokenCount || 0)
      }
    };
  }

  getProviderName(): string {
    return 'Google Gemini';
  }

  async validateConfig(): Promise<boolean> {
    try {
      // 尝试一个简单的请求来验证配置
      await this.complete({
        prompt: 'Hello'
      });
      return true;
    } catch {
      return false;
    }
  }
}

// Gemini API 类型定义
interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  };
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiResponse {
  candidates: Array<{
    content: GeminiContent;
    finishReason: string;
    index: number;
    safetyRatings: Array<{
      category: string;
      probability: string;
    }>;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}
