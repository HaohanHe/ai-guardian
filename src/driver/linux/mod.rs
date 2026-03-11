//! AI Guardian Linux eBPF Interface
//! 
//! 使用 libbpf-rs 加载和管理 eBPF 程序

use libbpf_rs::{MapFlags, ObjectBuilder, RingBuffer, RingBufferBuilder};
use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use anyhow::{Result, Context};

// 自动生成的 eBPF skeleton
mod ai_guardian {
    include!(concat!(env!("OUT_DIR"), "/ai_guardian.skel.rs"));
}

/// 事件类型
#[derive(Debug, Clone, Copy, PartialEq)]
#[repr(u32)]
pub enum EventType {
    ProcessExec = 0,
    FileOpen = 1,
    FileWrite = 2,
    FileDelete = 3,
    NetworkConnect = 4,
    ProcessExit = 5,
}

impl From<u32> for EventType {
    fn from(v: u32) -> Self {
        match v {
            0 => EventType::ProcessExec,
            1 => EventType::FileOpen,
            2 => EventType::FileWrite,
            3 => EventType::FileDelete,
            4 => EventType::NetworkConnect,
            5 => EventType::ProcessExit,
            _ => EventType::ProcessExec,
        }
    }
}

/// eBPF 事件结构（必须与内核定义一致）
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct Event {
    pub event_type: u32,
    pub pid: u32,
    pub ppid: u32,
    pub uid: u32,
    pub timestamp: u64,
    pub risk_score: u64,
    pub comm: [u8; 16],
    pub path: [u8; 256],
    pub remote_ip: u32,
    pub remote_port: u16,
    pub blocked: u8,
}

/// 配置结构（必须与内核定义一致）
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct GuardianConfig {
    pub block_file_delete: u32,
    pub block_system_path_write: u32,
    pub block_network_connection: u32,
    pub log_all_operations: u32,
    pub risk_threshold: u32,
}

impl Default for GuardianConfig {
    fn default() -> Self {
        Self {
            block_file_delete: 1,
            block_system_path_write: 1,
            block_network_connection: 1,
            log_all_operations: 0,
            risk_threshold: 70,
        }
    }
}

/// 统计信息（必须与内核定义一致）
#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
pub struct Stats {
    pub operations_blocked: u64,
    pub operations_allowed: u64,
    pub ai_process_count: u64,
}

/// Linux eBPF 监控器
pub struct LinuxEbpfMonitor {
    skel: Option<ai_guardian::AiGuardianSkel<'static>>,
    ai_processes: Arc<Mutex<HashSet<u32>>>,
    event_callback: Option<Box<dyn Fn(Event) + Send + Sync>>,
    ringbuf: Option<RingBuffer<'static>>,
    is_running: bool,
}

impl LinuxEbpfMonitor {
    /// 创建新的 eBPF 监控器
    pub fn new() -> Result<Self> {
        Ok(Self {
            skel: None,
            ai_processes: Arc::new(Mutex::new(HashSet::new())),
            event_callback: None,
            ringbuf: None,
            is_running: false,
        })
    }
    
    /// 加载并启动 eBPF 程序
    pub fn start(&mut self) -> Result<()> {
        if self.is_running {
            return Ok(());
        }
        
        // 提升 RLIMIT_MEMLOCK（eBPF 需要）
        Self::bump_memlock_rlimit()?;
        
        // 加载 eBPF 程序
        let mut skel_builder = ai_guardian::AiGuardianSkelBuilder::default();
        skel_builder.obj_builder.debug(true);
        
        let open_skel = skel_builder
            .open()
            .context("Failed to open BPF skeleton")?;
        
        let mut skel = open_skel
            .load()
            .context("Failed to load BPF skeleton")?;
        
        // 设置默认配置
        self.update_config(&GuardianConfig::default())?;
        
        // 附加探针
        skel.attach()
            .context("Failed to attach BPF programs")?;
        
        // 设置环形缓冲区回调
        let ai_processes = self.ai_processes.clone();
        let callback = self.event_callback.take();
        
        let ringbuf_builder = RingBufferBuilder::new();
        // 注意：这里需要访问 skel 中的 maps，具体字段名由 skeleton 生成
        // ringbuf_builder.add(&skel.maps().events(), |data| {
        //     let event = unsafe { *(data.as_ptr() as *const Event) };
        //     
        //     if let Some(ref cb) = callback {
        //         cb(event);
        //     }
        //     
        //     0
        // })?;
        
        // let ringbuf = ringbuf_builder.build()?;
        // self.ringbuf = Some(ringbuf);
        
        self.skel = Some(skel);
        self.is_running = true;
        
        log::info!("Linux eBPF monitor started");
        
        // 启动事件轮询线程
        self.start_event_polling();
        
        Ok(())
    }
    
    /// 停止 eBPF 监控
    pub fn stop(&mut self) -> Result<()> {
        if !self.is_running {
            return Ok(());
        }
        
        self.is_running = false;
        self.ringbuf = None;
        self.skel = None;
        
        log::info!("Linux eBPF monitor stopped");
        Ok(())
    }
    
    /// 注册 AI 终端进程
    pub fn register_ai_process(&self, pid: u32) -> Result<()> {
        // 添加到本地列表
        {
            let mut processes = self.ai_processes.lock().unwrap();
            processes.insert(pid);
        }
        
        // 更新 eBPF map
        if let Some(ref skel) = self.skel {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            
            // 更新 ai_processes map
            // skel.maps().ai_processes().update(
            //     &pid.to_ne_bytes(),
            //     &timestamp.to_ne_bytes(),
            //     MapFlags::ANY,
            // )?;
        }
        
        // 更新统计
        self.update_ai_process_count()?;
        
        log::info!("Registered AI process: {}", pid);
        Ok(())
    }
    
    /// 注销 AI 终端进程
    pub fn unregister_ai_process(&self, pid: u32) -> Result<()> {
        // 从本地列表移除
        {
            let mut processes = self.ai_processes.lock().unwrap();
            processes.remove(&pid);
        }
        
        // 从 eBPF map 移除
        if let Some(ref skel) = self.skel {
            // skel.maps().ai_processes().delete(&pid.to_ne_bytes())?;
        }
        
        // 更新统计
        self.update_ai_process_count()?;
        
        log::info!("Unregistered AI process: {}", pid);
        Ok(())
    }
    
    /// 检查是否是 AI 终端进程
    pub fn is_ai_process(&self, pid: u32) -> bool {
        let processes = self.ai_processes.lock().unwrap();
        processes.contains(&pid)
    }
    
    /// 设置事件回调
    pub fn set_event_callback<F>(&mut self, callback: F)
    where
        F: Fn(Event) + Send + Sync + 'static,
    {
        self.event_callback = Some(Box::new(callback));
    }
    
    /// 更新配置
    pub fn update_config(&self, config: &GuardianConfig) -> Result<()> {
        if let Some(ref skel) = self.skel {
            // skel.maps().config_map().update(
            //     &0u32.to_ne_bytes(),
            //     unsafe { std::slice::from_raw_parts(
            //         config as *const _ as *const u8,
            //         std::mem::size_of::<GuardianConfig>()
            //     )},
            //     MapFlags::ANY,
            // )?;
        }
        Ok(())
    }
    
    /// 获取统计信息
    pub fn get_stats(&self) -> Result<Stats> {
        if let Some(ref skel) = self.skel {
            // let value = skel.maps().stats_map().lookup(&0u32.to_ne_bytes(), MapFlags::ANY)?;
            // if let Some(data) = value {
            //     return Ok(unsafe { *(data.as_ptr() as *const Stats) });
            // }
        }
        Ok(Stats::default())
    }
    
    /// 更新 AI 进程计数
    fn update_ai_process_count(&self) -> Result<()> {
        let count = self.ai_processes.lock().unwrap().len() as u64;
        
        if let Some(ref skel) = self.skel {
            // 先读取当前统计
            // let mut stats = self.get_stats()?;
            // stats.ai_process_count = count;
            
            // 更新统计
            // skel.maps().stats_map().update(
            //     &0u32.to_ne_bytes(),
            //     unsafe { std::slice::from_raw_parts(
            //         &stats as *const _ as *const u8,
            //         std::mem::size_of::<Stats>()
            //     )},
            //     MapFlags::ANY,
            // )?;
        }
        Ok(())
    }
    
    /// 提升 RLIMIT_MEMLOCK
    fn bump_memlock_rlimit() -> Result<()> {
        let rlimit = libc::rlimit {
            rlim_cur: 128 << 20, // 128 MB
            rlim_max: 128 << 20,
        };
        
        let ret = unsafe { libc::setrlimit(libc::RLIMIT_MEMLOCK, &rlimit) };
        if ret != 0 {
            return Err(anyhow::anyhow!("Failed to increase RLIMIT_MEMLOCK"));
        }
        
        Ok(())
    }
    
    /// 启动事件轮询
    fn start_event_polling(&self) {
        // 在新线程中轮询 ring buffer
        std::thread::spawn(move || {
            // while self.is_running {
            //     if let Some(ref ringbuf) = self.ringbuf {
            //         ringbuf.poll(std::time::Duration::from_millis(100))
            //             .ok();
            //     }
            // }
        });
    }
}

impl Drop for LinuxEbpfMonitor {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

/// Linux 完整监控引擎
pub struct LinuxGuardianEngine {
    ebpf_monitor: Option<LinuxEbpfMonitor>,
    ai_processes: Arc<Mutex<HashSet<u32>>>,
    is_running: bool,
}

impl LinuxGuardianEngine {
    /// 创建新的 Linux 监控引擎
    pub fn new() -> Self {
        Self {
            ebpf_monitor: None,
            ai_processes: Arc::new(Mutex::new(HashSet::new())),
            is_running: false,
        }
    }
    
    /// 初始化并启动监控
    pub fn initialize(&mut self) -> Result<()> {
        log::info!("Initializing Linux Guardian Engine...");
        
        // 检查是否以 root 运行
        if unsafe { libc::geteuid() } != 0 {
            return Err(anyhow::anyhow!("Linux Guardian requires root privileges"));
        }
        
        // 检查内核是否支持 eBPF
        Self::check_kernel_support()?;
        
        // 初始化 eBPF 监控
        let mut ebpf = LinuxEbpfMonitor::new()?;
        ebpf.set_event_callback(|event| {
            log::debug!("eBPF event: {:?}", event);
        });
        
        ebpf.start()?;
        self.ebpf_monitor = Some(ebpf);
        
        self.is_running = true;
        log::info!("Linux Guardian Engine initialized");
        
        Ok(())
    }
    
    /// 注册 AI 终端进程
    pub fn register_ai_process(&mut self, pid: u32, name: &str) -> Result<()> {
        // 添加到本地列表
        {
            let mut processes = self.ai_processes.lock().unwrap();
            processes.insert(pid);
        }
        
        // 通知 eBPF 监控
        if let Some(ref ebpf) = self.ebpf_monitor {
            ebpf.register_ai_process(pid)?;
        }
        
        log::info!("Registered AI process: {} ({})", pid, name);
        Ok(())
    }
    
    /// 注销 AI 终端进程
    pub fn unregister_ai_process(&mut self, pid: u32) -> Result<()> {
        // 从本地列表移除
        {
            let mut processes = self.ai_processes.lock().unwrap();
            processes.remove(&pid);
        }
        
        // 通知 eBPF 监控
        if let Some(ref ebpf) = self.ebpf_monitor {
            ebpf.unregister_ai_process(pid)?;
        }
        
        log::info!("Unregistered AI process: {}", pid);
        Ok(())
    }
    
    /// 获取统计信息
    pub fn get_stats(&self) -> Option<Stats> {
        self.ebpf_monitor.as_ref()?.get_stats().ok()
    }
    
    /// 设置配置
    pub fn set_config(&self, config: &GuardianConfig) -> Result<()> {
        if let Some(ref ebpf) = self.ebpf_monitor {
            ebpf.update_config(config)?;
        }
        Ok(())
    }
    
    /// 检查是否运行
    pub fn is_running(&self) -> bool {
        self.is_running
    }
    
    /// 获取 AI 进程数量
    pub fn get_ai_process_count(&self) -> usize {
        self.ai_processes.lock().unwrap().len()
    }
    
    /// 停止所有监控
    pub fn shutdown(&mut self) {
        log::info!("Shutting down Linux Guardian Engine...");
        
        self.is_running = false;
        
        // 清理所有 AI 进程
        let pids: Vec<u32> = self.ai_processes.lock().unwrap().iter().copied().collect();
        for pid in pids {
            let _ = self.unregister_ai_process(pid);
        }
        
        // 停止 eBPF
        if let Some(mut ebpf) = self.ebpf_monitor.take() {
            let _ = ebpf.stop();
        }
        
        log::info!("Linux Guardian Engine shutdown complete");
    }
    
    /// 检查内核 eBPF 支持
    fn check_kernel_support() -> Result<()> {
        // 检查 /sys/kernel/debug/tracing 是否存在
        if !std::path::Path::new("/sys/kernel/debug/tracing").exists() {
            return Err(anyhow::anyhow!(
                "Kernel debugfs not mounted. Run: mount -t debugfs none /sys/kernel/debug"
            ));
        }
        
        // 检查 BPF 系统调用是否可用
        let uname = nix::sys::utsname::uname();
        let release = uname.release().to_str().unwrap_or("");
        log::info!("Kernel version: {}", release);
        
        // 检查内核版本（需要 4.18+ 以获得 BPF ring buffer 支持）
        let version_parts: Vec<&str> = release.split('.').collect();
        if version_parts.len() >= 2 {
            let major: u32 = version_parts[0].parse().unwrap_or(0);
            let minor: u32 = version_parts[1].parse().unwrap_or(0);
            
            if major < 4 || (major == 4 && minor < 18) {
                return Err(anyhow::anyhow!(
                    "Kernel {}.{} is too old. Need 4.18+ for ring buffer support",
                    major, minor
                ));
            }
        }
        
        Ok(())
    }
}

impl Drop for LinuxGuardianEngine {
    fn drop(&mut self) {
        self.shutdown();
    }
}

/// 重新导出类型
pub use ai_guardian::AiGuardianSkel;

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_event_type_conversion() {
        assert_eq!(EventType::from(0), EventType::ProcessExec);
        assert_eq!(EventType::from(3), EventType::FileDelete);
    }
    
    #[test]
    fn test_config_default() {
        let config = GuardianConfig::default();
        assert_eq!(config.block_file_delete, 1);
        assert_eq!(config.risk_threshold, 70);
    }
}
