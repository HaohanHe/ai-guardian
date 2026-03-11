//! AI Guardian Windows ETW Process Monitor
//! 
//! 使用 ETW (Event Tracing for Windows) 监控进程创建和终止
//! 只监控 AI 终端进程的子进程

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use windows::core::{Result, HSTRING};
use windows::Win32::Foundation::{CloseHandle, HANDLE, ERROR_SUCCESS};
use windows::Win32::System::Diagnostics::Etw::*;
use windows::Win32::System::Threading::GetCurrentProcessId;

/// 进程事件类型
#[derive(Debug, Clone)]
pub enum ProcessEventType {
    Created,
    Terminated,
}

/// 进程事件
#[derive(Debug, Clone)]
pub struct ProcessEvent {
    pub event_type: ProcessEventType,
    pub process_id: u32,
    pub parent_process_id: u32,
    pub process_name: String,
    pub command_line: String,
    pub timestamp: u64,
}

/// ETW 进程监控器
pub struct EtwProcessMonitor {
    session_handle: TRACEHANDLE,
    ai_processes: Arc<Mutex<HashMap<u32, ProcessInfo>>>,
    event_callback: Option<Box<dyn Fn(ProcessEvent) + Send + Sync>>,
}

#[derive(Debug, Clone)]
struct ProcessInfo {
    pid: u32,
    name: String,
    start_time: u64,
}

impl EtwProcessMonitor {
    /// 创建新的 ETW 监控器
    pub fn new() -> Result<Self> {
        Ok(Self {
            session_handle: 0,
            ai_processes: Arc::new(Mutex::new(HashMap::new())),
            event_callback: None,
        })
    }
    
    /// 注册 AI 终端进程
    pub fn register_ai_process(&self, pid: u32, name: &str) {
        let mut processes = self.ai_processes.lock().unwrap();
        processes.insert(pid, ProcessInfo {
            pid,
            name: name.to_string(),
            start_time: Self::get_timestamp(),
        });
        log::info!("ETW: Registered AI process {} ({})", pid, name);
    }
    
    /// 注销 AI 终端进程
    pub fn unregister_ai_process(&self, pid: u32) {
        let mut processes = self.ai_processes.lock().unwrap();
        if processes.remove(&pid).is_some() {
            log::info!("ETW: Unregistered AI process {}", pid);
        }
    }
    
    /// 检查是否是 AI 终端或其子进程
    fn is_ai_related_process(&self, pid: u32, parent_pid: u32) -> bool {
        let processes = self.ai_processes.lock().unwrap();
        
        // 直接是 AI 终端
        if processes.contains_key(&pid) {
            return true;
        }
        
        // 父进程是 AI 终端
        if processes.contains_key(&parent_pid) {
            return true;
        }
        
        // TODO: 递归检查祖父进程
        false
    }
    
    /// 设置事件回调
    pub fn set_event_callback<F>(&mut self, callback: F)
    where
        F: Fn(ProcessEvent) + Send + Sync + 'static,
    {
        self.event_callback = Some(Box::new(callback));
    }
    
    /// 启动 ETW 会话
    pub fn start(&mut self) -> Result<()> {
        unsafe {
            // 启用 Microsoft-Windows-Kernel-Process 提供程序
            let provider_guid = HSTRING::from("{22FB2CD6-0E7B-422B-A0C7-2FAD1FD0E716}");
            
            // 设置事件回调
            let callback: Arc<Mutex<dyn FnMut(&EVENT_RECORD)>> = Arc::new(Mutex::new(|event: &EVENT_RECORD| {
                self.process_event(event);
            }));
            
            log::info!("ETW Process Monitor started");
            Ok(())
        }
    }
    
    /// 停止 ETW 会话
    pub fn stop(&mut self) -> Result<()> {
        if self.session_handle != 0 {
            unsafe {
                // ControlTraceW 停止会话
                log::info!("ETW Process Monitor stopped");
            }
        }
        Ok(())
    }
    
    /// 处理 ETW 事件
    fn process_event(&self, event: &EVENT_RECORD) {
        // 解析进程创建/终止事件
        let event_id = event.EventHeader.EventDescriptor.Id;
        
        match event_id {
            1 => { // Process Start
                if let Some(event_data) = unsafe { self.parse_process_start_event(event) } {
                    if self.is_ai_related_process(event_data.process_id, event_data.parent_process_id) {
                        // 自动注册子进程
                        self.register_ai_process(
                            event_data.process_id,
                            &event_data.process_name
                        );
                        
                        if let Some(ref callback) = self.event_callback {
                            callback(event_data);
                        }
                    }
                }
            }
            2 => { // Process Stop
                if let Some(event_data) = unsafe { self.parse_process_stop_event(event) } {
                    if self.is_ai_related_process(event_data.process_id, 0) {
                        self.unregister_ai_process(event_data.process_id);
                        
                        if let Some(ref callback) = self.event_callback {
                            callback(event_data);
                        }
                    }
                }
            }
            _ => {}
        }
    }
    
    /// 解析进程启动事件
    unsafe fn parse_process_start_event(&self, event: &EVENT_RECORD) -> Option<ProcessEvent> {
        // 从事件数据中提取进程信息
        // 事件数据结构参考：
        // https://docs.microsoft.com/en-us/windows/win32/etw/c-processtypedef
        
        let data = std::slice::from_raw_parts(
            event.UserData as *const u8,
            event.UserDataLength as usize
        );
        
        if data.len() < 16 {
            return None;
        }
        
        // 解析 PID 和父 PID
        let process_id = u32::from_ne_bytes([data[0], data[1], data[2], data[3]]);
        let parent_process_id = u32::from_ne_bytes([data[4], data[5], data[6], data[7]]);
        
        Some(ProcessEvent {
            event_type: ProcessEventType::Created,
            process_id,
            parent_process_id,
            process_name: String::from("unknown"),
            command_line: String::new(),
            timestamp: Self::get_timestamp(),
        })
    }
    
    /// 解析进程终止事件
    unsafe fn parse_process_stop_event(&self, event: &EVENT_RECORD) -> Option<ProcessEvent> {
        let data = std::slice::from_raw_parts(
            event.UserData as *const u8,
            event.UserDataLength as usize
        );
        
        if data.len() < 4 {
            return None;
        }
        
        let process_id = u32::from_ne_bytes([data[0], data[1], data[2], data[3]]);
        
        Some(ProcessEvent {
            event_type: ProcessEventType::Terminated,
            process_id,
            parent_process_id: 0,
            process_name: String::from("unknown"),
            command_line: String::new(),
            timestamp: Self::get_timestamp(),
        })
    }
    
    /// 获取当前时间戳
    fn get_timestamp() -> u64 {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }
}

impl Drop for EtwProcessMonitor {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

/// 使用 WMI 获取进程信息（备用方案）
pub mod wmi_fallback {
    use std::process::Command;
    
    /// 获取进程列表
    pub fn get_process_list() -> Vec<(u32, String, u32)> {
        let output = Command::new("wmic")
            .args(&["process", "get", "ProcessId,Name,ParentProcessId", "/format:csv"])
            .output();
        
        match output {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                parse_wmic_output(&stdout)
            }
            Err(_) => Vec::new(),
        }
    }
    
    fn parse_wmic_output(output: &str) -> Vec<(u32, String, u32)> {
        let mut processes = Vec::new();
        
        for line in output.lines().skip(1) { // 跳过标题行
            let parts: Vec<&str> = line.split(',').collect();
            if parts.len() >= 4 {
                if let (Ok(pid), Ok(ppid)) = (parts[2].trim().parse(), parts[3].trim().parse()) {
                    processes.push((pid, parts[1].trim().to_string(), ppid));
                }
            }
        }
        
        processes
    }
    
    /// 获取进程命令行
    pub fn get_process_command_line(pid: u32) -> Option<String> {
        let output = Command::new("wmic")
            .args(&["process", "where", &format!("ProcessId={}", pid), 
                   "get", "CommandLine", "/value"])
            .output()
            .ok()?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout
            .lines()
            .find(|line| line.starts_with("CommandLine="))
            .map(|line| line.trim_start_matches("CommandLine=").to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_etw_monitor_creation() {
        let monitor = EtwProcessMonitor::new();
        assert!(monitor.is_ok());
    }
    
    #[test]
    fn test_process_registration() {
        let mut monitor = EtwProcessMonitor::new().unwrap();
        monitor.register_ai_process(1234, "test.exe");
        
        // 检查是否注册成功
        let processes = monitor.ai_processes.lock().unwrap();
        assert!(processes.contains_key(&1234));
    }
    
    #[test]
    fn test_wmi_fallback() {
        let processes = wmi_fallback::get_process_list();
        // 至少应该有当前测试进程
        assert!(!processes.is_empty());
    }
}
