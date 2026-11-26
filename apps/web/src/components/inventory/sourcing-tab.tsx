'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Copy, Plus, Sparkles, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { apiFetch } from '@/lib/api';

interface SourcingOffer {
  id: string;
  channelType: 'supplier_b2b' | 'marketplace_pf';
  vendorName: string;
  unitPriceCents: number;
  shippingCents: number;
  taxOrFeeCents: number;
  landedUnitCostCents: number;
  deliveryDays: number;
  paymentTerms: string | null;
  sourceUrl: string | null;
  notes: string | null;
}

interface SourcingRequest {
  id: string;
  code: string;
  itemName: string;
  category: string;
  desiredQty: number;
  targetResalePriceCents: number | null;
  urgency: string;
  status: string;
  selectedOfferId: string | null;
  aiRecommendation: string | null;
  offers: SourcingOffer[];
  comparison: {
    bestOverall: SourcingOffer | null;
    bestB2b: SourcingOffer | null;
    bestMarketplace: SourcingOffer | null;
    cheaperChannel: 'supplier_b2b' | 'marketplace_pf' | 'tie' | null;
    savingsCents: number;
  };
}

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function SourcingComparisonTab() {
  const [requests, setRequests] = useState<SourcingRequest[]>([]);
  const [itemName, setItemName] = useState('');
  const [desiredQty, setDesiredQty] = useState('2');
  const [targetResaleBrl, setTargetResaleBrl] = useState('');

  // Add offer form state per active request
  const [activeReqId, setActiveReqId] = useState<string | null>(null);
  const [channelType, setChannelType] = useState<'supplier_b2b' | 'marketplace_pf'>('marketplace_pf');
  const [vendorName, setVendorName] = useState('');
  const [unitPriceBrl, setUnitPriceBrl] = useState('');
  const [shippingBrl, setShippingBrl] = useState('0');
  const [taxBrl, setTaxBrl] = useState('0');
  const [deliveryDays, setDeliveryDays] = useState('2');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const rows = await apiFetch<SourcingRequest[]>('/sourcing/requests', { token });
    setRequests(rows);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreateRequest(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch('/sourcing/requests', {
      method: 'POST',
      token,
      body: JSON.stringify({
        itemName,
        desiredQty: Number(desiredQty) || 1,
        targetResalePriceCents: targetResaleBrl
          ? Math.round((Number(targetResaleBrl.replace(',', '.')) || 0) * 100)
          : undefined,
      }),
    });
    setItemName('');
    setTargetResaleBrl('');
    await load();
  }

  async function handleAddOffer(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token || !activeReqId) return;
    await apiFetch(`/sourcing/requests/${activeReqId}/offers`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        channelType,
        vendorName,
        unitPriceCents: Math.round((Number(unitPriceBrl.replace(',', '.')) || 0) * 100),
        shippingCents: Math.round((Number(shippingBrl.replace(',', '.')) || 0) * 100),
        taxOrFeeCents: Math.round((Number(taxBrl.replace(',', '.')) || 0) * 100),
        deliveryDays: Number(deliveryDays) || 1,
        paymentTerms: paymentTerms || undefined,
        sourceUrl: sourceUrl || undefined,
      }),
    });
    setVendorName('');
    setUnitPriceBrl('');
    setSourceUrl('');
    setActiveReqId(null);
    await load();
  }

  async function handleAiAnalyze(reqId: string) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch(`/sourcing/requests/${reqId}/ai-recommend`, {
      method: 'POST',
      token,
    });
    await load();
  }

  async function handleSelectOffer(reqId: string, offerId: string) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch(`/sourcing/requests/${reqId}/select/${offerId}`, {
      method: 'PATCH',
      token,
    });
    await load();
  }

  function copyRfq(req: SourcingRequest) {
    const text = `Olá! Gostaria de cotação para ${req.desiredQty}x ${req.itemName} (faturamento CNPJ ou à vista) com prazo de entrega e custo de frete. Código interno: ${req.code}.`;
    void navigator.clipboard.writeText(text);
    setCopiedId(req.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 font-display text-base font-semibold">
              <TrendingDown className="h-4 w-4 text-accent" />
              Comparador de Compras: Distribuidor B2B vs. Marketplace PF
            </h3>
            <p className="text-xs text-text-secondary">
              Compare custo real posto na loja (peça + frete + impostos) entre fornecedores atacadistas e marketplaces PF antes de fechar compra.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateRequest} className="mt-4 grid gap-3 sm:grid-cols-5">
          <input
            required
            placeholder="Produto ou peça (ex: SSD NVMe 1TB / Kit Ryzen)"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="sm:col-span-2 rounded-xl border border-border bg-bg px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={1}
            placeholder="Qtd"
            value={desiredQty}
            onChange={(e) => setDesiredQty(e.target.value)}
            className="rounded-xl border border-border bg-bg px-3 py-2 font-mono text-sm"
          />
          <input
            placeholder="Preço revenda alvo (R$)"
            value={targetResaleBrl}
            onChange={(e) => setTargetResaleBrl(e.target.value)}
            className="rounded-xl border border-border bg-bg px-3 py-2 font-mono text-sm"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova Cotação
          </button>
        </form>
      </Card>

      <div className="space-y-4">
        {requests.map((req) => (
          <Card key={req.id} className="p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-accent">
                    {req.code}
                  </span>
                  <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 font-mono text-[10px]">
                    {req.desiredQty}x unidades · {req.status}
                  </span>
                  {req.comparison.cheaperChannel === 'marketplace_pf' && (
                    <span className="rounded-full border border-success/40 bg-success/12 px-2.5 py-0.5 text-[11px] font-semibold text-success">
                      Marketplace PF {formatBrl(req.comparison.savingsCents)}/un mais barato
                    </span>
                  )}
                  {req.comparison.cheaperChannel === 'supplier_b2b' && (
                    <span className="rounded-full border border-accent/40 bg-accent/12 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                      Distribuidor B2B {formatBrl(req.comparison.savingsCents)}/un mais barato
                    </span>
                  )}
                </div>
                <h4 className="mt-1 font-display text-base font-semibold">
                  {req.itemName}
                </h4>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyRfq(req)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs font-medium hover:border-accent"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copiedId === req.id ? 'RFQ copiado!' : 'Copiar RFQ Fornecedor'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveReqId(activeReqId === req.id ? null : req.id)
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs font-medium hover:border-accent"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Lançar Preço
                </button>
                <button
                  type="button"
                  onClick={() => void handleAiAnalyze(req.id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/25"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Analisar com IA
                </button>
              </div>
            </div>

            {req.aiRecommendation && (
              <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-xs leading-relaxed text-text-primary">
                <strong className="font-mono text-[11px] uppercase text-accent">
                  Parecer do Analista de Compras:
                </strong>{' '}
                {req.aiRecommendation}
              </div>
            )}

            {activeReqId === req.id && (
              <form
                onSubmit={handleAddOffer}
                className="grid gap-3 rounded-xl border border-border bg-surface-muted/40 p-4 sm:grid-cols-4"
              >
                <select
                  value={channelType}
                  onChange={(e) =>
                    setChannelType(
                      e.target.value as 'supplier_b2b' | 'marketplace_pf',
                    )
                  }
                  className="rounded-xl border border-border bg-bg px-3 py-2 text-xs"
                >
                  <option value="supplier_b2b">Fornecedor / Distribuidor B2B</option>
                  <option value="marketplace_pf">Marketplace (Compra PF)</option>
                </select>
                <input
                  required
                  placeholder="Nome (ex: Mercado Livre / All Nations)"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="rounded-xl border border-border bg-bg px-3 py-2 text-xs"
                />
                <input
                  required
                  placeholder="Valor unitário (R$)"
                  value={unitPriceBrl}
                  onChange={(e) => setUnitPriceBrl(e.target.value)}
                  className="rounded-xl border border-border bg-bg px-3 py-2 font-mono text-xs"
                />
                <input
                  placeholder="Frete total (R$)"
                  value={shippingBrl}
                  onChange={(e) => setShippingBrl(e.target.value)}
                  className="rounded-xl border border-border bg-bg px-3 py-2 font-mono text-xs"
                />
                <input
                  placeholder="Imposto/ST extra (R$)"
                  value={taxBrl}
                  onChange={(e) => setTaxBrl(e.target.value)}
                  className="rounded-xl border border-border bg-bg px-3 py-2 font-mono text-xs"
                />
                <input
                  type="number"
                  placeholder="Prazo (dias)"
                  value={deliveryDays}
                  onChange={(e) => setDeliveryDays(e.target.value)}
                  className="rounded-xl border border-border bg-bg px-3 py-2 font-mono text-xs"
                />
                <input
                  placeholder="Link ou condição de pagamento"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="rounded-xl border border-border bg-bg px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground"
                >
                  Adicionar Oferta
                </button>
              </form>
            )}

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface-muted/60 text-text-secondary">
                  <tr>
                    <th className="px-3.5 py-2.5 font-medium">Canal</th>
                    <th className="px-3.5 py-2.5 font-medium">Fornecedor / Origem</th>
                    <th className="px-3.5 py-2.5 font-medium">Preço Un.</th>
                    <th className="px-3.5 py-2.5 font-medium">Frete + Imposto</th>
                    <th className="px-3.5 py-2.5 font-medium">Custo Posto Un.</th>
                    <th className="px-3.5 py-2.5 font-medium">Prazo</th>
                    <th className="px-3.5 py-2.5 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {req.offers.map((offer, idx) => {
                    const isBest = idx === 0;
                    const isSelected = req.selectedOfferId === offer.id;
                    return (
                      <tr
                        key={offer.id}
                        className={isBest ? 'bg-accent/[0.04]' : undefined}
                      >
                        <td className="px-3.5 py-2.5">
                          <span
                            className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold ${
                              offer.channelType === 'marketplace_pf'
                                ? 'bg-warning/15 text-warning'
                                : 'bg-info/15 text-info'
                            }`}
                          >
                            {offer.channelType === 'marketplace_pf'
                              ? 'MKT PF'
                              : 'B2B'}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 font-medium">
                          {offer.vendorName}
                          {isBest && (
                            <span className="ml-2 rounded bg-success/15 px-1.5 py-0.5 font-mono text-[10px] text-success">
                              MENOR CUSTO
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono">
                          {formatBrl(offer.unitPriceCents)}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-text-secondary">
                          {formatBrl(offer.shippingCents + offer.taxOrFeeCents)}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono font-bold text-text-primary">
                          {formatBrl(offer.landedUnitCostCents)}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono">
                          {offer.deliveryDays}d
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          {isSelected ? (
                            <span className="font-mono text-[11px] font-bold text-success">
                              SELECIONADO
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                void handleSelectOffer(req.id, offer.id)
                              }
                              className="rounded-lg border border-border px-2.5 py-1 text-[11px] hover:border-accent"
                            >
                              Escolher
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
