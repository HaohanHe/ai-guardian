//! AI Guardian Windows Monitoring Module
//!
//! 整合 Windows 平台的所有监控功能：
//! - ETW 进程监控
//! - 驱动接口通信
//! - 网络监控 (WFP)

pub mod etw;

use crate::driver::windows::{DriverConfig, WindowsDriver};
use etw::{EtwProcessMonitor, ProcessInfo};

/// Windows 监控管理器
pub struct WindowsMonitor {
    process_monitor: EtwProcessMonitor,
    driver: Option<WindowsDriver>,
    auto_sync: bool,
}

impl WindowsMonitor {
    /// 创建新的监控管理器
    pub fn new() -> Self {
        Self {
            process_monitor: EtwProcessMonitor::new(),
            driver: None,
            auto_sync: true,
        }
    }

    /// 启动监控（包含驱动连接）
    pub fn start(&mut self) -> Result<(), MonitorError> {
        // 启动进程监控
        self.process_monitor
            .start()
            .map_err(|e| MonitorError::ProcessMonitorError(e.to_string()))?;

        // 尝试连接驱动
        match WindowsDriver::open() {
            Ok(driver) => {
                log::info!("Connected to AI Guardian driver");
                self.driver = Some(driver);

                // 如果启用了自动同步，启动同步线程
                if self.auto_sync {
                    self.start_sync_thread();
                }
            }
            Err(e) => {
                log::warn!(
                    "Failed to connect to driver: {}. Running in monitor-only mode.",
                    e
                );
            }
        }

        Ok(())
    }

    /// 停止监控
    pub fn stop(&mut self) {
        self.process_monitor.stop();
        self.driver = None;
    }

    /// 获取当前 AI 终端进程列表
    pub fn get_ai_processes(&self) -> Vec<ProcessInfo> {
        self.process_monitor.get_ai_processes()
    }

    /// 检查进程是否是 AI 终端
    pub fn is_ai_terminal(&self, pid: u32) -> bool {
        self.process_monitor.is_ai_terminal(pid)
    }

    /// 手动添加 AI 进程到驱动
    pub fn add_ai_process_to_driver(&self, pid: u32) -> Result<(), MonitorError> {
        if let Some(ref driver) = self.driver {
            driver
                .add_ai_process(pid)
                .map_err(|e| MonitorError::DriverError(e.to_string()))?;
            Ok(())
        } else {
            Err(MonitorError::DriverNotConnected)
        }
    }

    /// 手动从驱动移除 AI 进程
    pub fn remove_ai_process_from_driver(&self, pid: u32) -> Result<(), MonitorError> {
        if let Some(ref driver) = self.driver {
            driver
                .remove_ai_process(pid)
                .map_err(|e| MonitorError::DriverError(e.to_string()))?;
            Ok(())
        } else {
            Err(MonitorError::DriverNotConnected)
        }
    }

    /// 获取驱动统计信息
    pub fn get_driver_stats(&self) -> Result<crate::driver::windows::DriverStats, MonitorError> {
        if let Some(ref driver) = self.driver {
            driver
                .get_stats()
                .map_err(|e| MonitorError::DriverError(e.to_string()))
        } else {
            Err(MonitorError::DriverNotConnected)
        }
    }

    /// 设置驱动配置
    pub fn set_driver_config(&self, config: &DriverConfig) -> Result<(), MonitorError> {
        if let Some(ref driver) = self.driver {
            driver
                .set_config(config)
                .map_err(|e| MonitorError::DriverError(e.to_string()))?;
            Ok(())
        } else {
            Err(MonitorError::DriverNotConnected)
        }
    }

    /// 检查驱动是否已连接
    pub fn is_driver_connected(&self) -> bool {
        self.driver.is_some()
    }

    /// 获取 AI 终端进程数
    pub fn ai_process_count(&self) -> usize {
        self.process_monitor.ai_process_count()
    }

    /// 设置自动同步
    pub fn set_auto_sync(&mut self, enabled: bool) {
        self.auto_sync = enabled;
    }

    /// 同步 AI 进程列表到驱动
    fn sync_to_driver(&self) {
        if let Some(ref driver) = self.driver {
            let ai_processes = self.process_monitor.get_ai_processes();

            for proc in ai_processes {
                // 尝试添加，如果已存在会返回成功
                let _ = driver.add_ai_process(proc.pid);
            }
        }
    }

    /// 启动同步线程
    fn start_sync_thread(&self) {
        // 这里可以实现定期同步逻辑
        // 简化版本：在每次获取进程列表时同步
    }
}

impl Default for WindowsMonitor {
    fn default() -> Self {
        Self::new()
    }
}

/// 监控错误类型
#[derive(Debug, thiserror::Error)]
pub enum MonitorError {
    #[error("Process monitor error: {0}")]
    ProcessMonitorError(String),

    #[error("Driver error: {0}")]
    DriverError(String),

    #[error("Driver not connected")]
    DriverNotConnected,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_monitor_creation() {
        let monitor = WindowsMonitor::new();
        assert!(!monitor.is_driver_connected());
        assert_eq!(monitor.ai_process_count(), 0);
    }
}
