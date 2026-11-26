'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, PackagePlus, Search, Truck } from 'lucide-react';
import { ErpShell, type ErpSession } from '@/components/erp-shell';
import { apiFetch } from '@/lib/api';

interface ProductRow {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  brand: string | null;
  costCents: number;
  priceCents: number;
  stockQty: number;
  minStockQty: number;
  ncm: string | null;
  alertLevel: 'OK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

interface SupplierRow {
  id: string;
  name: string;
  leadTimeDays: number;
}

interface PurchaseOrderRow {
  id: string;
  code: string;
  status: string;
  totalCostCents: number;
  supplierName: string;
}

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function InventoryContent({ session }: { session: ErpSession }) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([]);
  const [query, setQuery] = useState('');

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('hardware');
  const [costBrl, setCostBrl] = useState('');
  const [priceBrl, setPriceBrl] = useState('');
  const [stockQty, setStockQty] = useState('5');
  const [ncm, setNcm] = useState('84717040');

  const [poSupplierId, setPoSupplierId] = useState('');
  const [poProductId, setPoProductId] = useState('');
  const [poQty, setPoQty] = useState('5');
  const [error, setError] = useState<string | null>(null);

  const enabled = session.enabledModules.includes('mod-inventory-pos');

  const load = useCallback(async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token || !enabled) return;
    const [prods, sups, pos] = await Promise.all([
      apiFetch<ProductRow[]>(
        `/inventory/products?q=${encodeURIComponent(query)}`,
        { token },
      ),
      apiFetch<SupplierRow[]>('/inventory/suppliers', { token }),
      apiFetch<PurchaseOrderRow[]>('/inventory/purchase-orders', { token }),
    ]);
    setProducts(prods);
    setSuppliers(sups);
    setOrders(pos);
    if (!poSupplierId && sups[0]) setPoSupplierId(sups[0].id);
    if (!poProductId && prods[0]) setPoProductId(prods[0].id);
  }, [enabled, query, poSupplierId, poProductId]);

  useEffect(() => {
    void load().catch((e) => setError(String(e)));
  }, [load]);

  async function handleCreateProduct(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    setError(null);
    try {
      await apiFetch('/inventory/products', {
        method: 'POST',
        token,
        body: JSON.stringify({
          sku,
          name,
          category,
          costCents: Math.round((Number(costBrl.replace(',', '.')) || 0) * 100),
          priceCents: Math.round((Number(priceBrl.replace(',', '.')) || 0) * 100),
          stockQty: Number(stockQty) || 0,
          ncm: ncm || undefined,
        }),
      });
      setSku('');
      setName('');
      setCostBrl('');
      setPriceBrl('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar produto');
    }
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
        items: [
          {
            productId: selectedProd.id,
            quantity: Number(poQty) || 1,
            unitCostCents: selectedProd.costCents,
          },
        ],
      }),
    });
    await load();
  }

  async function handleReceivePo(id: string) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch(`/inventory/purchase-orders/${id}/receive`, {
      method: 'POST',
      token,
    });
    await load();
  }

  if (!enabled) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-sm text-text-secondary">
        O módulo <strong>Estoque, Compras & PDV</strong> está desativado.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Cadastro Rápido */}
      <form
        onSubmit={handleCreateProduct}
        className="rounded-lg border border-border bg-surface p-4 space-y-3"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <PackagePlus className="h-4 w-4 text-accent" />
          Cadastrar Novo Produto / Peça
        </div>
        <div className="grid gap-2 sm:grid-cols-7">
          <input
            required
            placeholder="SKU *"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="rounded-md border border-border bg-bg px-3 py-2 text-sm font-mono"
          />
          <input
            required
            placeholder="Nome do produto *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-border bg-bg px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            placeholder="Categoria"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-border bg-bg px-3 py-2 text-sm"
          />
          <input
            placeholder="Custo R$"
            value={costBrl}
            onChange={(e) => setCostBrl(e.target.value)}
            className="rounded-md border border-border bg-bg px-3 py-2 text-sm font-mono"
          />
          <input
            required
            placeholder="Venda R$ *"
            value={priceBrl}
            onChange={(e) => setPriceBrl(e.target.value)}
            className="rounded-md border border-border bg-bg px-3 py-2 text-sm font-mono"
          />
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              placeholder="Qtd"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
              className="w-16 rounded-md border border-border bg-bg px-2 py-2 text-sm font-mono"
            />
            <button
              type="submit"
              className="flex-1 rounded-md bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover"
            >
              Salvar
            </button>
          </div>
        </div>
      </form>

      {/* Busca + Tabela */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por nome, SKU ou código de barras..."
            className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm"
          />
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-muted/60 text-xs text-text-secondary">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Custo</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Saldo</th>
                <th className="px-4 py-3">Alerta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-accent">
                    {p.sku}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-text-muted">
                      {p.category} {p.ncm ? `· NCM ${p.ncm}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums">
                    {formatBrl(p.costCents)}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold tabular-nums">
                    {formatBrl(p.priceCents)}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold tabular-nums">
                    {p.stockQty}
                  </td>
                  <td className="px-4 py-3">
                    {p.alertLevel === 'OK' ? (
                      <span className="rounded bg-success/15 px-2 py-0.5 font-mono text-[11px] text-success">
                        OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-warning/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-warning">
                        <AlertTriangle className="h-3 w-3" />
                        {p.alertLevel === 'OUT_OF_STOCK' ? 'ZERADO' : 'BAIXO'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compras e Recebimento */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Truck className="h-4 w-4 text-accent" />
          Pedidos de Compra ({suppliers.length} fornecedor(es))
        </div>

        <form onSubmit={handleCreatePo} className="grid gap-2 sm:grid-cols-4">
          <select
            value={poSupplierId}
            onChange={(e) => setPoSupplierId(e.target.value)}
            className="rounded-md border border-border bg-bg px-3 py-2 text-sm"
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
            className="rounded-md border border-border bg-bg px-3 py-2 text-sm"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} — {p.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={poQty}
            onChange={(e) => setPoQty(e.target.value)}
            className="rounded-md border border-border bg-bg px-3 py-2 text-sm font-mono"
          />
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
          >
            Gerar Pedido Compra
          </button>
        </form>

        <div className="space-y-2">
          {orders.map((po) => (
            <div
              key={po.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-bg px-4 py-2.5 text-sm"
            >
              <div>
                <span className="font-mono font-semibold text-accent">{po.code}</span> ·{' '}
                <span>{po.supplierName}</span> ·{' '}
                <span className="font-mono">{formatBrl(po.totalCostCents)}</span>
              </div>
              {po.status === 'ORDERED' ? (
                <button
                  type="button"
                  onClick={() => void handleReceivePo(po.id)}
                  className="rounded bg-success px-3 py-1 text-xs font-semibold text-white"
                >
                  Confirmar Recebimento (+Estoque)
                </button>
              ) : (
                <span className="font-mono text-xs text-success">RECEBIDO</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  return (
    <ErpShell
      title="Estoque, Peças & Compras"
      subtitle="Controle de saldo, alertas de reposição e entrada automática por pedido de compra"
    >
      {(session) => <InventoryContent session={session} />}
    </ErpShell>
  );
}
