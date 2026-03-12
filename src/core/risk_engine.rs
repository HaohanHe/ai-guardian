//! AI Guardian Risk Engine
//!
//! 基于规则的实时风险评估引擎

use super::{OperationEvent, OperationType, RiskLevel};
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};

/// 风险引擎
pub struct RiskEngine {
    /// 规则集合
    rules: Vec<RiskRule>,
    /// 行为历史（用于上下文分析）
    behavior_history: Arc<Mutex<VecDeque<BehaviorRecord>>>,
    /// 进程行为画像
    process_profiles: Arc<Mutex<HashMap<u32, ProcessProfile>>>,
    /// 最大历史记录数
    max_history: usize,
}

/// 风险规则
#[derive(Debug, Clone)]
pub struct RiskRule {
    pub id: String,
    pub name: String,
    pub description: String,
    pub condition: RuleCondition,
    pub risk_score: u32,
    pub enabled: bool,
}

/// 规则条件
#[derive(Debug, Clone)]
pub enum RuleCondition {
    /// 操作类型匹配
    OperationType(OperationType),
    /// 路径包含
    PathContains(String),
    /// 命令行包含
    CommandContains(String),
    /// 进程名匹配
    ProcessName(String),
    /// 组合条件（AND）
    And(Vec<RuleCondition>),
    /// 组合条件（OR）
    Or(Vec<RuleCondition>),
    /// 频率条件（单位时间内发生次数）
    Frequency {
        op_type: OperationType,
        count: u32,
        window_secs: u64,
    },
}

/// 行为记录
#[derive(Debug, Clone)]
#[allow(dead_code)]
struct BehaviorRecord {
    timestamp: u64,
    process_id: u32,
    operation_type: OperationType,
    target: String,
    risk_score: u32,
}

/// 进程行为画像
#[derive(Debug, Clone, Default)]
#[allow(dead_code)]
struct ProcessProfile {
    process_id: u32,
    process_name: String,
    operation_count: HashMap<OperationType, u32>,
    first_seen: u64,
    last_seen: u64,
    risk_score: u32,
    is_whitelisted: bool,
}

/// 风险评估结果
#[derive(Debug, Clone)]
pub struct RiskAssessment {
    pub total_score: u32,
    pub risk_level: RiskLevel,
    pub triggered_rules: Vec<String>,
    pub explanation: String,
    pub recommendations: Vec<String>,
}

impl Default for RiskEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl RiskEngine {
    /// 创建新的风险引擎
    pub fn new() -> Self {
        let mut engine = Self {
            rules: Vec::new(),
            behavior_history: Arc::new(Mutex::new(VecDeque::new())),
            process_profiles: Arc::new(Mutex::new(HashMap::new())),
            max_history: 10000,
        };

        engine.load_default_rules();
        engine
    }

    /// 计算风险分数
    pub fn calculate_risk(&mut self, event: &OperationEvent) -> u32 {
        let mut total_score = 0;
        let mut triggered_rules = Vec::new();

        // 1. 评估规则匹配
        for rule in &self.rules {
            if !rule.enabled {
                continue;
            }

            if self.evaluate_condition(&rule.condition, event) {
                total_score += rule.risk_score;
                triggered_rules.push(rule.id.clone());
            }
        }

        // 2. 上下文分析（基于历史行为）
        let context_score = self.analyze_context(event);
        total_score += context_score;

        // 3. 更新行为历史
        self.record_behavior(event, total_score);

        // 4. 更新进程画像
        self.update_process_profile(event, total_score);

        // 5. 应用衰减（同一进程的重复操作风险递减）
        let decayed_score = self.apply_decay(event.process_id, total_score);

        // 限制在 0-100
        decayed_score.min(100)
    }

    /// 完整风险评估
    pub fn assess(&mut self, event: &OperationEvent) -> RiskAssessment {
        let score = self.calculate_risk(event);
        let level = RiskLevel::from_score(score);

        let mut triggered_rules = Vec::new();
        for rule in &self.rules {
            if rule.enabled && self.evaluate_condition(&rule.condition, event) {
                triggered_rules.push(format!("{}: {}", rule.id, rule.name));
            }
        }

        let explanation = self.generate_explanation(event, score, &triggered_rules);
        let recommendations = self.generate_recommendations(score, &level);

        RiskAssessment {
            total_score: score,
            risk_level: level,
            triggered_rules,
            explanation,
            recommendations,
        }
    }

    /// 评估条件
    fn evaluate_condition(&self, condition: &RuleCondition, event: &OperationEvent) -> bool {
        match condition {
            RuleCondition::OperationType(op_type) => &event.operation_type == op_type,
            RuleCondition::PathContains(path) => event
                .target_path
                .as_ref()
                .map(|p| p.to_lowercase().contains(&path.to_lowercase()))
                .unwrap_or(false),
            RuleCondition::CommandContains(cmd) => event
                .command_line
                .to_lowercase()
                .contains(&cmd.to_lowercase()),
            RuleCondition::ProcessName(name) => {
                event.process_name.to_lowercase() == name.to_lowercase()
            }
            RuleCondition::And(conditions) => {
                conditions.iter().all(|c| self.evaluate_condition(c, event))
            }
            RuleCondition::Or(conditions) => {
                conditions.iter().any(|c| self.evaluate_condition(c, event))
            }
            RuleCondition::Frequency {
                op_type,
                count,
                window_secs,
            } => self.check_frequency(event.process_id, *op_type, *count, *window_secs),
        }
    }

    /// 检查操作频率
    fn check_frequency(
        &self,
        process_id: u32,
        op_type: OperationType,
        count: u32,
        window_secs: u64,
    ) -> bool {
        let history = self.behavior_history.lock().unwrap();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let recent_count = history
            .iter()
            .filter(|r| {
                r.process_id == process_id
                    && r.operation_type == op_type
                    && (now - r.timestamp) <= window_secs
            })
            .count() as u32;

        recent_count >= count
    }

    /// 上下文分析
    fn analyze_context(&self, event: &OperationEvent) -> u32 {
        let mut score = 0;
        let history = self.behavior_history.lock().unwrap();

        // 检查是否有近期的高风险操作
        let recent_high_risk = history
            .iter()
            .rev()
            .take(10)
            .filter(|r| r.risk_score > 70)
            .count();

        if recent_high_risk > 0 {
            score += (recent_high_risk as u32 * 5).min(20);
        }

        // 检查异常行为模式
        let profiles = self.process_profiles.lock().unwrap();
        if let Some(profile) = profiles.get(&event.process_id) {
            // 如果进程之前没有这类操作，增加风险
            if profile
                .operation_count
                .get(&event.operation_type)
                .unwrap_or(&0)
                == &0
            {
                score += 15;
            }
        }

        score
    }

    /// 记录行为
    fn record_behavior(&self, event: &OperationEvent, risk_score: u32) {
        let mut history = self.behavior_history.lock().unwrap();

        let record = BehaviorRecord {
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            process_id: event.process_id,
            operation_type: event.operation_type,
            target: event.target_path.clone().unwrap_or_default(),
            risk_score,
        };

        history.push_back(record);

        // 保持历史记录在限制范围内
        while history.len() > self.max_history {
            history.pop_front();
        }
    }

    /// 更新进程画像
    fn update_process_profile(&self, event: &OperationEvent, risk_score: u32) {
        let mut profiles = self.process_profiles.lock().unwrap();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let profile = profiles
            .entry(event.process_id)
            .or_insert_with(|| ProcessProfile {
                process_id: event.process_id,
                process_name: event.process_name.clone(),
                first_seen: now,
                ..Default::default()
            });

        profile.last_seen = now;
        *profile
            .operation_count
            .entry(event.operation_type)
            .or_insert(0) += 1;
        profile.risk_score = (profile.risk_score + risk_score) / 2;
    }

    /// 应用风险衰减
    fn apply_decay(&self, process_id: u32, score: u32) -> u32 {
        let profiles = self.process_profiles.lock().unwrap();

        if let Some(profile) = profiles.get(&process_id) {
            let total_ops: u32 = profile.operation_count.values().sum();
            // 第一次操作不应用衰减，后续操作随着次数增加风险分数衰减
            if total_ops <= 1 {
                return score;
            }
            let decay_factor = (100.0 / (1.0 + (total_ops as f32 / 10.0))).min(100.0) / 100.0;
            (score as f32 * decay_factor) as u32
        } else {
            score
        }
    }

    /// 生成解释
    fn generate_explanation(&self, event: &OperationEvent, score: u32, rules: &[String]) -> String {
        let mut explanation = format!(
            "Operation '{:?}' by process '{}' (PID: {}) has risk score {}. ",
            event.operation_type, event.process_name, event.process_id, score
        );

        if !rules.is_empty() {
            explanation.push_str("Triggered rules: ");
            explanation.push_str(&rules.join(", "));
        }

        explanation
    }

    /// 生成建议
    fn generate_recommendations(&self, _score: u32, level: &RiskLevel) -> Vec<String> {
        let mut recommendations = Vec::new();

        match level {
            RiskLevel::None | RiskLevel::Low => {
                recommendations.push("No action required".to_string());
            }
            RiskLevel::Medium => {
                recommendations.push("Monitor this process closely".to_string());
                recommendations.push("Review operation details".to_string());
            }
            RiskLevel::High => {
                recommendations.push("Consider blocking this operation".to_string());
                recommendations.push("Investigate process behavior".to_string());
                recommendations.push("Check for compromise indicators".to_string());
            }
            RiskLevel::Critical => {
                recommendations.push("BLOCK IMMEDIATELY".to_string());
                recommendations.push("Isolate the process".to_string());
                recommendations.push("Initiate incident response".to_string());
                recommendations.push("Preserve forensic evidence".to_string());
            }
        }

        recommendations
    }

    /// 加载默认规则
    fn load_default_rules(&mut self) {
        self.rules = vec![
            RiskRule {
                id: "R001".to_string(),
                name: "System File Deletion".to_string(),
                description: "Attempting to delete critical system files".to_string(),
                condition: RuleCondition::And(vec![
                    RuleCondition::OperationType(OperationType::FileDelete),
                    RuleCondition::Or(vec![
                        // 检查目标路径
                        RuleCondition::PathContains("/etc/passwd".to_string()),
                        RuleCondition::PathContains("/etc/shadow".to_string()),
                        RuleCondition::PathContains("C:\\Windows\\System32".to_string()),
                        RuleCondition::PathContains("/bin".to_string()),
                        RuleCondition::PathContains("/sbin".to_string()),
                        // 检查命令行中的路径
                        RuleCondition::CommandContains("/etc/passwd".to_string()),
                        RuleCondition::CommandContains("/etc/shadow".to_string()),
                        RuleCondition::CommandContains("C:\\Windows\\System32".to_string()),
                        RuleCondition::CommandContains("/bin ".to_string()),
                        RuleCondition::CommandContains("/sbin".to_string()),
                    ]),
                ]),
                risk_score: 100,
                enabled: true,
            },
            RiskRule {
                id: "R002".to_string(),
                name: "Suspicious Network Connection".to_string(),
                description: "Connecting to suspicious ports".to_string(),
                condition: RuleCondition::OperationType(OperationType::NetworkConnect),
                risk_score: 60,
                enabled: true,
            },
            RiskRule {
                id: "R003".to_string(),
                name: "Registry Modification".to_string(),
                description: "Modifying Windows registry".to_string(),
                condition: RuleCondition::Or(vec![
                    RuleCondition::OperationType(OperationType::RegistryWrite),
                    RuleCondition::OperationType(OperationType::RegistryDelete),
                ]),
                risk_score: 50,
                enabled: true,
            },
            RiskRule {
                id: "R004".to_string(),
                name: "Rapid File Operations".to_string(),
                description: "Performing file operations at abnormal frequency".to_string(),
                condition: RuleCondition::Or(vec![
                    RuleCondition::Frequency {
                        op_type: OperationType::FileDelete,
                        count: 10,
                        window_secs: 5,
                    },
                    RuleCondition::Frequency {
                        op_type: OperationType::FileWrite,
                        count: 10,
                        window_secs: 5,
                    },
                ]),
                risk_score: 70,
                enabled: true,
            },
            RiskRule {
                id: "R005".to_string(),
                name: "Unknown Process Execution".to_string(),
                description: "Executing process from unusual location".to_string(),
                condition: RuleCondition::And(vec![
                    RuleCondition::OperationType(OperationType::ProcessExec),
                    RuleCondition::Or(vec![
                        RuleCondition::PathContains("/tmp".to_string()),
                        RuleCondition::PathContains("/var/tmp".to_string()),
                        RuleCondition::PathContains("C:\\Users\\".to_string()),
                        RuleCondition::PathContains("C:\\Temp".to_string()),
                    ]),
                ]),
                risk_score: 55,
                enabled: true,
            },
        ];
    }

    /// 添加自定义规则
    pub fn add_rule(&mut self, rule: RiskRule) {
        self.rules.push(rule);
    }

    /// 启用/禁用规则
    pub fn toggle_rule(&mut self, rule_id: &str, enabled: bool) -> bool {
        if let Some(rule) = self.rules.iter_mut().find(|r| r.id == rule_id) {
            rule.enabled = enabled;
            true
        } else {
            false
        }
    }

    /// 获取所有规则
    pub fn get_rules(&self) -> &[RiskRule] {
        &self.rules
    }

    /// 获取进程画像
    pub fn get_process_profile(&self, process_id: u32) -> Option<ProcessProfileInfo> {
        let profiles = self.process_profiles.lock().unwrap();
        profiles.get(&process_id).map(|p| ProcessProfileInfo {
            process_id: p.process_id,
            process_name: p.process_name.clone(),
            operation_count: p.operation_count.clone(),
            risk_score: p.risk_score,
            is_whitelisted: p.is_whitelisted,
        })
    }
}

/// 进程画像信息（公开版本）
#[derive(Debug, Clone)]
pub struct ProcessProfileInfo {
    pub process_id: u32,
    pub process_name: String,
    pub operation_count: HashMap<OperationType, u32>,
    pub risk_score: u32,
    pub is_whitelisted: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_event(op_type: OperationType, path: Option<&str>) -> OperationEvent {
        OperationEvent {
            id: "test".to_string(),
            timestamp: 0,
            operation_type: op_type,
            process_id: 1234,
            process_name: "test.exe".to_string(),
            process_path: "/test".to_string(),
            command_line: "test".to_string(),
            parent_process_id: 1,
            user_id: 1000,
            target_path: path.map(|p| p.to_string()),
            target_ip: None,
            target_port: None,
            risk_score: 0,
            decision: super::super::SecurityDecision::Allow,
            details: HashMap::new(),
        }
    }

    #[test]
    fn test_system_file_deletion() {
        let mut engine = RiskEngine::new();
        let event = create_test_event(OperationType::FileDelete, Some("/etc/passwd"));
        let assessment = engine.assess(&event);
        assert!(assessment.total_score >= 95);
        assert_eq!(assessment.risk_level, RiskLevel::Critical);
    }

    #[test]
    fn test_normal_operation() {
        let mut engine = RiskEngine::new();
        let event = create_test_event(OperationType::FileRead, Some("/home/user/document.txt"));
        let assessment = engine.assess(&event);
        assert!(assessment.total_score < 30);
    }

    #[test]
    fn test_rule_toggle() {
        let mut engine = RiskEngine::new();
        assert!(engine.toggle_rule("R001", false));

        let event = create_test_event(OperationType::FileDelete, Some("/etc/passwd"));
        let assessment = engine.assess(&event);
        // 规则被禁用，分数应该降低
        assert!(assessment.total_score < 95);
    }
}
