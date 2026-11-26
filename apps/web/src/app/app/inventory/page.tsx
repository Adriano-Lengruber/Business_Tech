'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Building2,
  DollarSign,
  Edit3,
  Package,
  PackagePlus,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
  Wallet,
} from 'lucide-react';
import { ErpShell, type ErpSession } from '@/components/erp-shell';
import { Card, StatKpiCard } from '@/components/ui/primitives';
import {
  ProductEditorModal,
  type RichProductRow,
} from '@/components/inventory/product-drawer';
import {
  SuppliersTab,
  type RichSupplierRow,
} from '@/components/inventory/suppliers-tab';
import { SourcingComparisonTab } from '@/components/inventory/sourcing-tab';
import { apiFetch } from '@/lib/api';

interface PurchaseOrderRow {
  id: string;
  code: string;
  status: string;
  totalCostCents: number;
  supplierName: string;
  linkedServiceOrderId?: string | null;
  notes?: string | null;
}

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function InventoryContent({ session }: { session: ErpSession }) {
  const [tab, setTab] = useState<'catalog' | 'suppliers' | 'purchases' | 'sourcing'>('catalog');
  const [products, setProducts] = useState<RichProductRow[]>([]);
  const [suppliers, setSuppliers] = useState<RichSupplierRow[]>([]);
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([]);
  const [openOrders, setOpenOrders] = useState<
    Array<{ id: string; code: string; customerName: string }>
  >([]);
  const [query, setQuery] = useState('');

  // Modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<RichProductRow | null>(null);

  // PO form
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poProductId, setPoProductId] = useState('');
  const [poQty, setPoQty] = useState('5');
  const [poLinkedOsId, setPoLinkedOsId] = useState('');
  const [poNotes, setPoNotes] = useState('');

  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabled = session.enabledModules.includes('mod-inventory-pos');

  const load = useCallback(async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token || !enabled) return;
    const [prods, sups, pos, osList] = await Promise.all([
      apiFetch<RichProductRow[]>(
        `/inventory/products?q=${encodeURIComponent(query)}`,
        { token },
      ),
      apiFetch<RichSupplierRow[]>('/inventory/suppliers', { token }),
      apiFetch<PurchaseOrderRow[]>('/inventory/purchase-orders', { token }),
      apiFetch<Array<{ id: string; code: string; customerName: string }>>(
        '/service-orders',
        { token },
      ).catch(() => []),
    ]);
    setProducts(prods);
    setSuppliers(sups);
    setOrders(pos);
    setOpenOrders(osList);
    if (!poSupplierId && sups[0]) setPoSupplierId(sups[0].id);
    if (!poProductId && prods[0]) setPoProductId(prods[0].id);
  }, [enabled, query, poSupplierId, poProductId]);

  useEffect(() => {
    void load().catch((e) => setError(String(e)));
  }, [load]);

  const metrics = useMemo(() => {
    const lowCount = products.filter((p) => p.alertLevel !== 'OK').length;
    const costValueCents = products.reduce(
      (s, p) => s + p.costCents * p.stockQty,
      0,
    );
    const retailValueCents = products.reduce(
      (s, p) => s + p.priceCents * p.stockQty,
      0,
    );
    return { lowCount, costValueCents, retailValueCents };
  }, [products]);

  async function handleArchiveProduct(p: RichProductRow) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch(`/inventory/products/${p.id}`, {
      method: 'DELETE',
      token,
    });
    setFeedback(`Produto "${p.name}" arquivado do catálogo ativo.`);
    await load();
  }

  async function handleCreatePo(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    const selectedProd = products.find((p) => p.id === poProductId);
    if (!token || !poSupplierId || !selectedProd) return;
    await apiFetch('/inventory/purchase-orders', {
      method: 'POST',
      token,
      body: JSON.stringify({
        supplierId: poSupplierId,
        linkedServiceOrderId: poLinkedOsId || undefined,
        notes: poNotes || undefined,
        items: [
          {
            productId: selectedProd.id,
            quantity: Number(poQty) || 1,
            unitCostCents: selectedProd.costCents,
          },
        ],
      }),
    });
    setPoNotes('');
    setFeedback('Pedido de compra gerado!');
    await load();
  }

  async function handleReceivePo(id: string) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch(`/inventory/purchase-orders/${id}/receive`, {
      method: 'POST',
      token,
    });
    setFeedback('Pedido recebido! Estoque e conta a pagar atualizados.');
    await load();
  }

  if (!enabled) {
    return (
      <Card className="p-6 text-sm text-text-secondary">
        O módulo <strong>Estoque, Compras & PDV</strong> está desativado.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatKpiCard
          label="SKUs Ativos"
          value={String(products.length)}
          hint={`${suppliers.length} fornecedor(es) cadastrado(s)`}
          tone="neutral"
          icon={<Package className="h-4 w-4" />}
        />
        <StatKpiCard
          label="Reposição Crítica"
          value={String(metrics.lowCount)}
          hint="Itens abaixo do estoque mínimo"
          tone={metrics.lowCount > 0 ? 'warning' : 'success'}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatKpiCard
          label="Patrimônio em Custo"
          value={formatBrl(metrics.costValueCents)}
          hint="Capital imobilizado no estoque"
          tone="accent"
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatKpiCard
          label="Potencial de Venda"
          value={formatBrl(metrics.retailValueCents)}
          hint="Valor total na tabela Balcão"
          tone="success"
          icon={<DollarSign className="h-4 w-4" />}
        />
      </div>

      {/* Navegação por Abas */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('catalog')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
              tab === 'catalog'
                ? 'bg-accent text-accent-foreground'
                : 'border border-border bg-surface text-text-secondary hover:text-text-primary'
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            Catálogo & Estoque ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('suppliers')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
              tab === 'suppliers'
                ? 'bg-accent text-accent-foreground'
                : 'border border-border bg-surface text-text-secondary hover:text-text-primary'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            Fornecedores B2B ({suppliers.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('purchases')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
              tab === 'purchases'
                ? 'bg-accent text-accent-foreground'
                : 'border border-border bg-surface text-text-secondary hover:text-text-primary'
            }`}
          >
            <Truck className="h-3.5 w-3.5" />
            Pedidos de Compra ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('sourcing')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
              tab === 'sourcing'
                ? 'bg-accent text-accent-foreground'
                : 'border border-border bg-surface text-text-secondary hover:text-text-primary'
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            Cotação B2B vs. Marketplace PF
          </button>
        </div>

        {tab === 'catalog' && (
          <button
            type="button"
            onClick={() => {
              setEditingProduct(null);
              setEditorOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover"
          >
            <PackagePlus className="h-4 w-4" />
            Cadastrar Produto Completo
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}
      {feedback && (
        <div className="rounded-xl border border-success/40 bg-success/10 p-3 text-xs font-medium text-success">
          {feedback}
        </div>
      )}

      {tab === 'sourcing' ? (
        <SourcingComparisonTab />
      ) : tab === 'suppliers' ? (
        <SuppliersTab
          suppliers={suppliers}
          onChanged={async (msg) => {
            setFeedback(msg);
            await load();
          }}
        />
      ) : tab === 'purchases' ? (
        <Card className="p-5 space-y-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-semibold">
              <Truck className="h-4 w-4 text-accent" />
              Ordens de Compra & Reposição de Bancada
            </h2>
            <p className="text-xs text-text-secondary">
              Vincule um pedido de compra diretamente a uma OS aberta para movê-la para Aguardando Peça e liberar automaticamente no recebimento.
            </p>
          </div>

          <form onSubmit={handleCreatePo} className="grid gap-3 sm:grid-cols-6">
            <select
              value={poSupplierId}
              onChange={(e) => setPoSupplierId(e.target.value)}
              className="rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={poProductId}
              onChange={(e) => setPoProductId(e.target.value)}
              className="sm:col-span-2 rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </select>
            <select
              value={poLinkedOsId}
              onChange={(e) => setPoLinkedOsId(e.target.value)}
              className="rounded-xl border border-border bg-bg px-3 py-2 text-xs"
            >
              <option value="">Sem OS vinculada (estoque)</option>
              {openOrders.map((os) => (
                <option key={os.id} value={os.id}>
                  OS {os.code} ({os.customerName})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={poQty}
              onChange={(e) => setPoQty(e.target.value)}
              placeholder="Qtd"
              className="rounded-xl border border-border bg-bg px-3 py-2 font-mono text-sm"
            />
            <button
              type="submit"
              className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover"
            >
              Gerar Pedido
            </button>
          </form>

          <div className="space-y-2">
            {orders.map((po) => (
              <div
                key={po.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-bg px-4 py-3 text-sm"
              >
                <div>
                  <span className="font-mono font-semibold text-accent">
                    {po.code}
                  </span>{' '}
                  · <span>{po.supplierName}</span> ·{' '}
                  <span className="font-mono font-semibold">
                    {formatBrl(po.totalCostCents)}
                  </span>
                </div>
                {po.status === 'ORDERED' ? (
                  <button
                    type="button"
                    onClick={() => void handleReceivePo(po.id)}
                    className="rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Confirmar Recebimento (+Estoque & Conta a Pagar)
                  </button>
                ) : (
                  <span className="rounded-full bg-success/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-success">
                    RECEBIDO
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {editorOpen && (
            <ProductEditorModal
              product={editingProduct}
              suppliers={suppliers}
              onClose={() => {
                setEditorOpen(false);
                setEditingProduct(null);
              }}
              onSaved={async (msg) => {
                setFeedback(msg);
                await load();
              }}
            />
          )}

          {/* Busca + Tabela */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, SKU, marca, categoria ou EAN..."
                className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-sm"
              />
            </div>
          </div>

          <Card className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-muted/60 text-xs text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Fornecedor(es)</th>
                  <th className="px-4 py-3">Custo</th>
                  <th className="px-4 py-3">Tabelas de Venda</th>
                  <th className="px-4 py-3">Saldo</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => {
                  const marginPct =
                    p.priceCents > 0 && p.costCents > 0
                      ? Math.round(((p.priceCents - p.costCents) / p.priceCents) * 100)
                      : null;

                  return (
                    <tr key={p.id} className="hover:bg-surface-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-bg">
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package className="h-5 w-5 text-text-muted" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-accent">
                                {p.sku}
                              </span>
                              <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] uppercase text-text-secondary">
                                {p.category}
                              </span>
                            </div>
                            <p className="font-medium text-text-primary">{p.name}</p>
                            {p.description && (
                              <p className="line-clamp-1 max-w-md text-xs text-text-muted">
                                {p.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs">
                        {p.preferredSupplierName ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 font-medium text-accent">
                            <Building2 className="h-3 w-3" />
                            {p.preferredSupplierName}
                          </span>
                        ) : (
                          <span className="text-text-muted">Sem vínculo</span>
                        )}
                        {p.suppliers.length > 1 && (
                          <span className="mt-1 block text-[11px] text-text-muted">
                            +{p.suppliers.length - 1} outro(s)
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 font-mono text-xs tabular-nums">
                        <div>{formatBrl(p.costCents)}</div>
                        {marginPct !== null && (
                          <span className="text-[10px] text-success">
                            margem {marginPct}%
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 font-mono text-xs tabular-nums space-y-0.5">
                        <div className="text-sm font-bold text-text-primary">
                          {formatBrl(p.priceCents)}{' '}
                          <span className="text-[10px] font-normal text-text-muted">
                            varejo
                          </span>
                        </div>
                        {p.wholesalePriceCents ? (
                          <div className="text-text-secondary">
                            Atacado: {formatBrl(p.wholesalePriceCents)}
                          </div>
                        ) : null}
                        {p.vipPriceCents ? (
                          <div className="text-accent">
                            VIP Loja: {formatBrl(p.vipPriceCents)}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-bold tabular-nums">
                            {p.stockQty}
                          </span>
                          {p.alertLevel === 'OK' ? (
                            <span className="rounded-full bg-success/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-success">
                              OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-warning">
                              <AlertTriangle className="h-3 w-3" />
                              {p.alertLevel === 'OUT_OF_STOCK' ? 'ZERADO' : 'BAIXO'}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-text-muted">
                          Mín: {p.minStockQty} {p.unit}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(p);
                              setEditorOpen(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:border-accent hover:text-accent"
                          >
                            <Edit3 className="h-3 w-3" />
                            Editar / Foto
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleArchiveProduct(p)}
                            className="rounded-lg border border-border p-1.5 text-danger hover:bg-danger/10"
                            title="Inativar produto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <ErpShell
      title="Estoque, Catálogo, Fornecedores & Compras"
      subtitle="Produtos completos com fotos S3, tabelas Varejo/Atacado/VIP, diretório de fornecedores B2B e comparador Marketplace PF"
    >
      {(session) => <InventoryContent session={session} />}
    </ErpShell>
  );
}
