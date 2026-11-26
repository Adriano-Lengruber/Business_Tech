'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import dynamic from 'next/dynamic';
import { Layers, Printer } from 'lucide-react';
import {
  calculate3dPrintQuote,
  PRINT_3D_STATUSES,
  type Print3dStatus,
} from '@al/shared';
import { ErpShell, type ErpSession } from '@/components/erp-shell';
import { apiFetch } from '@/lib/api';

const StlPreviewCanvas = dynamic(() => import('@/components/stl-preview'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[260px] items-center justify-center rounded-lg border border-border bg-bg text-xs text-text-muted">
      Carregando visualizador WebGL 3D...
    </div>
  ),
});

interface FilamentRow {
  id: string;
  name: string;
  materialType: string;
  color: string;
  costPerKgCents: number;
  stockGrams: number;
}

interface PrintJobRow {
  id: string;
  code: string;
  modelName: string;
  status: Print3dStatus;
  weightGrams: number;
  printTimeMinutes: number;
  totalCostCents: number;
  salePriceCents: number;
  filamentName: string;
  filamentColor: string;
}

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function Print3dContent({ session }: { session: ErpSession }) {
  const [filaments, setFilaments] = useState<FilamentRow[]>([]);
  const [jobs, setJobs] = useState<PrintJobRow[]>([]);
  const [stlBuffer, setStlBuffer] = useState<ArrayBuffer | null>(null);

  const [filamentId, setFilamentId] = useState('');
  const [modelName, setModelName] = useState('');
  const [weightGrams, setWeightGrams] = useState('120');
  const [printMinutes, setPrintMinutes] = useState('180');
  const [marginPct, setMarginPct] = useState('120');
  const [error, setError] = useState<string | null>(null);

  const enabled = session.enabledModules.includes('mod-3d-print');

  const load = useCallback(async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token || !enabled) return;
    const [fils, jobRows] = await Promise.all([
      apiFetch<FilamentRow[]>('/print3d/filaments', { token }),
      apiFetch<PrintJobRow[]>('/print3d/jobs', { token }),
    ]);
    setFilaments(fils);
    setJobs(jobRows);
    if (!filamentId && fils[0]) setFilamentId(fils[0].id);
  }, [enabled, filamentId]);

  useEffect(() => {
    void load().catch((e) => setError(String(e)));
  }, [load]);

  const selectedFil = filaments.find((f) => f.id === filamentId);
  const quote = calculate3dPrintQuote({
    weightGrams: Number(weightGrams) || 0,
    printTimeMinutes: Number(printMinutes) || 0,
    filamentCostPerKgCents: selectedFil?.costPerKgCents ?? 12000,
    profitMarginPercent: Number(marginPct) || 120,
  });

  async function handleCreateJob(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token || !filamentId) return;
    setError(null);
    try {
      await apiFetch('/print3d/jobs', {
        method: 'POST',
        token,
        body: JSON.stringify({
          filamentId,
          modelName,
          weightGrams: Number(weightGrams),
          printTimeMinutes: Number(printMinutes),
          profitMarginPercent: Number(marginPct),
        }),
      });
      setModelName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar job 3D');
    }
  }

  async function handleStatusChange(jobId: string, status: Print3dStatus) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    setError(null);
    try {
      await apiFetch(`/print3d/jobs/${jobId}/status`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status');
    }
  }

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-secondary">
        O módulo <strong>Estúdio de Impressão 3D</strong> está desativado.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Pré-visualização 3D (Three.js STL)</h2>
            <label className="cursor-pointer rounded border border-border px-2.5 py-1 text-xs hover:bg-surface-muted">
              Abrir .STL local
              <input
                type="file"
                accept=".stl"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setModelName((prev) => prev || file.name.replace(/\.stl$/i, ''));
                    void file.arrayBuffer().then(setStlBuffer);
                  }
                }}
              />
            </label>
          </div>
          <StlPreviewCanvas stlBuffer={stlBuffer} />
          <p className="text-xs text-text-muted">
            Arraste com o mouse para rotacionar e role para dar zoom. Carregue qualquer arquivo <code>.stl</code> para inspecionar a malha antes de imprimir.
          </p>
        </div>

        <form
          onSubmit={handleCreateJob}
          className="rounded-2xl border border-border bg-surface p-5 space-y-4"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Printer className="h-4 w-4 text-accent" />
            Orçamentação Automática & Nova Impressão
          </div>

          <input
            required
            placeholder="Nome da peça / projeto *"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
          />

          <select
            value={filamentId}
            onChange={(e) => setFilamentId(e.target.value)}
            className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
          >
            {filaments.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.materialType}) — Restante: {f.stockGrams}g
              </option>
            ))}
          </select>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs text-text-secondary">Peso (g)</label>
              <input
                type="number"
                min={1}
                value={weightGrams}
                onChange={(e) => setWeightGrams(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary">Tempo (min)</label>
              <input
                type="number"
                min={1}
                value={printMinutes}
                onChange={(e) => setPrintMinutes(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary">Margem (%)</label>
              <input
                type="number"
                min={0}
                value={marginPct}
                onChange={(e) => setMarginPct(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="rounded-md border border-border bg-bg p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-text-secondary">Material + Energia + Máquina (+10% falha):</span>
              <span className="font-mono font-semibold">{formatBrl(quote.totalCostCents)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-accent">
              <span>Preço Sugerido ao Cliente:</span>
              <span className="font-mono">{formatBrl(quote.suggestedPriceCents)}</span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
          >
            Enviar para Fila de Impressão
          </button>
        </form>
      </div>

      {/* Fila de Impressão */}
      <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Layers className="h-4 w-4 text-accent" />
          Fila de Impressoras ({jobs.length})
        </div>
        <div className="space-y-2">
          {jobs.map((j) => (
            <div
              key={j.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-bg px-4 py-3 text-sm"
            >
              <div>
                <span className="font-mono font-bold text-accent">{j.code}</span> ·{' '}
                <span className="font-medium">{j.modelName}</span>
                <p className="text-xs text-text-secondary">
                  {j.filamentName} · {j.weightGrams}g · {j.printTimeMinutes} min · Custo{' '}
                  {formatBrl(j.totalCostCents)} → Venda{' '}
                  <strong className="text-text-primary">{formatBrl(j.salePriceCents)}</strong>
                </p>
              </div>
              <select
                value={j.status}
                onChange={(e) =>
                  void handleStatusChange(j.id, e.target.value as Print3dStatus)
                }
                className="rounded border border-border bg-surface px-2.5 py-1.5 font-mono text-xs"
              >
                {PRINT_3D_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Print3dPage() {
  return (
    <ErpShell
      title="Estúdio de Impressão 3D"
      subtitle="Visualizador STL Three.js, cálculo automático de custo e fila de produção"
    >
      {(session) => <Print3dContent session={session} />}
    </ErpShell>
  );
}
