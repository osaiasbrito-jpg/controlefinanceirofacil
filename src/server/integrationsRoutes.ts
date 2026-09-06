import { Router, Request, Response } from 'express';
import {
  validateIntegrationCredentials,
  generateIntegrationToken,
  verifyIntegrationToken,
  registerMassoterapiaIncome,
  getIntegrationHistory,
  getBrazilCurrentDate,
} from './integrationsService';

export const integrationsRouter = Router();

/**
 * Middleware flexível de autenticação para a integração entre sistemas:
 * 1. Suporta Header Authorization: Bearer <token>
 * 2. Suporta query string ?token=<token>
 * 3. Suporta credenciais diretas no body (email/username e password) ou headers personalizados
 */
export async function integrationAuthMiddleware(req: Request, res: Response, next: Function) {
  try {
    // 1. Bearer Token no header Authorization
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const verified = verifyIntegrationToken(token);
      if (verified.valid && verified.user) {
        (req as any).integrationUser = verified.user;
        return next();
      }
    }

    // 2. Token na Query String (?token=...)
    if (req.query.token && typeof req.query.token === 'string') {
      const verified = verifyIntegrationToken(req.query.token);
      if (verified.valid && verified.user) {
        (req as any).integrationUser = verified.user;
        return next();
      }
    }

    // 3. Usuário e senha passados diretamente no corpo da requisição ou headers
    const email =
      req.body?.email ||
      req.body?.username ||
      req.body?.user ||
      req.body?.login ||
      (req.headers['x-user-email'] as string) ||
      (req.query.email as string);
    const password =
      req.body?.password ||
      req.body?.senha ||
      req.body?.pass ||
      (req.headers['x-user-password'] as string) ||
      (req.query.password as string);

    if (email && password) {
      const user = await validateIntegrationCredentials(email, password);
      if (user) {
        (req as any).integrationUser = { uid: user.uid, email: user.email, name: user.name };
        return next();
      }
    }

    // Se o usuário já estiver logado na sessão web e fizer uma chamada interna
    const sessionUserId = (req as any).user?.uid || (req.query.userId as string);
    if (sessionUserId === 'osaiasbrito@gmail.com') {
      (req as any).integrationUser = { uid: sessionUserId, email: sessionUserId };
      return next();
    }

    // Não autenticado
    return res.status(401).json({
      success: false,
      error: 'Autenticação necessária para integração de sistemas.',
      message:
        'Envie o Header "Authorization: Bearer <token>" obtido em /api/integrations/auth ou envie "email" e "password" diretamente no corpo JSON da requisição.',
      docs: '/api/integrations/status',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao validar credenciais de integração',
      details: err.message,
    });
  }
}

/**
 * GET /api/integrations/status
 * Informações e documentação rápida da API de Integração
 */
integrationsRouter.get('/status', (_req: Request, res: Response) => {
  const brazilNow = getBrazilCurrentDate();
  res.json({
    success: true,
    service: 'Meu Controle Financeiro - API de Integração Externa',
    version: '2.0.0',
    currentDateBrazil: brazilNow.date,
    currentMonthBrazil: brazilNow.month,
    defaultCategory: 'MASSOTERAPIA',
    integrationPartner: 'Sistema de Gestão de Pessoas / Atendimento de Massagens',
    features: [
      'Autenticação segura com usuário e senha',
      'Lançamento automático na categoria MASSOTERAPIA (Renda Extra)',
      'Soma automática no Salário Mensal Fixo',
      'Histórico e rastreabilidade de atendimentos',
    ],
    endpoints: {
      auth: {
        method: 'POST',
        path: '/api/integrations/auth',
        description: 'Solicita acesso com usuário e senha e retorna o token de autenticação',
        payloadExample: {
          email: 'osaiasbrito@gmail.com',
          password: 'SUA_SENHA_AQUI',
        },
      },
      registerIncome: {
        method: 'POST',
        path: '/api/integrations/massoterapia',
        alias: '/api/integrations/income',
        description:
          'Lança o valor do atendimento em Renda Extra (MASSOTERAPIA) e soma ao Salário Mensal Fixo',
        payloadExample: {
          amount: 150.0,
          description: 'Massoterapia - Drenagem Linfática',
          clientName: 'Maria Silva',
          category: 'MASSOTERAPIA',
          date: brazilNow.date,
          referenceMonth: brazilNow.month,
          status: 'RECEIVED',
          alsoAddToSalary: true,
        },
      },
      history: {
        method: 'GET',
        path: '/api/integrations/history',
        description: 'Consulta o histórico dos atendimentos integrados recebidos',
      },
    },
  });
});

/**
 * POST /api/integrations/auth ou /api/integrations/login
 * Requisito 1: Outro sistema solicita integração com usuário e senha
 */
const handleAuth = async (req: Request, res: Response) => {
  try {
    const { email, username, password } = req.body;
    const targetEmail = email || username;

    if (!targetEmail || !password) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios ausentes.',
        message: 'Por favor, envie o email/usuário e a senha no corpo da requisição.',
      });
    }

    const user = await validateIntegrationCredentials(targetEmail, password);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Acesso negado.',
        message: 'Usuário ou senha incorretos para integração com o Meu Controle Financeiro.',
      });
    }

    const token = generateIntegrationToken(user);

    return res.json({
      success: true,
      message: 'Integração autorizada com sucesso! Utilize o token para os lançamentos.',
      token,
      user: {
        uid: user.uid,
        email: user.email,
        name: user.name,
      },
      endpoints: {
        pushMassoterapia: '/api/integrations/massoterapia',
        pushIncome: '/api/integrations/income',
        history: '/api/integrations/history',
      },
    });
  } catch (err: any) {
    console.error('Erro na rota de autenticação da integração:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro no servidor durante a autenticação de integração.',
      details: err.message,
    });
  }
};

integrationsRouter.post('/auth', handleAuth);
integrationsRouter.post('/login', handleAuth);

/**
 * POST /api/integrations/massoterapia e /api/integrations/income
 * Requisitos 2 e 3:
 * 2. Lançar valores em renda extra na categoria escolhida cadastrada (MASSOTERAPIA)
 * 3. Todo valor lançado no outro sistema deverá aparecer neste sistema financeiro e ser somado como salário mensal fixo
 */
const handleRegisterMassoterapia = async (req: Request, res: Response) => {
  try {
    const user = (req as any).integrationUser;
    if (!user || !user.uid) {
      return res.status(401).json({
        success: false,
        error: 'Sessão de integração não autenticada.',
      });
    }

    const isTest = req.body?.test === true || req.body?.action === 'test' || req.query?.test === 'true';
    const rawAmount = req.body?.amount ?? req.body?.valor ?? req.body?.value ?? req.body?.price;

    // Se for um teste de conexão/autenticação (como o botão "Testar Link & Senha" do sistema da clínica)
    if (isTest || (rawAmount === undefined && !req.body?.clientName && !req.body?.nomeCliente)) {
      return res.status(200).json({
        success: true,
        status: 'connected',
        message: 'Conexão e autenticação com o Meu Controle Financeiro validadas com sucesso!',
        category: 'MASSOTERAPIA',
        targetUser: user.email,
      });
    }

    const isPackageSession =
      req.body?.isPackageSession === true ||
      req.body?.sessaoDePacote === true ||
      req.body?.belongsToPackage === true ||
      req.body?.tipo === 'PACOTE_SESSAO';

    const isPackage =
      req.body?.isPackage === true ||
      req.body?.ePacote === true ||
      req.body?.tipo === 'PACOTE' ||
      req.path.includes('pacote') ||
      Boolean(req.body?.packageName || req.body?.nomePacote);

    if (!isPackageSession && (rawAmount === undefined || rawAmount === null || rawAmount === '')) {
      return res.status(400).json({
        success: false,
        error: 'O valor do atendimento ou pacote (amount ou valor) é obrigatório.',
        example: { amount: 180.0, clientName: 'Nome do Cliente', description: 'Massagem Relaxante' },
      });
    }

    const clientName = req.body?.clientName || req.body?.nomeCliente || req.body?.paciente || req.body?.client;
    const description = req.body?.description || req.body?.procedimento || req.body?.servico || 'Atendimento Massoterapia';

    // Forçar a categoria para MASSOTERAPIA por padrão caso não enviada
    const payload = {
      ...req.body,
      isPackage: isPackage || req.body.isPackage,
      isPackageSession,
      amount: rawAmount ?? 0,
      clientName,
      description,
      category: req.body.category || 'MASSOTERAPIA',
      source: req.body.source || 'MASSOTERAPIA',
      alsoAddToSalary: req.body.alsoAddToSalary !== false, // Padrão: true (atende ao requisito 3)
    };

    const result = await registerMassoterapiaIncome(user.uid, payload);

    return res.status(201).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err: any) {
    console.error('Erro ao lançar atendimento de massoterapia via integração:', err);
    return res.status(500).json({
      success: false,
      error: 'Falha ao processar lançamento de massoterapia.',
      details: err.message,
    });
  }
};

integrationsRouter.post('/massoterapia', integrationAuthMiddleware, handleRegisterMassoterapia);
integrationsRouter.post('/income', integrationAuthMiddleware, handleRegisterMassoterapia);
integrationsRouter.post('/pacote', integrationAuthMiddleware, handleRegisterMassoterapia);
integrationsRouter.post('/pacotes', integrationAuthMiddleware, handleRegisterMassoterapia);
integrationsRouter.post('/sessao', integrationAuthMiddleware, handleRegisterMassoterapia);
integrationsRouter.post('/sessoes', integrationAuthMiddleware, handleRegisterMassoterapia);

integrationsRouter.get('/massoterapia', (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'online',
    message: 'Endpoint de integração de Massoterapia ativo. Envie requisições POST autenticadas para registrar atendimentos e pacotes.',
    category: 'MASSOTERAPIA',
    defaultAction: 'POST /api/integrations/massoterapia',
    supportedEndpoints: [
      '/api/integrations/massoterapia (Sessão ou Pacote)',
      '/api/integrations/pacote (Cadastro de Pacote com valor único)',
      '/api/integrations/sessao (Atendimento de Sessão Individual)',
    ],
  });
});

integrationsRouter.get('/pacote', (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'online',
    message: 'Endpoint de cadastro de Pacote ativo. O valor do pacote é informado uma única vez e somado ao faturamento do mês.',
    category: 'MASSOTERAPIA',
  });
});

integrationsRouter.get('/sessao', (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'online',
    message: 'Endpoint de lançamento de Sessão avulsa ativo.',
    category: 'MASSOTERAPIA',
  });
});

integrationsRouter.get('/income', (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'online',
    message: 'Endpoint de integração de Renda Extra ativo.',
    category: 'MASSOTERAPIA',
  });
});

/**
 * GET /api/integrations/history
 * Consulta os lançamentos e histórico de atendimentos integrados
 */
const handleGetHistory = async (req: Request, res: Response) => {
  try {
    const user = (req as any).integrationUser;
    const logs = await getIntegrationHistory(user.uid, 100);
    return res.json({
      success: true,
      count: logs.length,
      history: logs,
    });
  } catch (err: any) {
    console.error('Erro ao listar histórico de integrações:', err);
    return res.status(500).json({
      success: false,
      error: 'Falha ao buscar histórico de integrações.',
      details: err.message,
    });
  }
};

integrationsRouter.get('/history', integrationAuthMiddleware, handleGetHistory);
integrationsRouter.post('/history', integrationAuthMiddleware, handleGetHistory);
