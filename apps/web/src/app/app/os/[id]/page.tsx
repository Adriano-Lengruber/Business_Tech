'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Eye, FileText, Lock, Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import {
  calculateQuoteTotals,
  OS_STATUSES,
  OS_STATUS_LABELS,
  QUOTE_TIER_LABELS,
  type OsStatus,
  type QuoteItemType,
  type QuoteTier,
} from '@al/shared';
import { ErpShell } from '@/components/erp-shell';
import {
  HardwareCompareTab,
  type HardwareDiffResponse,
} from '@/components/os/hardware-tab';
import { WarrantyRmaTab, type WarrantyRow } from '@/components/os/warranty-tab';
import { apiFetch } from '@/lib/api';

interface OsDetail {
  os: {
    id: string;
    code: string;
    status: OsStatus;
    priority: string;
    reportedSymptoms: string;
    preliminaryDiagnosis: string | null;
    hasDevicePassword?: boolean;
    devicePasswordHint?: string | null;
    createdAt: string;
  };
  customer: { name: string; phoneE164: string };
  asset: {
    category: string;
    brand: string | null;
    model: string | null;
    serialNumber: string | null;
    qrToken: string;
  } | null;
  events: Array<{
    id: string;
    eventType: string;
    toStatus: string | null;
    note: string | null;
    createdAt: string;
  }>;
  attachments: Array<{ id: string; filename: string; signedUrl: string | null }>;
}

interface DiagnosticRow {
  id: string;
  category: string;
  observedFacts: string;
  testsPerformed: Array<{ name: string; passed: boolean; notes?: string }>;
  aiHypotheses: string[];
  finalDiagnosis: string | null;
  confidenceLevel: string;
  clientExplanation: string | null;
  createdAt: string;
}

interface QuoteRow {
  id: string;
  code: string;
  tier: QuoteTier;
  status: string;
  warrantyDays: number;
  totalCents: number;
  estimatedCostCents: number;
  paymentTerms: string;
  acceptanceHash: string | null;
  items: Array<{
    id: string;
    itemType: QuoteItemType;
    description: string;
    quantity: number;
    unitPriceCents: number;
    totalPriceCents: number;
  }>;
}

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function OsDetailContent() {
  const params = useParams<{ id: string }>();
  const [tab, setTab] = useState<
    'overview' | 'diagnostic' | 'hardware' | 'quotes' | 'warranty'
  >('overview');
  const [detail, setDetail] = useState<OsDetail | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [hwData, setHwData] = useState<HardwareDiffResponse | null>(null);
  const [warranties, setWarranties] = useState<WarrantyRow[]>([]);

  const [nextStatus, setNextStatus] = useState<OsStatus>('DIAGNOSIS');
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  // Diagnostic form
  const [diagCategory, setDiagCategory] = useState('superaquecimento');
  const [observedFacts, setObservedFacts] = useState('');
  const [finalDiagnosis, setFinalDiagnosis] = useState('');
  const [clientExplanation, setClientExplanation] = useState('');
  const [aiHypotheses, setAiHypotheses] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Quote form
  const [tier, setTier] = useState<QuoteTier>('recommended');
  const [warrantyDays, setWarrantyDays] = useState(90);
  const [quoteItems, setQuoteItems] = useState<
    Array<{
      itemType: QuoteItemType;
      description: string;
      quantity: number;
      unitCostBrl: string;
      unitPriceBrl: string;
    }>
  >([
    {
      itemType: 'labor',
      description: 'Mão de obra técnica especializada',
      quantity: 1,
      unitCostBrl: '0',
      unitPriceBrl: '180',
    },
  ]);

  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token || !params.id) return;
    const [data, diags, qList, hw, warList] = await Promise.all([
      apiFetch<OsDetail>(`/service-orders/${params.id}`, { token }),
      apiFetch<DiagnosticRow[]>(`/service-orders/${params.id}/diagnostics`, { token }),
      apiFetch<QuoteRow[]>(`/service-orders/${params.id}/quotes`, { token }),
      apiFetch<HardwareDiffResponse>(
        `/service-orders/${params.id}/hardware-snapshots`,
        { token },
      ),
      apiFetch<WarrantyRow[]>(`/service-orders/${params.id}/warranties`, {
        token,
      }),
    ]);
    setDetail(data);
    setNextStatus(data.os.status);
    setDiagnostics(diags);
    setQuotes(qList);
    setHwData(hw);
    setWarranties(warList);
  }, [params.id]);

  useEffect(() => {
    void load().catch((e) => setError(String(e)));
  }, [load]);

  async function handleUpdateStatus(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token || !params.id) return;
    await apiFetch(`/service-orders/${params.id}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        status: nextStatus,
        note: note || undefined,
        notifyWhatsapp: notify,
      }),
    });
    setNote('');
    await load();
  }

  async function handleDownloadPdf() {
    const token = window.localStorage.getItem('al_token');
    if (!token || !params.id) return;
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
    const res = await fetch(`${apiBase}/service-orders/${params.id}/intake-pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  }

  async function handleRevealPassword() {
    const token = window.localStorage.getItem('al_token');
    if (!token || !params.id) return;
    setRevealing(true);
    try {
      const res = await apiFetch<{
        hasPassword: boolean;
        password: string | null;
      }>(`/service-orders/${params.id}/reveal-password`, {
        method: 'POST',
        token,
      });
      setRevealedPassword(res.password);
    } finally {
      setRevealing(false);
    }
  }

  async function handleUploadFile(file: File) {
    const token = window.localStorage.getItem('al_token');
    if (!token || !params.id) return;
    const formData = new FormData();
    formData.append('file', file);
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
    await fetch(`${apiBase}/service-orders/${params.id}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    await load();
  }

  async function handleAiAssist() {
    const token = window.localStorage.getItem('al_token');
    if (!token || !params.id) return;
    setAiLoading(true);
    try {
      const res = await apiFetch<{
        hypotheses: string[];
        clientExplanation: string;
      }>(`/service-orders/${params.id}/diagnostics/ai-assist`, {
        method: 'POST',
        token,
        body: JSON.stringify({ observedFacts }),
      });
      setAiHypotheses(res.hypotheses);
      setClientExplanation(res.clientExplanation);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSaveDiagnostic(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token || !params.id) return;
    await apiFetch(`/service-orders/${params.id}/diagnostics`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        category: diagCategory,
        observedFacts,
        finalDiagnosis: finalDiagnosis || undefined,
        clientExplanation: clientExplanation || undefined,
        moveToAwaitingQuote: true,
      }),
    });
    setObservedFacts('');
    setFinalDiagnosis('');
    await load();
  }

  async function handleCreateQuote(sendImmediately: boolean) {
    const token = window.localStorage.getItem('al_token');
    if (!token || !params.id) return;
    await apiFetch(`/service-orders/${params.id}/quotes`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        tier,
        warrantyDays,
        sendImmediately,
        items: quoteItems.map((i) => ({
          itemType: i.itemType,
          description: i.description,
          quantity: Number(i.quantity) || 1,
          unitCostCents: Math.round((Number(i.unitCostBrl.replace(',', '.')) || 0) * 100),
          unitPriceCents: Math.round((Number(i.unitPriceBrl.replace(',', '.')) || 0) * 100),
        })),
      }),
    });
    await load();
  }

  async function handleSendQuote(quoteId: string) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch(`/quotes/${quoteId}/send`, { method: 'POST', token });
    await load();
  }

  const liveTotals = calculateQuoteTotals(
    quoteItems.map((i) => ({
      itemType: i.itemType,
      quantity: Number(i.quantity) || 1,
      unitCostCents: Math.round((Number(i.unitCostBrl.replace(',', '.')) || 0) * 100),
      unitPriceCents: Math.round((Number(i.unitPriceBrl.replace(',', '.')) || 0) * 100),
    })),
  );

  if (error) return <div className="text-sm text-danger">{error}</div>;
  if (!detail) return <div className="text-sm text-text-secondary">Carregando OS...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface p-5">
        <div>
          <span className="font-mono text-sm font-bold text-accent">
            {detail.os.code} · {OS_STATUS_LABELS[detail.os.status] ?? detail.os.status}
          </span>
          <h2 className="text-lg font-semibold">
            {detail.customer.name} ·{' '}
            <span className="font-mono text-sm text-text-secondary">
              {detail.customer.phoneE164}
            </span>
          </h2>
          {detail.asset && (
            <p className="text-xs text-text-secondary">
              {[detail.asset.category, detail.asset.brand, detail.asset.model]
                .filter(Boolean)
                .join(' · ')}{' '}
              | QR: <span className="font-mono">{detail.asset.qrToken}</span>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleDownloadPdf()}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-bg px-4 py-2 text-sm font-medium hover:bg-surface-muted"
        >
          <FileText className="h-4 w-4 text-accent" />
          Termo de Entrada (PDF)
        </button>
      </div>

      {/* Abas da OS */}
      <div className="flex flex-wrap gap-2 border-b border-border">
        {[
          { id: 'overview', label: 'Geral & Timeline' },
          { id: 'diagnostic', label: `Diagnóstico (${diagnostics.length})` },
          {
            id: 'hardware',
            label: `Hardware & Laudo (${hwData?.snapshots.length ?? 0})`,
          },
          { id: 'quotes', label: `Orçamentos (${quotes.length})` },
          { id: 'warranty', label: `Garantia & RMA (${warranties.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() =>
              setTab(
                t.id as
                  | 'overview'
                  | 'diagnostic'
                  | 'hardware'
                  | 'quotes'
                  | 'warranty',
              )
            }
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-lg border border-border bg-surface p-5 space-y-2 text-sm">
              <h3 className="font-semibold">Relato & Pré-diagnóstico</h3>
              <p className="text-text-secondary">
                <strong className="text-text-primary">Sintomas:</strong>{' '}
                {detail.os.reportedSymptoms}
              </p>
              {detail.os.preliminaryDiagnosis && (
                <p className="text-text-secondary">
                  <strong className="text-text-primary">Pré-diagnóstico:</strong>{' '}
                  {detail.os.preliminaryDiagnosis}
                </p>
              )}
              {(detail.os.hasDevicePassword || detail.os.devicePasswordHint) && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
                  <div className="space-y-0.5 text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-accent">
                      <Lock className="h-3.5 w-3.5" />
                      Credencial de Bancada (AES-256 · LGPD)
                    </span>
                    {detail.os.devicePasswordHint && (
                      <p className="text-text-secondary">
                        Dica: {detail.os.devicePasswordHint}
                      </p>
                    )}
                    {revealedPassword && (
                      <p className="font-mono text-sm font-bold text-text-primary">
                        Senha/PIN: {revealedPassword}
                      </p>
                    )}
                  </div>
                  {detail.os.hasDevicePassword && !revealedPassword && (
                    <button
                      type="button"
                      disabled={revealing}
                      onClick={() => void handleRevealPassword()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-accent"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {revealing ? 'Descriptografando...' : 'Revelar PIN (Auditar)'}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Fotos & Evidências (S3 Privado)</h3>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-muted">
                  <Upload className="h-3.5 w-3.5" />
                  Anexar foto
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUploadFile(f);
                    }}
                  />
                </label>
              </div>
              {detail.attachments.length === 0 ? (
                <p className="mt-3 text-xs text-text-muted">Nenhum anexo enviado.</p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {detail.attachments.map((att) =>
                    att.signedUrl ? (
                      <a
                        key={att.id}
                        href={att.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="overflow-hidden rounded-md border border-border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={att.signedUrl}
                          alt={att.filename}
                          className="h-28 w-full object-cover"
                        />
                      </a>
                    ) : null,
                  )}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-surface p-5">
              <h3 className="text-sm font-semibold">Timeline da OS</h3>
              <div className="mt-3 space-y-3">
                {detail.events.map((ev) => (
                  <div key={ev.id} className="border-l-2 border-accent/40 pl-3 text-sm">
                    <p className="font-medium">
                      {ev.toStatus
                        ? OS_STATUS_LABELS[ev.toStatus as OsStatus] ?? ev.toStatus
                        : ev.eventType}
                    </p>
                    {ev.note && (
                      <p className="text-xs text-text-secondary">{ev.note}</p>
                    )}
                    <p className="font-mono text-[11px] text-text-muted">
                      {new Date(ev.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <form
            onSubmit={handleUpdateStatus}
            className="h-fit rounded-lg border border-border bg-surface p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold">Atualizar Status</h3>
            <select
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as OsStatus)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            >
              {OS_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {OS_STATUS_LABELS[st]}
                </option>
              ))}
            </select>
            <textarea
              rows={3}
              placeholder="Nota técnica / observação..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
              />
              Notificar cliente via WhatsApp
            </label>
            <button
              type="submit"
              className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
            >
              Salvar status
            </button>
          </form>
        </div>
      )}

      {tab === 'diagnostic' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={handleSaveDiagnostic}
            className="rounded-lg border border-border bg-surface p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Novo Laudo / Diagnóstico</h3>
              <button
                type="button"
                disabled={aiLoading}
                onClick={() => void handleAiAssist()}
                className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {aiLoading ? 'Analisando...' : 'Assistente IA (Local)'}
              </button>
            </div>

            <select
              value={diagCategory}
              onChange={(e) => setDiagCategory(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            >
              <option value="nao-liga">Não liga / Curto</option>
              <option value="superaquecimento">Superaquecimento</option>
              <option value="armazenamento">Armazenamento / SSD</option>
              <option value="tela">Tela / Dobradiça</option>
              <option value="sistema">Sistema Operacional</option>
            </select>

            <textarea
              required
              rows={3}
              placeholder="Fatos observados e medições reais na bancada *"
              value={observedFacts}
              onChange={(e) => setObservedFacts(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            />

            {aiHypotheses.length > 0 && (
              <div className="rounded-md border border-accent/30 bg-accent/5 p-3 text-xs space-y-1">
                <p className="font-semibold text-accent">Hipóteses sugeridas pela IA (validar na bancada):</p>
                {aiHypotheses.map((h, i) => (
                  <p key={i} className="text-text-secondary">• {h}</p>
                ))}
              </div>
            )}

            <input
              placeholder="Diagnóstico técnico final"
              value={finalDiagnosis}
              onChange={(e) => setFinalDiagnosis(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            />

            <textarea
              rows={3}
              placeholder="Explicação em linguagem simples para o cliente (exibida no Portal)"
              value={clientExplanation}
              onChange={(e) => setClientExplanation(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            />

            <button
              type="submit"
              className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
            >
              Salvar Diagnóstico e Avançar p/ Orçamento
            </button>
          </form>

          <div className="space-y-4">
            {diagnostics.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-border bg-surface p-5 space-y-2 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold uppercase text-accent">
                    {d.category} · Confiança: {d.confidenceLevel}
                  </span>
                  <span className="font-mono text-[11px] text-text-muted">
                    {new Date(d.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="text-text-secondary">
                  <strong className="text-text-primary">Fatos:</strong> {d.observedFacts}
                </p>
                {d.finalDiagnosis && (
                  <p className="text-text-secondary">
                    <strong className="text-text-primary">Conclusão:</strong> {d.finalDiagnosis}
                  </p>
                )}
                {d.clientExplanation && (
                  <p className="rounded bg-bg p-2.5 text-xs text-text-secondary">
                    <strong>Resumo ao cliente:</strong> {d.clientExplanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'quotes' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Criar Proposta de Orçamento</h3>
              <div className="flex items-center gap-3">
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value as QuoteTier)}
                  className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm"
                >
                  <option value="economic">Econômica</option>
                  <option value="recommended">Recomendada</option>
                  <option value="premium">Premium</option>
                </select>
                <input
                  type="number"
                  value={warrantyDays}
                  onChange={(e) => setWarrantyDays(Number(e.target.value))}
                  className="w-24 rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm font-mono"
                />
                <span className="text-xs text-text-muted">dias garantia</span>
              </div>
            </div>

            <div className="space-y-2">
              {quoteItems.map((item, idx) => (
                <div key={idx} className="grid gap-2 sm:grid-cols-12">
                  <select
                    value={item.itemType}
                    onChange={(e) => {
                      const next = [...quoteItems];
                      next[idx]!.itemType = e.target.value as QuoteItemType;
                      setQuoteItems(next);
                    }}
                    className="rounded-md border border-border bg-bg px-2 py-2 text-xs sm:col-span-2"
                  >
                    <option value="labor">Mão de obra</option>
                    <option value="part">Peça</option>
                    <option value="diagnostic">Diagnóstico</option>
                    <option value="discount">Desconto</option>
                  </select>
                  <input
                    value={item.description}
                    onChange={(e) => {
                      const next = [...quoteItems];
                      next[idx]!.description = e.target.value;
                      setQuoteItems(next);
                    }}
                    placeholder="Descrição do item"
                    className="rounded-md border border-border bg-bg px-3 py-2 text-sm sm:col-span-5"
                  />
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => {
                      const next = [...quoteItems];
                      next[idx]!.quantity = Number(e.target.value);
                      setQuoteItems(next);
                    }}
                    className="rounded-md border border-border bg-bg px-2 py-2 text-sm font-mono sm:col-span-1"
                  />
                  <input
                    value={item.unitCostBrl}
                    onChange={(e) => {
                      const next = [...quoteItems];
                      next[idx]!.unitCostBrl = e.target.value;
                      setQuoteItems(next);
                    }}
                    placeholder="Custo R$"
                    className="rounded-md border border-border bg-bg px-2 py-2 text-sm font-mono sm:col-span-2"
                  />
                  <div className="flex gap-1 sm:col-span-2">
                    <input
                      value={item.unitPriceBrl}
                      onChange={(e) => {
                        const next = [...quoteItems];
                        next[idx]!.unitPriceBrl = e.target.value;
                        setQuoteItems(next);
                      }}
                      placeholder="Venda R$"
                      className="w-full rounded-md border border-border bg-bg px-2 py-2 text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setQuoteItems((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="p-2 text-text-muted hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
              <button
                type="button"
                onClick={() =>
                  setQuoteItems((prev) => [
                    ...prev,
                    {
                      itemType: 'part',
                      description: '',
                      quantity: 1,
                      unitCostBrl: '0',
                      unitPriceBrl: '0',
                    },
                  ])
                }
                className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar item
              </button>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="font-mono text-xs text-text-secondary">
                  Margem est.: {formatBrl(liveTotals.estimatedMarginCents)} ({liveTotals.marginPercent}%)
                </span>
                <span className="font-mono text-base font-bold text-accent">
                  Total: {formatBrl(liveTotals.totalCents)}
                </span>
                <button
                  type="button"
                  onClick={() => void handleCreateQuote(true)}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
                >
                  Salvar e Liberar no Portal
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {quotes.map((q) => (
              <div
                key={q.id}
                className="rounded-lg border border-border bg-surface p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-accent">
                      {q.code} · {QUOTE_TIER_LABELS[q.tier] ?? q.tier}
                    </span>
                    <p className="text-lg font-bold font-mono tabular-nums">
                      {formatBrl(q.totalCents)}
                    </p>
                  </div>
                  <span className="rounded bg-surface-muted px-2.5 py-1 font-mono text-xs font-semibold">
                    {q.status}
                  </span>
                </div>

                <ul className="space-y-1 text-xs text-text-secondary">
                  {q.items.map((it) => (
                    <li key={it.id} className="flex justify-between">
                      <span>
                        {it.quantity}x {it.description}
                      </span>
                      <span className="font-mono">{formatBrl(it.totalPriceCents)}</span>
                    </li>
                  ))}
                </ul>

                {q.acceptanceHash && (
                  <p className="font-mono text-[11px] text-success">
                    Aceite digital: {q.acceptanceHash.slice(0, 20)}...
                  </p>
                )}

                {q.status === 'DRAFT' && (
                  <button
                    type="button"
                    onClick={() => void handleSendQuote(q.id)}
                    className="rounded-md border border-accent px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10"
                  >
                    Enviar para Portal do Cliente
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'hardware' && params.id && (
        <HardwareCompareTab osId={params.id} data={hwData} onReload={load} />
      )}

      {tab === 'warranty' && params.id && (
        <WarrantyRmaTab
          osId={params.id}
          warranties={warranties}
          onReload={load}
        />
      )}
    </div>
  );
}

export default function OsDetailPage() {
  return (
    <ErpShell title="Detalhe da Ordem de Serviço">
      {() => <OsDetailContent />}
    </ErpShell>
  );
}
