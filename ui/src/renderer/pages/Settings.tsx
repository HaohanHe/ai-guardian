/**
 * AI Guardian - Settings Page
 *
 * 设置页面，配置安全策略、AI 分析、告警等
 */

import React, { useState } from 'react';
import {
  ShieldCheckIcon,
  CpuChipIcon,
  BellIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  CogIcon,
} from '@heroicons/react/24/outline';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');

  // General Settings
  const [generalSettings, setGeneralSettings] = useState({
    autoStart: true,
    logLevel: 'info',
    workerThreads: 4,
  });

  // Security Settings
  const [securitySettings, setSecuritySettings] = useState({
    enabled: true,
    mode: 'interactive',
    blockFileDelete: true,
    blockSystemPathWrite: true,
    blockNetworkConnection: true,
  });

  // AI Analysis Settings
  const [aiSettings, setAiSettings] = useState({
    enabled: true,
    riskThreshold: 70,
    useLocalModel: true,
    enableSemanticAnalysis: true,
    analysisTimeout: 5,
  });

  // Audit Settings
  const [auditSettings, setAuditSettings] = useState({
    enabled: true,
    maxFileSize: 100,
    retentionDays: 90,
    enableSignature: true,
    enableRemoteBackup: false,
  });

  // Alert Settings
  const [alertSettings, setAlertSettings] = useState({
    enableEmail: false,
    enableWebhook: false,
    alertOnHighRiskOnly: true,
    cooldownMinutes: 5,
  });

  const tabs = [
    { id: 'general', name: '通用', icon: CogIcon },
    { id: 'security', name: '安全策略', icon: ShieldCheckIcon },
    { id: 'ai', name: 'AI 分析', icon: CpuChipIcon },
    { id: 'audit', name: '审计日志', icon: DocumentTextIcon },
    { id: 'alerts', name: '告警', icon: BellIcon },
    { id: 'network', name: '网络', icon: GlobeAltIcon },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">通用设置</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                <div>
                  <h3 className="font-medium">开机自启</h3>
                  <p className="text-sm text-gray-400">系统启动时自动运行 AI Guardian</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generalSettings.autoStart}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, autoStart: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h3 className="font-medium mb-2">日志级别</h3>
                <select
                  value={generalSettings.logLevel}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, logLevel: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                >
                  <option value="debug">Debug</option>
                  <option value="info">Info</option>
                  <option value="warn">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>

              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h3 className="font-medium mb-2">工作线程数</h3>
                <input
                  type="number"
                  value={generalSettings.workerThreads}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, workerThreads: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                  min={1}
                  max={16}
                />
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">安全策略</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                <div>
                  <h3 className="font-medium">启用防护</h3>
                  <p className="text-sm text-gray-400">开启系统级防护功能</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={securitySettings.enabled}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h3 className="font-medium mb-2">防护模式</h3>
                <div className="space-y-2">
                  {[
                    { value: 'monitor', label: '监控模式', desc: '仅记录，不阻断' },
                    { value: 'interactive', label: '交互模式', desc: '询问用户后决定' },
                    { value: 'block', label: '阻断模式', desc: '自动阻断高风险操作' },
                  ].map((mode) => (
                    <label key={mode.value} className="flex items-start p-3 bg-gray-600 rounded-lg cursor-pointer hover:bg-gray-500 transition-colors">
                      <input
                        type="radio"
                        name="protectionMode"
                        value={mode.value}
                        checked={securitySettings.mode === mode.value}
                        onChange={(e) => setSecuritySettings({ ...securitySettings, mode: e.target.value })}
                        className="mt-1 mr-3"
                      />
                      <div>
                        <div className="font-medium">{mode.label}</div>
                        <div className="text-sm text-gray-400">{mode.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-medium">阻断策略</h3>
                
                <label className="flex items-center p-3 bg-gray-700/30 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={securitySettings.blockFileDelete}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, blockFileDelete: e.target.checked })}
                    className="mr-3 w-4 h-4"
                  />
                  <span>阻断文件删除操作</span>
                </label>

                <label className="flex items-center p-3 bg-gray-700/30 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={securitySettings.blockSystemPathWrite}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, blockSystemPathWrite: e.target.checked })}
                    className="mr-3 w-4 h-4"
                  />
                  <span>阻断系统路径写入</span>
                </label>

                <label className="flex items-center p-3 bg-gray-700/30 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={securitySettings.blockNetworkConnection}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, blockNetworkConnection: e.target.checked })}
                    className="mr-3 w-4 h-4"
                  />
                  <span>阻断可疑网络连接</span>
                </label>
              </div>
            </div>
          </div>
        );

      case 'ai':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">AI 分析设置</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                <div>
                  <h3 className="font-medium">启用 AI 分析</h3>
                  <p className="text-sm text-gray-400">使用 AI 分析命令语义和风险</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aiSettings.enabled}
                    onChange={(e) => setAiSettings({ ...aiSettings, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h3 className="font-medium mb-2">风险阈值: {aiSettings.riskThreshold}</h3>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={aiSettings.riskThreshold}
                  onChange={(e) => setAiSettings({ ...aiSettings, riskThreshold: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-400 mt-1">
                  <span>宽松</span>
                  <span>严格</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                <div>
                  <h3 className="font-medium">使用本地模型</h3>
                  <p className="text-sm text-gray-400">使用本地 LLM 进行分析（推荐）</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aiSettings.useLocalModel}
                    onChange={(e) => setAiSettings({ ...aiSettings, useLocalModel: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h3 className="font-medium mb-2">分析超时 (秒)</h3>
                <input
                  type="number"
                  value={aiSettings.analysisTimeout}
                  onChange={(e) => setAiSettings({ ...aiSettings, analysisTimeout: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                  min={1}
                  max={30}
                />
              </div>
            </div>
          </div>
        );

      case 'audit':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">审计日志设置</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                <div>
                  <h3 className="font-medium">启用审计日志</h3>
                  <p className="text-sm text-gray-400">记录所有安全事件</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={auditSettings.enabled}
                    onChange={(e) => setAuditSettings({ ...auditSettings, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h3 className="font-medium mb-2">最大文件大小 (MB)</h3>
                <input
                  type="number"
                  value={auditSettings.maxFileSize}
                  onChange={(e) => setAuditSettings({ ...auditSettings, maxFileSize: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                  min={10}
                  max={1000}
                />
              </div>

              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h3 className="font-medium mb-2">保留天数</h3>
                <input
                  type="number"
                  value={auditSettings.retentionDays}
                  onChange={(e) => setAuditSettings({ ...auditSettings, retentionDays: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                  min={1}
                  max={365}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                <div>
                  <h3 className="font-medium">启用数字签名</h3>
                  <p className="text-sm text-gray-400">使用 SHA256 签名保护日志完整性</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={auditSettings.enableSignature}
                    onChange={(e) => setAuditSettings({ ...auditSettings, enableSignature: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        );

      case 'alerts':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">告警设置</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                <div>
                  <h3 className="font-medium">启用邮件告警</h3>
                  <p className="text-sm text-gray-400">通过邮件接收安全告警</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertSettings.enableEmail}
                    onChange={(e) => setAlertSettings({ ...alertSettings, enableEmail: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                <div>
                  <h3 className="font-medium">启用 Webhook</h3>
                  <p className="text-sm text-gray-400">通过 Webhook 发送告警到外部系统</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertSettings.enableWebhook}
                    onChange={(e) => setAlertSettings({ ...alertSettings, enableWebhook: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                <div>
                  <h3 className="font-medium">仅告警高风险事件</h3>
                  <p className="text-sm text-gray-400">只发送高风险和严重事件的告警</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertSettings.alertOnHighRiskOnly}
                    onChange={(e) => setAlertSettings({ ...alertSettings, alertOnHighRiskOnly: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h3 className="font-medium mb-2">告警冷却时间 (分钟)</h3>
                <input
                  type="number"
                  value={alertSettings.cooldownMinutes}
                  onChange={(e) => setAlertSettings({ ...alertSettings, cooldownMinutes: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                  min={1}
                  max={60}
                />
              </div>
            </div>
          </div>
        );

      case 'network':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">网络设置</h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h3 className="font-medium mb-2">可疑端口列表</h3>
                <textarea
                  className="w-full h-32 px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white font-mono text-sm"
                  defaultValue="4444, 5555, 6666, 31337, 12345, 27374"
                />
                <p className="text-sm text-gray-400 mt-2">使用逗号分隔端口号</p>
              </div>

              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h3 className="font-medium mb-2">阻断的 IP 地址</h3>
                <textarea
                  className="w-full h-32 px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white font-mono text-sm"
                  placeholder="每行一个 IP 地址"
                />
              </div>

              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h3 className="font-medium mb-2">允许的域名</h3>
                <textarea
                  className="w-full h-32 px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white font-mono text-sm"
                  placeholder="每行一个域名"
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">设置</h1>

      <div className="flex gap-8">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-left ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-gray-800 rounded-xl p-6 border border-gray-700">
          {renderContent()}

          {/* Save Button */}
          <div className="mt-8 pt-6 border-t border-gray-700 flex justify-end">
            <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              保存设置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
