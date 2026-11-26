import test from 'node:test';
import assert from 'node:assert/strict';
import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { createDb, createDbPool, withTenantContext } from '../client.js';
import { organizations, customers } from '../schema/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../../../.env') });

test('PostgreSQL RLS strictly isolates tenant rows across organizations', async (t) => {
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
      await tx.insert(customers).values({
        organizationId: orgAId,
        name: 'Cliente Exclusivo Org A',
        phoneE164: '+5511900000001',
      });
    });

    await withTenantContext(db, orgBId, async (tx) => {
      await tx.insert(customers).values({
        organizationId: orgBId,
        name: 'Cliente Exclusivo Org B',
        phoneE164: '+5511900000002',
      });
    });

    const rowsVisibleToA = await withTenantContext(db, orgAId, (tx) =>
      tx.select().from(customers),
    );
    const rowsVisibleToB = await withTenantContext(db, orgBId, (tx) =>
      tx.select().from(customers),
    );

    assert.equal(rowsVisibleToA.length, 1);
    assert.equal(rowsVisibleToA[0]?.name, 'Cliente Exclusivo Org A');
    assert.equal(rowsVisibleToB.length, 1);
    assert.equal(rowsVisibleToB[0]?.name, 'Cliente Exclusivo Org B');
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
