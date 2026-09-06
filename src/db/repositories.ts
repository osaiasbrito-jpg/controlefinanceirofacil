import { db } from './index';
import {
  users,
  userSettings,
  salaries,
  extraIncomes,
  expenses,
  creditCards,
  customPaymentMethods,
  installmentPurchases,
  categories,
  budgets,
  backups,
} from './schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { ensureDatabaseTables } from './init';

export interface SyncDataPayload {
  userId: string;
  salaries?: any[];
  incomes?: any[];
  expenses?: any[];
  creditCards?: any[];
  paymentMethods?: any[];
  installmentPurchases?: any[];
  categories?: any[];
  budgets?: any[];
  settings?: any;
}

// User Profile Operations
export async function getOrCreateUser(uid: string, email: string, name?: string, photoUrl?: string) {
  const isSuperAdmin = email?.toLowerCase() === 'osaiasbrito@gmail.com';
  const role = isSuperAdmin ? 'SUPERADMIN' : 'USER';
  const isSuperUser = isSuperAdmin;

  const fallbackUser = {
    id: 1,
    uid,
    email: email || 'usuario@meucontrole.app',
    name: name || (isSuperAdmin ? 'Osaias Brito (Super Usuário)' : 'Usuário'),
    photoUrl: photoUrl || '',
    role,
    isSuperUser,
    password: isSuperAdmin ? 'Ojf6994@#gestaoPessoas' : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email: email || 'usuario@meucontrole.app',
        name: name || (isSuperAdmin ? 'Osaias Brito (Super Usuário)' : ''),
        photoUrl: photoUrl || '',
        role,
        isSuperUser,
        password: isSuperAdmin ? 'Ojf6994@#gestaoPessoas' : null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: email || 'usuario@meucontrole.app',
          name: name || (isSuperAdmin ? 'Osaias Brito (Super Usuário)' : undefined),
          photoUrl: photoUrl || undefined,
          ...(isSuperAdmin ? { role: 'SUPERADMIN', isSuperUser: true, password: 'Ojf6994@#gestaoPessoas' } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0] || fallbackUser;
  } catch (error: any) {
    console.warn('Tentando inicializar tabelas e reexecutar getOrCreateUser...', error?.message);
    try {
      await ensureDatabaseTables();
      const retryResult = await db
        .insert(users)
        .values({
          uid,
          email: email || 'usuario@meucontrole.app',
          name: name || (isSuperAdmin ? 'Osaias Brito (Super Usuário)' : ''),
          photoUrl: photoUrl || '',
          role,
          isSuperUser,
          password: isSuperAdmin ? 'Ojf6994@#gestaoPessoas' : null,
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: {
            email: email || 'usuario@meucontrole.app',
            name: name || (isSuperAdmin ? 'Osaias Brito (Super Usuário)' : undefined),
            photoUrl: photoUrl || undefined,
            ...(isSuperAdmin ? { role: 'SUPERADMIN', isSuperUser: true, password: 'Ojf6994@#gestaoPessoas' } : {}),
            updatedAt: new Date(),
          },
        })
        .returning();
      return retryResult[0] || fallbackUser;
    } catch (retryErr) {
      console.error('Database query failed for getOrCreateUser on retry:', retryErr);
      return fallbackUser;
    }
  }
}

// User Settings Operations
export async function getUserSettings(userId: string) {
  try {
    const res = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return res[0] || null;
  } catch (error) {
    console.error('Database query failed for getUserSettings:', error);
    throw new Error('Falha ao obter configurações no PostgreSQL', { cause: error });
  }
}

export async function upsertUserSettings(userId: string, data: any) {
  try {
    const res = await db
      .insert(userSettings)
      .values({
        userId,
        theme: data.theme || 'system',
        currency: data.currency || 'BRL',
        hideValuesByDefault: Boolean(data.hideValuesByDefault),
        enableNotifications: data.enableNotifications !== undefined ? Boolean(data.enableNotifications) : true,
        dueDayAlertDays: Number(data.dueDayAlertDays) || 3,
        aiAdviceEnabled: data.aiAdviceEnabled !== undefined ? Boolean(data.aiAdviceEnabled) : true,
        monthlyIncomeTarget: Number(data.monthlyIncomeTarget) || 0,
        monthlySavingsTarget: Number(data.monthlySavingsTarget) || 0,
        currentSelectedMonth: data.currentSelectedMonth || null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          theme: data.theme,
          currency: data.currency,
          hideValuesByDefault: data.hideValuesByDefault,
          enableNotifications: data.enableNotifications,
          dueDayAlertDays: data.dueDayAlertDays,
          aiAdviceEnabled: data.aiAdviceEnabled,
          monthlyIncomeTarget: data.monthlyIncomeTarget,
          monthlySavingsTarget: data.monthlySavingsTarget,
          currentSelectedMonth: data.currentSelectedMonth,
          updatedAt: new Date(),
        },
      })
      .returning();
    return res[0];
  } catch (error) {
    console.error('Database query failed for upsertUserSettings:', error);
    throw new Error('Falha ao atualizar configurações no PostgreSQL', { cause: error });
  }
}

// Full Financial Data Fetch for User
export async function getFullUserData(userId: string) {
  try {
    const [
      userSalaries,
      userIncomes,
      userExpenses,
      userCards,
      userMethods,
      userInstallments,
      userCategories,
      userBudgets,
      settings,
    ] = await Promise.all([
      db.select().from(salaries).where(eq(salaries.userId, userId)),
      db.select().from(extraIncomes).where(eq(extraIncomes.userId, userId)),
      db.select().from(expenses).where(eq(expenses.userId, userId)),
      db.select().from(creditCards).where(eq(creditCards.userId, userId)),
      db.select().from(customPaymentMethods).where(eq(customPaymentMethods.userId, userId)),
      db.select().from(installmentPurchases).where(eq(installmentPurchases.userId, userId)),
      db.select().from(categories).where(eq(categories.userId, userId)),
      db.select().from(budgets).where(eq(budgets.userId, userId)),
      getUserSettings(userId),
    ]);

    return {
      salaries: userSalaries,
      incomes: userIncomes,
      expenses: userExpenses,
      creditCards: userCards,
      paymentMethods: userMethods,
      installmentPurchases: userInstallments,
      categories: userCategories,
      budgets: userBudgets,
      settings,
    };
  } catch (error) {
    console.error('Database query failed for getFullUserData:', error);
    throw new Error('Falha ao carregar dados do PostgreSQL', { cause: error });
  }
}

// Bulk Sync/Save from Client to PostgreSQL
export async function syncUserData(payload: SyncDataPayload) {
  const { userId } = payload;
  if (!userId) throw new Error('userId obrigatório');

  try {
    // 1. Categories
    if (payload.categories && Array.isArray(payload.categories)) {
      for (const cat of payload.categories) {
        if (!cat.id) continue;
        await db
          .insert(categories)
          .values({
            id: String(cat.id),
            userId,
            name: cat.name,
            type: cat.type || 'EXPENSE',
            icon: cat.icon || null,
            color: cat.color || null,
            isDefault: Boolean(cat.isDefault),
            isArchived: Boolean(cat.isArchived),
            monthlyLimit: cat.monthlyLimit !== undefined ? Number(cat.monthlyLimit) : null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: categories.id,
            set: {
              name: cat.name,
              type: cat.type || 'EXPENSE',
              icon: cat.icon || null,
              color: cat.color || null,
              isDefault: Boolean(cat.isDefault),
              isArchived: Boolean(cat.isArchived),
              monthlyLimit: cat.monthlyLimit !== undefined ? Number(cat.monthlyLimit) : null,
              updatedAt: new Date(),
            },
          });
      }
    }

    // 2. Budgets
    if (payload.budgets && Array.isArray(payload.budgets)) {
      for (const b of payload.budgets) {
        if (!b.id) continue;
        await db
          .insert(budgets)
          .values({
            id: String(b.id),
            userId,
            categoryId: String(b.categoryId),
            categoryName: b.categoryName,
            monthlyLimit: Number(b.monthlyLimit) || 0,
            referenceMonth: b.referenceMonth || 'GLOBAL',
            alertThresholdPercentage: Number(b.alertThresholdPercentage) || 80,
            notes: b.notes || null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: budgets.id,
            set: {
              categoryName: b.categoryName,
              monthlyLimit: Number(b.monthlyLimit) || 0,
              referenceMonth: b.referenceMonth || 'GLOBAL',
              alertThresholdPercentage: Number(b.alertThresholdPercentage) || 80,
              notes: b.notes || null,
              updatedAt: new Date(),
            },
          });
      }
    }

    // 3. Salaries
    if (payload.salaries && Array.isArray(payload.salaries)) {
      for (const sal of payload.salaries) {
        if (!sal.id) continue;
        await db
          .insert(salaries)
          .values({
            id: String(sal.id),
            userId,
            amount: Number(sal.amount) || 0,
            referenceMonth: String(sal.referenceMonth || 'GLOBAL'),
            description: sal.description || 'Salário Mensal',
            payDay: Number(sal.payDay) || 5,
            status: sal.status || 'RECEIVED',
            active: sal.active !== undefined ? Boolean(sal.active) : true,
            notes: sal.notes || null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: salaries.id,
            set: {
              amount: Number(sal.amount) || 0,
              referenceMonth: String(sal.referenceMonth || 'GLOBAL'),
              description: sal.description || 'Salário Mensal',
              payDay: Number(sal.payDay) || 5,
              status: sal.status || 'RECEIVED',
              active: sal.active !== undefined ? Boolean(sal.active) : true,
              notes: sal.notes || null,
              updatedAt: new Date(),
            },
          });
      }
    }

    // 4. Incomes
    if (payload.incomes && Array.isArray(payload.incomes)) {
      for (const inc of payload.incomes) {
        if (!inc.id) continue;
        await db
          .insert(extraIncomes)
          .values({
            id: String(inc.id),
            userId,
            amount: Number(inc.amount) || 0,
            description: inc.description || 'Renda Extra',
            source: inc.source || 'Outros',
            date: inc.date || new Date().toISOString().substring(0, 10),
            referenceMonth: inc.referenceMonth || (inc.date ? inc.date.substring(0, 7) : null),
            status: inc.status || 'RECEIVED',
            notes: inc.notes || null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: extraIncomes.id,
            set: {
              amount: Number(inc.amount) || 0,
              description: inc.description,
              source: inc.source,
              date: inc.date,
              referenceMonth: inc.referenceMonth || (inc.date ? inc.date.substring(0, 7) : null),
              status: inc.status,
              notes: inc.notes,
              updatedAt: new Date(),
            },
          });
      }
    }

    // 5. Credit Cards
    if (payload.creditCards && Array.isArray(payload.creditCards)) {
      for (const card of payload.creditCards) {
        if (!card.id) continue;
        await db
          .insert(creditCards)
          .values({
            id: String(card.id),
            userId,
            name: card.name,
            brand: card.brand || 'OUTRO',
            lastDigits: card.lastDigits || null,
            limitAmount: Number(card.limitAmount) || 0,
            closingDay: Number(card.closingDay) || 1,
            dueDay: Number(card.dueDay) || 10,
            color: card.color || '#059669',
            isArchived: Boolean(card.isArchived),
            notes: card.notes || null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: creditCards.id,
            set: {
              name: card.name,
              brand: card.brand,
              lastDigits: card.lastDigits,
              limitAmount: Number(card.limitAmount) || 0,
              closingDay: Number(card.closingDay) || 1,
              dueDay: Number(card.dueDay) || 10,
              color: card.color,
              isArchived: Boolean(card.isArchived),
              notes: card.notes,
              updatedAt: new Date(),
            },
          });
      }
    }

    // 6. Payment Methods
    if (payload.paymentMethods && Array.isArray(payload.paymentMethods)) {
      for (const pm of payload.paymentMethods) {
        if (!pm.id) continue;
        await db
          .insert(customPaymentMethods)
          .values({
            id: String(pm.id),
            userId,
            name: pm.name,
            type: pm.type || 'OUTROS',
            details: pm.details || null,
            color: pm.color || '#0D9488',
            isActive: pm.isActive !== undefined ? Boolean(pm.isActive) : true,
            notes: pm.notes || null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: customPaymentMethods.id,
            set: {
              name: pm.name,
              type: pm.type,
              details: pm.details,
              color: pm.color,
              isActive: pm.isActive,
              notes: pm.notes,
              updatedAt: new Date(),
            },
          });
      }
    }

    // 7. Installment Purchases
    if (payload.installmentPurchases && Array.isArray(payload.installmentPurchases)) {
      for (const inst of payload.installmentPurchases) {
        if (!inst.id) continue;
        await db
          .insert(installmentPurchases)
          .values({
            id: String(inst.id),
            userId,
            title: inst.title,
            totalAmount: Number(inst.totalAmount) || 0,
            installmentCount: Number(inst.installmentCount) || 1,
            installmentAmount: Number(inst.installmentAmount) || 0,
            startMonth: inst.startMonth,
            cardId: String(inst.cardId),
            cardName: inst.cardName || null,
            categoryId: String(inst.categoryId),
            categoryName: inst.categoryName,
            defaultDay: Number(inst.defaultDay) || 1,
            isIndefinite: Boolean(inst.isIndefinite),
            isInterrupted: Boolean(inst.isInterrupted),
            interruptedMonth: inst.interruptedMonth || null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: installmentPurchases.id,
            set: {
              title: inst.title,
              totalAmount: Number(inst.totalAmount) || 0,
              installmentCount: Number(inst.installmentCount) || 1,
              installmentAmount: Number(inst.installmentAmount) || 0,
              startMonth: inst.startMonth,
              cardId: String(inst.cardId),
              cardName: inst.cardName,
              categoryId: String(inst.categoryId),
              categoryName: inst.categoryName,
              defaultDay: Number(inst.defaultDay) || 1,
              isIndefinite: Boolean(inst.isIndefinite),
              isInterrupted: Boolean(inst.isInterrupted),
              interruptedMonth: inst.interruptedMonth,
              updatedAt: new Date(),
            },
          });
      }
    }

    // 8. Expenses
    if (payload.expenses && Array.isArray(payload.expenses)) {
      for (const exp of payload.expenses) {
        if (!exp.id) continue;
        await db
          .insert(expenses)
          .values({
            id: String(exp.id),
            userId,
            description: exp.description,
            amount: Number(exp.amount) || 0,
            categoryId: String(exp.categoryId || 'Geral'),
            categoryName: exp.categoryName || 'Geral',
            paymentMethod: exp.paymentMethod || 'PIX',
            paymentMethodId: exp.paymentMethodId || null,
            creditCardId: exp.creditCardId || null,
            creditCardName: exp.creditCardName || null,
            date: exp.date || new Date().toISOString().substring(0, 10),
            referenceMonth: exp.referenceMonth || (exp.date ? exp.date.substring(0, 7) : null),
            status: exp.status || 'PENDENTE',
            isRecurring: Boolean(exp.isRecurring),
            recurringExpenseId: exp.recurringExpenseId || null,
            isInstallment: Boolean(exp.isInstallment),
            isIndefinite: Boolean(exp.isIndefinite),
            installmentNumber: exp.installmentNumber ? Number(exp.installmentNumber) : null,
            totalInstallments: exp.totalInstallments ? Number(exp.totalInstallments) : null,
            installmentPurchaseId: exp.installmentPurchaseId || null,
            notes: exp.notes || null,
            invoiceMonth: exp.invoiceMonth || null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: expenses.id,
            set: {
              description: exp.description,
              amount: Number(exp.amount) || 0,
              categoryId: String(exp.categoryId || 'Geral'),
              categoryName: exp.categoryName || 'Geral',
              paymentMethod: exp.paymentMethod || 'PIX',
              paymentMethodId: exp.paymentMethodId || null,
              creditCardId: exp.creditCardId || null,
              creditCardName: exp.creditCardName || null,
              date: exp.date,
              referenceMonth: exp.referenceMonth || (exp.date ? exp.date.substring(0, 7) : null),
              status: exp.status || 'PENDENTE',
              isRecurring: Boolean(exp.isRecurring),
              recurringExpenseId: exp.recurringExpenseId || null,
              isInstallment: Boolean(exp.isInstallment),
              isIndefinite: Boolean(exp.isIndefinite),
              installmentNumber: exp.installmentNumber ? Number(exp.installmentNumber) : null,
              totalInstallments: exp.totalInstallments ? Number(exp.totalInstallments) : null,
              installmentPurchaseId: exp.installmentPurchaseId || null,
              notes: exp.notes || null,
              invoiceMonth: exp.invoiceMonth || null,
              updatedAt: new Date(),
            },
          });
      }
    }

    // 9. Settings
    if (payload.settings) {
      await upsertUserSettings(userId, payload.settings);
    }

    return { success: true, timestamp: new Date().toISOString() };
  } catch (error) {
    console.error('Database query failed for syncUserData:', error);
    throw new Error('Falha ao sincronizar dados no PostgreSQL', { cause: error });
  }
}

// Single Entity Operations
export async function deleteEntity(table: string, id: string, userId: string) {
  try {
    switch (table) {
      case 'expenses':
        await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
        break;
      case 'salaries':
        await db.delete(salaries).where(and(eq(salaries.id, id), eq(salaries.userId, userId)));
        break;
      case 'incomes':
        await db.delete(extraIncomes).where(and(eq(extraIncomes.id, id), eq(extraIncomes.userId, userId)));
        break;
      case 'credit_cards':
        await db.delete(creditCards).where(and(eq(creditCards.id, id), eq(creditCards.userId, userId)));
        break;
      case 'payment_methods':
        await db.delete(customPaymentMethods).where(and(eq(customPaymentMethods.id, id), eq(customPaymentMethods.userId, userId)));
        break;
      case 'categories':
        await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
        break;
      case 'budgets':
        await db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
        break;
      case 'installment_purchases':
        await db.delete(installmentPurchases).where(and(eq(installmentPurchases.id, id), eq(installmentPurchases.userId, userId)));
        break;
      default:
        throw new Error(`Tabela desconhecida: ${table}`);
    }
    return { success: true, id, table };
  } catch (error) {
    console.error(`Database query failed deleting from ${table}:`, error);
    throw new Error(`Falha ao remover item da tabela ${table} no PostgreSQL`, { cause: error });
  }
}

// Health Check for Database
export async function testDatabaseConnection() {
  const startTime = Date.now();
  try {
    const res = await db.execute(sql`SELECT current_database() as db, current_user as usr, version() as ver`);
    const latency = Date.now() - startTime;
    return {
      status: 'ok',
      connected: true,
      message: 'Conectado ao PostgreSQL (Cloud SQL) com sucesso!',
      database: (res.rows[0] as any)?.db || 'cloud_sql_development_database',
      user: (res.rows[0] as any)?.usr || 'ai_studio_admin',
      version: (res.rows[0] as any)?.ver || 'PostgreSQL',
      latencyMs: latency,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error('Database connection test failed:', error);
    return {
      status: 'error',
      connected: false,
      message: error?.message || 'Falha ao conectar com o banco de dados PostgreSQL',
      error: error?.message || 'Erro desconhecido na conexão',
      timestamp: new Date().toISOString(),
    };
  }
}
