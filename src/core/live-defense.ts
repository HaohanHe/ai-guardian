/**
 * 实时防御编排层（Live Defense）
 *
 * 把 Linux 进程监控、信号执行后端和急停状态机串成一条实时流水线：
 *
 *   /proc 扫描 → agent 识别 → 事件入环 → 急停联动 / 人工处置 → 事件广播
 *
 * 让原本只是逻辑状态的「急停」在 Linux 上变成真实的 SIGSTOP/SIGKILL。
 */

import { EventEmitter } from 'events';
import {
  LinuxProcessMonitor,
  type ProcessMonitorOptions,
  type TrackedProcess,
} from '../platform/linux-process-monitor.js';
import {
  LinuxEnforcer,
  type EnforcementRecord,
  type LinuxEnforcerOptions,
} from '../platform/linux-enforcer.js';
import { EmergencyStopManager } from './emergency-stop.js';

export type LiveEventLevel = 'info' | 'warning' | 'critical';

export interface LiveEvent {
  id: number;
  timestamp: number;
  level: LiveEventLevel;
  type: string;
  message: string;
  data?: unknown;
}

export interface LiveDefenseOptions {
  monitor?: ProcessMonitorOptions;
  enforcer?: LinuxEnforcerOptions;
  emergencyStop?: EmergencyStopManager;
  /** 事件环容量（默认 500） */
  eventBufferSize?: number;
  /** 急停激活时是否自动暂停全部 agent（默认 true） */
  autoSuspendOnEmergencyStop?: boolean;
}

export interface LiveSnapshot {
  running: boolean;
  emergencyStopActive: boolean;
  processes: TrackedProcess[];
  agents: TrackedProcess[];
  recentEvents: LiveEvent[];
  enforcement: EnforcementRecord[];
  stats: {
    totalProcesses: number;
    totalAgents: number;
    stoppedAgents: number;
    totalEnforcements: number;
  };
}

export class LiveDefense extends EventEmitter {
  readonly monitor: LinuxProcessMonitor;
  readonly enforcer: LinuxEnforcer;
  readonly emergencyStop: EmergencyStopManager;

  private running = false;
  private events: LiveEvent[] = [];
  private seq = 0;
  private readonly bufferSize: number;
  private readonly autoSuspend: boolean;

  constructor(options: LiveDefenseOptions = {}) {
    super();
    this.monitor = new LinuxProcessMonitor(options.monitor);
    this.enforcer = new LinuxEnforcer(this.monitor, options.enforcer);
    this.emergencyStop = options.emergencyStop ?? new EmergencyStopManager();
    this.bufferSize = options.eventBufferSize ?? 500;
    this.autoSuspend = options.autoSuspendOnEmergencyStop ?? true;
    this.wireEvents();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.monitor.start();
    this.pushEvent('info', 'defense:start', '实时防御已启动');
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.monitor.stop();
    this.pushEvent('info', 'defense:stop', '实时防御已停止');
  }

  isRunning(): boolean {
    return this.running;
  }

  /* ---------------- 人工处置（转发给执行后端） ---------------- */

  suspendPid(pid: number, reason = 'manual suspend', by = 'user') {
    return this.enforcer.suspend(pid, reason, by);
  }

  resumePid(pid: number, reason = 'manual resume', by = 'user') {
    return this.enforcer.resume(pid, reason, by);
  }

  terminatePid(pid: number, reason = 'manual terminate', by = 'user') {
    return this.enforcer.terminate(pid, reason, by);
  }

  getEvents(limit = 100): LiveEvent[] {
    return this.events.slice(-limit).reverse();
  }

  snapshot(): LiveSnapshot {
    const agents = this.monitor.getAgentProcesses();
    return {
      running: this.running,
      emergencyStopActive: this.emergencyStop.isEmergencyStopped(),
      processes: this.monitor.getProcesses(),
      agents,
      recentEvents: this.getEvents(50),
      enforcement: this.enforcer.getHistory(20),
      stats: {
        totalProcesses: this.monitor.getProcesses().length,
        totalAgents: agents.length,
        stoppedAgents: agents.filter(a => a.state === 'stopped').length,
        totalEnforcements: this.enforcer.getHistory(1000).length,
      },
    };
  }

  /* ---------------- 事件接线 ---------------- */

  private wireEvents(): void {
    this.monitor.on('process:new', (p: TrackedProcess) => {
      const level = p.agent ? 'warning' : 'info';
      this.pushEvent(
        level,
        'process:new',
        p.agent
          ? `发现 AI Agent：${p.agent}（pid ${p.pid}，${p.matchReason}）`
          : `新进程：${p.comm}（pid ${p.pid}）`,
        p,
      );
    });

    this.monitor.on('process:exit', ({ pid, agent }) => {
      this.pushEvent('info', 'process:exit', `进程退出：pid ${pid}${agent ? `（${agent}）` : ''}`, {
        pid,
        agent,
      });
    });

    this.monitor.on('process:state', (p: TrackedProcess) => {
      this.pushEvent(
        p.state === 'stopped' ? 'warning' : 'info',
        'process:state',
        `pid ${p.pid} 状态变为 ${p.state}`,
        p,
      );
    });

    this.enforcer.on('enforce', (record: EnforcementRecord) => {
      this.pushEvent(
        record.action === 'terminate' ? 'critical' : 'warning',
        'enforce',
        `${record.action} pid ${record.rootPid}：${record.reason}（${record.success ? '成功' : '部分失败'}）`,
        record,
      );
    });

    // 急停 → 真实信号联动
    this.emergencyStop.on('activated', async state => {
      this.pushEvent('critical', 'estop:activated', `急停激活：${state.reason}`);
      if (this.autoSuspend) {
        const records = await this.enforcer.suspendAll(`emergency stop: ${state.reason}`);
        if (records.length === 0) {
          this.pushEvent('info', 'estop:no-agents', '急停时未发现运行中的 agent');
        }
      }
    });

    this.emergencyStop.on('resumed', () => {
      this.pushEvent('info', 'estop:resumed', '急停已解除（agent 保持暂停，需手动恢复）');
    });
  }

  private pushEvent(
    level: LiveEventLevel,
    type: string,
    message: string,
    data?: unknown,
  ): LiveEvent {
    const event: LiveEvent = { id: ++this.seq, timestamp: Date.now(), level, type, message, data };
    this.events.push(event);
    if (this.events.length > this.bufferSize) {
      this.events = this.events.slice(-this.bufferSize);
    }
    this.emit('event', event);
    return event;
  }
}
