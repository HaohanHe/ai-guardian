/**
 * AI Guardian V2 - System-Level EDR for AI Agents
 *
 * AI Guardian 是一个系统级终端检测与响应 (EDR) 系统，
 * 专门用于保护 AI Agent（如 OpenClaw、Cursor、Windsurf 等）
 * 不被恶意命令攻击。
 *
 * 核心特性：
 * - 内核级监控（Windows Minifilter / Linux eBPF）
 * - 自动识别 AI Agent 终端进程
 * - 拦截危险操作（文件删除、系统路径写入、网络连接）
 * - 进程树追踪（子进程继承 AI 标记）
 */
pub mod core;
pub mod driver;
pub mod monitor;

// Platform-specific modules
#[cfg(windows)]
pub mod windows {
    pub use crate::driver::windows::*;
    pub use crate::monitor::windows::*;
}

#[cfg(target_os = "linux")]
pub mod linux {
    pub use crate::driver::linux::*;
    pub use crate::monitor::linux::*;
}

// Re-export main types
pub use core::*;

use std::sync::{Arc, Mutex};

/// AI Guardian 主控制器
pub struct AiGuardian {
    #[cfg(windows)]
    #[allow(dead_code)]
    monitor: Option<monitor::windows::WindowsMonitor>,
    #[cfg(target_os = "linux")]
    #[allow(dead_code)]
    monitor: Option<monitor::linux::LinuxMonitor>,
    config: GuardianConfig,
    running: Arc<Mutex<bool>>,
}

/// Guardian 配置
#[derive(Debug, Clone)]
pub struct GuardianConfig {
    /// 是否自动识别 AI 终端
    pub auto_detect_ai_terminals: bool,
    /// 是否阻断文件删除
    pub block_file_delete: bool,
    /// 是否阻断系统路径写入
    pub block_system_path_write: bool,
    /// 是否阻断网络连接
    pub block_network_connection: bool,
    /// 风险阈值 (0-100)
    pub risk_threshold: u32,
    /// 是否记录所有操作
    pub log_all_operations: bool,
}

impl Default for GuardianConfig {
    fn default() -> Self {
        Self {
            auto_detect_ai_terminals: true,
            block_file_delete: true,
            block_system_path_write: true,
            block_network_connection: true,
            risk_threshold: 70,
            log_all_operations: false,
        }
    }
}

impl AiGuardian {
    /// 创建新的 Guardian 实例
    pub fn new() -> Self {
        Self {
            #[cfg(windows)]
            monitor: None,
            #[cfg(target_os = "linux")]
            monitor: None,
            config: GuardianConfig::default(),
            running: Arc::new(Mutex::new(false)),
        }
    }

    /// 使用配置创建 Guardian 实例
    pub fn with_config(config: GuardianConfig) -> Self {
        Self {
            #[cfg(windows)]
            monitor: None,
            #[cfg(target_os = "linux")]
            monitor: None,
            config,
            running: Arc::new(Mutex::new(false)),
        }
    }

    /// 启动 AI Guardian
    pub fn start(&mut self) -> Result<(), GuardianError> {
        let running = self.running.lock().unwrap();
        if *running {
            return Ok(());
        }
        drop(running);

        #[cfg(windows)]
        {
            let mut monitor = monitor::windows::WindowsMonitor::new();
            monitor
                .start()
                .map_err(|e| GuardianError::MonitorError(e.to_string()))?;
            self.monitor = Some(monitor);
            return Ok(());
        }

        #[cfg(target_os = "linux")]
        {
            // TODO: 实现 Linux 监控
            return Err(GuardianError::NotImplemented(
                "Linux support coming soon".to_string(),
            ));
        }

        #[cfg(not(any(windows, target_os = "linux")))]
        {
            let mut running = self.running.lock().unwrap();
            *running = true;
            log::info!("AI Guardian started successfully");
            Ok(())
        }
    }

    /// 停止 AI Guardian
    pub fn stop(&mut self) {
        let mut running = self.running.lock().unwrap();
        if !*running {
            return;
        }

        #[cfg(windows)]
        if let Some(ref mut monitor) = self.monitor {
            monitor.stop();
        }

        *running = false;
        log::info!("AI Guardian stopped");
    }

    /// 检查是否正在运行
    pub fn is_running(&self) -> bool {
        *self.running.lock().unwrap()
    }

    /// 获取当前 AI 终端进程列表
    #[cfg(windows)]
    pub fn get_ai_processes(&self) -> Vec<monitor::windows::etw::ProcessInfo> {
        self.monitor
            .as_ref()
            .map(|m| m.get_ai_processes())
            .unwrap_or_default()
    }

    /// 检查进程是否是 AI 终端
    pub fn is_ai_terminal(&self, _pid: u32) -> bool {
        #[cfg(windows)]
        {
            self.monitor
                .as_ref()
                .map(|m| m.is_ai_terminal(_pid))
                .unwrap_or(false)
        }
        #[cfg(not(windows))]
        {
            false
        }
    }

    /// 手动添加 AI 进程
    pub fn add_ai_process(&self, _pid: u32) -> Result<(), GuardianError> {
        #[cfg(windows)]
        {
            if let Some(ref monitor) = self.monitor {
                monitor
                    .add_ai_process_to_driver(_pid)
                    .map_err(|e| GuardianError::DriverError(e.to_string()))?;
                return Ok(());
            }
        }
        Err(GuardianError::NotRunning)
    }

    /// 手动移除 AI 进程
    pub fn remove_ai_process(&self, _pid: u32) -> Result<(), GuardianError> {
        #[cfg(windows)]
        {
            if let Some(ref monitor) = self.monitor {
                monitor
                    .remove_ai_process_from_driver(_pid)
                    .map_err(|e| GuardianError::DriverError(e.to_string()))?;
                return Ok(());
            }
        }
        Err(GuardianError::NotRunning)
    }

    /// 获取 AI 终端进程数
    pub fn ai_process_count(&self) -> usize {
        #[cfg(windows)]
        {
            self.monitor
                .as_ref()
                .map(|m| m.ai_process_count())
                .unwrap_or(0)
        }
        #[cfg(not(windows))]
        {
            0
        }
    }

    /// 检查驱动是否已连接
    #[cfg(windows)]
    pub fn is_driver_connected(&self) -> bool {
        self.monitor
            .as_ref()
            .map(|m| m.is_driver_connected())
            .unwrap_or(false)
    }

    /// 获取驱动统计信息
    #[cfg(windows)]
    pub fn get_driver_stats(&self) -> Result<driver::windows::DriverStats, GuardianError> {
        if let Some(ref monitor) = self.monitor {
            monitor
                .get_driver_stats()
                .map_err(|e| GuardianError::DriverError(e.to_string()))
        } else {
            Err(GuardianError::NotRunning)
        }
    }

    /// 更新配置
    pub fn update_config(&mut self, config: GuardianConfig) -> Result<(), GuardianError> {
        self.config = config.clone();

        #[cfg(windows)]
        {
            if let Some(ref monitor) = self.monitor {
                let driver_config = driver::windows::DriverConfig {
                    block_file_delete: config.block_file_delete,
                    block_system_path_write: config.block_system_path_write,
                    block_network_connection: config.block_network_connection,
                    log_all_operations: config.log_all_operations,
                    risk_threshold: config.risk_threshold,
                };
                monitor
                    .set_driver_config(&driver_config)
                    .map_err(|e| GuardianError::DriverError(e.to_string()))?;
            }
        }

        Ok(())
    }

    /// 获取当前配置
    pub fn get_config(&self) -> &GuardianConfig {
        &self.config
    }
}

impl Default for AiGuardian {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for AiGuardian {
    fn drop(&mut self) {
        self.stop();
    }
}

/// Guardian 错误类型
#[derive(Debug, thiserror::Error)]
pub enum GuardianError {
    #[error("Monitor error: {0}")]
    MonitorError(String),

    #[error("Driver error: {0}")]
    DriverError(String),

    #[error("AI Guardian is not running")]
    NotRunning,

    #[error("Not implemented: {0}")]
    NotImplemented(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_guardian_creation() {
        let guardian = AiGuardian::new();
        assert!(!guardian.is_running());
        assert_eq!(guardian.ai_process_count(), 0);
    }

    #[test]
    fn test_guardian_config() {
        let config = GuardianConfig::default();
        assert!(config.auto_detect_ai_terminals);
        assert!(config.block_file_delete);
        assert!(config.block_system_path_write);
        assert_eq!(config.risk_threshold, 70);
    }
}
