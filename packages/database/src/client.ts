import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from './schema/index.js';

export type Database = NodePgDatabase<typeof schema>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createDbPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    max: 15,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export function createDb(pool: Pool): Database {
  return drizzle(pool, { schema });
}

/**
 * Executa operacoes de negocio dentro de uma transacao com contexto multi-tenant
 * imposto pelo PostgreSQL Row-Level Security (RLS) via `al_app`.
 */
export async function withTenantContext<T>(
  db: Database,
  organizationId: string,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  if (!UUID_REGEX.test(organizationId)) {
    throw new Error(`Invalid organizationId for RLS context: ${organizationId}`);
  }

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_tenant_id', ${organizationId}, true)`,
    );
    await tx.execute(sql`SET LOCAL ROLE al_app`);
    return fn(tx as unknown as Database);
  });
}
