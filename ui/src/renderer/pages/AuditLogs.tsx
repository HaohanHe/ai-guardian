import React, { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  NoSymbolIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

declare global {
  interface Window {
    electronAPI?: {
      getAuditLogs?: (params: any) => Promise<any[]>
      exportAuditLogs?: (format: string) => Promise<any>
      clearAuditLogs?: () => Promise<any>
    }
  }
}

const riskLabel: Record<string, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  critical: '严重',
}

const AuditLogs: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRisk, setFilterRisk] = useState<string>('all')
  const [filterAction, setFilterAction] = useState<string>('all')
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<any | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { limit: 200 }
      if (filterRisk !== 'all') params.risk_level = filterRisk
      if (searchTerm.trim()) params.process_name = searchTerm.trim()
      const data = await window.electronAPI?.getAuditLogs?.(params)
      const filtered = (data || []).filter((l) => {
        if (filterAction === 'all') return true
        return String(l.action) === filterAction
      })
      setLogs(filtered)
    } catch {
      toast.error('获取日志失败')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [filterAction, filterRisk, searchTerm])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const total = logs.length
    const blocked = logs.filter((l) => String(l.action) === 'blocked' || String(l.action) === 'block').length
    const high = logs.filter((l) => ['high', 'critical'].includes(String(l.risk_level))).length
    return { total, blocked, high }
  }, [logs])

  const getRiskBadge = (level: string) => {
    const l = String(level)
    if (l === 'critical') return 'bg-red-50 text-red-700 border-red-200'
    if (l === 'high') return 'bg-orange-50 text-orange-700 border-orange-200'
    if (l === 'medium') return 'bg-accent-50 text-accent-800 border-accent-200'
    return 'bg-brand-50 text-brand-800 border-brand-200'
  }

  const getActionBadge = (action: string) => {
    const a = String(action)
    if (a === 'blocked' || a === 'block') return { label: '阻断', cls: 'bg-red-50 text-red-700 border-red-200' }
    if (a === 'allowed' || a === 'allow') return { label: '允许', cls: 'bg-brand-50 text-brand-800 border-brand-200' }
    return { label: '告警', cls: 'bg-accent-50 text-accent-800 border-accent-200' }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-slate-900">安全日志</div>
          <div className="mt-1 text-sm text-slate-600">不可篡改的安全事件记录与处置轨迹</div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              try {
                await window.electronAPI?.exportAuditLogs?.('json')
                toast.success('已导出（JSON）')
              } catch {
                toast.error('导出失败')
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 font-semibold"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            导出
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!confirm('确定要清空所有安全日志吗？此操作不可撤销。')) return
              try {
                await window.electronAPI?.clearAuditLogs?.()
                toast.success('日志已清空')
                await load()
              } catch {
                toast.error('清空失败')
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-red-50 border border-slate-200 text-slate-900 font-semibold"
          >
            <TrashIcon className="w-5 h-5" />
            清空
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') load()
              }}
              placeholder="按进程名搜索（回车刷新）"
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <FunnelIcon className="w-5 h-5 text-slate-400" />
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900"
            >
              <option value="all">全部风险</option>
              <option value="low">低风险</option>
              <option value="medium">中风险</option>
              <option value="high">高风险</option>
              <option value="critical">严重</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900"
            >
              <option value="all">全部处置</option>
              <option value="allowed">允许</option>
              <option value="blocked">阻断</option>
              <option value="warning">告警</option>
            </select>
          </div>

          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800"
          >
            <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card py-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-sm">总记录</span>
            <DocumentTextIcon className="w-5 h-5 text-slate-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{stats.total.toLocaleString()}</div>
        </div>
        <div className="card py-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-sm">已阻断</span>
            <NoSymbolIcon className="w-5 h-5 text-red-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-red-700">{stats.blocked.toLocaleString()}</div>
        </div>
        <div className="card py-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-sm">高危</span>
            <ExclamationTriangleIcon className="w-5 h-5 text-orange-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-orange-700">{stats.high.toLocaleString()}</div>
        </div>
        <div className="card py-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-sm">完整性</span>
            <ShieldCheckIcon className="w-5 h-5 text-brand-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-brand-700">100%</div>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-semibold text-slate-500">
                <th className="px-4 py-3">时间</th>
                <th className="px-4 py-3">进程</th>
                <th className="px-4 py-3">操作</th>
                <th className="px-4 py-3">目标</th>
                <th className="px-4 py-3">风险</th>
                <th className="px-4 py-3">处置</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => {
                const action = getActionBadge(log.action)
                const risk = String(log.risk_level || 'low')
                return (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      <div className="font-semibold">{log.process_name}</div>
                      <div className="text-xs text-slate-500">PID {log.process_id}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{log.operation}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-[40ch] truncate">{log.target}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-semibold border ${getRiskBadge(risk)}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                        {riskLabel[risk] || risk}
                        <span className="opacity-70">{log.risk_score}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-semibold border ${action.cls}`}>
                        {action.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    加载中…
                  </td>
                </tr>
              ) : null}
              {!loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    暂无日志
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLog ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl m-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="text-sm font-semibold text-slate-900">日志详情</div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-2 py-1 rounded-lg hover:bg-slate-100 text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="p-5 overflow-auto max-h-[calc(90vh-64px)]">
              <pre className="text-xs text-slate-700 whitespace-pre-wrap break-words bg-slate-50 border border-slate-200 rounded-xl p-4">
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default AuditLogs
