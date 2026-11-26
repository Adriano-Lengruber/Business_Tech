'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import type { TaxRegime } from '@al/shared';
import { ErpShell, type ErpSession } from '@/components/erp-shell';
import { apiFetch } from '@/lib/api';

interface FiscalProfile {
  taxRegime: TaxRegime;
  stateUf: string;
  cityCode: string;
  providerName: 'sandbox' | 'focus_nfe' | 'plugnotas';
}

interface FiscalDocumentRow {
  id: string;
  docType: string;
  status: string;
  number: number;
  series: number;
  accessKey: string | null;
  totalCents: number;
  rejectionReason: string | null;
  aiDiagnosticHint: string | null;
}

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function FiscalContent({ session }: { session: ErpSession }) {
  const [profile, setProfile] = useState<FiscalProfile>({
    taxRegime: 'SIMPLES_NACIONAL',
    stateUf: 'SP',
    cityCode: '3550308',
    providerName: 'sandbox',
  });
  const [docs, setDocs] = useState<FiscalDocumentRow[]>([]);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const enabled = session.enabledModules.includes('mod-finance-fiscal');

  const load = useCallback(async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token || !enabled) return;
    const [prof, list] = await Promise.all([
      apiFetch<FiscalProfile>('/fiscal/profile', { token }),
      apiFetch<FiscalDocumentRow[]>('/fiscal/documents', { token }),
    ]);
    setProfile(prof);
    setDocs(list);
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch('/fiscal/profile', {
      method: 'PUT',
      token,
      body: JSON.stringify(profile),
    });
    setSavedMsg('Perfil tributário salvo!');
    setTimeout(() => setSavedMsg(null), 2500);
  }

  async function handleDiagnose(docId: string) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch(`/fiscal/documents/${docId}/diagnose-rejection`, {
      method: 'POST',
      token,
    });
    await load();
  }

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-secondary">
        O módulo <strong>Financeiro & Fiscal BR</strong> está desativado.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSaveProfile}
        className="rounded-2xl border border-border bg-surface p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Parametrização Tributária (Brasil)</h2>
          {savedMsg && <span className="text-xs text-success">{savedMsg}</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <select
            value={profile.taxRegime}
            onChange={(e) =>
              setProfile((p) => ({ ...p, taxRegime: e.target.value as TaxRegime }))
            }
            className="rounded-xl border border-border bg-bg px-3 py-2 text-sm"
          >
            <option value="SIMPLES_NACIONAL">Simples Nacional</option>
            <option value="MEI">MEI</option>
            <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
            <option value="LUCRO_REAL">Lucro Real</option>
          </select>
          <input
            maxLength={2}
            value={profile.stateUf}
            onChange={(e) =>
              setProfile((p) => ({ ...p, stateUf: e.target.value.toUpperCase() }))
            }
            placeholder="UF (ex: SP)"
            className="rounded-xl border border-border bg-bg px-3 py-2 text-sm font-mono"
          />
          <select
            value={profile.providerName}
            onChange={(e) =>
              setProfile((p) => ({
                ...p,
                providerName: e.target.value as 'sandbox' | 'focus_nfe' | 'plugnotas',
              }))
            }
            className="rounded-xl border border-border bg-bg px-3 py-2 text-sm"
          >
            <option value="sandbox">Adapter Sandbox Local</option>
            <option value="focus_nfe">Focus NFe</option>
            <option value="plugnotas">PlugNotas</option>
          </select>
          <button
            type="submit"
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
          >
            Salvar Perfil Fiscal
          </button>
        </div>
      </form>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Documentos Fiscais Emitidos</h2>
        {docs.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-secondary">
            Nenhuma NF-e / NFC-e / NFS-e emitida ainda. Emita diretamente após uma venda no PDV!
          </div>
        ) : (
          docs.map((d) => (
            <div
              key={d.id}
              className="rounded-2xl border border-border bg-surface p-4 space-y-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-accent">
                    {d.docType} #{d.number} (Série {d.series})
                  </span>{' '}
                  · <span className="font-mono">{formatBrl(d.totalCents)}</span>
                </div>
                <span
                  className={`rounded px-2 py-0.5 font-mono text-xs font-semibold ${
                    d.status === 'AUTHORIZED'
                      ? 'bg-success/15 text-success'
                      : 'bg-danger/15 text-danger'
                  }`}
                >
                  {d.status}
                </span>
              </div>
              {d.accessKey && (
                <p className="font-mono text-xs text-text-muted">
                  Chave: {d.accessKey}
                </p>
              )}
              {d.rejectionReason && (
                <div className="space-y-2 rounded bg-danger/10 p-3 text-xs text-danger">
                  <p>{d.rejectionReason}</p>
                  {!d.aiDiagnosticHint ? (
                    <button
                      type="button"
                      onClick={() => void handleDiagnose(d.id)}
                      className="inline-flex items-center gap-1 rounded bg-surface px-2.5 py-1 font-medium text-accent"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Diagnosticar Rejeição com Agente Fiscal IA
                    </button>
                  ) : (
                    <p className="rounded bg-surface p-2 text-text-primary">
                      <strong>Sugestão IA:</strong> {d.aiDiagnosticHint}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function FiscalPage() {
  return (
    <ErpShell
      title="Camada Fiscal (NF-e / NFC-e / NFS-e)"
      subtitle="Parametrização desacoplada por regime e diagnóstico de rejeições SEFAZ por IA"
    >
      {(session) => <FiscalContent session={session} />}
    </ErpShell>
  );
}
