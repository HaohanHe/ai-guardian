import React, { useState } from 'react';
import { 
  CogIcon, 
  ShieldCheckIcon,
  BellIcon,
  ArrowPathIcon,
  UserIcon,
  GlobeAltIcon,
  ComputerDesktopIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const Settings: React.FC = () => {
  const [activeSection, setActiveSection] = useState('general');
  
  const [settings, setSettings] = useState({
    autoStart: true,
    autoUpdate: true,
    realTimeProtection: true,
    cloudAnalysis: true,
    suspiciousFileAlert: true,
    autoQuarantine: true,
    notifications: {
      threatFound: true,
      scanComplete: true,
      updateAvailable: true,
      weeklyReport: false,
    },
    scan: {
      scanArchives: true,
      scanEmail: false,
      heuristicsLevel: 'medium',
      cpuUsage: 'balanced',
    },
    ui: {
      theme: 'dark',
      language: 'zh-CN',
      minimizeToTray: true,
      showNotifications: true,
    }
  });

  const toggleSetting = (path: string) => {
    setSettings(prev => {
      const keys = path.split('.');
      let current: any = prev;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = !current[keys[keys.length - 1]];
      return { ...prev };
    });
    toast.success('设置已保存', { icon: '✅' });
  };

  const sections = [
    { id: 'general', name: '常规设置', icon: CogIcon },
    { id: 'protection', name: '防护设置', icon: ShieldCheckIcon },
    { id: 'scan', name: '扫描设置', icon: ArrowPathIcon },
    { id: 'notifications', name: '通知设置', icon: BellIcon },
    { id: 'ui', name: '界面设置', icon: ComputerDesktopIcon },
    { id: 'about', name: '关于', icon: InformationCircleIcon },
  ];

  return (
    <div className="flex gap-6 h-full">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0">
        <div className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                  activeSection === section.id
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                {section.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-6 pb-6">
        {activeSection === 'general' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">常规设置</h2>
              <p className="text-slate-400">配置基本运行选项</p>
            </div>

            <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 divide-y divide-slate-700/50">
              <SettingItem
                title="开机自启动"
                description="系统启动时自动运行 AI Guardian"
                enabled={settings.autoStart}
                onToggle={() => toggleSetting('autoStart')}
              />
              <SettingItem
                title="自动更新"
                description="自动检测并安装病毒库和程序更新"
                enabled={settings.autoUpdate}
                onToggle={() => toggleSetting('autoUpdate')}
              />
              <SettingItem
                title="云端分析"
                description="将可疑文件上传到云端进行分析"
                enabled={settings.cloudAnalysis}
                onToggle={() => toggleSetting('cloudAnalysis')}
              />
            </div>
          </div>
        )}

        {activeSection === 'protection' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">防护设置</h2>
              <p className="text-slate-400">配置实时防护选项</p>
            </div>

            <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 divide-y divide-slate-700/50">
              <SettingItem
                title="实时防护"
                description="实时监控文件系统和进程活动"
                enabled={settings.realTimeProtection}
                onToggle={() => toggleSetting('realTimeProtection')}
              />
              <SettingItem
                title="可疑文件提醒"
                description="检测到可疑文件时立即通知"
                enabled={settings.suspiciousFileAlert}
                onToggle={() => toggleSetting('suspiciousFileAlert')}
              />
              <SettingItem
                title="自动隔离"
                description="自动隔离检测到的威胁文件"
                enabled={settings.autoQuarantine}
                onToggle={() => toggleSetting('autoQuarantine')}
              />
            </div>
          </div>
        )}

        {activeSection === 'scan' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">扫描设置</h2>
              <p className="text-slate-400">配置病毒扫描选项</p>
            </div>

            <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 divide-y divide-slate-700/50">
              <SettingItem
                title="扫描压缩包"
                description="扫描 ZIP、RAR 等压缩文件内容"
                enabled={settings.scan.scanArchives}
                onToggle={() => toggleSetting('scan.scanArchives')}
              />
              <SettingItem
                title="扫描邮件"
                description="扫描电子邮件客户端的邮件和附件"
                enabled={settings.scan.scanEmail}
                onToggle={() => toggleSetting('scan.scanEmail')}
              />
              
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">启发式级别</h3>
                    <p className="text-sm text-slate-400">调整未知威胁检测的敏感度</p>
                  </div>
                  <select
                    value={settings.scan.heuristicsLevel}
                    onChange={(e) => {
                      setSettings(prev => ({
                        ...prev,
                        scan: { ...prev.scan, heuristicsLevel: e.target.value }
                      }));
                      toast.success('设置已保存', { icon: '✅' });
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-700/50 border border-slate-600/50 text-white focus:outline-none focus:border-blue-500/50"
                  >
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                  </select>
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">CPU 使用限制</h3>
                    <p className="text-sm text-slate-400">控制扫描时的资源占用</p>
                  </div>
                  <select
                    value={settings.scan.cpuUsage}
                    onChange={(e) => {
                      setSettings(prev => ({
                        ...prev,
                        scan: { ...prev.scan, cpuUsage: e.target.value }
                      }));
                      toast.success('设置已保存', { icon: '✅' });
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-700/50 border border-slate-600/50 text-white focus:outline-none focus:border-blue-500/50"
                  >
                    <option value="low">低</option>
                    <option value="balanced">平衡</option>
                    <option value="high">高</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'notifications' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">通知设置</h2>
              <p className="text-slate-400">配置系统通知选项</p>
            </div>

            <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 divide-y divide-slate-700/50">
              <SettingItem
                title="威胁发现通知"
                description="检测到威胁时显示通知"
                enabled={settings.notifications.threatFound}
                onToggle={() => toggleSetting('notifications.threatFound')}
              />
              <SettingItem
                title="扫描完成通知"
                description="扫描完成后显示通知"
                enabled={settings.notifications.scanComplete}
                onToggle={() => toggleSetting('notifications.scanComplete')}
              />
              <SettingItem
                title="更新可用通知"
                description="有新版本时显示通知"
                enabled={settings.notifications.updateAvailable}
                onToggle={() => toggleSetting('notifications.updateAvailable')}
              />
              <SettingItem
                title="每周安全报告"
                description="每周发送系统安全报告"
                enabled={settings.notifications.weeklyReport}
                onToggle={() => toggleSetting('notifications.weeklyReport')}
              />
            </div>
          </div>
        )}

        {activeSection === 'ui' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">界面设置</h2>
              <p className="text-slate-400">配置用户界面选项</p>
            </div>

            <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 divide-y divide-slate-700/50">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">主题</h3>
                    <p className="text-sm text-slate-400">选择界面主题</p>
                  </div>
                  <select
                    value={settings.ui.theme}
                    onChange={(e) => {
                      setSettings(prev => ({
                        ...prev,
                        ui: { ...prev.ui, theme: e.target.value }
                      }));
                      toast.success('设置已保存', { icon: '✅' });
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-700/50 border border-slate-600/50 text-white focus:outline-none focus:border-blue-500/50"
                  >
                    <option value="dark">深色</option>
                    <option value="light">浅色</option>
                    <option value="system">跟随系统</option>
                  </select>
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">语言</h3>
                    <p className="text-sm text-slate-400">选择界面语言</p>
                  </div>
                  <select
                    value={settings.ui.language}
                    onChange={(e) => {
                      setSettings(prev => ({
                        ...prev,
                        ui: { ...prev.ui, language: e.target.value }
                      }));
                      toast.success('设置已保存', { icon: '✅' });
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-700/50 border border-slate-600/50 text-white focus:outline-none focus:border-blue-500/50"
                  >
                    <option value="zh-CN">简体中文</option>
                    <option value="en-US">English</option>
                  </select>
                </div>
              </div>

              <SettingItem
                title="最小化到托盘"
                description="关闭窗口时最小化到系统托盘"
                enabled={settings.ui.minimizeToTray}
                onToggle={() => toggleSetting('ui.minimizeToTray')}
              />
              <SettingItem
                title="显示桌面通知"
                description="在桌面显示弹出通知"
                enabled={settings.ui.showNotifications}
                onToggle={() => toggleSetting('ui.showNotifications')}
              />
            </div>
          </div>
        )}

        {activeSection === 'about' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">关于</h2>
              <p className="text-slate-400">AI Guardian 专业安全防护系统</p>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 border border-slate-600/50 p-8 text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/30">
                <ShieldCheckIcon className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-2">AI Guardian</h3>
              <p className="text-slate-400 mb-6">版本 2.0.0 (Build 20240115)</p>
              
              <div className="grid grid-cols-2 gap-4 text-left mb-6">
                <div className="bg-slate-700/30 rounded-xl p-4">
                  <p className="text-sm text-slate-400">病毒库版本</p>
                  <p className="font-semibold">2024.01.15.01</p>
                </div>
                <div className="bg-slate-700/30 rounded-xl p-4">
                  <p className="text-sm text-slate-400">引擎版本</p>
                  <p className="font-semibold">3.5.2</p>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => toast.success('检查更新中...', { icon: '🔍' })}
                  className="px-6 py-2.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors"
                >
                  检查更新
                </button>
                <button
                  onClick={() => toast('用户手册已打开', { icon: '📖' })}
                  className="px-6 py-2.5 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  用户手册
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6">
              <h4 className="font-semibold mb-4">许可信息</h4>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <CheckCircleIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold">Pro 版本</p>
                  <p className="text-sm text-slate-400">有效期至: 2025-01-15</p>
                </div>
              </div>
              <button className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 text-white font-semibold transition-colors">
                升级授权
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SettingItem: React.FC<{
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}> = ({ title, description, enabled, onToggle }) => {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
        <button
          onClick={onToggle}
          className={`relative w-16 h-8 rounded-full transition-colors ${
            enabled ? 'bg-green-500' : 'bg-slate-600'
          }`}
        >
          <div
            className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
              enabled ? 'translate-x-9' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
};

export default Settings;
