use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub general: GeneralConfig,
    pub security: SecurityConfig,
    pub ai: AiConfig,
    pub llm: LlmConfig,
    pub logging: LoggingConfig,
    pub notification: NotificationConfig,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            general: GeneralConfig::default(),
            security: SecurityConfig::default(),
            ai: AiConfig::default(),
            llm: LlmConfig::default(),
            logging: LoggingConfig::default(),
            notification: NotificationConfig::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneralConfig {
    pub auto_start: bool,
    pub minimize_to_tray: bool,
    pub check_updates: bool,
    pub language: String,
    pub theme: String,
}

impl Default for GeneralConfig {
    fn default() -> Self {
        Self {
            auto_start: true,
            minimize_to_tray: true,
            check_updates: true,
            language: "zh-CN".to_string(),
            theme: "dark".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    pub block_file_delete: bool,
    pub block_system_path_write: bool,
    pub block_network_connection: bool,
    pub block_registry_modify: bool,
    pub block_process_create: bool,
    pub risk_threshold: u32,
    pub auto_block: bool,
    pub whitelist_mode: bool,
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            block_file_delete: true,
            block_system_path_write: true,
            block_network_connection: true,
            block_registry_modify: true,
            block_process_create: false,
            risk_threshold: 70,
            auto_block: true,
            whitelist_mode: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub enabled_terminals: Vec<String>,
    pub auto_detect: bool,
    pub scan_interval: u64,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            enabled_terminals: vec![
                "cursor".to_string(),
                "windsurf".to_string(),
                "cline".to_string(),
                "aider".to_string(),
                "openclaw".to_string(),
            ],
            auto_detect: true,
            scan_interval: 5000,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmConfig {
    pub provider: String,
    pub model: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub timeout: u64,
    pub max_retries: u32,
}

impl Default for LlmConfig {
    fn default() -> Self {
        Self {
            provider: "mimoflash".to_string(),
            model: "mimoflash-v2".to_string(),
            api_key: None,
            base_url: None,
            timeout: 30000,
            max_retries: 3,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub level: String,
    pub max_file_size: u64,
    pub max_files: u32,
    pub log_path: String,
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: "info".to_string(),
            max_file_size: 100 * 1024 * 1024,
            max_files: 10,
            log_path: "./logs".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationConfig {
    pub enabled: bool,
    pub sound: bool,
    pub desktop: bool,
    pub email: Option<String>,
}

impl Default for NotificationConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            sound: true,
            desktop: true,
            email: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AITerminal {
    pub pid: u32,
    pub name: String,
    pub path: String,
    pub command_line: String,
    pub start_time: DateTime<Utc>,
    pub is_tracked: bool,
    pub risk_score: u32,
    pub last_activity: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLog {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub operation: String,
    pub process_id: u32,
    pub process_name: String,
    pub target: String,
    pub risk_score: u32,
    pub risk_level: String,
    pub action: String,
    pub details: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stats {
    pub total_events: u64,
    pub blocked_events: u64,
    pub allowed_events: u64,
    pub warnings: u64,
    pub ai_terminals_count: u32,
    pub average_risk_score: f64,
    pub uptime: u64,
    pub events_by_type: HashMap<String, u64>,
    pub events_by_hour: Vec<u64>,
    pub top_processes: Vec<TopProcess>,
}

impl Default for Stats {
    fn default() -> Self {
        Self {
            total_events: 0,
            blocked_events: 0,
            allowed_events: 0,
            warnings: 0,
            ai_terminals_count: 0,
            average_risk_score: 0.0,
            uptime: 0,
            events_by_type: HashMap::new(),
            events_by_hour: vec![0; 24],
            top_processes: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopProcess {
    pub name: String,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriverStatus {
    pub installed: bool,
    pub loaded: bool,
    pub version: Option<String>,
    pub signing_status: String,
    pub test_mode_enabled: bool,
    pub error: Option<String>,
}

impl Default for DriverStatus {
    fn default() -> Self {
        Self {
            installed: false,
            loaded: false,
            version: None,
            signing_status: "unsigned".to_string(),
            test_mode_enabled: false,
            error: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMProvider {
    pub id: String,
    pub name: String,
    pub models: Vec<String>,
    pub configured: bool,
    pub healthy: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub uptime: u64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(message: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message.into()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<ValidationWarning>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationWarning {
    pub field: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub current_version: String,
    pub latest_version: String,
    pub release_notes: Option<String>,
    pub release_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub platform: String,
    pub arch: String,
    pub version: String,
    pub os_version: String,
    pub total_memory: u64,
    pub free_memory: u64,
    pub cpu_count: usize,
}
