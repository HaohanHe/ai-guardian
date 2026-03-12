/**
 * AI Guardian - Main Entry Point
 */
use ai_guardian::core::config::{ConfigManager, GuardianConfig};
use ai_guardian::core::{initialize, shutdown, GuardianEngineFactory};
use std::path::PathBuf;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    env_logger::init();

    log::info!("AI Guardian V2.0 Starting...");

    // Load configuration
    let config_path = PathBuf::from("config.toml");
    let config_manager = ConfigManager::new(config_path);

    // Validate configuration
    let errors = config_manager.validate();
    if !errors.is_empty() {
        for error in &errors {
            log::error!("Config error: {}", error);
        }
        return Err(anyhow::anyhow!("Configuration validation failed"));
    }

    log::info!("Configuration loaded successfully");

    // Initialize the guardian engine
    match initialize() {
        Ok(_) => {
            log::info!("AI Guardian engine initialized");
        }
        Err(e) => {
            log::error!("Failed to initialize engine: {}", e);
            return Err(e);
        }
    }

    // Run the main loop
    log::info!("AI Guardian is running. Press Ctrl+C to stop.");

    // Wait for shutdown signal
    tokio::signal::ctrl_c().await?;

    log::info!("Shutting down AI Guardian...");
    shutdown();

    log::info!("AI Guardian stopped.");
    Ok(())
}
