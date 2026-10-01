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

      -- Tabela Dedicada Renda Massoterapia
      CREATE TABLE IF NOT EXISTS "renda_massoterapia" (
        "id" TEXT PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "data_lancamento" TEXT NOT NULL,
        "valor" NUMERIC(12,2) NOT NULL,
        "observacao" TEXT,
        "created_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "idx_renda_massoterapia_usuario" ON "renda_massoterapia"("user_id");
      CREATE INDEX IF NOT EXISTS "idx_renda_massoterapia_data" ON "renda_massoterapia"("data_lancamento");
      CREATE INDEX IF NOT EXISTS "idx_renda_massoterapia_usuario_data" ON "renda_massoterapia"("user_id", "data_lancamento");

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

      -- Tabela Dedicada para Sessões Avulsas (Sistema de Gestão de Pessoas - Massoterapia)
      CREATE TABLE IF NOT EXISTS "sessoes_avulsas" (
        "id" TEXT PRIMARY KEY,
        "user_id" TEXT DEFAULT 'osaiasbrito@gmail.com',
        "cliente" TEXT,
        "paciente" TEXT,
        "cliente_paciente" TEXT,
        "data" TEXT,
        "data_sessao" TEXT,
        "data_lancamento" TEXT,
        "valor" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        "procedimento" TEXT,
        "tecnicas" TEXT,
        "tipo" TEXT DEFAULT 'Sessão Avulsa',
        "tipo_sessao" TEXT DEFAULT 'Sessão Avulsa',
        "profissional" TEXT DEFAULT 'Osaias Brito',
        "forma_pagamento" TEXT,
        "observacao" TEXT,
        "status" TEXT DEFAULT 'Realizado',
        "origem" TEXT DEFAULT 'Sistema de Gestão de Pessoas',
        "mes_referencia" TEXT,
        "created_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "idx_sessoes_avulsas_user" ON "sessoes_avulsas"("user_id");
      CREATE INDEX IF NOT EXISTS "idx_sessoes_avulsas_data" ON "sessoes_avulsas"("data_lancamento");

      -- Tabela Dedicada para Abatimentos / Adiantamentos de Pagamento
      CREATE TABLE IF NOT EXISTS "abatimentos" (
        "id" TEXT PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "reference_month" TEXT NOT NULL,
        "date" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "target_type" TEXT NOT NULL DEFAULT 'CREDIT_CARD',
        "card_id" TEXT,
        "card_name" TEXT,
        "payment_method" TEXT,
        "payment_method_id" TEXT,
        "payment_method_name" TEXT,
        "description" TEXT DEFAULT 'Abatimento de Pagamento',
        "source_method" TEXT,
        "notes" TEXT,
        "created_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "idx_abatimentos_user_month" ON "abatimentos"("user_id", "reference_month");
      CREATE INDEX IF NOT EXISTS "idx_abatimentos_card" ON "abatimentos"("card_id");
      CREATE INDEX IF NOT EXISTS "idx_abatimentos_method" ON "abatimentos"("payment_method_id");

      -- Tabela Dedicada para Atendimentos (Sistema de Gestão de Pessoas - Massoterapia)
      CREATE TABLE IF NOT EXISTS "atendimentos" (
        "id" TEXT PRIMARY KEY,
        "user_id" TEXT DEFAULT 'osaiasbrito@gmail.com',
        "nome_cliente" TEXT,
        "cliente" TEXT,
        "paciente" TEXT,
        "data_atendimento" TEXT,
        "data" TEXT,
        "valor" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        "servico" TEXT,
        "procedimento" TEXT,
        "tipo" TEXT DEFAULT 'Sessão Avulsa',
        "profissional" TEXT DEFAULT 'Osaias Brito',
        "observacoes" TEXT,
        "status" TEXT DEFAULT 'Realizado',
        "origem" TEXT DEFAULT 'Sistema de Gestão de Pessoas',
        "created_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "idx_atendimentos_user" ON "atendimentos"("user_id");

      -- Tabela de Abatimentos e Adiantamentos de Pagamento
      CREATE TABLE IF NOT EXISTS "abatimentos" (
        "id" TEXT PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "reference_month" TEXT NOT NULL,
        "date" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "target_type" TEXT NOT NULL DEFAULT 'CREDIT_CARD',
        "card_id" TEXT,
        "card_name" TEXT,
        "payment_method" TEXT,
        "payment_method_id" TEXT,
        "payment_method_name" TEXT,
        "description" TEXT NOT NULL DEFAULT 'Abatimento de Pagamento',
        "source_method" TEXT,
        "notes" TEXT,
        "created_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "idx_abatimentos_user" ON "abatimentos"("user_id");
      CREATE INDEX IF NOT EXISTS "idx_abatimentos_mes" ON "abatimentos"("reference_month");

      -- Tabela Movimento (Rotina Automática Diária: Lançamento às 08h e Remoção às 20h para manter o banco ativo)
      CREATE TABLE IF NOT EXISTS "movimento" (
        "id" SERIAL PRIMARY KEY,
        "data" DATE NOT NULL DEFAULT CURRENT_DATE,
        "data_formatada" VARCHAR(20),
        "hora_lancamento" VARCHAR(20),
        "descricao" VARCHAR(255) DEFAULT 'Atividade Diária - Manutenção de Banco Ativo',
        "tipo" VARCHAR(50) DEFAULT 'KEEP_ALIVE',
        "status" VARCHAR(50) DEFAULT 'ATIVO',
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "idx_movimento_data" ON "movimento" ("data");

      -- Tabela de Histórico e Auditoria de Movimentação Diária
      CREATE TABLE IF NOT EXISTS "movimento_historico" (
        "id" SERIAL PRIMARY KEY,
        "data" DATE NOT NULL DEFAULT CURRENT_DATE,
        "data_formatada" VARCHAR(20),
        "hora_execucao" VARCHAR(20),
        "acao" VARCHAR(50) NOT NULL,
        "descricao" VARCHAR(255),
        "status" VARCHAR(50) DEFAULT 'SUCESSO',
        "executado_por" VARCHAR(50) DEFAULT 'PG_CRON_AUTOMATICO',
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "idx_movimento_historico_data" ON "movimento_historico" ("data");

      -- Funções para automação diária diretamente no banco
      CREATE OR REPLACE FUNCTION lancar_movimento_diario()
      RETURNS void AS $fn$
      DECLARE
        v_data_br DATE;
        v_hora VARCHAR(20);
        v_data_formatada VARCHAR(20);
      BEGIN
        v_data_br := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
        v_hora := TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI:SS');
        v_data_formatada := TO_CHAR(v_data_br, 'DD/MM/YYYY');

        IF NOT EXISTS (SELECT 1 FROM "movimento" WHERE "data" = v_data_br) THEN
          INSERT INTO "movimento" (
            "data", "data_formatada", "hora_lancamento", "descricao", "tipo", "status", "created_at", "updated_at"
          ) VALUES (
            v_data_br, v_data_formatada, v_hora,
            'Atividade Diária 08h - Manutenção de Banco Ativo (Supabase Keep-Alive)',
            'KEEP_ALIVE', 'ATIVO', NOW(), NOW()
          );
        END IF;

        INSERT INTO "movimento_historico" (
          "data", "data_formatada", "hora_execucao", "acao", "descricao", "status", "executado_por"
        ) VALUES (
          v_data_br, v_data_formatada, v_hora,
          'INSERCAO_08H',
          'Data lançada com sucesso às 08h da manhã (' || v_data_formatada || ' às ' || v_hora || ') para manter o banco ativo',
          'SUCESSO', 'PG_CRON_AUTOMATICO'
        );
      END;
      $fn$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION apagar_movimento_diario()
      RETURNS void AS $fn$
      DECLARE
        v_data_br DATE;
        v_hora VARCHAR(20);
        v_data_formatada VARCHAR(20);
        v_qtd INTEGER;
      BEGIN
        v_data_br := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
        v_hora := TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI:SS');
        v_data_formatada := TO_CHAR(v_data_br, 'DD/MM/YYYY');

        WITH deleted AS (
          DELETE FROM "movimento" RETURNING *
        )
        SELECT count(*) INTO v_qtd FROM deleted;

        INSERT INTO "movimento_historico" (
          "data", "data_formatada", "hora_execucao", "acao", "descricao", "status", "executado_por"
        ) VALUES (
          v_data_br, v_data_formatada, v_hora,
          'REMOCAO_20H',
          'Data apagada com sucesso às 20h da noite (' || v_data_formatada || ' às ' || v_hora || ') conforme rotina diária (' || v_qtd || ' registro(s) removido(s))',
          'SUCESSO', 'PG_CRON_AUTOMATICO'
        );
      END;
      $fn$ LANGUAGE plpgsql;

      DO $cron_block$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
          IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'movimento-lancar-08h') THEN
            PERFORM cron.schedule('movimento-lancar-08h', '0 11 * * *', 'SELECT lancar_movimento_diario()');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'movimento-apagar-20h') THEN
            PERFORM cron.schedule('movimento-apagar-20h', '0 23 * * *', 'SELECT apagar_movimento_diario()');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'movimento-apagar-meia-noite') THEN
            PERFORM cron.schedule('movimento-apagar-meia-noite', '0 3 * * *', 'SELECT apagar_movimento_diario()');
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $cron_block$;
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

      -- renda_massoterapia columns
      ALTER TABLE "renda_massoterapia" ADD COLUMN IF NOT EXISTS "cliente_paciente" TEXT;
      ALTER TABLE "renda_massoterapia" ADD COLUMN IF NOT EXISTS "client_name" TEXT;
      ALTER TABLE "renda_massoterapia" ADD COLUMN IF NOT EXISTS "procedimento" TEXT;
      ALTER TABLE "renda_massoterapia" ADD COLUMN IF NOT EXISTS "tecnicas" TEXT;
      ALTER TABLE "renda_massoterapia" ADD COLUMN IF NOT EXISTS "tipo" TEXT DEFAULT 'Sessão Avulsa';
      ALTER TABLE "renda_massoterapia" ADD COLUMN IF NOT EXISTS "tipo_sessao" TEXT DEFAULT 'Sessão Avulsa';
      ALTER TABLE "renda_massoterapia" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'Realizado';
      ALTER TABLE "renda_massoterapia" ADD COLUMN IF NOT EXISTS "profissional" TEXT;
      ALTER TABLE "renda_massoterapia" ADD COLUMN IF NOT EXISTS "mes_referencia" TEXT;
      ALTER TABLE "renda_massoterapia" ADD COLUMN IF NOT EXISTS "reference_month" TEXT;
      ALTER TABLE "renda_massoterapia" ADD COLUMN IF NOT EXISTS "origem" TEXT DEFAULT 'Terapias Pro';
      ALTER TABLE "renda_massoterapia" ADD COLUMN IF NOT EXISTS "dados_extras" JSONB;
      ALTER TABLE "renda_massoterapia" ADD COLUMN IF NOT EXISTS "data" TEXT;
      ALTER TABLE "renda_massoterapia" ADD COLUMN IF NOT EXISTS "date" TEXT;

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
