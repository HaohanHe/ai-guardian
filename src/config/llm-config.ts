/**
 * LLM Configuration Manager
 * 
 * Manages LLM provider configurations from config file
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { LLMConfig } from '../llm/providers/base.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ProviderConfig extends LLMConfig {
  enabled?: boolean;
}

export interface LLMConfigFile {
  providers: Record<string, ProviderConfig>;
  defaultProvider: string;
}

const CONFIG_PATH = join(__dirname, '../../config/llm.json');

class LLMConfigManager {
  private config: LLMConfigFile | null = null;

  load(): LLMConfigFile {
    if (this.config) return this.config;

    try {
      if (existsSync(CONFIG_PATH)) {
        const content = readFileSync(CONFIG_PATH, 'utf-8');
        this.config = JSON.parse(content) as LLMConfigFile;
      } else {
        // Default config
        this.config = {
          providers: {},
          defaultProvider: 'mimoflash'
        };
      }
    } catch (error) {
      console.error('[AI Guardian] Failed to load LLM config:', error);
      this.config = {
        providers: {},
        defaultProvider: 'mimoflash'
      };
    }

    return this.config;
  }

  save(config: LLMConfigFile): void {
    try {
      writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
      this.config = config;
    } catch (error) {
      console.error('[AI Guardian] Failed to save LLM config:', error);
    }
  }

  getProviderConfig(providerName: string): ProviderConfig | null {
    const config = this.load();
    return config.providers[providerName] || null;
  }

  getDefaultProvider(): string {
    return this.load().defaultProvider;
  }

  getAllProviders(): Record<string, ProviderConfig> {
    return this.load().providers;
  }

  updateProviderConfig(providerName: string, config: ProviderConfig): void {
    const current = this.load();
    current.providers[providerName] = {
      ...current.providers[providerName],
      ...config
    };
    this.save(current);
  }

  setDefaultProvider(providerName: string): void {
    const current = this.load();
    current.defaultProvider = providerName;
    this.save(current);
  }

  getEnabledProviders(): Array<{ name: string; config: ProviderConfig }> {
    const config = this.load();
    return Object.entries(config.providers)
      .filter(([_, cfg]) => cfg.enabled !== false && cfg.apiKey)
      .map(([name, cfg]) => ({ name, config: cfg }));
  }
}

export const llmConfigManager = new LLMConfigManager();
