'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { FileText, Upload } from 'lucide-react';
import { OS_STATUSES, OS_STATUS_LABELS, type OsStatus } from '@al/shared';
import { ErpShell } from '@/components/erp-shell';
import { apiFetch } from '@/lib/api';

interface OsDetail {
  os: {
    id: string;
    code: string;
    status: OsStatus;
    priority: string;
    reportedSymptoms: string;
    preliminaryDiagnosis: string | null;
    createdAt: string;
  };
  customer: {
    name: string;
    phoneE164: string;
  };
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

function OsDetailContent() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<OsDetail | null>(null);
  const [nextStatus, setNextStatus] = useState<OsStatus>('DIAGNOSIS');
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token || !params.id) return;
    const data = await apiFetch<OsDetail>(`/service-orders/${params.id}`, {
      token,
    });
    setDetail(data);
    setNextStatus(data.os.status);
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
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
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

  if (error) {
    return <div className="text-sm text-danger">{error}</div>;
  }
  if (!detail) {
    return <div className="text-sm text-text-secondary">Carregando OS...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface p-5">
        <div>
          <span className="font-mono text-sm font-bold text-accent">
            {detail.os.code}
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
