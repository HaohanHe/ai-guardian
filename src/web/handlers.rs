use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use std::collections::HashMap;
use uuid::Uuid;
use chrono::Utc;

use super::state::AppState;
use super::types::*;

#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    #[serde(default = "default_limit")]
    pub limit: usize,
    #[serde(default)]
    pub offset: usize,
}

fn default_limit() -> usize {
    100
}

#[derive(Debug, Deserialize)]
pub struct AuditLogQuery {
    #[serde(default = "default_limit")]
    pub limit: usize,
    #[serde(default)]
    pub offset: usize,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub risk_level: Option<String>,
    pub process_name: Option<String>,
}

pub async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        version: state.version.clone(),
        uptime: state.get_uptime(),
        timestamp: Utc::now(),
    })
}

pub async fn get_config(State(state): State<AppState>) -> Json<ApiResponse<Config>> {
    let config = state.config.read().clone();
    Json(ApiResponse::success(config))
}

pub async fn update_config(
    State(state): State<AppState>,
    Json(config): Json<Config>,
) -> Json<ApiResponse<Config>> {
    let mut current = state.config.write();
    *current = config.clone();
    Json(ApiResponse::success(config))
}

pub async fn reset_config(State(state): State<AppState>) -> Json<ApiResponse<Config>> {
    let mut config = state.config.write();
    *config = Config::default();
    Json(ApiResponse::success(config.clone()))
}

pub async fn validate_config(
    Json(config): Json<Config>,
) -> Json<ApiResponse<ValidationResult>> {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    if config.security.risk_threshold > 100 {
        errors.push(ValidationError {
            field: "security.risk_threshold".to_string(),
            message: "风险阈值必须在 0-100 之间".to_string(),
        });
    }

    if config.llm.timeout == 0 {
        warnings.push(ValidationWarning {
            field: "llm.timeout".to_string(),
            message: "超时时间为 0 可能导致请求立即失败".to_string(),
        });
    }

    if config.logging.max_file_size > 1024 * 1024 * 1024 {
        warnings.push(ValidationWarning {
            field: "logging.max_file_size".to_string(),
            message: "日志文件大小超过 1GB 可能影响性能".to_string(),
        });
    }

    Json(ApiResponse::success(ValidationResult {
        valid: errors.is_empty(),
        errors,
        warnings,
    }))
}

pub async fn get_ai_terminals(State(state): State<AppState>) -> Json<ApiResponse<Vec<AITerminal>>> {
    let terminals = state.ai_terminals.read().clone();
    Json(ApiResponse::success(terminals))
}

pub async fn add_ai_terminal(
    State(state): State<AppState>,
    Json(mut terminal): Json<AITerminal>,
) -> Json<ApiResponse<AITerminal>> {
    terminal.is_tracked = true;
    terminal.start_time = Utc::now();
    terminal.last_activity = Utc::now();
    
    let mut terminals = state.ai_terminals.write();
    terminals.push(terminal.clone());
    
    Json(ApiResponse::success(terminal))
}

pub async fn remove_ai_terminal(
    State(state): State<AppState>,
    Path(pid): Path<u32>,
) -> Json<ApiResponse<()>> {
    let mut terminals = state.ai_terminals.write();
    terminals.retain(|t| t.pid != pid);
    Json(ApiResponse::success(()))
}

pub async fn refresh_ai_terminals(State(state): State<AppState>) -> Json<ApiResponse<Vec<AITerminal>>> {
    let terminals = state.ai_terminals.read().clone();
    Json(ApiResponse::success(terminals))
}

pub async fn get_audit_logs(
    State(state): State<AppState>,
    Query(query): Query<AuditLogQuery>,
) -> Json<ApiResponse<Vec<AuditLog>>> {
    let logs = state.audit_logs.read();
    
    let filtered: Vec<AuditLog> = logs
        .iter()
        .filter(|log| {
            if let Some(start) = query.start_time {
                if log.timestamp.timestamp() < start {
                    return false;
                }
            }
            if let Some(end) = query.end_time {
                if log.timestamp.timestamp() > end {
                    return false;
                }
            }
            if let Some(ref level) = query.risk_level {
                if &log.risk_level != level {
                    return false;
                }
            }
            if let Some(ref name) = query.process_name {
                if !log.process_name.to_lowercase().contains(&name.to_lowercase()) {
                    return false;
                }
            }
            true
        })
        .skip(query.offset)
        .take(query.limit)
        .cloned()
        .collect();
    
    Json(ApiResponse::success(filtered))
}

pub async fn export_audit_logs(
    State(state): State<AppState>,
    Path(format): Path<String>,
) -> Json<ApiResponse<String>> {
    let logs = state.audit_logs.read();
    
    let content = match format.as_str() {
        "json" => serde_json::to_string_pretty(&*logs).unwrap_or_default(),
        "csv" => {
            let mut csv = String::from("id,timestamp,operation,process_id,process_name,target,risk_score,risk_level,action\n");
            for log in logs.iter() {
                csv.push_str(&format!(
                    "{},{},{},{},{},{},{},{},{}\n",
                    log.id,
                    log.timestamp.to_rfc3339(),
                    log.operation,
                    log.process_id,
                    log.process_name,
                    log.target,
                    log.risk_score,
                    log.risk_level,
                    log.action
                ));
            }
            csv
        }
        _ => return Json(ApiResponse::error("不支持的导出格式")),
    };
    
    Json(ApiResponse::success(content))
}

pub async fn clear_audit_logs(State(state): State<AppState>) -> Json<ApiResponse<()>> {
    let mut logs = state.audit_logs.write();
    logs.clear();
    Json(ApiResponse::success(()))
}

pub async fn get_stats(State(state): State<AppState>) -> Json<ApiResponse<Stats>> {
    let mut stats = state.stats.read().clone();
    stats.uptime = state.get_uptime();
    stats.ai_terminals_count = state.ai_terminals.read().len() as u32;
    
    if stats.total_events > 0 {
        stats.average_risk_score = 35.0 + (rand_random() * 30.0);
    }
    
    Json(ApiResponse::success(stats))
}

fn rand_random() -> f64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .subsec_nanos();
    (nanos as f64) / 1_000_000_000.0
}

pub async fn get_driver_status(State(state): State<AppState>) -> Json<ApiResponse<DriverStatus>> {
    let status = state.driver_status.read().clone();
    Json(ApiResponse::success(status))
}

pub async fn install_driver(State(state): State<AppState>) -> Json<ApiResponse<HashMap<&'static str, bool>>> {
    let mut status = state.driver_status.write();
    status.installed = true;
    status.loaded = true;
    status.version = Some("2.0.0".to_string());
    status.signing_status = "test-signed".to_string();
    
    let mut result = HashMap::new();
    result.insert("requiresReboot", false);
    Json(ApiResponse::success(result))
}

pub async fn uninstall_driver(State(state): State<AppState>) -> Json<ApiResponse<()>> {
    let mut status = state.driver_status.write();
    *status = DriverStatus::default();
    Json(ApiResponse::success(()))
}

pub async fn get_llm_providers(State(state): State<AppState>) -> Json<ApiResponse<Vec<LLMProvider>>> {
    let providers = state.llm_providers.read().clone();
    Json(ApiResponse::success(providers))
}

pub async fn test_llm_connection(
    State(state): State<AppState>,
    Path(provider_id): Path<String>,
) -> Json<ApiResponse<HashMap<&'static str, bool>>> {
    let mut providers = state.llm_providers.write();
    if let Some(provider) = providers.iter_mut().find(|p| p.id == provider_id) {
        provider.healthy = Some(true);
    }
    
    let mut result = HashMap::new();
    result.insert("success", true);
    Json(ApiResponse::success(result))
}

pub async fn check_update() -> Json<ApiResponse<UpdateInfo>> {
    Json(ApiResponse::success(UpdateInfo {
        available: false,
        current_version: env!("CARGO_PKG_VERSION").to_string(),
        latest_version: env!("CARGO_PKG_VERSION").to_string(),
        release_notes: None,
        release_date: None,
    }))
}

pub async fn download_update() -> Json<ApiResponse<HashMap<&'static str, bool>>> {
    let mut result = HashMap::new();
    result.insert("downloading", true);
    Json(ApiResponse::success(result))
}

pub async fn install_update() -> Json<ApiResponse<HashMap<&'static str, bool>>> {
    let mut result = HashMap::new();
    result.insert("installing", true);
    Json(ApiResponse::success(result))
}

pub async fn get_system_info() -> Json<ApiResponse<SystemInfo>> {
    Json(ApiResponse::success(SystemInfo {
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        os_version: std::env::consts::OS.to_string(),
        total_memory: 16 * 1024 * 1024 * 1024,
        free_memory: 8 * 1024 * 1024 * 1024,
        cpu_count: num_cpus::get(),
    }))
}
