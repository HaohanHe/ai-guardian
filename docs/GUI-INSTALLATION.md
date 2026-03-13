# AI Guardian V2 - GUI Installation Guide

## 🎯 Quick Start

### Windows Installation

1. **Download the installer**
   - Download `AI-Guardian-Setup-2.0.0.exe` from the [Releases](https://github.com/HaohanHe/ai-guardian/releases) page

2. **Run the installer**
   - Right-click and select "Run as administrator"
   - Follow the installation wizard

3. **Launch the application**
   - Desktop shortcut: Double-click "AI Guardian"
   - Start menu: AI Guardian → AI Guardian

### First Run

When you first launch AI Guardian:

1. **Backend Connection**
   - The application automatically starts the Rust backend service
   - Wait for the "Backend Connected" indicator to turn green

2. **Driver Installation (Optional)**
   - Go to Settings → Driver Management
   - Click "Install Driver" for system-level protection
   - Requires administrator privileges and test signing mode

3. **Configure LLM Provider**
   - Go to Settings → LLM Configuration
   - Select your preferred LLM provider
   - Enter your API key
   - Test the connection

## 📱 User Interface

### Dashboard

The main dashboard provides:

- **System Status**: Real-time monitoring status
- **Event Statistics**: Total events, blocked events, warnings
- **AI Terminals**: List of detected AI agent processes
- **Recent Events**: Latest security events

### Settings

#### General Settings
- Auto-start on boot
- Minimize to tray
- Language selection
- Theme (Dark/Light/System)

#### Security Policy
- Risk threshold adjustment
- Block file deletion
- Block system path writes
- Block network connections
- Block registry modifications
- Block process creation

#### LLM Configuration
- Provider selection (OpenAI, Anthropic, DeepSeek, Gemini, Qwen, MiMoFlash, Ollama)
- API key management
- Base URL customization
- Timeout and retry settings

#### Driver Management
- Install/Uninstall kernel driver
- Driver status monitoring
- Test signing mode management

#### Audit Logs
- Log level configuration
- File size limits
- Retention settings

#### Notifications
- Enable/disable notifications
- Sound alerts
- Desktop notifications
- Email notifications

### Monitoring

Real-time monitoring of:
- AI terminal processes
- Security events
- Risk scores
- Blocked operations

### Audit Logs

View and export:
- All security events
- Filter by date, risk level, process
- Export to JSON/CSV

## 🔧 Advanced Configuration

### Configuration File

Configuration is stored in:
- Windows: `%APPDATA%\ai-guardian\config\config.yaml`
- macOS: `~/Library/Application Support/ai-guardian/config.yaml`
- Linux: `~/.config/ai-guardian/config.yaml`

### Environment Variables

```bash
# Backend port
AI_GUARDIAN_PORT=9876

# Configuration directory
AI_GUARDIAN_CONFIG_DIR=/path/to/config

# Log directory
AI_GUARDIAN_LOG_DIR=/path/to/logs
```

### Manual Backend Start

```bash
# Start backend manually
ai-guardian.exe

# With custom port
AI_GUARDIAN_PORT=9000 ai-guardian.exe
```

## 🛡️ Security Features

### Kernel Driver (Windows)

The kernel driver provides system-level protection:

1. **File Protection**
   - Block file deletion
   - Protect system directories
   - Monitor file operations

2. **Network Protection**
   - Block suspicious connections
   - Monitor outbound traffic
   - Port filtering

3. **Process Protection**
   - Monitor process creation
   - Track child processes
   - AI process marking

### Driver Installation Requirements

- Windows 10/11 x64
- Administrator privileges
- Test signing mode (for development builds)
- Properly signed driver (for production)

### Enabling Test Signing

```powershell
# Enable test signing mode
bcdedit /set testsigning on

# Restart computer
shutdown /r /t 0
```

### Installing Driver Manually

```powershell
# Run as Administrator
cd "C:\Program Files\AI Guardian\driver"
powershell -ExecutionPolicy Bypass -File install-driver.ps1
```

## 📊 API Reference

The backend provides a REST API on `http://127.0.0.1:9876`:

### Health Check
```
GET /api/health
```

### Get Statistics
```
GET /api/stats
```

### Get AI Terminals
```
GET /api/terminals
```

### Get Audit Logs
```
GET /api/audit/logs?limit=100&offset=0
```

### Get Configuration
```
GET /api/config
```

### Update Configuration
```
PUT /api/config
Content-Type: application/json

{
  "security": {
    "risk_threshold": 70
  }
}
```

### Get Driver Status
```
GET /api/driver/status
```

### Install Driver
```
POST /api/driver/install
```

### Get LLM Providers
```
GET /api/llm/providers
```

### Test LLM Connection
```
POST /api/llm/test/:provider
```

## 🐛 Troubleshooting

### Backend Not Connecting

1. Check if the backend process is running
   - Task Manager → ai-guardian.exe
2. Check if port 9876 is available
   - `netstat -ano | findstr 9876`
3. Check logs
   - `%APPDATA%\ai-guardian\logs\`

### Driver Installation Failed

1. Ensure test signing is enabled
   - `bcdedit /enum | findstr testsigning`
2. Run as Administrator
3. Check Windows Event Viewer
   - Application and Services Logs → System

### High CPU/Memory Usage

1. Reduce scan interval in settings
2. Disable unused monitoring features
3. Check for runaway processes

### GUI Not Responding

1. Restart the application
2. Check for zombie processes
3. Clear cache: `%APPDATA%\ai-guardian\cache\`

## 🔄 Updates

### Automatic Updates

1. Settings → General → Check for updates
2. Download and install automatically
3. Application restarts after update

### Manual Updates

1. Download new version from Releases
2. Run installer (will upgrade existing installation)
3. Settings and data are preserved

## 📝 Logs

### Log Locations

- Main logs: `%APPDATA%\ai-guardian\logs\main-YYYY-MM-DD.log`
- Backend logs: `%APPDATA%\ai-guardian\logs\backend-YYYY-MM-DD.log`
- Audit logs: `%APPDATA%\ai-guardian\logs\audit-YYYY-MM-DD.log`

### Log Levels

- `debug`: Detailed debugging information
- `info`: General information
- `warn`: Warning messages
- `error`: Error messages

### Changing Log Level

Settings → Audit Logs → Log Level

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/HaohanHe/ai-guardian/issues)
- **Discussions**: [GitHub Discussions](https://github.com/HaohanHe/ai-guardian/discussions)
- **Documentation**: [Wiki](https://github.com/HaohanHe/ai-guardian/wiki)

## 📄 License

MIT License - see [LICENSE](../LICENSE) for details.
