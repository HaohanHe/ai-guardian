import React, { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  CpuChipIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
  GlobeAltIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { useBackendStore } from '../store/backendStore'

declare global {
  interface Window {
    electronAPI?: {
      getAITerminals?: () => Promise<any[]>
      refreshAITerminals?: () => Promise<any>
      getAuditLogs?: (params: any) => Promise<any[]>
      getConfig?: () => Promise<any>
      updateConfig?: (config: any) => Promise<any>
      getDriverStatus?: () => Promise<any>
    }
  }
}

const Monitoring: React.FC = () => {
  const connected = useBackendStore((s) => s.connected)
  const [terminals, setTerminals] = useState<any[]>([])
  const [recent, setRecent] = useState<any[]>([])
  const [config, setConfig] = useState<any | null>(null)
  const [driverStatus, setDriverStatus] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [tRes, lRes, cRes, dRes] = await Promise.allSettled([
      window.electronAPI?.getAITerminals?.(),
      window.electronAPI?.getAuditLogs?.({ limit: 30 }),
      window.electronAPI?.getConfig?.(),
      window.electronAPI?.getDriverStatus?.(),
    ])

    if (tRes.status === 'fulfilled') setTerminals(tRes.value || [])
    if (lRes.status === 'fulfilled') setRecent(lRes.value || [])
    if (cRes.status === 'fulfilled') setConfig(cRes.value)
    if (dRes.status === 'fulfilled') setDriverStatus(dRes.value)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [load])

  const togglePolicy = async (key: string, value: boolean) => {
    if (!config) return
    const updated = { ...config, security: { ...config.security, [key]: value } }
    try {
      await window.electronAPI?.updateConfig?.(updated)
      setConfig(updated)
      toast.success('策略已更新')
    } catch {
      toast.error('策略更新失败')
    }
  }

  const getRiskBadge = (score: number) => {
    if (score >= 85) return 'bg-red-50 text-red-700 border-red-200'
    if (score >= 60) return 'bg-orange-50 text-orange-700 border-orange-200'
    if (score >= 30) return 'bg-accent-50 text-accent-800 border-accent-200'
    return 'bg-brand-50 text-brand-800 border-brand-200'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-slate-900">防护中心</div>
          <div className="mt-1 text-sm text-slate-600">实时策略 + AI 终端追踪 + 事件快照</div>
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              await window.electronAPI?.refreshAITerminals?.()
              await load()
              toast.success('已刷新')
            } catch {
              toast.error('刷新失败')
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 font-semibold"
        >
          <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">引擎状态</div>
            <span
              className={[
                'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border',
                connected ? 'bg-brand-50 text-brand-800 border-brand-200' : 'bg-red-50 text-red-700 border-red-200',
              ].join(' ')}
            >
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-brand-600' : 'bg-red-500'}`} />
              {connected ? '在线' : '离线'}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-sm text-slate-700">驱动</div>
              <div className="text-sm font-semibold text-slate-900">
                {driverStatus?.loaded ? '已加载' : driverStatus?.installed ? '未加载' : '未安装'}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-sm text-slate-700">终端数量</div>
              <div className="text-sm font-semibold text-slate-900">{terminals.length}</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 card">
          <div className="text-sm font-semibold text-slate-900">核心策略</div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => togglePolicy('auto_block', !config?.security?.auto_block)}
              className={[
                'rounded-2xl border px-4 py-4 text-left transition-colors',
                config?.security?.auto_block
                  ? 'border-brand-200 bg-brand-50 hover:bg-brand-100'
                  : 'border-slate-200 bg-white hover:bg-slate-50',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <ShieldCheckIcon className="w-5 h-5 text-slate-700" />
                <span className="text-xs font-semibold text-slate-600">
                  {config?.security?.auto_block ? '已开启' : '未开启'}
                </span>
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">自动阻断</div>
              <div className="mt-1 text-xs text-slate-500">超过阈值时自动拦截高危操作</div>
            </button>

            <button
              type="button"
              onClick={() => togglePolicy('block_network_connection', !config?.security?.block_network_connection)}
              className={[
                'rounded-2xl border px-4 py-4 text-left transition-colors',
                config?.security?.block_network_connection
                  ? 'border-brand-200 bg-brand-50 hover:bg-brand-100'
                  : 'border-slate-200 bg-white hover:bg-slate-50',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <GlobeAltIcon className="w-5 h-5 text-slate-700" />
                <span className="text-xs font-semibold text-slate-600">
                  {config?.security?.block_network_connection ? '已开启' : '未开启'}
                </span>
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">网络拦截</div>
              <div className="mt-1 text-xs text-slate-500">阻断可疑外联与高危端口</div>
            </button>

            <button
              type="button"
              onClick={() => togglePolicy('block_file_delete', !config?.security?.block_file_delete)}
              className={[
                'rounded-2xl border px-4 py-4 text-left transition-colors',
                config?.security?.block_file_delete
                  ? 'border-brand-200 bg-brand-50 hover:bg-brand-100'
                  : 'border-slate-200 bg-white hover:bg-slate-50',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <TrashIcon className="w-5 h-5 text-slate-700" />
                <span className="text-xs font-semibold text-slate-600">
                  {config?.security?.block_file_delete ? '已开启' : '未开启'}
                </span>
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">文件删除拦截</div>
              <div className="mt-1 text-xs text-slate-500">防止删除重要目录与关键文件</div>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">AI 终端进程</div>
            <div className="text-xs text-slate-500">按风险排序</div>
          </div>
          <div className="mt-4 space-y-3">
            {terminals.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                暂无 AI 终端进程
              </div>
            ) : (
              [...terminals]
                .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
                .slice(0, 12)
                .map((t) => (
                  <div key={t.pid} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                          <CpuChipIcon className="w-5 h-5 text-slate-700" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {t.name}
                            <span className="ml-2 text-xs text-slate-500">PID {t.pid}</span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500 truncate max-w-[36ch]">
                            {t.command_line || t.commandLine || t.path}
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                            <span className={`w-2 h-2 rounded-full ${t.is_tracked ? 'bg-brand-600' : 'bg-slate-300'}`} />
                            {t.is_tracked ? '追踪中' : '未追踪'}
                            {t.last_activity ? (
                              <>
                                <span>•</span>
                                <span>活跃：{new Date(t.last_activity).toLocaleTimeString()}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <span className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold border ${getRiskBadge(t.risk_score || 0)}`}>
                        风险 {t.risk_score ?? 0}
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">近期事件</div>
            <div className="text-xs text-slate-500">最近 30 条</div>
          </div>
          <div className="mt-4 space-y-2">
            {recent.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                暂无事件
              </div>
            ) : (
              recent.map((log) => {
                const level = String(log.risk_level || 'low')
                const badge =
                  level === 'critical'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : level === 'high'
                      ? 'bg-orange-50 text-orange-700 border-orange-200'
                      : level === 'medium'
                        ? 'bg-accent-50 text-accent-800 border-accent-200'
                        : 'bg-brand-50 text-brand-800 border-brand-200'

                const action =
                  log.action === 'blocked' || log.action === 'block'
                    ? { label: '阻断', cls: 'bg-red-50 text-red-700 border-red-200' }
                    : log.action === 'allowed' || log.action === 'allow'
                      ? { label: '允许', cls: 'bg-brand-50 text-brand-800 border-brand-200' }
                      : { label: '告警', cls: 'bg-accent-50 text-accent-800 border-accent-200' }

                return (
                  <div key={log.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${badge}`}>
                            {level.toUpperCase()}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${action.cls}`}>
                            {action.label}
                          </span>
                          <span className="text-xs text-slate-500">
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                          </span>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-900 truncate">
                          {log.process_name} ({log.process_id}) • {log.operation}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 truncate">{log.target}</div>
                      </div>
                      <div className="shrink-0 text-sm font-bold text-slate-900">{log.risk_score ?? '-'}</div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Monitoring
