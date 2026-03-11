//! AI Guardian Windows Driver Interface
//! 
//! 与内核驱动通信，管理 AI 终端进程列表

use std::ffi::c_void;
use std::os::raw::c_ulong;
use std::ptr::null_mut;
use windows::Win32::Foundation::{CloseHandle, HANDLE, STATUS_SUCCESS};
use windows::Win32::Storage::FileSystem::{CreateFileW, FILE_GENERIC_READ, FILE_GENERIC_WRITE, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING};
use windows::Win32::System::Ioctl::DeviceIoControl;
use windows::core::PCWSTR;

/// 驱动设备路径
const AI_GUARDIAN_DEVICE_PATH: &str = r"\\.\AiGuardianDevice";

// IOCTL 控制码 (必须与驱动中定义的一致)
const FILE_DEVICE_UNKNOWN: u32 = 0x00000022;
const METHOD_BUFFERED: u32 = 0;
const FILE_ANY_ACCESS: u32 = 0;

fn ctl_code(device_type: u32, function: u32, method: u32, access: u32) -> u32 {
    (device_type << 16) | (access << 14) | (function << 2) | method
}

const IOCTL_AI_GUARDIAN_ADD_PROCESS: u32 = ctl_code(FILE_DEVICE_UNKNOWN, 0x800, METHOD_BUFFERED, FILE_ANY_ACCESS);
const IOCTL_AI_GUARDIAN_REMOVE_PROCESS: u32 = ctl_code(FILE_DEVICE_UNKNOWN, 0x801, METHOD_BUFFERED, FILE_ANY_ACCESS);
const IOCTL_AI_GUARDIAN_GET_STATS: u32 = ctl_code(FILE_DEVICE_UNKNOWN, 0x802, METHOD_BUFFERED, FILE_ANY_ACCESS);
const IOCTL_AI_GUARDIAN_SET_CONFIG: u32 = ctl_code(FILE_DEVICE_UNKNOWN, 0x803, METHOD_BUFFERED, FILE_ANY_ACCESS);

/// 驱动统计信息
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct DriverStats {
    pub total_operations_blocked: i64,
    pub total_operations_allowed: i64,
    pub ai_process_count: i64,
    pub driver_active: bool,
}

/// 驱动配置
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

/// Windows 驱动接口
pub struct WindowsDriver {
    device_handle: HANDLE,
}

impl WindowsDriver {
    /// 打开驱动设备
    pub fn open() -> Result<Self, DriverError> {
        unsafe {
            let device_path: Vec<u16> = AI_GUARDIAN_DEVICE_PATH
                .encode_utf16()
                .chain(std::iter::once(0))
                .collect();
            
            let handle = CreateFileW(
                PCWSTR(device_path.as_ptr()),
                FILE_GENERIC_READ.0 | FILE_GENERIC_WRITE.0,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                null_mut(),
                OPEN_EXISTING,
                windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES(0),
                HANDLE(null_mut()),
            );
            
            if handle.is_invalid() {
                return Err(DriverError::DeviceOpenFailed);
            }
            
            Ok(Self {
                device_handle: handle,
            })
        }
    }
    
    /// 添加 AI 终端进程
    pub fn add_ai_process(&self, pid: u32) -> Result<(), DriverError> {
        unsafe {
            let mut bytes_returned: u32 = 0;
            
            let result = DeviceIoControl(
                self.device_handle,
                IOCTL_AI_GUARDIAN_ADD_PROCESS,
                Some(&pid as *const _ as *const c_void),
                std::mem::size_of::<u32>() as u32,
                None,
                0,
                Some(&mut bytes_returned),
                None,
            );
            
            if !result.as_bool() {
                return Err(DriverError::IoctlFailed);
            }
            
            log::info!("Added AI process {} to driver", pid);
            Ok(())
        }
    }
    
    /// 移除 AI 终端进程
    pub fn remove_ai_process(&self, pid: u32) -> Result<(), DriverError> {
        unsafe {
            let mut bytes_returned: u32 = 0;
            
            let result = DeviceIoControl(
                self.device_handle,
                IOCTL_AI_GUARDIAN_REMOVE_PROCESS,
                Some(&pid as *const _ as *const c_void),
                std::mem::size_of::<u32>() as u32,
                None,
                0,
                Some(&mut bytes_returned),
                None,
            );
            
            if !result.as_bool() {
                return Err(DriverError::IoctlFailed);
            }
            
            log::info!("Removed AI process {} from driver", pid);
            Ok(())
        }
    }
    
    /// 获取驱动统计信息
    pub fn get_stats(&self) -> Result<DriverStats, DriverError> {
        unsafe {
            let mut stats: DriverStats = std::mem::zeroed();
            let mut bytes_returned: u32 = 0;
            
            let result = DeviceIoControl(
                self.device_handle,
                IOCTL_AI_GUARDIAN_GET_STATS,
                None,
                0,
                Some(&mut stats as *mut _ as *mut c_void),
                std::mem::size_of::<DriverStats>() as u32,
                Some(&mut bytes_returned),
                None,
            );
            
            if !result.as_bool() {
                return Err(DriverError::IoctlFailed);
            }
            
            Ok(stats)
        }
    }
    
    /// 设置驱动配置
    pub fn set_config(&self, config: &DriverConfig) -> Result<(), DriverError> {
        unsafe {
            let mut bytes_returned: u32 = 0;
            
            let result = DeviceIoControl(
                self.device_handle,
                IOCTL_AI_GUARDIAN_SET_CONFIG,
                Some(config as *const _ as *const c_void),
                std::mem::size_of::<DriverConfig>() as u32,
                None,
                0,
                Some(&mut bytes_returned),
                None,
            );
            
            if !result.as_bool() {
                return Err(DriverError::IoctlFailed);
            }
            
            log::info!("Updated driver config");
            Ok(())
        }
    }
    
    /// 检查驱动是否运行
    pub fn is_driver_active(&self) -> Result<bool, DriverError> {
        let stats = self.get_stats()?;
        Ok(stats.driver_active)
    }
}

impl Drop for WindowsDriver {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.device_handle);
        }
    }
}

/// 驱动错误类型
#[derive(Debug, thiserror::Error)]
pub enum DriverError {
    #[error("Failed to open driver device")]
    DeviceOpenFailed,
    
    #[error("IOCTL call failed")]
    IoctlFailed,
    
    #[error("Driver not loaded")]
    DriverNotLoaded,
}

/// 安装驱动（需要管理员权限）
pub fn install_driver(driver_path: &str) -> Result<(), DriverError> {
    use std::process::Command;
    
    // 使用 sc.exe 创建服务
    let output = Command::new("sc.exe")
        .args(&[
            "create",
            "AiGuardianDriver",
            "binPath=",
            driver_path,
            "type=",
            "filesys",
            "start=",
            "demand",
            "error=",
            "normal",
            "DisplayName=",
            "AI Guardian Driver",
        ])
        .output()
        .map_err(|_| DriverError::IoctlFailed)?;
    
    if !output.status.success() {
        log::error!("Failed to create driver service: {}", 
                   String::from_utf8_lossy(&output.stderr));
        return Err(DriverError::IoctlFailed);
    }
    
    // 启动服务
    let output = Command::new("sc.exe")
        .args(&["start", "AiGuardianDriver"])
        .output()
        .map_err(|_| DriverError::IoctlFailed)?;
    
    if !output.status.success() {
        log::error!("Failed to start driver service: {}",
                   String::from_utf8_lossy(&output.stderr));
        return Err(DriverError::IoctlFailed);
    }
    
    log::info!("Driver installed and started successfully");
    Ok(())
}

/// 卸载驱动
pub fn uninstall_driver() -> Result<(), DriverError> {
    use std::process::Command;
    
    // 停止服务
    let _ = Command::new("sc.exe")
        .args(&["stop", "AiGuardianDriver"])
        .output();
    
    // 删除服务
    let output = Command::new("sc.exe")
        .args(&["delete", "AiGuardianDriver"])
        .output()
        .map_err(|_| DriverError::IoctlFailed)?;
    
    if !output.status.success() {
        log::error!("Failed to delete driver service: {}",
                   String::from_utf8_lossy(&output.stderr));
        return Err(DriverError::IoctlFailed);
    }
    
    log::info!("Driver uninstalled successfully");
    Ok(())
}

/// 检查驱动是否已安装
pub fn is_driver_installed() -> bool {
    use std::process::Command;
    
    let output = Command::new("sc.exe")
        .args(&["query", "AiGuardianDriver"])
        .output();
    
    match output {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

/// 检查驱动是否正在运行
pub fn is_driver_running() -> bool {
    use std::process::Command;
    
    let output = Command::new("sc.exe")
        .args(&["query", "AiGuardianDriver"])
        .output();
    
    match output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            stdout.contains("RUNNING")
        }
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_driver_config_default() {
        let config = DriverConfig::default();
        assert!(config.block_file_delete);
        assert!(config.block_system_path_write);
        assert!(config.block_network_connection);
        assert!(!config.log_all_operations);
        assert_eq!(config.risk_threshold, 70);
    }
    
    #[test]
    fn test_ioctl_codes() {
        // 验证 IOCTL 码与驱动中定义的一致
        assert_eq!(IOCTL_AI_GUARDIAN_ADD_PROCESS, 0x222000);
        assert_eq!(IOCTL_AI_GUARDIAN_REMOVE_PROCESS, 0x222004);
        assert_eq!(IOCTL_AI_GUARDIAN_GET_STATS, 0x222008);
        assert_eq!(IOCTL_AI_GUARDIAN_SET_CONFIG, 0x22200C);
    }
}
