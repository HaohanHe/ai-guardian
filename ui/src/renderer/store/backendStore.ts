/**
 * AI Guardian - Backend Store
 *
 * 后端连接状态管理
 */

import { create } from 'zustand';

interface BackendStore {
  connected: boolean;
  setConnected: (connected: boolean) => void;
}

export const useBackendStore = create<BackendStore>((set) => ({
  connected: false,
  setConnected: (connected) => set({ connected }),
}));
