/**
 * 开机自启管理器 - Startup Manager
 * 
 * 管理 AI Guardian 的开机自启功能
 * 支持 Windows、macOS、Linux
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';

export interface StartupConfig {
  enabled: boolean;
  delay: number; // 开机后延迟启动（秒）
  minimized: boolean; // 是否最小化启动
}

export class StartupManager {
  private configPath: string;
  private config: StartupConfig = {
    enabled: false,
    delay: 10,
    minimized: true
  };

  constructor() {
    this.configPath = join(homedir(), '.ai-guardian', 'startup.json');
  }

  /**
   * 加载配置
   */
  async loadConfig(): Promise<StartupConfig> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.config = { ...this.config, ...JSON.parse(data) };
    } catch {
      // 配置文件不存在，使用默认配置
    }
    return this.config;
  }

  /**
   * 保存配置
   */
  async saveConfig(): Promise<void> {
    const dir = join(homedir(), '.ai-guardian');
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {
      // 目录已存在
    }
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  /**
   * 设置开机自启
   */
  async setStartup(enabled: boolean, delay = 10, minimized = true): Promise<boolean> {
    this.config = { enabled, delay, minimized };
    await this.saveConfig();

    const sys = platform();
    
    try {
      if (sys === 'win32') {
        return await this.setWindowsStartup(enabled);
      } else if (sys === 'darwin') {
        return await this.setMacOSStartup(enabled);
      } else if (sys === 'linux') {
        return await this.setLinuxStartup(enabled);
      }
      return false;
    } catch (error) {
      console.error('设置开机自启失败:', error);
      return false;
    }
  }

  /**
   * Windows 开机自启
   */
  private async setWindowsStartup(enabled: boolean): Promise<boolean> {
    // 使用 PowerShell 创建/删除启动项
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const appName = 'AIGuardian';
    const appPath = process.execPath;
    const args = this.config.minimized ? '--minimized' : '';
    
    if (enabled) {
      // 创建启动项
      const command = `
        $WshShell = New-Object -comObject WScript.Shell;
        $Shortcut = $WshShell.CreateShortcut("$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\${appName}.lnk");
        $Shortcut.TargetPath = "${appPath}";
        $Shortcut.Arguments = "${args}";
        $Shortcut.WorkingDirectory = "${process.cwd()}";
        $Shortcut.Save();
      `;
      await execAsync(command, { shell: 'powershell.exe' });
    } else {
      // 删除启动项
      const startupPath = join(
        homedir(),
        'AppData',
        'Roaming',
        'Microsoft',
        'Windows',
        'Start Menu',
        'Programs',
        'Startup',
        `${appName}.lnk`
      );
      try {
        await fs.unlink(startupPath);
      } catch {
        // 文件不存在
      }
    }
    
    return true;
  }

  /**
   * macOS 开机自启
   */
  private async setMacOSStartup(enabled: boolean): Promise<boolean> {
    const plistPath = join(
      homedir(),
      'Library',
      'LaunchAgents',
      'com.aiguardian.startup.plist'
    );

    if (enabled) {
      const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.aiguardian.startup</string>
    <key>ProgramArguments</key>
    <array>
        <string>${process.execPath}</string>
        <string>${this.config.minimized ? '--minimized' : ''}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>StartInterval</key>
    <integer>${this.config.delay}</integer>
</dict>
</plist>`;

      await fs.mkdir(join(homedir(), 'Library', 'LaunchAgents'), { recursive: true });
      await fs.writeFile(plistPath, plist);

      // 加载启动项
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      await promisify(exec)(`launchctl load ${plistPath}`);
    } else {
      // 卸载并删除
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        await promisify(exec)(`launchctl unload ${plistPath}`);
        await fs.unlink(plistPath);
      } catch {
        // 文件不存在
      }
    }

    return true;
  }

  /**
   * Linux 开机自启
   */
  private async setLinuxStartup(enabled: boolean): Promise<boolean> {
    const desktopEntryPath = join(
      homedir(),
      '.config',
      'autostart',
      'aiguardian.desktop'
    );

    if (enabled) {
      const desktopEntry = `[Desktop Entry]
Type=Application
Name=AI Guardian
Exec=${process.execPath} ${this.config.minimized ? '--minimized' : ''}
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true`;

      await fs.mkdir(join(homedir(), '.config', 'autostart'), { recursive: true });
      await fs.writeFile(desktopEntryPath, desktopEntry);
    } else {
      try {
        await fs.unlink(desktopEntryPath);
      } catch {
        // 文件不存在
      }
    }

    return true;
  }

  /**
   * 检查开机自启状态
   */
  async isStartupEnabled(): Promise<boolean> {
    await this.loadConfig();
    return this.config.enabled;
  }

  /**
   * 获取配置
   */
  getConfig(): StartupConfig {
    return this.config;
  }
}

// 导出单例
export const startupManager = new StartupManager();
