use std::net::SocketAddr;
use std::sync::Arc;

use super::routes;
use super::state::AppState;

pub struct ApiServer {
    state: AppState,
    port: u16,
}

impl ApiServer {
    pub fn new(port: u16) -> Self {
        Self {
            state: AppState::new(),
            port,
        }
    }

    pub fn state(&self) -> AppState {
        self.state.clone()
    }

    pub async fn start(self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let addr = SocketAddr::from(([127, 0, 0, 1], self.port));
        let app = routes::create_router(self.state);

        log::info!("🚀 AI Guardian API Server starting on http://{}", addr);
        
        let listener = tokio::net::TcpListener::bind(addr).await?;
        axum::serve(listener, app).await?;

        Ok(())
    }
}

impl Default for ApiServer {
    fn default() -> Self {
        Self::new(9876)
    }
}
