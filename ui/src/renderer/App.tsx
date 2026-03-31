import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { 
  ShieldCheckIcon, 
  ComputerDesktopIcon,
  LockClosedIcon,
  WrenchIcon,
  DocumentTextIcon,
  ClockIcon,
  CogIcon,
  BellIcon,
  ShieldExclamationIcon,
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
  HomeIcon,
  UserIcon
} from '@heroicons/react/24/solid';
import { Toaster } from 'react-hot-toast';

// Pages
import Home from './pages/Home';
import VirusScan from './pages/VirusScan';
import RealTimeProtection from './pages/RealTimeProtection';
import Toolbox from './pages/Toolbox';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import { useBackendStore } from './store/backendStore';

const AppContent: React.FC = () => {
  const { connected } = useBackendStore();
  const location = useLocation();
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { path: '/', icon: HomeIcon, label: '首页', color: 'from-blue-500 to-cyan-500' },
    { path: '/scan', icon: ShieldExclamationIcon, label: '病毒查杀', color: 'from-red-500 to-orange-500' },
    { path: '/protection', icon: ShieldCheckIcon, label: '实时防护', color: 'from-green-500 to-emerald-500' },
    { path: '/toolbox', icon: WrenchIcon, label: '工具箱', color: 'from-purple-500 to-pink-500' },
    { path: '/logs', icon: DocumentTextIcon, label: '日志中心', color: 'from-yellow-500 to-amber-500' },
    { path: '/settings', icon: CogIcon, label: '设置', color: 'from-gray-500 to-slate-500' },
  ];

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden select-none">
      {/* Sidebar */}
      <aside className={`${isMinimized ? 'w-20' : 'w-64'} bg-slate-800/90 backdrop-blur-xl border-r border-slate-700/50 flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <ShieldCheckIcon className="w-7 h-7 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-800 animate-pulse" />
            </div>
            {!isMinimized && (
              <div className="flex-1">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  AI Guardian
                </h1>
                <p className="text-xs text-slate-400">专业安全防护系统</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-300 group ${
                  isActive 
                    ? `bg-gradient-to-r ${item.color} text-white shadow-lg shadow-black/20 scale-[1.02]` 
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-white hover:scale-[1.02]'
                }`
              }
            >
              <item.icon className="w-6 h-6 flex-shrink-0" />
              {!isMinimized && (
                <span className="font-medium">{item.label}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Status Panel */}
        <div className="p-4 border-t border-slate-700/50">
          <div className="bg-slate-700/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-medium ${connected ? 'text-green-400' : 'text-red-400'}`}>
                {connected ? '防护已开启' : '防护已关闭'}
              </span>
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            </div>
            {!isMinimized && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">威胁拦截</span>
                  <span className="text-green-400 font-semibold">1,234</span>
                </div>
                <div className="w-full bg-slate-600/50 rounded-full h-1.5">
                  <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-1.5 rounded-full w-4/5" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Toggle Sidebar */}
        <div className="p-4 border-t border-slate-700/50">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="w-full flex items-center justify-center p-3 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
          >
            <ArrowPathIcon className={`w-5 h-5 text-slate-400 transition-transform ${isMinimized ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {navItems.find(item => item.path === location.pathname)?.label || '首页'}
                </h2>
                <p className="text-xs text-slate-400 flex items-center">
                  <ClockIcon className="w-3.5 h-3.5 mr-1.5" />
                  {currentTime.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                  {' '}
                  {currentTime.toLocaleTimeString('zh-CN')}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Notification Bell */}
              <button className="relative p-3 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-colors group">
                <BellIcon className="w-5 h-5 text-slate-400 group-hover:text-white" />
                <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full" />
              </button>

              {/* User Profile */}
              <div className="flex items-center space-x-3 px-3 py-2 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-colors cursor-pointer">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <UserIcon className="w-5 h-5" />
                </div>
                {!isMinimized && (
                  <div className="text-left">
                    <p className="text-sm font-medium">管理员</p>
                    <p className="text-xs text-slate-400">Pro 版本</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/scan" element={<VirusScan />} />
            <Route path="/protection" element={<RealTimeProtection />} />
            <Route path="/toolbox" element={<Toolbox />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </main>

      {/* Toast Notifications */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(15, 23, 42, 0.95)',
            color: '#fff',
            border: '1px solid rgba(51, 65, 85, 0.5)',
            backdropFilter: 'blur-xl',
          },
        }}
      />
    </div>
  );
};

const App: React.FC = () => {
  return <AppContent />;
};

export default App;
