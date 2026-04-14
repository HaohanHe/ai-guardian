/**
 * AI Guardian - Main Application Component
 * 
 * 主应用组件，包含路由和全局布局
 */

import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Shell from './layout/Shell'
import HealthCheck from './pages/HealthCheck'
import Monitoring from './pages/Monitoring'
import AuditLogs from './pages/AuditLogs'
import Settings from './pages/Settings'
import Dashboard from './pages/Dashboard'

const App: React.FC = () => {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<HealthCheck />} />
        <Route path="/protection" element={<Monitoring />} />
        <Route path="/logs" element={<AuditLogs />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/overview" element={<Dashboard />} />
      </Route>
    </Routes>
  )
}

export default App
