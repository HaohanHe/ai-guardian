/**
 * AI Guardian - Main Application Component
 * 
 * 主应用组件，包含路由和全局布局
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { 
  ShieldCheckIcon, 
  ChartBarIcon, 
  CogIcon, 
  DocumentTextIcon,
  BellIcon
} from '@heroicons/react/24/outline';
import { Toaster } from 'react-hot-toast';

// Pages
import Dashboard from './pages/Dashboard';
import Monitoring from './pages/Monitoring';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';
import { useBackendStore } from './store/backendStore';

const App: React.FC = () => {
  const { connected } = useBackendStore();

  return (
    <Router>
      <div className="flex h-screen bg-gray-900 text-white">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
          {/* Logo */}
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center space-x-3">
              <ShieldCheckIcon className="w-8 h-8 text-green-500" />
              <div>
                <h1 className="text-xl font-bold">AI Guardian</h1>
                <p className="text-xs text-gray-400">V2.0 System EDR</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              <ChartBarIcon className="w-5 h-5" />
              <span>概览</span>
            </NavLink>

            <NavLink
              to="/monitoring"
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              <BellIcon className="w-5 h-5" />
              <span>实时监控</span>
            </NavLink>

            <NavLink
              to="/logs"
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              <DocumentTextIcon className="w-5 h-5" />
              <span>审计日志</span>
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              <CogIcon className="w-5 h-5" />
              <span>设置</span>
            </NavLink>
          </nav>

          {/* Backend Status */}
          <div className="p-4 border-t border-gray-700">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-400">
                {connected ? '后端已连接' : '后端未连接'}
              </span>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/logs" element={<AuditLogs />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>

        {/* Toast Notifications */}
        <Toaster 
          position="top-right"
          toastOptions={{
            style: {
              background: '#1f2937',
              color: '#fff',
              border: '1px solid #374151',
            },
          }}
        />
      </div>
    </Router>
  );
};

export default App;
