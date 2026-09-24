/**
 * Linux 用户态执行后端
 *
 * 用 POSIX 信号对被监控的 Agent 进程做处置：
 *   suspend  SIGSTOP  暂停（进程仍在，状态 T）
 *   resume   SIGCONT  恢复
 *   terminate SIGTERM，宽限期后 SIGKILL
 *
 * 默认按「进程树」处置：Agent fork/spawn 出的子进程一起处理，
 * 避免只杀外层、子进程继续跑。
 *
 * 这是不依赖内核模块的可移植方案；eBPF/fanotify 是后续的高性能强制路径。
 */

import { EventEmitter } from 'events';
import type { LinuxProcessMonitor } from './linux-process-monitor.js';

export type EnforcerAction = 'suspend' | 'resume' | 'terminate';

export interface SignalResult {
  pid: number;
  signal: 'SIGSTOP' | 'SIGCONT' | 'SIGTERM' | 'SIGKILL';
  ok: boolean;
  /** ESRCH：进程已经不在，视为成功 */
  alreadyGone: boolean;
  error?: string;
}

export interface EnforcementRecord {
  id: number;
  timestamp: number;
  action: EnforcerAction;
  rootPid: number;
  reason: string;
  triggeredBy: string;
  signals: SignalResult[];
  success: boolean;
}

export interface LinuxEnforcerOptions {
  /** terminate 时 SIGTERM 到 SIGKILL 的宽限毫秒数 */
  terminateGraceMs?: number;
  /** 可注入的发信号函数，便于测试 */
  signalFn?: (pid: number, signal: NodeJS.Signals) => void;
  sleepFn?: (ms: number) => Promise<void>;
}

export class LinuxEnforcer extends EventEmitter {
  private readonly graceMs: number;
  private readonly signalFn: (pid: number, signal: NodeJS.Signals) => void;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private seq = 0;
  private history: EnforcementRecord[] = [];

  constructor(
    private monitor: LinuxProcessMonitor,
    options: LinuxEnforcerOptions = {},
  ) {
    super();
    this.graceMs = options.terminateGraceMs ?? 3000;
    this.signalFn = options.signalFn ?? ((pid, sig) => process.kill(pid, sig));
    this.sleepFn =
      options.sleepFn ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
  }

  /** 暂停一个 agent（含后代） */
  async suspend(pid: number, reason: string, triggeredBy = 'user'): Promise<EnforcementRecord> {
    return this.run('suspend', pid, reason, triggeredBy, async targets => {
      return targets.map(t => this.sendSignal(t, 'SIGSTOP'));
    });
  }

  /** 恢复一个 agent（含后代） */
  async resume(pid: number, reason: string, triggeredBy = 'user'): Promise<EnforcementRecord> {
    return this.run('resume', pid, reason, triggeredBy, async targets => {
      return targets.map(t => this.sendSignal(t, 'SIGCONT'));
    });
  }

  /** 终止一个 agent（含后代）：SIGCONT → SIGTERM → 宽限 → SIGKILL */
  async terminate(pid: number, reason: string, triggeredBy = 'user'): Promise<EnforcementRecord> {
    return this.run('terminate', pid, reason, triggeredBy, async targets => {
      const results: SignalResult[] = [];
      // 被暂停的进程在 SIGCONT 前不会处理 SIGTERM，先恢复再终止
      for (const t of targets) results.push(this.sendSignal(t, 'SIGCONT'));
      for (const t of targets) results.push(this.sendSignal(t, 'SIGTERM'));
      if (targets.length > 0) await this.sleepFn(this.graceMs);
      // 宽限后仍在的，补 SIGKILL
      for (const t of targets) {
        if (this.isAlive(t)) results.push(this.sendSignal(t, 'SIGKILL'));
      }
      return results;
    });
  }

  /** 暂停当前全部 agent；返回每条处置记录 */
  async suspendAll(reason: string, triggeredBy = 'emergency-stop'): Promise<EnforcementRecord[]> {
    const roots = this.monitor.getAgentProcesses();
    const rootsOnly = roots.filter(p => !roots.some(q => q.pid === p.ppid));
    return Promise.all(rootsOnly.map(p => this.suspend(p.pid, reason, triggeredBy)));
  }

  /** 恢复当前全部被暂停的 agent */
  async resumeAll(reason: string, triggeredBy = 'user'): Promise<EnforcementRecord[]> {
    const stopped = this.monitor.getAgentProcesses().filter(p => p.state === 'stopped');
    return Promise.all(stopped.map(p => this.resume(p.pid, reason, triggeredBy)));
  }

  getHistory(limit = 50): EnforcementRecord[] {
    return this.history.slice(-limit).reverse();
  }

  /* ---------------- 内部 ---------------- */

  private async run(
    action: EnforcerAction,
    rootPid: number,
    reason: string,
    triggeredBy: string,
    execute: (targets: number[]) => Promise<SignalResult[]>,
  ): Promise<EnforcementRecord> {
    const targets = this.collectTree(rootPid);
    const signals = await execute(targets);
    const record: EnforcementRecord = {
      id: ++this.seq,
      timestamp: Date.now(),
      action,
      rootPid,
      reason,
      triggeredBy,
      signals,
      success: signals.every(s => s.ok),
    };
    this.history.push(record);
    this.emit('enforce', record);
    return record;
  }

  /** 收集 root + 全部后代 pid；root 不在快照里时只处理自身 */
  private collectTree(rootPid: number): number[] {
    const root = this.monitor.getProcess(rootPid);
    if (!root) return [rootPid];
    const descendants = this.monitor
      .getDescendants(rootPid)
      .map(p => p.pid)
      .filter(pid => pid !== rootPid);
    // 先停/杀子进程，再处理根，顺序上根放最后
    return [...descendants, rootPid];
  }

  private sendSignal(pid: number, signal: SignalResult['signal']): SignalResult {
    try {
      this.signalFn(pid, signal as NodeJS.Signals);
      return { pid, signal, ok: true, alreadyGone: false };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ESRCH') {
        return { pid, signal, ok: true, alreadyGone: true };
      }
      return {
        pid,
        signal,
        ok: false,
        alreadyGone: false,
        error: (err as Error).message,
      };
    }
  }

  private isAlive(pid: number): boolean {
    // 0 号信号只做存在性/权限检查，不真正发信号
    try {
      this.signalFn(pid, 0 as unknown as NodeJS.Signals);
      return true;
    } catch (err) {
      return (err as NodeJS.ErrnoException).code !== 'ESRCH';
    }
  }
}
