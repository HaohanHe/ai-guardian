import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  CpuChipIcon,
  DocumentTextIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

declare global {
  interface Window {
    electronAPI: {
      getStats: () => Promise<any>;
      getBackendStatus: () => Promise<{ connected: boolean; healthy: boolean }>;
      getAITerminals: () => Promise<any[]>;
      getAuditLogs: (params: any) => Promise<any>;
      onBackendEvent: (callback: (event: any) => void) => () => void;
      onSecurityAlert: (callback: (alert: any) => void) => () => void;
      showNotification: (data: any) => Promise<void>;
    };
  }
}

interface Stats {
  total_events: number;
  blocked_events: number;
  allowed_events: number;
  warnings: number;
  ai_terminals_count: number;
  average_risk_score: number;
  uptime: number;
  events_by_type: Record<string, number>;
  events_by_hour: number[];
  top_processes: { name: string; count: number }[];
}

interface AITerminal {
  pid: number;
  name: string;
  path: string;
  command_line: string;
  start_time: string;
  is_tracked: boolean;
  risk_score: number;
  last_activity: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  operation: string;
  process_id: number;
  process_name: string;
  target: string;
  risk_score: number;
  risk_level: string;
  action: string;
  details: Record<string, any>;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [terminals, setTerminals] = useState<AITerminal[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [backendConnected, setBackendConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('24h');

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      
      const [statsResult, terminalsResult, logsResult, statusResult] = await Promise.allSettled([
        window.electronAPI.getStats(),
        window.electronAPI.getAITerminals(),
        window.electronAPI.getAuditLogs({ limit: 10 }),
        window.electronAPI.getBackendStatus(),
      ]);

      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value);
      } else {
        console.error('Failed to fetch stats:', statsResult.reason);
      }

      if (terminalsResult.status === 'fulfilled') {
        setTerminals(terminalsResult.value || []);
      }

      if (logsResult.status === 'fulfilled') {
        setRecentLogs(logsResult.value || []);
      }

      if (statusResult.status === 'fulfilled') {
        setBackendConnected(statusResult.value.connected);
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError(err instanceof Error ? err.message : '获取数据失败');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!window.electronAPI?.onBackendEvent) return;

    const unsubscribe = window.electronAPI.onBackendEvent((event) => {
      if (event.type === 'stats_update') {
        setStats(event.data);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onSecurityAlert) return;

    const unsubscribe = window.electronAPI.onSecurityAlert((alert) => {
      toast.error(`安全警告: ${alert.title}`, {
        duration: 10000,
        icon: '🚨',
      });

      window.electronAPI.showNotification({
        title: '安全警告',
        body: alert.description,
        type: 'warning',
      }).catch(console.error);
    });

    return unsubscribe;
  }, []);

  const getRiskColor = (score: number) => {
    if (score >= 85) return 'text-red-500';
    if (score >= 60) return 'text-orange-500';
    if (score >= 30) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getRiskBgColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500/20 text-red-500';
      case 'high': return 'bg-orange-500/20 text-orange-500';
      case 'medium': return 'bg-yellow-500/20 text-yellow-500';
      default: return 'bg-green-500/20 text-green-500';
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'blocked': return 'bg-red-500/20 text-red-500';
      case 'allowed': return 'bg-green-500/20 text-green-500';
      default: return 'bg-yellow-500/20 text-yellow-500';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}天 ${hours}小时`;
    if (hours > 0) return `${hours}小时 ${mins}分钟`;
    return `${mins}分钟`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center space-y-4">
          <ArrowPathIcon className="w-12 h-12 text-blue-500 animate-spin" />
          <p className="text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">连接失败</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  const riskDistribution = [
    { name: '低风险', value: stats?.events_by_type?.low || 0, color: '#10B981' },
    { name: '中风险', value: stats?.events_by_type?.medium || 0, color: '#F59E0B' },
    { name: '高风险', value: stats?.events_by_type?.high || 0, color: '#EF4444' },
    { name: '严重', value: stats?.events_by_type?.critical || 0, color: '#DC2626' },
  ];

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">系统概览</h1>
          <p className="text-gray-400 mt-1">实时监控 AI Agent 安全状态</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${backendConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-400">
              {backendConnected ? '后端已连接' : '后端未连接'}
            </span>
          </div>
          <div className="flex space-x-2">
            {['1h', '24h', '7d', '30d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">总事件数</p>
              <p className="text-3xl font-bold mt-2">
                {stats?.total_events?.toLocaleString() || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <DocumentTextIcon className="w-6 h-6 text-blue-500" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-gray-400">运行时间: {formatUptime(stats?.uptime || 0)}</span>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">已阻断</p>
              <p className="text-3xl font-bold mt-2 text-red-500">
                {stats?.blocked_events?.toLocaleString() || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
              <NoSymbolIcon className="w-6 h-6 text-red-500" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-red-500">
              {stats?.total_events 
                ? ((stats.blocked_events / stats.total_events) * 100).toFixed(1)
                : 0}%
            </span>
            <span className="text-gray-500 ml-2">阻断率</span>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">AI 终端进程</p>
              <p className="text-3xl font-bold mt-2">
                {stats?.ai_terminals_count || terminals.length}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <CpuChipIcon className="w-6 h-6 text-purple-500" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-green-500">{terminals.filter(t => t.is_tracked).length} 个追踪中</span>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">防护状态</p>
              <p className="text-3xl font-bold mt-2 text-green-500">
                {backendConnected ? '正常' : '异常'}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              backendConnected ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}>
              <ShieldCheckIcon className={`w-6 h-6 ${
                backendConnected ? 'text-green-500' : 'text-red-500'
              }`} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            {backendConnected ? (
              <span className="text-green-500 flex items-center">
                <CheckCircleIcon className="w-4 h-4 mr-1" />
                所有模块正常
              </span>
            ) : (
              <span className="text-red-500 flex items-center">
                <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                后端服务未连接
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">AI 终端进程</h3>
          {terminals.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CpuChipIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>暂无 AI 终端进程</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {terminals.map((terminal) => (
                <div
                  key={terminal.pid}
                  className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      terminal.is_tracked ? 'bg-green-500' : 'bg-gray-500'
                    }`} />
                    <div>
                      <p className="font-medium">{terminal.name}</p>
                      <p className="text-xs text-gray-400">PID: {terminal.pid}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${getRiskColor(terminal.risk_score)}`}>
                      风险: {terminal.risk_score}
                    </p>
                    <p className="text-xs text-gray-400">
                      {terminal.is_tracked ? '追踪中' : '未追踪'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">风险分布</h3>
          <div className="space-y-3">
            {riskDistribution.map((item) => (
              <div key={item.name} className="flex items-center">
                <div
                  className="w-3 h-3 rounded-full mr-3"
                  style={{ backgroundColor: item.color }}
                />
                <span className="flex-1 text-sm text-gray-400">{item.name}</span>
                <span className="text-sm font-medium">{item.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-700">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">平均风险分</span>
              <span className={`font-semibold ${getRiskColor(stats?.average_risk_score || 0)}`}>
                {(stats?.average_risk_score || 0).toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-semibold">最近事件</h3>
          <button
            onClick={() => window.location.href = '/logs'}
            className="text-sm text-blue-500 hover:text-blue-400"
          >
            查看全部
          </button>
        </div>
        {recentLogs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <DocumentTextIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>暂无审计日志</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">时间</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">进程</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">操作</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">目标</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">风险</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">决策</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center">
                        <CpuChipIcon className="w-4 h-4 mr-2 text-gray-500" />
                        {log.process_name}
                        <span className="text-gray-500 ml-2">({log.process_id})</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">{log.operation}</td>
                    <td className="px-6 py-4 text-sm text-gray-400 truncate max-w-xs">
                      {log.target}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getRiskBgColor(log.risk_level)}`}>
                        {log.risk_score}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getActionBadge(log.action)}`}>
                        {log.action === 'blocked' ? '阻断' : log.action === 'allowed' ? '允许' : '询问'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
