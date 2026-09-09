import { pool } from './index';

export async function ensureDatabaseTables() {
  const client = await pool.connect();
  try {
    console.log('Verificando e inicializando tabelas e migrações no PostgreSQL (Supabase)...');

    // 1. Create tables if they do not exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" SERIAL PRIMARY KEY,
        "uid" TEXT NOT NULL UNIQUE,
        "email" TEXT NOT NULL,
        "name" TEXT,
        "photo_url" TEXT,
        "role" TEXT DEFAULT 'USER',
        "is_super_user" BOOLEAN DEFAULT FALSE,
        "password" TEXT,
        "created_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "user_settings" (
        "id" SERIAL PRIMARY KEY,
        "user_id" TEXT NOT NULL UNIQUE,
        "theme" TEXT DEFAULT 'system',
        "currency" TEXT DEFAULT 'BRL',
        "hide_values_by_default" BOOLEAN DEFAULT FALSE,
        "enable_notifications" BOOLEAN DEFAULT TRUE,
        "due_day_alert_days" INTEGER DEFAULT 3,
        "ai_advice_enabled" BOOLEAN DEFAULT TRUE,
        "monthly_income_target" DOUBLE PRECISION DEFAULT 0,
        "monthly_savings_target" DOUBLE PRECISION DEFAULT 0,
        "current_selected_month" TEXT,
        "created_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "categories" (
        "id" TEXT PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "type" TEXT DEFAULT 'EXPENSE',
        "icon" TEXT,
        "color" TEXT,
        "is_default" BOOLEAN DEFAULT FALSE,
        "is_archived" BOOLEAN DEFAULT FALSE,
        "monthly_limit" DOUBLE PRECISION,
        "created_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "budgets" (
        "id" TEXT PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "category_id" TEXT NOT NULL,
        "category_name" TEXT NOT NULL,
        "monthly_limit" DOUBLE PRECISION NOT NULL,
        "reference_month" TEXT DEFAULT 'GLOBAL',
        "alert_threshold_percentage" INTEGER DEFAULT 80,
        "notes" TEXT,
        "created_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "salaries" (
        "id" TEXT PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "reference_month" TEXT NOT NULL,
        "description" TEXT DEFAULT 'Salário Mensal',
        "pay_day" INTEGER DEFAULT 5,
        "status" TEXT DEFAULT 'RECEIVED',
        "active" BOOLEAN DEFAULT TRUE,
        "notes" TEXT,
        "created_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "extra_incomes" (
        "id" TEXT PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "description" TEXT NOT NULL,
        "source" TEXT DEFAULT 'Outros',
        "date" TEXT NOT NULL,
        "reference_month" TEXT,
        "status" TEXT DEFAULT 'RECEIVED',
        "notes" TEXT,
        "created_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "credit_cards" (
        "id" TEXT PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "brand" TEXT DEFAULT 'OUTRO',
        "last_digits" TEXT,
        "limit_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "closing_day" INTEGER NOT NULL DEFAULT 1,
        "due_day" INTEGER NOT NULL DEFAULT 10,
        "color" TEXT DEFAULT '#059669',
        "is_archived" BOOLEAN DEFAULT FALSE,
        "notes" TEXT,
        "created_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "payment_methods" (
        "id" TEXT PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "type" TEXT NOT NULL DEFAULT 'OUTROS',
        "details" TEXT,
        "color" TEXT DEFAULT '#0D9488',
        "isActive" BOOLEAN DEFAULT TRUE,
        "is_active" BOOLEAN DEFAULT TRUE,
        "notes" TEXT,
        "created_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "installment_purchases" (
        "id" TEXT PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "total_amount" DOUBLE PRECISION NOT NULL,
        "installment_count" INTEGER NOT NULL,
        "installment_amount" DOUBLE PRECISION NOT NULL,
        "start_month" TEXT NOT NULL,
        "card_id" TEXT NOT NULL,
        "card_name" TEXT,
        "category_id" TEXT NOT NULL,
        "category_name" TEXT NOT NULL,
        "default_day" INTEGER DEFAULT 1,
        "is_indefinite" BOOLEAN DEFAULT FALSE,
        "is_interrupted" BOOLEAN DEFAULT FALSE,
        "interrupted_month" TEXT,
        "created_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "expenses" (
        "id" TEXT PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "category_id" TEXT NOT NULL,
        "category_name" TEXT NOT NULL,
        "payment_method" TEXT NOT NULL DEFAULT 'PIX',
        "payment_method_id" TEXT,
        "credit_card_id" TEXT,
        "credit_card_name" TEXT,
        "date" TEXT NOT NULL,
        "reference_month" TEXT,
        "status" TEXT NOT NULL DEFAULT 'PENDENTE',
        "is_recurring" BOOLEAN DEFAULT FALSE,
        "recurring_expense_id" TEXT,
        "is_installment" BOOLEAN DEFAULT FALSE,
        "is_indefinite" BOOLEAN DEFAULT FALSE,
        "installment_number" INTEGER,
        "total_installments" INTEGER,
        "installment_purchase_id" TEXT,
        "notes" TEXT,
        "invoice_month" TEXT,
        "created_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "backups" (
        "id" TEXT PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "backup_date" TEXT NOT NULL,
        "description" TEXT,
        "size_bytes" INTEGER DEFAULT 0,
        "data_json" JSONB NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "system_integrations_log" (
        "id" TEXT PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "system_name" TEXT NOT NULL DEFAULT 'Gestão de Pessoas - Massoterapia',
        "action" TEXT NOT NULL,
        "amount" DOUBLE PRECISION,
        "client_name" TEXT,
        "description" TEXT,
        "payload" JSONB,
        "response" JSONB,
        "created_at" TIMESTAMP DEFAULT NOW()
      );

      -- Tabela de Renda Extra (Integração Direta Massoterapia)
      CREATE TABLE IF NOT EXISTS "renda_extra" (
        "id" TEXT PRIMARY KEY,
        "descricao" VARCHAR(255) NOT NULL DEFAULT 'MASSOTERAPIA',
        "origem_renda" VARCHAR(100) NOT NULL DEFAULT 'SERVIÇO',
        "origem" VARCHAR(100) DEFAULT 'SERVIÇO',
        "tipo" VARCHAR(100) DEFAULT 'Renda Extra',
        "categoria" VARCHAR(100) DEFAULT 'Renda Extra',
        "valor" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        "data" DATE NOT NULL DEFAULT CURRENT_DATE,
        "mes_referencia" VARCHAR(7) NOT NULL,
        "mes" VARCHAR(7),
        "observacao" TEXT,
        "cliente_paciente" VARCHAR(255),
        "procedimento" VARCHAR(255),
        "somar_ao_salario" BOOLEAN DEFAULT true,
        "user_id" VARCHAR(255) DEFAULT 'osaiasbrito@gmail.com',
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "idx_renda_extra_mes" ON "renda_extra"("mes_referencia");
      CREATE INDEX IF NOT EXISTS "idx_renda_extra_descricao" ON "renda_extra"("descricao");
    `);

    // 2. Ensure all columns exist even if tables were created previously
    await client.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "uid" TEXT;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" TEXT;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" TEXT;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "photo_url" TEXT;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" TEXT DEFAULT 'USER';
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_super_user" BOOLEAN DEFAULT FALSE;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password" TEXT;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP DEFAULT NOW();
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP DEFAULT NOW();

      -- Ensure unique constraint on uid if not already present
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'users_uid_unique' OR conname = 'users_uid_key'
        ) THEN
          BEGIN
            ALTER TABLE "users" ADD CONSTRAINT "users_uid_key" UNIQUE ("uid");
          EXCEPTION
            WHEN OTHERS THEN NULL;
          END;
        END IF;
      END $$;

      -- user_settings columns
      ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "theme" TEXT DEFAULT 'system';
      ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'BRL';
      ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "hide_values_by_default" BOOLEAN DEFAULT FALSE;
      ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "enable_notifications" BOOLEAN DEFAULT TRUE;
      ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "due_day_alert_days" INTEGER DEFAULT 3;
      ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "ai_advice_enabled" BOOLEAN DEFAULT TRUE;
      ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "monthly_income_target" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "monthly_savings_target" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "current_selected_month" TEXT;

      -- expenses columns
      ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "invoice_month" TEXT;
      ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "notes" TEXT;
      ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "is_recurring" BOOLEAN DEFAULT FALSE;
      ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "is_installment" BOOLEAN DEFAULT FALSE;
      ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "is_indefinite" BOOLEAN DEFAULT FALSE;
      ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "credit_card_id" TEXT;
      ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "payment_method_id" TEXT;

      -- indexes
      CREATE INDEX IF NOT EXISTS "idx_users_uid" ON "users" ("uid");
      CREATE INDEX IF NOT EXISTS "idx_expenses_user_id" ON "expenses" ("user_id");
      CREATE INDEX IF NOT EXISTS "idx_expenses_user_ref" ON "expenses" ("user_id", "reference_month");
      CREATE INDEX IF NOT EXISTS "idx_salaries_user_id" ON "salaries" ("user_id");
      CREATE INDEX IF NOT EXISTS "idx_extra_incomes_user_id" ON "extra_incomes" ("user_id");
      CREATE INDEX IF NOT EXISTS "idx_credit_cards_user_id" ON "credit_cards" ("user_id");
      CREATE INDEX IF NOT EXISTS "idx_categories_user_id" ON "categories" ("user_id");
      CREATE INDEX IF NOT EXISTS "idx_installment_purchases_user_id" ON "installment_purchases" ("user_id");
    `);

    // 3. Upsert Super User
    await client.query(`
      INSERT INTO "users" ("uid", "email", "name", "role", "is_super_user", "password")
      VALUES ('osaiasbrito@gmail.com', 'osaiasbrito@gmail.com', 'Osaias Brito (Super Usuário)', 'SUPERADMIN', TRUE, 'Ojf6994@#gestaoPessoas')
      ON CONFLICT ("uid") DO UPDATE 
      SET "role" = 'SUPERADMIN', "is_super_user" = TRUE, "password" = 'Ojf6994@#gestaoPessoas', "updated_at" = NOW();
    `);

    console.log('Tabelas, colunas e índices do PostgreSQL inicializados com sucesso!');
  } catch (error) {
    console.error('Aviso ao inicializar tabelas PostgreSQL:', error);
  } finally {
    client.release();
  }
}
