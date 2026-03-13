/**
 * Electron Preload Script
 * 安全地暴露 API 给渲染进程
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';

// 类型定义
export interface Config {
  general: {
    autoStart: boolean;
    minimizeToTray: boolean;
    checkUpdates: boolean;
    language: 'zh-CN' | 'en-US';
    theme: 'light' | 'dark' | 'system';
  };
  security: {
    blockFileDelete: boolean;
    blockSystemPathWrite: boolean;
    blockNetworkConnection: boolean;
    blockRegistryModify: boolean;
    blockProcessCreate: boolean;
    riskThreshold: number;
    autoBlock: boolean;
    whitelistMode: boolean;
  };
  ai: {
    enabledTerminals: string[];
    autoDetect: boolean;
    scanInterval: number;
  };
  llm: {
    provider: string;
    model: string;
    apiKey?: string;
    baseUrl?: string;
    timeout: number;
    maxRetries: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    maxFileSize: number;
    maxFiles: number;
    logPath: string;
  };
  notification: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
    email?: string;
  };
}

export interface AITerminal {
  pid: number;
  name: string;
  path: string;
  commandLine: string;
  startTime: number;
  isTracked: boolean;
  riskScore: number;
  lastActivity: number;
}

export interface AuditLog {
  id: string;
  timestamp: number;
  operation: string;
  processId: number;
  processName: string;
  target: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  action: 'allowed' | 'blocked' | 'warning';
  details: Record<string, unknown>;
}

export interface Stats {
  totalEvents: number;
  blockedEvents: number;
  allowedEvents: number;
  warnings: number;
  aiTerminalsCount: number;
  averageRiskScore: number;
  uptime: number;
  eventsByType: Record<string, number>;
  eventsByHour: number[];
  topProcesses: { name: string; count: number }[];
}

export interface DriverStatus {
  installed: boolean;
  loaded: boolean;
  version?: string;
  signingStatus: 'signed' | 'test-signed' | 'unsigned';
  testModeEnabled: boolean;
  error?: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  models: string[];
  configured: boolean;
  healthy?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: { field: string; message: string }[];
  warnings: { field: string; message: string }[];
}

export interface NotificationData {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  body: string;
  timestamp: number;
}

export interface BackendEvent {
  type: string;
  data: unknown;
  timestamp: number;
}

export interface SecurityAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  processName: string;
  processId: number;
  timestamp: number;
  action: string;
  recommendation: string;
}

export interface FileSelectOptions {
  title?: string;
  filters?: { name: string; extensions: string[] }[];
  multiSelections?: boolean;
}

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes?: string;
  releaseDate?: string;
}

export interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
  source?: string;
}

// 错误处理包装器
async function wrapWithErrorHandler<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error(`API call failed:`, error);
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
          throw new Error('网络连接失败，请检查网络设置');
        }
        if (error.message.includes('timeout')) {
          throw new Error('操作超时，请稍后重试');
        }
        if (error.message.includes('permission') || error.message.includes('EACCES')) {
          throw new Error('权限不足，请以管理员身份运行');
        }
        if (error.message.includes('backend') || error.message.includes('connection')) {
          throw new Error('后端服务未启动，请先启动服务');
        }
      }
      throw error;
    }
  }) as T;
}

// 创建 API 对象
const electronAPI = {
  // 系统信息
  getSystemInfo: wrapWithErrorHandler(() => ipcRenderer.invoke('get-system-info')),
  getAppVersion: wrapWithErrorHandler(() => ipcRenderer.invoke('get-app-version')),
  
  // 后端状态
  getBackendStatus: wrapWithErrorHandler(() => ipcRenderer.invoke('get-backend-status')),
  startBackend: wrapWithErrorHandler(() => ipcRenderer.invoke('start-backend')),
  stopBackend: wrapWithErrorHandler(() => ipcRenderer.invoke('stop-backend')),
  restartBackend: wrapWithErrorHandler(() => ipcRenderer.invoke('restart-backend')),
  
  // 配置管理
  getConfig: wrapWithErrorHandler(() => ipcRenderer.invoke('get-config')),
  updateConfig: wrapWithErrorHandler((config: Partial<Config>) => ipcRenderer.invoke('update-config', config)),
  resetConfig: wrapWithErrorHandler(() => ipcRenderer.invoke('reset-config')),
  validateConfig: wrapWithErrorHandler((config: Config) => ipcRenderer.invoke('validate-config', config)),
  
  // AI 终端管理
  getAITerminals: wrapWithErrorHandler(() => ipcRenderer.invoke('get-ai-terminals')),
  addAITerminal: wrapWithErrorHandler((terminal: Partial<AITerminal>) => ipcRenderer.invoke('add-ai-terminal', terminal)),
  removeAITerminal: wrapWithErrorHandler((pid: number) => ipcRenderer.invoke('remove-ai-terminal', pid)),
  refreshAITerminals: wrapWithErrorHandler(() => ipcRenderer.invoke('refresh-ai-terminals')),
  
  // 审计日志
  getAuditLogs: wrapWithErrorHandler((params: object) => ipcRenderer.invoke('get-audit-logs', params)),
  exportAuditLogs: wrapWithErrorHandler((format: string) => ipcRenderer.invoke('export-audit-logs', format)),
  clearAuditLogs: wrapWithErrorHandler(() => ipcRenderer.invoke('clear-audit-logs')),
  
  // 统计信息
  getStats: wrapWithErrorHandler(() => ipcRenderer.invoke('get-stats')),
  getRealtimeStats: (callback: (stats: Stats) => void) => {
    const handler = (_event: IpcRendererEvent, stats: Stats) => callback(stats);
    ipcRenderer.on('realtime-stats', handler);
    return () => ipcRenderer.removeListener('realtime-stats', handler);
  },
  
  // 驱动管理
  getDriverStatus: wrapWithErrorHandler(() => ipcRenderer.invoke('get-driver-status')),
  installDriver: wrapWithErrorHandler(() => ipcRenderer.invoke('install-driver')),
  uninstallDriver: wrapWithErrorHandler(() => ipcRenderer.invoke('uninstall-driver')),
  
  // LLM 配置
  getLLMProviders: wrapWithErrorHandler(() => ipcRenderer.invoke('get-llm-providers')),
  testLLMConnection: wrapWithErrorHandler((provider: string) => ipcRenderer.invoke('test-llm-connection', provider)),
  
  // 通知
  showNotification: wrapWithErrorHandler((data: NotificationData) => ipcRenderer.invoke('show-notification', data)),
  
  // 事件监听
  onBackendEvent: (callback: (event: BackendEvent) => void) => {
    const handler = (_event: IpcRendererEvent, event: BackendEvent) => callback(event);
    ipcRenderer.on('backend-event', handler);
    return () => ipcRenderer.removeListener('backend-event', handler);
  },
  onSecurityAlert: (callback: (alert: SecurityAlert) => void) => {
    const handler = (_event: IpcRendererEvent, alert: SecurityAlert) => callback(alert);
    ipcRenderer.on('security-alert', handler);
    return () => ipcRenderer.removeListener('security-alert', handler);
  },
  
  // 文件操作
  selectFile: wrapWithErrorHandler((options: FileSelectOptions) => ipcRenderer.invoke('select-file', options)),
  selectDirectory: wrapWithErrorHandler(() => ipcRenderer.invoke('select-directory')),
  
  // 更新
  checkForUpdates: wrapWithErrorHandler(() => ipcRenderer.invoke('check-for-updates')),
  downloadUpdate: wrapWithErrorHandler(() => ipcRenderer.invoke('download-update')),
  installUpdate: wrapWithErrorHandler(() => ipcRenderer.invoke('install-update')),
  
  // 日志
  getLogs: wrapWithErrorHandler((limit?: number) => ipcRenderer.invoke('get-logs', limit)),
  clearLogs: wrapWithErrorHandler(() => ipcRenderer.invoke('clear-logs')),
  
  // 窗口控制
  minimize: wrapWithErrorHandler(() => ipcRenderer.invoke('window-minimize')),
  maximize: wrapWithErrorHandler(() => ipcRenderer.invoke('window-maximize')),
  close: wrapWithErrorHandler(() => ipcRenderer.invoke('window-close')),
  
  // 系统托盘
  setTrayIcon: wrapWithErrorHandler((iconPath: string) => ipcRenderer.invoke('set-tray-icon', iconPath)),
  showTrayNotification: wrapWithErrorHandler((title: string, body: string) => 
    ipcRenderer.invoke('show-tray-notification', title, body)),
  
  // 开机自启
  enableAutoStart: wrapWithErrorHandler(() => ipcRenderer.invoke('enable-auto-start')),
  disableAutoStart: wrapWithErrorHandler(() => ipcRenderer.invoke('disable-auto-start')),
  isAutoStartEnabled: wrapWithErrorHandler(() => ipcRenderer.invoke('is-auto-start-enabled')),
  
  // 调试
  openDevTools: wrapWithErrorHandler(() => ipcRenderer.invoke('open-dev-tools')),
  reload: wrapWithErrorHandler(() => ipcRenderer.invoke('reload')),
  
  // 外部链接
  openExternal: wrapWithErrorHandler((url: string) => ipcRenderer.invoke('open-external', url)),
};

// 暴露 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// 类型声明
export type { ElectronAPI } from './preload';
