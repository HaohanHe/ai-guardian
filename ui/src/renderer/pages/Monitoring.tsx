/**
 * AI Guardian - Monitoring Page
 *
 * 实时监控页面，展示 AI 终端进程和实时事件流
 */

import React, { useEffect, useState } from 'react';
import { 
  CpuChipIcon, 
  PlayIcon, 
  StopIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon
} from '@heroicons/react/24/outline';

interface Process {
  id: string;
  pid: number;
  name: string;
  command: string;
  status: 'running' | 'stopped';
  riskScore: number;
  eventsCount: number;
}

const Monitoring: React.FC = () => {
  const [processes, setProcesses] = useState<Process[]>([
    { id: '1', pid: 1234, name: 'node', command: 'node server.js', status: 'running', riskScore: 15, eventsCount: 45 },
    { id: '2', pid: 5678, name: 'python', command: 'python app.py', status: 'running', riskScore: 25, eventsCount: 23 },
    { id: '3', pid: 9012, name: 'bash', command: 'bash script.sh', status: 'running', riskScore: 85, eventsCount: 12 },
  ]);

  const [logs, setLogs] = useState<string[]>([
    '[2024-01-15 10:30:45] INFO: Process 1234 (node) - File Open: /home/user/project/package.json',
    '[2024-01-15 10:30:46] WARN: Process 5678 (python) - Network Connect: 192.168.1.100:8080',
    '[2024-01-15 10:30:47] BLOCK: Process 9012 (bash) - Blocked: rm -rf /etc',
    '[2024-01-15 10:30:48] INFO: Process 1234 (node) - File Read: /home/user/project/src/index.js',
  ]);

  // 模拟实时日志更新
  useEffect(() => {
    const interval = setInterval(() => {
      const newLog = `[${new Date().toLocaleTimeString()}] INFO: System check - All modules operational`;
      setLogs(prev => [newLog, ...prev].slice(0, 100));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getRiskColor = (score: number) => {
    if (score >= 85) return 'text-red-500 bg-red-500/10';
    if (score >= 60) return 'text-orange-500 bg-orange-500/10';
    if (score >= 30) return 'text-yellow-500 bg-yellow-500/10';
    return 'text-green-500 bg-green-500/10';
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">实时监控</h1>
        <p className="text-gray-400 mt-1">监控 AI 终端进程活动</p>
      </div>

      {/* AI Processes */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold">AI 终端进程</h2>
          <div className="flex space-x-2">
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors">
              添加进程
            </button>
            <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">
              刷新
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">PID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">进程名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">命令行</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">风险分</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">事件数</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {processes.map((process) => (
                <tr key={process.id} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono">{process.pid}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <CpuChipIcon className="w-4 h-4 mr-2 text-gray-500" />
                      <span className="text-sm font-medium">{process.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400 font-mono truncate max-w-xs">
                    {process.command}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center text-sm ${
                      process.status === 'running' ? 'text-green-500' : 'text-gray-500'
                    }`}>
                      {process.status === 'running' ? (
                        <><PlayIcon className="w-4 h-4 mr-1" /> 运行中</>
                      ) : (
                        <><StopIcon className="w-4 h-4 mr-1" /> 已停止</>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-sm font-semibold ${getRiskColor(process.riskScore)}`}>
                      {process.riskScore}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">{process.eventsCount}</td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      <button className="text-blue-500 hover:text-blue-400 text-sm">详情</button>
                      <button className="text-red-500 hover:text-red-400 text-sm">停止</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-time Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Event Stream */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-lg font-semibold">实时事件流</h2>
          </div>
          <div className="h-96 overflow-y-auto p-4 space-y-2 font-mono text-sm">
            {logs.map((log, index) => (
              <div 
                key={index} 
                className={`p-2 rounded ${
                  log.includes('BLOCK') ? 'bg-red-500/10 text-red-400' :
                  log.includes('WARN') ? 'bg-yellow-500/10 text-yellow-400' :
                  'text-gray-400'
                }`}
              >
                {log}
              </div>
            ))}
          </div>
        </div>

        {/* Protection Status */}
        <div className="space-y-6">
          {/* Status Cards */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-4">防护模块状态</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                <div className="flex items-center">
                  <ShieldCheckIcon className="w-5 h-5 text-green-500 mr-3" />
                  <span>文件系统监控</span>
                </div>
                <span className="text-green-500 text-sm">运行中</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                <div className="flex items-center">
                  <ShieldCheckIcon className="w-5 h-5 text-green-500 mr-3" />
                  <span>进程监控</span>
                </div>
                <span className="text-green-500 text-sm">运行中</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                <div className="flex items-center">
                  <ShieldCheckIcon className="w-5 h-5 text-green-500 mr-3" />
                  <span>网络监控</span>
                </div>
                <span className="text-green-500 text-sm">运行中</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                <div className="flex items-center">
                  <ShieldCheckIcon className="w-5 h-5 text-green-500 mr-3" />
                  <span>AI 分析引擎</span>
                </div>
                <span className="text-green-500 text-sm">运行中</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-4">快速操作</h2>
            <div className="grid grid-cols-2 gap-4">
              <button className="p-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-500 transition-colors">
                <NoSymbolIcon className="w-6 h-6 mx-auto mb-2" />
                <span className="text-sm">紧急阻断</span>
              </button>
              <button className="p-4 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-yellow-500 transition-colors">
                <ExclamationTriangleIcon className="w-6 h-6 mx-auto mb-2" />
                <span className="text-sm">生成报告</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Monitoring;
