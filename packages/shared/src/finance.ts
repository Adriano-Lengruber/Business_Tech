export const QUOTE_TIERS = ['economic', 'recommended', 'premium'] as const;
export type QuoteTier = (typeof QUOTE_TIERS)[number];

export const QUOTE_TIER_LABELS: Record<QuoteTier, string> = {
  economic: 'Econômica',
  recommended: 'Recomendada',
  premium: 'Premium',
};

export const QUOTE_STATUSES = [
  'DRAFT',
  'SENT',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_ITEM_TYPES = [
  'labor',
  'part',
  'third_party',
  'diagnostic',
  'travel',
  'discount',
] as const;
export type QuoteItemType = (typeof QUOTE_ITEM_TYPES)[number];

export const FINANCIAL_TYPES = ['receivable', 'payable'] as const;
export type FinancialType = (typeof FINANCIAL_TYPES)[number];

export const PAYMENT_METHODS = ['pix', 'boleto', 'card', 'cash'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'OVERDUE',
  'CANCELED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface QuoteItemCalculationInput {
  itemType: QuoteItemType;
  quantity: number;
  unitCostCents: number;
  unitPriceCents: number;
}

export interface QuoteTotals {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  estimatedCostCents: number;
  estimatedMarginCents: number;
  marginPercent: number;
}

/**
 * Calcula totais e margem em centavos inteiros para evitar erros de ponto flutuante.
 */
export function calculateQuoteTotals(
  items: readonly QuoteItemCalculationInput[],
): QuoteTotals {
  let subtotalCents = 0;
  let discountCents = 0;
  let estimatedCostCents = 0;

  for (const item of items) {
    const qty = Math.max(0, item.quantity);
    const linePrice = Math.round(qty * item.unitPriceCents);
    const lineCost = Math.round(qty * item.unitCostCents);

    if (item.itemType === 'discount') {
      discountCents += Math.abs(linePrice);
    } else {
      subtotalCents += linePrice;
      estimatedCostCents += lineCost;
    }
  }

  const totalCents = Math.max(0, subtotalCents - discountCents);
  const estimatedMarginCents = totalCents - estimatedCostCents;
  const marginPercent =
    totalCents > 0
      ? Math.round((estimatedMarginCents / totalCents) * 10000) / 100
      : 0;

  return {
    subtotalCents,
    discountCents,
    totalCents,
    estimatedCostCents,
    estimatedMarginCents,
    marginPercent,
  };
}
