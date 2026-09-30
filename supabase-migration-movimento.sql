-- ==============================================================================
-- MIGRAÇÃO DE BANCO DE DADOS: TABELA DE MOVIMENTO (KEEP-ALIVE / BANCO ATIVO)
-- Sistema: Meu Controle Financeiro
-- Finalidade: Lançamento automático diário às 08h e remoção diária às 20h
-- Objetivo: Evitar a hibernação / pausa por inatividade do banco gratuito (Supabase/PostgreSQL)
-- ==============================================================================

-- 1. Criação da tabela de movimento
CREATE TABLE IF NOT EXISTS "movimento" (
  "id" SERIAL PRIMARY KEY,
  "data" DATE NOT NULL DEFAULT CURRENT_DATE,
  "data_formatada" VARCHAR(20),                               -- Ex: '30/09/2026'
  "hora_lancamento" VARCHAR(20),                              -- Ex: '08:00:00'
  "descricao" VARCHAR(255) DEFAULT 'Atividade Diária - Manutenção de Banco Ativo',
  "tipo" VARCHAR(50) DEFAULT 'KEEP_ALIVE',                    -- 'KEEP_ALIVE' / 'SISTEMA'
  "status" VARCHAR(50) DEFAULT 'ATIVO',                       -- 'ATIVO' / 'FINALIZADO'
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Índice para consultas rápidas por data
CREATE INDEX IF NOT EXISTS "idx_movimento_data" ON "movimento" ("data");

-- 3. Documentação das colunas
COMMENT ON TABLE "movimento" IS 'Tabela de movimentação automática diária (inserção às 08h e remoção às 20h) para manter o banco de dados ativo e evitar hibernação';
COMMENT ON COLUMN "movimento"."data" IS 'Data de referência da atividade diária (DATE)';
COMMENT ON COLUMN "movimento"."data_formatada" IS 'Data formatada no padrão brasileiro (DD/MM/AAAA)';
COMMENT ON COLUMN "movimento"."hora_lancamento" IS 'Horário do registro no fuso de Brasília';
COMMENT ON COLUMN "movimento"."descricao" IS 'Descrição da rotina de atividade executada';

-- ==============================================================================
-- ROTINAS DIÁRIAS (FUNÇÕES SQL PARA EXECUÇÃO NO POSTGRESQL / SUPABASE)
-- ==============================================================================

-- Função 1: Lançar atividade do dia (08h da manhã)
CREATE OR REPLACE FUNCTION lancar_movimento_diario()
RETURNS VOID AS $$
BEGIN
  -- Insere o registro de hoje se ainda não existir
  IF NOT EXISTS (SELECT 1 FROM "movimento" WHERE "data" = CURRENT_DATE) THEN
    INSERT INTO "movimento" (
      "data",
      "data_formatada",
      "hora_lancamento",
      "descricao",
      "tipo",
      "status",
      "created_at",
      "updated_at"
    ) VALUES (
      CURRENT_DATE,
      TO_CHAR(CURRENT_DATE, 'DD/MM/YYYY'),
      TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI:SS'),
      'Atividade Diária 08h - Manutenção de Banco Ativo (Supabase Keep-Alive)',
      'KEEP_ALIVE',
      'ATIVO',
      NOW(),
      NOW()
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Função 2: Apagar atividade do dia (20h da noite)
CREATE OR REPLACE FUNCTION apagar_movimento_diario()
RETURNS VOID AS $$
BEGIN
  -- Apaga os registros da data atual e anteriores
  DELETE FROM "movimento" WHERE "data" <= CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- (OPCIONAL) AGENDAMENTO NATIVO VIA PG_CRON NO SUPABASE
-- Se a extensão pg_cron estiver habilitada no Supabase (Database -> Extensions),
-- os comandos abaixo executam o agendamento diretamente no servidor do PostgreSQL:
--
-- Horário de Brasília (UTC-3):
-- 08:00 BRT = 11:00 UTC
-- 20:00 BRT = 23:00 UTC
--
-- SELECT cron.schedule('movimento-lancar-08h', '0 11 * * *', 'SELECT lancar_movimento_diario()');
-- SELECT cron.schedule('movimento-apagar-20h', '0 23 * * *', 'SELECT apagar_movimento_diario()');
-- ==============================================================================
