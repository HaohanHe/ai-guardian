/**
 * Terminal Monitor - Automatic terminal supervision
 * 
 * Automatically monitors terminal activity and detects security threats
 */

import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { AIGuardian } from './guardian.js';
import { emergencyStop } from './emergency-stop.js';

export interface TerminalEvent {
  type: 'command' | 'output' | 'error' | 'alert';
  timestamp: number;
  source: string;
  content: string;
  riskScore?: number;
  recommendation?: string;
}

export interface MonitorConfig {
  enabled: boolean;
  interval: number;
  autoBlock: boolean;
  logCommands: boolean;
  alertThreshold: number;
}

class TerminalMonitor extends EventEmitter {
  private guardian: AIGuardian;
  private config: MonitorConfig;
  private isRunning: boolean = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private eventLog: TerminalEvent[] = [];
  private maxLogSize: number = 1000;

  constructor(config?: Partial<MonitorConfig>) {
    super();
    this.guardian = new AIGuardian();
    this.config = {
      enabled: config?.enabled ?? true,
      interval: config?.interval ?? 5000,
      autoBlock: config?.autoBlock ?? false,
      logCommands: config?.logCommands ?? true,
      alertThreshold: config?.alertThreshold ?? 70
    };
  }

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[Terminal Monitor] Started monitoring terminal activity');

    // Monitor at regular intervals
    this.monitorInterval = setInterval(() => {
      this.performCheck();
    }, this.config.interval);

    // Initial check
    this.performCheck();
  }

  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isRunning = false;
    console.log('[Terminal Monitor] Stopped monitoring');
  }

  private async performCheck(): Promise<void> {
    if (emergencyStop.isEmergencyStopped()) {
      return;
    }

    // Check for suspicious processes
    await this.checkProcesses();

    // Check for suspicious network connections
    await this.checkNetworkConnections();

    // Check for suspicious file modifications
    await this.checkFileModifications();
  }

  private async checkProcesses(): Promise<void> {
    return new Promise((resolve) => {
      const platform = process.platform;
      let cmd: string;
      let args: string[];

      if (platform === 'win32') {
        cmd = 'powershell';
        args = ['-Command', 'Get-Process | Select-Object Name, Id, Path | ConvertTo-Json'];
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
          this.analyzeProcessOutput(output);
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

  private analyzeProcessOutput(output: string): void {
    const suspiciousPatterns = [
      { pattern: /openclaw|clawbot/i, name: 'OpenClaw/ClawBot detected', risk: 90 },
      { pattern: /nc\.exe|ncat|netcat/i, name: 'Netcat detected', risk: 80 },
      { pattern: /mimikatz|procdump/i, name: 'Credential dumping tool', risk: 95 },
      { pattern: /powershell.*-enc/i, name: 'Encoded PowerShell command', risk: 85 },
      { pattern: /wget.*\|.*sh|curl.*\|.*bash/i, name: 'Remote script execution', risk: 75 }
    ];

    for (const { pattern, name, risk } of suspiciousPatterns) {
      if (pattern.test(output)) {
        this.logEvent({
          type: 'alert',
          timestamp: Date.now(),
          source: 'process-monitor',
          content: name,
          riskScore: risk,
          recommendation: this.getRecommendation(risk)
        });

        if (risk >= this.config.alertThreshold) {
          this.emit('alert', {
            type: name,
            risk,
            timestamp: Date.now()
          });
        }
      }
    }
  }

  private async checkNetworkConnections(): Promise<void> {
    return new Promise((resolve) => {
      const platform = process.platform;
      let cmd: string;
      let args: string[];

      if (platform === 'win32') {
        cmd = 'netstat';
        args = ['-ano'];
      } else {
        cmd = 'ss';
        args = ['-tulpn'];
      }

      try {
        const proc = spawn(cmd, args, { timeout: 5000 });
        let output = '';

        proc.stdout.on('data', (data) => {
          output += data.toString();
        });

        proc.on('close', () => {
          this.analyzeNetworkOutput(output);
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

  private analyzeNetworkOutput(output: string): void {
    const suspiciousPatterns = [
      { pattern: /:4444|:5555|:6666|:7777|:8888/i, name: 'Common backdoor port detected', risk: 85 },
      { pattern: /ESTABLISHED.*\d+\.\d+\.\d+\.\d+:\d+/i, name: 'Active network connection', risk: 30 }
    ];

    for (const { pattern, name, risk } of suspiciousPatterns) {
      if (pattern.test(output)) {
        this.logEvent({
          type: 'alert',
          timestamp: Date.now(),
          source: 'network-monitor',
          content: name,
          riskScore: risk,
          recommendation: this.getRecommendation(risk)
        });
      }
    }
  }

  private async checkFileModifications(): Promise<void> {
    // This would check for suspicious file modifications
    // For now, it's a placeholder
  }

  async analyzeCommand(command: string): Promise<TerminalEvent> {
    const result = await this.guardian.evaluate({
      id: `monitor_${Date.now()}`,
      toolName: 'exec',
      params: { command },
      timestamp: Date.now(),
      sessionId: 'terminal-monitor'
    });

    const riskScore = result.riskAnalysis?.score || 0;
    const event: TerminalEvent = {
      type: result.action === 'deny' ? 'alert' : 'command',
      timestamp: Date.now(),
      source: 'command-analysis',
      content: command,
      riskScore,
      recommendation: result.alternatives?.join('; ')
    };

    this.logEvent(event);

    if (riskScore >= this.config.alertThreshold) {
      this.emit('alert', {
        type: 'high-risk-command',
        command,
        risk: riskScore,
        timestamp: Date.now()
      });
    }

    return event;
  }

  private logEvent(event: TerminalEvent): void {
    this.eventLog.push(event);
    
    // Trim log if too large
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxLogSize);
    }

    // Emit for external listeners
    this.emit('event', event);

    // Console output for important events
    if (event.type === 'alert' || (event.riskScore && event.riskScore >= 70)) {
      console.log(`[Terminal Monitor] ALERT: ${event.content} (Risk: ${event.riskScore})`);
    }
  }

  private getRecommendation(risk: number): string {
    if (risk >= 90) {
      return 'Immediate action required. Consider triggering emergency stop.';
    } else if (risk >= 70) {
      return 'High risk detected. Review and take appropriate action.';
    } else if (risk >= 50) {
      return 'Medium risk. Monitor closely.';
    }
    return 'Low risk. No immediate action required.';
  }

  getEventLog(): TerminalEvent[] {
    return [...this.eventLog];
  }

  getRecentAlerts(count: number = 10): TerminalEvent[] {
    return this.eventLog
      .filter(e => e.type === 'alert' || (e.riskScore && e.riskScore >= this.config.alertThreshold))
      .slice(-count);
  }

  updateConfig(newConfig: Partial<MonitorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.interval && this.isRunning) {
      this.stop();
      this.start();
    }
  }

  getStatus(): { running: boolean; config: MonitorConfig; eventCount: number } {
    return {
      running: this.isRunning,
      config: this.config,
      eventCount: this.eventLog.length
    };
  }
}

export const terminalMonitor = new TerminalMonitor();
