/**
 * AI Guardian - Stats Store
 *
 * 统计数据状态管理
 */

import { create } from 'zustand';

interface Stats {
  totalEvents: number;
  blockedEvents: number;
  allowedEvents: number;
  aiProcessCount: number;
  activeProcesses: number;
  lowRiskEvents: number;
  mediumRiskEvents: number;
  highRiskEvents: number;
  criticalRiskEvents: number;
}

interface StatsStore {
  stats: Stats;
  fetchStats: () => Promise<void>;
}

export const useStatsStore = create<StatsStore>((set) => ({
  stats: {
    totalEvents: 15234,
    blockedEvents: 1289,
    allowedEvents: 13945,
    aiProcessCount: 5,
    activeProcesses: 3,
    lowRiskEvents: 12000,
    mediumRiskEvents: 2500,
    highRiskEvents: 600,
    criticalRiskEvents: 134,
  },

  fetchStats: async () => {
    try {
      // 实际应该调用后端 API
      // const response = await window.electronAPI.sendCommand('get-stats');
      // set({ stats: response.data });

      // 模拟数据更新
      set((state) => ({
        stats: {
          ...state.stats,
          totalEvents: state.stats.totalEvents + Math.floor(Math.random() * 10),
        },
      }));
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  },
}));
