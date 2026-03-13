import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  ShieldCheckIcon,
  CpuChipIcon,
  BellIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  CogIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<any>;
      updateConfig: (config: any) => Promise<any>;
      resetConfig: () => Promise<any>;
      validateConfig: (config: any) => Promise<any>;
      getDriverStatus: () => Promise<any>;
      installDriver: () => Promise<any>;
      uninstallDriver: () => Promise<any>;
      getLLMProviders: () => Promise<any[]>;
      testLLMConnection: (provider: string) => Promise<any>;
      enableAutoStart: () => Promise<void>;
      disableAutoStart: () => Promise<void>;
      isAutoStartEnabled: () => Promise<{ enabled: boolean }>;
    };
  }
}

interface Config {
  general: {
    auto_start: boolean;
    minimize_to_tray: boolean;
    check_updates: boolean;
    language: string;
    theme: string;
  };
  security: {
    block_file_delete: boolean;
    block_system_path_write: boolean;
    block_network_connection: boolean;
    block_registry_modify: boolean;
    block_process_create: boolean;
    risk_threshold: number;
    auto_block: boolean;
    whitelist_mode: boolean;
  };
  ai: {
    enabled_terminals: string[];
    auto_detect: boolean;
    scan_interval: number;
  };
  llm: {
    provider: string;
    model: string;
    api_key?: string;
    base_url?: string;
    timeout: number;
    max_retries: number;
  };
  logging: {
    level: string;
    max_file_size: number;
    max_files: number;
    log_path: string;
  };
  notification: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
    email?: string;
  };
}

interface LLMProvider {
  id: string;
  name: string;
  models: string[];
  configured: boolean;
  healthy?: boolean;
}

interface DriverStatus {
  installed: boolean;
  loaded: boolean;
  version?: string;
  signing_status: string;
  test_mode_enabled: boolean;
  error?: string;
}

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [config, setConfig] = useState<Config | null>(null);
  const [originalConfig, setOriginalConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [llmProviders, setLLMProviders] = useState<LLMProvider[]>([]);
  const [driverStatus, setDriverStatus] = useState<DriverStatus | null>(null);
  const [testingLLM, setTestingLLM] = useState<string | null>(null);
  const [installingDriver, setInstallingDriver] = useState(false);
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadConfig();
    loadLLMProviders();
    loadDriverStatus();
    loadAutoStartStatus();
  }, []);

  useEffect(() => {
    if (config && originalConfig) {
      setHasChanges(JSON.stringify(config) !== JSON.stringify(originalConfig));
    }
  }, [config, originalConfig]);

  const loadConfig = async () => {
    try {
      const cfg = await window.electronAPI.getConfig();
      setConfig(cfg);
      setOriginalConfig(JSON.parse(JSON.stringify(cfg)));
      setLoading(false);
    } catch (error) {
      console.error('Failed to load config:', error);
      toast.error('加载配置失败');
      setLoading(false);
    }
  };

  const loadLLMProviders = async () => {
    try {
      const providers = await window.electronAPI.getLLMProviders();
      setLLMProviders(providers || []);
    } catch (error) {
      console.error('Failed to load LLM providers:', error);
    }
  };

  const loadDriverStatus = async () => {
    try {
      const status = await window.electronAPI.getDriverStatus();
      setDriverStatus(status);
    } catch (error) {
      console.error('Failed to load driver status:', error);
    }
  };

  const loadAutoStartStatus = async () => {
    try {
      const { enabled } = await window.electronAPI.isAutoStartEnabled();
      setAutoStartEnabled(enabled);
    } catch (error) {
      console.error('Failed to load auto start status:', error);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    try {
      const validation = await window.electronAPI.validateConfig(config);
      if (!validation.valid) {
        validation.errors.forEach((err: any) => {
          toast.error(`${err.field}: ${err.message}`);
        });
        setSaving(false);
        return;
      }

      await window.electronAPI.updateConfig(config);
      setOriginalConfig(JSON.parse(JSON.stringify(config)));
      setHasChanges(false);
      toast.success('配置已保存');
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('确定要重置所有设置吗？此操作不可撤销。')) return;

    try {
      const defaultConfig = await window.electronAPI.resetConfig();
      setConfig(defaultConfig);
      setOriginalConfig(JSON.parse(JSON.stringify(defaultConfig)));
      setHasChanges(false);
      toast.success('配置已重置');
    } catch (error) {
      console.error('Failed to reset config:', error);
      toast.error('重置配置失败');
    }
  };

  const handleTestLLM = async (providerId: string) => {
    setTestingLLM(providerId);
    try {
      await window.electronAPI.testLLMConnection(providerId);
      toast.success('LLM 连接测试成功');
      loadLLMProviders();
    } catch (error) {
      console.error('LLM test failed:', error);
      toast.error('LLM 连接测试失败');
    } finally {
      setTestingLLM(null);
    }
  };

  const handleInstallDriver = async () => {
    if (!confirm('安装驱动需要管理员权限，确定要继续吗？')) return;

    setInstallingDriver(true);
    try {
      const result = await window.electronAPI.installDriver();
      toast.success('驱动安装成功');
      if (result.requiresReboot) {
        toast('需要重启系统才能生效', { icon: 'ℹ️', duration: 10000 });
      }
      loadDriverStatus();
    } catch (error) {
      console.error('Driver install failed:', error);
      toast.error('驱动安装失败');
    } finally {
      setInstallingDriver(false);
    }
  };

  const handleUninstallDriver = async () => {
    if (!confirm('确定要卸载驱动吗？这将停止所有防护功能。')) return;

    setInstallingDriver(true);
    try {
      await window.electronAPI.uninstallDriver();
      toast.success('驱动已卸载');
      loadDriverStatus();
    } catch (error) {
      console.error('Driver uninstall failed:', error);
      toast.error('驱动卸载失败');
    } finally {
      setInstallingDriver(false);
    }
  };

  const handleAutoStartToggle = async () => {
    try {
      if (autoStartEnabled) {
        await window.electronAPI.disableAutoStart();
        setAutoStartEnabled(false);
        toast.success('已关闭开机自启');
      } else {
        await window.electronAPI.enableAutoStart();
        setAutoStartEnabled(true);
        toast.success('已开启开机自启');
      }
    } catch (error) {
      console.error('Failed to toggle auto start:', error);
      toast.error('设置开机自启失败');
    }
  };

  const updateConfigSection = <K extends keyof Config>(section: K, updates: Partial<Config[K]>) => {
    if (!config) return;
    setConfig({
      ...config,
      [section]: { ...config[section], ...updates },
    });
  };

  const tabs = [
    { id: 'general', name: '通用', icon: CogIcon },
    { id: 'security', name: '安全策略', icon: ShieldCheckIcon },
    { id: 'ai', name: 'AI 分析', icon: CpuChipIcon },
    { id: 'llm', name: 'LLM 配置', icon: CpuChipIcon },
    { id: 'driver', name: '驱动管理', icon: ShieldCheckIcon },
    { id: 'audit', name: '审计日志', icon: DocumentTextIcon },
    { id: 'alerts', name: '告警', icon: BellIcon },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <ArrowPathIcon className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full">
        <ExclamationCircleIcon className="w-12 h-12 text-red-500" />
        <p className="ml-4 text-gray-400">加载配置失败</p>
      </div>
    );
  }

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
                    checked={autoStartEnabled}
                    onChange={handleAutoStartToggle}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                <div>
                  <h3 className="font-medium">最小化到托盘</h3>
                  <p className="text-sm text-gray-400">关闭窗口时最小化到系统托盘</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.general.minimize_to_tray}
                    onChange={(e) => updateConfigSection('general', { minimize_to_tray: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                <div>
                  <h3 className="font-medium">自动检查更新</h3>
                  <p className="text-sm text-gray-400">定期检查新版本</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.general.check_updates}
                    onChange={(e) => updateConfigSection('general', { check_updates: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h3 className="font-medium mb-2">语言</h3>
                <select
                  value={config.general.language}
                  onChange={(e) => updateConfigSection('general', { language: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                >
                  <option value="zh-CN">简体中文</option>
                  <option value="en-US">English</option>
                </select>
              </div>

              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h3 className="font-medium mb-2">主题</h3>
                <select
                  value={config.general.theme}
                  onChange={(e) => updateConfigSection('general', { theme: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                >
                  <option value="dark">深色</option>
                  <option value="light">浅色</option>
                  <option value="system">跟随系统</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">安全策略</h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h3 className="font-medium mb-2">风险阈值: {config.security.risk_threshold}</h3>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={config.security.risk_threshold}
                  onChange={(e) => updateConfigSection('security', { risk_threshold: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-400 mt-1">
                  <span>宽松</span>
                  <span>严格</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                <div>
                  <h3 className="font-medium">自动阻断高风险操作</h3>
                  <p className="text-sm text-gray-400">超过阈值时自动阻断</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.security.auto_block}
                    onChange={(e) => updateConfigSection('security', { auto_block: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="space-y-3">
                <h3 className="font-medium">阻断策略</h3>
                
                {[
                  { key: 'block_file_delete', label: '阻断文件删除操作', desc: '防止 AI 删除重要文件' },
                  { key: 'block_system_path_write', label: '阻断系统路径写入', desc: '保护系统关键目录' },
                  { key: 'block_network_connection', label: '阻断可疑网络连接', desc: '防止数据外泄' },
                  { key: 'block_registry_modify', label: '阻断注册表修改', desc: '保护系统配置' },
                  { key: 'block_process_create', label: '阻断进程创建', desc: '防止执行危险程序' },
                ].map((item) => (
                  <label key={item.key} className="flex items-start p-3 bg-gray-700/30 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={config.security[item.key as keyof typeof config.security] as boolean}
                      onChange={(e) => updateConfigSection('security', { [item.key]: e.target.checked })}
                      className="mt-1 mr-3 w-4 h-4"
                    />
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-sm text-gray-400">{item.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'llm':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">LLM 配置</h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h3 className="font-medium mb-2">选择 LLM 供应商</h3>
                <div className="space-y-2">
                  {llmProviders.map((provider) => (
                    <div
                      key={provider.id}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                        config.llm.provider === provider.id
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-600 hover:border-gray-500'
                      }`}
                      onClick={() => updateConfigSection('llm', { 
                        provider: provider.id,
                        model: provider.models[0] || ''
                      })}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{provider.name}</span>
                            {provider.configured && (
                              <CheckCircleIcon className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            模型: {provider.models.join(', ')}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestLLM(provider.id);
                          }}
                          disabled={testingLLM === provider.id}
                          className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {testingLLM === provider.id ? '测试中...' : '测试连接'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h3 className="font-medium mb-2">API Key</h3>
                <input
                  type="password"
                  value={config.llm.api_key || ''}
                  onChange={(e) => updateConfigSection('llm', { api_key: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                  placeholder="输入 API Key"
                />
              </div>

              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h3 className="font-medium mb-2">Base URL (可选)</h3>
                <input
                  type="text"
                  value={config.llm.base_url || ''}
                  onChange={(e) => updateConfigSection('llm', { base_url: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                  placeholder="自定义 API 端点"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-700/30 rounded-lg">
                  <h3 className="font-medium mb-2">超时时间 (ms)</h3>
                  <input
                    type="number"
                    value={config.llm.timeout}
                    onChange={(e) => updateConfigSection('llm', { timeout: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                    min={1000}
                    max={120000}
                  />
                </div>

                <div className="p-4 bg-gray-700/30 rounded-lg">
                  <h3 className="font-medium mb-2">最大重试次数</h3>
                  <input
                    type="number"
                    value={config.llm.max_retries}
                    onChange={(e) => updateConfigSection('llm', { max_retries: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                    min={0}
                    max={10}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'driver':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">驱动管理</h2>
            
            <div className="p-4 bg-gray-700/30 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">驱动状态</h3>
                {driverStatus?.loaded && (
                  <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-500">
                    运行中
                  </span>
                )}
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">已安装:</span>
                  <span>{driverStatus?.installed ? '是' : '否'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">已加载:</span>
                  <span>{driverStatus?.loaded ? '是' : '否'}</span>
                </div>
                {driverStatus?.version && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">版本:</span>
                    <span>{driverStatus.version}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">签名状态:</span>
                  <span>{driverStatus?.signing_status}</span>
                </div>
                {driverStatus?.error && (
                  <div className="mt-2 p-2 bg-red-500/20 rounded text-red-500">
                    {driverStatus.error}
                  </div>
                )}
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={handleInstallDriver}
                disabled={installingDriver || driverStatus?.loaded}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {installingDriver ? '安装中...' : driverStatus?.loaded ? '已安装' : '安装驱动'}
              </button>
              <button
                onClick={handleUninstallDriver}
                disabled={installingDriver || !driverStatus?.installed}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                卸载驱动
              </button>
            </div>

            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <h4 className="font-medium text-yellow-500 mb-2">注意事项</h4>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• 安装驱动需要管理员权限</li>
                <li>• 测试签名的驱动需要启用测试模式</li>
                <li>• 某些情况下可能需要重启系统</li>
                <li>• 卸载驱动将停止所有防护功能</li>
              </ul>
            </div>
          </div>
        );

      case 'audit':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">审计日志设置</h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h3 className="font-medium mb-2">日志级别</h3>
                <select
                  value={config.logging.level}
                  onChange={(e) => updateConfigSection('logging', { level: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                >
                  <option value="debug">Debug</option>
                  <option value="info">Info</option>
                  <option value="warn">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-700/30 rounded-lg">
                  <h3 className="font-medium mb-2">最大文件大小 (MB)</h3>
                  <input
                    type="number"
                    value={config.logging.max_file_size / (1024 * 1024)}
                    onChange={(e) => updateConfigSection('logging', { 
                      max_file_size: parseInt(e.target.value) * 1024 * 1024 
                    })}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                    min={10}
                    max={1000}
                  />
                </div>

                <div className="p-4 bg-gray-700/30 rounded-lg">
                  <h3 className="font-medium mb-2">最大文件数</h3>
                  <input
                    type="number"
                    value={config.logging.max_files}
                    onChange={(e) => updateConfigSection('logging', { max_files: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                    min={1}
                    max={100}
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h3 className="font-medium mb-2">日志路径</h3>
                <input
                  type="text"
                  value={config.logging.log_path}
                  onChange={(e) => updateConfigSection('logging', { log_path: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                />
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
                  <h3 className="font-medium">启用通知</h3>
                  <p className="text-sm text-gray-400">接收安全事件通知</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.notification.enabled}
                    onChange={(e) => updateConfigSection('notification', { enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                <div>
                  <h3 className="font-medium">声音提醒</h3>
                  <p className="text-sm text-gray-400">播放提示音</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.notification.sound}
                    onChange={(e) => updateConfigSection('notification', { sound: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                <div>
                  <h3 className="font-medium">桌面通知</h3>
                  <p className="text-sm text-gray-400">显示系统桌面通知</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.notification.desktop}
                    onChange={(e) => updateConfigSection('notification', { desktop: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="p-4 bg-gray-700/30 rounded-lg">
                <h3 className="font-medium mb-2">邮件通知 (可选)</h3>
                <input
                  type="email"
                  value={config.notification.email || ''}
                  onChange={(e) => updateConfigSection('notification', { email: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                  placeholder="输入邮箱地址"
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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">设置</h1>
        {hasChanges && (
          <span className="text-sm text-yellow-500">有未保存的更改</span>
        )}
      </div>

      <div className="flex gap-8">
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

        <div className="flex-1 bg-gray-800 rounded-xl p-6 border border-gray-700">
          {renderContent()}

          <div className="mt-8 pt-6 border-t border-gray-700 flex justify-between">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              重置为默认
            </button>
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  setConfig(JSON.parse(JSON.stringify(originalConfig)));
                  setHasChanges(false);
                }}
                disabled={!hasChanges}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '保存中...' : '保存设置'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
