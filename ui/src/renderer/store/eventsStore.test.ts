/**
 * eventsStore 冒烟测试：事件前插与 100 条上限
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEventsStore, type SecurityEvent } from './eventsStore';

const makeEvent = (id: string): SecurityEvent => ({
  id,
  timestamp: Date.now(),
  processId: 1,
  processName: 'node',
  operation: 'File Delete',
  target: `/tmp/${id}.txt`,
  riskScore: 50,
  decision: 'allow',
});

describe('eventsStore', () => {
  beforeEach(() => {
    useEventsStore.setState({ recentEvents: [] });
  });

  it('addEvent 将新事件插到最前', () => {
    useEventsStore.getState().addEvent(makeEvent('a'));
    useEventsStore.getState().addEvent(makeEvent('b'));
    const ids = useEventsStore.getState().recentEvents.map(e => e.id);
    expect(ids).toEqual(['b', 'a']);
  });

  it('事件超过 100 条时只保留最新的 100 条', () => {
    for (let i = 0; i < 150; i++) {
      useEventsStore.getState().addEvent(makeEvent(String(i)));
    }
    const events = useEventsStore.getState().recentEvents;
    expect(events).toHaveLength(100);
    // 最新插入的是 149，最旧保留的应是 50
    expect(events[0].id).toBe('149');
    expect(events[99].id).toBe('50');
  });
});
