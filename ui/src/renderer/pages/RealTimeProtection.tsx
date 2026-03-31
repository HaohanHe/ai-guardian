import React, { useState, useEffect } from 'react';
import { 
  ShieldCheckIcon, 
  ShieldExclamationIcon,
  LockClosedIcon,
  GlobeAltIcon,
  ComputerDesktopIcon,
  CpuChipIcon,
  WifiIcon,
  BellIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const RealTimeProtection: React.FC = () => {
  const [protectionModules, setProtectionModules] = useState([
    { id: 1, name: '文件系统防护', icon: ShieldCheckIcon, enabled: true, status: 'active', description: '监控文件读写操作，防止恶意文件感染' },
    { id: 2, name: '进程防护', icon: CpuChipIcon, enabled: true, status: 'active', description: '监控进程创建和行为，阻止可疑进程' },
    { id: 3, name: '网络防护', icon: WifiIcon, enabled: true, status: 'active', description: '监控网络连接，阻止恶意网络访问' },
    { id: 4, name: 'Web 防护', icon: GlobeAltIcon, enabled: false, status: 'inactive', description: '保护浏览器安全，阻止恶意网站' },
    { id: 5, name: '注册表防护', icon: LockClosedIcon, enabled: true, status: 'warning', description: '监控注册表修改，防止系统被篡改' },
    { id: 6, name: 'USB 防护', icon: ComputerDesktopIcon, enabled: true, status: 'active', description: '监控 USB 设备接入，防止自动运行病毒' },
  ]);

  const [recentEvents, setRecentEvents] = useState([
    { id: 1, time: '10:35:20', type: 'blocked', module: '文件系统防护', message: '阻止了恶意文件: virus.exe', details: 'C:\\Users\\User\\AppData\\Temp\\virus.exe' },
    { id: 2, time: '10:32:15', type: 'warning', module: '进程防护', message: '检测到可疑进程行为', details: '进程: suspicious.exe, PID: 4567' },
    { id: 3, time: '10:30:00', type: 'allowed', module: '网络防护', message: '安全网络连接', details: '连接到: github.com:443' },
    { id: 4, time: '10:28:45', type: 'blocked', module: '注册表防护', message: '阻止了注册表修改', details: '路径: HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' },
    { id: 5, time: '10:25:30', type: 'allowed', module: 'USB 防护', message: 'USB 设备安全接入', details: '设备: Kingston DataTraveler' },
  ]);

  const [stats, setStats] = useState({
    todayBlocked: 23,
    todayAllowed: 156,
    totalBlocked: 1247,
    uptime: '7天 12小时 34分钟',
  });

  const toggleModule = (id: number) => {
    setProtectionModules(prev => prev.map(module => {
      if (module.id === id) {
        const newEnabled = !module.enabled;
        const newStatus = newEnabled ? 'active' : 'inactive';
        toast.success(`${module.name} 已${newEnabled ? '开启' : '关闭'}`, {
          icon: newEnabled ? '✅' : '🔴',
        });
        return { ...module, enabled: newEnabled, status: newStatus };
      }
      return module;
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-500 bg-green-500/10';
      case 'warning': return 'text-yellow-500 bg-yellow-500/10';
      case 'inactive': return 'text-slate-500 bg-slate-500/10';
      default: return 'text-slate-500 bg-slate-500/10';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'blocked': return XCircleIcon;
      case 'warning': return ExclamationTriangleIcon;
      case 'allowed': return CheckCircleIcon;
      default: return BellIcon;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'blocked': return 'text-red-500 bg-red-500/10';
      case 'warning': return 'text-yellow-500 bg-yellow-500/10';
      case 'allowed': return 'text-green-500 bg-green-500/10';
      default: return 'text-slate-500 bg-slate-500/10';
    }
  };

  const activeModules = protectionModules.filter(m => m.enabled).length;
  const totalModules = protectionModules.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">实时防护</h1>
          <p className="text-slate-400">全方位实时保护您的系统安全</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <ClockIcon className="w-4 h-4" />
          <span>运行时间: {stats.uptime}</span>
        </div>
      </div>

      {/* Main Status Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 border border-slate-600/50">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-green-500 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
        </div>

        <div className="relative p-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            {/* Left - Status Display */}
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className={`w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl ${
                  activeModules === totalModules 
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-500/30' 
                    : activeModules > 0 
                      ? 'bg-gradient-to-br from-yellow-500 to-orange-600 shadow-yellow-500/30'
                      : 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/30'
                }`}>
                  <ShieldCheckIcon className="w-12 h-12 text-white" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-2xl flex items-center justify-center border-4 border-slate-800 bg-green-400">
                  <CheckCircleIcon className="w-5 h-5 text-green-900" />
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-bold mb-2">
                  {activeModules === totalModules 
                    ? '防护完全开启' 
                    : activeModules > 0 
                      ? '防护部分开启' 
                      : '防护已关闭'}
                </h2>
                <p className="text-slate-400 text-lg mb-3">
                  {activeModules}/{totalModules} 个防护模块正在运行
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-green-400 text-sm">实时监控中</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right - Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-700/30 rounded-xl p-4">
                <p className="text-sm text-slate-400 mb-1">今日拦截</p>
                <p className="text-2xl font-bold text-red-500">{stats.todayBlocked}</p>
              </div>
              <div className="bg-slate-700/30 rounded-xl p-4">
                <p className="text-sm text-slate-400 mb-1">今日允许</p>
                <p className="text-2xl font-bold text-green-500">{stats.todayAllowed}</p>
              </div>
              <div className="bg-slate-700/30 rounded-xl p-4">
                <p className="text-sm text-slate-400 mb-1">总拦截数</p>
                <p className="text-2xl font-bold text-blue-500">{stats.totalBlocked.toLocaleString()}</p>
              </div>
              <div className="bg-slate-700/30 rounded-xl p-4">
                <p className="text-sm text-slate-400 mb-1">活动模块</p>
                <p className="text-2xl font-bold text-purple-500">{activeModules}/{totalModules}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Protection Modules */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 overflow-hidden">
            <div className="p-6 border-b border-slate-700/50">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ShieldCheckIcon className="w-5 h-5 text-green-400" />
                  防护模块
                </h2>
                <button
                  onClick={() => {
                    const allEnabled = protectionModules.every(m => m.enabled);
                    setProtectionModules(prev => prev.map(m => ({
                      ...m,
                      enabled: !allEnabled,
                      status: !allEnabled ? 'active' : 'inactive'
                    })));
                    toast.success(allEnabled ? '所有模块已关闭' : '所有模块已开启', {
                      icon: allEnabled ? '🔴' : '✅',
                    });
                  }}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  {protectionModules.every(m => m.enabled) ? '全部关闭' : '全部开启'}
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-700/50">
              {protectionModules.map((module) => {
                const Icon = module.icon;
                return (
                  <div
                    key={module.id}
                    className="p-4 hover:bg-slate-700/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getStatusColor(module.status)}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold">{module.name}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              module.status === 'active' ? 'text-green-400 bg-green-500/10' :
                              module.status === 'warning' ? 'text-yellow-400 bg-yellow-500/10' :
                              'text-slate-400 bg-slate-500/10'
                            }`}>
                              {module.status === 'active' ? '运行中' :
                               module.status === 'warning' ? '需注意' : '已关闭'}
                            </span>
                          </div>
                          <p className="text-sm text-slate-400 mt-1">{module.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleModule(module.id)}
                        className={`relative w-16 h-8 rounded-full transition-colors ${
                          module.enabled ? 'bg-green-500' : 'bg-slate-600'
                        }`}
                      >
                        <div
                          className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                            module.enabled ? 'translate-x-9' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Events */}
        <div className="space-y-6">
          <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 overflow-hidden">
            <div className="p-6 border-b border-slate-700/50">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <BellIcon className="w-5 h-5 text-yellow-400" />
                实时事件
              </h2>
            </div>

            <div className="divide-y divide-slate-700/50 max-h-[500px] overflow-y-auto">
              {recentEvents.map((event) => {
                const Icon = getEventIcon(event.type);
                return (
                  <div key={event.id} className="p-4 hover:bg-slate-700/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${getEventColor(event.type)}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-400">{event.module}</span>
                          <span className="text-xs text-slate-500">{event.time}</span>
                        </div>
                        <p className="text-sm font-medium mt-1">{event.message}</p>
                        <p className="text-xs text-slate-500 mt-1 truncate">{event.details}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-slate-700/50">
              <button className="w-full text-sm text-blue-400 hover:text-blue-300 transition-colors">
                查看所有事件 →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeProtection;
