/**
 * LiveDefense × 内核级执行拦截 联动测试
 */

import { describe, it, expect } from 'vitest';

import { LiveDefense } from '../src/core/live-defense.js';
import {
  KernelEnforcerClient,
  type KernelPolicy,
  type KernelTransport,
} from '../src/platform/kernel-enforcer-client.js';
import type { ProcReader } from '../src/platform/linux-process-monitor.js';

/* ---------------- 最小 /proc 假实现 ---------------- */

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

const procs = (): FakeProc[] => [
  { pid: 100, ppid: 1, comm: 'node', cmdline: 'node /usr/bin/claude-code run', state: 'S', uid: 1000 },
  { pid: 101, ppid: 100, comm: 'bash', cmdline: 'bash', state: 'S', uid: 1000 },
];

/* ---------------- 假传输 ---------------- */

class FakeTransport implements KernelTransport {
  readonly applies: KernelPolicy[] = [];
  failApply = false;
  async request(_path: string, payload: unknown): Promise<unknown> {
    const req = payload as { op: string; policy?: KernelPolicy };
    if (req.op === 'apply') {
      if (this.failApply) throw new Error('boom');
      this.applies.push(req.policy!);
      return null;
    }
    // status
    const current = this.applies[this.applies.length - 1];
    return {
      policy: current ?? { deny_prefixes: [], lockdown_agents: [], watch_paths: ['/'] },
      allowed: 0,
      denied: 0,
      pid: 1,
    };
  }
}

const triggerEstop = async (live: LiveDefense) => {
  const triggered = await live.emergencyStop.trigger('unit test', 'test');
  if (!triggered) await live.emergencyStop.trigger('unit test', 'test');
  // 等异步联动跑完
  await new Promise(r => setTimeout(r, 20));
};

describe('LiveDefense 内核锁定联动', () => {
  it('急停激活后自动下发内核锁定，agent 特征来自扫描结果', async () => {
    const t = new FakeTransport();
    const kernel = new KernelEnforcerClient({ transport: t, socketPath: '/tmp/x.sock' });
    const live = new LiveDefense({
      monitor: { reader: new FakeProcReader(procs()), intervalMs: 60000 },
      enforcer: { sleepFn: async () => {} },
      kernelEnforcer: kernel,
    });
    live.start();
    await triggerEstop(live);

    expect(t.applies).toHaveLength(1);
    expect(t.applies[0].lockdown_agents).toContain('claude-code');

    const types = live.getEvents(100).map(e => e.type);
    expect(types).toContain('kernel:lockdown');
    live.stop();
  });

  it('急停恢复不自动解除内核锁定（需人工确认）', async () => {
    const t = new FakeTransport();
    const kernel = new KernelEnforcerClient({ transport: t, socketPath: '/tmp/x.sock' });
    const live = new LiveDefense({
      monitor: { reader: new FakeProcReader(procs()), intervalMs: 60000 },
      enforcer: { sleepFn: async () => {} },
      kernelEnforcer: kernel,
    });
    live.start();
    await triggerEstop(live);
    await live.emergencyStop.resume('test');
    // 没有新的 apply
    expect(t.applies).toHaveLength(1);
    live.stop();
  });

  it('手动 kernelClear 下发空锁定、保留 deny 前缀', async () => {
    const t = new FakeTransport();
    const kernel = new KernelEnforcerClient({ transport: t, socketPath: '/tmp/x.sock' });
    const live = new LiveDefense({
      monitor: { reader: new FakeProcReader(procs()), intervalMs: 60000 },
      kernelEnforcer: kernel,
    });
    live.start();
    await live.kernelLockdown(['claude-code'], 'test');
    await live.kernelClear();

    expect(t.applies).toHaveLength(2);
    expect(t.applies[1].lockdown_agents).toEqual([]);
    live.stop();
  });

  it('内核下发失败不影响急停流程，记录失败事件', async () => {
    const t = new FakeTransport();
    t.failApply = true;
    const kernel = new KernelEnforcerClient({ transport: t, socketPath: '/tmp/x.sock' });
    const live = new LiveDefense({
      monitor: { reader: new FakeProcReader(procs()), intervalMs: 60000 },
      enforcer: { sleepFn: async () => {} },
      kernelEnforcer: kernel,
    });
    live.start();
    await triggerEstop(live);

    // 急停状态仍然成立
    expect(live.emergencyStop.isEmergencyStopped()).toBe(true);
    const types = live.getEvents(100).map(e => e.type);
    expect(types).toContain('kernel:lockdown-failed');
    live.stop();
  });

  it('kernelEnforcer 关闭时急停不崩，snapshot.kernel.available 为 false', async () => {
    const live = new LiveDefense({
      monitor: { reader: new FakeProcReader(procs()), intervalMs: 60000 },
      enforcer: { sleepFn: async () => {} },
      kernelEnforcer: false,
    });
    live.start();
    await triggerEstop(live);
    expect(live.snapshot().kernel.available).toBe(false);
    live.stop();
  });
});
