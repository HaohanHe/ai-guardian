/**
 * AI Guardian - Electron Main Process (Complete Implementation)
 * 
 * 主进程入口，负责：
 * 1. 创建窗口
 * 2. 与 Rust 后端通信 (HTTP + WebSocket)
 * 3. 系统托盘
 * 4. 自动更新
 * 5. 开机自启
 * 6. 极端工况处理
 */

import { 
  app, 
  BrowserWindow, 
  ipcMain, 
  nativeImage, 
  Tray, 
  Menu, 
  dialog, 
  shell,
  Notification,
  appUpdater,
  autoUpdater
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as childProcess from 'child_process';
import * as os from 'os';

const isDev = process.env.NODE_ENV === 'development';
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

const BACKEND_PORT = 9876;
const BACKEND_HOST = '127.0.0.1';
const MAX_RETRY_COUNT = 10;
const RETRY_DELAY_MS = 3000;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let backendProcess: childProcess.ChildProcess | null = null;
let backendHealthCheckInterval: NodeJS.Timeout | null = null;
let retryCount = 0;
let isShuttingDown = false;
let configCache: any = null;

function getResourcePath(...paths: string[]): string {
  if (isDev) {
    return path.join(__dirname, '../../resources', ...paths);
  }
  if (isMac) {
    return path.join(process.resourcesPath, ...paths);
  }
  return path.join(path.dirname(app.getPath('exe')), 'resources', ...paths);
}

function getBackendBinaryPath(): string {
  const binaryName = isWindows ? 'ai-guardian.exe' : 'ai-guardian';
  if (isDev) {
    return path.join(__dirname, '../../../target/release', binaryName);
  }
  return path.join(path.dirname(app.getPath('exe')), binaryName);
}

function ensureDirectories(): void {
  const dirs = [
    app.getPath('userData'),
    path.join(app.getPath('userData'), 'logs'),
    path.join(app.getPath('userData'), 'config'),
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function createMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'AI Guardian V2',
    icon: getResourcePath('icons', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
    },
    show: false,
    frame: isMac ? true : false,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    backgroundColor: '#111827',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    checkBackendHealth();
  });

  mainWindow.on('close', (event) => {
    if (!isShuttingDown) {
      event.preventDefault();
      mainWindow?.hide();
      if (isWindows) {
        showMinimizeNotification();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (isDev) {
          mainWindow.loadURL('http://localhost:5173');
        } else {
          mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
        }
      }
    }, 1000);
  });
}

function showMinimizeNotification(): void {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: 'AI Guardian 仍在运行',
      body: '程序已最小化到系统托盘，点击托盘图标可恢复窗口',
      silent: true,
    });
    notification.show();
  }
}

function createTray(): void {
  const iconPath = getResourcePath('icons', 'tray-icon.png');
  
  let icon: nativeImage;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
    if (isWindows || isLinux) {
      icon = icon.resize({ width: 16, height: 16 });
    }
  } else {
    icon = nativeImage.createEmpty();
  }
  
  tray = new Tray(icon);
  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        if (mainWindow.isFocused()) {
          mainWindow.hide();
        } else {
          mainWindow.focus();
        }
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createMainWindow();
    }
  });

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
  });
}

function updateTrayMenu(backendStatus: 'running' | 'stopped' | 'error' = 'running'): void {
  if (!tray) return;

  const statusText = {
    running: '🟢 后端运行中',
    stopped: '🔴 后端已停止',
    error: '🟡 后端异常',
  };

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: statusText[backendStatus],
      enabled: false,
    },
    {
      label: '重启后端服务',
      click: () => restartBackend(),
    },
    { type: 'separator' },
    {
      label: '打开日志目录',
      click: () => {
        const logPath = path.join(app.getPath('userData'), 'logs');
        if (!fs.existsSync(logPath)) {
          fs.mkdirSync(logPath, { recursive: true });
        }
        shell.openPath(logPath);
      },
    },
    {
      label: '打开配置目录',
      click: () => {
        const configPath = path.join(app.getPath('userData'), 'config');
        if (!fs.existsSync(configPath)) {
          fs.mkdirSync(configPath, { recursive: true });
        }
        shell.openPath(configPath);
      },
    },
    { type: 'separator' },
    {
      label: '检查更新',
      click: () => checkForUpdates(),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isShuttingDown = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip(`AI Guardian V2 - ${statusText[backendStatus]}`);
}

async function startBackend(): Promise<void> {
  const binaryPath = getBackendBinaryPath();
  
  if (!fs.existsSync(binaryPath)) {
    console.error('Backend binary not found:', binaryPath);
    sendToRenderer('backend-error', { 
      error: '后端程序未找到',
      path: binaryPath,
      suggestion: '请重新安装或检查安装路径'
    });
    return;
  }

  if (backendProcess && !backendProcess.killed) {
    console.log('Backend already running');
    return;
  }

  try {
    const configDir = path.join(app.getPath('userData'), 'config');
    const logDir = path.join(app.getPath('userData'), 'logs');
    
    backendProcess = childProcess.spawn(binaryPath, [], {
      cwd: path.dirname(binaryPath),
      env: {
        ...process.env,
        AI_GUARDIAN_CONFIG_DIR: configDir,
        AI_GUARDIAN_LOG_DIR: logDir,
        AI_GUARDIAN_PORT: String(BACKEND_PORT),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    backendProcess.stdout?.on('data', (data: Buffer) => {
      console.log(`[Backend] ${data.toString()}`);
      logToFile(data.toString(), 'info');
    });

    backendProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[Backend Error] ${data.toString()}`);
      logToFile(data.toString(), 'error');
    });

    backendProcess.on('error', (err) => {
      console.error('Failed to start backend:', err);
      sendToRenderer('backend-error', { 
        error: err.message,
        suggestion: '请检查是否有足够的权限运行程序'
      });
      updateTrayMenu('error');
    });

    backendProcess.on('exit', (code, signal) => {
      console.log(`Backend exited with code ${code}, signal ${signal}`);
      backendProcess = null;
      
      if (!isShuttingDown && code !== 0) {
        sendToRenderer('backend-exit', { 
          code, 
          signal,
          suggestion: '后端服务异常退出，正在尝试重启...'
        });
        updateTrayMenu('error');
        scheduleBackendRestart();
      }
    });

    await waitForBackendReady();
    
  } catch (error) {
    console.error('Failed to start backend:', error);
    sendToRenderer('backend-error', { 
      error: String(error),
      suggestion: '请以管理员身份运行程序'
    });
    updateTrayMenu('error');
  }
}

async function waitForBackendReady(): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 30;
    
    const checkReady = () => {
      attempts++;
      
      http.get(`http://${BACKEND_HOST}:${BACKEND_PORT}/api/health`, (res) => {
        if (res.statusCode === 200) {
          console.log('Backend is ready');
          retryCount = 0;
          sendToRenderer('backend-status', { connected: true });
          updateTrayMenu('running');
          startHealthCheck();
          resolve();
        } else {
          if (attempts < maxAttempts) {
            setTimeout(checkReady, 500);
          } else {
            reject(new Error('Backend health check failed'));
          }
        }
      }).on('error', () => {
        if (attempts < maxAttempts) {
          setTimeout(checkReady, 500);
        } else {
          reject(new Error('Backend not responding'));
        }
      });
    };
    
    setTimeout(checkReady, 1000);
  });
}

function startHealthCheck(): void {
  if (backendHealthCheckInterval) {
    clearInterval(backendHealthCheckInterval);
  }
  
  backendHealthCheckInterval = setInterval(() => {
    http.get(`http://${BACKEND_HOST}:${BACKEND_PORT}/api/health`, (res) => {
      if (res.statusCode !== 200) {
        sendToRenderer('backend-status', { connected: false });
        updateTrayMenu('error');
      }
    }).on('error', () => {
      sendToRenderer('backend-status', { connected: false });
      updateTrayMenu('stopped');
    });
  }, 5000);
}

function scheduleBackendRestart(): void {
  if (retryCount >= MAX_RETRY_COUNT) {
    sendToRenderer('backend-error', {
      error: '后端服务重启失败次数过多',
      suggestion: '请手动重启应用程序或联系技术支持'
    });
    return;
  }
  
  retryCount++;
  const delay = RETRY_DELAY_MS * Math.pow(2, Math.min(retryCount - 1, 5));
  
  console.log(`Scheduling backend restart in ${delay}ms (attempt ${retryCount}/${MAX_RETRY_COUNT})`);
  
  setTimeout(() => {
    if (!isShuttingDown) {
      startBackend();
    }
  }, delay);
}

async function stopBackend(): Promise<void> {
  if (backendHealthCheckInterval) {
    clearInterval(backendHealthCheckInterval);
    backendHealthCheckInterval = null;
  }
  
  if (backendProcess && !backendProcess.killed) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('Force killing backend process');
        backendProcess?.kill('SIGKILL');
        resolve();
      }, 5000);

      backendProcess!.on('exit', () => {
        clearTimeout(timeout);
        backendProcess = null;
        resolve();
      });

      backendProcess!.kill('SIGTERM');
    });
  }
}

async function restartBackend(): Promise<void> {
  await stopBackend();
  retryCount = 0;
  await startBackend();
}

function sendToRenderer(channel: string, data: any): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

async function apiRequest(method: string, endpoint: string, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data ? JSON.parse(data) : {});
          } else {
            const error = data ? JSON.parse(data) : { error: 'Unknown error' };
            reject(new Error(error.error || `HTTP ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

function logToFile(message: string, level: 'info' | 'error' | 'warn' = 'info'): void {
  try {
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `main-${today}.log`);
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    
    fs.appendFileSync(logFile, logLine, { encoding: 'utf8' });
  } catch (e) {
    console.error('Failed to write log:', e);
  }
}

async function checkForUpdates(): Promise<void> {
  try {
    const result = await apiRequest('GET', '/api/system/update/check');
    sendToRenderer('update-available', result);
  } catch (error) {
    sendToRenderer('update-error', { error: String(error) });
  }
}

function setupAutoLaunch(): void {
  const appFolder = path.dirname(process.execPath);
  const updateExe = path.resolve(appFolder, '..', 'Update.exe');
  const exeName = path.basename(process.execPath);

  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
    path: isWindows ? updateExe : process.execPath,
    args: isWindows ? [
      '--processStart', `"${exeName}"`,
      '--process-start-args', '"--hidden"'
    ] : ['--hidden'],
  });
}

function removeAutoLaunch(): void {
  app.setLoginItemSettings({
    openAtLogin: false,
  });
}

function handleUncaughtExceptions(): void {
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    logToFile(`Uncaught Exception: ${error.stack || error}`, 'error');
    
    dialog.showErrorBox('AI Guardian 遇到错误', 
      `程序遇到未预期的错误:\n\n${error.message}\n\n请查看日志文件获取详细信息。`);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    logToFile(`Unhandled Rejection: ${reason}`, 'error');
  });
}

// ==================== IPC Handlers ====================

ipcMain.handle('get-system-info', async () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome,
    osVersion: os.release(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    cpuCount: os.cpus().length,
    homeDir: os.homedir(),
    tempDir: os.tmpdir(),
    appData: app.getPath('appData'),
    userData: app.getPath('userData'),
  };
});

ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
});

ipcMain.handle('get-backend-status', async () => {
  try {
    await apiRequest('GET', '/api/health');
    return { connected: true, healthy: true };
  } catch {
    return { connected: false, healthy: false };
  }
});

ipcMain.handle('start-backend', async () => {
  await startBackend();
  return { success: true };
});

ipcMain.handle('stop-backend', async () => {
  await stopBackend();
  return { success: true };
});

ipcMain.handle('restart-backend', async () => {
  await restartBackend();
  return { success: true };
});

ipcMain.handle('get-config', async () => {
  try {
    if (configCache) {
      return configCache;
    }
    const config = await apiRequest('GET', '/api/config');
    configCache = config;
    return config;
  } catch (error) {
    throw new Error(`获取配置失败: ${error}`);
  }
});

ipcMain.handle('update-config', async (_, config: any) => {
  try {
    const result = await apiRequest('PUT', '/api/config', config);
    configCache = config;
    return result;
  } catch (error) {
    throw new Error(`更新配置失败: ${error}`);
  }
});

ipcMain.handle('reset-config', async () => {
  try {
    const result = await apiRequest('POST', '/api/config/reset');
    configCache = null;
    return result;
  } catch (error) {
    throw new Error(`重置配置失败: ${error}`);
  }
});

ipcMain.handle('validate-config', async (_, config: any) => {
  try {
    return await apiRequest('POST', '/api/config/validate', config);
  } catch (error) {
    return { valid: false, errors: [{ field: 'general', message: String(error) }] };
  }
});

ipcMain.handle('get-ai-terminals', async () => {
  try {
    return await apiRequest('GET', '/api/terminals');
  } catch (error) {
    throw new Error(`获取 AI 终端列表失败: ${error}`);
  }
});

ipcMain.handle('add-ai-terminal', async (_, terminal: any) => {
  try {
    return await apiRequest('POST', '/api/terminals', terminal);
  } catch (error) {
    throw new Error(`添加 AI 终端失败: ${error}`);
  }
});

ipcMain.handle('remove-ai-terminal', async (_, pid: number) => {
  try {
    return await apiRequest('DELETE', `/api/terminals/${pid}`);
  } catch (error) {
    throw new Error(`移除 AI 终端失败: ${error}`);
  }
});

ipcMain.handle('refresh-ai-terminals', async () => {
  try {
    return await apiRequest('POST', '/api/terminals/refresh');
  } catch (error) {
    throw new Error(`刷新 AI 终端列表失败: ${error}`);
  }
});

ipcMain.handle('get-audit-logs', async (_, params: any) => {
  try {
    const query = new URLSearchParams(params).toString();
    return await apiRequest('GET', `/api/audit/logs?${query}`);
  } catch (error) {
    throw new Error(`获取审计日志失败: ${error}`);
  }
});

ipcMain.handle('export-audit-logs', async (_, format: string) => {
  try {
    const result = await apiRequest('GET', `/api/audit/export?format=${format}`);
    
    if (result.path) {
      const saveResult = await dialog.showSaveDialog(mainWindow!, {
        defaultPath: `audit-logs-${Date.now()}.${format}`,
        filters: [
          { name: format.toUpperCase(), extensions: [format] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      
      if (!saveResult.canceled && saveResult.filePath) {
        fs.copyFileSync(result.path, saveResult.filePath);
        return { success: true, path: saveResult.filePath };
      }
    }
    
    return result;
  } catch (error) {
    throw new Error(`导出审计日志失败: ${error}`);
  }
});

ipcMain.handle('clear-audit-logs', async () => {
  try {
    return await apiRequest('POST', '/api/audit/clear');
  } catch (error) {
    throw new Error(`清除审计日志失败: ${error}`);
  }
});

ipcMain.handle('get-stats', async () => {
  try {
    return await apiRequest('GET', '/api/stats');
  } catch (error) {
    throw new Error(`获取统计数据失败: ${error}`);
  }
});

ipcMain.handle('get-driver-status', async () => {
  try {
    return await apiRequest('GET', '/api/driver/status');
  } catch (error) {
    throw new Error(`获取驱动状态失败: ${error}`);
  }
});

ipcMain.handle('install-driver', async () => {
  try {
    if (!isWindows) {
      throw new Error('驱动安装仅支持 Windows 系统');
    }
    
    const result = await apiRequest('POST', '/api/driver/install');
    
    if (result.requiresReboot) {
      dialog.showMessageBox(mainWindow!, {
        type: 'info',
        title: '需要重启',
        message: '驱动安装成功，需要重启系统才能生效',
        buttons: ['稍后重启', '立即重启'],
        defaultId: 0,
      }).then((response) => {
        if (response.response === 1) {
          if (isWindows) {
            childProcess.exec('shutdown /r /t 10');
          }
        }
      });
    }
    
    return result;
  } catch (error) {
    throw new Error(`安装驱动失败: ${error}`);
  }
});

ipcMain.handle('uninstall-driver', async () => {
  try {
    if (!isWindows) {
      throw new Error('驱动卸载仅支持 Windows 系统');
    }
    
    return await apiRequest('POST', '/api/driver/uninstall');
  } catch (error) {
    throw new Error(`卸载驱动失败: ${error}`);
  }
});

ipcMain.handle('get-llm-providers', async () => {
  try {
    return await apiRequest('GET', '/api/llm/providers');
  } catch (error) {
    throw new Error(`获取 LLM 供应商列表失败: ${error}`);
  }
});

ipcMain.handle('test-llm-connection', async (_, provider: string) => {
  try {
    return await apiRequest('POST', '/api/llm/test', { provider });
  } catch (error) {
    throw new Error(`测试 LLM 连接失败: ${error}`);
  }
});

ipcMain.handle('show-notification', async (_, data: any) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: data.title,
      body: data.body,
      silent: !data.sound,
    });
    notification.show();
    return { success: true };
  }
  return { success: false, error: 'Notifications not supported' };
});

ipcMain.handle('select-file', async (_, options: any) => {
  if (!mainWindow) return { canceled: true };
  
  const result = await dialog.showOpenDialog(mainWindow, {
    title: options.title || '选择文件',
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
    properties: options.multiSelections 
      ? ['openFile', 'multiSelections'] 
      : ['openFile'],
  });
  
  return result;
});

ipcMain.handle('select-directory', async () => {
  if (!mainWindow) return { canceled: true };
  
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择目录',
    properties: ['openDirectory', 'createDirectory'],
  });
  
  return result;
});

ipcMain.handle('check-for-updates', async () => {
  return checkForUpdates();
});

ipcMain.handle('download-update', async () => {
  try {
    return await apiRequest('POST', '/api/system/update/download');
  } catch (error) {
    throw new Error(`下载更新失败: ${error}`);
  }
});

ipcMain.handle('install-update', async () => {
  try {
    const result = await apiRequest('POST', '/api/system/update/install');
    
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 3000);
    
    return result;
  } catch (error) {
    throw new Error(`安装更新失败: ${error}`);
  }
});

ipcMain.handle('get-logs', async (_, limit?: number) => {
  try {
    const logDir = path.join(app.getPath('userData'), 'logs');
    const files = fs.readdirSync(logDir)
      .filter(f => f.endsWith('.log'))
      .sort()
      .reverse();
    
    const logs: string[] = [];
    const maxLines = limit || 100;
    
    for (const file of files) {
      const content = fs.readFileSync(path.join(logDir, file), 'utf8');
      const lines = content.split('\n').slice(-maxLines);
      logs.push(...lines);
      
      if (logs.length >= maxLines) break;
    }
    
    return logs.slice(-maxLines);
  } catch (error) {
    return [];
  }
});

ipcMain.handle('clear-logs', async () => {
  try {
    const logDir = path.join(app.getPath('userData'), 'logs');
    const files = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));
    
    for (const file of files) {
      fs.unlinkSync(path.join(logDir, file));
    }
    
    return { success: true };
  } catch (error) {
    throw new Error(`清除日志失败: ${error}`);
  }
});

ipcMain.handle('window-minimize', async () => {
  mainWindow?.minimize();
});

ipcMain.handle('window-maximize', async () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window-close', async () => {
  mainWindow?.hide();
});

ipcMain.handle('set-tray-icon', async (_, iconPath: string) => {
  if (tray && fs.existsSync(iconPath)) {
    const icon = nativeImage.createFromPath(iconPath);
    tray.setImage(icon);
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('show-tray-notification', async (_, title: string, body: string) => {
  if (tray && isWindows) {
    tray.displayBalloon({
      iconType: 'info',
      title,
      content: body,
    });
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('enable-auto-start', async () => {
  setupAutoLaunch();
  return { success: true };
});

ipcMain.handle('disable-auto-start', async () => {
  removeAutoLaunch();
  return { success: true };
});

ipcMain.handle('is-auto-start-enabled', async () => {
  const settings = app.getLoginItemSettings();
  return { enabled: settings.openAtLogin };
});

ipcMain.handle('open-dev-tools', async () => {
  mainWindow?.webContents.openDevTools();
});

ipcMain.handle('reload', async () => {
  mainWindow?.reload();
});

ipcMain.handle('open-external', async (_, url: string) => {
  await shell.openExternal(url);
});

// ==================== App Lifecycle ====================

handleUncaughtExceptions();

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    ensureDirectories();
    createMainWindow();
    createTray();
    
    if (!isDev) {
      await startBackend();
    }
    
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      // Keep running in background
    }
  });

  app.on('before-quit', async () => {
    isShuttingDown = true;
    await stopBackend();
  });

  app.on('will-quit', () => {
    // Cleanup
  });
}
