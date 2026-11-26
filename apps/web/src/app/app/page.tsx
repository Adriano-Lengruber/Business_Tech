'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock, Sparkles, Wrench } from 'lucide-react';
import { OS_STATUS_LABELS, type OsStatus } from '@al/shared';
import { ErpShell, type ErpSession } from '@/components/erp-shell';
import { apiFetch } from '@/lib/api';

interface QueueMetrics {
  waitingHumanCount: number;
  urgentCount: number;
  inBenchCount: number;
  readyForPickupCount: number;
}

interface DailyBriefing {
  narrative: string;
  highlights: Array<{
    label: string;
    value: string;
    href: string;
    severity: string;
  }>;
}

interface ServiceOrderRow {
  id: string;
  code: string;
  status: OsStatus;
  priority: string;
  reportedSymptoms: string;
  customerName: string;
  customerPhone: string;
  assetBrand: string | null;
  assetModel: string | null;
}

function DashboardContent({ session }: { session: ErpSession }) {
  const [queue, setQueue] = useState<QueueMetrics | null>(null);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [orders, setOrders] = useState<ServiceOrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const hasOs = session.enabledModules.includes('mod-service-orders');
  const hasAi = session.enabledModules.includes('mod-ai-agents');

  useEffect(() => {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;

    if (hasOs) {
      Promise.all([
        apiFetch<QueueMetrics>('/service-orders/dashboard-queue', { token }),
        apiFetch<ServiceOrderRow[]>('/service-orders', { token }),
      ])
        .then(([q, list]) => {
          setQueue(q);
          setOrders(list);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Erro ao carregar fila');
        });
    }

    if (hasAi) {
      apiFetch<DailyBriefing>('/ai/briefing', { token })
        .then(setBriefing)
        .catch(() => undefined);
    }
  }, [hasOs, hasAi]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {briefing && (
        <section className="rounded-xl border border-accent/30 bg-surface p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
            <Sparkles className="h-4 w-4" />
            Daily AI Briefing Executivo
          </div>
          <p className="text-sm leading-relaxed text-text-primary">
            {briefing.narrative}
          </p>
          <div className="grid gap-2.5 pt-1 sm:grid-cols-2 lg:grid-cols-4">
            {briefing.highlights.map((h) => (
              <Link
                key={h.label}
                href={h.href}
                className="rounded-md border border-border bg-bg px-3 py-2 text-xs transition-colors hover:border-accent"
              >
                <span className="block text-text-muted">{h.label}</span>
                <span className="mt-0.5 block font-mono text-sm font-bold text-text-primary">
                  {h.value}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {queue && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/app/inbox"
            className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent"
          >
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span>WhatsApp Aguardando Humano</span>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums">
              {queue.waitingHumanCount}
            </p>
          </Link>

          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span>Prioridade Alta / Urgente</span>
              <Clock className="h-4 w-4 text-danger" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums">
              {queue.urgentCount}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span>Em Bancada / Diagnóstico</span>
              <Wrench className="h-4 w-4 text-accent" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums">
              {queue.inBenchCount}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span>Prontos p/ Retirada</span>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums">
              {queue.readyForPickupCount}
            </p>
          </div>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Ordens de Serviço (Clique para abrir detalhes, PDF e status)
          </h2>
          <span className="font-mono text-xs text-text-secondary tabular-nums">
            {orders.length} registro(s)
          </span>
        </div>

        {!hasOs ? (
          <div className="mt-3 rounded-lg border border-border bg-surface p-6 text-sm text-text-secondary">
            O módulo <strong>Assistência Técnica & OS</strong> está desativado.{' '}
            <Link href="/app/modules" className="text-accent underline">
              Ative em Módulos SaaS
            </Link>
            .
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-3 rounded-lg border border-border bg-surface p-6 text-sm text-text-secondary">
            Nenhuma OS cadastrada ainda. Clique em <strong>Nova OS</strong> no topo para iniciar no balcão.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-muted/60 text-xs text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">OS</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Equipamento</th>
                  <th className="px-4 py-3 font-medium">Sintoma</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((os) => (
                  <tr key={os.id} className="hover:bg-surface-muted/40">
                    <td className="px-4 py-3 font-mono text-xs font-semibold tabular-nums">
                      <Link
                        href={`/app/os/${os.id}`}
                        className="text-accent hover:underline"
                      >
                        {os.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{os.customerName}</div>
                      <div className="font-mono text-xs text-text-muted tabular-nums">
                        {os.customerPhone}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {[os.assetBrand, os.assetModel].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-text-secondary">
                      {os.reportedSymptoms}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
                        {OS_STATUS_LABELS[os.status] ?? os.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function AppDashboardPage() {
  return (
    <ErpShell
      title="Modo Solo Operator — Minha Fila de Hoje"
      subtitle="Visão unificada de atendimentos, WhatsApp, Briefing IA e bancada"
    >
      {(session) => <DashboardContent session={session} />}
    </ErpShell>
  );
}
