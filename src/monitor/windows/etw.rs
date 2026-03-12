//! AI Guardian Windows Process Monitor
//!
//! 监控进程创建和退出，自动识别 AI Agent 终端进程

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

/// AI 终端进程标记环境变量
const AI_TERMINAL_MARKER: &str = "AI_GUARDIAN_TERMINAL=1";
const OPENCLAW_MARKER: &str = "OPENCLAW_TERMINAL=1";
const CURSOR_MARKER: &str = "CURSOR_TERMINAL=1";
const WINDSURF_MARKER: &str = "WINDSURF_TERMINAL=1";

/// 已知的 AI Agent 进程名
const AI_AGENT_PROCESSES: &[&str] = &[
    "openclaw.exe",
    "cursor.exe",
    "windsurf.exe",
    "trae.exe",
    "claude.exe",
    "claude-code.exe",
    "aider.exe",
    "continue.exe",
];

/// 进程信息
#[derive(Debug, Clone)]
pub struct ProcessInfo {
    pub pid: u32,
    pub parent_pid: u32,
    pub name: String,
    pub command_line: String,
    pub is_ai_terminal: bool,
    pub ai_parent_pid: Option<u32>,
}

/// 进程监控器
pub struct EtwProcessMonitor {
    ai_processes: Arc<Mutex<HashMap<u32, ProcessInfo>>>,
    running: Arc<Mutex<bool>>,
    handle: Option<thread::JoinHandle<()>>,
}

impl EtwProcessMonitor {
    /// 创建新的监控器
    pub fn new() -> Self {
        Self {
            ai_processes: Arc::new(Mutex::new(HashMap::new())),
            running: Arc::new(Mutex::new(false)),
            handle: None,
        }
    }

    /// 启动监控
    pub fn start(&mut self) -> Result<(), EtwError> {
        let mut running = self.running.lock().unwrap();
        if *running {
            return Ok(());
        }

        *running = true;
        let running_clone = Arc::clone(&self.running);
        let ai_processes_clone = Arc::clone(&self.ai_processes);

        self.handle = Some(thread::spawn(move || {
            monitor_loop(running_clone, ai_processes_clone);
        }));

        log::info!("Process Monitor started");
        Ok(())
    }

    /// 停止监控
    pub fn stop(&mut self) {
        let mut running = self.running.lock().unwrap();
        *running = false;
        drop(running);

        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }

        log::info!("Process Monitor stopped");
    }

    /// 获取当前 AI 终端进程列表
    pub fn get_ai_processes(&self) -> Vec<ProcessInfo> {
        let processes = self.ai_processes.lock().unwrap();
        processes.values().cloned().collect()
    }

    /// 检查进程是否是 AI 终端
    pub fn is_ai_terminal(&self, pid: u32) -> bool {
        let processes = self.ai_processes.lock().unwrap();
        processes.contains_key(&pid)
    }

    /// 获取 AI 终端进程数
    pub fn ai_process_count(&self) -> usize {
        let processes = self.ai_processes.lock().unwrap();
        processes.len()
    }
}

impl Drop for EtwProcessMonitor {
    fn drop(&mut self) {
        self.stop();
    }
}

/// 监控循环
fn monitor_loop(running: Arc<Mutex<bool>>, ai_processes: Arc<Mutex<HashMap<u32, ProcessInfo>>>) {
    let mut last_processes: HashMap<u32, ProcessInfo> = HashMap::new();

    loop {
        {
            let running = running.lock().unwrap();
            if !*running {
                break;
            }
        }

        // 扫描当前进程
        match scan_processes() {
            Ok(current_processes) => {
                // 检测新进程
                for (pid, info) in &current_processes {
                    if !last_processes.contains_key(pid) {
                        // 新进程
                        if is_ai_terminal_process(info) {
                            log::info!(
                                "Detected AI terminal process: {} (PID: {})",
                                info.name,
                                pid
                            );
                            let mut ai_procs = ai_processes.lock().unwrap();
                            ai_processes.insert(*pid, info.clone());
                        }
                    }
                }

                // 检测退出的进程
                for (pid, info) in &last_processes {
                    if !current_processes.contains_key(pid) {
                        log::info!("Process exited: {} (PID: {})", info.name, pid);
                        let mut ai_procs = ai_processes.lock().unwrap();
                        ai_procs.remove(pid);
                    }
                }

                last_processes = current_processes;
            }
            Err(e) => {
                log::error!("Failed to scan processes: {}", e);
            }
        }

        thread::sleep(Duration::from_millis(500));
    }
}

/// 扫描所有进程
#[cfg(windows)]
fn scan_processes() -> Result<HashMap<u32, ProcessInfo>, EtwError> {
    use std::process::Command;

    let mut processes = HashMap::new();

    // 使用 PowerShell 获取进程列表
    let output = Command::new("powershell")
        .args([
            "-Command",
            "Get-Process | Select-Object Id, ProcessName, Path | ConvertTo-Json",
        ])
        .output()
        .map_err(|_| EtwError::ScanFailed)?;

    let output_str = String::from_utf8_lossy(&output.stdout);

    // 简单解析 PowerShell JSON 输出
    // 这是一个简化的实现，实际应该使用 serde_json
    for line in output_str.lines() {
        if line.contains("\"Id\":") {
            // 提取 PID
            if let Some(pid_start) = line.find("\"Id\":") {
                let pid_str = &line[pid_start + 6..];
                if let Some(pid_end) = pid_str.find(',') {
                    if let Ok(pid) = pid_str[..pid_end].trim().parse::<u32>() {
                        let info = ProcessInfo {
                            pid,
                            parent_pid: 0,
                            name: format!("process_{}", pid),
                            command_line: String::new(),
                            is_ai_terminal: false,
                            ai_parent_pid: None,
                        };
                        processes.insert(pid, info);
                    }
                }
            }
        }
    }

    Ok(processes)
}

#[cfg(not(windows))]
fn scan_processes() -> Result<HashMap<u32, ProcessInfo>, EtwError> {
    Ok(HashMap::new())
}

/// 检查进程名是否是 AI Agent
fn is_ai_terminal_by_name(name: &str) -> bool {
    let name_lower = name.to_lowercase();
    AI_AGENT_PROCESSES
        .iter()
        .any(|&proc| name_lower.contains(proc))
}

/// 检查命令行是否包含 AI 标记
fn is_ai_terminal_by_command_line(cmdline: &str) -> bool {
    let cmdline_lower = cmdline.to_lowercase();
    cmdline_lower.contains(&AI_TERMINAL_MARKER.to_lowercase())
        || cmdline_lower.contains(&OPENCLAW_MARKER.to_lowercase())
        || cmdline_lower.contains(&CURSOR_MARKER.to_lowercase())
        || cmdline_lower.contains(&WINDSURF_MARKER.to_lowercase())
}

/// 检查是否是 AI 终端进程
fn is_ai_terminal_process(info: &ProcessInfo) -> bool {
    is_ai_terminal_by_name(&info.name) || is_ai_terminal_by_command_line(&info.command_line)
}

/// 检查父进程是否是 AI 终端
fn check_ai_parent(parent_pid: u32, processes: &HashMap<u32, ProcessInfo>) -> Option<u32> {
    if let Some(parent) = processes.get(&parent_pid) {
        if parent.is_ai_terminal {
            return Some(parent_pid);
        }
        // 递归检查祖父进程
        if parent.ai_parent_pid.is_some() {
            return parent.ai_parent_pid;
        }
    }
    None
}

/// ETW 错误类型
#[derive(Debug, thiserror::Error)]
pub enum EtwError {
    #[error("Failed to scan processes")]
    ScanFailed,

    #[error("Process access denied")]
    ProcessAccessDenied,

    #[error("Query process information failed")]
    QueryFailed,

    #[error("Read process memory failed")]
    ReadFailed,

    #[error("ETW session error")]
    SessionError,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_ai_terminal_by_name() {
        assert!(is_ai_terminal_by_name("openclaw.exe"));
        assert!(is_ai_terminal_by_name("Cursor.exe"));
        assert!(is_ai_terminal_by_name("windsurf.exe"));
        assert!(!is_ai_terminal_by_name("notepad.exe"));
        assert!(!is_ai_terminal_by_name("chrome.exe"));
    }

    #[test]
    fn test_is_ai_terminal_by_command_line() {
        assert!(is_ai_terminal_by_command_line(
            "node.exe script.js AI_GUARDIAN_TERMINAL=1"
        ));
        assert!(is_ai_terminal_by_command_line(
            "powershell.exe OPENCLAW_TERMINAL=1"
        ));
        assert!(!is_ai_terminal_by_command_line("notepad.exe file.txt"));
    }
}
