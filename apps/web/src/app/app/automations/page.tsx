'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Activity,
  CheckCircle2,
  Play,
  Plus,
  Power,
  Trash2,
  Zap,
} from 'lucide-react';
import { AUTOMATION_TRIGGER_EVENTS, type AutomationTriggerEvent } from '@al/shared';
import { ErpShell } from '@/components/erp-shell';
import { Card, StatKpiCard } from '@/components/ui/primitives';
import { apiFetch } from '@/lib/api';

interface AutomationRule {
  id: string;
  name: string;
  triggerEvent: AutomationTriggerEvent;
  channel: string;
  delayHours: number;
  templateText: string;
  isActive: boolean;
  lastRunAt: string | null;
  runCount: number;
}

interface AutomationExecution {
  id: string;
  targetLabel: string;
  status: string;
  summary: string;
  executedAt: string;
}

interface AutomationsOverview {
  rules: AutomationRule[];
  executions: AutomationExecution[];
  summary: {
    totalRules: number;
    activeRules: number;
    totalExecutions: number;
  };
}

const TRIGGER_LABELS: Record<AutomationTriggerEvent, string> = {
  'quote.pending_followup': 'Orçamento enviado sem resposta (Follow-up)',
  'os.ready_pickup_reminder': 'OS pronta aguardando retirada',
  'os.post_service_preventive': 'Revisão preventiva pós-entrega',
  'stock.low_alert': 'Estoque abaixo do mínimo',
};

function AutomationsContent() {
  const [data, setData] = useState<AutomationsOverview | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [triggerEvent, setTriggerEvent] =
    useState<AutomationTriggerEvent>('quote.pending_followup');
  const [channel, setChannel] = useState<'whatsapp' | 'internal_alert'>('whatsapp');
  const [delayHours, setDelayHours] = useState('48');
  const [templateText, setTemplateText] = useState('');
  const [running, setRunning] = useState(false);
  const [runReport, setRunReport] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const res = await apiFetch<AutomationsOverview>('/automations', { token });
    setData(res);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreateRule(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch('/automations/rules', {
      method: 'POST',
      token,
      body: JSON.stringify({
        name,
        triggerEvent,
        channel,
        delayHours: Number(delayHours) || 0,
        templateText,
      }),
    });
    setName('');
    setTemplateText('');
    setShowForm(false);
    await load();
  }

  async function handleToggle(id: string) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch(`/automations/rules/${id}/toggle`, {
      method: 'PATCH',
      token,
    });
    await load();
  }

  async function handleDeleteRule(id: string) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch(`/automations/rules/${id}`, {
      method: 'DELETE',
      token,
    });
    await load();
  }

  async function handleRunNow() {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    setRunning(true);
    try {
      const res = await apiFetch<{
        evaluatedRules: number;
        newExecutionsCount: number;
      }>('/automations/run-now', {
        method: 'POST',
        token,
      });
      setRunReport(
        `${res.evaluatedRules} regra(s) avaliada(s) · ${res.newExecutionsCount} nova(s) ação(ões) disparada(s) sem duplicidade.`,
      );
      await load();
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      {runReport && (
        <div className="rounded-xl border border-accent/35 bg-accent/10 px-4 py-3 text-xs font-medium text-accent">
          {runReport}
        </div>
      )}

      {data && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatKpiCard
            label="Regras Cadastradas"
            value={String(data.summary.totalRules)}
            tone="neutral"
            icon={<Zap className="h-4 w-4" />}
          />
          <StatKpiCard
            label="Regras Ativas"
            value={String(data.summary.activeRules)}
            tone="accent"
            icon={<Activity className="h-4 w-4" />}
          />
          <StatKpiCard
            label="Execuções Idempotentes"
            value={String(data.summary.totalExecutions)}
            hint="Protegidas contra reenvio duplicado"
            tone="success"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">
            Motor de Regras por Evento
          </h2>
          <p className="text-xs text-text-secondary">
            Automatize follow-ups de orçamentos, avisos de retirada e alertas preventivos.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={running}
            onClick={() => void handleRunNow()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3.5 py-2 text-xs font-semibold text-accent hover:bg-accent/20 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            {running ? 'Executando...' : 'Avaliar Regras Agora'}
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova Regra
          </button>
        </div>
      </div>

      {showForm && (
        <Card className="p-5">
          <form onSubmit={handleCreateRule} className="grid gap-4 sm:grid-cols-3">
            <input
              required
              placeholder="Nome da regra (ex: Follow-up Orçamento 48h)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sm:col-span-2 rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            />
            <select
              value={triggerEvent}
              onChange={(e) =>
                setTriggerEvent(e.target.value as AutomationTriggerEvent)
              }
              className="rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            >
              {AUTOMATION_TRIGGER_EVENTS.map((ev) => (
                <option key={ev} value={ev}>
                  {TRIGGER_LABELS[ev]}
                </option>
              ))}
            </select>
            <select
              value={channel}
              onChange={(e) =>
                setChannel(e.target.value as 'whatsapp' | 'internal_alert')
              }
              className="rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            >
              <option value="whatsapp">WhatsApp Automático</option>
              <option value="internal_alert">Alerta Interno no Painel</option>
            </select>
            <input
              type="number"
              min={0}
              placeholder="Atraso (horas)"
              value={delayHours}
              onChange={(e) => setDelayHours(e.target.value)}
              className="rounded-xl border border-border bg-bg px-3 py-2 font-mono text-sm"
            />
            <button
              type="submit"
              className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover"
            >
              Salvar Regra
            </button>
            <textarea
              required
              rows={2}
              placeholder="Texto da mensagem ou orientação interna..."
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              className="sm:col-span-3 rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            />
          </form>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-7">
          {data?.rules.map((r) => (
            <Card key={r.id} className="p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-semibold uppercase text-accent">
                      {r.triggerEvent} · +{r.delayHours}h · {r.channel}
                    </span>
                  </div>
                  <h3 className="mt-0.5 font-display text-sm font-semibold">
                    {r.name}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleToggle(r.id)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold ${
                      r.isActive
                        ? 'border-success/40 bg-success/12 text-success'
                        : 'border-border bg-surface-muted text-text-muted'
                    }`}
                  >
                    <Power className="h-3 w-3" />
                    {r.isActive ? 'ATIVA' : 'PAUSADA'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteRule(r.id)}
                    className="rounded-lg border border-border p-1 text-danger hover:bg-danger/10"
                    title="Excluir regra"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-text-secondary">{r.templateText}</p>
              <p className="font-mono text-[11px] text-text-muted">
                Execuções registradas: {r.runCount}
              </p>
            </Card>
          ))}
        </div>

        <Card className="p-5 lg:col-span-5">
          <h3 className="font-display text-sm font-semibold">
            Histórico Recente de Disparos
          </h3>
          <div className="mt-3 space-y-2.5">
            {data?.executions.length === 0 ? (
              <p className="text-xs text-text-muted">
                Nenhuma execução disparada ainda. Clique em "Avaliar Regras Agora".
              </p>
            ) : (
              data?.executions.map((ex) => (
                <div
                  key={ex.id}
                  className="rounded-xl border border-border bg-bg p-3 text-xs"
                >
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className="font-semibold text-accent">
                      {ex.targetLabel}
                    </span>
                    <span className="text-text-muted">
                      {new Date(ex.executedAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="mt-1 text-text-secondary">{ex.summary}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function AutomationsPage() {
  return (
    <ErpShell
      title="Automações & Regras por Evento"
      subtitle="Follow-up automático, lembretes de retirada e alertas operacionais idempotentes"
    >
      {() => <AutomationsContent />}
    </ErpShell>
  );
}
