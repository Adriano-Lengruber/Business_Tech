'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, Laptop, ShieldCheck } from 'lucide-react';
import { OS_STATUS_LABELS, type OsStatus } from '@al/shared';
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

function CustomerPortalContent() {
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
                Olá <strong>{data.customerFirstName}</strong>, acompanhe abaixo o status em tempo real do seu atendimento.
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
                  <strong className="text-text-primary">Sintomas relatados:</strong>{' '}
                  {data.reportedSymptoms}
                </p>
                {data.preliminaryDiagnosis && (
                  <p className="text-text-secondary">
                    <strong className="text-text-primary">Pré-avaliação:</strong>{' '}
                    {data.preliminaryDiagnosis}
                  </p>
                )}
              </div>
            </div>

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

            {data.attachments.length > 0 && (
              <div className="rounded-xl border border-border bg-surface p-5">
                <h2 className="text-sm font-semibold">Evidências Registradas na Entrada</h2>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {data.attachments.map((att) =>
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
                          className="h-32 w-full object-cover"
                        />
                      </a>
                    ) : null,
                  )}
                </div>
              </div>
            )}

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
