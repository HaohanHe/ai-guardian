use ai_guardian::web::ApiServer;
use std::env;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    log::info!("AI Guardian V2.0 Starting...");

    let port = env::var("AI_GUARDIAN_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(9876);

    let server = ApiServer::new(port);
    
    log::info!("Starting API server on port {}", port);
    
    server.start().await?;

    log::info!("AI Guardian stopped.");
    Ok(())
}
