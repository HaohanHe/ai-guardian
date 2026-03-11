//! AI Guardian 监控模块
//!
//! 提供跨平台的进程监控功能

#[cfg(windows)]
pub mod windows;

#[cfg(target_os = "linux")]
pub mod linux;

/// 监控 trait，定义跨平台接口
pub trait ProcessMonitor {
    /// 启动监控
    fn start(&mut self) -> Result<(), MonitorError>;

    /// 停止监控
    fn stop(&mut self);

    /// 检查是否正在运行
    fn is_running(&self) -> bool;

    /// 获取监控的进程数
    fn process_count(&self) -> usize;
}

/// 监控错误
#[derive(Debug, thiserror::Error)]
pub enum MonitorError {
    #[error("Failed to start monitor: {0}")]
    StartFailed(String),

    #[error("Platform not supported")]
    UnsupportedPlatform,

    #[error("Permission denied")]
    PermissionDenied,

    #[error("Driver error: {0}")]
    DriverError(String),
}
