//! AI Guardian Windows Driver Interface
//! 
//! 提供与 Windows 内核驱动的完整接口，包括：
//! - Minifilter 文件系统监控
//! - ETW 进程监控
//! - WFP 网络监控

pub mod driver;
pub mod etw_monitor;
pub mod wfp_monitor;

use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use driver::{WindowsDriver, DriverConfig, DriverStats, DriverError};
use etw_monitor::{EtwProcessMonitor, ProcessEvent};
use wfp_monitor::{WfpNetworkMonitor, NetworkEvent, ConnectionDecision};

/// Windows 平台完整监控引擎
pub struct WindowsGuardianEngine {
    /// 内核驱动接口
    driver: Option<WindowsDriver>,
    /// ETW 进程监控
    etw_monitor: Option<EtwProcessMonitor>,
    /// WFP 网络监控
    wfp_monitor: Option<WfpNetworkMonitor>,
    /// AI 终端进程列表
    ai_processes: Arc<Mutex<HashSet<u32>>>,
    /// 是否正在运行
    is_running: bool,
}

impl WindowsGuardianEngine {
    /// 创建新的 Windows 监控引擎
    pub fn new() -> Self {
        Self {
            driver: None,
            etw_monitor: None,
            wfp_monitor: None,
            ai_processes: Arc::new(Mutex::new(HashSet::new())),
            is_running: false,
        }
    }
    
    /// 初始化并启动所有监控组件
    pub fn initialize(&mut self) -> Result<(), GuardianError> {
        log::info!("Initializing Windows Guardian Engine...");
        
        // 1. 尝试连接内核驱动
        match WindowsDriver::open() {
            Ok(driver) => {
                log::info!("Connected to kernel driver");
                self.driver = Some(driver);
            }
            Err(e) => {
                log::warn!("Failed to connect to kernel driver: {}. Using fallback mode.", e);
                // 继续运行，使用备用方案
            }
        }
        
        // 2. 初始化 ETW 进程监控
        match EtwProcessMonitor::new() {
            Ok(mut etw) => {
                etw.set_event_callback(|event| {
                    log::debug!("Process event: {:?}", event);
                });
                
                if let Err(e) = etw.start() {
                    log::warn!("Failed to start ETW monitor: {}", e);
                } else {
                    self.etw_monitor = Some(etw);
                }
            }
            Err(e) => {
                log::warn!("Failed to create ETW monitor: {}", e);
            }
        }
        
        // 3. 初始化 WFP 网络监控
        let mut wfp = WfpNetworkMonitor::new();
        wfp.set_event_callback(|event| {
            log::debug!("Network event: {:?}", event);
            ConnectionDecision::Allow
        });
        
        if let Err(e) = wfp.start() {
            log::warn!("Failed to start WFP monitor: {}", e);
        } else {
            self.wfp_monitor = Some(wfp);
        }
        
        self.is_running = true;
        log::info!("Windows Guardian Engine initialized");
        
        Ok(())
    }
    
    /// 注册 AI 终端进程
    pub fn register_ai_process(&mut self, pid: u32, name: &str) -> Result<(), GuardianError> {
        // 添加到本地列表
        {
            let mut processes = self.ai_processes.lock().unwrap();
            processes.insert(pid);
        }
        
        // 通知内核驱动
        if let Some(ref driver) = self.driver {
            driver.add_ai_process(pid)
                .map_err(|e| GuardianError::DriverError(e.to_string()))?;
        }
        
        // 通知 ETW 监控
        if let Some(ref etw) = self.etw_monitor {
            etw.register_ai_process(pid, name);
        }
        
        // 通知 WFP 监控
        if let Some(ref wfp) = self.wfp_monitor {
            wfp.register_ai_process(pid);
        }
        
        log::info!("Registered AI process: {} ({})", pid, name);
        Ok(())
    }
    
    /// 注销 AI 终端进程
    pub fn unregister_ai_process(&mut self, pid: u32) -> Result<(), GuardianError> {
        // 从本地列表移除
        {
            let mut processes = self.ai_processes.lock().unwrap();
            processes.remove(&pid);
        }
        
        // 通知内核驱动
        if let Some(ref driver) = self.driver {
            driver.remove_ai_process(pid)
                .map_err(|e| GuardianError::DriverError(e.to_string()))?;
        }
        
        // 通知 ETW 监控
        if let Some(ref etw) = self.etw_monitor {
            etw.unregister_ai_process(pid);
        }
        
        // 通知 WFP 监控
        if let Some(ref wfp) = self.wfp_monitor {
            wfp.unregister_ai_process(pid);
        }
        
        log::info!("Unregistered AI process: {}", pid);
        Ok(())
    }
    
    /// 获取驱动统计信息
    pub fn get_stats(&self) -> Option<DriverStats> {
        self.driver.as_ref()?.get_stats().ok()
    }
    
    /// 设置驱动配置
    pub fn set_config(&self, config: &DriverConfig) -> Result<(), GuardianError> {
        if let Some(ref driver) = self.driver {
            driver.set_config(config)
                .map_err(|e| GuardianError::DriverError(e.to_string()))?;
        }
        Ok(())
    }
    
    /// 阻断特定 IP
    pub fn block_ip(&self, ip: std::net::IpAddr) {
        if let Some(ref wfp) = self.wfp_monitor {
            wfp.block_ip(ip);
        }
    }
    
    /// 阻断特定端口
    pub fn block_port(&self, port: u16) {
        if let Some(ref wfp) = self.wfp_monitor {
            wfp.block_port(port);
        }
    }
    
    /// 检查驱动是否连接
    pub fn is_driver_connected(&self) -> bool {
        self.driver.is_some()
    }
    
    /// 获取已注册的 AI 进程数量
    pub fn get_ai_process_count(&self) -> usize {
        self.ai_processes.lock().unwrap().len()
    }
    
    /// 停止所有监控
    pub fn shutdown(&mut self) {
        log::info!("Shutting down Windows Guardian Engine...");
        
        self.is_running = false;
        
        // 清理所有 AI 进程
        let pids: Vec<u32> = self.ai_processes.lock().unwrap().iter().copied().collect();
        for pid in pids {
            let _ = self.unregister_ai_process(pid);
        }
        
        // 停止 WFP
        if let Some(mut wfp) = self.wfp_monitor.take() {
            let _ = wfp.stop();
        }
        
        // 停止 ETW
        if let Some(mut etw) = self.etw_monitor.take() {
            let _ = etw.stop();
        }
        
        // 关闭驱动连接
        self.driver = None;
        
        log::info!("Windows Guardian Engine shutdown complete");
    }
}

impl Drop for WindowsGuardianEngine {
    fn drop(&mut self) {
        self.shutdown();
    }
}

/// Guardian 错误类型
#[derive(Debug, thiserror::Error)]
pub enum GuardianError {
    #[error("Driver error: {0}")]
    DriverError(String),
    
    #[error("ETW error: {0}")]
    EtwError(String),
    
    #[error("WFP error: {0}")]
    WfpError(String),
    
    #[error("Not initialized")]
    NotInitialized,
    
    #[error("Already running")]
    AlreadyRunning,
}

/// 重新导出子模块类型
pub use driver::{install_driver, uninstall_driver, is_driver_installed, is_driver_running};
pub use etw_monitor::{ProcessEventType, ProcessEvent, EtwProcessMonitor};
pub use wfp_monitor::{NetworkEventType, NetworkEvent, ConnectionDecision, WfpNetworkMonitor};

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_engine_creation() {
        let engine = WindowsGuardianEngine::new();
        assert!(!engine.is_running);
        assert!(!engine.is_driver_connected());
    }
    
    #[test]
    fn test_process_registration() {
        let mut engine = WindowsGuardianEngine::new();
        
        // 注册进程（不需要驱动连接）
        engine.register_ai_process(1234, "test.exe").ok();
        
        assert_eq!(engine.get_ai_process_count(), 1);
        
        // 注销进程
        engine.unregister_ai_process(1234).ok();
        
        assert_eq!(engine.get_ai_process_count(), 0);
    }
}
