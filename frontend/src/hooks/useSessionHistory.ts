import { useState, useEffect, useCallback } from 'react';

export interface SessionRecord {
  id: string;
  date: string;
  romMax: number;
  stabilityScore: number;
  repCount: number;
}

const STORAGE_KEY = 'reconnect_sessions_v1';

export function useSessionHistory() {
  const [history, setHistory] = useState<SessionRecord[]>([]);

  // Load on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Failed to load history", e);
    }
  }, []);

  const saveSession = useCallback((stats: { maxRightElbowAngle: number, shoulderYSum: number, frameCount: number, repCount: number }) => {
    const record: SessionRecord = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      romMax: Math.round(stats.maxRightElbowAngle),
      stabilityScore: stats.frameCount > 0 ? parseFloat((stats.shoulderYSum / stats.frameCount).toFixed(4)) : 0,
      repCount: stats.repCount
    };

    setHistory(prev => {
      const updated = [...prev, record];
      // Limit to last 20 sessions to be safe
      const sliced = updated.slice(-20);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sliced));
      return sliced;
    });

    return record;
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }, []);

  return { history, saveSession, clearHistory };
}
