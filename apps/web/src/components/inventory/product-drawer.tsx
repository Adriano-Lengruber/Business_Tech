'use client';

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowDownUp,
  History,
  ImagePlus,
  Link2,
  Package,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { apiFetch, getApiBaseUrl } from '@/lib/api';

export interface ProductSupplierLink {
  id: string;
  productId: string;
  supplierId: string;
  supplierName: string;
  supplierSku: string | null;
  lastCostCents: number;
  supplierUrl: string | null;
  notes: string | null;
  isPreferred: boolean;
}

export interface RichProductRow {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string;
  brand: string | null;
  unit: string;
  costCents: number;
  priceCents: number;
  wholesalePriceCents: number | null;
  vipPriceCents: number | null;
  warrantyDays: number;
  preferredSupplierId: string | null;
  preferredSupplierName: string | null;
  suppliers: ProductSupplierLink[];
  stockQty: number;
  minStockQty: number;
  ncm: string | null;
  cfopDefault: string;
  csosnDefault: string;
  alertLevel: 'OK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface SupplierOption {
  id: string;
  name: string;
  leadTimeDays: number;
  acceptsMei?: boolean;
}

interface MovementRow {
  id: string;
  type: string;
  quantityDelta: number;
  unitCostCents: number;
  note: string | null;
  createdAt: string;
}

function centsToInput(cents: number | null | undefined) {
  if (!cents) return '';
  return (cents / 100).toFixed(2);
}

function inputToCents(val: string) {
  return Math.round((Number(val.replace(',', '.')) || 0) * 100);
}

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function ProductEditorModal({
  product,
  suppliers,
  onClose,
  onSaved,
}: {
  product: RichProductRow | null;
  suppliers: SupplierOption[];
  onClose: () => void;
  onSaved: (msg: string) => Promise<void>;
}) {
  const isEditing = Boolean(product);

  const [sku, setSku] = useState(product?.sku ?? '');
  const [barcode, setBarcode] = useState(product?.barcode ?? '');
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [category, setCategory] = useState(product?.category ?? 'hardware');
  const [brand, setBrand] = useState(product?.brand ?? '');
  const [unit, setUnit] = useState(product?.unit ?? 'UN');
  const [costBrl, setCostBrl] = useState(centsToInput(product?.costCents) || '0.00');
  const [priceBrl, setPriceBrl] = useState(centsToInput(product?.priceCents));
  const [wholesaleBrl, setWholesaleBrl] = useState(
    centsToInput(product?.wholesalePriceCents),
  );
  const [vipBrl, setVipBrl] = useState(centsToInput(product?.vipPriceCents));
  const [warrantyDays, setWarrantyDays] = useState(
    String(product?.warrantyDays ?? 90),
  );
  const [stockQty, setStockQty] = useState(String(product?.stockQty ?? 0));
  const [minStockQty, setMinStockQty] = useState(
    String(product?.minStockQty ?? 2),
  );
  const [preferredSupplierId, setPreferredSupplierId] = useState(
    product?.preferredSupplierId ?? '',
  );
  const [supplierSku, setSupplierSku] = useState('');
  const [ncm, setNcm] = useState(product?.ncm ?? '84717040');
  const [cfopDefault, setCfopDefault] = useState(product?.cfopDefault ?? '5102');
  const [csosnDefault, setCsosnDefault] = useState(product?.csosnDefault ?? '102');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    product?.imageUrl ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Additional state only when editing
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [movDelta, setMovDelta] = useState('1');
  const [movType, setMovType] = useState<'in' | 'out' | 'adjustment'>('in');
  const [movNote, setMovNote] = useState('');

  const [linkSupId, setLinkSupId] = useState(suppliers[0]?.id ?? '');
  const [linkSupSku, setLinkSupSku] = useState('');
  const [linkSupCostBrl, setLinkSupCostBrl] = useState('');
  const [linkSupUrl, setLinkSupUrl] = useState('');
  const [links, setLinks] = useState<ProductSupplierLink[]>(
    product?.suppliers ?? [],
  );

  const loadMovements = useCallback(async () => {
    if (!product) return;
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const rows = await apiFetch<MovementRow[]>(
      `/inventory/products/${product.id}/movements`,
      { token },
    ).catch(() => []);
    setMovements(rows);
  }, [product]);

  useEffect(() => {
    void loadMovements();
  }, [loadMovements]);

  const costCentsCalc = inputToCents(costBrl);
  const priceCentsCalc = inputToCents(priceBrl);
  const marginPct =
    priceCentsCalc > 0 && costCentsCalc > 0
      ? Math.round(((priceCentsCalc - costCentsCalc) / priceCentsCalc) * 100)
      : null;

  function handleFilePick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    setSaving(true);
    setError(null);

    try {
      const payload = {
        sku,
        barcode: barcode || undefined,
        name,
        description: description || undefined,
        category,
        brand: brand || undefined,
        unit,
        costCents: costCentsCalc,
        priceCents: priceCentsCalc,
        wholesalePriceCents: wholesaleBrl ? inputToCents(wholesaleBrl) : null,
        vipPriceCents: vipBrl ? inputToCents(vipBrl) : null,
        warrantyDays: Number(warrantyDays) || 90,
        preferredSupplierId: preferredSupplierId || null,
        supplierSku: supplierSku || undefined,
        minStockQty: Number(minStockQty) || 0,
        ncm: ncm || undefined,
        cfopDefault,
        csosnDefault,
        ...(isEditing ? {} : { stockQty: Number(stockQty) || 0 }),
      };

      const saved = await apiFetch<{ id: string }>(
        isEditing ? `/inventory/products/${product!.id}` : '/inventory/products',
        {
          method: isEditing ? 'PATCH' : 'POST',
          token,
          body: JSON.stringify(payload),
        },
      );

      if (imageFile) {
        const fd = new FormData();
        fd.append('file', imageFile);
        const res = await fetch(
          `${getApiBaseUrl()}/inventory/products/${saved.id}/image`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          },
        );
        if (!res.ok) {
          throw new Error('Produto salvo, mas falhou o upload da foto para o S3.');
        }
      }

      await onSaved(
        isEditing
          ? `Produto ${sku.toUpperCase()} atualizado com sucesso!`
          : `Produto ${sku.toUpperCase()} cadastrado com sucesso!`,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar produto');
    } finally {
      setSaving(false);
    }
  }

  async function handleStockAdjustment(e: FormEvent) {
    e.preventDefault();
    if (!product) return;
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const rawQty = Math.abs(Number(movDelta) || 0);
    if (!rawQty) return;
    const delta = movType === 'out' ? -rawQty : rawQty;

    await apiFetch('/inventory/movements', {
      method: 'POST',
      token,
      body: JSON.stringify({
        productId: product.id,
        type: movType,
        quantityDelta: delta,
        unitCostCents: costCentsCalc,
        note: movNote || 'Ajuste manual no catálogo',
      }),
    });
    setMovNote('');
    await loadMovements();
    await onSaved('Movimentação de estoque registrada!');
  }

  async function handleLinkSupplier(e: FormEvent) {
    e.preventDefault();
    if (!product || !linkSupId) return;
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const created = await apiFetch<ProductSupplierLink>(
      `/inventory/products/${product.id}/suppliers`,
      {
        method: 'POST',
        token,
        body: JSON.stringify({
          supplierId: linkSupId,
          supplierSku: linkSupSku || undefined,
          lastCostCents: linkSupCostBrl
            ? inputToCents(linkSupCostBrl)
            : costCentsCalc,
          supplierUrl: linkSupUrl || undefined,
          isPreferred: false,
        }),
      },
    );
    const supName =
      suppliers.find((s) => s.id === linkSupId)?.name ?? 'Fornecedor';
    setLinks((prev) => [
      ...prev.filter((l) => l.supplierId !== linkSupId),
      { ...created, supplierName: supName },
    ]);
    setLinkSupSku('');
    setLinkSupUrl('');
    await onSaved('Fornecedor vinculado ao produto!');
  }

  async function handleUnlinkSupplier(supplierId: string) {
    if (!product) return;
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch(`/inventory/products/${product.id}/suppliers/${supplierId}`, {
      method: 'DELETE',
      token,
    });
    setLinks((prev) => prev.filter((l) => l.supplierId !== supplierId));
    await onSaved('Vínculo de fornecedor removido.');
  }

  return (
    <Card className="border-accent/40 p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-accent">
            {isEditing ? `Edição Completa · ${product!.sku}` : 'Cadastro Completo de Produto & Peça'}
          </span>
          <h3 className="mt-0.5 font-display text-lg font-bold">
            {isEditing ? product!.name : 'Novo Item do Catálogo e Bancada'}
          </h3>
          <p className="text-xs text-text-secondary">
            Preencha descrição técnica, foto no S3, tabelas de preço (Varejo, Atacado B2B e VIP Loja), fiscal BR e fornecedores para reposição rápida.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-border p-2 text-text-muted hover:bg-surface-muted"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Foto + Identificação */}
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="lg:col-span-3 space-y-2">
            <label className="block text-xs font-semibold text-text-primary">
              Foto do Produto (S3 Privado)
            </label>
            <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-bg">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={name || 'Preview'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-center text-xs text-text-muted px-3">
                  <Package className="h-7 w-7 opacity-40" />
                  <span>PNG/JPG exibida no catálogo e PDV</span>
                </div>
              )}
            </div>
            <label className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border bg-bg px-3 py-2 text-xs font-medium hover:border-accent">
              <ImagePlus className="h-3.5 w-3.5 text-accent" />
              {previewUrl ? 'Trocar Imagem' : 'Enviar Foto'}
              <input
                type="file"
                accept="image/*"
                onChange={handleFilePick}
                className="hidden"
              />
            </label>
          </div>

          <div className="lg:col-span-9 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-text-secondary">
                SKU Interno * <span className="text-text-muted">(código único)</span>
              </label>
              <input
                required
                placeholder="Ex: SSD-NVME-1TB"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-3 py-2 font-mono text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-text-secondary">
                Código de Barras (EAN-13)
              </label>
              <input
                placeholder="789..."
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-3 py-2 font-mono text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-text-secondary">
                Categoria & Unidade
              </label>
              <div className="flex gap-2">
                <input
                  required
                  placeholder="hardware, ssd, tela..."
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-sm"
                />
                <input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="UN"
                  className="w-16 rounded-xl border border-border bg-bg px-2.5 py-2 text-center font-mono text-sm"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] font-medium text-text-secondary">
                Nome Comercial do Produto / Peça *
              </label>
              <input
                required
                placeholder="Ex: SSD NVMe Kingston NV3 1TB PCIe 4.0 M.2 2280"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-text-secondary">
                Marca / Fabricante
              </label>
              <input
                placeholder="Kingston, Crucial, Dell..."
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="mb-1 block text-[11px] font-medium text-text-secondary">
                Descrição Técnica, Compatibilidade e Observações de Balcão
              </label>
              <textarea
                rows={2}
                placeholder="Descreva interface, compatibilidade de modelos, leitura/gravação, condições de garantia ou detalhes importantes para o técnico..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Tabelas de Preço & Margem */}
        <div className="rounded-2xl border border-border bg-bg/60 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                Tabelas de Preço & Formação de Margem
              </h4>
              <p className="text-[11px] text-text-secondary">
                Defina o custo real de reposição e os 3 níveis de venda usados no PDV e nas Ordens de Serviço.
              </p>
            </div>
            {marginPct !== null && (
              <span className="rounded-full bg-accent/15 px-3 py-1 font-mono text-xs font-bold text-accent">
                Margem Varejo: {marginPct}% ({formatBrl(priceCentsCalc - costCentsCalc)})
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-[11px] text-text-secondary">
                Custo Médio (R$)
              </label>
              <input
                value={costBrl}
                onChange={(e) => setCostBrl(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-accent">
                Preço Varejo / Balcão (R$) *
              </label>
              <input
                required
                value={priceBrl}
                onChange={(e) => setPriceBrl(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-accent/50 bg-surface px-3 py-2 font-mono text-sm font-semibold"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-text-secondary">
                Tabela Atacado / B2B (R$)
              </label>
              <input
                value={wholesaleBrl}
                onChange={(e) => setWholesaleBrl(e.target.value)}
                placeholder="Opcional"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-text-secondary">
                Tabela Cliente VIP Loja (R$)
              </label>
              <input
                value={vipBrl}
                onChange={(e) => setVipBrl(e.target.value)}
                placeholder="Opcional"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-text-secondary">
                Garantia Balcão (dias)
              </label>
              <input
                type="number"
                min={0}
                value={warrantyDays}
                onChange={(e) => setWarrantyDays(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>
        </div>

        {/* Fornecedor Preferencial, Estoque e Fiscal */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-[11px] font-medium text-text-secondary">
              Fornecedor Preferencial p/ Reposição
            </label>
            <select
              value={preferredSupplierId}
              onChange={(e) => setPreferredSupplierId(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            >
              <option value="">Nenhum / Compra avulsa</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.leadTimeDays}d)
                </option>
              ))}
            </select>
          </div>

          {!isEditing ? (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-text-secondary">
                SKU no Fornecedor
              </label>
              <input
                placeholder="Cód. distribuidor"
                value={supplierSku}
                onChange={(e) => setSupplierSku(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-3 py-2 font-mono text-sm"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-text-secondary">
                Saldo Atual
              </label>
              <div className="rounded-xl border border-border bg-surface-muted px-3 py-2 font-mono text-sm font-bold">
                {product!.stockQty} {product!.unit}
              </div>
            </div>
          )}

          {!isEditing && (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-text-secondary">
                Saldo Inicial
              </label>
              <input
                type="number"
                min={0}
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-3 py-2 font-mono text-sm"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-medium text-text-secondary">
              Estoque Mínimo (Alerta)
            </label>
            <input
              type="number"
              min={0}
              value={minStockQty}
              onChange={(e) => setMinStockQty(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 font-mono text-sm"
            />
          </div>

          <div className={isEditing ? 'lg:col-span-2' : ''}>
            <label className="mb-1 block text-[11px] font-medium text-text-secondary">
              Fiscal BR (NCM / CFOP / CSOSN)
            </label>
            <div className="flex gap-1.5">
              <input
                placeholder="NCM"
                value={ncm}
                onChange={(e) => setNcm(e.target.value)}
                className="w-28 rounded-xl border border-border bg-bg px-2.5 py-2 font-mono text-xs"
              />
              <input
                placeholder="CFOP"
                value={cfopDefault}
                onChange={(e) => setCfopDefault(e.target.value)}
                className="w-16 rounded-xl border border-border bg-bg px-2 py-2 font-mono text-xs"
              />
              <input
                placeholder="CSOSN"
                value={csosnDefault}
                onChange={(e) => setCsosnDefault(e.target.value)}
                className="w-16 rounded-xl border border-border bg-bg px-2 py-2 font-mono text-xs"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-xs font-medium hover:bg-surface-muted"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-accent px-5 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
          >
            {saving
              ? 'Salvando...'
              : isEditing
                ? 'Salvar Alterações do Produto'
                : 'Cadastrar Produto Completo'}
          </button>
        </div>
      </form>

      {/* Extras na edição: Múltiplos Fornecedores + Kardex */}
      {isEditing && (
        <div className="grid gap-5 border-t border-border pt-5 lg:grid-cols-2">
          {/* Vínculo Múltiplos Fornecedores */}
          <div className="space-y-3 rounded-2xl border border-border bg-bg/60 p-4">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-primary">
              <Link2 className="h-3.5 w-3.5 text-accent" />
              Fornecedores Vinculados ({links.length})
            </h4>
            <form onSubmit={handleLinkSupplier} className="grid gap-2 sm:grid-cols-4">
              <select
                value={linkSupId}
                onChange={(e) => setLinkSupId(e.target.value)}
                className="sm:col-span-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="Cód. Forn."
                value={linkSupSku}
                onChange={(e) => setLinkSupSku(e.target.value)}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 font-mono text-xs"
              />
              <input
                placeholder="Custo R$"
                value={linkSupCostBrl}
                onChange={(e) => setLinkSupCostBrl(e.target.value)}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 font-mono text-xs"
              />
              <input
                placeholder="URL do catálogo/peça no fornecedor (opcional)"
                value={linkSupUrl}
                onChange={(e) => setLinkSupUrl(e.target.value)}
                className="sm:col-span-3 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground"
              >
                <Plus className="h-3 w-3" /> Vincular
              </button>
            </form>

            <div className="space-y-1.5">
              {links.map((l) => (
                <div
                  key={l.supplierId}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                >
                  <div>
                    <span className="font-semibold">{l.supplierName}</span>
                    {l.supplierSku && (
                      <span className="ml-2 font-mono text-text-muted">
                        SKU: {l.supplierSku}
                      </span>
                    )}
                    <span className="ml-2 font-mono text-accent">
                      {formatBrl(l.lastCostCents)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleUnlinkSupplier(l.supplierId)}
                    className="text-text-muted hover:text-danger"
                    title="Desvincular"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Ajuste rápido + Kardex */}
          <div className="space-y-3 rounded-2xl border border-border bg-bg/60 p-4">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-primary">
              <History className="h-3.5 w-3.5 text-accent" />
              Ajuste de Saldo & Kardex ({movements.length})
            </h4>
            <form onSubmit={handleStockAdjustment} className="grid gap-2 sm:grid-cols-4">
              <select
                value={movType}
                onChange={(e) =>
                  setMovType(e.target.value as 'in' | 'out' | 'adjustment')
                }
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs"
              >
                <option value="in">Entrada (+)</option>
                <option value="out">Saída (-)</option>
                <option value="adjustment">Ajuste Inventário</option>
              </select>
              <input
                type="number"
                min={1}
                value={movDelta}
                onChange={(e) => setMovDelta(e.target.value)}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 font-mono text-xs"
              />
              <input
                placeholder="Motivo do ajuste"
                value={movNote}
                onChange={(e) => setMovNote(e.target.value)}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-accent bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent"
              >
                <ArrowDownUp className="h-3 w-3" /> Aplicar
              </button>
            </form>

            <div className="max-h-40 space-y-1 overflow-y-auto">
              {movements.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-1.5 text-[11px]"
                >
                  <div>
                    <span
                      className={`font-mono font-bold ${
                        m.quantityDelta >= 0 ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {m.quantityDelta >= 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                    </span>{' '}
                    · <span className="uppercase text-text-muted">{m.type}</span> ·{' '}
                    <span>{m.note ?? 'Movimento'}</span>
                  </div>
                  <span className="font-mono text-text-muted">
                    {new Date(m.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
