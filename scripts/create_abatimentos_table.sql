-- ==============================================================================
-- SCRIPT DE CRIAÇÃO DA TABELA DE ABATIMENTOS / ADIANTAMENTOS DE PAGAMENTO
-- Sistema: Meu Controle Financeiro
-- Banco de Dados: PostgreSQL (Supabase / Cloud SQL)
-- Objetivo: Permitir registrar abatimentos parciais e adiantamentos de fatura
--           de cartão de crédito ou boletos/outros métodos, recalculando
--           dinamicamente o valor líquido a pagar.
-- ==============================================================================

-- 1. Criação da tabela abatimentos
CREATE TABLE IF NOT EXISTS "abatimentos" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "reference_month" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "target_type" TEXT NOT NULL DEFAULT 'CREDIT_CARD', -- 'CREDIT_CARD' ou 'PAYMENT_METHOD'
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

-- 2. Índices de performance para consultas por usuário e mês de referência
CREATE INDEX IF NOT EXISTS "idx_abatimentos_user_month" ON "abatimentos"("user_id", "reference_month");
CREATE INDEX IF NOT EXISTS "idx_abatimentos_card" ON "abatimentos"("card_id");
CREATE INDEX IF NOT EXISTS "idx_abatimentos_method" ON "abatimentos"("payment_method_id");

-- 3. Comentários para documentação das colunas
COMMENT ON TABLE "abatimentos" IS 'Registros de abatimentos parciais e adiantamentos de pagamentos de faturas ou contas';
COMMENT ON COLUMN "abatimentos"."target_type" IS 'Define se o abatimento é para Cartão de Crédito (CREDIT_CARD) ou Outro Método (PAYMENT_METHOD)';
COMMENT ON COLUMN "abatimentos"."amount" IS 'Valor adiantado ou abatido (R$)';
COMMENT ON COLUMN "abatimentos"."reference_month" IS 'Mês da fatura ou competência afetada (formato AAAA-MM, ex: 2026-09)';
COMMENT ON COLUMN "abatimentos"."card_id" IS 'ID do cartão de crédito onde o abatimento foi aplicado (ex: Mercado Pago)';
COMMENT ON COLUMN "abatimentos"."payment_method" IS 'Método abatido (ex: BOLETO, PIX, etc.)';
