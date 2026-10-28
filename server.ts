import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { optionalAuth, requireAuth, AuthRequest } from './src/middleware/auth';
import {
  getOrCreateUser,
  getFullUserData,
  syncUserData,
  deleteEntity,
  upsertUserSettings,
  testDatabaseConnection,
  upsertAbatimento,
  deleteAbatimentoRecord,
  updateExpenseInPostgresRepo,
  updateMultipleExpensesStatusInPostgresRepo,
  updateInstallmentPurchaseAndLinkedExpensesInPostgres,
} from './src/db/repositories';
import { db } from './src/db/index';
import { systemIntegrationsLog } from './src/db/schema';
import { ensureDatabaseTables } from './src/db/init';
import {
  iniciarAgendadorMovimento,
  getMovimentoStatus,
  lancarMovimento,
  apagarMovimento,
  executarCicloMovimento,
} from './src/services/movimentoService';

const __filenameSafe = typeof import.meta !== 'undefined' && import.meta.url ? fileURLToPath(import.meta.url) : (process.argv[1] || '');
const __dirnameSafe = __filenameSafe ? path.dirname(__filenameSafe) : process.cwd();

process.on('uncaughtException', (err) => {
  console.error('[Process] Exceção não capturada:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Process] Rejeição de Promise não tratada:', reason);
});

async function startServer() {
  const app = express();
  const portArgIndex = process.argv.indexOf('--port');
  const argPort = portArgIndex !== -1 ? parseInt(process.argv[portArgIndex + 1], 10) : NaN;
  const PORT = (!isNaN(argPort) && argPort > 0) ? argPort : (parseInt(process.env.PORT || '3000', 10) || 3000);

  // Enable CORS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, X-User-Email, X-User-Password, x-access-password, User-Agent, user-agent, x-user-email, x-user-password, *'
    );
    res.header('Access-Control-Expose-Headers', '*');
    res.header('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // PostgreSQL Database Health Check
  app.get('/api/health/db', async (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    try {
      const dbStatus = await testDatabaseConnection();
      res.json(dbStatus);
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // Rotinas e Monitoramento da Tabela Movimento (Keep-Alive Automático)
  app.get('/api/movimento/status', async (_req, res) => {
    try {
      const status = await getMovimentoStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  app.post('/api/movimento/lancar', async (req, res) => {
    try {
      const { force, descricao, tipo, status, agendadoMeiaNoite } = req.body || {};
      const result = await lancarMovimento({
        force: Boolean(force),
        customDesc: descricao,
        tipo,
        status,
        agendadoMeiaNoite: Boolean(agendadoMeiaNoite),
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/movimento/lancar-teste-meia-noite', async (req, res) => {
    try {
      const { descricao } = req.body || {};
      const result = await lancarMovimento({
        force: true,
        agendadoMeiaNoite: true,
        tipo: 'TESTE_MEIA_NOITE',
        status: 'ATIVO_ATE_MEIA_NOITE',
        customDesc:
          descricao ||
          'Teste de Atividade Solicitado - Lançado com a data de hoje (Programado para apagar automaticamente à Meia-Noite)',
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/movimento/apagar', async (req, res) => {
    try {
      const { data, forceAll } = req.body || {};
      const result = await apagarMovimento({ targetDate: data, forceAll: Boolean(forceAll) });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/movimento/executar-ciclo', async (_req, res) => {
    try {
      const result = await executarCicloMovimento();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Super User direct authentication via PostgreSQL
  app.post('/api/auth/superuser-login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const cleanEmail = email?.toLowerCase()?.trim();
      const validPass = password === 'Ojf6994@#gestaoPessoas' || password === 'Ojf6994@#' || password === 'Ojf6994@#gestãoPessoas';

      if (cleanEmail === 'osaiasbrito@gmail.com' && validPass) {
        const user = await getOrCreateUser(
          'osaiasbrito@gmail.com',
          'osaiasbrito@gmail.com',
          'Osaias Brito (Super Usuário)'
        );
        return res.json({
          success: true,
          isSuperUser: true,
          role: 'SUPERADMIN',
          user: {
            uid: 'osaiasbrito@gmail.com',
            email: 'osaiasbrito@gmail.com',
            displayName: 'Osaias Brito (Super Usuário)',
            role: 'SUPERADMIN',
            isSuperUser: true,
          },
        });
      }
      return res.status(401).json({ error: 'Credenciais de super usuário inválidas' });
    } catch (error: any) {
      res.status(500).json({ error: 'Erro na autenticação de super usuário', details: error.message });
    }
  });

  // User Authentication & Registration in PostgreSQL
  app.post('/api/auth/sync-user', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid || req.body?.uid;
      const email = req.user?.email || req.body?.email || 'usuario@meucontrole.app';
      const name = req.user?.name || req.body?.name;
      const photoUrl = req.user?.picture || req.body?.photoUrl;

      if (!uid) {
        return res.status(400).json({ error: 'UID de usuário é obrigatório' });
      }

      const dbUser = await getOrCreateUser(uid, email, name, photoUrl);
      res.json({ success: true, user: dbUser });
    } catch (error: any) {
      console.error('Erro ao sincronizar usuário no PostgreSQL:', error);
      res.status(500).json({ error: 'Erro ao registrar usuário', details: error.message });
    }
  });

  // Fetch Full User Financial Data from PostgreSQL
  app.get('/api/data', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.uid || (req.query.userId as string);
      const userEmail = req.user?.email || (req.query.email as string);
      if (!userId && !userEmail) {
        return res.status(400).json({ error: 'Identificador do usuário é obrigatório' });
      }

      const effectiveUserId = userId || userEmail || 'osaiasbrito@gmail.com';
      const data = await getFullUserData(effectiveUserId, userEmail);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao carregar dados do PostgreSQL:', error);
      res.status(500).json({ error: 'Erro ao buscar dados no banco PostgreSQL', details: error.message });
    }
  });

  // Bulk Sync Financial Data into PostgreSQL
  app.post('/api/sync', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.uid || req.body?.userId;
      if (!userId) {
        return res.status(400).json({ error: 'Identificador do usuário é obrigatório' });
      }

      const payload = { ...req.body, userId };
      const syncResult = await syncUserData(payload);
      res.json(syncResult);
    } catch (error: any) {
      console.error('Erro na sincronização com PostgreSQL:', error);
      res.status(500).json({ error: 'Falha ao sincronizar dados com o banco de dados', details: error.message });
    }
  });

  // Save / Update User Settings in PostgreSQL
  app.post('/api/settings', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.uid || req.body?.userId;
      if (!userId) {
        return res.status(400).json({ error: 'Identificador do usuário é obrigatório' });
      }

      const updated = await upsertUserSettings(userId, req.body.settings || req.body);
      res.json({ success: true, settings: updated });
    } catch (error: any) {
      console.error('Erro ao atualizar configurações no PostgreSQL:', error);
      res.status(500).json({ error: 'Falha ao salvar configurações', details: error.message });
    }
  });

  // Delete Entity from PostgreSQL
  app.delete('/api/entity/:table/:id', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userEmail = req.user?.email || (req.query.email as string) || (req.body?.email as string);
      const rawUserId = (req.query.userId as string) || req.user?.uid || (req.body?.userId as string);
      const isOsaias =
        userEmail?.toLowerCase().includes('osaias') ||
        rawUserId?.toLowerCase().includes('osaias') ||
        req.user?.uid?.toLowerCase().includes('osaias');
      const effectiveUserId = isOsaias ? 'osaiasbrito@gmail.com' : (rawUserId || userEmail || 'osaiasbrito@gmail.com');
      const { table, id } = req.params;
      const deleteFuture = req.query.deleteFuture === 'true' || req.body?.deleteFuture === true;
      const deleteAll = req.query.deleteAll === 'true' || req.body?.deleteAll === true;

      if (!id || !table) {
        return res.status(400).json({ error: 'Parâmetros incompletos para remoção' });
      }

      const result = await deleteEntity(table, id, effectiveUserId, {
        deleteFutureInstallments: deleteFuture,
        deleteAllInstallments: deleteAll,
        userEmail,
      });

      broadcastSyncEvent('data_refreshed', { action: 'delete', table, id, timestamp: Date.now() });

      res.json(result);
    } catch (error: any) {
      console.error('Erro ao deletar registro no PostgreSQL:', error);
      res.status(500).json({ error: 'Falha ao deletar registro no banco', details: error.message });
    }
  });

  // Endpoints Dedicados para Atualização Direta de Despesas no PostgreSQL
  app.patch('/api/expenses/:id', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updated = await updateExpenseInPostgresRepo(id, req.body);
      broadcastSyncEvent('data_refreshed', { action: 'update_expense', id, status: req.body?.status, timestamp: Date.now() });
      res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error('Erro ao atualizar despesa no PostgreSQL:', error);
      res.status(500).json({ error: 'Falha ao atualizar despesa', details: error.message });
    }
  });

  app.put('/api/expenses/:id', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updated = await updateExpenseInPostgresRepo(id, req.body);
      broadcastSyncEvent('data_refreshed', { action: 'update_expense', id, status: req.body?.status, timestamp: Date.now() });
      res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error('Erro ao atualizar despesa no PostgreSQL:', error);
      res.status(500).json({ error: 'Falha ao atualizar despesa', details: error.message });
    }
  });

  app.post('/api/expenses/bulk-status', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { ids, status } = req.body;
      if (!Array.isArray(ids) || !status) {
        return res.status(400).json({ error: 'IDs e status são obrigatórios' });
      }
      const updated = await updateMultipleExpensesStatusInPostgresRepo(ids, status);
      broadcastSyncEvent('data_refreshed', { action: 'bulk_status_expense', ids, status, timestamp: Date.now() });
      res.json({ success: true, count: updated.length, data: updated });
    } catch (error: any) {
      console.error('Erro ao atualizar status em lote no PostgreSQL:', error);
      res.status(500).json({ error: 'Falha ao atualizar status em lote', details: error.message });
    }
  });

  app.put('/api/installment-purchases/:id', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { data, specificExpenseId, specificExpenseData } = req.body;
      const result = await updateInstallmentPurchaseAndLinkedExpensesInPostgres(
        id,
        data || req.body,
        specificExpenseId,
        specificExpenseData
      );
      broadcastSyncEvent('data_refreshed', { action: 'update_installment_purchase', id, timestamp: Date.now() });
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Erro ao atualizar compra parcelada no PostgreSQL:', error);
      res.status(500).json({ error: 'Falha ao atualizar compra parcelada', details: error.message });
    }
  });

  // Server-Sent Events (SSE) para Notificação em Tempo Real Instantânea
  const sseClients = new Set<express.Response>();

  app.get('/api/events/live-sync', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n');
    res.write(': connected\n\n');
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  function broadcastSyncEvent(event: string, data: any) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(message);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  // ==============================================================================
  // ENDPOINTS DE ABATIMENTOS E ADIANTAMENTOS DE PAGAMENTO
  // ==============================================================================
  app.post('/api/abatimentos', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.uid || req.body?.userId || req.user?.email || 'osaiasbrito@gmail.com';
      const { amount, targetType, cardId, cardName, paymentMethod, paymentMethodId, paymentMethodName, date, referenceMonth, description, sourceMethod, notes } = req.body;

      if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ error: 'O valor do abatimento deve ser maior que zero.' });
      }

      const saved = await upsertAbatimento(userId, {
        id: req.body.id,
        amount: Number(amount),
        targetType: targetType || 'CREDIT_CARD',
        cardId,
        cardName,
        paymentMethod,
        paymentMethodId,
        paymentMethodName,
        date: date || new Date().toISOString().substring(0, 10),
        referenceMonth: referenceMonth || (date ? date.substring(0, 7) : 'GLOBAL'),
        description: description || 'Abatimento de Pagamento',
        sourceMethod,
        notes,
      });

      broadcastSyncEvent('data_refreshed', { action: 'create_abatimento', id: saved.id, timestamp: Date.now() });

      res.json({
        success: true,
        message: 'Abatimento registrado com sucesso!',
        data: saved,
      });
    } catch (error: any) {
      console.error('Erro ao registrar abatimento no PostgreSQL:', error);
      res.status(500).json({ error: 'Falha ao registrar abatimento no banco de dados', details: error.message });
    }
  });

  app.delete('/api/abatimentos/:id', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userEmail = req.user?.email || (req.query.email as string);
      const rawUserId = (req.query.userId as string) || req.user?.uid;
      const isOsaias =
        userEmail?.toLowerCase().includes('osaias') ||
        rawUserId?.toLowerCase().includes('osaias') ||
        req.user?.uid?.toLowerCase().includes('osaias');
      const userId = isOsaias ? 'osaiasbrito@gmail.com' : (rawUserId || userEmail || 'osaiasbrito@gmail.com');
      const { id } = req.params;

      const result = await deleteAbatimentoRecord(userId, id);
      broadcastSyncEvent('data_refreshed', { action: 'delete_abatimento', id, timestamp: Date.now() });

      res.json({
        success: true,
        message: 'Abatimento excluído com sucesso!',
        data: result,
      });
    } catch (error: any) {
      console.error('Erro ao excluir abatimento:', error);
      res.status(500).json({ error: 'Falha ao excluir abatimento', details: error.message });
    }
  });

  // Gemini Financial Advisor API Endpoint
  app.post('/api/gemini/analyze-expenses', async (req, res) => {
    try {
      const {
        month,
        monthName,
        totalRevenue,
        totalSalary,
        totalExtraIncome,
        totalExpenses,
        totalBalance,
        pendingExpenses,
        paidExpenses,
        creditCardInvoiceTotal,
        categories,
        topExpenses,
        installmentsCount,
      } = req.body;

      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        // Provide a robust smart fallback if the API key is not yet set
        return res.json({
          success: true,
          source: 'local-fallback',
          data: generateSmartLocalFinancialAdvice({
            monthName: monthName || month,
            totalRevenue: Number(totalRevenue) || 0,
            totalExpenses: Number(totalExpenses) || 0,
            totalBalance: Number(totalBalance) || 0,
            creditCardInvoiceTotal: Number(creditCardInvoiceTotal) || 0,
            pendingExpenses: Number(pendingExpenses) || 0,
            categories: Array.isArray(categories) ? categories : [],
            topExpenses: Array.isArray(topExpenses) ? topExpenses : [],
          }),
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `Você é um consultor financeiro pessoal especialista em finanças familiares no Brasil (padrão BRL R$).
Analise com precisão os dados financeiros do usuário para o mês de ${monthName || month} e forneça um diagnóstico financeiro objetivo, um índice de saúde financeira (0 a 100) e dicas práticas e personalizadas para economizar e otimizar os gastos.

DADOS DO MÊS (${monthName || month}):
- Receita Total: R$ ${(Number(totalRevenue) || 0).toFixed(2)} (Salário: R$ ${(Number(totalSalary) || 0).toFixed(2)}, Renda Extra: R$ ${(Number(totalExtraIncome) || 0).toFixed(2)})
- Despesas Totais: R$ ${(Number(totalExpenses) || 0).toFixed(2)} (Pagas: R$ ${(Number(paidExpenses) || 0).toFixed(2)}, Pendentes: R$ ${(Number(pendingExpenses) || 0).toFixed(2)})
- Fatura de Cartões de Crédito: R$ ${(Number(creditCardInvoiceTotal) || 0).toFixed(2)}
- Saldo Final Líquido: R$ ${(Number(totalBalance) || 0).toFixed(2)}
- Quantidade de Compras Parceladas/Lançamentos Futuros: ${Number(installmentsCount) || 0}

DISTRIBUIÇÃO POR CATEGORIAS:
${
  Array.isArray(categories) && categories.length > 0
    ? categories
        .map((c: { name: string; amount: number; percentage?: number }) => `- ${c.name}: R$ ${Number(c.amount || 0).toFixed(2)} (${c.percentage || 0}%)`)
        .join('\n')
    : 'Nenhuma categoria específica registrada.'
}

PRINCIPAIS LANÇAMENTOS DO MÊS:
${
  Array.isArray(topExpenses) && topExpenses.length > 0
    ? topExpenses
        .slice(0, 10)
        .map((e: { description: string; amount: number; categoryName?: string; paymentMethod?: string; status?: string }) => `- ${e.description} (${e.categoryName || 'Geral'} / ${e.paymentMethod || 'Outro'}): R$ ${Number(e.amount || 0).toFixed(2)} [${e.status || 'PENDENTE'}]`)
        .join('\n')
    : 'Sem despesas cadastradas.'
}

DIRETRIZES DE RESPOSTA:
1. Responda em Português do Brasil de forma acolhedora, encorajadora, direta e sem jargões complexos.
2. Calcule uma pontuação de saúde financeira de 0 a 100 baseada na relação entre receita x despesas, peso do cartão de crédito e contas pendentes.
3. Classifique o status entre: "excelente", "bom", "atencao", ou "critico".
4. Gere de 2 a 4 dicas práticas, específicas e acionáveis para economizar ou equilibrar o orçamento neste mês.
5. Destaque um alerta ou oportunidade principal (highlightInsight).
6. Estime um potencial de economia mensal realista em Reais (ex: 150.00).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: 'Você é um consultor financeiro de alto nível especializado em finanças pessoais brasileiras. Gere saídas estritamente no formato JSON estruturado conforme o schema solicitado.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: {
                type: Type.INTEGER,
                description: 'Pontuação de saúde financeira do mês de 0 a 100.',
              },
              status: {
                type: Type.STRING,
                description: 'Status: excelente, bom, atencao ou critico.',
              },
              statusLabel: {
                type: Type.STRING,
                description: 'Rótulo descritivo do status em português (ex: "Excelente Controle", "Saúde Financeira Boa", "Requer Atenção", "Alerta Vermelho").',
              },
              summary: {
                type: Type.STRING,
                description: 'Resumo conciso de 1 a 2 frases sobre a situação financeira do mês.',
              },
              highlightInsight: {
                type: Type.STRING,
                description: 'O principal ponto de atenção ou oportunidade do mês.',
              },
              potentialMonthlySavings: {
                type: Type.NUMBER,
                description: 'Estimativa de economia sugerida em Reais (número).',
              },
              savingsTips: {
                type: Type.ARRAY,
                description: 'Lista de 2 a 4 dicas práticas e personalizadas.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: {
                      type: Type.STRING,
                      description: 'Título curto e chamativo da dica.',
                    },
                    description: {
                      type: Type.STRING,
                      description: 'Explicação detalhada e ação prática a ser tomada.',
                    },
                    category: {
                      type: Type.STRING,
                      description: 'Categoria relacionada ou geral (ex: Alimentação, Cartão, Fixas, Economia).',
                    },
                    impact: {
                      type: Type.STRING,
                      description: 'Impacto estimado: "alto", "medio" ou "baixo".',
                    },
                  },
                  required: ['title', 'description', 'category'],
                },
              },
            },
            required: ['score', 'status', 'statusLabel', 'summary', 'highlightInsight', 'savingsTips', 'potentialMonthlySavings'],
          },
        },
      });

      const responseText = response.text?.trim() || '{}';
      const parsedData = JSON.parse(responseText);

      return res.json({
        success: true,
        source: 'gemini-ai',
        data: parsedData,
      });
    } catch (error: any) {
      console.error('Erro na análise de despesas com Gemini:', error);
      // Fallback response on error so client never breaks
      const { monthName, totalRevenue, totalExpenses, totalBalance, creditCardInvoiceTotal, categories, topExpenses } = req.body || {};
      const fallbackData = generateSmartLocalFinancialAdvice({
        monthName: monthName || 'este mês',
        totalRevenue: Number(totalRevenue) || 0,
        totalExpenses: Number(totalExpenses) || 0,
        totalBalance: Number(totalBalance) || 0,
        creditCardInvoiceTotal: Number(creditCardInvoiceTotal) || 0,
        pendingExpenses: 0,
        categories: Array.isArray(categories) ? categories : [],
        topExpenses: Array.isArray(topExpenses) ? topExpenses : [],
      });

      return res.json({
        success: true,
        source: 'fallback-after-error',
        data: fallbackData,
        error: error?.message,
      });
    }
  });

  // Endpoint para consultas rápidas com I.A sobre o mês financeiro
  app.post('/api/gemini/quick-query', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const {
        queryType = 'CUSTOM',
        customPrompt = '',
        month = '',
        monthName = '',
        singleExpensesTotal = 0,
        lastInstallmentsTotal = 0,
        combinedTotal = 0,
        allInstallmentsTotal = 0,
        singleExpensesCount = 0,
        lastInstallmentsCount = 0,
        combinedCount = 0,
        allInstallmentsCount = 0,
        singleExpenses = [],
        lastInstallments = [],
        allInstallments = [],
        allExpenses = [],
        totalExpenses = 0,
        totalRevenue = 0,
      } = req.body || {};

      const apiKey = process.env.GEMINI_API_KEY;

      // Se a chave Gemini não estiver configurada, usa o motor algorítmico inteligente local
      if (!apiKey) {
        const localResult = generateSmartQuickAnswer({
          queryType,
          customPrompt,
          month,
          monthName: monthName || month || 'este mês',
          singleExpensesTotal: Number(singleExpensesTotal) || 0,
          lastInstallmentsTotal: Number(lastInstallmentsTotal) || 0,
          combinedTotal: Number(combinedTotal) || 0,
          allInstallmentsTotal: Number(allInstallmentsTotal) || 0,
          singleExpensesCount: Number(singleExpensesCount) || 0,
          lastInstallmentsCount: Number(lastInstallmentsCount) || 0,
          combinedCount: Number(combinedCount) || 0,
          allInstallmentsCount: Number(allInstallmentsCount) || 0,
          singleExpenses: Array.isArray(singleExpenses) ? singleExpenses : [],
          lastInstallments: Array.isArray(lastInstallments) ? lastInstallments : [],
          allInstallments: Array.isArray(allInstallments) ? allInstallments : [],
          allExpenses: Array.isArray(allExpenses) ? allExpenses : [],
          totalExpenses: Number(totalExpenses) || 0,
          totalRevenue: Number(totalRevenue) || 0,
        });

        return res.json({
          success: true,
          source: 'local-intelligence',
          data: localResult,
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const effectiveQuery = customPrompt || (
        queryType === 'SINGLE' ? 'Qual a soma das compras à vista neste mês?' :
        queryType === 'LAST_INSTALLMENTS' ? 'Qual a soma de últimas parcelas que finalizam neste mês?' :
        queryType === 'COMBINED' ? 'Qual a soma de últimas parcelas + compras à vista que darão alívio ao próximo mês?' :
        queryType === 'ALL_INSTALLMENTS' ? 'Qual o total de parcelas ativas no mês?' :
        'Buscar soma de compras a vista, tanto boletos, pix como cartão de crédito'
      );

      const prompt = `Você é um assistente de inteligência financeira pessoal especialista em finanças brasileiras (moeda R$ Real Brasileiro).
Responda com máxima precisão e clareza em Português do Brasil à consulta sobre o mês de ${monthName || month}.

PERGUNTA DO USUÁRIO: "${effectiveQuery}"

DADOS MATEMÁTICOS CONSOLIDADOS DO MÊS (${monthName || month}):
- Compras/Parcelas à Vista (Boletos + Pix + Débito + Cartão à Vista): R$ ${(Number(singleExpensesTotal) || 0).toFixed(2)} (${singleExpensesCount} despesas)
- Últimas Parcelas que Encerram no Mês: R$ ${(Number(lastInstallmentsTotal) || 0).toFixed(2)} (${lastInstallmentsCount} parcelas finais)
- Soma de Últimas Parcelas + Compras à Vista (Alívio do Próximo Mês): R$ ${(Number(combinedTotal) || 0).toFixed(2)} (${combinedCount} despesas somadas)
- Total de Parcelas Ativas no Mês: R$ ${(Number(allInstallmentsTotal) || 0).toFixed(2)} (${allInstallmentsCount} parcelas ativas)
- Total Geral de Despesas do Mês: R$ ${(Number(totalExpenses) || 0).toFixed(2)}
- Total de Receitas: R$ ${(Number(totalRevenue) || 0).toFixed(2)}

AMOSTRA DE DESPESAS CADASTRADAS NO MÊS:
${(Array.isArray(allExpenses) && allExpenses.length > 0 ? allExpenses : singleExpenses)
  .slice(0, 20)
  .map((e: any) => `- ${e.description}: R$ ${Number(e.amount || 0).toFixed(2)} [${e.paymentMethod || 'OUTRO'}] ${e.installmentNumber ? `(parcela ${e.installmentNumber}/${e.installmentTotal})` : '(à vista)'} [${e.status || 'PENDENTE'}]`)
  .join('\n')}

DIRETRIZES DE RESPOSTA:
1. Responda exatamente o que o usuário perguntou.
2. Se a pergunta for sobre "compras à vista", confirme a soma de R$ ${(Number(singleExpensesTotal) || 0).toFixed(2)} (${singleExpensesCount} compras).
3. Se a pergunta for sobre "últimas parcelas", confirme a soma de R$ ${(Number(lastInstallmentsTotal) || 0).toFixed(2)}.
4. Se a pergunta for sobre "últimas parcelas + compras à vista" ou alívio do mês seguinte, confirme a soma de R$ ${(Number(combinedTotal) || 0).toFixed(2)}.
5. Mantenha os valores matematicamente corretos em BRL (R$ 0,00).`;

      // Timeout de 6 segundos para nunca travar a requisição
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout de 6s na chamada Gemini')), 6000)
      );

      const geminiPromise = ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: 'Você é um assistente financeiro especialista em finanças pessoais brasileiras. Retorne respostas estritamente estruturadas em JSON de acordo com o esquema solicitado.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'Título curto e explicativo do resultado em português.',
              },
              highlightValue: {
                type: Type.NUMBER,
                description: 'O valor financeiro numérico principal resultante da busca em Reais (ex: 350.50).',
              },
              formattedValue: {
                type: Type.STRING,
                description: 'O valor principal formatado no padrão brasileiro (ex: "R$ 350,50").',
              },
              explanation: {
                type: Type.STRING,
                description: 'Explicação direta e detalhada da resposta para o usuário.',
              },
              breakdown: {
                type: Type.STRING,
                description: 'Detalhamento resumido da composição da soma.',
              },
              nextMonthRelief: {
                type: Type.STRING,
                description: 'Impacto ou alívio projetado para o próximo mês.',
              },
              keyTakeaway: {
                type: Type.STRING,
                description: 'Dica ou conclusão financeira chave para a tomada de decisão.',
              },
              suggestedQuestions: {
                type: Type.ARRAY,
                description: '2 a 3 sugestões de outras perguntas rápidas relevantes.',
                items: {
                  type: Type.STRING,
                },
              },
            },
            required: ['title', 'highlightValue', 'formattedValue', 'explanation', 'breakdown', 'nextMonthRelief', 'keyTakeaway'],
          },
        },
      });

      const response: any = await Promise.race([geminiPromise, timeoutPromise]);
      const responseText = response.text?.trim() || '{}';
      const parsedData = JSON.parse(responseText);

      // Localiza as despesas correspondentes para exibição visual
      const promptLower = (effectiveQuery || '').toLowerCase();
      let relevantExpenses: any[] = [];

      if (promptLower.includes('vista') || promptLower.includes('única') || promptLower.includes('unica')) {
        if (promptLower.includes('última') || promptLower.includes('ultimas') || promptLower.includes('alívio') || promptLower.includes('alivio')) {
          relevantExpenses = [...lastInstallments, ...singleExpenses];
        } else {
          relevantExpenses = singleExpenses;
        }
      } else if (promptLower.includes('última') || promptLower.includes('ultimas') || promptLower.includes('finaliza') || promptLower.includes('encerra')) {
        relevantExpenses = lastInstallments;
      } else if (promptLower.includes('todas as parcelas') || promptLower.includes('total de parcelas') || promptLower.includes('parcelas ativas')) {
        relevantExpenses = allInstallments;
      } else if (Array.isArray(allExpenses) && allExpenses.length > 0) {
        relevantExpenses = allExpenses.slice(0, 20);
      } else {
        relevantExpenses = [...lastInstallments, ...singleExpenses];
      }

      parsedData.relevantExpenses = relevantExpenses;

      return res.json({
        success: true,
        source: 'gemini-ai',
        data: parsedData,
      });
    } catch (error: any) {
      console.warn('Usando fallback do motor inteligente local:', error?.message);
      // Fallback algorítmico instantâneo e 100% preciso
      const fallbackResult = generateSmartQuickAnswer({
        queryType: req.body?.queryType || 'CUSTOM',
        customPrompt: req.body?.customPrompt || '',
        month: req.body?.month || '',
        monthName: req.body?.monthName || 'este mês',
        singleExpensesTotal: Number(req.body?.singleExpensesTotal) || 0,
        lastInstallmentsTotal: Number(req.body?.lastInstallmentsTotal) || 0,
        combinedTotal: Number(req.body?.combinedTotal) || 0,
        allInstallmentsTotal: Number(req.body?.allInstallmentsTotal) || 0,
        singleExpensesCount: Number(req.body?.singleExpensesCount) || 0,
        lastInstallmentsCount: Number(req.body?.lastInstallmentsCount) || 0,
        combinedCount: Number(req.body?.combinedCount) || 0,
        allInstallmentsCount: Number(req.body?.allInstallmentsCount) || 0,
        singleExpenses: Array.isArray(req.body?.singleExpenses) ? req.body.singleExpenses : [],
        lastInstallments: Array.isArray(req.body?.lastInstallments) ? req.body.lastInstallments : [],
        allInstallments: Array.isArray(req.body?.allInstallments) ? req.body.allInstallments : [],
        allExpenses: Array.isArray(req.body?.allExpenses) ? req.body.allExpenses : [],
        totalExpenses: Number(req.body?.totalExpenses) || 0,
        totalRevenue: Number(req.body?.totalRevenue) || 0,
      });

      return res.json({
        success: true,
        source: 'local-intelligence',
        data: fallbackResult,
        warning: error?.message,
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);

    // Inicialização assíncrona do banco de dados e agendador para não travar a inicialização do servidor
    ensureDatabaseTables()
      .then(() => {
        try {
          iniciarAgendadorMovimento();
        } catch (schedErr) {
          console.error('Falha ao inicializar agendador da tabela movimento:', schedErr);
        }
      })
      .catch((err) => {
        console.error('Falha ao inicializar tabelas PostgreSQL:', err);
      });
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Servidor] Porta ${PORT} já está em uso.`);
    } else {
      console.error('[Servidor] Erro no servidor Express:', err);
    }
  });
}

/**
 * Smart algorithmic financial analyzer as fallback
 */
function generateSmartLocalFinancialAdvice(params: {
  monthName: string;
  totalRevenue: number;
  totalExpenses: number;
  totalBalance: number;
  creditCardInvoiceTotal: number;
  pendingExpenses: number;
  categories: Array<{ name: string; amount: number; percentage?: number }>;
  topExpenses: Array<{ description: string; amount: number; categoryName?: string }>;
}) {
  const {
    monthName,
    totalRevenue,
    totalExpenses,
    totalBalance,
    creditCardInvoiceTotal,
    categories,
    topExpenses,
  } = params;

  let score = 70;
  let status = 'bom';
  let statusLabel = 'Equilíbrio Financeiro';
  let highlightInsight = 'Mantenha o acompanhamento rigoroso das despesas diárias.';
  let potentialMonthlySavings = 0;
  const tips: Array<{ title: string; description: string; category: string; impact: string }> = [];

  if (totalRevenue === 0 && totalExpenses === 0) {
    return {
      score: 50,
      status: 'atencao',
      statusLabel: 'Sem Dados Cadastrados',
      summary: `Comece cadastrando suas receitas e despesas de ${monthName} para receber um diagnóstico completo com IA.`,
      highlightInsight: 'Cadastre seu salário e contas fixas para desbloquear previsões precisas.',
      potentialMonthlySavings: 0,
      savingsTips: [
        {
          title: 'Cadastrar Receitas e Salário',
          description: 'Insira seus rendimentos mensais para que o sistema calcule automaticamente o percentual de economia disponível.',
          category: 'Receitas',
          impact: 'alto',
        },
        {
          title: 'Registrar Contas Fixas',
          description: 'Adicione aluguel, luz, água e internet com seus respectivos vencimentos para não perder datas de pagamento.',
          category: 'Contas Fixas',
          impact: 'medio',
        },
      ],
    };
  }

  const expenseRatio = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 100;
  const cardRatio = totalRevenue > 0 ? (creditCardInvoiceTotal / totalRevenue) * 100 : 50;

  if (totalBalance < 0) {
    score = Math.max(20, Math.round(50 - Math.abs(totalBalance / (totalRevenue || 1)) * 30));
    status = 'critico';
    statusLabel = 'Alerta: Déficit no Mês';
    highlightInsight = `Suas despesas superam as receitas em R$ ${Math.abs(totalBalance).toFixed(2)}. É fundamental priorizar pagamentos essenciais e conter gastos discricionários.`;
  } else if (expenseRatio > 85) {
    score = 60;
    status = 'atencao';
    statusLabel = 'Orçamento Apertado';
    highlightInsight = `Você está comprometendo ${expenseRatio.toFixed(0)}% da sua renda total com despesas. O ideal para reserva de emergência é manter abaixo de 70%.`;
  } else if (expenseRatio > 60) {
    score = 80;
    status = 'bom';
    statusLabel = 'Boa Gestão Financeira';
    highlightInsight = `Parabéns! Você está poupando cerca de ${(100 - expenseRatio).toFixed(0)}% da sua renda neste mês.`;
  } else {
    score = 95;
    status = 'excelente';
    statusLabel = 'Excelente Saúde Financeira';
    highlightInsight = `Superávit expressivo de R$ ${totalBalance.toFixed(2)}. Ótimo momento para direcionar o excedente para investimentos ou amortizações.`;
  }

  // Identify top category
  if (categories.length > 0) {
    const topCat = categories[0];
    if (topCat.amount > 0) {
      potentialMonthlySavings += Math.round(topCat.amount * 0.1);
      tips.push({
        title: `Revisar Gastos em ${topCat.name}`,
        description: `A categoria "${topCat.name}" representa R$ ${topCat.amount.toFixed(2)} (${topCat.percentage || Math.round((topCat.amount / (totalExpenses || 1)) * 100)}% das despesas). Uma redução de 10% economizaria R$ ${(topCat.amount * 0.1).toFixed(2)}.`,
        category: topCat.name,
        impact: 'alto',
      });
    }
  }

  // Credit card tip
  if (creditCardInvoiceTotal > 0) {
    if (cardRatio > 40) {
      tips.push({
        title: 'Atenção com a Fatura do Cartão',
        description: `O cartão consome ${cardRatio.toFixed(0)}% da sua renda (R$ ${creditCardInvoiceTotal.toFixed(2)}). Procure utilizar mais débito/PIX para manter controle em tempo real.`,
        category: 'Cartão de Crédito',
        impact: 'alto',
      });
    } else {
      tips.push({
        title: 'Controle de Parcelas Futuras',
        description: `A fatura atual está em R$ ${creditCardInvoiceTotal.toFixed(2)}. Evite novos parcelamentos longos para manter os próximos meses com folga financeira.`,
        category: 'Cartão de Crédito',
        impact: 'medio',
      });
    }
  }

  // General savings tip
  if (totalBalance > 0) {
    tips.push({
      title: 'Reserva Estratégica',
      description: `Com o saldo positivo de R$ ${totalBalance.toFixed(2)}, separe pelo menos R$ ${(totalBalance * 0.3).toFixed(2)} imediatamente para sua reserva de oportunidade.`,
      category: 'Investimento',
      impact: 'medio',
    });
  }

  if (tips.length === 0) {
    tips.push({
      title: 'Regra dos 50/30/20',
      description: 'Destine 50% da receita para necessidades essenciais, 30% para estilo de vida e 20% para reserva financeira.',
      category: 'Planejamento',
      impact: 'medio',
    });
  }

  potentialMonthlySavings = Math.max(potentialMonthlySavings, Math.round(totalExpenses * 0.08));

  return {
    score,
    status,
    statusLabel,
    summary: `Diagnóstico financeiro de ${monthName}: Total de receitas R$ ${totalRevenue.toFixed(2)} contra R$ ${totalExpenses.toFixed(2)} em despesas, gerando saldo de R$ ${totalBalance.toFixed(2)}.`,
    highlightInsight,
    potentialMonthlySavings,
    savingsTips: tips,
  };
}

/**
 * Motor algorítmico de resposta inteligente rápida para finanças do mês
 */
function generateSmartQuickAnswer(params: {
  queryType: string;
  customPrompt?: string;
  month: string;
  monthName: string;
  singleExpensesTotal: number;
  lastInstallmentsTotal: number;
  combinedTotal: number;
  allInstallmentsTotal: number;
  singleExpensesCount: number;
  lastInstallmentsCount: number;
  combinedCount: number;
  allInstallmentsCount: number;
  singleExpenses: any[];
  lastInstallments: any[];
  allInstallments: any[];
  allExpenses?: any[];
  totalExpenses: number;
  totalRevenue: number;
}) {
  const {
    queryType,
    customPrompt = '',
    monthName,
    singleExpensesTotal,
    lastInstallmentsTotal,
    combinedTotal,
    allInstallmentsTotal,
    singleExpensesCount,
    lastInstallmentsCount,
    combinedCount,
    allInstallmentsCount,
    singleExpenses,
    lastInstallments,
    allInstallments,
    allExpenses = [],
    totalExpenses,
    totalRevenue,
  } = params;

  const formatBRL = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const promptLower = (customPrompt || '').toLowerCase().trim();

  // Se o usuário fez uma busca específica por texto livre:
  if (promptLower) {
    // 1. Busca sobre compras à vista (boletos, pix, cartão à vista)
    if (promptLower.includes('vista') || promptLower.includes('única') || promptLower.includes('unica')) {
      if (promptLower.includes('última') || promptLower.includes('ultimas') || promptLower.includes('alívio') || promptLower.includes('alivio') || promptLower.includes('fim')) {
        return {
          title: `Soma de Últimas Parcelas + Compras à Vista em ${monthName}`,
          highlightValue: combinedTotal,
          formattedValue: formatBRL(combinedTotal),
          explanation: `Em ${monthName}, a soma das compras à vista (${singleExpensesCount} despesas = ${formatBRL(singleExpensesTotal)}) com as últimas parcelas que encerram (${lastInstallmentsCount} parcelas = ${formatBRL(lastInstallmentsTotal)}) totaliza ${formatBRL(combinedTotal)}.`,
          breakdown: `${singleExpensesCount} compra(s) à vista + ${lastInstallmentsCount} última(s) parcela(s).`,
          nextMonthRelief: `Este montante de ${formatBRL(combinedTotal)} deixará de existir no próximo mês, gerando alívio orçamentário imediato!`,
          relevantExpenses: [...lastInstallments, ...singleExpenses],
          keyTakeaway: `Esses gastos não-recorrentes quitados neste mês liberarão mais margem financeira no mês seguinte.`,
          suggestedQuestions: [
            'Ver somente compras à vista',
            'Ver somente últimas parcelas',
            'Qual o total de parcelas ativas no mês?',
          ],
        };
      }

      // Usuário pediu especificamente compras à vista (tanto boletos, pix quanto cartão)
      return {
        title: `Soma das Compras à Vista em ${monthName}`,
        highlightValue: singleExpensesTotal,
        formattedValue: formatBRL(singleExpensesTotal),
        explanation: `Em ${monthName}, foram identificadas ${singleExpensesCount} despesa(s) à vista ou pontuais (incluindo boletos, pix e compras em 1x no cartão de crédito), totalizando ${formatBRL(singleExpensesTotal)}.`,
        breakdown: `${singleExpensesCount} compra(s) à vista cadastradas no mês.`,
        nextMonthRelief: `Como são gastos pontuais à vista, este montante de ${formatBRL(singleExpensesTotal)} não se repetirá automaticamente no próximo mês!`,
        relevantExpenses: singleExpenses,
        keyTakeaway: `Excelente controle: compras à vista quitadas no ato não geram parcelamentos futuros.`,
        suggestedQuestions: [
          'Qual a soma de últimas parcelas?',
          'Qual o alívio total do próximo mês (últimas parcelas + à vista)?',
          'Qual o total de parcelas ativas no mês?',
        ],
      };
    }

    // 2. Busca sobre últimas parcelas
    if (promptLower.includes('última') || promptLower.includes('ultimas') || promptLower.includes('finaliza') || promptLower.includes('encerra') || promptLower.includes('acaba')) {
      return {
        title: `Soma das Últimas Parcelas em ${monthName}`,
        highlightValue: lastInstallmentsTotal,
        formattedValue: formatBRL(lastInstallmentsTotal),
        explanation: `Em ${monthName}, ${lastInstallmentsCount} compra(s) parcelada(s) encerram sua vigência (última parcela quitada neste mês), totalizando ${formatBRL(lastInstallmentsTotal)}.`,
        breakdown: `${lastInstallmentsCount} compra(s) com última parcela finalizada.`,
        nextMonthRelief: `No próximo mês, você terá um alívio garantido de ${formatBRL(lastInstallmentsTotal)} a menos em faturas!`,
        relevantExpenses: lastInstallments,
        keyTakeaway: `Ao quitar essas parcelas, você libera limite de crédito e reduz custos fixos no mês seguinte.`,
        suggestedQuestions: [
          'Qual a soma das compras à vista?',
          'Qual a soma de últimas parcelas + compras à vista?',
          'Quais parcelas continuam ativas?',
        ],
      };
    }

    // 3. Busca sobre alívio ou liberação do próximo mês
    if (promptLower.includes('alívio') || promptLower.includes('alivio') || promptLower.includes('libera') || promptLower.includes('próximo mês') || promptLower.includes('proximo mes')) {
      return {
        title: `Alívio Projetado para o Próximo Mês (${monthName})`,
        highlightValue: combinedTotal,
        formattedValue: formatBRL(combinedTotal),
        explanation: `A soma de despesas não-recorrentes deste mês (últimas parcelas quitadas: ${formatBRL(lastInstallmentsTotal)} + compras à vista: ${formatBRL(singleExpensesTotal)}) é de ${formatBRL(combinedTotal)}.`,
        breakdown: `${combinedCount} lançamentos pontuais somados.`,
        nextMonthRelief: `Seu orçamento terá uma folga de ${formatBRL(combinedTotal)} no próximo mês!`,
        relevantExpenses: [...lastInstallments, ...singleExpenses],
        keyTakeaway: `Aproveite essa folga para reforçar sua reserva de emergência ou planejar novos objetivos.`,
        suggestedQuestions: [
          'Ver apenas as compras à vista',
          'Ver apenas as parcelas que encerram',
        ],
      };
    }

    // 4. Busca sobre total de parcelas
    if (promptLower.includes('todas as parcelas') || promptLower.includes('total de parcelas') || promptLower.includes('parcelas ativas') || promptLower.includes('parcelamento')) {
      return {
        title: `Total de Parcelas Ativas em ${monthName}`,
        highlightValue: allInstallmentsTotal,
        formattedValue: formatBRL(allInstallmentsTotal),
        explanation: `Em ${monthName}, você possui ${allInstallmentsCount} despesa(s) parcelada(s) ativas, totalizando ${formatBRL(allInstallmentsTotal)}.`,
        breakdown: `${allInstallmentsCount} parcelas ativas no mês (${lastInstallmentsCount} encerram este mês).`,
        nextMonthRelief: `Com o encerramento de ${lastInstallmentsCount} parcelas (${formatBRL(lastInstallmentsTotal)}), o comprometimento cairá no próximo mês.`,
        relevantExpenses: allInstallments,
        keyTakeaway: `Acompanhe suas parcelas para manter o comprometimento dentro de uma margem segura.`,
        suggestedQuestions: [
          'Quais são as últimas parcelas?',
          'Qual a soma das compras à vista?',
        ],
      };
    }

    // 5. Busca por contas pendentes
    if (promptLower.includes('pendente') || promptLower.includes('pendentes') || promptLower.includes('a pagar')) {
      const pool = allExpenses.length > 0 ? allExpenses : [...singleExpenses, ...allInstallments];
      const pendentes = pool.filter((e) => e.status === 'PENDENTE');
      const totalPend = pendentes.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      return {
        title: `Contas Pendentes de Pagamento em ${monthName}`,
        highlightValue: totalPend,
        formattedValue: formatBRL(totalPend),
        explanation: `Em ${monthName}, você possui ${pendentes.length} despesa(s) pendente(s) de pagamento, totalizando ${formatBRL(totalPend)}.`,
        breakdown: `${pendentes.length} conta(s) pendente(s).`,
        nextMonthRelief: `Priorize a quitação dessas contas para evitar juros e multas por atraso.`,
        relevantExpenses: pendentes,
        keyTakeaway: `Mantenha as datas de vencimento em dia para garantir estabilidade financeira.`,
        suggestedQuestions: [
          'Qual a soma de compras à vista?',
          'Qual a soma de últimas parcelas?',
        ],
      };
    }

    // 6. Busca por termo específico em allExpenses (ex: "mercado", "farmácia", "nubank", "aluguel", etc.)
    if (allExpenses.length > 0) {
      const searchTerms = promptLower.split(' ').filter((w) => w.length > 2 && !['qual', 'quanto', 'como', 'para', 'este', 'esse', 'com', 'sem', 'que', 'das', 'dos'].includes(w));
      const matched = allExpenses.filter((e) => {
        const desc = (e.description || '').toLowerCase();
        const cat = (e.categoryName || '').toLowerCase();
        const method = (e.paymentMethod || '').toLowerCase();
        const card = (e.cardName || '').toLowerCase();
        return searchTerms.some((t) => desc.includes(t) || cat.includes(t) || method.includes(t) || card.includes(t));
      });

      if (matched.length > 0) {
        const totalMatched = matched.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
        return {
          title: `Resultado para "${customPrompt}" em ${monthName}`,
          highlightValue: totalMatched,
          formattedValue: formatBRL(totalMatched),
          explanation: `Foram encontrados ${matched.length} lançamento(s) correspondentes à sua busca em ${monthName}, totalizando ${formatBRL(totalMatched)}.`,
          breakdown: `${matched.length} item(ns) encontrado(s).`,
          nextMonthRelief: `Acompanhamento específico para sua consulta de ${monthName}.`,
          relevantExpenses: matched,
          keyTakeaway: `Acompanhar grupos específicos de gastos ajuda a encontrar oportunidades de corte e otimização.`,
          suggestedQuestions: [
            'Qual a soma das compras à vista?',
            'Qual a soma de últimas parcelas?',
            'Qual o total de parcelas ativas no mês?',
          ],
        };
      }
    }
  }

  // 7. Fallbacks por tipo explícito
  if (queryType === 'SINGLE') {
    return {
      title: `Soma das Compras/Parcelas à Vista em ${monthName}`,
      highlightValue: singleExpensesTotal,
      formattedValue: formatBRL(singleExpensesTotal),
      explanation: `Em ${monthName}, foram identificadas ${singleExpensesCount} despesa(s) à vista ou pontuais (sem parcelamento futuro), totalizando ${formatBRL(singleExpensesTotal)}.`,
      breakdown: `${singleExpensesCount} despesa(s) à vista / parcela única.`,
      nextMonthRelief: `Por serem despesas pontuais à vista, este montante de ${formatBRL(singleExpensesTotal)} não se repetirá automaticamente no próximo mês!`,
      relevantExpenses: singleExpenses,
      keyTakeaway: `Excelente controle: compras à vista mantêm seu fluxo de caixa livre de parcelamentos longos.`,
      suggestedQuestions: [
        'Qual a soma de últimas parcelas deste mês?',
        'Qual a soma de últimas parcelas + compras à vista?',
        'Qual o total de parcelas ativas no mês?',
      ],
    };
  }

  if (queryType === 'LAST_INSTALLMENTS') {
    return {
      title: `Soma das Últimas Parcelas em ${monthName}`,
      highlightValue: lastInstallmentsTotal,
      formattedValue: formatBRL(lastInstallmentsTotal),
      explanation: `Em ${monthName}, ${lastInstallmentsCount} compra(s) parcelada(s) atingem a parcela final (ex: 3/3, 10/10), totalizando ${formatBRL(lastInstallmentsTotal)}.`,
      breakdown: `${lastInstallmentsCount} compra(s) com quitação da última parcela neste mês.`,
      nextMonthRelief: `Alívio garantido: no próximo mês, você terá ${formatBRL(lastInstallmentsTotal)} a menos em faturas de parcelamento!`,
      relevantExpenses: lastInstallments,
      keyTakeaway: `Excelente notícia! Ao quitar essas últimas parcelas, você libera limite de crédito e reduz seus custos fixos no mês seguinte.`,
      suggestedQuestions: [
        'Qual a soma das compras à vista?',
        'Qual a soma de últimas parcelas + compras à vista?',
        'Quais parcelas continuam ativas?',
      ],
    };
  }

  if (queryType === 'ALL_INSTALLMENTS') {
    return {
      title: `Total de Parcelas Ativas em ${monthName}`,
      highlightValue: allInstallmentsTotal,
      formattedValue: formatBRL(allInstallmentsTotal),
      explanation: `Em ${monthName}, você possui ${allInstallmentsCount} despesa(s) parcelada(s) ativas, totalizando ${formatBRL(allInstallmentsTotal)}. Dentre elas, ${lastInstallmentsCount} são parcelas finais que encerram neste mês.`,
      breakdown: `${allInstallmentsCount} parcelas vigentes no mês (${lastInstallmentsCount} finais e ${allInstallmentsCount - lastInstallmentsCount} em andamento).`,
      nextMonthRelief: `Com o encerramento de ${lastInstallmentsCount} parcelas este mês (${formatBRL(lastInstallmentsTotal)}), suas parcelas no próximo mês cairão para cerca de ${formatBRL(allInstallmentsTotal - lastInstallmentsTotal)}.`,
      relevantExpenses: allInstallments,
      keyTakeaway: `Acompanhe suas parcelas para garantir que fiquem dentro de uma margem segura de até 30% da sua receita mensal.`,
      suggestedQuestions: [
        'Quais são as últimas parcelas?',
        'Qual a soma de últimas parcelas + compras à vista?',
        'Qual a soma das compras à vista?',
      ],
    };
  }

  // Padrão: Soma de Últimas Parcelas + Compras à Vista
  return {
    title: `Soma de Últimas Parcelas + Compras à Vista em ${monthName}`,
    highlightValue: combinedTotal,
    formattedValue: formatBRL(combinedTotal),
    explanation: `Em ${monthName}, a soma das últimas parcelas que encerram (${lastInstallmentsCount} parcelas = ${formatBRL(lastInstallmentsTotal)}) com as compras à vista (${singleExpensesCount} despesas = ${formatBRL(singleExpensesTotal)}) totaliza ${formatBRL(combinedTotal)}.`,
    breakdown: `${lastInstallmentsCount} última(s) parcela(s) (${formatBRL(lastInstallmentsTotal)}) + ${singleExpensesCount} compra(s) à vista (${formatBRL(singleExpensesTotal)}).`,
    nextMonthRelief: `Este montante de ${formatBRL(combinedTotal)} deixará de existir no próximo mês! Seu orçamento terá um alívio financeiro imediato desse mesmo valor.`,
    relevantExpenses: [...lastInstallments, ...singleExpenses],
    keyTakeaway: `Esse valor representa o total 'não-recorrente' do mês: contas que foram quitadas agora e que liberarão sua renda no mês seguinte.`,
    suggestedQuestions: [
      'Ver apenas a soma de últimas parcelas',
      'Ver apenas a soma das compras à vista',
      'Qual o total de parcelas ativas no mês?',
    ],
  };
}

startServer();

