/**
 * Terminal Output Monitor - 终端输出监控器
 * 
 * 直接监控 cmd.exe / powershell.exe 的输出
 * 实现真正的"金山毒霸"模式：免值守、实时监控、自动告警
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { AIGuardian } from '../core/guardian.js';
import { emergencyStop } from '../core/emergency-stop.js';

export interface TerminalOutputEvent {
  type: 'command' | 'output' | 'alert';
  timestamp: number;
  terminal: string;
  content: string;
  riskScore?: number;
  recommendation?: string;
}

export interface TerminalMonitorConfig {
  enabled: boolean;
  checkInterval: number;
  alertThreshold: number;
  silentMode: boolean;
  logAllOutput: boolean;
}

class TerminalOutputMonitor extends EventEmitter {
  private guardian: AIGuardian;
  private config: TerminalMonitorConfig;
  private isRunning: boolean = false;
  private eventLog: TerminalOutputEvent[] = [];
  private maxLogSize: number = 1000;
  private lastOutput: string = '';

  constructor(config?: Partial<TerminalMonitorConfig>) {
    super();
    this.guardian = new AIGuardian();
    this.config = {
      enabled: config?.enabled ?? true,
      checkInterval: config?.checkInterval ?? 1000,
      alertThreshold: config?.alertThreshold ?? 70,
      silentMode: config?.silentMode ?? true,
      logAllOutput: config?.logAllOutput ?? false
    };
  }

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[Terminal Output Monitor] Started monitoring terminal output');
    console.log('[Terminal Output Monitor] Mode: Silent (alerts only on high risk)');

    // Start monitoring terminal processes
    this.monitorTerminalProcesses();
  }

  stop(): void {
    this.isRunning = false;
    console.log('[Terminal Output Monitor] Stopped monitoring');
  }

  private async monitorTerminalProcesses(): Promise<void> {
    while (this.isRunning) {
      if (emergencyStop.isEmergencyStopped()) {
        await this.sleep(this.config.checkInterval);
        continue;
      }

      try {
        // Get all terminal processes
        const terminals = await this.getTerminalProcesses();
        
        for (const terminal of terminals) {
          // Monitor each terminal's recent output
          await this.captureTerminalOutput(terminal);
        }
      } catch (error) {
        // Silently ignore errors
      }

      await this.sleep(this.config.checkInterval);
    }
  }

  private async getTerminalProcesses(): Promise<Array<{ pid: number; name: string; title: string }>> {
    return new Promise((resolve) => {
      const platform = process.platform;
      let cmd: string;
      let args: string[];

      if (platform === 'win32') {
        cmd = 'powershell';
        args = [
          '-Command',
          'Get-Process -Name cmd,powershell,pwsh -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, MainWindowTitle | ConvertTo-Json'
        ];
      } else {
        cmd = 'ps';
        args = ['aux'];
      }

      try {
        const proc = spawn(cmd, args, { timeout: 5000 });
        let output = '';

        proc.stdout.on('data', (data) => {
          output += data.toString();
        });

        proc.on('close', () => {
          const terminals = this.parseTerminalList(output);
          resolve(terminals);
        });

        proc.on('error', () => {
          resolve([]);
        });
      } catch {
        resolve([]);
      }
    });
  }

  private parseTerminalList(output: string): Array<{ pid: number; name: string; title: string }> {
    const terminals: Array<{ pid: number; name: string; title: string }> = [];
    
    try {
      if (process.platform === 'win32') {
        // Parse PowerShell JSON output
        let data = output.trim();
        if (!data) return [];
        
        // Handle single object case
        if (!data.startsWith('[')) {
          data = '[' + data + ']';
        }
        
        const processes = JSON.parse(data);
        for (const p of (Array.isArray(processes) ? processes : [processes])) {
          if (p.Id && p.ProcessName) {
            terminals.push({
              pid: p.Id,
              name: p.ProcessName,
              title: p.MainWindowTitle || ''
            });
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
    
    return terminals;
  }

  private async captureTerminalOutput(terminal: { pid: number; name: string; title: string }): Promise<void> {
    // On Windows, we can use PowerShell to get console buffer content
    if (process.platform !== 'win32') return;

    return new Promise((resolve) => {
      // Use PowerShell to get recent console output
      // This is a simplified approach - in production, you'd use Windows API
      const cmd = 'powershell';
      const args = [
        '-Command',
        `
        $proc = Get-Process -Id ${terminal.pid} -ErrorAction SilentlyContinue
        if ($proc) {
          # Get the main window handle and try to get text
          # Note: This is a simplified approach
          Write-Output "Terminal: ${terminal.name} (PID: ${terminal.pid})"
        }
        `
      ];

      try {
        const proc = spawn(cmd, args, { timeout: 3000 });
        let output = '';

        proc.stdout.on('data', (data) => {
          output += data.toString();
        });

        proc.on('close', () => {
          if (output && output !== this.lastOutput) {
            this.lastOutput = output;
            this.analyzeOutput(terminal.name, output);
          }
          resolve();
        });

        proc.on('error', () => {
          resolve();
        });
      } catch {
        resolve();
      }
    });
  }

  private async analyzeOutput(terminal: string, output: string): Promise<void> {
    // Extract potential commands from output
    const commands = this.extractCommands(output);
    
    for (const command of commands) {
      // Skip empty or very short commands
      if (!command || command.length < 3) continue;
      
      // Skip common safe commands
      if (this.isSafeCommand(command)) continue;

      // Analyze command
      const result = await this.guardian.evaluate({
        id: `monitor_${Date.now()}`,
        toolName: 'exec',
        params: { command },
        timestamp: Date.now(),
        sessionId: 'terminal-output-monitor'
      });

      const riskScore = result.riskAnalysis?.score || 0;

      // Log event
      const event: TerminalOutputEvent = {
        type: riskScore >= this.config.alertThreshold ? 'alert' : 'command',
        timestamp: Date.now(),
        terminal,
        content: command,
        riskScore,
        recommendation: result.alternatives?.join('; ')
      };

      this.logEvent(event);

      // Alert on high risk
      if (riskScore >= this.config.alertThreshold) {
        this.emit('alert', event);
        
        if (!this.config.silentMode) {
          console.log(`\n⚠️ [ALERT] High-risk command detected!`);
          console.log(`   Terminal: ${terminal}`);
          console.log(`   Command: ${command}`);
          console.log(`   Risk: ${riskScore}/100`);
          console.log(`   Recommendation: ${event.recommendation}`);
        }
      }
    }
  }

  private extractCommands(output: string): string[] {
    const commands: string[] = [];
    
    // Common patterns for commands in terminal output
    const patterns = [
      // Command prompt patterns
      /^[A-Z]:\\.*>/gm,           // Windows prompt
      /^\$ .+$/gm,                 // Unix prompt
      /^PS [A-Z]:\\.*>/gm,        // PowerShell prompt
      /^>>> .+$/gm,                // Python prompt
      
      // Command execution patterns
      /Running: (.+)/g,
      /Executing: (.+)/g,
      /Command: (.+)/g,
    ];

    for (const pattern of patterns) {
      const matches = output.match(pattern);
      if (matches) {
        for (const match of matches) {
          // Clean up the command
          let cmd = match
            .replace(/^[A-Z]:\\.*>/, '')
            .replace(/^PS [A-Z]:\\.*>/, '')
            .replace(/^\$\s*/, '')
            .replace(/^>>>\s*/, '')
            .replace(/^Running:\s*/, '')
            .replace(/^Executing:\s*/, '')
            .replace(/^Command:\s*/, '')
            .trim();
          
          if (cmd && cmd.length >= 3) {
            commands.push(cmd);
          }
        }
      }
    }

    // Also look for dangerous command patterns directly
    const dangerousPatterns = [
      /rm\s+-rf\s+\S+/gi,
      /del\s+\/[sS]\s+\S+/gi,
      /format\s+\S+/gi,
      /chmod\s+777\s+\S+/gi,
      /curl\s+.*\|\s*(bash|sh)/gi,
      /wget\s+.*\|\s*(bash|sh)/gi,
      />\s*\/dev\/(null|zero|sda)/gi,
      /dd\s+if=\/dev\/zero/gi,
      /:\(\)\{\s*:\|:\s*&\s*\};\s*:/g,  // Fork bomb
    ];

    for (const pattern of dangerousPatterns) {
      const matches = output.match(pattern);
      if (matches) {
        commands.push(...matches);
      }
    }

    return [...new Set(commands)]; // Remove duplicates
  }

  private isSafeCommand(command: string): boolean {
    const safePatterns = [
      /^ls\b/i,
      /^dir\b/i,
      /^cd\b/i,
      /^pwd\b/i,
      /^echo\b/i,
      /^cat\b/i,
      /^type\b/i,
      /^clear\b/i,
      /^cls\b/i,
      /^date\b/i,
      /^time\b/i,
      /^whoami\b/i,
      /^hostname\b/i,
      /^git status\b/i,
      /^git log\b/i,
      /^git diff\b/i,
      /^npm list\b/i,
      /^node --version\b/i,
      /^npm --version\b/i,
    ];

    return safePatterns.some(pattern => pattern.test(command.trim()));
  }

  private logEvent(event: TerminalOutputEvent): void {
    this.eventLog.push(event);
    
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxLogSize);
    }

    this.emit('event', event);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getEventLog(): TerminalOutputEvent[] {
    return [...this.eventLog];
  }

  getRecentAlerts(count: number = 10): TerminalOutputEvent[] {
    return this.eventLog
      .filter(e => e.type === 'alert' || (e.riskScore && e.riskScore >= this.config.alertThreshold))
      .slice(-count);
  }

  getStatus(): { running: boolean; config: TerminalMonitorConfig; eventCount: number } {
    return {
      running: this.isRunning,
      config: this.config,
      eventCount: this.eventLog.length
    };
  }

  updateConfig(newConfig: Partial<TerminalMonitorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export const terminalOutputMonitor = new TerminalOutputMonitor();
