/**
 * Linux 实时防御运行时测试
 * - 进程监控：特征匹配 / 子进程继承 / 状态映射 / 扫描 diff 事件
 * - 执行后端：信号树顺序、terminate 流程、ESRCH/EPERM 处理
 * - 实时编排：急停联动暂停
 */

import { describe, it, expect, vi } from 'vitest';
import {
  LinuxProcessMonitor,
  type ProcReader,
  type TrackedProcess,
} from '../src/platform/linux-process-monitor.js';
import { LinuxEnforcer } from '../src/platform/linux-enforcer.js';
import { LiveDefense } from '../src/core/live-defense.js';

/* ---------------- Fake /proc reader ---------------- */

interface FakeProc {
  pid: number;
  ppid: number;
  comm: string;
  cmdline: string;
  state: string;
  uid: number;
}

class FakeProcReader implements ProcReader {
  constructor(private procs: FakeProc[]) {}
  set(procs: FakeProc[]) {
    this.procs = procs;
  }
  listPids() {
    return this.procs.map(p => p.pid);
  }
  private find(pid: number) {
    return this.procs.find(p => p.pid === pid);
  }
  readComm(pid: number) {
    return this.find(pid)?.comm ?? '';
  }
  readCmdline(pid: number) {
    return this.find(pid)?.cmdline ?? '';
  }
  readStat(pid: number) {
    const p = this.find(pid);
    return p ? { ppid: p.ppid, state: p.state, startTick: 0 } : null;
  }
  readUid(pid: number) {
    return this.find(pid)?.uid ?? null;
  }
}

const baseProcs = (): FakeProc[] => [
  { pid: 100, ppid: 1, comm: 'node', cmdline: 'node /usr/bin/claude-code run', state: 'S', uid: 1000 },
  { pid: 101, ppid: 100, comm: 'bash', cmdline: 'bash', state: 'S', uid: 1000 },
  { pid: 200, ppid: 1, comm: 'systemd', cmdline: '/sbin/init', state: 'S', uid: 0 },
];

/* ---------------- 进程监控器 ---------------- */

describe('LinuxProcessMonitor', () => {
  it('按 cmdline 特征识别 agent', () => {
    const mon = new LinuxProcessMonitor({ reader: new FakeProcReader(baseProcs()) });
    mon.scan();
    const agent = mon.getProcess(100);
    expect(agent?.agent).toBe('claude-code');
    expect(agent?.matchReason).toContain('cmdline');
  });

  it('agent 子进程继承标记', () => {
    const mon = new LinuxProcessMonitor({ reader: new FakeProcReader(baseProcs()) });
    mon.scan();
    const child = mon.getProcess(101);
    expect(child?.agent).toBe('claude-code');
    expect(child?.matchReason).toContain('child of agent');
  });

  it('普通进程不标记', () => {
    const mon = new LinuxProcessMonitor({ reader: new FakeProcReader(baseProcs()) });
    mon.scan();
    expect(mon.getProcess(200)?.agent).toBeNull();
    expect(mon.getAgentProcesses().map(p => p.pid).sort()).toEqual([100, 101]);
  });

  it('T 状态映射为 stopped', () => {
    const procs = baseProcs();
    procs[0].state = 'T';
    const mon = new LinuxProcessMonitor({ reader: new FakeProcReader(procs) });
    mon.scan();
    expect(mon.getProcess(100)?.state).toBe('stopped');
  });

  it('扫描对比发出 new / exit / state 事件', () => {
    const reader = new FakeProcReader(baseProcs());
    const mon = new LinuxProcessMonitor({ reader });
    const seen: string[] = [];
    mon.on('process:new', (p: TrackedProcess) => seen.push(`new:${p.pid}`));
    mon.on('process:exit', ({ pid }) => seen.push(`exit:${pid}`));
    mon.on('process:state', (p: TrackedProcess) => seen.push(`state:${p.pid}`));

    mon.scan();
    // 101 退出，100 被暂停
    reader.set([
      { pid: 100, ppid: 1, comm: 'node', cmdline: 'node /usr/bin/claude-code run', state: 'T', uid: 1000 },
      { pid: 200, ppid: 1, comm: 'systemd', cmdline: '/sbin/init', state: 'S', uid: 0 },
    ]);
    mon.scan();

    expect(seen).toContain('new:100');
    expect(seen).toContain('exit:101');
    expect(seen).toContain('state:100');
  });

  it('getDescendants 返回全部后代', () => {
    const procs = baseProcs();
    procs.push({ pid: 102, ppid: 101, comm: 'sleep', cmdline: 'sleep 10', state: 'S', uid: 1000 });
    const mon = new LinuxProcessMonitor({ reader: new FakeProcReader(procs) });
    mon.scan();
    expect(mon.getDescendants(100).map(p => p.pid).sort()).toEqual([101, 102]);
  });
});

/* ---------------- 执行后端 ---------------- */

describe('LinuxEnforcer', () => {
  const setup = () => {
    const mon = new LinuxProcessMonitor({ reader: new FakeProcReader(baseProcs()) });
    mon.scan();
    const calls: Array<{ pid: number; sig: string | number }> = [];
    const signalFn = vi.fn((pid: number, sig: NodeJS.Signals | number) => {
      calls.push({ pid, sig: sig as string });
    });
    const sleepFn = vi.fn(async () => {});
    const enf = new LinuxEnforcer(mon, { signalFn, sleepFn, terminateGraceMs: 0 });
    return { mon, enf, calls, sleepFn };
  };

  it('suspend 按子→根顺序发 SIGSTOP', async () => {
    const { enf, calls } = setup();
    const rec = await enf.suspend(100, 'test');
    expect(rec.success).toBe(true);
    expect(calls.map(c => c.pid)).toEqual([101, 100]);
    expect(calls.every(c => c.sig === 'SIGSTOP')).toBe(true);
  });

  it('resume 发 SIGCONT', async () => {
    const { enf, calls } = setup();
    await enf.resume(100, 'test');
    expect(calls.every(c => c.sig === 'SIGCONT')).toBe(true);
  });

  it('terminate：SIGCONT→SIGTERM→宽限→存活者 SIGKILL', async () => {
    const { enf, calls, sleepFn } = setup();
    await enf.terminate(100, 'test');
    // 先给整棵树发 CONT，再发 TERM
    expect(calls.slice(0, 4).map(c => `${c.pid}:${c.sig}`)).toEqual([
      '101:SIGCONT',
      '100:SIGCONT',
      '101:SIGTERM',
      '100:SIGTERM',
    ]);
    expect(sleepFn).toHaveBeenCalledOnce();
    // probe（信号 0）后仍存活 → SIGKILL
    expect(calls.filter(c => c.sig === 'SIGKILL').map(c => c.pid).sort()).toEqual([100, 101]);
    expect(calls.filter(c => c.sig === 0)).toHaveLength(2);
  });

  it('terminate：宽限后已退出的不补 SIGKILL', async () => {
    const mon = new LinuxProcessMonitor({ reader: new FakeProcReader(baseProcs()) });
    mon.scan();
    // probe 时模拟 ESRCH
    const signalFn = vi.fn((pid: number, sig: NodeJS.Signals | number) => {
      if (sig === 0) {
        const err = new Error('no such process') as NodeJS.ErrnoException;
        err.code = 'ESRCH';
        throw err;
      }
    });
    const enf = new LinuxEnforcer(mon, { signalFn, sleepFn: async () => {}, terminateGraceMs: 0 });
    const rec = await enf.terminate(100, 'test');
    expect(rec.signals.filter(s => s.signal === 'SIGKILL')).toHaveLength(0);
  });

  it('ESRCH 视为成功（alreadyGone），EPERM 视为失败', async () => {
    const mon = new LinuxProcessMonitor({ reader: new FakeProcReader(baseProcs()) });
    mon.scan();
    const signalFn = vi.fn((pid: number) => {
      const err = new Error(pid === 101 ? 'gone' : 'perm') as NodeJS.ErrnoException;
      err.code = pid === 101 ? 'ESRCH' : 'EPERM';
      throw err;
    });
    const enf = new LinuxEnforcer(mon, { signalFn });
    const rec = await enf.suspend(100, 'test');
    const child = rec.signals.find(s => s.pid === 101);
    const root = rec.signals.find(s => s.pid === 100);
    expect(child?.ok).toBe(true);
    expect(child?.alreadyGone).toBe(true);
    expect(root?.ok).toBe(false);
    expect(rec.success).toBe(false);
  });
});

/* ---------------- 实时编排：急停联动 ---------------- */

describe('LiveDefense 急停联动', () => {
  it('急停激活时对 agent 发 SIGSTOP，并记录事件', async () => {
    const calls: Array<{ pid: number; sig: string | number }> = [];
    const live = new LiveDefense({
      monitor: { reader: new FakeProcReader(baseProcs()), intervalMs: 60000 },
      enforcer: {
        signalFn: (pid, sig) => calls.push({ pid, sig: sig as string }),
        sleepFn: async () => {},
      },
    });
    live.start();
    const triggered = await live.emergencyStop.trigger('unit test', 'test');
    // EmergencyStopManager 默认需要二次确认
    if (!triggered) await live.emergencyStop.trigger('unit test', 'test');
    // 等异步 suspendAll 完成
    await new Promise(r => setTimeout(r, 10));

    expect(calls.some(c => c.pid === 100 && c.sig === 'SIGSTOP')).toBe(true);
    const types = live.getEvents(100).map(e => e.type);
    expect(types).toContain('estop:activated');
    expect(types).toContain('enforce');
    live.stop();
  });
});
