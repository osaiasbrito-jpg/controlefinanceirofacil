-- ==============================================================================
-- MIGRAÇÃO DE BANCO DE DADOS: TABELA DE MOVIMENTO & HISTÓRICO (KEEP-ALIVE SUPABASE)
-- Sistema: Meu Controle Financeiro
-- Finalidade: Lançamento automático diário às 08h e remoção diária às 20h
-- Objetivo: Evitar a hibernação / pausa por inatividade do banco gratuito (Supabase/PostgreSQL)
-- ==============================================================================

-- 1. Criação da tabela de movimento (dados ativos do dia)
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

CREATE INDEX IF NOT EXISTS "idx_movimento_data" ON "movimento" ("data");

-- 2. Tabela de histórico e auditoria (para você acompanhar todas as execuções mesmo quando a tabela movimento estiver vazia à noite)
CREATE TABLE IF NOT EXISTS "movimento_historico" (
  "id" SERIAL PRIMARY KEY,
  "data" DATE NOT NULL DEFAULT CURRENT_DATE,
  "data_formatada" VARCHAR(20),
  "hora_execucao" VARCHAR(20),
  "acao" VARCHAR(50) NOT NULL,                                -- 'INSERCAO_08H', 'REMOCAO_20H', 'TESTE'
  "descricao" VARCHAR(255),
  "status" VARCHAR(50) DEFAULT 'SUCESSO',
  "executado_por" VARCHAR(50) DEFAULT 'PG_CRON_AUTOMATICO',
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_movimento_historico_data" ON "movimento_historico" ("data");

-- ==============================================================================
-- 3. FUNÇÕES SQL COM AJUSTE PRECISO DO FUSO DE BRASÍLIA (America/Sao_Paulo)
-- ==============================================================================

-- Função 1: Lançar atividade do dia (08h da manhã)
CREATE OR REPLACE FUNCTION lancar_movimento_diario()
RETURNS VOID AS $$
DECLARE
  v_data_br DATE;
  v_hora VARCHAR(20);
  v_data_formatada VARCHAR(20);
BEGIN
  v_data_br := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_hora := TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI:SS');
  v_data_formatada := TO_CHAR(v_data_br, 'DD/MM/YYYY');

  -- Insere na tabela movimento se ainda não existir
  IF NOT EXISTS (SELECT 1 FROM "movimento" WHERE "data" = v_data_br) THEN
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
      v_data_br,
      v_data_formatada,
      v_hora,
      'Atividade Diária 08h - Manutenção de Banco Ativo (Supabase Keep-Alive)',
      'KEEP_ALIVE',
      'ATIVO',
      NOW(),
      NOW()
    );
  END IF;

  -- Registra no histórico para visualização e auditoria
  INSERT INTO "movimento_historico" (
    "data",
    "data_formatada",
    "hora_execucao",
    "acao",
    "descricao",
    "status",
    "executado_por"
  ) VALUES (
    v_data_br,
    v_data_formatada,
    v_hora,
    'INSERCAO_08H',
    'Data lançada com sucesso às 08h da manhã (' || v_data_formatada || ' às ' || v_hora || ') para manter o banco ativo',
    'SUCESSO',
    'PG_CRON_AUTOMATICO'
  );
END;
$$ LANGUAGE plpgsql;

-- Função 2: Apagar atividade do dia (20h da noite)
CREATE OR REPLACE FUNCTION apagar_movimento_diario()
RETURNS VOID AS $$
DECLARE
  v_data_br DATE;
  v_hora VARCHAR(20);
  v_data_formatada VARCHAR(20);
  v_qtd INTEGER;
BEGIN
  v_data_br := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_hora := TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI:SS');
  v_data_formatada := TO_CHAR(v_data_br, 'DD/MM/YYYY');

  -- Apaga da tabela movimento a data atual e anteriores
  WITH deleted AS (
    DELETE FROM "movimento" WHERE "data" <= v_data_br RETURNING *
  )
  SELECT count(*) INTO v_qtd FROM deleted;

  -- Registra no histórico para visualização e auditoria
  INSERT INTO "movimento_historico" (
    "data",
    "data_formatada",
    "hora_execucao",
    "acao",
    "descricao",
    "status",
    "executado_por"
  ) VALUES (
    v_data_br,
    v_data_formatada,
    v_hora,
    'REMOCAO_20H',
    'Data apagada com sucesso às 20h da noite (' || v_data_formatada || ' às ' || v_hora || ') conforme rotina diária (' || v_qtd || ' registro(s) removido(s))',
    'SUCESSO',
    'PG_CRON_AUTOMATICO'
  );
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 4. AGENDAMENTO AUTOMÁTICO 24/7 DENTRO DO PRÓPRIO SUPABASE (PG_CRON)
-- Este agendador roda diretamente nos servidores do Supabase, sem depender do navegador!
-- Horário de Brasília (UTC-3):
-- 08:00 BRT = 11:00 UTC ('0 11 * * *')
-- 20:00 BRT = 23:00 UTC ('0 23 * * *')
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT jobid FROM cron.job WHERE jobname IN ('movimento-lancar-08h', 'movimento-apagar-20h', 'movimento-apagar-meia-noite') LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END $$;

SELECT cron.schedule('movimento-lancar-08h', '0 11 * * *', 'SELECT lancar_movimento_diario()');
SELECT cron.schedule('movimento-apagar-20h', '0 23 * * *', 'SELECT apagar_movimento_diario()');
SELECT cron.schedule('movimento-apagar-meia-noite', '0 3 * * *', 'SELECT apagar_movimento_diario()');
