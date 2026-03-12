//! AI Guardian Audit Logger
//!
//! 执法记录仪 - 系统级审计日志，支持数字签名和防篡改

use super::{OperationEvent, RiskLevel, SecurityDecision};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::VecDeque;
use std::fs::{File, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};


/// 审计日志条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogEntry {
    /// 日志 ID
    pub id: String,
    /// 时间戳
    pub timestamp: DateTime<Utc>,
    /// 事件类型
    pub event_type: String,
    /// 进程信息
    pub process_id: u32,
    pub process_name: String,
    pub command_line: String,
    /// 操作详情
    pub operation: String,
    pub target: String,
    /// 风险评估
    pub risk_score: u32,
    pub risk_level: RiskLevel,
    /// 安全决策
    pub decision: SecurityDecision,
    /// 决策原因
    pub reason: String,
    /// 数字签名（防篡改）
    pub signature: String,
    /// 前一个日志条目的哈希（区块链式链接）
    pub previous_hash: String,
}

/// 审计日志配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditConfig {
    /// 日志文件路径
    pub log_dir: PathBuf,
    /// 单个日志文件最大大小 (MB)
    pub max_file_size_mb: u64,
    /// 保留日志天数
    pub retention_days: u32,
    /// 是否启用数字签名
    pub enable_signature: bool,
    /// 是否启用远程备份
    pub enable_remote_backup: bool,
    /// 远程备份 URL
    pub remote_backup_url: Option<String>,
}

impl Default for AuditConfig {
    fn default() -> Self {
        Self {
            log_dir: PathBuf::from("/var/log/ai-guardian"),
            max_file_size_mb: 100,
            retention_days: 90,
            enable_signature: true,
            enable_remote_backup: false,
            remote_backup_url: None,
        }
    }
}

/// 审计日志管理器
pub struct AuditLogger {
    config: AuditConfig,
    current_file: Arc<Mutex<Option<BufWriter<File>>>>,
    current_file_size: Arc<Mutex<u64>>,
    /// 内存中的最近日志（用于快速查询）
    memory_buffer: Arc<Mutex<VecDeque<AuditLogEntry>>>,
    /// 内存缓冲区大小
    buffer_size: usize,
    /// 上一条日志的哈希（用于区块链式链接）
    last_hash: Arc<Mutex<String>>,
}

impl AuditLogger {
    /// 创建新的审计日志管理器
    pub fn new() -> Self {
        Self::with_config(AuditConfig::default())
    }

    /// 使用配置创建
    pub fn with_config(config: AuditConfig) -> Self {
        // 确保日志目录存在
        if !config.log_dir.exists() {
            std::fs::create_dir_all(&config.log_dir).ok();
        }

        let logger = Self {
            config,
            current_file: Arc::new(Mutex::new(None)),
            current_file_size: Arc::new(Mutex::new(0)),
            memory_buffer: Arc::new(Mutex::new(VecDeque::new())),
            buffer_size: 10000,
            last_hash: Arc::new(Mutex::new(String::new())),
        };

        // 初始化日志文件
        logger.rotate_log_file().ok();

        logger
    }

    /// 记录事件
    pub fn log(&self, event: &OperationEvent) {
        let entry = self.create_entry(event);

        // 写入文件
        if let Err(e) = self.write_to_file(&entry) {
            log::error!("Failed to write audit log: {}", e);
        }

        // 添加到内存缓冲区
        self.add_to_buffer(entry);

        // 检查是否需要轮转
        self.check_rotation().ok();
    }

    /// 记录带详细信息的审计事件
    pub fn log_with_details(
        &self,
        event: &OperationEvent,
        decision: SecurityDecision,
        reason: &str,
    ) {
        let mut entry = self.create_entry(event);
        entry.decision = decision;
        entry.reason = reason.to_string();

        // 重新计算签名
        if self.config.enable_signature {
            entry.signature = self.calculate_signature(&entry);
        }

        if let Err(e) = self.write_to_file(&entry) {
            log::error!("Failed to write audit log: {}", e);
        }

        self.add_to_buffer(entry);
    }

    /// 创建日志条目
    fn create_entry(&self, event: &OperationEvent) -> AuditLogEntry {
        let timestamp = Utc::now();
        let id = format!("{}-{}", timestamp.timestamp_nanos(), event.process_id);

        let operation = format!("{:?}", event.operation_type);
        let target = event
            .target_path
            .clone()
            .or_else(|| event.target_ip.map(|ip| ip.to_string()))
            .unwrap_or_default();

        let mut entry = AuditLogEntry {
            id,
            timestamp,
            event_type: "security_event".to_string(),
            process_id: event.process_id,
            process_name: event.process_name.clone(),
            command_line: event.command_line.clone(),
            operation,
            target,
            risk_score: event.risk_score,
            risk_level: RiskLevel::from_score(event.risk_score),
            decision: event.decision,
            reason: String::new(),
            signature: String::new(),
            previous_hash: self.last_hash.lock().unwrap().clone(),
        };

        // 计算数字签名
        if self.config.enable_signature {
            entry.signature = self.calculate_signature(&entry);
        }

        // 更新上一条哈希
        *self.last_hash.lock().unwrap() = self.calculate_hash(&entry);

        entry
    }

    /// 计算日志条目的哈希
    fn calculate_hash(&self, entry: &AuditLogEntry) -> String {
        let data = format!(
            "{}:{}:{}:{}:{}:{}:{}:{}",
            entry.id,
            entry.timestamp.timestamp_nanos(),
            entry.process_id,
            entry.operation,
            entry.target,
            entry.risk_score,
            entry.decision as u8,
            entry.previous_hash
        );

        let mut hasher = Sha256::new();
        hasher.update(data.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// 计算数字签名
    fn calculate_signature(&self, entry: &AuditLogEntry) -> String {
        // 简化版：使用哈希作为签名
        // 实际生产环境应该使用私钥签名
        self.calculate_hash(entry)
    }

    /// 写入文件
    fn write_to_file(&self, entry: &AuditLogEntry) -> anyhow::Result<()> {
        let mut file_guard = self.current_file.lock().unwrap();

        if let Some(ref mut writer) = *file_guard {
            let line = serde_json::to_string(entry)?;
            writeln!(writer, "{}", line)?;
            writer.flush()?;

            // 更新文件大小
            *self.current_file_size.lock().unwrap() += line.len() as u64 + 1;
        }

        Ok(())
    }

    /// 添加到内存缓冲区
    fn add_to_buffer(&self, entry: AuditLogEntry) {
        let mut buffer = self.memory_buffer.lock().unwrap();
        buffer.push_back(entry);

        // 保持缓冲区大小限制
        while buffer.len() > self.buffer_size {
            buffer.pop_front();
        }
    }

    /// 检查是否需要轮转日志文件
    fn check_rotation(&self) -> anyhow::Result<()> {
        let current_size = *self.current_file_size.lock().unwrap();
        let max_size = self.config.max_file_size_mb * 1024 * 1024;

        if current_size >= max_size {
            self.rotate_log_file()?;
        }

        Ok(())
    }

    /// 轮转日志文件
    fn rotate_log_file(&self) -> anyhow::Result<()> {
        // 关闭当前文件
        {
            let mut file_guard = self.current_file.lock().unwrap();
            *file_guard = None;
        }

        // 生成新文件名
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let filename = format!("ai-guardian-audit-{}.log", timestamp);
        let filepath = self.config.log_dir.join(filename);

        // 创建新文件
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&filepath)?;

        {
            let mut file_guard = self.current_file.lock().unwrap();
            *file_guard = Some(BufWriter::new(file));
        }

        *self.current_file_size.lock().unwrap() = 0;

        log::info!("Rotated audit log to: {:?}", filepath);

        // 清理旧日志
        self.cleanup_old_logs()?;

        Ok(())
    }

    /// 清理过期日志
    fn cleanup_old_logs(&self) -> anyhow::Result<()> {
        let retention = chrono::Duration::days(self.config.retention_days as i64);
        let cutoff = Utc::now() - retention;

        for entry in std::fs::read_dir(&self.config.log_dir)? {
            let entry = entry?;
            let path = entry.path();

            if let Ok(metadata) = entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    let modified: DateTime<Utc> = modified.into();
                    if modified < cutoff {
                        std::fs::remove_file(&path)?;
                        log::info!("Removed old audit log: {:?}", path);
                    }
                }
            }
        }

        Ok(())
    }

    /// 查询最近的日志
    pub fn query_recent(&self, count: usize) -> Vec<AuditLogEntry> {
        let buffer = self.memory_buffer.lock().unwrap();
        buffer.iter().rev().take(count).cloned().collect()
    }

    /// 按时间范围查询
    pub fn query_by_time_range(
        &self,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Vec<AuditLogEntry> {
        let buffer = self.memory_buffer.lock().unwrap();
        buffer
            .iter()
            .filter(|e| e.timestamp >= start && e.timestamp <= end)
            .cloned()
            .collect()
    }

    /// 按进程 ID 查询
    pub fn query_by_process(&self, pid: u32) -> Vec<AuditLogEntry> {
        let buffer = self.memory_buffer.lock().unwrap();
        buffer
            .iter()
            .filter(|e| e.process_id == pid)
            .cloned()
            .collect()
    }

    /// 按风险等级查询
    pub fn query_by_risk_level(&self, level: RiskLevel) -> Vec<AuditLogEntry> {
        let buffer = self.memory_buffer.lock().unwrap();
        buffer
            .iter()
            .filter(|e| e.risk_level == level)
            .cloned()
            .collect()
    }

    /// 验证日志完整性（区块链式验证）
    pub fn verify_integrity(&self) -> bool {
        let buffer = self.memory_buffer.lock().unwrap();
        let mut prev_hash = String::new();

        for entry in buffer.iter() {
            // 验证前一个哈希
            if entry.previous_hash != prev_hash {
                log::error!("Audit log integrity check failed at entry {}", entry.id);
                return false;
            }

            // 验证签名
            if self.config.enable_signature {
                let expected_sig = self.calculate_signature(entry);
                if entry.signature != expected_sig {
                    log::error!(
                        "Audit log signature verification failed at entry {}",
                        entry.id
                    );
                    return false;
                }
            }

            prev_hash = self.calculate_hash(entry);
        }

        true
    }

    /// 导出日志
    pub fn export_logs(&self, filepath: &Path) -> anyhow::Result<()> {
        let buffer = self.memory_buffer.lock().unwrap();
        let file = File::create(filepath)?;
        let mut writer = BufWriter::new(file);

        for entry in buffer.iter() {
            let line = serde_json::to_string(entry)?;
            writeln!(writer, "{}", line)?;
        }

        writer.flush()?;
        log::info!(
            "Exported {} audit log entries to {:?}",
            buffer.len(),
            filepath
        );

        Ok(())
    }

    /// 获取统计信息
    pub fn get_stats(&self) -> AuditStats {
        let buffer = self.memory_buffer.lock().unwrap();

        let total_events = buffer.len();
        let blocked_events = buffer
            .iter()
            .filter(|e| e.decision == SecurityDecision::Block)
            .count();
        let high_risk_events = buffer
            .iter()
            .filter(|e| e.risk_level == RiskLevel::High || e.risk_level == RiskLevel::Critical)
            .count();

        AuditStats {
            total_events,
            blocked_events,
            high_risk_events,
            memory_buffer_size: total_events,
        }
    }
}

/// 审计统计
#[derive(Debug, Clone)]
pub struct AuditStats {
    pub total_events: usize,
    pub blocked_events: usize,
    pub high_risk_events: usize,
    pub memory_buffer_size: usize,
}

/// 远程备份管理器
pub struct RemoteBackupManager {
    enabled: bool,
    backup_url: Option<String>,
}

impl RemoteBackupManager {
    pub fn new(enabled: bool, backup_url: Option<String>) -> Self {
        Self {
            enabled,
            backup_url,
        }
    }

    /// 上传日志到远程服务器
    pub async fn upload_logs(&self, log_file: &Path) -> anyhow::Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let url = self
            .backup_url
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Backup URL not configured"))?;

        // 这里实现实际上传逻辑
        // 可以使用 reqwest 或其他 HTTP 客户端
        log::info!("Uploading logs to remote server: {}", url);

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn create_test_event() -> OperationEvent {
        OperationEvent {
            id: "test-123".to_string(),
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            operation_type: super::super::OperationType::FileDelete,
            process_id: 1234,
            process_name: "test.exe".to_string(),
            process_path: "/test".to_string(),
            command_line: "rm -rf /".to_string(),
            parent_process_id: 1,
            user_id: 1000,
            target_path: Some("/etc/passwd".to_string()),
            target_ip: None,
            target_port: None,
            risk_score: 95,
            decision: SecurityDecision::Block,
            details: HashMap::new(),
        }
    }

    #[test]
    fn test_audit_log_creation() {
        let logger = AuditLogger::new();
        let event = create_test_event();

        logger.log(&event);

        let recent = logger.query_recent(1);
        assert_eq!(recent.len(), 1);
        assert_eq!(recent[0].process_id, 1234);
        assert_eq!(recent[0].risk_score, 95);
    }

    #[test]
    fn test_query_by_risk_level() {
        let logger = AuditLogger::new();
        let event = create_test_event();

        logger.log(&event);

        let critical = logger.query_by_risk_level(RiskLevel::Critical);
        assert!(!critical.is_empty());
    }

    #[test]
    fn test_integrity_verification() {
        let logger = AuditLogger::new();
        let event = create_test_event();

        logger.log(&event);
        logger.log(&event);

        assert!(logger.verify_integrity());
    }
}
