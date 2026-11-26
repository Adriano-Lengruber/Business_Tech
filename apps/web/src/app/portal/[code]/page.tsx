'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, Copy, Laptop, ShieldCheck } from 'lucide-react';
import { OS_STATUS_LABELS, QUOTE_TIER_LABELS, type OsStatus, type QuoteTier } from '@al/shared';
import { apiFetch } from '@/lib/api';
import { ThemeToggle } from '@/components/theme-provider';

interface PortalData {
  organizationName: string;
  code: string;
  status: OsStatus;
  priority: string;
  reportedSymptoms: string;
  preliminaryDiagnosis: string | null;
  createdAt: string;
  customerFirstName: string;
  asset: {
    category: string;
    brand: string | null;
    model: string | null;
    qrToken: string;
  } | null;
  diagnostic: {
    finalDiagnosis: string | null;
    clientExplanation: string | null;
  } | null;
  hardwareComparison?: {
    before: {
      ramGb: number | null;
      storageSummary: string | null;
      smartHealthPct: number | null;
      cpuTempCelsius: number | null;
    } | null;
    after: {
      ramGb: number | null;
      storageSummary: string | null;
      smartHealthPct: number | null;
      cpuTempCelsius: number | null;
    } | null;
  } | null;
  quotes: Array<{
    id: string;
    code: string;
    tier: QuoteTier;
    status: string;
    warrantyDays: number;
    paymentTerms: string;
    clientNotes: string | null;
    totalCents: number;
    acceptanceHash: string | null;
    items: Array<{
      id: string;
      description: string;
      quantity: number;
      totalPriceCents: number;
    }>;
  }>;
  payments: Array<{
    id: string;
    description: string;
    status: string;
    amountCents: number;
    pixCopyPaste: string | null;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    fromStatus: string | null;
    toStatus: string | null;
    note: string | null;
    createdAt: string;
  }>;
  attachments: Array<{
    id: string;
    filename: string;
    signedUrl: string | null;
  }>;
}

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function CustomerPortalContent() {
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  const loadPortal = useCallback(() => {
    if (!params.code || !token) {
      setError('Link de acompanhamento inválido ou incompleto.');
      return;
    }
    apiFetch<PortalData>(
      `/portal/${encodeURIComponent(params.code)}?token=${encodeURIComponent(token)}`,
    )
      .then(setData)
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : 'Não foi possível validar seu link de acompanhamento.',
        ),
      );
  }, [params.code, token]);

  useEffect(() => {
    loadPortal();
  }, [loadPortal]);

  async function handleDecision(
    quoteId: string,
    decision: 'APPROVED' | 'REJECTED',
  ) {
    setDecidingId(quoteId);
    try {
      await apiFetch(
        `/portal/${encodeURIComponent(params.code)}/quotes/${quoteId}/decide?token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          body: JSON.stringify({ decision, paymentMethod: 'pix' }),
        },
      );
      loadPortal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar decisão');
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-6 text-text-primary">
      <div className="mx-auto max-w-xl space-y-5">
        <header className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs text-accent">PORTAL DO CLIENTE</p>
            <h1 className="text-lg font-semibold">
              {data?.organizationName ?? 'Acompanhamento de Ordem de Serviço'}
            </h1>
          </div>
          <ThemeToggle />
        </header>

        {error && (
          <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold text-accent">
                  {data.code}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                  <Clock className="h-3.5 w-3.5" />
                  {OS_STATUS_LABELS[data.status] ?? data.status}
                </span>
              </div>

              <p className="mt-3 text-sm text-text-secondary">
                Olá <strong>{data.customerFirstName}</strong>, acompanhe abaixo o status e orçamento do seu atendimento.
              </p>

              {data.asset && (
                <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-bg p-3">
                  <Laptop className="h-5 w-5 text-accent" />
                  <div className="text-sm">
                    <p className="font-medium">
                      {[data.asset.category, data.asset.brand, data.asset.model]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <p className="font-mono text-xs text-text-muted">
                      QR: {data.asset.qrToken}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-2 text-sm">
                <p className="text-text-secondary">
                  <strong className="text-text-primary">Sintomas:</strong>{' '}
                  {data.reportedSymptoms}
                </p>
                {data.diagnostic?.clientExplanation && (
                  <div className="rounded-xl border border-accent/25 bg-accent/5 p-3 text-xs text-text-secondary">
                    <strong className="block text-text-primary">
                      Explicação Técnica do Diagnóstico:
                    </strong>
                    {data.diagnostic.clientExplanation}
                  </div>
                )}
                {data.hardwareComparison && (
                  <div className="rounded-xl border border-border bg-bg p-3 text-xs">
                    <strong className="block font-mono text-[11px] uppercase text-accent">
                      Comparativo Técnico (Antes x Depois)
                    </strong>
                    <div className="mt-2 grid grid-cols-2 gap-2 font-mono">
                      <div className="rounded-lg bg-surface p-2">
                        <span className="block text-[10px] text-text-muted">ENTRADA</span>
                        <span>
                          RAM: {data.hardwareComparison.before?.ramGb ?? '—'}GB · Temp:{' '}
                          {data.hardwareComparison.before?.cpuTempCelsius ?? '—'}°C
                        </span>
                      </div>
                      <div className="rounded-lg bg-surface p-2">
                        <span className="block text-[10px] text-success">ENTREGA</span>
                        <span>
                          RAM: {data.hardwareComparison.after?.ramGb ?? '—'}GB · Temp:{' '}
                          {data.hardwareComparison.after?.cpuTempCelsius ?? '—'}°C
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {data.quotes.map((q) => (
              <div
                key={q.id}
                className="rounded-xl border border-border bg-surface p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs font-semibold text-accent">
                      {q.code} · Proposta {QUOTE_TIER_LABELS[q.tier] ?? q.tier}
                    </span>
                    <p className="font-mono text-xl font-bold">
                      {formatBrl(q.totalCents)}
                    </p>
                  </div>
                  <span className="rounded bg-surface-muted px-2.5 py-1 font-mono text-xs font-semibold">
                    {q.status}
                  </span>
                </div>

                <ul className="space-y-1.5 border-y border-border py-3 text-sm">
                  {q.items.map((it) => (
                    <li key={it.id} className="flex justify-between gap-2">
                      <span className="text-text-secondary">
                        {it.quantity}x {it.description}
                      </span>
                      <span className="font-mono font-medium">
                        {formatBrl(it.totalPriceCents)}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="text-xs text-text-muted">
                  Garantia: {q.warrantyDays} dias · {q.paymentTerms}
                </p>

                {q.status === 'SENT' && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={decidingId === q.id}
                      onClick={() => void handleDecision(q.id, 'APPROVED')}
                      className="flex-1 rounded-md bg-success px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {decidingId === q.id
                        ? 'Registrando...'
                        : 'Aprovar Orçamento (Gerar PIX)'}
                    </button>
                    <button
                      type="button"
                      disabled={decidingId === q.id}
                      onClick={() => void handleDecision(q.id, 'REJECTED')}
                      className="rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-muted"
                    >
                      Recusar
                    </button>
                  </div>
                )}

                {q.acceptanceHash && (
                  <p className="font-mono text-[11px] text-success">
                    Aceite digital registrado · Hash: {q.acceptanceHash.slice(0, 24)}...
                  </p>
                )}
              </div>
            ))}

            {data.payments.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-accent/40 bg-surface p-5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{p.description}</span>
                  <span className="font-mono text-sm font-bold text-accent">
                    {formatBrl(p.amountCents)}
                  </span>
                </div>
                <p className="font-mono text-xs text-text-muted">
                  Status pagamento: {p.status}
                </p>
                {p.pixCopyPaste && p.status === 'PENDING' && (
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(p.pixCopyPaste!);
                      setCopiedPix(true);
                      setTimeout(() => setCopiedPix(false), 2000);
                    }}
                    className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 font-mono text-xs font-semibold text-accent-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copiedPix ? 'PIX Copiado!' : 'Copiar Código PIX'}
                  </button>
                )}
              </div>
            ))}

            <div className="rounded-xl border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold">Histórico de Atualizações</h2>
              <div className="mt-3 space-y-3">
                {data.events.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start gap-2.5 border-l-2 border-accent/40 pl-3 text-sm"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <div>
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
                  </div>
                ))}
              </div>
            </div>

            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-text-muted">
              <ShieldCheck className="h-4 w-4 text-success" />
              Acesso protegido por link mágico · Dúvidas? Responda diretamente no WhatsApp.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function CustomerPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg text-sm text-text-secondary">
          Carregando portal do cliente...
        </div>
      }
    >
      <CustomerPortalContent />
    </Suspense>
  );
}
