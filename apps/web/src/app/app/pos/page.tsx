'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FileCheck2, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { calculatePosSaleTotals, type PaymentMethod } from '@al/shared';
import { ErpShell, type ErpSession } from '@/components/erp-shell';
import { apiFetch } from '@/lib/api';

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  costCents: number;
  priceCents: number;
  stockQty: number;
}

interface SaleRow {
  id: string;
  code: string;
  paymentMethod: string;
  totalCents: number;
  createdAt: string;
}

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function PosContent({ session }: { session: ErpSession }) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Array<{ product: ProductRow; quantity: number }>>([]);
  const [discountBrl, setDiscountBrl] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [lastSaleMessage, setLastSaleMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabled = session.enabledModules.includes('mod-inventory-pos');

  const load = useCallback(async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token || !enabled) return;
    const [prods, saleRows] = await Promise.all([
      apiFetch<ProductRow[]>(
        `/inventory/products?q=${encodeURIComponent(search)}`,
        { token },
      ),
      apiFetch<SaleRow[]>('/pos/sales', { token }),
    ]);
    setProducts(prods);
    setSales(saleRows);
  }, [enabled, search]);

  useEffect(() => {
    void load().catch((e) => setError(String(e)));
  }, [load]);

  function addToCart(product: ProductRow) {
    if (product.stockQty <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQty) return prev;
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  const discountCents = Math.round(
    (Number(discountBrl.replace(',', '.')) || 0) * 100,
  );
  const totals = calculatePosSaleTotals(
    cart.map((c) => ({
      quantity: c.quantity,
      unitCostCents: c.product.costCents,
      unitPriceCents: c.product.priceCents,
    })),
    discountCents,
  );

  async function handleCheckout() {
    const token = window.localStorage.getItem('al_token');
    if (!token || cart.length === 0) return;
    setError(null);
    try {
      const res = await apiFetch<{ sale: SaleRow }>('/pos/sales', {
        method: 'POST',
        token,
        body: JSON.stringify({
          paymentMethod,
          discountCents,
          paidImmediately: true,
          items: cart.map((c) => ({
            productId: c.product.id,
            quantity: c.quantity,
          })),
        }),
      });
      setCart([]);
      setDiscountBrl('0');
      setLastSaleMessage(`Venda ${res.sale.code} concluída e estoque baixado!`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao finalizar venda');
    }
  }

  async function handleEmitNfce(saleId: string) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    try {
      const doc = await apiFetch<{ docType: string; number: number; status: string }>(
        '/fiscal/documents',
        {
          method: 'POST',
          token,
          body: JSON.stringify({
            docType: 'NFCE',
            referenceType: 'sale',
            referenceId: saleId,
          }),
        },
      );
      setLastSaleMessage(
        `${doc.docType} #${doc.number} emitida (${doc.status})! Veja em Notas Fiscais.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao emitir NFC-e');
    }
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
      {lastSaleMessage && (
        <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          {lastSaleMessage}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Catálogo */}
        <div className="space-y-3 lg:col-span-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Bipar código de barras, SKU ou buscar produto..."
            className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={p.stockQty <= 0}
                onClick={() => addToCart(p)}
                className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-accent disabled:opacity-45"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span className="font-mono">{p.sku}</span>
                    <span className="font-mono">Disp.: {p.stockQty}</span>
                  </div>
                  <p className="mt-1 font-medium">{p.name}</p>
                </div>
                <p className="mt-3 font-mono text-base font-bold text-accent">
                  {formatBrl(p.priceCents)}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Carrinho PDV */}
        <div className="h-fit rounded-xl border border-border bg-surface p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingCart className="h-4 w-4 text-accent" />
            Carrinho Balcão ({cart.length})
          </div>

          {cart.length === 0 ? (
            <p className="text-xs text-text-muted">
              Clique em um produto ao lado para iniciar a venda.
            </p>
          ) : (
            <div className="space-y-2.5">
              {cart.map((c) => (
                <div
                  key={c.product.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.product.name}</p>
                    <p className="font-mono text-xs text-text-muted">
                      {formatBrl(c.product.priceCents)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setCart((prev) =>
                          prev
                            .map((i) =>
                              i.product.id === c.product.id
                                ? { ...i, quantity: i.quantity - 1 }
                                : i,
                            )
                            .filter((i) => i.quantity > 0),
                        )
                      }
                      className="rounded border border-border p-1"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center font-mono text-xs">
                      {c.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => addToCart(c.product)}
                      className="rounded border border-border p-1"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCart((prev) =>
                          prev.filter((i) => i.product.id !== c.product.id),
                        )
                      }
                      className="p-1 text-text-muted hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 border-t border-border pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Desconto (R$)</span>
              <input
                value={discountBrl}
                onChange={(e) => setDiscountBrl(e.target.value)}
                className="w-24 rounded border border-border bg-bg px-2 py-1 text-right font-mono text-xs"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Pagamento</span>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="rounded border border-border bg-bg px-2 py-1 text-xs"
              >
                <option value="pix">PIX</option>
                <option value="card">Cartão</option>
                <option value="cash">Dinheiro</option>
              </select>
            </div>
            <div className="flex items-center justify-between pt-1 text-base font-bold">
              <span>Total</span>
              <span className="font-mono text-accent">
                {formatBrl(totals.totalCents)}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={cart.length === 0}
            onClick={() => void handleCheckout()}
            className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
          >
            Finalizar Venda
          </button>
        </div>
      </div>

      {/* Últimas Vendas */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
        <h2 className="text-sm font-semibold">Vendas Recentes</h2>
        <div className="space-y-2">
          {sales.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-bg px-4 py-2.5 text-sm"
            >
              <div>
                <span className="font-mono font-semibold text-accent">{s.code}</span>{' '}
                · <span className="uppercase font-mono text-xs">{s.paymentMethod}</span> ·{' '}
                <span className="font-mono font-semibold">{formatBrl(s.totalCents)}</span>
              </div>
              {session.enabledModules.includes('mod-finance-fiscal') && (
                <button
                  type="button"
                  onClick={() => void handleEmitNfce(s.id)}
                  className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-xs hover:bg-surface-muted"
                >
                  <FileCheck2 className="h-3.5 w-3.5 text-accent" />
                  Emitir NFC-e
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PosPage() {
  return (
    <ErpShell
      title="PDV — Frente de Caixa Rápida"
      subtitle="Venda de hardware, acessórios e peças integrada ao estoque e caixa"
    >
      {(session) => <PosContent session={session} />}
    </ErpShell>
  );
}
