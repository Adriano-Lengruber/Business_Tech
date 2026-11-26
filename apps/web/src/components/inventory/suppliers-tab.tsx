'use client';

import { useState, type FormEvent } from 'react';
import { Building2, Edit3, ExternalLink, Plus, Trash2, X } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { apiFetch } from '@/lib/api';

export interface RichSupplierRow {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  leadTimeDays: number;
  websiteUrl: string | null;
  paymentTerms: string | null;
  acceptsMei: boolean;
  notes: string | null;
}

export function SuppliersTab({
  suppliers,
  onChanged,
}: {
  suppliers: RichSupplierRow[];
  onChanged: (msg: string) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RichSupplierRow | null>(null);

  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('3');
  const [paymentTerms, setPaymentTerms] = useState('PIX / Boleto 28d');
  const [acceptsMei, setAcceptsMei] = useState(true);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  function startCreate() {
    setEditing(null);
    setName('');
    setCnpj('');
    setPhone('');
    setEmail('');
    setWebsiteUrl('');
    setLeadTimeDays('3');
    setPaymentTerms('PIX / Boleto 28d');
    setAcceptsMei(true);
    setNotes('');
    setShowForm(true);
  }

  function startEdit(s: RichSupplierRow) {
    setEditing(s);
    setName(s.name);
    setCnpj(s.cnpj ?? '');
    setPhone(s.phone ?? '');
    setEmail(s.email ?? '');
    setWebsiteUrl(s.websiteUrl ?? '');
    setLeadTimeDays(String(s.leadTimeDays));
    setPaymentTerms(s.paymentTerms ?? '');
    setAcceptsMei(s.acceptsMei);
    setNotes(s.notes ?? '');
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    setError(null);
    try {
      await apiFetch(
        editing
          ? `/inventory/suppliers/${editing.id}`
          : '/inventory/suppliers',
        {
          method: editing ? 'PATCH' : 'POST',
          token,
          body: JSON.stringify({
            name,
            cnpj: cnpj || undefined,
            phone: phone || undefined,
            email: email || undefined,
            websiteUrl: websiteUrl || undefined,
            leadTimeDays: Number(leadTimeDays) || 3,
            paymentTerms: paymentTerms || undefined,
            acceptsMei,
            notes: notes || undefined,
          }),
        },
      );
      setShowForm(false);
      await onChanged(
        editing
          ? `Fornecedor ${name} atualizado!`
          : `Fornecedor ${name} cadastrado com sucesso!`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar fornecedor');
    }
  }

  async function handleArchive(id: string, supName: string) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch(`/inventory/suppliers/${id}`, {
      method: 'DELETE',
      token,
    });
    await onChanged(`Fornecedor "${supName}" inativado.`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">
            Diretório de Fornecedores & Distribuidores B2B
          </h2>
          <p className="text-xs text-text-secondary">
            Cadastre distribuidores de hardware, telas de notebook, filamentos 3D e indique quais homologam CNPJ MEI.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo Fornecedor
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {showForm && (
        <Card className="border-accent/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold">
              {editing ? `Editar Fornecedor · ${editing.name}` : 'Cadastrar Fornecedor B2B'}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg p-1 text-text-muted hover:bg-surface-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-3">
            <input
              required
              placeholder="Nome Fantasia / Razão Social *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sm:col-span-2 rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            />
            <input
              placeholder="CNPJ (ex: 12.345.678/0001-99)"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              className="rounded-xl border border-border bg-bg px-3 py-2 font-mono text-sm"
            />
            <input
              placeholder="WhatsApp / Telefone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            />
            <input
              type="email"
              placeholder="E-mail comercial"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            />
            <input
              placeholder="Portal / Site B2B (https://...)"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={0}
              placeholder="Prazo entrega (dias)"
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(e.target.value)}
              className="rounded-xl border border-border bg-bg px-3 py-2 font-mono text-sm"
            />
            <input
              placeholder="Condições de pgto (ex: PIX, Boleto 28d)"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-xs">
              <input
                type="checkbox"
                checked={acceptsMei}
                onChange={(e) => setAcceptsMei(e.target.checked)}
                className="accent-accent"
              />
              Homologa / Aceita CNPJ MEI
            </label>
            <textarea
              rows={2}
              placeholder="Especialidades, pedido mínimo, nome do vendedor, observações..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="sm:col-span-3 rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            />
            <div className="sm:col-span-3 flex justify-end gap-2">
              <button
                type="submit"
                className="rounded-xl bg-accent px-5 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover"
              >
                {editing ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {suppliers.map((s) => (
          <Card key={s.id} className="p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-accent" />
                  <h3 className="font-semibold text-text-primary">{s.name}</h3>
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-text-muted">
                  {s.cnpj ? `CNPJ ${s.cnpj} · ` : ''}
                  Prazo médio: {s.leadTimeDays} dia(s)
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {s.acceptsMei && (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-success">
                    ACEITA MEI
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => startEdit(s)}
                  className="rounded-lg border border-border p-1.5 text-text-secondary hover:bg-surface-muted"
                  title="Editar fornecedor"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleArchive(s.id, s.name)}
                  className="rounded-lg border border-border p-1.5 text-danger hover:bg-danger/10"
                  title="Inativar fornecedor"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
              {s.phone && <span className="font-mono">{s.phone}</span>}
              {s.email && <span>{s.email}</span>}
              {s.paymentTerms && (
                <span className="rounded bg-surface-muted px-2 py-0.5">
                  {s.paymentTerms}
                </span>
              )}
              {s.websiteUrl && (
                <a
                  href={s.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  Portal <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {s.notes && (
              <p className="rounded-xl border border-border bg-bg p-2.5 text-xs text-text-secondary">
                {s.notes}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
