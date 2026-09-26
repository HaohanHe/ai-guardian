/**
 * KernelEnforcerClient 测试
 * - 用假传输验证请求载荷与 lockdown/clear 的合并逻辑
 * - 用真实 Unix socket server 验证线路协议
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';

import {
  KernelEnforcerClient,
  type KernelPolicy,
  type KernelTransport,
} from '../src/platform/kernel-enforcer-client.js';

/* ---------------- 假传输 ---------------- */

class FakeTransport implements KernelTransport {
  readonly calls: Array<{ path: string; payload: unknown }> = [];
  failWith?: (path: string, payload: unknown) => Error | null;
  replyWith?: (payload: unknown) => unknown;

  async request(socketPath: string, payload: unknown): Promise<unknown> {
    const err = this.failWith?.(socketPath, payload);
    if (err) throw err;
    this.calls.push({ path: socketPath, payload });
    if (this.replyWith) return this.replyWith(payload);
    return null;
  }
}

const connMissing = (code: string) => {
  const e = new Error(code) as NodeJS.ErrnoException;
  e.code = code;
  return e;
};

describe('KernelEnforcerClient（假传输）', () => {
  it('status 发送 {"op":"status"}', async () => {
    const t = new FakeTransport();
    t.replyWith = () => ({ policy: { deny_prefixes: [], lockdown_agents: [], watch_paths: ['/'] }, allowed: 1, denied: 2, pid: 3 });
    const c = new KernelEnforcerClient({ transport: t, socketPath: '/tmp/x.sock' });
    const st = await c.status();
    expect(t.calls[0].payload).toEqual({ op: 'status' });
    expect(st.allowed).toBe(1);
    expect(st.denied).toBe(2);
  });

  it('applyPolicy 发送完整策略', async () => {
    const t = new FakeTransport();
    const c = new KernelEnforcerClient({ transport: t, socketPath: '/tmp/x.sock' });
    const policy: KernelPolicy = { deny_prefixes: ['/a'], lockdown_agents: ['x'], watch_paths: ['/'] };
    await c.applyPolicy(policy);
    expect(t.calls[0].payload).toEqual({ op: 'apply', policy });
  });

  it('lockdown 先读现状，再合并并小写化 agent 特征', async () => {
    const t = new FakeTransport();
    t.replyWith = (payload) => {
      if ((payload as { op: string }).op === 'status') {
        return {
          policy: { deny_prefixes: ['/keep'], lockdown_agents: ['old-agent'], watch_paths: ['/'] },
          allowed: 0,
          denied: 0,
          pid: 1,
        };
      }
      return null;
    };
    const c = new KernelEnforcerClient({ transport: t, socketPath: '/tmp/x.sock' });
    await c.lockdown(['Claude-Code', 'Cursor']);
    const apply = t.calls.find(x => (x.payload as { op: string }).op === 'apply');
    const policy = (apply!.payload as { policy: KernelPolicy }).policy;
    expect(policy.lockdown_agents).toEqual(['old-agent', 'claude-code', 'cursor']);
    // 已有 deny 前缀保留
    expect(policy.deny_prefixes).toEqual(['/keep']);
  });

  it('lockdown 在守护进程没启动时也能直接下发（默认 watch /）', async () => {
    const t = new FakeTransport();
    t.failWith = () => connMissing('ENOENT');
    // status 失败后 apply 仍应成功
    t.replyWith = () => null;
    // 让 status 路径失败、apply 路径成功
    t.failWith = (_p, payload) =>
      (payload as { op: string }).op === 'status' ? connMissing('ENOENT') : null;
    const c = new KernelEnforcerClient({ transport: t, socketPath: '/tmp/x.sock' });
    await c.lockdown(['claude-code']);
    const apply = t.calls.find(x => (x.payload as { op: string }).op === 'apply');
    const policy = (apply!.payload as { policy: KernelPolicy }).policy;
    expect(policy.lockdown_agents).toEqual(['claude-code']);
    expect(policy.watch_paths).toEqual(['/']);
  });

  it('clearLockdown 保留 deny 前缀、清空锁定', async () => {
    const t = new FakeTransport();
    t.replyWith = (payload) => {
      if ((payload as { op: string }).op === 'status') {
        return {
          policy: { deny_prefixes: ['/keep'], lockdown_agents: ['agent-x'], watch_paths: ['/'] },
          allowed: 0,
          denied: 0,
          pid: 1,
        };
      }
      return null;
    };
    const c = new KernelEnforcerClient({ transport: t, socketPath: '/tmp/x.sock' });
    await c.clearLockdown();
    const apply = t.calls.find(x => (x.payload as { op: string }).op === 'apply');
    const policy = (apply!.payload as { policy: KernelPolicy }).policy;
    expect(policy.lockdown_agents).toEqual([]);
    expect(policy.deny_prefixes).toEqual(['/keep']);
  });

  it('首个候选连不上时自动尝试下一个，并记住可用路径', async () => {
    const t = new FakeTransport();
    t.failWith = (path) => (path === '/run/x.sock' ? connMissing('ENOENT') : null);
    const c = new KernelEnforcerClient({
      transport: t,
      socketCandidates: ['/run/x.sock', '/tmp/x.sock'],
    });
    await c.status();
    // 第二次请求应直接走记住的 /tmp 路径，不再试 /run
    t.calls.length = 0;
    await c.status();
    expect(t.calls.map(x => x.path)).toEqual(['/tmp/x.sock']);
  });

  it('非连接类错误直接抛出，不尝试下一个候选', async () => {
    const t = new FakeTransport();
    t.failWith = () => {
      const e = new Error('permission denied') as NodeJS.ErrnoException;
      e.code = 'EPERM';
      return e;
    };
    const c = new KernelEnforcerClient({
      transport: t,
      socketCandidates: ['/run/x.sock', '/tmp/x.sock'],
    });
    await expect(c.status()).rejects.toThrow('permission denied');
  });
});

/* ---------------- 真实 Unix socket 往返 ---------------- */

describe('NetKernelTransport（真实 socket）', () => {
  const sockPath = join(tmpdir(), `guardian-test-${process.pid}.sock`);
  const received: unknown[] = [];
  let server: net.Server;

  beforeAll(async () => {
    server = net.createServer(conn => {
      let raw = '';
      conn.on('data', d => {
        raw += d.toString('utf8');
        if (raw.includes('\n')) {
          const line = raw.split('\n')[0];
          const req = JSON.parse(line);
          received.push(req);
          if (req.op === 'status') {
            conn.write(JSON.stringify({
              ok: true,
              result: {
                policy: { deny_prefixes: [], lockdown_agents: [], watch_paths: ['/'] },
                allowed: 5,
                denied: 1,
                pid: process.pid,
              },
            }) + '\n');
          } else {
            conn.write(JSON.stringify({ ok: true, result: 'applied' }) + '\n');
          }
        }
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.on('error', reject);
      server.listen(sockPath, () => resolve());
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (existsSync(sockPath)) unlinkSync(sockPath);
  });

  it('status 端到端往返', async () => {
    const c = new KernelEnforcerClient({ socketPath: sockPath, timeoutMs: 3000 });
    const st = await c.status();
    expect(st.allowed).toBe(5);
    expect(st.denied).toBe(1);
    expect(st.policy.watch_paths).toEqual(['/']);
  });

  it('lockdown 端到端往返', async () => {
    const c = new KernelEnforcerClient({ socketPath: sockPath, timeoutMs: 3000 });
    await c.lockdown(['claude-code']);
    const apply = received.find(x => (x as { op: string }).op === 'apply') as
      | { policy: KernelPolicy }
      | undefined;
    expect(apply?.policy.lockdown_agents).toEqual(['claude-code']);
  });
});
