//! AI Guardian 驱动模块
//!
//! 提供与内核驱动的通信接口

#[cfg(windows)]
pub mod windows;

#[cfg(target_os = "linux")]
pub mod linux;

/// 驱动接口 trait
pub trait DriverInterface {
    /// 添加 AI 进程
    fn add_ai_process(&self, pid: u32) -> Result<(), DriverError>;

    /// 移除 AI 进程
    fn remove_ai_process(&self, pid: u32) -> Result<(), DriverError>;

    /// 检查驱动是否连接
    fn is_connected(&self) -> bool;
}

/// 驱动错误
#[derive(Debug, thiserror::Error)]
pub enum DriverError {
    #[error("Failed to open driver device")]
    DeviceOpenFailed,

    #[error("IOCTL call failed")]
    IoctlFailed,

    #[error("Driver not loaded")]
    DriverNotLoaded,

    #[error("Permission denied")]
    PermissionDenied,

    #[error("Platform not supported")]
    UnsupportedPlatform,
}
