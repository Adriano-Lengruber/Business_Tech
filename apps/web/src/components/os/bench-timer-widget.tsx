'use client';

import { useState } from 'react';
import { Pause, Play, Timer } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { apiFetch } from '@/lib/api';

export interface OsTimersState {
  activeMinutes: number;
  waitMinutes: number;
  runningEntry: {
    id: string;
    mode: 'active_bench' | 'wait_approval' | 'wait_part';
    startedAt: string;
  } | null;
}

export function BenchTimerWidget({
  osId,
  timers,
  onUpdated,
}: {
  osId: string;
  timers: OsTimersState | null;
  onUpdated: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function startMode(mode: 'active_bench' | 'wait_approval' | 'wait_part') {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    setBusy(true);
    try {
      await apiFetch(`/service-orders/${osId}/timers/start`, {
        method: 'POST',
        token,
        body: JSON.stringify({ mode }),
      });
      await onUpdated();
    } finally {
      setBusy(false);
    }
  }

  async function stopRunning() {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    setBusy(true);
    try {
      await apiFetch(`/service-orders/${osId}/timers/stop`, {
        method: 'POST',
        token,
      });
      await onUpdated();
    } finally {
      setBusy(false);
    }
  }

  const runningMode = timers?.runningEntry?.mode ?? null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <Timer className="h-3.5 w-3.5 text-accent" />
          Cronômetro de Bancada vs. Espera
        </span>
        {runningMode && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            {runningMode === 'active_bench' ? 'ATIVO' : 'ESPERA'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl border border-border bg-bg p-2">
          <span className="block text-[10px] text-text-muted">Bancada Ativa</span>
          <span className="font-mono text-sm font-bold text-accent">
            {timers?.activeMinutes ?? 0} min
          </span>
        </div>
        <div className="rounded-xl border border-border bg-bg p-2">
          <span className="block text-[10px] text-text-muted">Aguardando Cliente/Peça</span>
          <span className="font-mono text-sm font-bold text-warning">
            {timers?.waitMinutes ?? 0} min
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={busy || runningMode === 'active_bench'}
          onClick={() => void startMode('active_bench')}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-accent/15 px-2.5 py-1.5 text-[11px] font-semibold text-accent hover:bg-accent/25 disabled:opacity-45"
        >
          <Play className="h-3 w-3" />
          Bancada
        </button>
        <button
          type="button"
          disabled={busy || runningMode === 'wait_part'}
          onClick={() => void startMode('wait_part')}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-[11px] font-medium hover:border-warning disabled:opacity-45"
        >
          Espera Peça
        </button>
        {runningMode && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void stopRunning()}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-[11px] font-medium text-danger"
          >
            <Pause className="h-3 w-3" />
            Pausar
          </button>
        )}
      </div>
    </Card>
  );
}
