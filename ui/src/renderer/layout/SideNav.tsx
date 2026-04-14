import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  HomeIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  CogIcon,
} from '@heroicons/react/24/outline'

const navItems = [
  { to: '/', label: '电脑体检', icon: HomeIcon },
  { to: '/protection', label: '防护中心', icon: ShieldCheckIcon },
  { to: '/logs', label: '安全日志', icon: DocumentTextIcon },
  { to: '/settings', label: '设置', icon: CogIcon },
]

const SideNav: React.FC = () => {
  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white/55 backdrop-blur">
      <div className="px-4 py-4">
        <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-500 px-4 py-4 text-white shadow-sm">
          <div className="text-sm font-semibold">一键防护</div>
          <div className="mt-1 text-xs text-white/80">把风险挡在系统之外</div>
        </div>
      </div>
      <nav className="px-3 pb-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-800 border border-brand-100'
                    : 'text-slate-700 hover:bg-slate-50',
                ].join(' ')
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}

export default SideNav
