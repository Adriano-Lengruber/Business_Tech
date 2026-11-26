import test from 'node:test';
import assert from 'node:assert/strict';
import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { createDb, createDbPool, withTenantContext } from '../client.js';
import {
  organizations,
  customers,
  serviceOrders,
  osDiagnostics,
  quotes,
  financialTransactions,
  products,
  sales,
  fiscalDocuments,
} from '../schema/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../../../.env') });

test('PostgreSQL RLS strictly isolates customers, OS, diagnostics, quotes and finance across tenants', async (t) => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    t.skip('DATABASE_URL not set');
    return;
  }

  const pool = createDbPool(dbUrl);
  const db = createDb(pool);

  const suffix = Date.now().toString();
  let orgAId = '';
  let orgBId = '';

  try {
    const [orgA] = await db
      .insert(organizations)
      .values({ slug: `rls-a-${suffix}`, name: 'Org A' })
      .returning({ id: organizations.id });
    const [orgB] = await db
      .insert(organizations)
      .values({ slug: `rls-b-${suffix}`, name: 'Org B' })
      .returning({ id: organizations.id });

    orgAId = orgA!.id;
    orgBId = orgB!.id;

    await withTenantContext(db, orgAId, async (tx) => {
      const [custA] = await tx
        .insert(customers)
        .values({
          organizationId: orgAId,
          name: 'Cliente Exclusivo Org A',
          phoneE164: '+5511900000001',
        })
        .returning({ id: customers.id });

      const [osA] = await tx
        .insert(serviceOrders)
        .values({
          organizationId: orgAId,
          code: 'OS-RLS-A1',
          customerId: custA!.id,
          reportedSymptoms: 'Sintoma A',
        })
        .returning({ id: serviceOrders.id });

      await tx.insert(osDiagnostics).values({
        organizationId: orgAId,
        serviceOrderId: osA!.id,
        observedFacts: 'Fato A',
      });

      await tx.insert(quotes).values({
        organizationId: orgAId,
        serviceOrderId: osA!.id,
        code: 'ORC-RLS-A1',
        validUntil: new Date(),
        paymentTerms: 'PIX',
        totalCents: 15000,
      });

      await tx.insert(financialTransactions).values({
        organizationId: orgAId,
        serviceOrderId: osA!.id,
        type: 'receivable',
        category: 'OS',
        description: 'Receita A',
        amountCents: 15000,
        dueDate: new Date(),
      });

      await tx.insert(products).values({
        organizationId: orgAId,
        sku: 'RLS-SKU-A',
        name: 'Peça Exclusiva A',
        priceCents: 10000,
        stockQty: 5,
      });

      await tx.insert(sales).values({
        organizationId: orgAId,
        code: 'PDV-RLS-A1',
        totalCents: 10000,
      });

      await tx.insert(fiscalDocuments).values({
        organizationId: orgAId,
        docType: 'NFCE',
        number: 1,
        referenceType: 'sale',
        referenceId: osA!.id,
        totalCents: 10000,
      });
    });

    await withTenantContext(db, orgBId, async (tx) => {
      const [custB] = await tx
        .insert(customers)
        .values({
          organizationId: orgBId,
          name: 'Cliente Exclusivo Org B',
          phoneE164: '+5511900000002',
        })
        .returning({ id: customers.id });

      await tx.insert(serviceOrders).values({
        organizationId: orgBId,
        code: 'OS-RLS-B1',
        customerId: custB!.id,
        reportedSymptoms: 'Sintoma B',
      });
    });

    const orgAView = await withTenantContext(db, orgAId, async (tx) => ({
      customers: await tx.select().from(customers),
      orders: await tx.select().from(serviceOrders),
      diagnostics: await tx.select().from(osDiagnostics),
      quotes: await tx.select().from(quotes),
      finance: await tx.select().from(financialTransactions),
      products: await tx.select().from(products),
      sales: await tx.select().from(sales),
      fiscal: await tx.select().from(fiscalDocuments),
    }));

    const orgBView = await withTenantContext(db, orgBId, async (tx) => ({
      customers: await tx.select().from(customers),
      orders: await tx.select().from(serviceOrders),
      diagnostics: await tx.select().from(osDiagnostics),
      quotes: await tx.select().from(quotes),
      finance: await tx.select().from(financialTransactions),
      products: await tx.select().from(products),
      sales: await tx.select().from(sales),
      fiscal: await tx.select().from(fiscalDocuments),
    }));

    assert.equal(orgAView.customers.length, 1);
    assert.equal(orgAView.orders[0]?.code, 'OS-RLS-A1');
    assert.equal(orgAView.diagnostics.length, 1);
    assert.equal(orgAView.quotes.length, 1);
    assert.equal(orgAView.finance.length, 1);
    assert.equal(orgAView.products.length, 1);
    assert.equal(orgAView.sales.length, 1);
    assert.equal(orgAView.fiscal.length, 1);

    assert.equal(orgBView.customers.length, 1);
    assert.equal(orgBView.orders[0]?.code, 'OS-RLS-B1');
    assert.equal(orgBView.diagnostics.length, 0);
    assert.equal(orgBView.quotes.length, 0);
    assert.equal(orgBView.finance.length, 0);
    assert.equal(orgBView.products.length, 0);
    assert.equal(orgBView.sales.length, 0);
    assert.equal(orgBView.fiscal.length, 0);
  } finally {
    if (orgAId) {
      await db.delete(organizations).where(eq(organizations.id, orgAId));
    }
    if (orgBId) {
      await db.delete(organizations).where(eq(organizations.id, orgBId));
    }
    await pool.end();
  }
});
