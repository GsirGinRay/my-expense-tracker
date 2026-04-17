import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env') });

const { Pool, types } = pg;

// Keep DATE columns as raw 'YYYY-MM-DD' strings — the default Date parser
// applies UTC and shifts dates by a day in non-UTC environments.
types.setTypeParser(1082, (value) => value);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured. Copy .env.example to .env');
}

const useSsl = process.env.DATABASE_SSL === 'true';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PG client:', err);
});
