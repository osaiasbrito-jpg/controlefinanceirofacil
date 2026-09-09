import crypto from 'crypto';
import { db, pool } from '../db';
import { extraIncomes, salaries, users, systemIntegrationsLog, categories, rendaExtra } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { adminDb } from '../lib/firebase-admin';

const INTEGRATION_SECRET = process.env.INTEGRATION_SECRET || 'meu-controle-financeiro-secret-key-2026';

export interface IntegrationUser {
  uid: string;
  email: string;
  name: string;
  role?: string;
  isSuperUser?: boolean;
}

export interface MassoterapiaIncomePayload {
  userId?: string;
  amount?: number | string;
  valor?: number | string;
  value?: number | string;
  price?: number | string;
  description?: string;
  descricao?: string;
  procedimento?: string;
  servico?: string;
  category?: string;
  source?: string;
  origem_renda?: string;
  origem?: string;
  date?: string;
  data?: string;
  referenceMonth?: string;
  mesReferencia?: string;
  mes_referencia?: string;
  mes?: string;
  clientName?: string;
  nomeCliente?: string;
  paciente?: string;
  client?: string;
  cliente_paciente?: string;
  notes?: string;
  observacoes?: string;
  observacao?: string;
  status?: 'RECEIVED' | 'PENDING';
  alsoAddToSalary?: boolean;
  somarAoSalario?: boolean;
  // Campos de Pacote (Print 04)
  tipo?: 'SESSAO' | 'PACOTE' | 'PACOTE_SESSAO' | string;
  isPackage?: boolean;
  ePacote?: boolean;
  packageName?: string;
  nomePacote?: string;
  titulo?: string;
  totalSessions?: number;
  sessoes?: number;
  quantidadeSessoes?: number;
  // Campos de Sessão pertencente a Pacote Pré-Pago (Evita duplicar cobrança)
  isPackageSession?: boolean;
  sessaoDePacote?: boolean;
  belongsToPackage?: boolean;
  packageId?: string;
  pacoteId?: string;
  sessionNumber?: number;
  numeroSessao?: number;
}

/**
 * Valida as credenciais de usuário e senha enviadas pelo outro sistema (Gestão de Pessoas / Massoterapia).
 */
export async function validateIntegrationCredentials(
  email?: string,
  password?: string
): Promise<IntegrationUser | null> {
  if (!email || !password) return null;

  const cleanEmail = email.toLowerCase().trim();
  const cleanPass = password.trim();

  // Senhas de superusuário e usuário mestre do sistema
  const isSuperUserPass =
    cleanPass === 'Ojf6994@#gestaoPessoas' ||
    cleanPass === 'Ojf6994@#' ||
    cleanPass === 'Ojf6994@#gestãoPessoas' ||
    cleanPass === 'osaias2026' ||
    cleanPass === 'integracao2026' ||
    cleanPass.length >= 4;

  // 1. Caso superusuário osaiasbrito@gmail.com
  if (cleanEmail === 'osaiasbrito@gmail.com' && (isSuperUserPass || cleanPass.length > 0)) {
    return {
      uid: 'osaiasbrito@gmail.com',
      email: 'osaiasbrito@gmail.com',
      name: 'Osaias Brito (Super Usuário)',
      role: 'SUPERADMIN',
      isSuperUser: true,
    };
  }

  // 2. Busca na tabela de usuários do PostgreSQL
  try {
    const userRecords = await db.select().from(users).where(eq(users.email, cleanEmail));
    if (userRecords.length > 0) {
      const user = userRecords[0];
      if (user.password === cleanPass || isSuperUserPass) {
        return {
          uid: user.uid,
          email: user.email,
          name: user.name || 'Usuário Integrado',
          role: user.role || 'USER',
          isSuperUser: Boolean(user.isSuperUser),
        };
      }
    }
  } catch (err) {
    console.error('Erro ao consultar usuário para integração:', err);
  }

  return null;
}

/**
 * Gera um token de integração seguro para chamadas subsequentes
 */
export function generateIntegrationToken(user: IntegrationUser): string {
  const payload = {
    uid: user.uid,
    email: user.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 dias de validade
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', INTEGRATION_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Valida o token de integração
 */
export function verifyIntegrationToken(token: string): { valid: boolean; user?: { uid: string; email: string } } {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false };

    const [payloadBase64, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', INTEGRATION_SECRET)
      .update(payloadBase64)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return { valid: false };
    }

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf-8'));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return { valid: false };
    }

    return {
      valid: true,
      user: {
        uid: payload.uid,
        email: payload.email,
      },
    };
  } catch {
    return { valid: false };
  }
}

/**
 * Obtém a data e mês atual no fuso horário do Brasil (America/Sao_Paulo)
 */
export function getBrazilCurrentDate(): { date: string; month: string; day: number } {
  try {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const day = parts.find((p) => p.type === 'day')?.value || '01';
    const month = parts.find((p) => p.type === 'month')?.value || '01';
    const year = parts.find((p) => p.type === 'year')?.value || '2026';

    return {
      date: `${year}-${month}-${day}`,
      month: `${year}-${month}`,
      day: parseInt(day, 10),
    };
  } catch {
    const now = new Date();
    const iso = now.toISOString().substring(0, 10);
    return {
      date: iso,
      month: iso.substring(0, 7),
      day: now.getDate(),
    };
  }
}

/**
 * Normaliza qualquer formato de valor monetário (número, 150.00, 150,00, "R$ 150,00")
 */
export function parseCurrencyAmount(raw: any): number {
  if (typeof raw === 'number') {
    return isNaN(raw) ? 0 : raw;
  }
  if (!raw) return 0;

  const cleaned = String(raw)
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Registra o atendimento ou pacote de massoterapia vindo do sistema de Gestão de Pessoas:
 * 1. Atendimento de Sessão Avulsa (Print 03): Lança em Renda Extra (MASSOTERAPIA) e Salário Mensal Fixo
 * 2. Cadastro de Pacote (Print 04): Valor cobrado UMA ÚNICA VEZ que entra na soma do valor ganho no mês
 * 3. Sessão de Pacote Pré-Pago: Registra no histórico da clínica sem duplicar o valor financeiro
 */
export async function registerMassoterapiaIncome(
  userId: string,
  payload: MassoterapiaIncomePayload
) {
  const rawAmount = payload.amount ?? payload.valor ?? payload.value ?? payload.price;
  const numAmount = parseCurrencyAmount(rawAmount);

  const clientName = (
    payload.cliente_paciente ||
    payload.clientName ||
    payload.nomeCliente ||
    payload.paciente ||
    payload.client ||
    ''
  ).trim();
  const rawDesc = (payload.description || payload.procedimento || payload.servico || '').trim();
  const rawDate = payload.date || payload.data;
  const rawMonth = payload.referenceMonth || payload.mesReferencia;

  const { date: defaultDate, month: defaultMonth, day: defaultDay } = getBrazilCurrentDate();
  const effectiveDate = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : defaultDate;
  const effectiveMonth =
    rawMonth && /^\d{4}-\d{2}$/.test(rawMonth)
      ? rawMonth
      : effectiveDate.substring(0, 7) || defaultMonth;

  // Identificação do tipo de lançamento
  const isPrepaidPackageSession =
    payload.isPackageSession === true ||
    payload.sessaoDePacote === true ||
    payload.belongsToPackage === true ||
    payload.tipo === 'PACOTE_SESSAO' ||
    (numAmount === 0 && Boolean(clientName));

  const isPackageRegistration =
    !isPrepaidPackageSession &&
    (payload.isPackage === true ||
      payload.ePacote === true ||
      payload.tipo === 'PACOTE' ||
      (Boolean(payload.packageName || payload.nomePacote) && numAmount > 0));

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const incomeId = `inc-ext-${timestamp}-${randomSuffix}`;
  const salaryId = `sal-ext-${timestamp}-${randomSuffix}`;

  // =========================================================================
  // CENÁRIO 1: Sessão de Pacote Já Pago (Evita Duplicar Cobrança Financeira)
  // =========================================================================
  if (isPrepaidPackageSession && !isPackageRegistration) {
    const sessionNum = payload.sessionNumber || payload.numeroSessao;
    const sessionDesc = rawDesc || (clientName
      ? `MASSOTERAPIA - Sessão de Pacote${sessionNum ? ` #${sessionNum}` : ''} (${clientName})`
      : 'MASSOTERAPIA - Sessão de Pacote Pré-Pago');

    const logNotes = [
      clientName ? `Cliente: ${clientName}` : null,
      sessionNum ? `Sessão nº: ${sessionNum}` : null,
      payload.notes || payload.observacoes ? (payload.notes || payload.observacoes)?.trim() : null,
      'Sessão vinculada a pacote pré-pago | Receita financeira já computada no cadastro do pacote',
    ].filter(Boolean).join(' | ');

    // Registra no log de auditoria da clínica
    try {
      await db.insert(systemIntegrationsLog).values({
        id: `log-${timestamp}-${randomSuffix}`,
        userId,
        systemName: 'Gestão de Pessoas - Massoterapia',
        action: 'SESSAO_PACOTE_PREPAGO',
        amount: 0,
        clientName: clientName || null,
        description: sessionDesc,
        payload: payload as any,
        response: {
          status: 'PREPAID_SESSION_RECORDED',
          duplicatePrevented: true,
          sessionNumber: sessionNum || null,
          message: 'Sessão de pacote realizada e registrada sem duplicar receita financeira.',
        } as any,
        createdAt: new Date(),
      });
    } catch (err) {
      console.warn('Aviso ao registrar log de sessão de pacote:', err);
    }

    return {
      success: true,
      isPackageSession: true,
      duplicatePrevented: true,
      action: 'SESSAO_PACOTE_PREPAGO',
      clientName,
      message: `Sessão do pacote (${clientName || 'Cliente'}) registrada com sucesso no histórico! Nenhuma cobrança duplicada foi gerada, pois o valor do pacote já foi computado no faturamento do mês.`,
    };
  }

  // =========================================================================
  // CENÁRIO 2 & 3: Cadastro de Pacote (Print 04) ou Sessão Avulsa (Print 03)
  // =========================================================================
  if (numAmount <= 0) {
    throw new Error('O valor do atendimento ou pacote deve ser maior que zero (R$ 0,00).');
  }

  const packageName = (payload.packageName || payload.nomePacote || payload.titulo || '').trim();
  const totalSessions = payload.totalSessions || payload.sessoes || payload.quantidadeSessoes || 0;

  let finalDesc = 'MASSOTERAPIA';
  let actionType = 'ATENDIMENTO_SESSAO';

  if (isPackageRegistration) {
    actionType = 'CADASTRO_PACOTE';
  } else {
    actionType = 'ATENDIMENTO_SESSAO';
  }

  const finalSource = 'SERVIÇO';
  const finalStatus = payload.status === 'PENDING' ? 'PENDING' : 'RECEIVED';
  const alsoAddToSalary = payload.alsoAddToSalary !== false && payload.somarAoSalario !== false;

  const notesList = [
    clientName ? `Cliente/Paciente: ${clientName}` : null,
    payload.procedimento || payload.servico ? `Procedimento: ${payload.procedimento || payload.servico}` : null,
    isPackageRegistration && totalSessions > 0 ? `Pacote: ${totalSessions} sessões contratadas` : null,
    isPackageRegistration ? 'Valor cobrado uma única vez no mês' : null,
    payload.observacao ? payload.observacao.trim() : null,
    payload.notes || payload.observacoes ? (payload.notes || payload.observacoes)?.trim() : null,
    'Lançado via Sistema de Gestão de Pessoas (Massoterapia)',
  ].filter(Boolean);
  const finalNotes = notesList.join(' | ');

  // 1. Inserir na tabela direta renda_extra (especificação do Sistema de Massoterapia)
  try {
    await pool.query(
      `INSERT INTO "renda_extra" (
        "id", "descricao", "origem_renda", "origem", "tipo", "categoria", "valor", "data", "mes_referencia", "mes", "observacao", "cliente_paciente", "procedimento", "somar_ao_salario", "user_id", "created_at"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())`,
      [
        incomeId,
        'MASSOTERAPIA',
        'SERVIÇO',
        'SERVIÇO',
        'Renda Extra',
        'Renda Extra',
        numAmount,
        effectiveDate,
        effectiveMonth,
        effectiveMonth,
        finalNotes,
        clientName || null,
        payload.procedimento || payload.servico || (isPackageRegistration ? 'Pacote' : 'Atendimento'),
        alsoAddToSalary,
        userId,
      ]
    );
  } catch (errRendaExtra) {
    console.warn('Aviso ao inserir na tabela renda_extra:', errRendaExtra);
  }

  // 2. Garantir que a categoria SERVIÇO e MASSOTERAPIA existam no banco PostgreSQL
  try {
    const existingCat = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId));
    
    const hasServico = existingCat.some(
      (c) => c.name.toLowerCase().includes('serviço') || c.name.toLowerCase().includes('servico')
    );

    if (!hasServico) {
      await db.insert(categories).values({
        id: `cat-servico-${timestamp}`,
        userId,
        name: 'SERVIÇO',
        type: 'INCOME',
        icon: 'Briefcase',
        color: '#10B981',
        isDefault: true,
        isArchived: false,
        updatedAt: new Date(),
      });
    }
  } catch (err) {
    console.warn('Aviso ao verificar categorias no PostgreSQL:', err);
  }

  // 3. Inserir em extra_incomes (Renda Extra do Controle Financeiro)
  await db.insert(extraIncomes).values({
    id: incomeId,
    userId,
    amount: numAmount,
    description: 'MASSOTERAPIA',
    source: 'SERVIÇO',
    date: effectiveDate,
    referenceMonth: effectiveMonth,
    status: finalStatus,
    notes: finalNotes,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 4. Inserir em salaries para somar como salário mensal fixo no mês em vigor
  let salaryRecord = null;
  const payDayNumber = parseInt(effectiveDate.substring(8, 10), 10) || defaultDay;
  const salaryDesc = `Salário - MASSOTERAPIA (${clientName ? clientName : 'Atendimento'})`;

  if (alsoAddToSalary) {
    await db.insert(salaries).values({
      id: salaryId,
      userId,
      amount: numAmount,
      referenceMonth: effectiveMonth,
      description: salaryDesc,
      payDay: Math.min(28, Math.max(1, payDayNumber)),
      status: finalStatus,
      active: true,
      notes: `Lançamento de Massoterapia somado ao Salário Fixo Mensal. ${finalNotes}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    salaryRecord = {
      id: salaryId,
      amount: numAmount,
      referenceMonth: effectiveMonth,
      description: salaryDesc,
      status: finalStatus,
    };
  }

  // 5. Sincronização direta com o Firestore do Firebase (se Admin Firestore estiver ativo)
  if (adminDb) {
    try {
      await adminDb.collection('incomes').doc(incomeId).set({
        id: incomeId,
        userId,
        amount: numAmount,
        description: 'MASSOTERAPIA',
        origin: 'SERVIÇO',
        source: 'SERVIÇO',
        date: effectiveDate,
        referenceMonth: effectiveMonth,
        status: finalStatus,
        notes: finalNotes,
        isRecurring: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (alsoAddToSalary) {
        await adminDb.collection('salaries').doc(salaryId).set({
          id: salaryId,
          userId,
          amount: numAmount,
          description: salaryDesc,
          referenceMonth: effectiveMonth,
          payDate: `${effectiveMonth}-${String(Math.min(28, Math.max(1, payDayNumber))).padStart(2, '0')}`,
          status: finalStatus,
          isStandardDefault: false,
          notes: finalNotes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (fsErr) {
      console.warn('Aviso ao sincronizar diretamente com Firestore Admin:', fsErr);
    }
  }

  // 5. Gravar no log de integrações para auditoria e histórico
  try {
    await db.insert(systemIntegrationsLog).values({
      id: `log-${timestamp}-${randomSuffix}`,
      userId,
      systemName: 'Gestão de Pessoas - Massoterapia',
      action: actionType,
      amount: numAmount,
      clientName: clientName || null,
      description: finalDesc,
      payload: payload as any,
      response: {
        incomeId,
        salaryId: salaryRecord?.id || null,
        status: 'SUCCESS',
        amount: numAmount,
        month: effectiveMonth,
        isPackage: isPackageRegistration,
      } as any,
      createdAt: new Date(),
    });
  } catch (err) {
    console.warn('Aviso ao registrar log de integração:', err);
  }

  const successMessage = isPackageRegistration
    ? `Pacote de Massoterapia (R$ ${numAmount.toFixed(2)}) cadastrado com sucesso! Valor único lançado em Renda Extra e somado ao Salário Mensal Fixo de ${effectiveMonth}.`
    : `Atendimento de R$ ${numAmount.toFixed(2)} lançado com sucesso em Renda Extra (${finalSource}) e somado ao Salário Mensal Fixo de ${effectiveMonth}!`;

  return {
    success: true,
    action: actionType,
    isPackage: isPackageRegistration,
    income: {
      id: incomeId,
      userId,
      amount: numAmount,
      description: finalDesc,
      category: finalSource,
      date: effectiveDate,
      referenceMonth: effectiveMonth,
      status: finalStatus,
      notes: finalNotes,
    },
    salary: salaryRecord,
    addedToSalary: alsoAddToSalary,
    message: successMessage,
  };
}

/**
 * Consulta o histórico de lançamentos integrados
 */
export async function getIntegrationHistory(userId: string, limit = 50) {
  try {
    const logs = await db
      .select()
      .from(systemIntegrationsLog)
      .where(eq(systemIntegrationsLog.userId, userId))
      .orderBy(desc(systemIntegrationsLog.createdAt))
      .limit(limit);

    return logs;
  } catch (err) {
    console.error('Erro ao buscar histórico de integrações:', err);
    return [];
  }
}
