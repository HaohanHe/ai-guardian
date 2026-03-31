import React, { useState, useEffect } from 'react';
import { 
  ShieldCheckIcon, 
  ShieldExclamationIcon,
  ComputerDesktopIcon,
  LockClosedIcon,
  PlayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClockIcon,
  CpuChipIcon,
  WifiIcon,
  GlobeAltIcon,
  FolderIcon,
  DevicePhoneMobileIcon,
  BellIcon
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const Home: React.FC = () => {
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [threatsFound, setThreatsFound] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startQuickScan = () => {
    if (isScanning) return;
    
    setIsScanning(true);
    setScanProgress(0);
    setThreatsFound(0);
    
    toast.success('快速扫描已启动', {
      icon: '🔍',
      duration: 2000,
    });

    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          toast.success('扫描完成！系统安全', {
            icon: '✅',
            duration: 3000,
          });
          return 100;
        }
        if (prev === 30) {
          setThreatsFound(1);
          toast.error('发现潜在威胁！', {
            icon: '⚠️',
            duration: 2000,
          });
        }
        return prev + Math.random() * 3;
      });
    }, 100);
  };

  const protectionStatus = [
    { name: '实时防护', icon: ShieldCheckIcon, status: 'active', color: 'from-green-500 to-emerald-500' },
    { name: '防火墙', icon: LockClosedIcon, status: 'active', color: 'from-blue-500 to-cyan-500' },
    { name: 'Web 防护', icon: GlobeAltIcon, status: 'active', color: 'from-purple-500 to-pink-500' },
    { name: '系统加固', icon: ComputerDesktopIcon, status: 'warning', color: 'from-yellow-500 to-orange-500' },
  ];

  const recentActivities = [
    { time: '10:30:45', type: 'blocked', message: '拦截恶意程序: malware.exe', icon: XCircleIcon, color: 'text-red-500' },
    { time: '10:25:30', type: 'warning', message: '可疑文件检测: suspicious.dll', icon: ExclamationTriangleIcon, color: 'text-yellow-500' },
    { time: '10:20:15', type: 'safe', message: '文件已安全: document.pdf', icon: CheckCircleIcon, color: 'text-green-500' },
    { time: '10:15:00', type: 'safe', message: '系统更新完成', icon: CheckCircleIcon, color: 'text-green-500' },
  ];

  const quickActions = [
    { 
      name: '快速扫描', 
      icon: ShieldExclamationIcon, 
      color: 'from-red-500 to-orange-500',
      description: '扫描关键区域',
      onClick: startQuickScan
    },
    { 
      name: '全盘查杀', 
      icon: ComputerDesktopIcon, 
      color: 'from-blue-500 to-cyan-500',
      description: '深度完整扫描',
      onClick: () => toast.info('全盘扫描即将开始', { icon: '🔍' })
    },
    { 
      name: '实时防护', 
      icon: ShieldCheckIcon, 
      color: 'from-green-500 to-emerald-500',
      description: '开启/关闭防护',
      onClick: () => toast.success('防护状态已切换', { icon: '🛡️' })
    },
    { 
      name: '工具箱', 
      icon: CpuChipIcon, 
      color: 'from-purple-500 to-pink-500',
      description: '更多安全工具',
      onClick: () => window.location.href = '/toolbox'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Main Security Status Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 border border-slate-600/50">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>

        <div className="relative p-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            {/* Left Side - Status Display */}
            <div className="flex items-center gap-8">
              {/* Main Shield Icon */}
              <div className="relative">
                <div className="w-32 h-32 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-green-500/30 animate-pulse">
                  <ShieldCheckIcon className="w-16 h-16 text-white" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-green-400 rounded-2xl flex items-center justify-center border-4 border-slate-800">
                  <CheckCircleIcon className="w-6 h-6 text-green-900" />
                </div>
              </div>

              {/* Status Text */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-4xl font-bold">您的电脑很安全</h1>
                </div>
                <p className="text-slate-400 text-lg mb-4">所有防护模块正常运行中</p>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-green-400">实时防护已开启</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <ClockIcon className="w-4 h-4" />
                    <span>上次扫描: 2小时前</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Quick Actions */}
            <div className="flex flex-col gap-4">
              <button
                onClick={startQuickScan}
                disabled={isScanning}
                className={`relative overflow-hidden px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 ${
                  isScanning 
                    ? 'bg-slate-600 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:scale-[1.02]'
                }`}
              >
                {isScanning ? (
                  <div className="flex items-center gap-3">
                    <ArrowPathIcon className="w-6 h-6 animate-spin" />
                    扫描中... {Math.round(scanProgress)}%
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <PlayIcon className="w-6 h-6" />
                    立即扫描
                  </div>
                )}
              </button>
              
              {isScanning && (
                <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <CpuChipIcon className="w-5 h-5 text-blue-400" />
          快捷操作
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              className="group relative overflow-hidden rounded-xl bg-slate-800/50 border border-slate-700/50 p-6 hover:border-slate-600/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
              <div className="relative">
                <div className={`w-12 h-12 bg-gradient-to-br ${action.color} rounded-xl flex items-center justify-center mb-4 shadow-lg`}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-lg mb-1">{action.name}</h3>
                <p className="text-sm text-slate-400">{action.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Protection Modules */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-green-400" />
            防护模块
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {protectionStatus.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center`}>
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className={`text-sm ${
                      item.status === 'active' ? 'text-green-400' : 
                      item.status === 'warning' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {item.status === 'active' ? '运行中' : 
                       item.status === 'warning' ? '需要注意' : '已关闭'}
                    </p>
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full ${
                  item.status === 'active' ? 'bg-green-500 animate-pulse' : 
                  item.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <BellIcon className="w-5 h-5 text-yellow-400" />
            最近动态
          </h2>
          <div className="space-y-4">
            {recentActivities.map((activity, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-colors">
                <activity.icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${activity.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{activity.message}</p>
                  <p className="text-xs text-slate-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
            查看全部日志 →
          </button>
        </div>
      </div>

      {/* System Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: CpuChipIcon, label: 'CPU 使用率', value: '35%', color: 'text-blue-400' },
          { icon: WifiIcon, label: '网络状态', value: '正常', color: 'text-green-400' },
          { icon: FolderIcon, label: '磁盘空间', value: '256GB 可用', color: 'text-purple-400' },
        ].map((stat, index) => (
          <div key={index} className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-slate-400">{stat.label}</p>
              <p className={`font-semibold ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;
