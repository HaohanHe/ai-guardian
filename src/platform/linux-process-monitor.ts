/**
 * Linux 进程监控器
 *
 * 扫描 /proc，识别运行中的 AI Agent 进程（CLI / IDE 后端 / 终端代理），
 * 跟踪父子进程树与运行状态，轮询对比后发出事件。
 *
 * 为了可测试，文件系统访问收敛在 ProcReader 接口后面，测试可注入假实现。
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';

/* ------------------------------------------------------------------ */
/* 类型                                                                */
/* ------------------------------------------------------------------ */

export type ProcessRunState = 'running' | 'stopped' | 'unknown';

export interface TrackedProcess {
  pid: number;
  ppid: number;
  comm: string;
  cmdline: string;
  /** 命中的 agent 标识；非 agent 为 null */
  agent: string | null;
  matchReason: string | null;
  state: ProcessRunState;
  uid: number | null;
  /** /proc stat 第 22 字段 starttime（clock ticks） */
  startTick: number;
}

export interface AgentSignature {
  id: string;
  /** 在 comm 或 cmdline 上匹配（小写比较） */
  patterns: string[];
}

/** AI Agent 识别特征，按可信度从具体到宽泛排列 */
export const DEFAULT_AGENT_SIGNATURES: AgentSignature[] = [
  { id: 'openclaw', patterns: ['openclaw'] },
  { id: 'claude-code', patterns: ['claude-code', '@anthropic-ai/claude', '/claude', 'claude.cmd'] },
  { id: 'cursor', patterns: ['cursor-agent', 'cursor.cmd', '/cursor', 'cursor.sh', 'cursor-server'] },
  { id: 'windsurf', patterns: ['windsurf'] },
  { id: 'trae', patterns: ['trae'] },
  { id: 'aider', patterns: ['aider'] },
  { id: 'codex', patterns: ['codex'] },
  { id: 'gemini-cli', patterns: ['gemini-cli'] },
  { id: 'cline', patterns: ['cline'] },
  { id: 'continue', patterns: ['continue-agent', '/continue'] },
  { id: 'copilot', patterns: ['copilot-node', 'github.copilot'] },
  { id: 'opencode', patterns: ['opencode'] },
];

/* ------------------------------------------------------------------ */
/* /proc 读取抽象                                                      */
/* ------------------------------------------------------------------ */

export interface ProcReader {
  listPids(): number[];
  readComm(pid: number): string;
  readCmdline(pid: number): string;
  /** 返回 stat 关心字段：ppid / state / starttime */
  readStat(pid: number): { ppid: number; state: string; startTick: number } | null;
  readUid(pid: number): number | null;
}

export class ProcFsReader implements ProcReader {
  constructor(private procRoot: string = '/proc') {}

  listPids(): number[] {
    return fs
      .readdirSync(this.procRoot, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d+$/.test(d.name))
      .map(d => parseInt(d.name, 10));
  }

  readComm(pid: number): string {
    try {
      return fs.readFileSync(`${this.procRoot}/${pid}/comm`, 'utf8').trim();
    } catch {
      return '';
    }
  }

  readCmdline(pid: number): string {
    try {
      // cmdline 以 NUL 分隔参数
      return fs
        .readFileSync(`${this.procRoot}/${pid}/cmdline`, 'utf8')
        .replace(/\0/g, ' ')
        .trim();
    } catch {
      return '';
    }
  }

  readStat(pid: number): { ppid: number; state: string; startTick: number } | null {
    try {
      const raw = fs.readFileSync(`${this.procRoot}/${pid}/stat`, 'utf8');
      // comm 里可能含空格/括号，取最后一个 ')' 之后
      const afterComm = raw.slice(raw.lastIndexOf(')') + 2);
      const f = afterComm.split(/\s+/);
      return {
        state: f[0],
        ppid: parseInt(f[1], 10),
        startTick: parseInt(f[19], 10),
      };
    } catch {
      return null;
    }
  }

  readUid(pid: number): number | null {
    try {
      const raw = fs.readFileSync(`${this.procRoot}/${pid}/status`, 'utf8');
      const line = raw.split('\n').find(l => l.startsWith('Uid:'));
      if (!line) return null;
      return parseInt(line.split(/\s+/)[1], 10);
    } catch {
      return null;
    }
  }
}

/* ------------------------------------------------------------------ */
/* 监控器                                                              */
/* ------------------------------------------------------------------ */

export interface ProcessMonitorEvents {
  'process:new': TrackedProcess;
  'process:exit': { pid: number; agent: string | null };
  'process:state': TrackedProcess;
  'scan': { tracked: number; agents: number };
}

export interface ProcessMonitorOptions {
  intervalMs?: number;
  signatures?: AgentSignature[];
  reader?: ProcReader;
  /** 是否把 agent 的子进程也标记为 agent（默认 true） */
  inheritToChildren?: boolean;
  autostart?: boolean;
}

export class LinuxProcessMonitor extends EventEmitter {
  private processes = new Map<number, TrackedProcess>();
  private readonly intervalMs: number;
  private readonly signatures: AgentSignature[];
  private readonly reader: ProcReader;
  private readonly inheritToChildren: boolean;
  private timer: NodeJS.Timeout | null = null;

  constructor(options: ProcessMonitorOptions = {}) {
    super();
    this.intervalMs = options.intervalMs ?? 2000;
    this.signatures = options.signatures ?? DEFAULT_AGENT_SIGNATURES;
    this.reader = options.reader ?? new ProcFsReader();
    this.inheritToChildren = options.inheritToChildren ?? true;
    if (options.autostart) this.start();
  }

  start(): void {
    if (this.timer) return;
    // 立即扫一次，之后周期扫
    this.scan();
    this.timer = setInterval(() => this.scan(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getProcesses(): TrackedProcess[] {
    return [...this.processes.values()];
  }

  getAgentProcesses(): TrackedProcess[] {
    return this.getProcesses().filter(p => p.agent !== null);
  }

  getProcess(pid: number): TrackedProcess | undefined {
    return this.processes.get(pid);
  }

  /** 返回某 pid 的全部后代（基于当前快照） */
  getDescendants(pid: number): TrackedProcess[] {
    const result: TrackedProcess[] = [];
    const walk = (parent: number) => {
      for (const p of this.processes.values()) {
        if (p.ppid === parent) {
          result.push(p);
          walk(p.pid);
        }
      }
    };
    walk(pid);
    return result;
  }

  /* ---------------- 一次扫描 ---------------- */

  scan(): void {
    const livePids = new Set(this.reader.listPids());
    const next = new Map<number, TrackedProcess>();

    // 先建无 agent 标记的原始快照
    for (const pid of livePids) {
      const stat = this.reader.readStat(pid);
      if (!stat) continue;
      next.set(pid, {
        pid,
        ppid: stat.ppid,
        comm: this.reader.readComm(pid),
        cmdline: this.reader.readCmdline(pid),
        agent: null,
        matchReason: null,
        state: this.mapState(stat.state),
        uid: this.reader.readUid(pid),
        startTick: stat.startTick,
      });
    }

    // 第一轮：特征匹配
    for (const p of next.values()) {
      const hit = this.matchAgent(p);
      if (hit) {
        p.agent = hit.id;
        p.matchReason = hit.reason;
      }
    }

    // 第二轮：agent 子进程继承（迭代到不再增长）
    if (this.inheritToChildren) {
      let changed = true;
      while (changed) {
        changed = false;
        for (const p of next.values()) {
          if (p.agent === null) {
            const parent = next.get(p.ppid);
            if (parent && parent.agent !== null) {
              p.agent = parent.agent;
              p.matchReason = `child of agent pid ${p.ppid}`;
              changed = true;
            }
          }
        }
      }
    }

    // 对比旧快照，发事件
    for (const [pid, p] of next) {
      const old = this.processes.get(pid);
      if (!old) {
        this.emit('process:new', p);
      } else if (old.state !== p.state) {
        this.emit('process:state', p);
      }
    }
    for (const [pid, old] of this.processes) {
      if (!next.has(pid)) {
        this.emit('process:exit', { pid, agent: old.agent });
      }
    }

    this.processes = next;
    this.emit('scan', {
      tracked: this.processes.size,
      agents: this.getAgentProcesses().length,
    });
  }

  /* ---------------- 工具方法 ---------------- */

  private mapState(statState: string): ProcessRunState {
    if (statState === 'T' || statState === 't') return 'stopped';
    if (['R', 'S', 'D', 'Z', 'I'].includes(statState)) return 'running';
    return 'unknown';
  }

  private matchAgent(p: TrackedProcess): { id: string; reason: string } | null {
    const comm = p.comm.toLowerCase();
    const cmd = p.cmdline.toLowerCase();
    for (const sig of this.signatures) {
      for (const pattern of sig.patterns) {
        if (comm === pattern || comm.includes(pattern)) {
          return { id: sig.id, reason: `comm matches "${pattern}"` };
        }
        if (cmd.includes(pattern)) {
          return { id: sig.id, reason: `cmdline matches "${pattern}"` };
        }
      }
    }
    return null;
  }
}
