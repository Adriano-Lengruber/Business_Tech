'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  BookMarked,
  Edit3,
  Laptop,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Wrench,
} from 'lucide-react';
import { ErpShell } from '@/components/erp-shell';
import { Card, StatusPill } from '@/components/ui/primitives';
import { apiFetch } from '@/lib/api';

interface CustomerListItem {
  id: string;
  type: 'PF' | 'PJ';
  name: string;
  phoneE164: string;
  email: string | null;
}

interface CustomerTimeline {
  customer: CustomerListItem & { createdAt: string };
  assets: Array<{
    id: string;
    category: string;
    brand: string | null;
    model: string | null;
    serialNumber: string | null;
    qrToken: string;
    acquiredFromStore: boolean;
    vipDiscountPct: number;
    storeSaleRef: string | null;
  }>;
  serviceOrders: Array<{
    id: string;
    code: string;
    status: string;
    priority: string;
    reportedSymptoms: string;
    createdAt: string;
  }>;
  warranties: Array<{
    id: string;
    code: string;
    status: string;
    expiresAt: string;
    partDescription: string | null;
  }>;
  contracts: Array<{
    id: string;
    code: string;
    title: string;
    monthlyPriceCents: number;
    status: string;
  }>;
  stats: {
    assetsCount: number;
    vipAssetsCount: number;
    ordersCount: number;
    activeWarrantiesCount: number;
    activeContractsCount: number;
  };
}

interface ServiceCatalogRow {
  id: string;
  code: string;
  name: string;
  category: string;
  defaultLaborCents: number;
  estimatedCostCents: number;
  defaultWarrantyDays: number;
  estimatedHours: number;
}

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function Customers360Content() {
  const [tab, setTab] = useState<'customers' | 'catalog'>('customers');
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<CustomerTimeline | null>(null);

  // New / Edit customer form
  const [showNewCust, setShowNewCust] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [custType, setCustType] = useState<'PF' | 'PJ'>('PF');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');

  // Service Catalog
  const [catalog, setCatalog] = useState<ServiceCatalogRow[]>([]);
  const [srvName, setSrvName] = useState('');
  const [srvCategory, setSrvCategory] = useState('manutencao');
  const [srvPriceBrl, setSrvPriceBrl] = useState('150.00');
  const [srvWarrantyDays, setSrvWarrantyDays] = useState('90');

  const loadCustomers = useCallback(async (q: string) => {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const rows = await apiFetch<CustomerListItem[]>(
      `/customers?q=${encodeURIComponent(q)}`,
      { token },
    );
    setCustomers(rows);
    if (!selectedId && rows[0]) {
      setSelectedId(rows[0].id);
    }
  }, [selectedId]);

  const loadTimeline = useCallback(async (id: string) => {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const data = await apiFetch<CustomerTimeline>(`/customers/${id}/timeline`, {
      token,
    });
    setTimeline(data);
  }, []);

  const loadCatalog = useCallback(async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    try {
      const items = await apiFetch<ServiceCatalogRow[]>('/service-catalog', {
        token,
      });
      setCatalog(items);
    } catch {
      setCatalog([]);
    }
  }, []);

  useEffect(() => {
    void loadCustomers('');
    void loadCatalog();
  }, [loadCustomers, loadCatalog]);

  useEffect(() => {
    if (selectedId) void loadTimeline(selectedId);
  }, [selectedId, loadTimeline]);

  async function handleCreateCustomer(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    if (editingCustomerId) {
      await apiFetch(`/customers/${editingCustomerId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          type: custType,
          name: custName,
          phoneE164: custPhone,
          email: custEmail || null,
        }),
      });
      setEditingCustomerId(null);
      setShowNewCust(false);
      await Promise.all([loadCustomers(query), loadTimeline(editingCustomerId)]);
      return;
    }
    const created = await apiFetch<CustomerListItem>('/customers', {
      method: 'POST',
      token,
      body: JSON.stringify({
        type: custType,
        name: custName,
        phoneE164: custPhone,
        email: custEmail || undefined,
      }),
    });
    setCustName('');
    setCustPhone('');
    setCustEmail('');
    setShowNewCust(false);
    setSelectedId(created.id);
    await loadCustomers('');
  }

  function startEditCustomer() {
    if (!timeline) return;
    setEditingCustomerId(timeline.customer.id);
    setCustType(timeline.customer.type);
    setCustName(timeline.customer.name);
    setCustPhone(timeline.customer.phoneE164);
    setCustEmail(timeline.customer.email ?? '');
    setShowNewCust(true);
  }

  async function handleArchiveCustomer(id: string) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch(`/customers/${id}`, {
      method: 'DELETE',
      token,
    });
    setSelectedId(null);
    setTimeline(null);
    await loadCustomers(query);
  }

  async function handleCreateService(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch('/service-catalog', {
      method: 'POST',
      token,
      body: JSON.stringify({
        name: srvName,
        category: srvCategory,
        defaultLaborCents: Math.round(
          (Number(srvPriceBrl.replace(',', '.')) || 0) * 100,
        ),
        defaultWarrantyDays: Number(srvWarrantyDays) || 90,
      }),
    });
    setSrvName('');
    await loadCatalog();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('customers')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
              tab === 'customers'
                ? 'bg-accent text-accent-foreground'
                : 'border border-border bg-surface text-text-secondary hover:text-text-primary'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Clientes 360° & Equipamentos
          </button>
          <button
            type="button"
            onClick={() => setTab('catalog')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
              tab === 'catalog'
                ? 'bg-accent text-accent-foreground'
                : 'border border-border bg-surface text-text-secondary hover:text-text-primary'
            }`}
          >
            <BookMarked className="h-3.5 w-3.5" />
            Catálogo de Serviços ({catalog.length})
          </button>
        </div>
      </div>

      {tab === 'catalog' ? (
        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="font-display text-sm font-semibold">
              Cadastrar Serviço Padronizado de Bancada
            </h3>
            <form onSubmit={handleCreateService} className="mt-3 grid gap-3 sm:grid-cols-5">
              <input
                required
                placeholder="Descrição do serviço *"
                value={srvName}
                onChange={(e) => setSrvName(e.target.value)}
                className="sm:col-span-2 rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              />
              <select
                value={srvCategory}
                onChange={(e) => setSrvCategory(e.target.value)}
                className="rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              >
                <option value="manutencao">Manutenção</option>
                <option value="upgrade">Upgrade Hardware</option>
                <option value="software">Software / Sistema</option>
                <option value="notebook">Peça Notebook</option>
                <option value="vip">VIP Loja</option>
              </select>
              <input
                placeholder="Mão de obra (R$)"
                value={srvPriceBrl}
                onChange={(e) => setSrvPriceBrl(e.target.value)}
                className="rounded-xl border border-border bg-bg px-3 py-2 font-mono text-sm"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Garantia (d)"
                  value={srvWarrantyDays}
                  onChange={(e) => setSrvWarrantyDays(e.target.value)}
                  className="w-20 rounded-xl border border-border bg-bg px-2.5 py-2 font-mono text-sm"
                />
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover"
                >
                  Salvar
                </button>
              </div>
            </form>
          </Card>

          <Card className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-muted/60 text-xs text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Serviço</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Garantia</th>
                  <th className="px-4 py-3 font-medium text-right">Valor Padrão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {catalog.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-muted/40">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-accent">
                      {s.code}
                    </td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 font-mono text-xs uppercase text-text-secondary">
                      {s.category}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {s.defaultWarrantyDays}d
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {formatBrl(s.defaultLaborCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Lista de clientes */}
          <Card className="p-4 space-y-3 lg:col-span-4 h-fit">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-sm font-semibold">
                Diretório PF / PJ
              </span>
              <button
                type="button"
                onClick={() => setShowNewCust((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent"
              >
                <Plus className="h-3.5 w-3.5" />
                Novo
              </button>
            </div>

            {showNewCust && (
              <form
                onSubmit={handleCreateCustomer}
                className="space-y-2 rounded-xl border border-border bg-bg p-3"
              >
                <div className="flex gap-2">
                  <select
                    value={custType}
                    onChange={(e) => setCustType(e.target.value as 'PF' | 'PJ')}
                    className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs"
                  >
                    <option value="PF">PF</option>
                    <option value="PJ">PJ</option>
                  </select>
                  <input
                    required
                    placeholder="Nome / Razão Social *"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs"
                  />
                </div>
                <input
                  required
                  placeholder="WhatsApp (ex: 11999998888) *"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs"
                />
                <input
                  placeholder="E-mail (opcional)"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-accent py-1.5 text-xs font-semibold text-accent-foreground"
                >
                  Cadastrar Cliente
                </button>
              </form>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-text-muted" />
              <input
                placeholder="Buscar nome, WhatsApp ou CPF..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  void loadCustomers(e.target.value);
                }}
                className="w-full rounded-xl border border-border bg-bg py-2 pl-8 pr-3 text-xs outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
              {customers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    selectedId === c.id
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-bg hover:bg-surface-muted'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[10px]">
                      {c.type}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-text-muted">
                    {c.phoneE164}
                  </p>
                </button>
              ))}
            </div>
          </Card>

          {/* Timeline 360 do cliente selecionado */}
          <div className="space-y-4 lg:col-span-8">
            {!timeline ? (
              <Card className="p-8 text-center text-sm text-text-secondary">
                Selecione um cliente para visualizar o histórico consolidado.
              </Card>
            ) : (
              <>
                <Card className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="font-mono text-xs text-accent">
                        FICHA CRM 360° · {timeline.customer.type}
                      </span>
                      <h2 className="mt-0.5 font-display text-xl font-bold">
                        {timeline.customer.name}
                      </h2>
                      <p className="font-mono text-xs text-text-secondary">
                        {timeline.customer.phoneE164}{' '}
                        {timeline.customer.email ? `· ${timeline.customer.email}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={startEditCustomer}
                        className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-medium hover:border-accent"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleArchiveCustomer(timeline.customer.id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-border px-2.5 py-2 text-xs text-danger hover:bg-danger/10"
                        title="Arquivar cliente"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <Link
                        href="/app/os/new"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover"
                      >
                        <Wrench className="h-3.5 w-3.5" />
                        Nova OS para cliente
                      </Link>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 text-center">
                    <div className="rounded-xl border border-border bg-bg p-2.5">
                      <span className="block text-[10px] text-text-muted">Equipamentos</span>
                      <span className="font-mono text-base font-bold">
                        {timeline.stats.assetsCount}
                      </span>
                    </div>
                    <div className="rounded-xl border border-border bg-bg p-2.5">
                      <span className="block text-[10px] text-text-muted">VIP Loja</span>
                      <span className="font-mono text-base font-bold text-accent">
                        {timeline.stats.vipAssetsCount}
                      </span>
                    </div>
                    <div className="rounded-xl border border-border bg-bg p-2.5">
                      <span className="block text-[10px] text-text-muted">OS Registradas</span>
                      <span className="font-mono text-base font-bold">
                        {timeline.stats.ordersCount}
                      </span>
                    </div>
                    <div className="rounded-xl border border-border bg-bg p-2.5">
                      <span className="block text-[10px] text-text-muted">Garantias Ativas</span>
                      <span className="font-mono text-base font-bold text-success">
                        {timeline.stats.activeWarrantiesCount}
                      </span>
                    </div>
                  </div>
                </Card>

                <Card className="p-5 space-y-3">
                  <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
                    <Laptop className="h-4 w-4 text-accent" />
                    Equipamentos Permanentes ({timeline.assets.length})
                  </h3>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {timeline.assets.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-xl border border-border bg-bg p-3 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-text-primary">
                            {[a.category, a.brand, a.model]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                          {a.acquiredFromStore && (
                            <span className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent">
                              VIP -{a.vipDiscountPct}%
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[11px] text-text-muted">
                          QR: {a.qrToken}{' '}
                          {a.serialNumber ? `· S/N: ${a.serialNumber}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-5 space-y-3">
                  <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
                    <ShieldCheck className="h-4 w-4 text-accent" />
                    Histórico de Ordens de Serviço ({timeline.serviceOrders.length})
                  </h3>
                  <div className="space-y-2">
                    {timeline.serviceOrders.map((os) => (
                      <Link
                        key={os.id}
                        href={`/app/os/${os.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-bg px-4 py-3 text-xs transition-colors hover:border-accent"
                      >
                        <div>
                          <span className="font-mono font-bold text-accent">
                            {os.code}
                          </span>{' '}
                          · <span className="text-text-secondary">{os.reportedSymptoms}</span>
                        </div>
                        <StatusPill status={os.status} />
                      </Link>
                    ))}
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomersPage() {
  return (
    <ErpShell
      title="CRM 360° & Catálogo de Serviços"
      subtitle="Visão consolidada de clientes, equipamentos permanentes VIP e tabela de serviços"
    >
      {() => <Customers360Content />}
    </ErpShell>
  );
}
