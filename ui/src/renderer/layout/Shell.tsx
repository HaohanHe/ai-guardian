import React, { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import TitleBar from './TitleBar'
import SideNav from './SideNav'
import { useBackendStore } from '../store/backendStore'

declare global {
  interface Window {
    electronAPI?: {
      getBackendStatus?: () => Promise<{ connected: boolean; healthy: boolean }>
    }
  }
}

const Shell: React.FC = () => {
  const setConnected = useBackendStore((s) => s.setConnected)

  useEffect(() => {
    let cancelled = false

    const tick = async () => {
      try {
        const status = await window.electronAPI?.getBackendStatus?.()
        if (!cancelled && status) setConnected(Boolean(status.connected))
      } catch {
        if (!cancelled) setConnected(false)
      }
    }

    tick()
    const id = setInterval(tick, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [setConnected])

  return (
    <div className="h-screen w-screen overflow-hidden">
      <TitleBar />
      <div className="h-[calc(100vh-3rem)] flex">
        <SideNav />
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default Shell
