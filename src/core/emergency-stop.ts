/**
 * 急停按钮 - Emergency Stop
 *
 * 防呆设计的急停机制，瞬间刹停所有 OpenClaw 操作
 * 参考工业安全标准，防止误触
 */

import { EventEmitter } from 'events';

export interface EmergencyStopState {
  isActive: boolean;
  triggeredAt?: number;
  reason?: string;
  triggeredBy?: string;
  confirmationRequired: boolean;
}

export interface EmergencyStopHistory {
  timestamp: number;
  reason: string;
  triggeredBy: string;
  resumedAt?: number;
  duration?: number;
}

/**
 * 急停管理器
 */
export class EmergencyStopManager extends EventEmitter {
  private state: EmergencyStopState = {
    isActive: false,
    confirmationRequired: true
  };
  private history: EmergencyStopHistory[] = [];
  private confirmationWindow = 3000; // 3秒内需要二次确认
  private lastTriggerAttempt = 0;
  private pendingConfirmation = false;

  /**
   * 触发急停（带防呆设计）
   *
   * 防呆机制：
   * 1. 首次按下：进入待确认状态，3秒内需要再次按下
   * 2. 二次确认：真正触发急停
   * 3. 超时：自动取消待确认状态
   */
  async trigger(reason: string, triggeredBy = 'user'): Promise<boolean> {
    const now = Date.now();

    // 如果已经在急停状态，直接返回
    if (this.state.isActive) {
      console.log('⚠️ 急停已经处于激活状态');
      return false;
    }

    // 检查是否需要二次确认
    if (this.state.confirmationRequired) {
      if (this.pendingConfirmation && now - this.lastTriggerAttempt < this.confirmationWindow) {
        // 二次确认，真正触发急停
        return this.activateEmergencyStop(reason, triggeredBy);
      } else {
        // 首次按下，进入待确认状态
        this.pendingConfirmation = true;
        this.lastTriggerAttempt = now;

        console.log('🚨 急停待确认...');
        console.log(`   请在 ${this.confirmationWindow / 1000} 秒内再次触发以确认`);

        this.emit('confirmation-required', {
          message: '急停待确认，请再次触发',
          timeout: this.confirmationWindow
        });

        // 设置超时自动取消
        setTimeout(() => {
          if (this.pendingConfirmation && !this.state.isActive) {
            this.pendingConfirmation = false;
            console.log('⏱️ 急停确认超时，已自动取消');
            this.emit('confirmation-cancelled');
          }
        }, this.confirmationWindow);

        return false;
      }
    } else {
      // 不需要二次确认，直接触发
      return this.activateEmergencyStop(reason, triggeredBy);
    }
  }

  /**
   * 激活急停
   */
  private activateEmergencyStop(reason: string, triggeredBy: string): boolean {
    this.state = {
      isActive: true,
      triggeredAt: Date.now(),
      reason,
      triggeredBy,
      confirmationRequired: this.state.confirmationRequired
    };

    this.pendingConfirmation = false;

    // 记录历史
    this.history.push({
      timestamp: Date.now(),
      reason,
      triggeredBy
    });

    console.log('🛑🛑🛑 急停已激活！所有操作已暂停 🛑🛑🛑');
    console.log(`   原因: ${reason}`);
    console.log(`   触发者: ${triggeredBy}`);
    console.log(`   时间: ${new Date().toLocaleString()}`);

    this.emit('activated', this.state);

    return true;
  }

  /**
   * 恢复运行
   */
  resume(resumedBy = 'user'): boolean {
    if (!this.state.isActive) {
      console.log('⚠️ 急停未激活，无需恢复');
      return false;
    }

    const duration = Date.now() - (this.state.triggeredAt || 0);

    // 更新最后一条历史记录
    const lastHistory = this.history[this.history.length - 1];
    if (lastHistory && !lastHistory.resumedAt) {
      lastHistory.resumedAt = Date.now();
      lastHistory.duration = duration;
    }

    console.log('▶️ 急停已解除，恢复正常运行');
    console.log(`   持续时间: ${(duration / 1000).toFixed(1)} 秒`);
    console.log(`   恢复者: ${resumedBy}`);

    this.state = {
      isActive: false,
      confirmationRequired: this.state.confirmationRequired
    };

    this.emit('resumed', { duration, resumedBy });

    return true;
  }

  /**
   * 设置是否需要二次确认
   */
  setConfirmationRequired(required: boolean): void {
    this.state.confirmationRequired = required;
    console.log(`🔧 急停二次确认: ${required ? '已启用' : '已禁用'}`);
  }

  /**
   * 获取当前状态
   */
  getState(): EmergencyStopState {
    return { ...this.state };
  }

  /**
   * 检查是否处于急停状态
   */
  isEmergencyStopped(): boolean {
    return this.state.isActive;
  }

  /**
   * 获取历史记录
   */
  getHistory(limit = 10): EmergencyStopHistory[] {
    return this.history
      .slice(-limit)
      .reverse();
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalTriggers: number;
    lastTrigger?: number;
    averageDuration: number;
  } {
    const completed = this.history.filter(h => h.duration !== undefined);
    const avgDuration = completed.length > 0
      ? completed.reduce((sum, h) => sum + (h.duration || 0), 0) / completed.length
      : 0;

    return {
      totalTriggers: this.history.length,
      lastTrigger: this.history[this.history.length - 1]?.timestamp,
      averageDuration: avgDuration
    };
  }

  /**
   * 重置所有状态（谨慎使用）
   */
  reset(): void {
    this.state = {
      isActive: false,
      confirmationRequired: true
    };
    this.pendingConfirmation = false;
    this.history = [];
    console.log('🔄 急停管理器已重置');
  }
}

// 导出单例
export const emergencyStop = new EmergencyStopManager();
