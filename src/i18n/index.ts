/**
 * Internationalization (i18n) Module
 * 
 * Supports: English (default), Chinese, Japanese
 */

export type Language = 'en' | 'zh' | 'ja';

export interface Translations {
  [key: string]: string | Translations;
}

const translations: Record<Language, Translations> = {
  en: {
    // Common
    appName: 'AI Guardian',
    appDescription: 'AI Agent Digital Twin Defense System',
    version: 'Version',
    
    // Risk levels
    riskCritical: 'CRITICAL',
    riskHigh: 'HIGH',
    riskMedium: 'MEDIUM',
    riskLow: 'LOW',
    riskSafe: 'SAFE',
    
    // Actions
    actionAllow: 'Allow',
    actionDeny: 'Deny',
    actionObserve: 'Observe',
    actionApprove: 'Approve',
    actionReject: 'Reject',
    actionDetails: 'Details',
    actionSnooze: 'Snooze',
    
    // Notifications
    notificationIntercepted: 'Operation Intercepted',
    notificationObserving: 'Observing Operation',
    notificationEmergencyStop: 'Emergency Stop Activated',
    notificationReason: 'Reason',
    notificationAlternatives: 'Alternatives',
    
    // Emergency stop
    emergencyStopTriggered: 'Emergency stop triggered',
    emergencyStopConfirmed: 'Emergency stop confirmed',
    emergencyStopCancelled: 'Emergency stop cancelled',
    emergencyStopResumed: 'System resumed',
    emergencyStopConfirmRequired: 'Confirmation required: trigger again within 3 seconds',
    
    // Errors
    errorUnknown: 'Unknown error',
    errorInvalidCommand: 'Invalid command',
    errorUnauthorized: 'Unauthorized access',
    errorNotFound: 'Resource not found',
    
    // Status
    statusRunning: 'Running',
    statusStopped: 'Stopped',
    statusPending: 'Pending',
    statusCompleted: 'Completed',
    
    // Web API
    apiServerStarted: 'Web API server started',
    apiServerStopped: 'Web API server stopped',
    apiNewRequest: 'New request received',
    apiRequestApproved: 'Request approved',
    apiRequestDenied: 'Request denied',
    
    // Environment
    envDetected: 'Environment detected',
    envAdminWarning: 'Running as administrator',
    envProductionWarning: 'Production environment detected',
    envOpenClawWarning: 'OpenClaw detected',
    envDockerWarning: 'Docker environment detected',
    
    // Skill supply chain
    skillAnalysis: 'Skill Supply Chain Analysis',
    skillDangerousPattern: 'Dangerous pattern detected in Skill',
    skillExcessivePermission: 'Excessive permissions declared',
    skillCodeRisk: 'Risk detected in Skill code',
    
    // MCP
    mcpInjectionDetected: 'MCP injection detected',
    mcpInvalidConfig: 'Invalid MCP configuration',
    mcpUnauthorizedCommand: 'Unauthorized MCP server command',
    
    // Prompt injection
    promptInjectionDetected: 'Prompt injection detected',
    promptMaliciousPattern: 'Malicious pattern in input',
    promptDelimiterEscape: 'Delimiter escape detected',
  },
  
  zh: {
    // Common
    appName: 'AI Guardian',
    appDescription: 'AI Agent 数字孪生防御系统',
    version: '版本',
    
    // Risk levels
    riskCritical: '严重',
    riskHigh: '高危',
    riskMedium: '中危',
    riskLow: '低危',
    riskSafe: '安全',
    
    // Actions
    actionAllow: '放行',
    actionDeny: '拦截',
    actionObserve: '观察',
    actionApprove: '批准',
    actionReject: '拒绝',
    actionDetails: '详情',
    actionSnooze: '稍后',
    
    // Notifications
    notificationIntercepted: '操作已拦截',
    notificationObserving: '正在观察操作',
    notificationEmergencyStop: '急停已激活',
    notificationReason: '原因',
    notificationAlternatives: '替代方案',
    
    // Emergency stop
    emergencyStopTriggered: '急停已触发',
    emergencyStopConfirmed: '急停已确认',
    emergencyStopCancelled: '急停已取消',
    emergencyStopResumed: '系统已恢复',
    emergencyStopConfirmRequired: '需要确认：请在3秒内再次触发',
    
    // Errors
    errorUnknown: '未知错误',
    errorInvalidCommand: '无效命令',
    errorUnauthorized: '未授权访问',
    errorNotFound: '资源不存在',
    
    // Status
    statusRunning: '运行中',
    statusStopped: '已停止',
    statusPending: '待处理',
    statusCompleted: '已完成',
    
    // Web API
    apiServerStarted: 'Web API 服务器已启动',
    apiServerStopped: 'Web API 服务器已停止',
    apiNewRequest: '收到新请求',
    apiRequestApproved: '请求已批准',
    apiRequestDenied: '请求已拒绝',
    
    // Environment
    envDetected: '环境已检测',
    envAdminWarning: '以管理员身份运行',
    envProductionWarning: '检测到生产环境',
    envOpenClawWarning: '检测到 OpenClaw',
    envDockerWarning: '检测到 Docker 环境',
    
    // Skill supply chain
    skillAnalysis: 'Skill 供应链分析',
    skillDangerousPattern: 'Skill 中检测到危险模式',
    skillExcessivePermission: '声明了过度权限',
    skillCodeRisk: 'Skill 代码中存在风险',
    
    // MCP
    mcpInjectionDetected: '检测到 MCP 注入',
    mcpInvalidConfig: 'MCP 配置无效',
    mcpUnauthorizedCommand: '未授权的 MCP 服务器命令',
    
    // Prompt injection
    promptInjectionDetected: '检测到 Prompt 注入',
    promptMaliciousPattern: '输入中存在恶意模式',
    promptDelimiterEscape: '检测到分隔符逃逸',
  },
  
  ja: {
    // Common
    appName: 'AI Guardian',
    appDescription: 'AI Agent デジタルツイン防御システム',
    version: 'バージョン',
    
    // Risk levels
    riskCritical: '重大',
    riskHigh: '高リスク',
    riskMedium: '中リスク',
    riskLow: '低リスク',
    riskSafe: '安全',
    
    // Actions
    actionAllow: '許可',
    actionDeny: '拒否',
    actionObserve: '監視',
    actionApprove: '承認',
    actionReject: '却下',
    actionDetails: '詳細',
    actionSnooze: '後で',
    
    // Notifications
    notificationIntercepted: '操作を攔截しました',
    notificationObserving: '操作を監視中',
    notificationEmergencyStop: '緊急停止が有効化されました',
    notificationReason: '理由',
    notificationAlternatives: '代替案',
    
    // Emergency stop
    emergencyStopTriggered: '緊急停止がトリガーされました',
    emergencyStopConfirmed: '緊急停止が確認されました',
    emergencyStopCancelled: '緊急停止がキャンセルされました',
    emergencyStopResumed: 'システムが再開しました',
    emergencyStopConfirmRequired: '確認が必要：3秒以内に再度トリガーしてください',
    
    // Errors
    errorUnknown: '不明なエラー',
    errorInvalidCommand: '無効なコマンド',
    errorUnauthorized: '未承認のアクセス',
    errorNotFound: 'リソースが見つかりません',
    
    // Status
    statusRunning: '実行中',
    statusStopped: '停止',
    statusPending: '保留中',
    statusCompleted: '完了',
    
    // Web API
    apiServerStarted: 'Web API サーバーが開始されました',
    apiServerStopped: 'Web API サーバーが停止しました',
    apiNewRequest: '新しいリクエストを受信',
    apiRequestApproved: 'リクエストが承認されました',
    apiRequestDenied: 'リクエストが拒否されました',
    
    // Environment
    envDetected: '環境を検出',
    envAdminWarning: '管理者として実行中',
    envProductionWarning: '本番環境を検出',
    envOpenClawWarning: 'OpenClaw を検出',
    envDockerWarning: 'Docker 環境を検出',
    
    // Skill supply chain
    skillAnalysis: 'Skill サプライチェーン分析',
    skillDangerousPattern: 'Skill で危険なパターンを検出',
    skillExcessivePermission: '過度な権限が宣言されています',
    skillCodeRisk: 'Skill コードにリスクがあります',
    
    // MCP
    mcpInjectionDetected: 'MCP インジェクションを検出',
    mcpInvalidConfig: '無効な MCP 設定',
    mcpUnauthorizedCommand: '未承認の MCP サーバーコマンド',
    
    // Prompt injection
    promptInjectionDetected: 'プロンプトインジェクションを検出',
    promptMaliciousPattern: '入力に悪意のあるパターン',
    promptDelimiterEscape: 'デリミタエスケープを検出',
  }
};

class I18n {
  private currentLang: Language = 'en';
  
  setLanguage(lang: Language): void {
    this.currentLang = lang;
  }
  
  getLanguage(): Language {
    return this.currentLang;
  }
  
  t(key: string): string {
    const keys = key.split('.');
    let value: unknown = translations[this.currentLang];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Translations)[k];
      } else {
        // Fallback to English
        value = translations['en'];
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = (value as Translations)[fallbackKey];
          } else {
            return key;
          }
        }
        return typeof value === 'string' ? value : key;
      }
    }
    
    return typeof value === 'string' ? value : key;
  }
  
  // Format string with placeholders
  format(key: string, ...args: string[]): string {
    let str = this.t(key);
    args.forEach((arg, index) => {
      str = str.replace(`{${index}}`, arg);
    });
    return str;
  }
}

export const i18n = new I18n();

// Helper function for quick translation
export function t(key: string): string {
  return i18n.t(key);
}

export function format(key: string, ...args: string[]): string {
  return i18n.format(key, ...args);
}
