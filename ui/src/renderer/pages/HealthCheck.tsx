import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  BoltIcon,
  WrenchScrewdriverIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { useBackendStore } from '../store/backendStore'

declare global {
  interface Window {
    electronAPI?: {
      getStats?: () => Promise<any>
      getConfig?: () => Promise<any>
      updateConfig?: (config: any) => Promise<any>
      getDriverStatus?: () => Promise<any>
      installDriver?: () => Promise<any>
    }
  }
}

type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

type RiskItem = {
  id: string
  level: RiskLevel
  title: string
  desc: string
  fixLabel?: string
  fix?: () => Promise<void>
}

const levelMeta: Record<RiskLevel, { label: string; ring: string; dot: string; text: string }> = {
  low: {
    label: '低风险',
    ring: 'ring-brand-100',
    dot: 'bg-brand-500',
    text: 'text-brand-800',
  },
  medium: {
    label: '中风险',
    ring: 'ring-accent-200',
    dot: 'bg-accent-500',
    text: 'text-accent-800',
  },
  high: {
    label: '高风险',
    ring: 'ring-orange-200',
    dot: 'bg-orange-500',
    text: 'text-orange-800',
  },
  critical: {
    label: '严重',
    ring: 'ring-red-200',
    dot: 'bg-red-500',
    text: 'text-red-700',
  },
}

const HealthCheck: React.FC = () => {
  const connected = useBackendStore((s) => s.connected)
  const [stats, setStats] = useState<any | null>(null)
  const [config, setConfig] = useState<any | null>(null)
  const [driverStatus, setDriverStatus] = useState<any | null>(null)

  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('等待体检')
  const [lastScanAt, setLastScanAt] = useState<number | null>(null)
  const [riskItems, setRiskItems] = useState<RiskItem[]>([])
  const timerRef = useRef<number | null>(null)

  const loadData = useCallback(async () => {
    const [statsRes, configRes, driverRes] = await Promise.allSettled([
      window.electronAPI?.getStats?.(),
      window.electronAPI?.getConfig?.(),
      window.electronAPI?.getDriverStatus?.(),
    ])
    if (statsRes.status === 'fulfilled') setStats(statsRes.value)
    if (configRes.status === 'fulfilled') setConfig(configRes.value)
    if (driverRes.status === 'fulfilled') setDriverStatus(driverRes.value)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [])

  const buildRiskItems = useCallback(
    (nextConfig: any | null) => {
      const items: RiskItem[] = []

      if (!connected) {
        items.push({
          id: 'backend',
          level: 'critical',
          title: '后端未连接',
          desc: '安全引擎未就绪，无法执行实时防护与策略拦截。',
        })
      }

      if (driverStatus && !driverStatus.loaded) {
        items.push({
          id: 'driver',
          level: driverStatus.installed ? 'high' : 'critical',
          title: driverStatus.installed ? '驱动未加载' : '驱动未安装',
          desc: '系统级防护需要驱动支持（文件/进程/网络关键路径拦截）。',
          fixLabel: '安装/修复驱动',
          fix: async () => {
            await window.electronAPI?.installDriver?.()
            toast.success('驱动安装已提交')
            await loadData()
          },
        })
      }

      const cfg = nextConfig ?? config
      if (cfg?.security) {
        if (!cfg.security.auto_block) {
          items.push({
            id: 'auto_block',
            level: 'medium',
            title: '未开启自动阻断',
            desc: '建议开启：风险超过阈值时自动阻断高危操作。',
            fixLabel: '开启自动阻断',
            fix: async () => {
              const updated = { ...cfg, security: { ...cfg.security, auto_block: true } }
              await window.electronAPI?.updateConfig?.(updated)
              setConfig(updated)
              toast.success('已开启自动阻断')
            },
          })
        }

        if (typeof cfg.security.risk_threshold === 'number' && cfg.security.risk_threshold > 70) {
          items.push({
            id: 'threshold',
            level: 'medium',
            title: '风险阈值过高',
            desc: `当前阈值 ${cfg.security.risk_threshold}，建议降低以提升拦截灵敏度。`,
            fixLabel: '设置为 60',
            fix: async () => {
              const updated = { ...cfg, security: { ...cfg.security, risk_threshold: 60 } }
              await window.electronAPI?.updateConfig?.(updated)
              setConfig(updated)
              toast.success('已更新风险阈值')
            },
          })
        }
      }

      if (stats && typeof stats.average_risk_score === 'number' && stats.average_risk_score >= 60) {
        items.push({
          id: 'risk_score',
          level: stats.average_risk_score >= 80 ? 'high' : 'medium',
          title: '近期风险偏高',
          desc: `平均风险分 ${(stats.average_risk_score || 0).toFixed(1)}，建议查看安全日志并加强策略。`,
        })
      }

      setRiskItems(items)
      return items
    },
    [connected, config, driverStatus, loadData, stats]
  )

  const overallStatus = useMemo(() => {
    const max = riskItems.reduce<RiskLevel | null>((acc, item) => {
      if (!acc) return item.level
      const order: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 }
      return order[item.level] > order[acc] ? item.level : acc
    }, null)
    if (!max) return { level: 'low' as RiskLevel, title: '安全', desc: '当前无明显风险项。' }
    if (max === 'critical') return { level: max, title: '高危', desc: '存在必须立即处理的风险项。' }
    if (max === 'high') return { level: max, title: '警告', desc: '存在高风险项，建议尽快修复。' }
    return { level: max, title: '注意', desc: '存在可优化项，建议修复提升防护。' }
  }, [riskItems])

  const runScan = async () => {
    if (scanning) return
    await loadData()
    setScanning(true)
    setProgress(0)
    setStage('初始化引擎')

    const stages = [
      '初始化引擎',
      '检查驱动与系统权限',
      '核验防护策略',
      '扫描近期安全事件',
      '评估风险与建议',
      '生成体检报告',
    ]

    let i = 0
    timerRef.current = window.setInterval(() => {
      i += 1
      const p = Math.min(100, Math.round((i / (stages.length * 6)) * 100))
      setProgress(p)
      const idx = Math.min(stages.length - 1, Math.floor(i / 6))
      setStage(stages[idx])
      if (p >= 100) {
        if (timerRef.current) window.clearInterval(timerRef.current)
      }
    }, 200)

    await new Promise((r) => setTimeout(r, stages.length * 6 * 200 + 50))
    setScanning(false)
    setProgress(100)
    setStage('体检完成')
    setLastScanAt(Date.now())
    buildRiskItems(null)
  }

  const oneClickFix = async () => {
    const fixable = riskItems.filter((i) => i.fix)
    if (fixable.length === 0) {
      toast('没有可自动修复的项', { icon: 'ℹ️' })
      return
    }

    for (const item of fixable) {
      try {
        await item.fix?.()
      } catch (e) {
        toast.error(`${item.title} 修复失败`)
      }
    }

    await loadData()
    buildRiskItems(null)
  }

  const statusMeta = levelMeta[overallStatus.level]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div
                className={[
                  'w-12 h-12 rounded-2xl ring-1 flex items-center justify-center',
                  statusMeta.ring,
                  overallStatus.level === 'critical'
                    ? 'bg-red-50'
                    : overallStatus.level === 'high'
                      ? 'bg-orange-50'
                      : overallStatus.level === 'medium'
                        ? 'bg-accent-50'
                        : 'bg-brand-50',
                ].join(' ')}
              >
                {overallStatus.level === 'critical' || overallStatus.level === 'high' ? (
                  <ExclamationTriangleIcon className={`w-6 h-6 ${statusMeta.text}`} />
                ) : (
                  <ShieldCheckIcon className={`w-6 h-6 ${statusMeta.text}`} />
                )}
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900">
                  电脑体检：{overallStatus.title}
                  <span className="ml-2 text-sm font-medium text-slate-500">({statusMeta.label})</span>
                </div>
                <div className="mt-1 text-sm text-slate-600">{overallStatus.desc}</div>
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${connected ? 'bg-brand-600' : 'bg-red-500'}`} />
                    {connected ? '引擎在线' : '引擎离线'}
                  </span>
                  <span>•</span>
                  <span>
                    上次体检：
                    {lastScanAt ? new Date(lastScanAt).toLocaleString() : '未体检'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={runScan}
                disabled={scanning}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold disabled:opacity-60"
              >
                {scanning ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <BoltIcon className="w-5 h-5" />}
                一键体检
              </button>
              <button
                type="button"
                onClick={oneClickFix}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-brand-50 text-slate-900 font-semibold border border-slate-200"
              >
                <WrenchScrewdriverIcon className="w-5 h-5 text-slate-600" />
                一键修复
              </button>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{stage}</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-600 to-accent-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs text-slate-500">总事件数</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {(stats?.total_events ?? 0).toLocaleString?.() ?? stats?.total_events ?? 0}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs text-slate-500">阻断事件</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {(stats?.blocked_events ?? 0).toLocaleString?.() ?? stats?.blocked_events ?? 0}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs text-slate-500">平均风险</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {typeof stats?.average_risk_score === 'number' ? stats.average_risk_score.toFixed(1) : '-'}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">风险项</div>
            <div className="text-xs text-slate-500">{riskItems.length} 项</div>
          </div>

          <div className="mt-4 space-y-3">
            {riskItems.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-brand-50 px-4 py-4 text-sm text-brand-900">
                当前未发现需要处理的风险项。
              </div>
            ) : (
              riskItems.map((item) => {
                const meta = levelMeta[item.level]
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                          <span className="text-sm font-semibold text-slate-900">{item.title}</span>
                          <span className={`text-xs font-medium ${meta.text}`}>{meta.label}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{item.desc}</div>
                      </div>
                      {item.fix ? (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await item.fix?.()
                              buildRiskItems(null)
                            } catch {
                              toast.error('操作失败')
                            }
                          }}
                          className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                        >
                          {item.fixLabel || '修复'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="text-sm font-semibold text-slate-900">推荐策略</div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs text-slate-500">自动阻断</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {config?.security?.auto_block ? '已开启' : '未开启'}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs text-slate-500">风险阈值</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {typeof config?.security?.risk_threshold === 'number' ? config.security.risk_threshold : '-'}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs text-slate-500">网络拦截</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {config?.security?.block_network_connection ? '已开启' : '未开启'}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs text-slate-500">文件删除拦截</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {config?.security?.block_file_delete ? '已开启' : '未开启'}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="text-sm font-semibold text-slate-900">运行状态</div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs text-slate-500">驱动</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {driverStatus?.loaded ? '已加载' : driverStatus?.installed ? '未加载' : '未安装'}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs text-slate-500">AI 终端</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {typeof stats?.ai_terminals_count === 'number' ? stats.ai_terminals_count : '-'}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs text-slate-500">允许事件</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {(stats?.allowed_events ?? 0).toLocaleString?.() ?? stats?.allowed_events ?? 0}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs text-slate-500">告警</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {(stats?.warnings ?? 0).toLocaleString?.() ?? stats?.warnings ?? 0}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HealthCheck
