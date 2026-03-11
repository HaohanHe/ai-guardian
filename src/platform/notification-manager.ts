/**
 * 系统通知管理器 - Notification Manager
 *
 * 跨平台系统通知，支持 Windows、macOS、Linux
 * 用户可以在通知中直接放行或拦截
 */

import { EventEmitter } from 'events';

export interface NotificationAction {
  id: string;
  label: string;
  type: 'allow' | 'deny' | 'snooze' | 'details';
}

export interface GuardianNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical';
  command?: string;
  riskScore?: number;
  reason?: string;
  alternatives?: string[];
  actions: NotificationAction[];
  timestamp: number;
  timeout?: number;
}

export interface NotificationResponse {
  notificationId: string;
  action: string;
  timestamp: number;
}

export class NotificationManager extends EventEmitter {
  private notifications: Map<string, GuardianNotification> = new Map();
  private responses: Map<string, NotificationResponse> = new Map();
  private notificationId = 0;

  /**
   * 发送系统通知
   */
  async send(notification: Omit<GuardianNotification, 'id' | 'timestamp'>): Promise<string> {
    const id = `notif_${++this.notificationId}_${Date.now()}`;
    const fullNotification: GuardianNotification = {
      ...notification,
      id,
      timestamp: Date.now()
    };

    this.notifications.set(id, fullNotification);

    // 根据平台发送通知
    const platform = process.platform;
    if (platform === 'win32') {
      await this.sendWindowsNotification(fullNotification);
    } else if (platform === 'darwin') {
      await this.sendMacOSNotification(fullNotification);
    } else {
      await this.sendLinuxNotification(fullNotification);
    }

    // 触发事件
    this.emit('notification', fullNotification);

    return id;
  }

  /**
   * 发送拦截通知（包含详细信息和替代方案）
   */
  async sendInterception(
    command: string,
    riskScore: number,
    reason: string,
    alternatives: string[]
  ): Promise<string> {
    const riskLevel = riskScore >= 71 ? '高危' : riskScore >= 31 ? '中危' : '低危';
    const emoji = riskScore >= 71 ? '🚫' : riskScore >= 31 ? '⚠️' : '⚡';

    return this.send({
      title: `${emoji} AI Guardian 拦截了危险操作`,
      message: `命令: ${command.substring(0, 50)}${command.length > 50 ? '...' : ''}\n风险等级: ${riskLevel} (${riskScore}/100)`,
      type: riskScore >= 71 ? 'critical' : riskScore >= 31 ? 'warning' : 'info',
      command,
      riskScore,
      reason,
      alternatives,
      actions: [
        { id: 'deny', label: '🔒 拦截', type: 'deny' },
        { id: 'allow_once', label: '✅ 放行一次', type: 'allow' },
        { id: 'snooze', label: '⏰ 稍后决定', type: 'snooze' },
        { id: 'details', label: '🔍 查看详情', type: 'details' }
      ],
      timeout: 30000 // 30秒超时
    });
  }

  /**
   * 发送观察通知
   */
  async sendObservation(command: string, riskScore: number, notes: string): Promise<string> {
    return this.send({
      title: '👁️ AI Guardian 正在观察操作',
      message: `命令: ${command.substring(0, 50)}${command.length > 50 ? '...' : ''}`,
      type: 'info',
      command,
      riskScore,
      reason: notes,
      actions: [
        { id: 'ok', label: '👌 知道了', type: 'allow' },
        { id: 'stop', label: '🛑 停止执行', type: 'deny' }
      ],
      timeout: 10000
    });
  }

  /**
   * 发送急停通知
   */
  async sendEmergencyStop(reason: string): Promise<string> {
    return this.send({
      title: '🚨 急停按钮已触发',
      message: `所有 OpenClaw 操作已被暂停。原因: ${reason}`,
      type: 'critical',
      reason,
      actions: [
        { id: 'resume', label: '▶️ 恢复运行', type: 'allow' },
        { id: 'keep_stopped', label: '⏸️ 保持停止', type: 'deny' }
      ]
    });
  }

  /**
   * Windows 通知
   */
  private async sendWindowsNotification(notification: GuardianNotification): Promise<void> {
    // 使用 PowerShell 发送 Windows 通知
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const actions = notification.actions.map(a => a.label).join(', ');

    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      $notification = New-Object System.Windows.Forms.NotifyIcon
      $notification.Icon = [System.Drawing.SystemIcons]::Shield
      $notification.BalloonTipTitle = "${notification.title.replace(/"/g, '\"')}";
      $notification.BalloonTipText = "${notification.message.replace(/"/g, '\"')}\n\n操作: ${actions}";
      $notification.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::${notification.type === 'critical' ? 'Error' : notification.type === 'warning' ? 'Warning' : 'Info'};
      $notification.Visible = $true
      $notification.ShowBalloonTip(5000)
    `;

    try {
      await execAsync(psScript, { shell: 'powershell.exe' });
    } catch (error) {
      console.error('Windows 通知发送失败:', error);
    }
  }

  /**
   * macOS 通知
   */
  private async sendMacOSNotification(notification: GuardianNotification): Promise<void> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const actions = notification.actions.map(a => `-actions "${a.label}"`).join(' ');

    try {
      await execAsync(`osascript -e 'display notification "${notification.message}" with title "${notification.title}" ${actions}'`);
    } catch (error) {
      console.error('macOS 通知发送失败:', error);
    }
  }

  /**
   * Linux 通知
   */
  private async sendLinuxNotification(notification: GuardianNotification): Promise<void> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const urgency = notification.type === 'critical' ? 'critical' : notification.type === 'warning' ? 'normal' : 'low';
    const actions = notification.actions.map(a => `--action="${a.id}:${a.label}"`).join(' ');

    try {
      await execAsync(`notify-send "${notification.title}" "${notification.message}" --urgency=${urgency} ${actions} --expire-time=${notification.timeout || 0}`);
    } catch (error) {
      console.error('Linux 通知发送失败:', error);
    }
  }

  /**
   * 处理用户响应
   */
  handleResponse(notificationId: string, action: string): void {
    const response: NotificationResponse = {
      notificationId,
      action,
      timestamp: Date.now()
    };

    this.responses.set(notificationId, response);
    this.emit('response', response);

    // 清理通知
    this.notifications.delete(notificationId);
  }

  /**
   * 等待用户响应
   */
  async waitForResponse(notificationId: string, timeout = 30000): Promise<NotificationResponse | null> {
    return new Promise((resolve) => {
      // 检查是否已有响应
      const existing = this.responses.get(notificationId);
      if (existing) {
        resolve(existing);
        return;
      }

      // 设置超时
      const timer = setTimeout(() => {
        this.off('response', handler);
        resolve(null);
      }, timeout);

      // 监听响应
      const handler = (response: NotificationResponse) => {
        if (response.notificationId === notificationId) {
          clearTimeout(timer);
          this.off('response', handler);
          resolve(response);
        }
      };

      this.on('response', handler);
    });
  }

  /**
   * 获取通知历史
   */
  getNotificationHistory(): GuardianNotification[] {
    return Array.from(this.notifications.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 清除过期通知
   */
  clearExpiredNotifications(): void {
    const now = Date.now();
    for (const [id, notification] of this.notifications) {
      if (notification.timeout && now - notification.timestamp > notification.timeout) {
        this.notifications.delete(id);
      }
    }
  }
}

// 导出单例
export const notificationManager = new NotificationManager();
