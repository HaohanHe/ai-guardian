//! AI Guardian Linux 驱动接口
//!
//! TODO: 实现 Linux eBPF 驱动接口

use super::{DriverError, DriverInterface};

/// Linux 驱动接口
pub struct LinuxDriver;

impl LinuxDriver {
    /// 创建新的驱动接口
    pub fn new() -> Result<Self, DriverError> {
        Err(DriverError::UnsupportedPlatform)
    }
}

impl DriverInterface for LinuxDriver {
    fn add_ai_process(&self, _pid: u32) -> Result<(), DriverError> {
        Err(DriverError::UnsupportedPlatform)
    }

    fn remove_ai_process(&self, _pid: u32) -> Result<(), DriverError> {
        Err(DriverError::UnsupportedPlatform)
    }

    fn is_connected(&self) -> bool {
        false
    }
}

/// Linux 驱动配置
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct DriverConfig {
    pub block_file_delete: bool,
    pub block_system_path_write: bool,
    pub block_network_connection: bool,
    pub log_all_operations: bool,
    pub risk_threshold: u32,
}

impl Default for DriverConfig {
    fn default() -> Self {
        Self {
            block_file_delete: true,
            block_system_path_write: true,
            block_network_connection: true,
            log_all_operations: false,
            risk_threshold: 70,
        }
    }
}

/// Linux 驱动统计信息
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct DriverStats {
    pub total_operations_blocked: i64,
    pub total_operations_allowed: i64,
    pub ai_process_count: i64,
    pub driver_active: bool,
}

/// Linux Guardian 引擎
pub struct LinuxGuardianEngine {
    pub is_running: bool,
}

impl LinuxGuardianEngine {
    pub fn new() -> Self {
        Self { is_running: false }
    }
}
