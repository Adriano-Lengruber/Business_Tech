'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CheckCircle2, FileText, MessageSquare, Plus, QrCode, Search } from 'lucide-react';
import { ErpShell } from '@/components/erp-shell';
import { apiFetch } from '@/lib/api';

interface CustomerItem {
  id: string;
  name: string;
  phoneE164: string;
  email: string | null;
}

interface AssetItem {
  id: string;
  category: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  qrToken: string;
}

interface CreatedOsResult {
  id: string;
  code: string;
  portalUrl: string;
}

function NewOsForm() {
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustDoc, setNewCustDoc] = useState('');

  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [showNewAsset, setShowNewAsset] = useState(false);
  const [assetCategory, setAssetCategory] = useState('notebook');
  const [assetBrand, setAssetBrand] = useState('');
  const [assetModel, setAssetModel] = useState('');
  const [assetSerial, setAssetSerial] = useState('');

  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [symptoms, setSymptoms] = useState('');
  const [preliminaryDiagnosis, setPreliminaryDiagnosis] = useState('');
  const [chargerIncluded, setChargerIncluded] = useState(true);
  const [backupRequested, setBackupRequested] = useState(false);
  const [scratchesNoted, setScratchesNoted] = useState(false);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOs, setCreatedOs] = useState<CreatedOsResult | null>(null);

  async function searchCustomers(query: string) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const rows = await apiFetch<CustomerItem[]>(
      `/customers?q=${encodeURIComponent(query)}`,
      { token },
    );
    setCustomers(rows);
  }

  useEffect(() => {
    void searchCustomers('');
  }, []);

  useEffect(() => {
    const token = window.localStorage.getItem('al_token');
    if (!token || !selectedCustomer) {
      setAssets([]);
      return;
    }
    apiFetch<AssetItem[]>(`/assets?customerId=${selectedCustomer.id}`, { token })
      .then((rows) => {
        setAssets(rows);
        if (rows[0]) setSelectedAssetId(rows[0].id);
      })
      .catch(() => setAssets([]));
  }, [selectedCustomer]);

  async function handleCreateCustomer() {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    setError(null);
    try {
      const cust = await apiFetch<CustomerItem>('/customers', {
        method: 'POST',
        token,
        body: JSON.stringify({
          type: 'PF',
          name: newCustName,
          phoneE164: newCustPhone,
          document: newCustDoc || undefined,
        }),
      });
      setSelectedCustomer(cust);
      setShowNewCustomer(false);
      setShowNewAsset(true);
      await searchCustomers(cust.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar cliente');
    }
  }

  async function handleCreateAsset() {
    const token = window.localStorage.getItem('al_token');
    if (!token || !selectedCustomer) return;
    setError(null);
    try {
      const asset = await apiFetch<AssetItem>('/assets', {
        method: 'POST',
        token,
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          category: assetCategory,
          brand: assetBrand || undefined,
          model: assetModel || undefined,
          serialNumber: assetSerial || undefined,
        }),
      });
      setAssets((prev) => [asset, ...prev]);
      setSelectedAssetId(asset.id);
      setShowNewAsset(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar ativo');
    }
  }

  async function handleSubmitOs(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token || !selectedCustomer) {
      setError('Selecione ou cadastre um cliente primeiro.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await apiFetch<CreatedOsResult>('/service-orders', {
        method: 'POST',
        token,
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          assetId: selectedAssetId || null,
          priority,
          reportedSymptoms: symptoms,
          preliminaryDiagnosis: preliminaryDiagnosis || undefined,
          intakeChecklist: {
            chargerIncluded,
            backupRequested,
            scratchesNoted,
          },
          notifyWhatsapp,
        }),
      });

      if (photoFile) {
        const formData = new FormData();
        formData.append('file', photoFile);
        const apiBase =
          process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
        await fetch(`${apiBase}/service-orders/${created.id}/attachments`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      }

      setCreatedOs(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar OS');
    } finally {
      setSubmitting(false);
    }
  }

  if (createdOs) {
    const portalRelative = createdOs.portalUrl.replace(/^https?:\/\/[^/]+/, '');
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-success/40 bg-surface p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-success">
          <CheckCircle2 className="h-6 w-6" />
          <h2 className="text-lg font-semibold">
            OS {createdOs.code} registrada e WhatsApp enfileirado!
          </h2>
        </div>
        <p className="text-sm text-text-secondary">
          O cliente foi notificado com o resumo do equipamento e o link mágico de acompanhamento em tempo real.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href={`/app/os/${createdOs.id}`}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
          >
            <FileText className="h-4 w-4" />
            Abrir OS & Termo PDF
          </Link>
          <Link
            href={portalRelative}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted"
          >
            Ver Portal do Cliente
          </Link>
          <Link
            href="/app/inbox"
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted"
          >
            <MessageSquare className="h-4 w-4" />
            Ir ao Inbox WhatsApp
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitOs} className="space-y-6">
      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Passo 1: Cliente */}
      <section className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">1. Cliente (Busca ou Cadastro Expresso)</h2>
          <button
            type="button"
            onClick={() => setShowNewCustomer((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            {showNewCustomer ? 'Cancelar novo cliente' : 'Novo cliente rápido'}
          </button>
        </div>

        {!showNewCustomer ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                <input
                  type="text"
                  placeholder="Buscar por nome, WhatsApp ou CPF/CNPJ..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    void searchCustomers(e.target.value);
                  }}
                  className="w-full rounded-md border border-border bg-bg py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {customers.slice(0, 6).map((c) => {
                const active = selectedCustomer?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCustomer(c)}
                    className={`rounded-md border p-3 text-left text-sm transition-colors ${
                      active
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-bg hover:bg-surface-muted'
                    }`}
                  >
                    <p className="font-medium">{c.name}</p>
                    <p className="font-mono text-xs text-text-muted">{c.phoneE164}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              placeholder="Nome completo *"
              value={newCustName}
              onChange={(e) => setNewCustName(e.target.value)}
              className="rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <input
              placeholder="WhatsApp (ex: 11999990000) *"
              value={newCustPhone}
              onChange={(e) => setNewCustPhone(e.target.value)}
              className="rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <div className="flex gap-2">
              <input
                placeholder="CPF/CNPJ (opcional)"
                value={newCustDoc}
                onChange={(e) => setNewCustDoc(e.target.value)}
                className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => void handleCreateCustomer()}
                className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground"
              >
                Salvar
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Passo 2: Equipamento / Ativo */}
      <section className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">2. Equipamento / Ativo (com QR Code)</h2>
          {selectedCustomer && (
            <button
              type="button"
              onClick={() => setShowNewAsset((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              <QrCode className="h-3.5 w-3.5" />
              {showNewAsset ? 'Fechar' : 'Cadastrar equipamento'}
            </button>
          )}
        </div>

        {!selectedCustomer ? (
          <p className="text-xs text-text-muted">Selecione um cliente acima para vincular o dispositivo.</p>
        ) : showNewAsset ? (
          <div className="grid gap-3 sm:grid-cols-4">
            <select
              value={assetCategory}
              onChange={(e) => setAssetCategory(e.target.value)}
              className="rounded-md border border-border bg-bg px-3 py-2 text-sm"
            >
              <option value="notebook">Notebook</option>
              <option value="desktop">Desktop</option>
              <option value="impressora-3d">Impressora 3D</option>
              <option value="periferico">Periférico</option>
            </select>
            <input
              placeholder="Marca (ex: Lenovo)"
              value={assetBrand}
              onChange={(e) => setAssetBrand(e.target.value)}
              className="rounded-md border border-border bg-bg px-3 py-2 text-sm"
            />
            <input
              placeholder="Modelo (ex: ThinkPad T14)"
              value={assetModel}
              onChange={(e) => setAssetModel(e.target.value)}
              className="rounded-md border border-border bg-bg px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <input
                placeholder="Nº Série"
                value={assetSerial}
                onChange={(e) => setAssetSerial(e.target.value)}
                className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleCreateAsset()}
                className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground"
              >
                Add
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {assets.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedAssetId(a.id)}
                className={`rounded-md border p-3 text-left text-sm ${
                  selectedAssetId === a.id
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-bg hover:bg-surface-muted'
                }`}
              >
                <p className="font-medium">
                  {[a.category, a.brand, a.model].filter(Boolean).join(' · ')}
                </p>
                <p className="font-mono text-xs text-text-muted">
                  QR: {a.qrToken} {a.serialNumber ? `| S/N: ${a.serialNumber}` : ''}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Passo 3: Sintomas, Pré-diagnóstico e Evidências */}
      <section className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <h2 className="text-sm font-semibold">3. Sintomas, Checklist e Notificação WhatsApp</h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-text-secondary">
              Sintomas relatados pelo cliente *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Ex: Liga mas não dá vídeo; cooler dispara e desliga..."
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary">
              Prioridade
            </label>
            <select
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT')
              }
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            >
              <option value="LOW">Baixa</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </select>

            <label className="mt-3 block text-xs font-medium text-text-secondary">
              Foto de entrada (S3 privado)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-xs text-text-secondary"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary">
            Pré-diagnóstico inicial do balcão (opcional)
          </label>
          <input
            type="text"
            placeholder="Ex: Suspeita de memória RAM oxidada ou falha no circuito de carga"
            value={preliminaryDiagnosis}
            onChange={(e) => setPreliminaryDiagnosis(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-wrap gap-5 pt-1 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={chargerIncluded}
              onChange={(e) => setChargerIncluded(e.target.checked)}
            />
            Carregador incluso
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={backupRequested}
              onChange={(e) => setBackupRequested(e.target.checked)}
            />
            Backup solicitado
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={scratchesNoted}
              onChange={(e) => setScratchesNoted(e.target.checked)}
            />
            Marcas/arranhões prévios
          </label>
          <label className="flex items-center gap-2 font-medium text-accent">
            <input
              type="checkbox"
              checked={notifyWhatsapp}
              onChange={(e) => setNotifyWhatsapp(e.target.checked)}
            />
            Notificar cliente no WhatsApp imediatamente
          </label>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting || !selectedCustomer}
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
          >
            {submitting ? 'Registrando OS...' : 'Dar Entrada na OS e Notificar'}
          </button>
        </div>
      </section>
    </form>
  );
}

export default function NewOsPage() {
  return (
    <ErpShell
      title="Balcão Expresso — Nova Ordem de Serviço"
      subtitle="Entrada rápida de equipamento com notificação automática no WhatsApp"
    >
      {() => <NewOsForm />}
    </ErpShell>
  );
}
