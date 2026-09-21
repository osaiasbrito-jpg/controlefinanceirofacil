-- ==============================================================================
-- MIGRAÇÃO DE BANCO DE DADOS: TABELA DE ABATIMENTOS E ADIANTAMENTOS
-- Sistema: Meu Controle Financeiro
-- Finalidade: Registro de pagamentos adiantados e abatimentos de faturas/boletos
-- ==============================================================================

-- 1. Criação da tabela principal de abatimentos
CREATE TABLE IF NOT EXISTS "abatimentos" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "reference_month" TEXT NOT NULL,             -- Mês de competência (Ex: '2026-10')
  "date" TEXT NOT NULL,                        -- Data do pagamento/abatimento (Ex: '2026-10-05')
  "amount" DOUBLE PRECISION NOT NULL,          -- Valor adiantado/abatido (Ex: 500.00)
  "target_type" TEXT NOT NULL DEFAULT 'CREDIT_CARD', -- 'CREDIT_CARD', 'BOLETO', 'PIX', 'CUSTOM_METHOD', 'GENERAL'
  "card_id" TEXT,                              -- ID do Cartão de Crédito abatido (se aplicável)
  "card_name" TEXT,                            -- Nome do Cartão de Crédito abatido (Ex: 'MERCADO PAGO', 'INTER')
  "payment_method" TEXT,                       -- Tipo do método (Ex: 'CARTAO_CREDITO', 'BOLETO')
  "payment_method_id" TEXT,                    -- ID do método customizado (se aplicável)
  "payment_method_name" TEXT,                  -- Nome do método (Ex: 'Boletos', 'Boleto Financiamento')
  "description" TEXT NOT NULL DEFAULT 'Abatimento de Pagamento',
  "source_method" TEXT,                        -- Forma usada para pagar o adiantamento (Ex: 'PIX', 'Saldo em Conta', 'Dinheiro')
  "notes" TEXT,                                -- Observações adicionais
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

-- 2. Índices de alta performance para busca e filtros rápidos
CREATE INDEX IF NOT EXISTS "idx_abatimentos_user_month" 
  ON "abatimentos" ("user_id", "reference_month");

CREATE INDEX IF NOT EXISTS "idx_abatimentos_card_id" 
  ON "abatimentos" ("card_id");

CREATE INDEX IF NOT EXISTS "idx_abatimentos_target_type" 
  ON "abatimentos" ("target_type");

-- 3. Comentários para documentação das colunas
COMMENT ON TABLE "abatimentos" IS 'Registros de abatimentos e adiantamentos parciais de faturas e boletos';
COMMENT ON COLUMN "abatimentos"."reference_month" IS 'Mês no formato YYYY-MM em que a fatura/despesa está vinculada';
COMMENT ON COLUMN "abatimentos"."amount" IS 'Valor em reais do adiantamento a ser subtraído do total a pagar';
COMMENT ON COLUMN "abatimentos"."card_name" IS 'Identificação canônica ou nome do cartão (ex: Mercado Pago, Inter)';
