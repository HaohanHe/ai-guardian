//! AI Guardian Windows WFP Network Monitor
//! 
//! 使用 WFP (Windows Filtering Platform) 监控和阻断网络连接
//! 只监控 AI 终端进程的网络活动

use std::collections::HashSet;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::{Arc, Mutex};
use windows::core::Result;

/// 网络事件类型
#[derive(Debug, Clone)]
pub enum NetworkEventType {
    Connect,
    Listen,
    Accept,
}

/// 网络事件
#[derive(Debug, Clone)]
pub struct NetworkEvent {
    pub event_type: NetworkEventType,
    pub process_id: u32,
    pub local_addr: SocketAddr,
    pub remote_addr: SocketAddr,
    pub protocol: u8, // TCP=6, UDP=17
    pub timestamp: u64,
}

/// 网络连接决策
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ConnectionDecision {
    Allow,
    Block,
    AskUser,
}

/// WFP 网络监控器
pub struct WfpNetworkMonitor {
    ai_processes: Arc<Mutex<HashSet<u32>>>,
    blocked_ips: Arc<Mutex<HashSet<IpAddr>>>,
    blocked_ports: Arc<Mutex<HashSet<u16>>>,
    event_callback: Option<Box<dyn Fn(NetworkEvent) -> ConnectionDecision + Send + Sync>>,
    is_running: bool,
}

impl WfpNetworkMonitor {
    /// 创建新的 WFP 监控器
    pub fn new() -> Self {
        Self {
            ai_processes: Arc::new(Mutex::new(HashSet::new())),
            blocked_ips: Arc::new(Mutex::new(HashSet::new())),
            blocked_ports: Arc::new(Mutex::new(HashSet::new())),
            event_callback: None,
            is_running: false,
        }
    }
    
    /// 注册 AI 终端进程
    pub fn register_ai_process(&self, pid: u32) {
        let mut processes = self.ai_processes.lock().unwrap();
        processes.insert(pid);
        log::info!("WFP: Registered AI process {}", pid);
    }
    
    /// 注销 AI 终端进程
    pub fn unregister_ai_process(&self, pid: u32) {
        let mut processes = self.ai_processes.lock().unwrap();
        processes.remove(&pid);
        log::info!("WFP: Unregistered AI process {}", pid);
    }
    
    /// 检查是否是 AI 终端进程
    fn is_ai_process(&self, pid: u32) -> bool {
        let processes = self.ai_processes.lock().unwrap();
        processes.contains(&pid)
    }
    
    /// 添加阻断 IP
    pub fn block_ip(&self, ip: IpAddr) {
        let mut blocked = self.blocked_ips.lock().unwrap();
        blocked.insert(ip);
        log::info!("WFP: Blocked IP {}", ip);
    }
    
    /// 移除阻断 IP
    pub fn unblock_ip(&self, ip: IpAddr) {
        let mut blocked = self.blocked_ips.lock().unwrap();
        blocked.remove(&ip);
        log::info!("WFP: Unblocked IP {}", ip);
    }
    
    /// 添加阻断端口
    pub fn block_port(&self, port: u16) {
        let mut blocked = self.blocked_ports.lock().unwrap();
        blocked.insert(port);
        log::info!("WFP: Blocked port {}", port);
    }
    
    /// 移除阻断端口
    pub fn unblock_port(&self, port: u16) {
        let mut blocked = self.blocked_ports.lock().unwrap();
        blocked.remove(&port);
        log::info!("WFP: Unblocked port {}", port);
    }
    
    /// 设置事件回调
    pub fn set_event_callback<F>(&mut self, callback: F)
    where
        F: Fn(NetworkEvent) -> ConnectionDecision + Send + Sync + 'static,
    {
        self.event_callback = Some(Box::new(callback));
    }
    
    /// 启动 WFP 监控
    pub fn start(&mut self) -> Result<()> {
        if self.is_running {
            return Ok(());
        }
        
        // 初始化 WFP 过滤器
        // 注意：实际实现需要调用 Windows WFP API
        // 这里提供框架结构
        
        self.is_running = true;
        log::info!("WFP Network Monitor started");
        
        Ok(())
    }
    
    /// 停止 WFP 监控
    pub fn stop(&mut self) -> Result<()> {
        if !self.is_running {
            return Ok(());
        }
        
        self.is_running = false;
        log::info!("WFP Network Monitor stopped");
        
        Ok(())
    }
    
    /// 评估网络连接
    fn evaluate_connection(&self, event: &NetworkEvent) -> ConnectionDecision {
        // 检查是否是 AI 终端进程
        if !self.is_ai_process(event.process_id) {
            return ConnectionDecision::Allow; // 非 AI 进程放行
        }
        
        // 检查阻断列表
        {
            let blocked_ips = self.blocked_ips.lock().unwrap();
            if blocked_ips.contains(&event.remote_addr.ip()) {
                log::warn!("WFP: Blocking connection to blocked IP {}", event.remote_addr.ip());
                return ConnectionDecision::Block;
            }
        }
        
        {
            let blocked_ports = self.blocked_ports.lock().unwrap();
            if blocked_ports.contains(&event.remote_addr.port()) {
                log::warn!("WFP: Blocking connection to blocked port {}", event.remote_addr.port());
                return ConnectionDecision::Block;
            }
        }
        
        // 调用用户回调
        if let Some(ref callback) = self.event_callback {
            return callback(event.clone());
        }
        
        ConnectionDecision::Allow
    }
    
    /// 处理网络事件（由 WFP 回调调用）
    pub fn on_network_event(&self, event: NetworkEvent) -> bool {
        match self.evaluate_connection(&event) {
            ConnectionDecision::Allow => true,
            ConnectionDecision::Block => {
                log::warn!(
                    "WFP: BLOCKED {:?} from PID {} to {}",
                    event.event_type,
                    event.process_id,
                    event.remote_addr
                );
                false
            }
            ConnectionDecision::AskUser => {
                // TODO: 弹出用户确认对话框
                log::info!("WFP: Asking user for connection to {}", event.remote_addr);
                true
            }
        }
    }
}

impl Drop for WfpNetworkMonitor {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

/// 使用 netsh 进行网络监控（备用方案）
pub mod netsh_fallback {
    use std::process::Command;
    use std::net::SocketAddr;
    
    /// 获取活动连接列表
    pub fn get_active_connections() -> Vec<ConnectionInfo> {
        let output = Command::new("netsh")
            .args(&["interface", "ipv4", "show", "tcpconnections"])
            .output();
        
        match output {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                parse_netsh_output(&stdout)
            }
            Err(_) => Vec::new(),
        }
    }
    
    #[derive(Debug, Clone)]
    pub struct ConnectionInfo {
        pub local_addr: SocketAddr,
        pub remote_addr: SocketAddr,
        pub state: String,
        pub pid: u32,
    }
    
    fn parse_netsh_output(output: &str) -> Vec<ConnectionInfo> {
        let mut connections = Vec::new();
        
        for line in output.lines() {
            // 解析 netsh 输出格式
            // 示例：TCP    192.168.1.100:12345    93.184.216.34:443    ESTABLISHED    1234
            if line.starts_with("TCP") || line.starts_with("UDP") {
                // 简化解析
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 5 {
                    // 解析地址和 PID
                    if let (Ok(local), Ok(remote), Ok(pid)) = (
                        parts[1].parse(),
                        parts[2].parse(),
                        parts[4].parse()
                    ) {
                        connections.push(ConnectionInfo {
                            local_addr: local,
                            remote_addr: remote,
                            state: parts[3].to_string(),
                            pid,
                        });
                    }
                }
            }
        }
        
        connections
    }
    
    /// 添加防火墙规则阻断进程网络
    pub fn block_process_network(pid: u32) -> Result<(), String> {
        let rule_name = format!("AI_Guardian_Block_{}", pid);
        
        let output = Command::new("netsh")
            .args(&[
                "advfirewall", "firewall", "add", "rule",
                &format!("name={}", rule_name),
                "dir=out",
                "action=block",
                &format!("program=*"), // 实际应该指定进程路径
            ])
            .output()
            .map_err(|e| e.to_string())?;
        
        if output.status.success() {
            Ok(())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }
    
    /// 移除防火墙规则
    pub fn unblock_process_network(pid: u32) -> Result<(), String> {
        let rule_name = format!("AI_Guardian_Block_{}", pid);
        
        let output = Command::new("netsh")
            .args(&[
                "advfirewall", "firewall", "delete", "rule",
                &format!("name={}", rule_name),
            ])
            .output()
            .map_err(|e| e.to_string())?;
        
        if output.status.success() {
            Ok(())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }
}

/// 可疑 IP/域名数据库
pub mod threat_intel {
    use std::collections::HashSet;
    use std::net::IpAddr;
    use lazy_static::lazy_static;
    
    lazy_static! {
        /// 已知恶意 IP 列表
        static ref MALICIOUS_IPS: HashSet<IpAddr> = {
            let mut set = HashSet::new();
            // 添加已知恶意 IP
            // 这些应该是从威胁情报源获取的
            set
        };
        
        /// 可疑端口列表
        static ref SUSPICIOUS_PORTS: HashSet<u16> = {
            let mut set = HashSet::new();
            set.insert(4444);  // 常见 Metasploit 端口
            set.insert(5555);  // ADB 端口
            set.insert(6666);  // IRC 端口
            set.insert(31337); // 经典后门端口
            set.insert(12345); // NetBus
            set.insert(27374); // SubSeven
            set
        };
    }
    
    /// 检查 IP 是否可疑
    pub fn is_suspicious_ip(ip: &IpAddr) -> bool {
        MALICIOUS_IPS.contains(ip)
    }
    
    /// 检查端口是否可疑
    pub fn is_suspicious_port(port: u16) -> bool {
        SUSPICIOUS_PORTS.contains(&port)
    }
    
    /// 检查是否是内网地址
    pub fn is_private_ip(ip: &IpAddr) -> bool {
        match ip {
            IpAddr::V4(ipv4) => {
                let octets = ipv4.octets();
                // 10.0.0.0/8
                octets[0] == 10
                // 172.16.0.0/12
                || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31)
                // 192.168.0.0/16
                || (octets[0] == 192 && octets[1] == 168)
                // 127.0.0.0/8
                || octets[0] == 127
            }
            IpAddr::V6(ipv6) => {
                // ::1
                ipv6.is_loopback()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{IpAddr, Ipv4Addr, SocketAddrV4};
    
    #[test]
    fn test_wfp_monitor_creation() {
        let monitor = WfpNetworkMonitor::new();
        assert!(!monitor.is_running);
    }
    
    #[test]
    fn test_process_registration() {
        let monitor = WfpNetworkMonitor::new();
        monitor.register_ai_process(1234);
        
        assert!(monitor.is_ai_process(1234));
        assert!(!monitor.is_ai_process(5678));
    }
    
    #[test]
    fn test_ip_blocking() {
        let monitor = WfpNetworkMonitor::new();
        let ip: IpAddr = "192.168.1.100".parse().unwrap();
        
        monitor.block_ip(ip);
        
        let blocked = monitor.blocked_ips.lock().unwrap();
        assert!(blocked.contains(&ip));
    }
    
    #[test]
    fn test_threat_intel() {
        use threat_intel::*;
        
        // 测试内网地址检测
        let private_ip: IpAddr = "192.168.1.1".parse().unwrap();
        assert!(is_private_ip(&private_ip));
        
        let public_ip: IpAddr = "8.8.8.8".parse().unwrap();
        assert!(!is_private_ip(&public_ip));
        
        // 测试可疑端口
        assert!(is_suspicious_port(4444));
        assert!(!is_suspicious_port(80));
    }
    
    #[test]
    fn test_connection_evaluation() {
        let mut monitor = WfpNetworkMonitor::new();
        monitor.register_ai_process(1234);
        
        // 阻断特定 IP
        let blocked_ip: IpAddr = "10.0.0.1".parse().unwrap();
        monitor.block_ip(blocked_ip);
        
        let event = NetworkEvent {
            event_type: NetworkEventType::Connect,
            process_id: 1234,
            local_addr: SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::new(127, 0, 0, 1), 12345)),
            remote_addr: SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::new(10, 0, 0, 1), 80)),
            protocol: 6,
            timestamp: 0,
        };
        
        let decision = monitor.evaluate_connection(&event);
        assert_eq!(decision, ConnectionDecision::Block);
    }
}
