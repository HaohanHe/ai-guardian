use axum::{
    routing::{delete, get, post, put},
    Router,
};
use tower_http::cors::{Any, CorsLayer};

use super::handlers::*;
use super::state::AppState;

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/config", get(get_config).put(update_config).post(reset_config))
        .route("/api/config/validate", post(validate_config))
        .route("/api/terminals", get(get_ai_terminals).post(add_ai_terminal))
        .route("/api/terminals/refresh", post(refresh_ai_terminals))
        .route("/api/terminals/:pid", delete(remove_ai_terminal))
        .route("/api/audit/logs", get(get_audit_logs))
        .route("/api/audit/export/:format", get(export_audit_logs))
        .route("/api/audit/clear", post(clear_audit_logs))
        .route("/api/stats", get(get_stats))
        .route("/api/driver/status", get(get_driver_status))
        .route("/api/driver/install", post(install_driver))
        .route("/api/driver/uninstall", post(uninstall_driver))
        .route("/api/llm/providers", get(get_llm_providers))
        .route("/api/llm/test/:provider", post(test_llm_connection))
        .route("/api/system/info", get(get_system_info))
        .route("/api/system/update/check", get(check_update))
        .route("/api/system/update/download", post(download_update))
        .route("/api/system/update/install", post(install_update))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state)
}
