/**
 * fanotify 内核拦截守护进程的控制客户端
 *
 * 通过 Unix domain socket 与以 root 运行的 fanotify-enforcer 通信，
 * 运行时下发或撤销拦截策略，不用重启守护进程。
 *
 * 协议（每行一个 JSON，服务端处理完即断开）：
 *   请求 {"op":"status"}
 *        {"op":"apply","policy": KernelPolicy}
 *   响应 {"ok":true,"result": ...}
 *        {"ok":false,"error": ...}
 *
 * 非 Linux 平台上连接会直接失败，调用方应把它当作"能力不存在"处理，
 * 不要让它把主流程带崩。
 */

import net from 'node:net';

export interface KernelPolicy {
  deny_prefixes: string[];
  lockdown_agents: string[];
  watch_paths: string[];
}

export interface KernelEnforcerStatus {
  policy: KernelPolicy;
  allowed: number;
  denied: number;
  pid: number;
}

export interface KernelTransport {
  request(socketPath: string, payload: unknown, timeoutMs: number): Promise<unknown>;
}

export interface KernelEnforcerClientOptions {
  /** 直接指定 socket 路径 */
  socketPath?: string;
  /** 候选路径，逐个尝试（默认 /run → /tmp） */
  socketCandidates?: string[];
  timeoutMs?: number;
  /** 传输层注入，仅测试用 */
  transport?: KernelTransport;
}

export const DEFAULT_SOCKET_CANDIDATES = [
  '/run/ai-guardian/enforcer.sock',
  '/tmp/ai-guardian-enforcer.sock',
];

class NetKernelTransport implements KernelTransport {
  request(socketPath: string, payload: unknown, timeoutMs: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection(socketPath);
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        sock.destroy();
        reject(new Error(`kernel enforcer request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      let raw = '';
      sock.on('connect', () => {
        sock.write(JSON.stringify(payload) + '\n');
        sock.end();
      });
      sock.on('data', d => {
        raw += d.toString('utf8');
      });
      sock.on('end', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const line = raw.split('\n').find(l => l.trim().length > 0) ?? raw;
        try {
          const msg = JSON.parse(line);
          if (msg.ok) {
            resolve(msg.result);
          } else {
            reject(new Error(msg.error ?? 'kernel enforcer returned an error'));
          }
        } catch (e) {
          reject(e instanceof Error ? e : new Error('bad response from kernel enforcer'));
        }
      });
      sock.on('error', e => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(e);
      });
    });
  }
}

function isConnectionMissing(e: unknown): boolean {
  const code = (e as NodeJS.ErrnoException | null)?.code;
  return code === 'ENOENT' || code === 'ECONNREFUSED';
}

function uniqueNonEmpty(xs: string[]): string[] {
  return [...new Set(xs.map(x => x.trim()).filter(x => x.length > 0))];
}

export class KernelEnforcerClient {
  private readonly candidates: string[];
  private readonly timeoutMs: number;
  private readonly transport: KernelTransport;
  private resolvedPath: string | null = null;

  constructor(options: KernelEnforcerClientOptions = {}) {
    this.candidates = options.socketPath
      ? [options.socketPath]
      : options.socketCandidates ?? DEFAULT_SOCKET_CANDIDATES;
    this.timeoutMs = options.timeoutMs ?? 2000;
    this.transport = options.transport ?? new NetKernelTransport();
  }

  private async send(payload: unknown): Promise<unknown> {
    if (this.resolvedPath) {
      try {
        return await this.transport.request(this.resolvedPath, payload, this.timeoutMs);
      } catch (e) {
        if (!isConnectionMissing(e)) {
          throw e;
        }
        this.resolvedPath = null;
      }
    }
    let lastErr: unknown = null;
    for (const p of this.candidates) {
      try {
        const r = await this.transport.request(p, payload, this.timeoutMs);
        this.resolvedPath = p;
        return r;
      } catch (e) {
        lastErr = e;
        if (!isConnectionMissing(e)) {
          throw e;
        }
      }
    }
    throw lastErr ?? new Error('kernel enforcer not reachable');
  }

  async status(): Promise<KernelEnforcerStatus> {
    return (await this.send({ op: 'status' })) as KernelEnforcerStatus;
  }

  async applyPolicy(policy: KernelPolicy): Promise<void> {
    await this.send({ op: 'apply', policy });
  }

  /**
   * 内核级锁定：命中的 agent 树下所有 exec 在执行前被拒。
   * agents 为 agent 标识或命令行特征；已有的 deny 前缀会保留。
   */
  async lockdown(agents: string[], denyPrefixes: string[] = []): Promise<void> {
    const current = await this.safeCurrentPolicy();
    const policy: KernelPolicy = {
      deny_prefixes: uniqueNonEmpty([
        ...(current?.deny_prefixes ?? []),
        ...denyPrefixes,
      ]),
      lockdown_agents: uniqueNonEmpty([
        ...(current?.lockdown_agents ?? []),
        ...agents.map(a => a.toLowerCase()),
      ]),
      watch_paths: current?.watch_paths ?? ['/'],
    };
    await this.applyPolicy(policy);
  }

  /** 解除 agent 锁定，deny 前缀保留 */
  async clearLockdown(): Promise<void> {
    const current = await this.safeCurrentPolicy();
    await this.applyPolicy({
      deny_prefixes: current?.deny_prefixes ?? [],
      lockdown_agents: [],
      watch_paths: current?.watch_paths ?? ['/'],
    });
  }

  private async safeCurrentPolicy(): Promise<KernelPolicy | null> {
    try {
      return (await this.status()).policy;
    } catch {
      return null;
    }
  }
}
