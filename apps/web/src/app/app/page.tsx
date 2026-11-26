'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Kanban,
  List,
  RefreshCw,
  Search,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { OsStatus } from '@al/shared';
import { ErpShell, type ErpSession } from '@/components/erp-shell';
import { Card, PriorityPill, StatKpiCard, StatusPill } from '@/components/ui/primitives';
import {
  CashflowBarChart,
  ConversionRingChart,
  PipelineHorizontalChart,
  type DailyCashflowPoint,
  type QuoteFunnelStats,
  type StageCountPoint,
} from '@/components/ui/charts';
import { apiFetch } from '@/lib/api';

interface QueueMetrics {
  waitingHumanCount: number;
  urgentCount: number;
  inBenchCount: number;
  readyForPickupCount: number;
}

interface AnalyticsOverview {
  summary: {
    totalCustomers: number;
    totalOs: number;
    openOsCount: number;
    deliveredCount: number;
    avgOpenHours: number;
    waitingApprovalCount: number;
    awaitingPartCount: number;
    warrantyCount: number;
    lowStockCount: number;
  };
  osByStage: StageCountPoint[];
  dailyCashflow: DailyCashflowPoint[];
  quoteFunnel: QuoteFunnelStats;
  revenueSummary: {
    days?: 7 | 30;
    totalIncomeCents: number;
    totalExpenseCents: number;
    pendingIncomeCents?: number;
    pendingExpenseCents?: number;
    totalAllExpenseCents?: number;
    netBalanceCents: number;
    projectedBalanceCents?: number;
    overdueReceivableCents: number;
  };
}

interface DailyBriefing {
  aiStatus?: 'instant_grounded' | 'ai_enriched';
  generatedInMs?: number;
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

const KANBAN_COLUMNS: Array<{
  key: string;
  title: string;
  statuses: OsStatus[];
  nextStatus?: OsStatus;
  nextLabel?: string;
}> = [
  {
    key: 'intake',
    title: 'Entrada / Triagem',
    statuses: ['PRE_REGISTRATION', 'AWAITING_RECEIPT', 'RECEIVED', 'TRIAGE'],
    nextStatus: 'DIAGNOSIS',
    nextLabel: 'Mover p/ Diagnóstico',
  },
  {
    key: 'diagnosis',
    title: 'Diagnóstico',
    statuses: ['DIAGNOSIS'],
    nextStatus: 'QUOTE_SENT',
    nextLabel: 'Marcar Orçamento',
  },
  {
    key: 'approval',
    title: 'Orçamento / Aprovação',
    statuses: ['AWAITING_QUOTE', 'QUOTE_SENT', 'AWAITING_APPROVAL', 'APPROVED'],
    nextStatus: 'IN_REPAIR',
    nextLabel: 'Iniciar Bancada',
  },
  {
    key: 'bench',
    title: 'Bancada / Peças',
    statuses: ['AWAITING_PART', 'IN_REPAIR', 'AWAITING_TEST', 'TESTING'],
    nextStatus: 'READY',
    nextLabel: 'Marcar Pronto',
  },
  {
    key: 'ready',
    title: 'Pronto p/ Retirada',
    statuses: ['READY', 'AWAITING_PICKUP'],
    nextStatus: 'DELIVERED',
    nextLabel: 'Confirmar Entrega',
  },
];

function DashboardContent({ session }: { session: ErpSession }) {
  const [queue, setQueue] = useState<QueueMetrics | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [refreshingAi, setRefreshingAi] = useState(false);
  const [orders, setOrders] = useState<ServiceOrderRow[]>([]);
  const [cashflowDays, setCashflowDays] = useState<7 | 30>(7);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [movingId, setMovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasOs = session.enabledModules.includes('mod-service-orders');
  const hasAi = session.enabledModules.includes('mod-ai-agents');

  const loadOperationalData = useCallback(async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;

    try {
      const promises: Promise<unknown>[] = [
        apiFetch<AnalyticsOverview>(`/analytics/overview?days=${cashflowDays}`, {
          token,
        }).then(setAnalytics),
      ];
      if (hasOs) {
        promises.push(
          apiFetch<QueueMetrics>('/service-orders/dashboard-queue', { token }).then(
            setQueue,
          ),
        );
        promises.push(
          apiFetch<ServiceOrderRow[]>('/service-orders', { token }).then(
            setOrders,
          ),
        );
      }
      if (hasAi) {
        promises.push(
          apiFetch<DailyBriefing>('/ai/briefing', { token }).then(setBriefing),
        );
      }
      await Promise.all(promises);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar indicadores');
    }
  }, [hasOs, hasAi, cashflowDays]);

  useEffect(() => {
    void loadOperationalData();
  }, [loadOperationalData]);

  async function handleRefreshBriefingAi() {
    const token = window.localStorage.getItem('al_token');
    if (!token || !hasAi) return;
    setRefreshingAi(true);
    try {
      const fresh = await apiFetch<DailyBriefing>('/ai/briefing?refreshAi=true', {
        token,
      });
      setBriefing(fresh);
    } catch {
      // mantém dados instantâneos já visíveis
    } finally {
      setRefreshingAi(false);
    }
  }

  async function handleQuickAdvance(osId: string, targetStatus: OsStatus) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    setMovingId(osId);
    try {
      await apiFetch(`/service-orders/${osId}/status`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          status: targetStatus,
          note: 'Movimentação rápida pelo quadro Kanban.',
          notifyWhatsapp: false,
        }),
      });
      await loadOperationalData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar status');
    } finally {
      setMovingId(null);
    }
  }

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.code.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.assetModel ?? '').toLowerCase().includes(q) ||
        o.reportedSymptoms.toLowerCase().includes(q),
    );
  }, [orders, searchTerm]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 p-3.5 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Daily AI Briefing Instantâneo */}
      {briefing && (
        <Card className="border-accent/30 bg-gradient-to-br from-surface via-surface to-accent/[0.04] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
              <Sparkles className="h-4 w-4" />
              Briefing Executivo do Dia
              <span className="rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 font-mono text-[10px] font-medium lowercase">
                {briefing.aiStatus === 'ai_enriched' ? 'ia local' : 'instantâneo'}{' '}
                {typeof briefing.generatedInMs === 'number'
                  ? `· ${briefing.generatedInMs}ms`
                  : ''}
              </span>
            </div>

            <button
              type="button"
              onClick={() => void handleRefreshBriefingAi()}
              disabled={refreshingAi}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg px-2.5 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:border-accent hover:text-text-primary disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 ${refreshingAi ? 'animate-spin' : ''}`}
              />
              {refreshingAi ? 'Consultando Ollama...' : 'Refinar com IA local'}
            </button>
          </div>

          <p className="mt-2.5 text-sm leading-relaxed text-text-primary">
            {briefing.narrative}
          </p>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {briefing.highlights.map((h) => (
              <Link
                key={h.label}
                href={h.href}
                className="flex items-center justify-between rounded-xl border border-border bg-bg/80 px-3.5 py-2.5 text-xs transition-all hover:border-accent"
              >
                <span className="text-text-secondary">{h.label}</span>
                <span className="font-mono text-sm font-bold tabular-nums text-text-primary">
                  {h.value}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* KPI Cards */}
      {queue && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/app/inbox" className="block">
            <StatKpiCard
              label="WhatsApp Aguardando Humano"
              value={String(queue.waitingHumanCount)}
              hint="Clique para assumir conversas no Inbox"
              tone={queue.waitingHumanCount > 0 ? 'warning' : 'success'}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
          </Link>
          <StatKpiCard
            label="OS Prioritárias / Urgentes"
            value={String(queue.urgentCount)}
            hint={
              analytics
                ? `Tempo médio aberto: ${analytics.summary.avgOpenHours}h`
                : undefined
            }
            tone={queue.urgentCount > 0 ? 'danger' : 'neutral'}
            icon={<Clock className="h-4 w-4" />}
          />
          <StatKpiCard
            label="Em Bancada / Diagnóstico"
            value={String(queue.inBenchCount)}
            hint={
              analytics
                ? `${analytics.summary.awaitingPartCount} aguardando peça`
                : undefined
            }
            tone="accent"
            icon={<Wrench className="h-4 w-4" />}
          />
          <StatKpiCard
            label="Prontas para Retirada"
            value={String(queue.readyForPickupCount)}
            hint={
              analytics
                ? `${analytics.summary.deliveredCount} entregues no histórico`
                : undefined
            }
            tone="success"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
        </div>
      )}

      {/* BI Charts Grid */}
      {analytics && (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <CashflowBarChart
              data={analytics.dailyCashflow}
              totalIncomeCents={analytics.revenueSummary.totalIncomeCents}
              totalExpenseCents={analytics.revenueSummary.totalExpenseCents}
              pendingIncomeCents={analytics.revenueSummary.pendingIncomeCents ?? 0}
              pendingExpenseCents={analytics.revenueSummary.pendingExpenseCents ?? 0}
              days={cashflowDays}
              onDaysChange={setCashflowDays}
            />
          </div>
          <div className="lg:col-span-4">
            <PipelineHorizontalChart
              stages={analytics.osByStage}
              totalOpen={analytics.summary.openOsCount}
            />
          </div>
          <div className="lg:col-span-3">
            <ConversionRingChart funnel={analytics.quoteFunnel} />
          </div>
        </div>
      )}

      {/* OS Workspace: Lista + Kanban Toggle */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">
              Pipeline de Ordens de Serviço
            </h2>
            <p className="text-xs text-text-secondary">
              Alterne entre tabela operacional e quadro Kanban de oficina.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-text-muted" />
              <input
                type="text"
                placeholder="Filtrar OS, cliente ou modelo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-56 rounded-xl border border-border bg-surface py-1.5 pl-8 pr-3 text-xs outline-none focus:border-accent"
              />
            </div>

            <div className="inline-flex rounded-xl border border-border bg-surface p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                Lista
              </button>
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Kanban className="h-3.5 w-3.5" />
                Kanban
              </button>
            </div>
          </div>
        </div>

        {!hasOs ? (
          <Card className="p-6 text-sm text-text-secondary">
            O módulo <strong>Assistência Técnica & OS</strong> está desativado.{' '}
            <Link href="/app/modules" className="text-accent underline">
              Ative em Módulos SaaS
            </Link>
            .
          </Card>
        ) : filteredOrders.length === 0 ? (
          <Card className="p-8 text-center text-sm text-text-secondary">
            Nenhuma Ordem de Serviço encontrada com o filtro atual.
          </Card>
        ) : viewMode === 'list' ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-surface-muted/60 text-xs text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 font-medium">Protocolo</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Equipamento</th>
                    <th className="px-4 py-3 font-medium">Sintomas</th>
                    <th className="px-4 py-3 font-medium">Prioridade</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredOrders.map((os) => (
                    <tr
                      key={os.id}
                      className="transition-colors hover:bg-surface-muted/40"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold tabular-nums">
                        <Link
                          href={`/app/os/${os.id}`}
                          className="text-accent hover:underline"
                        >
                          {os.code}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-text-primary">
                          {os.customerName}
                        </div>
                        <div className="font-mono text-[11px] text-text-muted">
                          {os.customerPhone}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {[os.assetBrand, os.assetModel].filter(Boolean).join(' ') ||
                          'Não vinculado'}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-xs text-text-secondary">
                        {os.reportedSymptoms}
                      </td>
                      <td className="px-4 py-3">
                        <PriorityPill priority={os.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={os.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            {KANBAN_COLUMNS.map((col) => {
              const items = filteredOrders.filter((o) =>
                col.statuses.includes(o.status),
              );
              return (
                <div
                  key={col.key}
                  className="flex flex-col rounded-2xl border border-border bg-surface-muted/45 p-3"
                >
                  <div className="mb-3 flex items-center justify-between px-1">
                    <span className="text-xs font-semibold text-text-primary">
                      {col.title}
                    </span>
                    <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-text-secondary">
                      {items.length}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-4 text-center text-[11px] text-text-muted">
                        Sem OS nesta etapa
                      </div>
                    ) : (
                      items.map((os) => (
                        <div
                          key={os.id}
                          className="rounded-xl border border-border bg-surface p-3 shadow-sm transition-colors hover:border-accent/50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Link
                              href={`/app/os/${os.id}`}
                              className="font-mono text-xs font-bold text-accent hover:underline"
                            >
                              {os.code}
                            </Link>
                            <PriorityPill priority={os.priority} />
                          </div>
                          <p className="mt-1.5 text-xs font-medium text-text-primary">
                            {os.customerName}
                          </p>
                          <p className="mt-0.5 text-[11px] text-text-muted">
                            {[os.assetBrand, os.assetModel]
                              .filter(Boolean)
                              .join(' ') || 'Equipamento geral'}
                          </p>
                          <p className="mt-2 line-clamp-2 text-[11px] text-text-secondary">
                            {os.reportedSymptoms}
                          </p>

                          {col.nextStatus && (
                            <button
                              type="button"
                              disabled={movingId === os.id}
                              onClick={() =>
                                void handleQuickAdvance(os.id, col.nextStatus!)
                              }
                              className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-border bg-bg px-2 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                            >
                              {movingId === os.id
                                ? 'Movendo...'
                                : col.nextLabel}
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default function AppDashboardPage() {
  return (
    <ErpShell
      title="Visão Geral & Inteligência Operacional"
      subtitle="Indicadores em tempo real, briefing instantâneo e pipeline da oficina"
    >
      {(session) => <DashboardContent session={session} />}
    </ErpShell>
  );
}
