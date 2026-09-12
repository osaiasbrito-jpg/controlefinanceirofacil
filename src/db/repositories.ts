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
  rendaExtra,
} from './schema';
import { eq, and, desc, sql, or, inArray } from 'drizzle-orm';
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
export async function getFullUserData(userId: string, userEmail?: string) {
  try {
    const uidsToMatch = new Set<string>();
    if (userId) uidsToMatch.add(userId);
    if (userEmail) uidsToMatch.add(userEmail.toLowerCase().trim());

    // Se for o superusuário Osaias Brito ou referenciar seu email/nome:
    const isOsaias =
      userId?.toLowerCase().includes('osaias') ||
      userEmail?.toLowerCase().includes('osaias') ||
      userId?.toLowerCase() === 'osaiasbrito@gmail.com' ||
      userEmail?.toLowerCase() === 'osaiasbrito@gmail.com';

    if (isOsaias) {
      uidsToMatch.add('osaiasbrito@gmail.com');
      uidsToMatch.add('super_admin_osaiasbrito');
    }

    // Buscar no banco se existe correspondência na tabela users
    try {
      const userRows = await db
        .select()
        .from(users)
        .where(or(eq(users.uid, userId), eq(users.email, (userEmail || userId).toLowerCase())));
      for (const u of userRows) {
        if (u.uid) uidsToMatch.add(u.uid);
        if (u.email) uidsToMatch.add(u.email);
      }
    } catch {}

    const uidList = Array.from(uidsToMatch).filter(Boolean);
    const filterCondition = (column: any) =>
      uidList.length === 1 ? eq(column, uidList[0]) : inArray(column, uidList);

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
      db.select().from(salaries).where(filterCondition(salaries.userId)),
      db.select().from(extraIncomes).where(filterCondition(extraIncomes.userId)),
      db.select().from(expenses).where(filterCondition(expenses.userId)),
      db.select().from(creditCards).where(filterCondition(creditCards.userId)),
      db.select().from(customPaymentMethods).where(filterCondition(customPaymentMethods.userId)),
      db.select().from(installmentPurchases).where(filterCondition(installmentPurchases.userId)),
      db.select().from(categories).where(filterCondition(categories.userId)),
      db.select().from(budgets).where(filterCondition(budgets.userId)),
      getUserSettings(userId),
    ]);

    const purchaseMap = new Map((userInstallments || []).map((p) => [p.id, p]));
    const mappedExpenses = userExpenses.map((exp) => {
      const parent = exp.installmentPurchaseId ? purchaseMap.get(exp.installmentPurchaseId) : undefined;
      const effectiveCardId = exp.creditCardId || (exp as any).cardId || parent?.cardId || null;
      const effectiveCardName = exp.creditCardName || (exp as any).cardName || parent?.cardName || null;
      return {
        ...exp,
        cardId: effectiveCardId,
        cardName: effectiveCardName,
        creditCardId: effectiveCardId,
        creditCardName: effectiveCardName,
      };
    });

    const combinedIncomes = userIncomes || [];

    return {
      salaries: userSalaries,
      incomes: combinedIncomes,
      expenses: mappedExpenses,
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

// Helper to process items in concurrent batches to prevent long sequential loops
async function processBatched<T>(items: T[], chunkSize: number, fn: (item: T) => Promise<any>) {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (item) => {
        try {
          await fn(item);
        } catch (e) {
          console.warn('Aviso: falha pontual ao gravar registro no PostgreSQL:', e);
        }
      })
    );
  }
}

// Bulk Sync/Save from Client to PostgreSQL
export async function syncUserData(payload: SyncDataPayload) {
  const { userId } = payload;
  if (!userId) throw new Error('userId obrigatório');

  try {
    // 1. Categories
    if (payload.categories && Array.isArray(payload.categories)) {
      const validCategories = payload.categories.filter((cat) => cat && cat.id);
      await processBatched(validCategories, 20, async (cat) => {
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
      });
    }

    // 2. Budgets
    if (payload.budgets && Array.isArray(payload.budgets)) {
      const validBudgets = payload.budgets.filter((b) => b && b.id);
      await processBatched(validBudgets, 20, async (b) => {
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
      });
    }

    // 3. Salaries
    if (payload.salaries && Array.isArray(payload.salaries)) {
      const validSalaries = payload.salaries.filter((sal) => sal && sal.id);
      await processBatched(validSalaries, 20, async (sal) => {
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
      });
    }

    // 4. Incomes
    if (payload.incomes && Array.isArray(payload.incomes)) {
      const validIncomes = payload.incomes.filter((inc) => inc && inc.id);
      await processBatched(validIncomes, 20, async (inc) => {
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
      });
    }

    // 5. Credit Cards
    if (payload.creditCards && Array.isArray(payload.creditCards)) {
      const validCards = payload.creditCards.filter((card) => card && card.id);
      await processBatched(validCards, 20, async (card) => {
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
      });
    }

    // 6. Payment Methods
    if (payload.paymentMethods && Array.isArray(payload.paymentMethods)) {
      const validMethods = payload.paymentMethods.filter((pm) => pm && pm.id);
      await processBatched(validMethods, 20, async (pm) => {
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
      });
    }

    // 7. Installment Purchases
    if (payload.installmentPurchases && Array.isArray(payload.installmentPurchases)) {
      const validInstallments = payload.installmentPurchases.filter((inst) => inst && inst.id);
      await processBatched(validInstallments, 20, async (inst) => {
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
              title: inst.title ? String(inst.title) : sql`installment_purchases.title`,
              totalAmount: inst.totalAmount !== undefined ? Number(inst.totalAmount) : sql`installment_purchases.total_amount`,
              installmentCount: inst.installmentCount !== undefined ? Number(inst.installmentCount) : sql`installment_purchases.installment_count`,
              installmentAmount: inst.installmentAmount !== undefined ? Number(inst.installmentAmount) : sql`installment_purchases.installment_amount`,
              startMonth: inst.startMonth ? String(inst.startMonth) : sql`installment_purchases.start_month`,
              cardId: inst.cardId ? String(inst.cardId) : sql`installment_purchases.card_id`,
              cardName: inst.cardName ? String(inst.cardName) : sql`installment_purchases.card_name`,
              categoryId: inst.categoryId ? String(inst.categoryId) : sql`installment_purchases.category_id`,
              categoryName: inst.categoryName ? String(inst.categoryName) : sql`installment_purchases.category_name`,
              defaultDay: inst.defaultDay ? Number(inst.defaultDay) : sql`installment_purchases.default_day`,
              isIndefinite: inst.isIndefinite !== undefined ? Boolean(inst.isIndefinite) : sql`installment_purchases.is_indefinite`,
              isInterrupted: inst.isInterrupted !== undefined ? Boolean(inst.isInterrupted) : sql`installment_purchases.is_interrupted`,
              interruptedMonth: inst.interruptedMonth ? String(inst.interruptedMonth) : sql`installment_purchases.interrupted_month`,
              updatedAt: new Date(),
            },
          });
      });
    }

    // 8. Expenses
    if (payload.expenses && Array.isArray(payload.expenses)) {
      const validExpenses = payload.expenses.filter((exp) => exp && exp.id);
      await processBatched(validExpenses, 25, async (exp) => {
        await db
          .insert(expenses)
          .values({
            id: String(exp.id),
            userId,
            description: exp.description || 'Despesa',
            amount: Number(exp.amount) || 0,
            categoryId: String(exp.categoryId || 'Geral'),
            categoryName: exp.categoryName || 'Geral',
            paymentMethod: exp.paymentMethod || 'PIX',
            paymentMethodId: exp.paymentMethodId || null,
            creditCardId: exp.creditCardId || exp.cardId || null,
            creditCardName: exp.creditCardName || exp.cardName || null,
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
              description: exp.description ? String(exp.description) : sql`expenses.description`,
              amount: exp.amount !== undefined ? Number(exp.amount) : sql`expenses.amount`,
              categoryId: exp.categoryId ? String(exp.categoryId) : sql`expenses.category_id`,
              categoryName: exp.categoryName ? String(exp.categoryName) : sql`expenses.category_name`,
              paymentMethod: exp.paymentMethod ? String(exp.paymentMethod) : sql`expenses.payment_method`,
              paymentMethodId: exp.paymentMethodId ? String(exp.paymentMethodId) : sql`expenses.payment_method_id`,
              creditCardId: (exp.creditCardId || exp.cardId) ? String(exp.creditCardId || exp.cardId) : sql`expenses.credit_card_id`,
              creditCardName: (exp.creditCardName || exp.cardName) ? String(exp.creditCardName || exp.cardName) : sql`expenses.credit_card_name`,
              date: exp.date ? String(exp.date) : sql`expenses.date`,
              referenceMonth: exp.referenceMonth || (exp.date ? exp.date.substring(0, 7) : null) || sql`expenses.reference_month`,
              status: exp.status ? String(exp.status) : sql`expenses.status`,
              isRecurring: exp.isRecurring !== undefined ? Boolean(exp.isRecurring) : sql`expenses.is_recurring`,
              recurringExpenseId: exp.recurringExpenseId ? String(exp.recurringExpenseId) : sql`expenses.recurring_expense_id`,
              isInstallment: exp.isInstallment !== undefined ? Boolean(exp.isInstallment) : sql`expenses.is_installment`,
              isIndefinite: exp.isIndefinite !== undefined ? Boolean(exp.isIndefinite) : sql`expenses.is_indefinite`,
              installmentNumber: exp.installmentNumber ? Number(exp.installmentNumber) : sql`expenses.installment_number`,
              totalInstallments: exp.totalInstallments ? Number(exp.totalInstallments) : sql`expenses.total_installments`,
              installmentPurchaseId: exp.installmentPurchaseId ? String(exp.installmentPurchaseId) : sql`expenses.installment_purchase_id`,
              notes: exp.notes !== undefined ? (exp.notes || null) : sql`expenses.notes`,
              invoiceMonth: exp.invoiceMonth ? String(exp.invoiceMonth) : sql`expenses.invoice_month`,
              updatedAt: new Date(),
            },
          });
      });
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
