import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateQuoteTotals,
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
