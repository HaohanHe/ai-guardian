/**
 * LLM 提供商工厂
 * 
 * 统一管理所有云服务提供商
 */

import { BaseLLMProvider, type LLMConfig } from './base.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { DeepSeekProvider } from './deepseek.js';
import { MiMoFlashProvider } from './mimoflash.js';
import { OllamaProvider } from './ollama.js';
import { GeminiProvider } from './gemini.js';
import { QwenProvider } from './qwen.js';

export * from './base.js';
export { OpenAIProvider } from './openai.js';
export { AnthropicProvider } from './anthropic.js';
export { DeepSeekProvider } from './deepseek.js';
export { MiMoFlashProvider } from './mimoflash.js';
export { OllamaProvider } from './ollama.js';
export { GeminiProvider } from './gemini.js';
export { QwenProvider } from './qwen.js';

/**
 * 支持的提供商列表
 */
export const SUPPORTED_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { id: 'anthropic', name: 'Anthropic Claude', models: ['claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus'] },
  { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'] },
  { id: 'gemini', name: 'Google Gemini', models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'] },
  { id: 'qwen', name: 'Alibaba Qwen (通义千问)', models: ['qwen-max', 'qwen-plus', 'qwen-turbo'] },
  { id: 'mimoflash', name: '小米 MiMoFlash', models: ['mimoflash-v2', 'mimoflash-v1'] },
  { id: 'ollama', name: 'Ollama (本地)', models: ['llama3', 'mistral', 'qwen2', 'gemma2'] }
] as const;

export type ProviderId = typeof SUPPORTED_PROVIDERS[number]['id'];

/**
 * 创建 LLM 提供商
 */
export function createLLMProvider(config: LLMConfig): BaseLLMProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'deepseek':
      return new DeepSeekProvider(config);
    case 'gemini':
      return new GeminiProvider(config);
    case 'qwen':
      return new QwenProvider(config);
    case 'mimoflash':
      return new MiMoFlashProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * 验证提供商配置
 */
export async function validateProviderConfig(provider: string, apiKey: string, baseUrl?: string): Promise<boolean> {
  try {
    const llmProvider = createLLMProvider({
      provider,
      apiKey,
      baseUrl,
      model: 'test'
    });
    return await llmProvider.validateConfig();
  } catch {
    return false;
  }
}

/**
 * 获取提供商信息
 */
export function getProviderInfo(providerId: string) {
  return SUPPORTED_PROVIDERS.find(p => p.id === providerId);
}

/**
 * 获取所有提供商列表
 */
export function getAllProviders() {
  return SUPPORTED_PROVIDERS;
}
