//! AI Guardian Linux 监控模块
//!
//! 使用 eBPF 实现系统调用监控
//! TODO: 实现 Linux 支持

use super::{MonitorError, ProcessMonitor};

/// Linux 监控器
pub struct LinuxMonitor {
    running: bool,
}

impl LinuxMonitor {
    /// 创建新的监控器
    pub fn new() -> Self {
        Self { running: false }
    }
}

impl ProcessMonitor for LinuxMonitor {
    fn start(&mut self) -> Result<(), MonitorError> {
        // TODO: 实现 eBPF 监控
        Err(MonitorError::UnsupportedPlatform)
    }

    fn stop(&mut self) {
        self.running = false;
    }

    fn is_running(&self) -> bool {
        self.running
    }

    fn process_count(&self) -> usize {
        0
    }
}

impl Default for LinuxMonitor {
    fn default() -> Self {
        Self::new()
    }
}

/// Linux 进程信息
#[derive(Debug, Clone)]
pub struct ProcessInfo {
    pub pid: u32,
    pub parent_pid: u32,
    pub name: String,
    pub command_line: String,
    pub is_ai_terminal: bool,
}
