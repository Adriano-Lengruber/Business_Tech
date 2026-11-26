'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  DollarSign,
  Plus,
  Repeat,
  ShieldAlert,
} from 'lucide-react';
import { ErpShell } from '@/components/erp-shell';
import { Card, StatKpiCard } from '@/components/ui/primitives';
import { apiFetch } from '@/lib/api';

interface ContractRow {
  id: string;
  code: string;
  title: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  planTier: string;
  status: string;
  monthlyPriceCents: number;
  includedHours: number;
  usedHours: number;
  slaResponseHours: number;
  coveredAssetsCount: number;
  preventiveFrequencyDays: number;
  nextPreventiveAt: string | null;
  notes: string | null;
}

interface ContractsResponse {
  contracts: ContractRow[];
  summary: {
    activeCount: number;
    mrrCents: number;
    totalCoveredAssets: number;
    preventiveDueCount: number;
  };
}

interface CustomerOption {
  id: string;
  name: string;
  phoneE164: string;
}

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function ContractsContent() {
  const [data, setData] = useState<ContractsResponse | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [title, setTitle] = useState('');
  const [planTier, setPlanTier] = useState<'basic' | 'preventive' | 'enterprise_sla'>('preventive');
  const [monthlyPriceBrl, setMonthlyPriceBrl] = useState('990.00');
  const [includedHours, setIncludedHours] = useState('10');
  const [slaResponseHours, setSlaResponseHours] = useState('4');
  const [coveredAssetsCount, setCoveredAssetsCount] = useState('8');
  const [preventiveFrequencyDays, setPreventiveFrequencyDays] = useState('90');
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const [contractsRes, custRes] = await Promise.all([
      apiFetch<ContractsResponse>('/contracts', { token }),
      apiFetch<CustomerOption[]>('/customers?q=', { token }),
    ]);
    setData(contractsRes);
    setCustomers(custRes);
    if (!customerId && custRes[0]) {
      setCustomerId(custRes[0].id);
    }
  }, [customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const cents = Math.round((Number(monthlyPriceBrl.replace(',', '.')) || 0) * 100);
    await apiFetch('/contracts', {
      method: 'POST',
      token,
      body: JSON.stringify({
        customerId,
        title,
        planTier,
        monthlyPriceCents: cents,
        includedHours: Number(includedHours),
        slaResponseHours: Number(slaResponseHours),
        coveredAssetsCount: Number(coveredAssetsCount),
        preventiveFrequencyDays: Number(preventiveFrequencyDays),
        notes: notes || undefined,
      }),
    });
    setTitle('');
    setNotes('');
    setShowForm(false);
    setFeedback('Contrato B2B criado com agenda preventiva configurada.');
    await load();
  }

  async function handleAction(
    id: string,
    endpoint: 'log-usage' | 'preventive-done' | 'bill-month',
  ) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch(`/contracts/${id}/${endpoint}`, {
      method: 'POST',
      token,
      body:
        endpoint === 'log-usage'
          ? JSON.stringify({ hoursUsed: 1, notes: 'Atendimento avulso coberto' })
          : undefined,
    });
    const messages = {
      'log-usage': '1h debitada da franquia do contrato.',
      'preventive-done': 'Preventiva marcada como concluída e próxima data reagendada.',
      'bill-month': 'Mensalidade PIX gerada no módulo Financeiro.',
    };
    setFeedback(messages[endpoint]);
    await load();
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="flex items-center justify-between rounded-xl border border-accent/35 bg-accent/10 px-4 py-2.5 text-xs font-medium text-accent">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="underline"
          >
            Fechar
          </button>
        </div>
      )}

      {data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatKpiCard
            label="MRR Ativo (Recorrência)"
            value={formatBrl(data.summary.mrrCents)}
            hint="Receita mensal recorrente B2B"
            tone="accent"
            icon={<DollarSign className="h-4 w-4" />}
          />
          <StatKpiCard
            label="Contratos Vigentes"
            value={String(data.summary.activeCount)}
            tone="success"
            icon={<Repeat className="h-4 w-4" />}
          />
          <StatKpiCard
            label="Estações Cobertas"
            value={String(data.summary.totalCoveredAssets)}
            hint="Ativos sob SLA gerenciado"
            tone="neutral"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <StatKpiCard
            label="Preventivas Próximas (15d)"
            value={String(data.summary.preventiveDueCount)}
            tone={data.summary.preventiveDueCount > 0 ? 'warning' : 'neutral'}
            icon={<CalendarClock className="h-4 w-4" />}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-semibold">
            Carteira de Contratos & SLA
          </h2>
          <p className="text-xs text-text-secondary">
            Controle franquias de horas, tempo de resposta SLA e manutenção preventiva recorrente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo Contrato B2B
        </button>
      </div>

      {showForm && (
        <Card className="p-5">
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary">
                Cliente *
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-text-secondary">
                Título do Contrato *
              </label>
              <input
                required
                placeholder="Ex: Suporte TI + Preventiva Mensal — Clínica Saúde"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary">
                Modalidade
              </label>
              <select
                value={planTier}
                onChange={(e) =>
                  setPlanTier(
                    e.target.value as 'basic' | 'preventive' | 'enterprise_sla',
                  )
                }
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              >
                <option value="basic">Básico sob demanda</option>
                <option value="preventive">Intermediário + Preventiva</option>
                <option value="enterprise_sla">Avançado + SLA Prioritário</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary">
                Mensalidade (R$)
              </label>
              <input
                value={monthlyPriceBrl}
                onChange={(e) => setMonthlyPriceBrl(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-text-secondary">
                  Horas/mês
                </label>
                <input
                  type="number"
                  value={includedHours}
                  onChange={(e) => setIncludedHours(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-bg px-2.5 py-2 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] text-text-secondary">
                  SLA (h)
                </label>
                <input
                  type="number"
                  value={slaResponseHours}
                  onChange={(e) => setSlaResponseHours(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-bg px-2.5 py-2 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] text-text-secondary">
                  Estações
                </label>
                <input
                  type="number"
                  value={coveredAssetsCount}
                  onChange={(e) => setCoveredAssetsCount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-bg px-2.5 py-2 font-mono text-sm"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-text-secondary">
                Escopo / Observações
              </label>
              <input
                placeholder="Cobertura, horários e itens inclusos..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary">
                Ciclo preventivo (dias)
              </label>
              <input
                type="number"
                value={preventiveFrequencyDays}
                onChange={(e) => setPreventiveFrequencyDays(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 font-mono text-sm"
              />
            </div>

            <div className="sm:col-span-3 flex justify-end gap-2">
              <button
                type="submit"
                className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover"
              >
                Salvar Contrato
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {data?.contracts.map((c) => {
          const pct = Math.min(
            100,
            Math.round((c.usedHours / Math.max(1, c.includedHours)) * 100),
          );
          const dueSoon =
            c.nextPreventiveAt &&
            new Date(c.nextPreventiveAt).getTime() <= Date.now() + 15 * 86400000;

          return (
            <Card key={c.id} className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-accent">
                      {c.code}
                    </span>
                    <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 font-mono text-[10px] uppercase text-text-secondary">
                      SLA {c.slaResponseHours}h · {c.coveredAssetsCount} ativos
                    </span>
                  </div>
                  <h3 className="mt-1 font-display text-base font-semibold">
                    {c.title}
                  </h3>
                  <p className="text-xs text-text-secondary">
                    {c.customerName} · {c.customerPhone}
                  </p>
                </div>

                <span className="font-mono text-lg font-bold tabular-nums text-text-primary">
                  {formatBrl(c.monthlyPriceCents)}
                  <span className="text-[11px] font-normal text-text-muted">/mês</span>
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">Franquia de horas utilizada</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {c.usedHours}h / {c.includedHours}h ({pct}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pct >= 90 ? 'bg-danger' : 'bg-accent'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
                <span
                  className={`inline-flex items-center gap-1.5 font-mono ${
                    dueSoon ? 'text-warning' : 'text-text-muted'
                  }`}
                >
                  {dueSoon ? (
                    <ShieldAlert className="h-3.5 w-3.5" />
                  ) : (
                    <Clock className="h-3.5 w-3.5" />
                  )}
                  Próx. preventiva:{' '}
                  {c.nextPreventiveAt
                    ? new Date(c.nextPreventiveAt).toLocaleDateString('pt-BR')
                    : '—'}
                </span>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleAction(c.id, 'log-usage')}
                    className="rounded-lg border border-border bg-bg px-2.5 py-1 text-[11px] font-medium hover:border-accent"
                  >
                    +1h uso
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAction(c.id, 'preventive-done')}
                    className="rounded-lg border border-border bg-bg px-2.5 py-1 text-[11px] font-medium hover:border-accent"
                  >
                    Preventiva OK
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAction(c.id, 'bill-month')}
                    className="rounded-lg bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent/25"
                  >
                    Faturar mês PIX
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function ContractsPage() {
  return (
    <ErpShell
      title="Contratos B2B, Preventiva & SLA"
      subtitle="Receita recorrente de suporte gerenciado com franquia de horas e agenda preventiva"
    >
      {() => <ContractsContent />}
    </ErpShell>
  );
}
