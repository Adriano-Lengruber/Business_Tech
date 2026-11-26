import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculate3dPrintQuote,
  calculatePosSaleTotals,
  calculateQuoteTotals,
  calculateRetainerBalance,
  checkStockAlert,
  createQuoteSchema,
  hasPermission,
  MODULE_CATALOG,
  MODULE_CODES,
} from '../index.js';

test('RBAC role permissions follow least privilege including finance', () => {
  assert.equal(hasPermission('owner', 'org:manage'), true);
  assert.equal(hasPermission('admin', 'finance:write'), true);
  assert.equal(hasPermission('admin', 'org:manage'), false);
  assert.equal(hasPermission('technician', 'os:write'), true);
  assert.equal(hasPermission('technician', 'finance:write'), false);
  assert.equal(hasPermission('attendant', 'finance:read'), true);
  assert.equal(hasPermission('attendant', 'finance:write'), false);
  assert.equal(hasPermission('viewer', 'os:write'), false);
});

test('MODULE_CATALOG covers core and pluggable SaaS modules', () => {
  assert.equal(MODULE_CATALOG.core.required, true);
  for (const code of MODULE_CODES) {
    assert.ok(MODULE_CATALOG[code]);
  }
});

test('calculateQuoteTotals computes cents, discounts, cost and margin accurately', () => {
  const totals = calculateQuoteTotals([
    { itemType: 'labor', quantity: 1, unitCostCents: 0, unitPriceCents: 18000 },
    { itemType: 'part', quantity: 2, unitCostCents: 5000, unitPriceCents: 10000 },
    { itemType: 'discount', quantity: 1, unitCostCents: 0, unitPriceCents: 3000 },
  ]);

  assert.equal(totals.subtotalCents, 38000);
  assert.equal(totals.discountCents, 3000);
  assert.equal(totals.totalCents, 35000);
  assert.equal(totals.estimatedCostCents, 10000);
  assert.equal(totals.estimatedMarginCents, 25000);
  assert.equal(totals.marginPercent, 71.43);

  // Discount larger than subtotal never produces negative total
  const clamped = calculateQuoteTotals([
    { itemType: 'labor', quantity: 1, unitCostCents: 0, unitPriceCents: 5000 },
    { itemType: 'discount', quantity: 1, unitCostCents: 0, unitPriceCents: 9000 },
  ]);
  assert.equal(clamped.totalCents, 0);
  assert.equal(clamped.marginPercent, 0);
});

test('createQuoteSchema rejects empty items or invalid price', () => {
  const emptyItems = createQuoteSchema.safeParse({ items: [] });
  assert.equal(emptyItems.success, false);

  const negativePrice = createQuoteSchema.safeParse({
    items: [{ itemType: 'labor', description: 'Teste', unitPriceCents: -10 }],
  });
  assert.equal(negativePrice.success, false);
});

test('calculatePosSaleTotals and checkStockAlert enforce exact integer cents and thresholds', () => {
  const sale = calculatePosSaleTotals(
    [
      { quantity: 2, unitCostCents: 10000, unitPriceCents: 15000 },
      { quantity: 1, unitCostCents: 2000, unitPriceCents: 5000 },
    ],
    2000,
  );
  assert.equal(sale.subtotalCents, 35000);
  assert.equal(sale.discountCents, 2000);
  assert.equal(sale.totalCents, 33000);
  assert.equal(sale.totalCostCents, 22000);
  assert.equal(sale.marginCents, 11000);

  assert.equal(checkStockAlert(0, 3), 'OUT_OF_STOCK');
  assert.equal(checkStockAlert(3, 3), 'LOW_STOCK');
  assert.equal(checkStockAlert(4, 3), 'OK');
});

test('calculate3dPrintQuote and calculateRetainerBalance compute costs and utilization', () => {
  const quote3d = calculate3dPrintQuote({
    weightGrams: 100,
    printTimeMinutes: 120,
    filamentCostPerKgCents: 12000,
    printerWatts: 200,
    kwhPriceCents: 100,
    machineHourlyRateCents: 400,
    failureMarginPercent: 10,
    profitMarginPercent: 100,
  });

  // material: 1200, energy: 2h * 0.2kW * 100 = 40, machine: 2h * 400 = 800 -> base = 2040 -> +10% = 2244 -> +100% = 4488
  assert.equal(quote3d.materialCostCents, 1200);
  assert.equal(quote3d.energyCostCents, 40);
  assert.equal(quote3d.machineCostCents, 800);
  assert.equal(quote3d.totalCostCents, 2244);
  assert.equal(quote3d.suggestedPriceCents, 4488);

  const retainer = calculateRetainerBalance(600, 500);
  assert.equal(retainer.remainingMinutes, 100);
  assert.equal(retainer.utilizationPercent, 83.33);
  assert.equal(retainer.isNearLimit, true);
});
