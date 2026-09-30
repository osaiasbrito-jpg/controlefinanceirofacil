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

    const supabaseHost = process.env.PGHOST || 'db.dpaylubvupjjokpukuxy.supabase.co';
    const supabasePass = process.env.SUPABASE_DB_PASSWORD || process.env.PGPASSWORD || 'Ojf6994@#gestaoPessoas';
    const supabaseUser = process.env.PGUSER || 'postgres';
    const supabaseDb = process.env.PGDATABASE || 'postgres';

    // Prioridade 1: Supabase PostgreSQL (Banco Oficial do Projeto)
    if (supabaseHost && (supabaseHost.includes('supabase.co') || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)) {
      config = {
        host: supabaseHost,
        user: supabaseUser,
        password: supabasePass,
        database: supabaseDb,
        port: Number(process.env.PGPORT || 5432),
        ssl: { rejectUnauthorized: false },
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      };
      console.log(`[PostgreSQL Pool] Conectando ao Banco Supabase Oficial: ${supabaseHost} (${supabaseDb})`);
    } else if (process.env.SQL_HOST) {
      config = {
        host: process.env.SQL_HOST,
        user: process.env.SQL_ADMIN_USER || process.env.SQL_USER || 'ai_studio_admin',
        password: process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || '',
        database: process.env.SQL_DB_NAME || 'cloud_sql_development_database',
        port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      };
    } else if (process.env.DATABASE_URL) {
      const connectionString = process.env.DATABASE_URL;
      config = {
        connectionString,
        ssl: connectionString?.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      };
    } else {
      config = {
        host: supabaseHost,
        user: supabaseUser,
        password: supabasePass,
        database: supabaseDb,
        port: Number(process.env.PGPORT || 5432),
        ssl: { rejectUnauthorized: false },
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      };
    }

    global._postgresPool = new Pool(config);

    global._postgresPool.on('error', (err: any) => {
      const isTerminated =
        err?.message?.includes('Connection terminated unexpectedly') ||
        err?.code === 'ECONNRESET' ||
        err?.code === '57P01';
      if (isTerminated) {
        // Conexões ociosas finalizadas pelo servidor ou firewall são normais e o pool as descarta
        console.warn('[PostgreSQL Pool] Conexão ociosa finalizada pelo servidor/proxy (reciclada com sucesso).');
      } else {
        console.error('Unexpected error on idle PostgreSQL pool client:', err);
      }
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
export { pool };

/**
 * Executa uma operação no banco de dados com retentativa automática em caso de desconexão inesperada.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 300): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      const isConnectionError =
        error?.message?.includes('Connection terminated unexpectedly') ||
        error?.message?.includes('connection closed') ||
        error?.cause?.message?.includes('Connection terminated unexpectedly') ||
        error?.code === 'ECONNRESET' ||
        error?.code === '57P01' ||
        error?.code === '08006' ||
        error?.code === '08001';

      if (isConnectionError && attempt <= retries) {
        console.warn(`[PostgreSQL] Conexão terminada inesperadamente na tentativa ${attempt}. Reconectando cliente em ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }
}
