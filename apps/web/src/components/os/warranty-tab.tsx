'use client';

import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { apiFetch } from '@/lib/api';

export interface WarrantyRow {
  id: string;
  code: string;
  kind: 'service' | 'part_rma';
  status: 'ACTIVE' | 'CLAIMED' | 'IN_RMA' | 'RESOLVED';
  warrantyDays: number;
  expiresAt: string;
  supplierName: string | null;
  partDescription: string | null;
  notes: string | null;
  resolutionNotes: string | null;
}

export function WarrantyRmaTab({
  osId,
  warranties,
  onReload,
}: {
  osId: string;
  warranties: WarrantyRow[];
  onReload: () => Promise<void>;
}) {
  const [kind, setKind] = useState<'service' | 'part_rma'>('service');
  const [warrantyDays, setWarrantyDays] = useState('90');
  const [partDescription, setPartDescription] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    setSaving(true);
    try {
      await apiFetch(`/service-orders/${osId}/warranties`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          kind,
          warrantyDays: Number(warrantyDays) || 90,
          partDescription: partDescription || undefined,
          supplierName: supplierName || undefined,
          notes: notes || undefined,
        }),
      });
      setPartDescription('');
      setSupplierName('');
      setNotes('');
      await onReload();
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeStatus(
    id: string,
    status: 'CLAIMED' | 'IN_RMA' | 'RESOLVED',
  ) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch(`/warranties/${id}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status }),
    });
    await onReload();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="p-5 lg:col-span-2">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-accent" />
          Emitir Garantia ou RMA de Peça
        </h3>
        <form onSubmit={handleCreate} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs text-text-secondary">Tipo</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as 'service' | 'part_rma')}
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            >
              <option value="service">Garantia do Serviço</option>
              <option value="part_rma">Garantia de Peça / RMA Fornecedor</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-secondary">
              Prazo (dias)
            </label>
            <input
              type="number"
              value={warrantyDays}
              onChange={(e) => setWarrantyDays(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary">
              Peça / Escopo coberto
            </label>
            <input
              placeholder="Ex: SSD NVMe 1TB / Serviço de reparo placa"
              value={partDescription}
              onChange={(e) => setPartDescription(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary">
              Fornecedor (para RMA)
            </label>
            <input
              placeholder="Opcional"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary">Observações</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? 'Registrando...' : 'Registrar Garantia'}
          </button>
        </form>
      </Card>

      <div className="space-y-3 lg:col-span-3">
        {warranties.length === 0 ? (
          <Card className="p-6 text-sm text-text-secondary">
            Nenhuma garantia ou RMA registrado para esta OS ainda.
          </Card>
        ) : (
          warranties.map((w) => (
            <Card key={w.id} className="p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-xs font-bold text-accent">
                    {w.code} · {w.kind === 'part_rma' ? 'PEÇA / RMA' : 'SERVIÇO'}
                  </span>
                  <h4 className="mt-0.5 text-sm font-semibold">
                    {w.partDescription || 'Cobertura padrão da Ordem de Serviço'}
                  </h4>
                </div>
                <span className="rounded-full border border-border bg-surface-muted px-2.5 py-0.5 font-mono text-[11px] font-semibold">
                  {w.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
                <span>
                  Validade:{' '}
                  <strong className="font-mono text-text-primary">
                    {new Date(w.expiresAt).toLocaleDateString('pt-BR')} (
                    {w.warrantyDays}d)
                  </strong>
                </span>
                {w.supplierName && <span>Fornecedor: {w.supplierName}</span>}
              </div>

              {w.notes && <p className="text-xs text-text-muted">{w.notes}</p>}

              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                {w.status === 'ACTIVE' && (
                  <button
                    type="button"
                    onClick={() => void handleChangeStatus(w.id, 'CLAIMED')}
                    className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-medium text-warning hover:bg-warning/20"
                  >
                    Acionar Garantia (Reabrir OS)
                  </button>
                )}
                {(w.status === 'ACTIVE' || w.status === 'CLAIMED') && (
                  <button
                    type="button"
                    onClick={() => void handleChangeStatus(w.id, 'IN_RMA')}
                    className="rounded-lg border border-border bg-bg px-3 py-1 text-xs font-medium hover:border-accent"
                  >
                    Enviar RMA Fornecedor
                  </button>
                )}
                {w.status !== 'RESOLVED' && (
                  <button
                    type="button"
                    onClick={() => void handleChangeStatus(w.id, 'RESOLVED')}
                    className="rounded-lg bg-success/15 px-3 py-1 text-xs font-medium text-success hover:bg-success/25"
                  >
                    Concluir / Encerrar
                  </button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
