use std::sync::Arc;
use parking_lot::RwLock;
use std::collections::HashMap;
use std::time::Instant;
use chrono::{DateTime, Utc};

use super::types::*;

#[derive(Debug, Clone)]
pub struct AppState {
    pub config: Arc<RwLock<Config>>,
    pub stats: Arc<RwLock<Stats>>,
    pub ai_terminals: Arc<RwLock<Vec<AITerminal>>>,
    pub audit_logs: Arc<RwLock<Vec<AuditLog>>>,
    pub driver_status: Arc<RwLock<DriverStatus>>,
    pub llm_providers: Arc<RwLock<Vec<LLMProvider>>>,
    pub start_time: Instant,
    pub version: String,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            config: Arc::new(RwLock::new(Config::default())),
            stats: Arc::new(RwLock::new(Stats::default())),
            ai_terminals: Arc::new(RwLock::new(Vec::new())),
            audit_logs: Arc::new(RwLock::new(Vec::new())),
            driver_status: Arc::new(RwLock::new(DriverStatus::default())),
            llm_providers: Arc::new(RwLock::new(Self::default_llm_providers())),
            start_time: Instant::now(),
            version: env!("CARGO_PKG_VERSION").to_string(),
        }
    }

    fn default_llm_providers() -> Vec<LLMProvider> {
        vec![
            LLMProvider {
                id: "openai".to_string(),
                name: "OpenAI".to_string(),
                models: vec!["gpt-4".to_string(), "gpt-4-turbo".to_string(), "gpt-3.5-turbo".to_string()],
                configured: false,
                healthy: None,
            },
            LLMProvider {
                id: "anthropic".to_string(),
                name: "Anthropic".to_string(),
                models: vec!["claude-3-opus".to_string(), "claude-3-sonnet".to_string(), "claude-3-haiku".to_string()],
                configured: false,
                healthy: None,
            },
            LLMProvider {
                id: "deepseek".to_string(),
                name: "DeepSeek".to_string(),
                models: vec!["deepseek-chat".to_string(), "deepseek-coder".to_string()],
                configured: false,
                healthy: None,
            },
            LLMProvider {
                id: "gemini".to_string(),
                name: "Google Gemini".to_string(),
                models: vec!["gemini-pro".to_string(), "gemini-ultra".to_string()],
                configured: false,
                healthy: None,
            },
            LLMProvider {
                id: "qwen".to_string(),
                name: "通义千问".to_string(),
                models: vec!["qwen-turbo".to_string(), "qwen-plus".to_string(), "qwen-max".to_string()],
                configured: false,
                healthy: None,
            },
            LLMProvider {
                id: "mimoflash".to_string(),
                name: "MiMoFlash".to_string(),
                models: vec!["mimoflash-v2".to_string()],
                configured: true,
                healthy: Some(true),
            },
            LLMProvider {
                id: "ollama".to_string(),
                name: "Ollama (Local)".to_string(),
                models: vec!["llama2".to_string(), "codellama".to_string(), "mistral".to_string()],
                configured: false,
                healthy: None,
            },
        ]
    }

    pub fn get_uptime(&self) -> u64 {
        self.start_time.elapsed().as_secs()
    }

    pub fn add_audit_log(&self, log: AuditLog) {
        let mut logs = self.audit_logs.write();
        logs.insert(0, log);
        if logs.len() > 10000 {
            logs.truncate(10000);
        }
    }

    pub fn update_stats(&self, event_type: &str, blocked: bool) {
        let mut stats = self.stats.write();
        stats.total_events += 1;
        if blocked {
            stats.blocked_events += 1;
        } else {
            stats.allowed_events += 1;
        }
        *stats.events_by_type.entry(event_type.to_string()).or_insert(0) += 1;
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
