//! AI Guardian Core Engine
//!
//! 跨平台核心引擎，提供统一的 AI 安全监控接口

pub mod ai_analyzer;
pub mod audit_logger;
pub mod config;
pub mod risk_engine;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::OnceLock;
#[cfg(any(target_os = "windows", target_os = "linux"))]
use std::sync::{Arc, Mutex};

/// 平台类型
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Platform {
    Windows,
    Linux,
    MacOS,
}

impl Platform {
    /// 检测当前平台
    pub fn current() -> Self {
        #[cfg(target_os = "windows")]
        return Platform::Windows;

        #[cfg(target_os = "linux")]
        return Platform::Linux;

        #[cfg(target_os = "macos")]
        return Platform::MacOS;
    }
}

/// 操作类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OperationType {
    ProcessExec,
    ProcessTerminate,
    FileOpen,
    FileRead,
    FileWrite,
    FileDelete,
    FileRename,
    NetworkConnect,
    NetworkListen,
    RegistryRead,
    RegistryWrite,
    RegistryDelete,
}

/// 操作事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationEvent {
    pub id: String,
    pub timestamp: u64,
    pub operation_type: OperationType,
    pub process_id: u32,
    pub process_name: String,
    pub process_path: String,
    pub command_line: String,
    pub parent_process_id: u32,
    pub user_id: u32,
    pub target_path: Option<String>,
    pub target_ip: Option<IpAddr>,
    pub target_port: Option<u16>,
    pub risk_score: u32,
    pub decision: SecurityDecision,
    pub details: HashMap<String, String>,
}

/// 安全决策
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SecurityDecision {
    Allow,
    Block,
    AskUser,
    LogOnly,
}

/// 风险等级
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskLevel {
    None,
    Low,
    Medium,
    High,
    Critical,
}

impl RiskLevel {
    /// 从风险分数计算等级
    pub fn from_score(score: u32) -> Self {
        match score {
            0 => RiskLevel::None,
            1..=30 => RiskLevel::Low,
            31..=60 => RiskLevel::Medium,
            61..=85 => RiskLevel::High,
            _ => RiskLevel::Critical,
        }
    }

    /// 获取等级的颜色代码
    pub fn color(&self) -> &'static str {
        match self {
            RiskLevel::None => "#00FF00",
            RiskLevel::Low => "#90EE90",
            RiskLevel::Medium => "#FFD700",
            RiskLevel::High => "#FF8C00",
            RiskLevel::Critical => "#FF0000",
        }
    }
}

/// AI 终端进程信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiProcessInfo {
    pub pid: u32,
    pub name: String,
    pub path: String,
    pub command_line: String,
    pub parent_pid: u32,
    pub start_time: u64,
    pub is_tracked: bool,
}

/// 核心引擎 trait - 跨平台抽象
pub trait GuardianEngine: Send + Sync {
    /// 初始化引擎
    fn initialize(&mut self) -> anyhow::Result<()>;

    /// 关闭引擎
    fn shutdown(&mut self);

    /// 注册 AI 终端进程
    fn register_ai_process(&mut self, info: AiProcessInfo) -> anyhow::Result<()>;

    /// 注销 AI 终端进程
    fn unregister_ai_process(&mut self, pid: u32) -> anyhow::Result<()>;

    /// 获取已注册的 AI 进程列表
    fn get_ai_processes(&self) -> Vec<AiProcessInfo>;

    /// 处理操作事件
    fn process_event(&mut self, event: OperationEvent) -> SecurityDecision;

    /// 获取统计信息
    fn get_stats(&self) -> EngineStats;

    /// 检查是否运行中
    fn is_running(&self) -> bool;
}

/// 引擎统计信息
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EngineStats {
    pub total_events_processed: u64,
    pub total_events_blocked: u64,
    pub total_events_allowed: u64,
    pub ai_process_count: usize,
    pub average_risk_score: f64,
    pub uptime_seconds: u64,
}

/// 平台特定的引擎工厂
pub struct GuardianEngineFactory;

impl GuardianEngineFactory {
    /// 创建适合当前平台的引擎
    pub fn create() -> Box<dyn GuardianEngine> {
        match Platform::current() {
            #[cfg(target_os = "windows")]
            Platform::Windows => Box::new(WindowsEngine::new()),

            #[cfg(target_os = "linux")]
            Platform::Linux => Box::new(LinuxEngine::new()),

            _ => {
                panic!("Unsupported platform");
            }
        }
    }
}

// Windows 引擎实现
#[cfg(target_os = "windows")]
pub struct WindowsEngine {
    inner: crate::driver::windows::WindowsGuardianEngine,
    ai_processes: Arc<Mutex<HashMap<u32, AiProcessInfo>>>,
    analyzer: ai_analyzer::AiAnalyzer,
    risk_engine: risk_engine::RiskEngine,
    audit_logger: audit_logger::AuditLogger,
    start_time: u64,
}

#[cfg(target_os = "windows")]
impl WindowsEngine {
    pub fn new() -> Self {
        Self {
            inner: crate::driver::windows::WindowsGuardianEngine::new(),
            ai_processes: Arc::new(Mutex::new(HashMap::new())),
            analyzer: ai_analyzer::AiAnalyzer::new(),
            risk_engine: risk_engine::RiskEngine::new(),
            audit_logger: audit_logger::AuditLogger::new(),
            start_time: 0,
        }
    }
}

#[cfg(target_os = "windows")]
impl GuardianEngine for WindowsEngine {
    fn initialize(&mut self) -> anyhow::Result<()> {
        self.inner
            .initialize()
            .map_err(|e| anyhow::anyhow!("Failed to initialize Windows engine: {}", e))?;

        self.start_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        log::info!("Windows Guardian Engine initialized");
        Ok(())
    }

    fn shutdown(&mut self) {
        self.inner.shutdown();
        log::info!("Windows Guardian Engine shutdown");
    }

    fn register_ai_process(&mut self, info: AiProcessInfo) -> anyhow::Result<()> {
        self.inner
            .register_ai_process(info.pid, &info.name)
            .map_err(|e| anyhow::anyhow!("{}", e))?;

        self.ai_processes.lock().unwrap().insert(info.pid, info);
        Ok(())
    }

    fn unregister_ai_process(&mut self, pid: u32) -> anyhow::Result<()> {
        self.inner
            .unregister_ai_process(pid)
            .map_err(|e| anyhow::anyhow!("{}", e))?;

        self.ai_processes.lock().unwrap().remove(&pid);
        Ok(())
    }

    fn get_ai_processes(&self) -> Vec<AiProcessInfo> {
        self.ai_processes
            .lock()
            .unwrap()
            .values()
            .cloned()
            .collect()
    }

    fn process_event(&mut self, event: OperationEvent) -> SecurityDecision {
        // 1. AI 分析
        let ai_score = self.analyzer.analyze(&event);

        // 2. 规则引擎评分
        let rule_score = self.risk_engine.calculate_risk(&event);

        // 3. 综合评分
        let final_score = (ai_score + rule_score) / 2;

        // 4. 做出决策
        let decision = if final_score > 80 {
            SecurityDecision::Block
        } else if final_score > 50 {
            SecurityDecision::AskUser
        } else {
            SecurityDecision::Allow
        };

        // 5. 记录审计日志
        let mut event_with_score = event;
        event_with_score.risk_score = final_score;
        event_with_score.decision = decision;
        self.audit_logger.log(&event_with_score);

        decision
    }

    fn get_stats(&self) -> EngineStats {
        let driver_stats = self.inner.get_stats();
        let ai_count = self.ai_processes.lock().unwrap().len();

        EngineStats {
            total_events_processed: driver_stats.total_events_allowed
                + driver_stats.total_events_blocked,
            total_events_blocked: driver_stats.total_events_blocked,
            total_events_allowed: driver_stats.total_events_allowed,
            ai_process_count: ai_count,
            average_risk_score: 0.0, // TODO: 计算平均风险分
            uptime_seconds: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()
                - self.start_time,
        }
    }

    fn is_running(&self) -> bool {
        self.inner.is_running()
    }
}

// Linux 引擎实现
#[cfg(target_os = "linux")]
pub struct LinuxEngine {
    inner: crate::driver::linux::LinuxGuardianEngine,
    ai_processes: Arc<Mutex<HashMap<u32, AiProcessInfo>>>,
    analyzer: ai_analyzer::AiAnalyzer,
    risk_engine: risk_engine::RiskEngine,
    audit_logger: audit_logger::AuditLogger,
    start_time: u64,
}

#[cfg(target_os = "linux")]
impl Default for LinuxEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(target_os = "linux")]
impl LinuxEngine {
    pub fn new() -> Self {
        Self {
            inner: crate::driver::linux::LinuxGuardianEngine::new(),
            ai_processes: Arc::new(Mutex::new(HashMap::new())),
            analyzer: ai_analyzer::AiAnalyzer::new(),
            risk_engine: risk_engine::RiskEngine::new(),
            audit_logger: audit_logger::AuditLogger::new(),
            start_time: 0,
        }
    }
}

#[cfg(target_os = "linux")]
impl GuardianEngine for LinuxEngine {
    fn initialize(&mut self) -> anyhow::Result<()> {
        self.inner.initialize()?;

        self.start_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        log::info!("Linux Guardian Engine initialized");
        Ok(())
    }

    fn shutdown(&mut self) {
        self.inner.shutdown();
        log::info!("Linux Guardian Engine shutdown");
    }

    fn register_ai_process(&mut self, info: AiProcessInfo) -> anyhow::Result<()> {
        self.inner.register_ai_process(info.pid, &info.name)?;
        self.ai_processes.lock().unwrap().insert(info.pid, info);
        Ok(())
    }

    fn unregister_ai_process(&mut self, pid: u32) -> anyhow::Result<()> {
        self.inner.unregister_ai_process(pid)?;
        self.ai_processes.lock().unwrap().remove(&pid);
        Ok(())
    }

    fn get_ai_processes(&self) -> Vec<AiProcessInfo> {
        self.ai_processes
            .lock()
            .unwrap()
            .values()
            .cloned()
            .collect()
    }

    fn process_event(&mut self, event: OperationEvent) -> SecurityDecision {
        let ai_score = self.analyzer.analyze(&event);
        let rule_score = self.risk_engine.calculate_risk(&event);
        let final_score = (ai_score + rule_score) / 2;

        let decision = if final_score > 80 {
            SecurityDecision::Block
        } else if final_score > 50 {
            SecurityDecision::AskUser
        } else {
            SecurityDecision::Allow
        };

        let mut event_with_score = event;
        event_with_score.risk_score = final_score;
        event_with_score.decision = decision;
        self.audit_logger.log(&event_with_score);

        decision
    }

    fn get_stats(&self) -> EngineStats {
        let ebpf_stats = self.inner.get_stats();
        let ai_count = self.ai_processes.lock().unwrap().len();

        EngineStats {
            total_events_processed: ebpf_stats.total_events_allowed
                + ebpf_stats.total_events_blocked,
            total_events_blocked: ebpf_stats.total_events_blocked,
            total_events_allowed: ebpf_stats.total_events_allowed,
            ai_process_count: ai_count,
            average_risk_score: 0.0,
            uptime_seconds: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()
                - self.start_time,
        }
    }

    fn is_running(&self) -> bool {
        self.inner.is_running()
    }
}

/// 全局引擎实例
static GLOBAL_ENGINE: OnceLock<Box<dyn GuardianEngine + Send>> = OnceLock::new();

/// 初始化全局引擎
pub fn initialize() -> anyhow::Result<()> {
    let engine = GuardianEngineFactory::create();
    GLOBAL_ENGINE
        .set(engine)
        .map_err(|_| anyhow::anyhow!("Engine already initialized"))?;
    Ok(())
}

/// 获取全局引擎引用
pub fn engine() -> Option<&'static (dyn GuardianEngine + Send)> {
    GLOBAL_ENGINE.get().map(|b| b.as_ref())
}

/// 关闭全局引擎
pub fn shutdown() {
    // OnceLock 不支持 take，这里只能标记关闭状态
    if GLOBAL_ENGINE.get().is_some() {
        // 由于无法获取可变引用，这里需要重新设计
        // 暂时跳过
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_risk_level_from_score() {
        assert_eq!(RiskLevel::from_score(0), RiskLevel::None);
        assert_eq!(RiskLevel::from_score(30), RiskLevel::Low);
        assert_eq!(RiskLevel::from_score(60), RiskLevel::Medium);
        assert_eq!(RiskLevel::from_score(85), RiskLevel::High);
        assert_eq!(RiskLevel::from_score(100), RiskLevel::Critical);
    }

    #[test]
    fn test_platform_detection() {
        let _platform = Platform::current();

        #[cfg(target_os = "windows")]
        assert_eq!(_platform, Platform::Windows);

        #[cfg(target_os = "linux")]
        assert_eq!(_platform, Platform::Linux);
    }
}
