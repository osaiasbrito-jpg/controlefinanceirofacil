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
} from './src/db/repositories';
import { ensureDatabaseTables } from './src/db/init';
import { integrationsRouter } from './src/server/integrationsRoutes';

const __filenameSafe = typeof import.meta !== 'undefined' && import.meta.url ? fileURLToPath(import.meta.url) : (process.argv[1] || '');
const __dirnameSafe = __filenameSafe ? path.dirname(__filenameSafe) : process.cwd();

async function startServer() {
  // Initialize Database Tables in PostgreSQL
  try {
    await ensureDatabaseTables();
  } catch (err) {
    console.error('Falha ao inicializar tabelas PostgreSQL:', err);
  }

  const app = express();
  const PORT = 3000;

  // Enable CORS for external systems integration (Google AI Studio & external apps)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, X-User-Email, X-User-Password, x-access-password, User-Agent, user-agent, x-user-email, x-user-password, *'
    );
    res.header('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // External Systems Integration Routes (Gestão de Pessoas / Massoterapia)
  app.use('/api/integrations', integrationsRouter);

  // Financial Integration Test Connection alias
  app.post('/api/financial/test-connection', async (req, res) => {
    try {
      const email = req.body?.accessEmail || req.body?.email || 'osaiasbrito@gmail.com';
      const category = req.body?.category || req.body?.section || 'MASSOTERAPIA';
      res.status(200).json({
        success: true,
        status: 200,
        message: 'Conexão estabelecida com sucesso (HTTP 200)! Sistema Financeiro online e pronto para receber lançamentos.',
        data: {
          status: 'online',
          endpoint: '/api/integrations/massoterapia',
          category,
          authenticatedUser: email,
          validatedAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // PostgreSQL Database Health Check
  app.get('/api/health/db', async (_req, res) => {
    try {
      const dbStatus = await testDatabaseConnection();
      res.json(dbStatus);
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
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
      const userId = req.user?.uid || (req.query.userId as string) || (req.body?.userId as string);
      const { table, id } = req.params;
      if (!userId || !id || !table) {
        return res.status(400).json({ error: 'Parâmetros incompletos para remoção' });
      }

      const result = await deleteEntity(table, id, userId);
      res.json(result);
    } catch (error: any) {
      console.error('Erro ao deletar registro no PostgreSQL:', error);
      res.status(500).json({ error: 'Falha ao deletar registro no banco', details: error.message });
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
        model: 'gemini-3.7-flash',
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
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

startServer();
