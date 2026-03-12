//! AI Guardian Windows ETW Process Monitor
//!
//! 使用 ETW (Event Tracing for Windows) 监控进程创建和退出
//! 自动识别 AI Agent 终端进程

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use windows::core::{GUID, PCWSTR};
use windows::Win32::Foundation::ERROR_SUCCESS;
use windows::Win32::System::Diagnostics::Etw::*;

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

/// ETW 进程监控器
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

        log::info!("ETW Process Monitor started");
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

        log::info!("ETW Process Monitor stopped");
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

/// ETW 监控循环
fn monitor_loop(running: Arc<Mutex<bool>>, ai_processes: Arc<Mutex<HashMap<u32, ProcessInfo>>>) {
    // 使用 WMI 作为备选方案监控进程
    // ETW 需要更复杂的设置，这里使用轮询方式

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
                            ai_procs.insert(*pid, info.clone());
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
    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::System::Diagnostics::ToolHelp::*;
    use windows::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ,
    };

    let mut processes = HashMap::new();

    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
            .map_err(|_| EtwError::SnapshotFailed)?;

        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };

        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                let pid = entry.th32ProcessID;
                let parent_pid = entry.th32ParentProcessID;

                // 转换进程名
                let name_len = entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(260);
                let name = String::from_utf16_lossy(&entry.szExeFile[..name_len]);

                // 获取命令行
                let command_line = get_process_command_line(pid).unwrap_or_default();

                // 检查是否是 AI 终端
                let is_ai_terminal =
                    is_ai_terminal_by_name(&name) || is_ai_terminal_by_command_line(&command_line);

                let ai_parent_pid = if is_ai_terminal {
                    None
                } else {
                    check_ai_parent(parent_pid, &processes)
                };

                let info = ProcessInfo {
                    pid,
                    parent_pid,
                    name: name.clone(),
                    command_line,
                    is_ai_terminal: is_ai_terminal || ai_parent_pid.is_some(),
                    ai_parent_pid,
                };

                processes.insert(pid, info);

                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }

        let _ = CloseHandle(HANDLE(snapshot.0));
    }

    Ok(processes)
}

/// 获取进程命令行
#[cfg(windows)]
fn get_process_command_line(pid: u32) -> Result<String, EtwError> {
    use windows::Win32::System::Diagnostics::Debug::ReadProcessMemory;
    use windows::Win32::System::Memory::{VirtualQueryEx, MEMORY_BASIC_INFORMATION};
    use windows::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ,
    };

    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid)
            .map_err(|_| EtwError::ProcessAccessDenied)?;

        // 获取 PEB 地址
        let mut pbi = std::mem::zeroed();
        let status = NtQueryInformationProcess(
            handle,
            ProcessBasicInformation,
            &mut pbi as *mut _ as *mut _,
            std::mem::size_of::<PROCESS_BASIC_INFORMATION>() as u32,
            std::ptr::null_mut(),
        );

        if status != 0 {
            let _ = windows::Win32::Foundation::CloseHandle(handle);
            return Err(EtwError::QueryFailed);
        }

        // 读取进程参数
        let mut peb = std::mem::zeroed();
        let mut bytes_read = 0usize;

        let result = ReadProcessMemory(
            handle,
            pbi.PebBaseAddress as *const _,
            &mut peb as *mut _ as *mut _,
            std::mem::size_of::<PEB>(),
            Some(&mut bytes_read),
        );

        if result.is_err() {
            let _ = windows::Win32::Foundation::CloseHandle(handle);
            return Err(EtwError::ReadFailed);
        }

        // 读取命令行
        let mut proc_params: RTL_USER_PROCESS_PARAMETERS = std::mem::zeroed();
        let result = ReadProcessMemory(
            handle,
            peb.ProcessParameters as *const _,
            &mut proc_params as *mut _ as *mut _,
            std::mem::size_of::<RTL_USER_PROCESS_PARAMETERS>(),
            Some(&mut bytes_read),
        );

        if result.is_err() {
            let _ = windows::Win32::Foundation::CloseHandle(handle);
            return Err(EtwError::ReadFailed);
        }

        // 读取命令行字符串
        let buffer_size = proc_params.CommandLine.Length as usize;
        let mut buffer: Vec<u16> = vec![0; buffer_size / 2 + 1];

        let result = ReadProcessMemory(
            handle,
            proc_params.CommandLine.Buffer as *const _,
            buffer.as_mut_ptr() as *mut _,
            buffer_size,
            Some(&mut bytes_read),
        );

        let _ = windows::Win32::Foundation::CloseHandle(handle);

        if result.is_err() {
            return Err(EtwError::ReadFailed);
        }

        Ok(String::from_utf16_lossy(&buffer))
    }
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
    #[error("Failed to create process snapshot")]
    SnapshotFailed,

    #[error("Process access denied")]
    ProcessAccessDenied,

    #[error("Query process information failed")]
    QueryFailed,

    #[error("Read process memory failed")]
    ReadFailed,

    #[error("ETW session error")]
    SessionError,
}

// Windows API 结构体和函数定义
#[repr(C)]
#[derive(Default)]
struct PROCESS_BASIC_INFORMATION {
    ExitStatus: i32,
    PebBaseAddress: *mut PEB,
    AffinityMask: usize,
    BasePriority: i32,
    UniqueProcessId: usize,
    InheritedFromUniqueProcessId: usize,
}

#[repr(C)]
#[derive(Default)]
struct PEB {
    InheritedAddressSpace: u8,
    ReadImageFileExecOptions: u8,
    BeingDebugged: u8,
    BitField: u8,
    Mutant: *mut c_void,
    ImageBaseAddress: *mut c_void,
    Ldr: *mut c_void,
    ProcessParameters: *mut RTL_USER_PROCESS_PARAMETERS,
    // ... 其他字段
}

#[repr(C)]
#[derive(Default)]
struct RTL_USER_PROCESS_PARAMETERS {
    MaximumLength: u32,
    Length: u32,
    Flags: u32,
    DebugFlags: u32,
    ConsoleHandle: *mut c_void,
    ConsoleFlags: u32,
    StandardInput: *mut c_void,
    StandardOutput: *mut c_void,
    StandardError: *mut c_void,
    CurrentDirectory: UNICODE_STRING,
    DllPath: UNICODE_STRING,
    ImagePathName: UNICODE_STRING,
    CommandLine: UNICODE_STRING,
    // ... 其他字段
}

#[repr(C)]
#[derive(Default)]
struct UNICODE_STRING {
    Length: u16,
    MaximumLength: u16,
    Buffer: *mut u16,
}

use std::ffi::c_void;

const ProcessBasicInformation: u32 = 0;

#[link(name = "ntdll")]
extern "system" {
    fn NtQueryInformationProcess(
        ProcessHandle: windows::Win32::Foundation::HANDLE,
        ProcessInformationClass: u32,
        ProcessInformation: *mut c_void,
        ProcessInformationLength: u32,
        ReturnLength: *mut u32,
    ) -> i32;
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
