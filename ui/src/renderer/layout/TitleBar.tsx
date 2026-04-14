import React from 'react'
import {
  ShieldCheckIcon,
  MinusIcon,
  Square2StackIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useBackendStore } from '../store/backendStore'

declare global {
  interface Window {
    electronAPI?: {
      minimize?: () => Promise<void>
      maximize?: () => Promise<void>
      close?: () => Promise<void>
    }
  }
}

const TitleBar: React.FC = () => {
  const { connected } = useBackendStore()

  return (
    <div className="app-drag h-12 flex items-center justify-between px-4 bg-white/70 backdrop-blur border-b border-slate-200">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center shadow-sm">
          <ShieldCheckIcon className="w-5 h-5 text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-slate-900">AI Guardian 安全卫士</div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className={`inline-flex items-center gap-1 ${connected ? 'text-brand-700' : 'text-red-600'}`}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-brand-600' : 'bg-red-500'}`} />
              {connected ? '防护中' : '后端未连接'}
            </span>
          </div>
        </div>
      </div>

      <div className="app-no-drag flex items-center">
        <button
          type="button"
          onClick={() => window.electronAPI?.minimize?.()}
          className="w-10 h-8 inline-flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
        >
          <MinusIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => window.electronAPI?.maximize?.()}
          className="w-10 h-8 inline-flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
        >
          <Square2StackIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => window.electronAPI?.close?.()}
          className="w-10 h-8 inline-flex items-center justify-center text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default TitleBar
