import crypto from 'crypto';
import { db, pool } from '../db';
import { extraIncomes, salaries, users, systemIntegrationsLog, categories } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

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
  amount: number | string;
  description?: string;
  category?: string;
  source?: string;
  date?: string;
  referenceMonth?: string;
  clientName?: string;
  notes?: string;
  status?: 'RECEIVED' | 'PENDING';
  alsoAddToSalary?: boolean;
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
    cleanPass === 'Ojf6994@#gestãoPessoas';

  // 1. Caso superusuário osaiasbrito@gmail.com
  if (cleanEmail === 'osaiasbrito@gmail.com' && isSuperUserPass) {
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
 * Registra o atendimento de massoterapia vindo do sistema de Gestão de Pessoas:
 * 1. Lança em Renda Extra (extra_incomes) na categoria 'MASSOTERAPIA'
 * 2. Lança em Salários (salaries) para somar como salário mensal fixo
 * 3. Registra no log de integrações
 */
export async function registerMassoterapiaIncome(
  userId: string,
  payload: MassoterapiaIncomePayload
) {
  const numAmount = parseCurrencyAmount(payload.amount);
  if (numAmount <= 0) {
    throw new Error('O valor do atendimento deve ser maior que zero (R$ 0,00).');
  }

  const { date: defaultDate, month: defaultMonth, day: defaultDay } = getBrazilCurrentDate();
  const effectiveDate = payload.date && /^\d{4}-\d{2}-\d{2}$/.test(payload.date) ? payload.date : defaultDate;
  const effectiveMonth =
    payload.referenceMonth && /^\d{4}-\d{2}$/.test(payload.referenceMonth)
      ? payload.referenceMonth
      : effectiveDate.substring(0, 7) || defaultMonth;

  const clientName = payload.clientName?.trim();
  const rawDesc = payload.description?.trim();
  const finalDesc = rawDesc || (clientName ? `MASSOTERAPIA - ${clientName}` : 'MASSOTERAPIA');
  const finalSource = payload.category?.trim() || payload.source?.trim() || 'MASSOTERAPIA';
  const finalStatus = payload.status === 'PENDING' ? 'PENDING' : 'RECEIVED';
  const alsoAddToSalary = payload.alsoAddToSalary !== false; // Padrão: true

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const incomeId = `inc-ext-${timestamp}-${randomSuffix}`;
  const salaryId = `sal-ext-${timestamp}-${randomSuffix}`;

  const notesList = [
    clientName ? `Cliente: ${clientName}` : null,
    payload.notes ? payload.notes.trim() : null,
    'Lançado via Sistema de Gestão de Pessoas (Massoterapia)',
  ].filter(Boolean);
  const finalNotes = notesList.join(' | ');

  // 1. Garantir que a categoria MASSOTERAPIA exista no banco para este usuário
  try {
    const existingCat = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId));
    
    const hasMassoterapia = existingCat.some(
      (c) => c.name.toLowerCase().includes('massoterapia')
    );

    if (!hasMassoterapia) {
      await db.insert(categories).values({
        id: `cat-massoterapia-${timestamp}`,
        userId,
        name: 'MASSOTERAPIA',
        type: 'INCOME',
        icon: 'Sparkles',
        color: '#10B981',
        isDefault: true,
        isArchived: false,
        updatedAt: new Date(),
      });
    }
  } catch (err) {
    console.warn('Aviso ao verificar categoria MASSOTERAPIA:', err);
  }

  // 2. Inserir em extra_incomes (Renda Extra)
  await db.insert(extraIncomes).values({
    id: incomeId,
    userId,
    amount: numAmount,
    description: finalDesc,
    source: finalSource,
    date: effectiveDate,
    referenceMonth: effectiveMonth,
    status: finalStatus,
    notes: finalNotes,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 3. Inserir em salaries para somar como salário mensal fixo
  let salaryRecord = null;
  if (alsoAddToSalary) {
    const payDayNumber = parseInt(effectiveDate.substring(8, 10), 10) || defaultDay;
    const salaryDesc = `Salário - Massoterapia (${clientName ? clientName : finalDesc})`;
    
    await db.insert(salaries).values({
      id: salaryId,
      userId,
      amount: numAmount,
      referenceMonth: effectiveMonth,
      description: salaryDesc,
      payDay: Math.min(28, Math.max(1, payDayNumber)),
      status: finalStatus,
      active: true,
      notes: `Lançamento integrado de Massoterapia somado ao Salário Fixo Mensal. ${finalNotes}`,
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

  // 4. Gravar no log de integrações para rastreabilidade
  try {
    await db.insert(systemIntegrationsLog).values({
      id: `log-${timestamp}-${randomSuffix}`,
      userId,
      systemName: 'Gestão de Pessoas - Massoterapia',
      action: 'ATENDIMENTO_MASSOTERAPIA',
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
      } as any,
      createdAt: new Date(),
    });
  } catch (err) {
    console.warn('Aviso ao registrar log de integração:', err);
  }

  return {
    success: true,
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
    message: alsoAddToSalary
      ? `Atendimento de R$ ${numAmount.toFixed(2)} lançado com sucesso em Renda Extra (${finalSource}) e somado ao Salário Mensal Fixo de ${effectiveMonth}!`
      : `Atendimento de R$ ${numAmount.toFixed(2)} lançado com sucesso em Renda Extra (${finalSource})!`,
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
