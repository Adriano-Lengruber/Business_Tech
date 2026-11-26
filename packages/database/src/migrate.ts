import { config as loadEnv } from 'dotenv';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDbPool } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../../.env') });

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured in environment/.env');
  }

  const pool = createDbPool(databaseUrl);
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _al_migrations (
        id serial PRIMARY KEY,
        filename varchar(255) NOT NULL UNIQUE,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const migrationsDir = resolve(__dirname, '../drizzle');
    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const existing = await client.query(
        'SELECT 1 FROM _al_migrations WHERE filename = $1',
        [file],
      );
      if (existing.rowCount && existing.rowCount > 0) {
        console.log(`[migrate] Skipping already applied: ${file}`);
        continue;
      }

      const sqlContent = await readFile(resolve(migrationsDir, file), 'utf8');
      console.log(`[migrate] Applying ${file}...`);
      await client.query('BEGIN');
      try {
        await client.query(sqlContent);
        await client.query(
          'INSERT INTO _al_migrations (filename) VALUES ($1)',
          [file],
        );
        await client.query('COMMIT');
        console.log(`[migrate] Applied ${file} successfully.`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('[migrate] Failed:', err);
  process.exit(1);
});
