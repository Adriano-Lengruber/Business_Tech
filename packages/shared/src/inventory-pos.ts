export const INVENTORY_MOVEMENT_TYPES = [
  'in',
  'out',
  'sale',
  'os_consume',
  'reserve',
  'release',
  'adjustment',
  'return',
  'loss',
] as const;
export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

export const SALE_STATUSES = ['OPEN', 'COMPLETED', 'CANCELED'] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export const FISCAL_DOC_TYPES = ['NFE', 'NFCE', 'NFSE'] as const;
export type FiscalDocType = (typeof FISCAL_DOC_TYPES)[number];

export const FISCAL_DOC_STATUSES = [
  'DRAFT',
  'AUTHORIZED',
  'REJECTED',
  'CANCELED',
] as const;
export type FiscalDocStatus = (typeof FISCAL_DOC_STATUSES)[number];

export const TAX_REGIMES = [
  'SIMPLES_NACIONAL',
  'MEI',
  'LUCRO_PRESUMIDO',
  'LUCRO_REAL',
] as const;
export type TaxRegime = (typeof TAX_REGIMES)[number];

export type StockAlertLevel = 'OK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export function checkStockAlert(
  stockQty: number,
  minStockQty: number,
): StockAlertLevel {
  if (stockQty <= 0) return 'OUT_OF_STOCK';
  if (stockQty <= minStockQty) return 'LOW_STOCK';
  return 'OK';
}

export interface PosItemInput {
  quantity: number;
  unitCostCents: number;
  unitPriceCents: number;
}

export interface PosSaleTotals {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  totalCostCents: number;
  marginCents: number;
}

export function calculatePosSaleTotals(
  items: readonly PosItemInput[],
  globalDiscountCents = 0,
): PosSaleTotals {
  let subtotalCents = 0;
  let totalCostCents = 0;

  for (const item of items) {
    const qty = Math.max(0, Math.round(item.quantity));
    subtotalCents += qty * item.unitPriceCents;
    totalCostCents += qty * item.unitCostCents;
  }

  const discountCents = Math.max(0, Math.min(subtotalCents, globalDiscountCents));
  const totalCents = Math.max(0, subtotalCents - discountCents);
  const marginCents = totalCents - totalCostCents;

  return {
    subtotalCents,
    discountCents,
    totalCents,
    totalCostCents,
    marginCents,
  };
}
