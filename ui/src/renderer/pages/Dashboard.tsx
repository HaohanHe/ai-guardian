/**
 * AI Guardian - Dashboard Page
 * 
 * 概览页面，展示系统状态、统计信息和实时活动
 */

import React, { useEffect, useState } from 'react';
import { 
  ShieldCheckIcon, 
  ExclamationTriangleIcon, 
  NoSymbolIcon,
  CheckCircleIcon,
  CpuChipIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { useStatsStore } from '../store/statsStore';
import { useEventsStore } from '../store/eventsStore';

const Dashboard: React.FC = () => {
  const { stats, fetchStats } = useStatsStore();
  const { recentEvents } = useEventsStore();
  const [timeRange, setTimeRange] = useState('24h');

  // 定期刷新统计数据
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // 模拟风险分布数据
  const riskDistribution = [
    { name: '无风险', value: stats.lowRiskEvents, color: '#10B981' },
    { name: '低风险', value: stats.mediumRiskEvents, color: '#F59E0B' },
    { name: '中风险', value: stats.highRiskEvents, color: '#EF4444' },
    { name: '高风险', value: stats.criticalRiskEvents, color: '#DC2626' },
  ];

  // 模拟活动趋势数据
  const activityTrend = [
    { time: '00:00', events: 12, blocked: 2 },
    { time: '04:00', events: 8, blocked: 1 },
    { time: '08:00', events: 45, blocked: 8 },
    { time: '12:00', events: 67, blocked: 12 },
    { time: '16:00', events: 89, blocked: 15 },
    { time: '20:00', events: 34, blocked: 5 },
  ];

  // 获取风险等级颜色
  const getRiskColor = (score: number) => {
    if (score >= 85) return 'text-red-500';
    if (score >= 60) return 'text-orange-500';
    if (score >= 30) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">系统概览</h1>
          <p className="text-gray-400 mt-1">实时监控 AI Agent 安全状态</p>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Events */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">总事件数</p>
              <p className="text-3xl font-bold mt-2">{stats.totalEvents.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <DocumentTextIcon className="w-6 h-6 text-blue-500" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-green-500 flex items-center">
              <CheckCircleIcon className="w-4 h-4 mr-1" />
              +12.5%
            </span>
            <span className="text-gray-500 ml-2">较上周期</span>
          </div>
        </div>

        {/* Blocked Events */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">已阻断</p>
              <p className="text-3xl font-bold mt-2 text-red-500">{stats.blockedEvents.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
              <NoSymbolIcon className="w-6 h-6 text-red-500" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-red-500">
              {((stats.blockedEvents / Math.max(stats.totalEvents, 1)) * 100).toFixed(1)}%
            </span>
            <span className="text-gray-500 ml-2">阻断率</span>
          </div>
        </div>

        {/* AI Processes */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">AI 终端进程</p>
              <p className="text-3xl font-bold mt-2">{stats.aiProcessCount}</p>
            </div>
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <CpuChipIcon className="w-6 h-6 text-purple-500" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-green-500">运行中</span>
            <span className="text-gray-500 ml-2">{stats.activeProcesses} 个活跃</span>
          </div>
        </div>

        {/* Protection Status */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">防护状态</p>
              <p className="text-3xl font-bold mt-2 text-green-500">正常</p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <ShieldCheckIcon className="w-6 h-6 text-green-500" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-green-500 flex items-center">
              <CheckCircleIcon className="w-4 h-4 mr-1" />
              所有模块正常
            </span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Trend */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">活动趋势</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activityTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="events" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  name="总事件"
                />
                <Line 
                  type="monotone" 
                  dataKey="blocked" 
                  stroke="#EF4444" 
                  strokeWidth={2}
                  name="已阻断"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">风险分布</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center space-x-4 mt-4">
            {riskDistribution.map((item) => (
              <div key={item.name} className="flex items-center">
                <div 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-400">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Events */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold">最近事件</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">进程</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">操作</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">目标</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">风险分</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">决策</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {recentEvents.slice(0, 10).map((event) => (
                <tr key={event.id} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center">
                      <CpuChipIcon className="w-4 h-4 mr-2 text-gray-500" />
                      {event.processName}
                      <span className="text-gray-500 ml-2">({event.processId})</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">{event.operation}</td>
                  <td className="px-6 py-4 text-sm text-gray-400 truncate max-w-xs">
                    {event.target}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-semibold ${getRiskColor(event.riskScore)}`}>
                      {event.riskScore}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      event.decision === 'block' 
                        ? 'bg-red-500/20 text-red-500' 
                        : event.decision === 'allow'
                        ? 'bg-green-500/20 text-green-500'
                        : 'bg-yellow-500/20 text-yellow-500'
                    }`}>
                      {event.decision === 'block' ? '阻断' : event.decision === 'allow' ? '允许' : '询问'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
