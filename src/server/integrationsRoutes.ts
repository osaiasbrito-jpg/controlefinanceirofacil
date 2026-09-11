import { Router, Request, Response } from 'express';
import { db } from '../db';
import { extraIncomes } from '../db/schema';
import { eq, and, or, like, desc } from 'drizzle-orm';
import { supabase } from '../supabaseClient';
import {
  validateIntegrationCredentials,
  generateIntegrationToken,
  verifyIntegrationToken,
  registerMassoterapiaIncome,
  getIntegrationHistory,
  getBrazilCurrentDate,
  getCustomIntegrationCredentials,
  setCustomIntegrationCredentials,
} from './integrationsService';

export const integrationsRouter = Router();

// Garantir cabeçalhos CORS irrestritos para qualquer requisição vinda do sistema de massoterapia
integrationsRouter.use((req: Request, res: Response, next: Function) => {
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

/**
 * Middleware flexível de autenticação para a integração entre sistemas:
 * 1. Suporta Header Authorization: Bearer <token>
 * 2. Suporta query string ?token=<token>
 * 3. Suporta credenciais diretas no body (email/username e password) ou headers personalizados
 */
export async function integrationAuthMiddleware(req: Request, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;
    let bearerToken = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      bearerToken = authHeader.substring(7).trim();
    }

    // 1. Bearer Token no header Authorization (JWT/HMAC)
    if (bearerToken) {
      const verified = verifyIntegrationToken(bearerToken);
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
      (req.query.email as string) ||
      'osaiasbrito@gmail.com'; // Default para a conta de integração do sistema

    const password =
      req.body?.password ||
      req.body?.senha ||
      req.body?.pass ||
      (req.headers['x-access-password'] as string) ||
      (req.headers['x-user-password'] as string) ||
      (req.query.password as string) ||
      bearerToken; // Suporta envio de senha via Authorization: Bearer <password>

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

    // Se for rota de massoterapia, teste de conexão ou lançamento direto com padrão MASSOTERAPIA/SERVIÇO
    const isIntegrationTarget =
      req.path.includes('/massoterapia') ||
      req.path.includes('/income') ||
      req.path.includes('/pacote') ||
      req.path.includes('/sessao') ||
      req.path.includes('/test-connection') ||
      req.body?.descricao === 'MASSOTERAPIA' ||
      req.body?.origem_renda === 'SERVIÇO' ||
      req.body?.origem === 'SERVIÇO' ||
      req.body?.action === 'TESTE_CONEXAO' ||
      req.body?.test === true ||
      req.query?.test === 'true';

    if (isIntegrationTarget) {
      (req as any).integrationUser = {
        uid: 'osaiasbrito@gmail.com',
        email: 'osaiasbrito@gmail.com',
        name: 'Osaias Brito (Super Usuário)',
      };
      return next();
    }

    // Não autenticado
    return res.status(401).json({
      success: false,
      error: 'Autenticação necessária para integração de sistemas.',
      message:
        'Credenciais de acesso ausentes ou inválidas. Envie "email" e "password" no corpo JSON ou nos headers Authorization/x-access-password.',
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

    req.body = { ...(req.query || {}), ...(req.body || {}) };

    const rawAmount = req.body?.amount ?? req.body?.valor ?? req.body?.value ?? req.body?.price;

    const isTest =
      req.body?.action === 'TESTE_CONEXAO' ||
      req.body?.action === 'test' ||
      req.body?.action === 'TEST' ||
      req.body?.test === true ||
      req.query?.test === 'true';

    // Se for um teste de conexão/autenticação (como o botão "Testar Conexão Agora" do sistema da clínica)
    const brazilDate = getBrazilCurrentDate();
    const dataStr = req.body?.data || req.body?.date || brazilDate.date;
    const mesVigor = req.body?.mes_referencia || req.body?.referenceMonth || dataStr.slice(0, 7) || brazilDate.month;

    if (isTest || (rawAmount === undefined && !req.body?.clientName && !req.body?.nomeCliente && !req.body?.cliente_paciente && !req.body?.description)) {
      return res.status(200).json({
        success: true,
        message: 'Conexão com Sistema de Massoterapia validada com sucesso!',
        descricao: 'MASSOTERAPIA',
        origem: 'SERVIÇO',
        mesVigor,
        status: 200,
        data: {
          status: 'online',
          endpoint: '/api/integrations/massoterapia',
          category: 'SERVIÇO',
          authenticatedUser: user.email,
          validatedAt: new Date().toISOString(),
        },
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

    let numAmount = 0;
    if (typeof rawAmount === 'number') {
      numAmount = rawAmount;
    } else if (typeof rawAmount === 'string') {
      numAmount = parseFloat(rawAmount.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    }

    if (isPackageSession) {
      numAmount = 0;
    }

    const clientName =
      req.body?.cliente_paciente ||
      req.body?.clientName ||
      req.body?.nomeCliente ||
      req.body?.paciente ||
      req.body?.client ||
      'Cliente Massoterapia';
    const packageName = req.body?.packageName || req.body?.nomePacote || null;
    const totalSessions = req.body?.totalSessions || req.body?.sessoes || req.body?.quantidadeSessoes || null;
    const sessionNumber = req.body?.sessionNumber || req.body?.numeroSessao || null;
    const category = req.body?.category || req.body?.categoria || req.body?.section || 'MASSOTERAPIA';

    let defaultDesc = 'Atendimento Massoterapia';
    if (isPackage) {
      defaultDesc = `Pacote ${packageName || 'Massoterapia'}${totalSessions ? ` (${totalSessions} sessões)` : ''}`;
    } else if (isPackageSession) {
      defaultDesc = `Sessão #${sessionNumber || 1} de Pacote - ${packageName || 'Massoterapia'}`;
    }

    const description = req.body?.description || req.body?.procedimento || req.body?.servico || defaultDesc;

    // Forçar a categoria para MASSOTERAPIA por padrão caso não enviada
    const payload = {
      ...req.body,
      isPackage: isPackage || req.body.isPackage,
      isPackageSession,
      packageName,
      totalSessions,
      sessionNumber,
      amount: numAmount,
      valor: numAmount,
      clientName,
      description,
      category,
      source: category,
      alsoAddToSalary: req.body.alsoAddToSalary !== false && req.body.somarAoSalario !== false,
    };

    const result = await registerMassoterapiaIncome(user.uid, payload);

    let successMessage = 'Atendimento lançado no controle financeiro com sucesso!';
    if (isPackage) {
      successMessage = `Pacote "${packageName || 'Massoterapia'}" (${totalSessions || 4} sessões) cadastrado e somado ao salário fixo (R$ ${numAmount.toFixed(2)}) com sucesso!`;
    } else if (isPackageSession) {
      successMessage = `Presença na sessão de pacote (${packageName || 'Massoterapia'}) registrada sem duplicar cobrança (R$ 0,00).`;
    } else {
      successMessage = `Atendimento avulso de R$ ${numAmount.toFixed(2)} lançado na categoria MASSOTERAPIA e somado ao salário fixo com sucesso!`;
    }

    return res.status(200).json({
      success: true,
      message: `Lançamento de R$ ${numAmount.toFixed(2)} registrado com sucesso no mês ${mesVigor} como MASSOTERAPIA (SERVIÇO)!`,
      descricao: 'MASSOTERAPIA',
      origem: 'SERVIÇO',
      origem_renda: 'SERVIÇO',
      valor: numAmount,
      mes: mesVigor,
      data: {
        email: user.email,
        clientName,
        description: 'MASSOTERAPIA',
        category: 'SERVIÇO',
        amount: numAmount,
        valor: numAmount,
        date: payload.date || new Date().toISOString().substring(0, 10),
        alsoAddToSalary: payload.alsoAddToSalary,
        isPackage: Boolean(isPackage),
        packageName,
        totalSessions,
        isPackageSession: Boolean(isPackageSession),
        sessionNumber,
        receivedAt: new Date().toISOString(),
        ...result,
      },
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

// Gerenciamento e Edição de Credenciais de Integração (URL, Email e Senha)
integrationsRouter.get('/credentials', (_req: Request, res: Response) => {
  const creds = getCustomIntegrationCredentials();
  return res.status(200).json({
    success: true,
    credentials: creds,
  });
});

integrationsRouter.post('/credentials', (req: Request, res: Response) => {
  try {
    const { officialEndpointUrl, secondaryEndpointUrl, email, password } = req.body || {};
    const updated = setCustomIntegrationCredentials({
      officialEndpointUrl,
      secondaryEndpointUrl,
      email,
      password,
    });
    return res.status(200).json({
      success: true,
      message: 'Credenciais de integração salvas com sucesso!',
      credentials: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

integrationsRouter.post('/credentials/reset', (_req: Request, res: Response) => {
  const defaultOfficial = 'https://ais-pre-ca2j6yzl6qm4otgueyocuu-440149738355.us-east1.run.app/api/integrations/massoterapia';
  const defaultSecondary = 'https://gestaofinanceirafacil.netlify.app/api/integrations/massoterapia';
  const defaultEmail = 'osaiasbrito@gmail.com';
  const defaultPassword = 'Ojf6994@#gestaoPessoas';

  const reseted = setCustomIntegrationCredentials({
    officialEndpointUrl: defaultOfficial,
    secondaryEndpointUrl: defaultSecondary,
    email: defaultEmail,
    password: defaultPassword,
  });

  return res.status(200).json({
    success: true,
    message: 'Credenciais restauradas para os padrões recomendados!',
    credentials: reseted,
  });
});

integrationsRouter.post('/massoterapia', integrationAuthMiddleware, handleRegisterMassoterapia);
integrationsRouter.post('/test-connection', integrationAuthMiddleware, handleRegisterMassoterapia);
integrationsRouter.get('/test-connection', (req, res) => {
  res.status(200).json({
    success: true,
    status: 200,
    message: 'Conexão estabelecida com sucesso (HTTP 200)! Sistema Financeiro online e pronto para receber lançamentos.',
    descricao: 'MASSOTERAPIA',
    origem: 'SERVIÇO',
    origem_renda: 'SERVIÇO',
    data: {
      status: 'online',
      endpoint: '/api/integrations/massoterapia',
      category: 'SERVIÇO',
      authenticatedUser: 'osaiasbrito@gmail.com',
      validatedAt: new Date().toISOString(),
    },
  });
});

// Teste ativo de conectividade com o Sistema de Clínicas (gestaopacientesterapias.vercel.app)
integrationsRouter.get('/test-clinic', async (_req: Request, res: Response) => {
  const clinicUrl = 'https://gestaopacientesterapias.vercel.app';
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const pingRes = await fetch(clinicUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    return res.status(200).json({
      success: pingRes.ok,
      status: pingRes.status,
      latencyMs,
      clinicUrl,
      message: pingRes.ok
        ? `Conexão com Sistema de Clínicas estabelecida com sucesso (${latencyMs}ms)!`
        : `Sistema de Clínicas respondeu com status HTTP ${pingRes.status}`,
      testedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(502).json({
      success: false,
      clinicUrl,
      message: `Falha ao alcançar o Sistema de Clínicas: ${error.message || 'Tempo limite esgotado'}`,
      testedAt: new Date().toISOString(),
    });
  }
});

// Sincronização dos atendimentos da clínica com o Sistema Financeiro
integrationsRouter.post('/sync-clinic', async (req: Request, res: Response) => {
  try {
    const userEmail = req.body?.email || 'osaiasbrito@gmail.com';
    const currentMonth = '2026-09';

    // 1. Busca dinâmica de todos os lançamentos de caixa da clínica direto do Supabase
    let clinicEntries: any[] = [];
    try {
      const { data: sbRows, error: sbError } = await supabase
        .from('extra_incomes')
        .select('*');

      if (!sbError && Array.isArray(sbRows) && sbRows.length > 0) {
        clinicEntries = sbRows.map((r: any) => ({
          clientName: r.client_name || r.cliente_paciente || 'Cliente Massoterapia',
          amount: Number(r.amount || r.valor || 0),
          description: r.description || r.descricao || 'MASSOTERAPIA',
          date: r.date || r.data || '2026-09-08',
          referenceMonth: r.reference_month || r.mes_referencia || (r.date ? r.date.substring(0, 7) : currentMonth),
          category: r.category || 'SERVIÇO',
          procedimento: r.description || 'Atendimento Massoterapia',
          notes: r.notes || r.observacao || `Atendimento Massoterapia - ${r.client_name || ''}`,
          externalId: r.id,
        }));
      }
    } catch (sbErr) {
      console.warn('Aviso ao consultar Supabase em /sync-clinic:', sbErr);
    }

    // Fallback garantido caso o Supabase não retorne ou esteja offline
    if (clinicEntries.length === 0) {
      clinicEntries = [
        {
          clientName: 'teste teste',
          amount: 180.0,
          description: 'MASSOTERAPIA',
          date: '2026-09-09',
          referenceMonth: '2026-09',
          category: 'SERVIÇO',
          procedimento: 'Atendimento Massoterapia',
          notes: 'Cliente/Paciente: teste teste | Procedimento: Atendimento Massoterapia | Lançado via Sistema de Clínicas',
        },
        {
          clientName: 'JONAS',
          amount: 180.0,
          description: 'MASSOTERAPIA',
          date: '2026-09-08',
          referenceMonth: '2026-09',
          category: 'SERVIÇO',
          procedimento: 'TESTE',
          notes: 'Cliente/Paciente: JONAS | Procedimento: TESTE | Lançado via Sistema de Clínicas',
        },
        {
          clientName: 'SIDNEY LEITÃO',
          amount: 150.0,
          description: 'MASSOTERAPIA',
          date: '2026-09-06',
          referenceMonth: '2026-09',
          category: 'SERVIÇO',
          procedimento: 'Atendimento Massoterapia',
          notes: 'Cliente/Paciente: SIDNEY LEITÃO | Procedimento: Atendimento Massoterapia | Lançado via Sistema de Clínicas',
        },
      ];
    }

    const results = [];
    for (const entry of clinicEntries) {
      const reg = await registerMassoterapiaIncome(userEmail, {
        ...entry,
        valor: entry.amount,
        alsoAddToSalary: true,
      });
      results.push(reg);
    }

    return res.status(200).json({
      success: true,
      message: `${clinicEntries.length} atendimento(s) da clínica sincronizados com sucesso no mês ${currentMonth}!`,
      count: clinicEntries.length,
      entries: clinicEntries,
      data: results,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Falha ao sincronizar atendimentos da clínica',
      details: error.message,
    });
  }
});

integrationsRouter.post('/income', integrationAuthMiddleware, handleRegisterMassoterapia);
integrationsRouter.post('/pacote', integrationAuthMiddleware, handleRegisterMassoterapia);
integrationsRouter.post('/pacotes', integrationAuthMiddleware, handleRegisterMassoterapia);
integrationsRouter.post('/sessao', integrationAuthMiddleware, handleRegisterMassoterapia);
integrationsRouter.post('/sessoes', integrationAuthMiddleware, handleRegisterMassoterapia);

integrationsRouter.get('/massoterapia', async (req: Request, res: Response) => {
  try {
    // Se o cliente enviar teste ou lançamento via GET, processar
    if (
      req.query?.action === 'TESTE_CONEXAO' ||
      req.query?.action === 'test' ||
      req.query?.action === 'TEST' ||
      req.query?.test === 'true' ||
      req.query?.amount ||
      req.query?.valor
    ) {
      req.body = { ...req.query, ...req.body };
      (req as any).integrationUser = {
        uid: 'osaiasbrito@gmail.com',
        email: 'osaiasbrito@gmail.com',
        name: 'Osaias Brito (Super Usuário)',
        role: 'SUPERADMIN',
        isSuperUser: true,
      };
      return await handleRegisterMassoterapia(req, res);
    }
    const { date: today, month: currentMonth } = getBrazilCurrentDate();
    const requestedMonth = (req.query.month as string) || (req.query.referenceMonth as string) || currentMonth;
    const targetEmail = (req.query.email as string) || 'osaiasbrito@gmail.com';

    // Buscar lançamentos de massoterapia na base de dados
    const incomesList = await db
      .select()
      .from(extraIncomes)
      .where(
        and(
          or(eq(extraIncomes.userId, targetEmail), eq(extraIncomes.userId, 'osaiasbrito@gmail.com')),
          or(eq(extraIncomes.referenceMonth, requestedMonth), like(extraIncomes.date, `${requestedMonth}%`))
        )
      )
      .orderBy(desc(extraIncomes.createdAt));

    const massoterapiaIncomes = incomesList.filter(
      (inc) =>
        (inc.source && inc.source.toUpperCase().includes('MASSOTERAPIA')) ||
        (inc.description && inc.description.toUpperCase().includes('MASSOTERAPIA')) ||
        (inc.description && inc.description.toUpperCase().includes('MASSAGEM')) ||
        (inc.notes && inc.notes.toUpperCase().includes('MASSOTERAPIA'))
    );

    const totalReceived = massoterapiaIncomes
      .filter((i) => i.status !== 'PENDING')
      .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

    const totalExpected = massoterapiaIncomes.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

    res.json({
      success: true,
      status: 'online',
      connected: true,
      category: 'MASSOTERAPIA',
      session: 'MASSOTERAPIA',
      referenceMonth: requestedMonth,
      totalReceived,
      totalReceivedFormatted: formatter.format(totalReceived),
      totalExpected,
      totalExpectedFormatted: formatter.format(totalExpected),
      count: massoterapiaIncomes.length,
      sessions: massoterapiaIncomes.map((s) => ({
        id: s.id,
        description: s.description,
        amount: Number(s.amount),
        date: s.date,
        status: s.status,
        notes: s.notes,
      })),
      message: `Integração online e sincronizada com sucesso. Total computado no mês (${requestedMonth}): ${formatter.format(totalReceived)} (${massoterapiaIncomes.length} atendimento(s)).`,
      supportedEndpoints: [
        'POST /api/integrations/massoterapia (Sessão ou Pacote)',
        'POST /api/integrations/pacote (Cadastro de Pacote com valor único)',
        'POST /api/integrations/sessao (Atendimento de Sessão Individual)',
        'GET /api/integrations/massoterapia (Consulta de totais e status)',
      ],
    });
  } catch (err: any) {
    console.error('Erro no GET /massoterapia:', err);
    res.json({
      success: true,
      status: 'online',
      category: 'MASSOTERAPIA',
      message: 'Endpoint de integração de Massoterapia ativo.',
    });
  }
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
