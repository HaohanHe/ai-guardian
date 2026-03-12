//! AI Guardian Configuration
//!
//! 系统配置管理

use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::path::PathBuf;
use std::sync::OnceLock;

/// 全局配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardianConfig {
    /// 版本
    pub version: String,
    /// 通用设置
    pub general: GeneralSettings,
    /// 安全策略
    pub security: SecuritySettings,
    /// AI 分析设置
    pub ai_analysis: AiAnalysisSettings,
    /// 风险引擎设置
    pub risk_engine: RiskEngineSettings,
    /// 审计日志设置
    pub audit: AuditSettings,
    /// 网络设置
    pub network: NetworkSettings,
    /// 告警设置
    pub alerting: AlertingSettings,
}

impl Default for GuardianConfig {
    fn default() -> Self {
        Self {
            version: env!("CARGO_PKG_VERSION").to_string(),
            general: GeneralSettings::default(),
            security: SecuritySettings::default(),
            ai_analysis: AiAnalysisSettings::default(),
            risk_engine: RiskEngineSettings::default(),
            audit: AuditSettings::default(),
            network: NetworkSettings::default(),
            alerting: AlertingSettings::default(),
        }
    }
}

/// 通用设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneralSettings {
    /// 服务名称
    pub service_name: String,
    /// 日志级别
    pub log_level: String,
    /// 数据目录
    pub data_dir: PathBuf,
    /// 是否开机自启
    pub auto_start: bool,
    /// 工作线程数
    pub worker_threads: usize,
}

impl Default for GeneralSettings {
    fn default() -> Self {
        Self {
            service_name: "AI Guardian".to_string(),
            log_level: "info".to_string(),
            data_dir: PathBuf::from("/var/lib/ai-guardian"),
            auto_start: true,
            worker_threads: 4,
        }
    }
}

/// 安全策略设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecuritySettings {
    /// 是否启用防护
    pub enabled: bool,
    /// 防护模式 (monitor/interactive/block)
    pub mode: ProtectionMode,
    /// 阻断文件删除
    pub block_file_delete: bool,
    /// 阻断系统路径写入
    pub block_system_path_write: bool,
    /// 阻断网络连接
    pub block_network_connection: bool,
    /// 阻断的进程列表
    pub blocked_processes: Vec<String>,
    /// 白名单进程
    pub whitelisted_processes: Vec<String>,
    /// 敏感路径列表
    pub sensitive_paths: Vec<String>,
}

impl Default for SecuritySettings {
    fn default() -> Self {
        Self {
            enabled: true,
            mode: ProtectionMode::Interactive,
            block_file_delete: true,
            block_system_path_write: true,
            block_network_connection: true,
            blocked_processes: vec![],
            whitelisted_processes: vec![],
            sensitive_paths: vec![
                "/etc/passwd".to_string(),
                "/etc/shadow".to_string(),
                "/bin".to_string(),
                "/sbin".to_string(),
                "C:\\Windows\\System32".to_string(),
            ],
        }
    }
}

/// 防护模式
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ProtectionMode {
    /// 仅监控，不阻断
    Monitor,
    /// 交互式（询问用户）
    Interactive,
    /// 自动阻断
    Block,
}

/// AI 分析设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiAnalysisSettings {
    /// 是否启用 AI 分析
    pub enabled: bool,
    /// 风险阈值 (0-100)
    pub risk_threshold: u32,
    /// 使用本地模型
    pub use_local_model: bool,
    /// 本地模型路径
    pub local_model_path: Option<PathBuf>,
    /// 远程 API URL
    pub remote_api_url: Option<String>,
    /// API Key
    pub api_key: Option<String>,
    /// 分析超时 (秒)
    pub analysis_timeout_secs: u32,
    /// 启用语义分析
    pub enable_semantic_analysis: bool,
}

impl Default for AiAnalysisSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            risk_threshold: 70,
            use_local_model: true,
            local_model_path: None,
            remote_api_url: None,
            api_key: None,
            analysis_timeout_secs: 5,
            enable_semantic_analysis: true,
        }
    }
}

/// 风险引擎设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskEngineSettings {
    /// 是否启用
    pub enabled: bool,
    /// 基础风险分
    pub base_risk_score: u32,
    /// 高风险阈值
    pub high_risk_threshold: u32,
    /// 关键风险阈值
    pub critical_risk_threshold: u32,
    /// 行为历史窗口 (秒)
    pub behavior_window_secs: u64,
    /// 最大历史记录数
    pub max_history_entries: usize,
    /// 自定义规则
    pub custom_rules: Vec<CustomRule>,
}

impl Default for RiskEngineSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            base_risk_score: 10,
            high_risk_threshold: 60,
            critical_risk_threshold: 85,
            behavior_window_secs: 300,
            max_history_entries: 10000,
            custom_rules: vec![],
        }
    }
}

/// 自定义规则
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomRule {
    pub id: String,
    pub name: String,
    pub description: String,
    pub condition: RuleCondition,
    pub risk_score: u32,
    pub enabled: bool,
}

/// 规则条件
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RuleCondition {
    OperationType { op_type: String },
    PathContains { path: String },
    CommandContains { cmd: String },
    ProcessName { name: String },
    And { conditions: Vec<RuleCondition> },
    Or { conditions: Vec<RuleCondition> },
}

/// 审计日志设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditSettings {
    /// 是否启用审计
    pub enabled: bool,
    /// 日志目录
    pub log_dir: PathBuf,
    /// 最大文件大小 (MB)
    pub max_file_size_mb: u64,
    /// 保留天数
    pub retention_days: u32,
    /// 启用数字签名
    pub enable_signature: bool,
    /// 启用远程备份
    pub enable_remote_backup: bool,
    /// 远程备份 URL
    pub remote_backup_url: Option<String>,
    /// 备份 API Key
    pub backup_api_key: Option<String>,
}

impl Default for AuditSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            log_dir: PathBuf::from("/var/log/ai-guardian"),
            max_file_size_mb: 100,
            retention_days: 90,
            enable_signature: true,
            enable_remote_backup: false,
            remote_backup_url: None,
            backup_api_key: None,
        }
    }
}

/// 网络设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkSettings {
    /// 阻断的 IP 列表
    pub blocked_ips: Vec<IpAddr>,
    /// 阻断的端口列表
    pub blocked_ports: Vec<u16>,
    /// 可疑端口列表
    pub suspicious_ports: Vec<u16>,
    /// 允许的域名白名单
    pub allowed_domains: Vec<String>,
    /// 阻断的域名黑名单
    pub blocked_domains: Vec<String>,
    /// 启用威胁情报
    pub enable_threat_intel: bool,
    /// 威胁情报更新间隔 (小时)
    pub threat_intel_update_interval: u32,
}

impl Default for NetworkSettings {
    fn default() -> Self {
        Self {
            blocked_ips: vec![],
            blocked_ports: vec![],
            suspicious_ports: vec![
                4444,  // Metasploit
                5555,  // ADB
                6666,  // IRC
                31337, // Elite
                12345, // NetBus
                27374, // SubSeven
            ],
            allowed_domains: vec![],
            blocked_domains: vec![],
            enable_threat_intel: true,
            threat_intel_update_interval: 24,
        }
    }
}

/// 告警设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertingSettings {
    /// 启用邮件告警
    pub enable_email: bool,
    /// SMTP 服务器
    pub smtp_server: Option<String>,
    /// SMTP 端口
    pub smtp_port: u16,
    /// SMTP 用户名
    pub smtp_username: Option<String>,
    /// SMTP 密码
    pub smtp_password: Option<String>,
    /// 告警接收邮箱
    pub alert_recipients: Vec<String>,
    /// 启用 Webhook
    pub enable_webhook: bool,
    /// Webhook URL
    pub webhook_url: Option<String>,
    /// 仅告警高风险事件
    pub alert_on_high_risk_only: bool,
    /// 告警冷却时间 (分钟)
    pub alert_cooldown_minutes: u32,
}

impl Default for AlertingSettings {
    fn default() -> Self {
        Self {
            enable_email: false,
            smtp_server: None,
            smtp_port: 587,
            smtp_username: None,
            smtp_password: None,
            alert_recipients: vec![],
            enable_webhook: false,
            webhook_url: None,
            alert_on_high_risk_only: true,
            alert_cooldown_minutes: 5,
        }
    }
}

/// 配置管理器
pub struct ConfigManager {
    config: GuardianConfig,
    config_path: PathBuf,
}

impl ConfigManager {
    /// 创建配置管理器
    pub fn new(config_path: PathBuf) -> Self {
        let config = if config_path.exists() {
            Self::load_from_file(&config_path).unwrap_or_default()
        } else {
            GuardianConfig::default()
        };

        Self {
            config,
            config_path,
        }
    }

    /// 获取配置
    pub fn get(&self) -> &GuardianConfig {
        &self.config
    }

    /// 获取可变配置
    pub fn get_mut(&mut self) -> &mut GuardianConfig {
        &mut self.config
    }

    /// 保存配置
    pub fn save(&self) -> anyhow::Result<()> {
        let content = toml::to_string_pretty(&self.config)?;
        std::fs::write(&self.config_path, content)?;
        log::info!("Configuration saved to {:?}", self.config_path);
        Ok(())
    }

    /// 从文件加载配置
    fn load_from_file(path: &PathBuf) -> anyhow::Result<GuardianConfig> {
        let content = std::fs::read_to_string(path)?;
        let config: GuardianConfig = toml::from_str(&content)?;
        Ok(config)
    }

    /// 更新配置
    pub fn update<F>(&mut self, f: F) -> anyhow::Result<()>
    where
        F: FnOnce(&mut GuardianConfig),
    {
        f(&mut self.config);
        self.save()
    }

    /// 重置为默认配置
    pub fn reset(&mut self) -> anyhow::Result<()> {
        self.config = GuardianConfig::default();
        self.save()
    }

    /// 验证配置
    pub fn validate(&self) -> Vec<String> {
        let mut errors = vec![];

        // 验证风险阈值
        if self.config.ai_analysis.risk_threshold > 100 {
            errors.push("Risk threshold must be between 0 and 100".to_string());
        }

        // 验证工作线程数
        if self.config.general.worker_threads == 0 {
            errors.push("Worker threads must be at least 1".to_string());
        }

        // 验证保留天数
        if self.config.audit.retention_days == 0 {
            errors.push("Retention days must be at least 1".to_string());
        }

        errors
    }
}

/// 全局配置实例
static GLOBAL_CONFIG: OnceLock<ConfigManager> = OnceLock::new();

/// 初始化全局配置
pub fn init(config_path: PathBuf) {
    let _ = GLOBAL_CONFIG.set(ConfigManager::new(config_path));
}

/// 获取全局配置
pub fn global() -> &'static ConfigManager {
    GLOBAL_CONFIG.get().expect("Config not initialized")
}

/// 获取可变全局配置
pub fn global_mut() -> &'static mut ConfigManager {
    // OnceLock 不支持可变引用，这里需要重新设计
    // 暂时返回不可变引用
    GLOBAL_CONFIG.get().expect("Config not initialized")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = GuardianConfig::default();
        assert_eq!(config.security.mode, ProtectionMode::Interactive);
        assert!(config.ai_analysis.enabled);
        assert!(config.audit.enabled);
    }

    #[test]
    fn test_protection_mode_serialization() {
        let mode = ProtectionMode::Block;
        let json = serde_json::to_string(&mode).unwrap();
        assert_eq!(json, "\"block\"");

        let deserialized: ProtectionMode = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, ProtectionMode::Block);
    }

    #[test]
    fn test_config_validation() {
        let config = GuardianConfig::default();
        let manager = ConfigManager {
            config,
            config_path: PathBuf::from("/tmp/test.toml"),
        };

        let errors = manager.validate();
        assert!(errors.is_empty());
    }
}
