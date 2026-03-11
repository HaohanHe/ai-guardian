/**
 * AI Guardian - Electron Main Process
 * 
 * 主进程入口，负责：
 * 1. 创建窗口
 * 2. 与 Rust 后端通信
 * 3. 系统托盘
 * 4. 自动更新
 */

import { app, BrowserWindow, ipcMain, nativeImage, Tray, Menu, dialog, shell } from 'electron';
import * as path from 'path';
import * as net from 'net';

// 开发模式判断
const isDev = process.env.NODE_ENV === 'development';

// 全局变量
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let rustProcess: any = null;

// 与 Rust 后端的 TCP 连接
let rustSocket: net.Socket | null = null;

/**
 * 创建主窗口
 */
function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'AI Guardian V2',
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false, // 先不显示，等加载完成再显示
    titleBarStyle: 'hiddenInset',
  });

  // 加载页面
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // 窗口加载完成后再显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 窗口关闭时最小化到托盘
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin') {
      event.preventDefault();
      mainWindow?.hide();
    } else {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // 窗口关闭后清理
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * 创建系统托盘
 */
function createTray(): void {
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('AI Guardian V2');

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
      label: '状态: 运行中',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // 点击托盘图标显示窗口
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

/**
 * 连接到 Rust 后端
 */
function connectToRustBackend(): void {
  const RUST_PORT = 9876;
  
  rustSocket = new net.Socket();
  
  rustSocket.connect(RUST_PORT, '127.0.0.1', () => {
    console.log('Connected to Rust backend');
    mainWindow?.webContents.send('backend-status', { connected: true });
  });

  rustSocket.on('data', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      // 转发到渲染进程
      mainWindow?.webContents.send('backend-message', message);
    } catch (e) {
      console.error('Failed to parse message from Rust:', e);
    }
  });

  rustSocket.on('close', () => {
    console.log('Disconnected from Rust backend');
    mainWindow?.webContents.send('backend-status', { connected: false });
    
    // 尝试重连
    setTimeout(connectToRustBackend, 5000);
  });

  rustSocket.on('error', (err) => {
    console.error('Rust backend connection error:', err);
    mainWindow?.webContents.send('backend-status', { connected: false, error: err.message });
  });
}

/**
 * 发送消息到 Rust 后端
 */
function sendToRust(message: any): void {
  if (rustSocket && rustSocket.writable) {
    rustSocket.write(JSON.stringify(message) + '\n');
  }
}

// ==================== IPC Handlers ====================

// 获取系统信息
ipcMain.handle('get-system-info', async () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    electronVersion: process.versions.electron,
  };
});

// 获取后端状态
ipcMain.handle('get-backend-status', async () => {
  return {
    connected: rustSocket !== null && rustSocket.writable,
  };
});

// 发送命令到后端
ipcMain.handle('send-command', async (_, command: string, params?: any) => {
  sendToRust({ type: 'command', command, params });
  return { success: true };
});

// 打开文件对话框
ipcMain.handle('show-open-dialog', async (_, options: any) => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// 保存文件对话框
ipcMain.handle('show-save-dialog', async (_, options: any) => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

// 打开外部链接
ipcMain.handle('open-external', async (_, url: string) => {
  await shell.openExternal(url);
});

// 显示通知
ipcMain.handle('show-notification', async (_, title: string, body: string) => {
  if (tray) {
    tray.displayBalloon({
      iconType: 'info',
      title,
      content: body,
    });
  }
});

// ==================== App Lifecycle ====================

// 应用准备就绪
app.whenReady().then(() => {
  createMainWindow();
  createTray();
  connectToRustBackend();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// 所有窗口关闭
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 保持后台运行
  }
});

// 应用即将退出
app.on('before-quit', () => {
  // 关闭 Rust 后端连接
  if (rustSocket) {
    rustSocket.end();
    rustSocket = null;
  }
});

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // 用户尝试运行第二个实例时，聚焦到第一个实例的窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
