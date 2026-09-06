import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    let config: PoolConfig;

    if (process.env.SQL_HOST) {
      config = {
        host: process.env.SQL_HOST,
        user: process.env.SQL_ADMIN_USER || process.env.SQL_USER || 'ai_studio_admin',
        password: process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || '',
        database: process.env.SQL_DB_NAME || 'cloud_sql_development_database',
        port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
        max: 10,
        connectionTimeoutMillis: 15000,
      };
    } else if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
      const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
      config = {
        connectionString,
        ssl: connectionString?.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
        max: 10,
        connectionTimeoutMillis: 15000,
      };
    } else {
      config = {
        host: process.env.PGHOST || 'db.dpaylubvupjjokpukuxy.supabase.co',
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'Ojf6994@#gestaoPessoas',
        database: process.env.PGDATABASE || 'postgres',
        port: Number(process.env.PGPORT || 5432),
        ssl: { rejectUnauthorized: false },
        max: 10,
        connectionTimeoutMillis: 15000,
      };
    }

    global._postgresPool = new Pool(config);

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
export { pool };
