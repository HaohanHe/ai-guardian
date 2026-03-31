import React, { useState } from 'react';
import { 
  DocumentTextIcon, 
  MagnifyingGlassIcon,
  TrashIcon,
  EyeIcon,
  ClockIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  CogIcon
} from '@heroicons/react/24/solid';

const Logs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'protection' | 'scan' | 'firewall' | 'update'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<'all' | 'info' | 'warning' | 'error' | 'critical'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const logs = [
    { id: 1, time: '2024-01-15 10:35:20', level: 'error', type: 'protection', module: '文件系统防护', message: '阻止了恶意文件', details: '文件: virus.exe, 路径: C:\\Users\\User\\AppData\\Temp\\virus.exe', action: '已阻断' },
    { id: 2, time: '2024-01-15 10:32:15', level: 'warning', type: 'protection', module: '进程防护', message: '检测到可疑进程行为', details: '进程: suspicious.exe, PID: 4567', action: '已监控' },
    { id: 3, time: '2024-01-15 10:30:00', level: 'info', type: 'scan', module: '病毒查杀', message: '快速扫描完成', details: '扫描文件: 12,456个, 发现威胁: 0个', action: '完成' },
    { id: 4, time: '2024-01-15 10:28:45', level: 'critical', type: 'firewall', module: '网络防护', message: '阻止了入侵尝试', details: '来源IP: 192.168.1.100, 端口: 22', action: '已阻断' },
    { id: 5, time: '2024-01-15 10:25:30', level: 'info', type: 'update', module: '更新', message: '病毒库已更新', details: '版本: 2024.01.15.01, 新增特征: 1,234个', action: '成功' },
    { id: 6, time: '2024-01-15 10:22:10', level: 'warning', type: 'protection', module: '注册表防护', message: '检测到注册表修改', details: '路径: HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', action: '已阻止' },
    { id: 7, time: '2024-01-15 10:20:00', level: 'info', type: 'scan', module: '病毒查杀', message: '开始快速扫描', details: '扫描范围: 系统关键区域', action: '开始' },
    { id: 8, time: '2024-01-15 10:18:30', level: 'error', type: 'protection', module: 'Web 防护', message: '阻止了恶意网站访问', details: 'URL: malicious-site.com, 类别: 钓鱼网站', action: '已阻断' },
  ];

  const tabs = [
    { id: 'all', name: '全部日志', icon: DocumentTextIcon },
    { id: 'protection', name: '防护日志', icon: ShieldCheckIcon },
    { id: 'scan', name: '扫描日志', icon: MagnifyingGlassIcon },
    { id: 'firewall', name: '防火墙日志', icon: ShieldCheckIcon },
    { id: 'update', name: '更新日志', icon: ArrowPathIcon },
  ];

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'critical': return XCircleIcon;
      case 'error': return ExclamationTriangleIcon;
      case 'warning': return ExclamationTriangleIcon;
      case 'info': return CheckCircleIcon;
      default: return CheckCircleIcon;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'error': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'warning': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'info': return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
      default: return 'text-slate-500 bg-slate-500/10 border-slate-500/30';
    }
  };

  const getLevelLabel = (level: string) => {
    switch (level) {
      case 'critical': return '严重';
      case 'error': return '错误';
      case 'warning': return '警告';
      case 'info': return '信息';
      default: return '信息';
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesTab = activeTab === 'all' || log.type === activeTab;
    const matchesLevel = selectedLevel === 'all' || log.level === selectedLevel;
    const matchesSearch = !searchQuery || 
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.module.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesLevel && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">日志中心</h1>
          <p className="text-slate-400">查看所有安全事件和操作记录</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-300 transition-colors">
            <DocumentTextIcon className="w-4 h-4" />
            导出日志
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors">
            <TrashIcon className="w-4 h-4" />
            清空日志
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="搜索日志..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {/* Level Filter */}
          <div className="flex items-center gap-2">
            <CogIcon className="w-4 h-4 text-slate-500" />
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value as any)}
              className="px-4 py-2.5 rounded-xl bg-slate-700/50 border border-slate-600/50 text-white focus:outline-none focus:border-blue-500/50"
            >
              <option value="all">所有级别</option>
              <option value="critical">严重</option>
              <option value="error">错误</option>
              <option value="warning">警告</option>
              <option value="info">信息</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-700/50 bg-slate-700/30 text-sm font-semibold text-slate-400">
          <div className="col-span-2 flex items-center gap-2">
            <ClockIcon className="w-4 h-4" />
            时间
          </div>
          <div className="col-span-1">级别</div>
          <div className="col-span-2">模块</div>
          <div className="col-span-4">消息</div>
          <div className="col-span-2">操作</div>
          <div className="col-span-1 text-right">详情</div>
        </div>

        {/* Logs */}
        <div className="divide-y divide-slate-700/50">
          {filteredLogs.map((log) => {
            const LevelIcon = getLevelIcon(log.level);
            return (
              <div key={log.id} className="grid grid-cols-12 gap-4 p-4 hover:bg-slate-700/30 transition-colors items-center">
                <div className="col-span-2 text-sm text-slate-400 font-mono">
                  {log.time}
                </div>
                <div className="col-span-1">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${getLevelColor(log.level)}`}>
                    <LevelIcon className="w-3 h-3" />
                    {getLevelLabel(log.level)}
                  </span>
                </div>
                <div className="col-span-2 text-sm text-slate-300">
                  {log.module}
                </div>
                <div className="col-span-4">
                  <p className="text-sm font-medium">{log.message}</p>
                  <p className="text-xs text-slate-500 truncate">{log.details}</p>
                </div>
                <div className="col-span-2">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    log.action === '已阻断' ? 'bg-red-500/20 text-red-400' :
                    log.action === '已监控' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {log.action}
                  </span>
                </div>
                <div className="col-span-1 text-right">
                  <button className="p-1.5 rounded-lg hover:bg-slate-600/50 text-slate-400 hover:text-white transition-colors">
                    <EyeIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredLogs.length === 0 && (
          <div className="p-12 text-center">
            <DocumentTextIcon className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <p className="text-slate-500">没有找到匹配的日志</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredLogs.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            显示 {filteredLogs.length} 条日志
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <span className="px-4 py-2 text-sm">第 {currentPage} 页</span>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Logs;
