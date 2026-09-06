import {
  Salary,
  ExtraIncome,
  Expense,
  CreditCard,
  Category,
  CategoryBudget,
  UserSettings,
  MonthFinancialSummary,
  CardLimitSummary,
  MonthBudgetSummary,
  BudgetExecutionItem,
  InstallmentPurchase,
  MonthInstallmentsAndSingleSummary,
  PaymentMethod,
} from '../types';
import { getAdjacentMonth, splitInstallments } from './formatters';
import { isExpenseMatchingCard, isPixExpense, isBoletoExpense, isDebitExpense, isCashExpense } from './cardUtils';

/**
 * Checks whether an expense is an indefinite / recurring continuous subscription (prazo indeterminado)
 */
export const isIndefiniteExpense = (
  expense: Expense,
  installmentPurchases: InstallmentPurchase[] = []
): boolean => {
  if (expense.isIndefinite) return true;
  if (expense.isInstallment && expense.totalInstallments === 0) return true;
  if (expense.description && /indeterminado/i.test(expense.description)) return true;
  if (expense.notes && /indeterminado/i.test(expense.notes)) return true;
  if (expense.installmentPurchaseId && installmentPurchases && installmentPurchases.length > 0) {
    const parent = installmentPurchases.find((p) => p.id === expense.installmentPurchaseId);
    if (parent?.isIndefinite) return true;
  }
  return false;
};

/**
 * Returns the effective salaries for a given month.
 * If specific salaries exist for this month, returns them.
 * If no specific salaries exist for this month, but a standard default salary is configured in UserSettings,
 * synthesizes a standard salary entry for this month.
 */
export const getEffectiveSalariesForMonth = (
  month: string,
  salaries: Salary[],
  settings?: UserSettings | null
): Salary[] => {
  const monthSalaries = salaries.filter((s) => s.referenceMonth === month);

  // Check if default standardized salary is active in settings
  const hasDefaultSalary = !!(
    settings?.defaultSalaryAmount &&
    settings.defaultSalaryAmount > 0 &&
    settings.defaultSalaryActive !== false
  );

  const defaultSalaryItem: Salary | null = hasDefaultSalary
    ? {
        id: `std-salary-${month}`,
        userId: settings!.userId,
        amount: settings!.defaultSalaryAmount!,
        referenceMonth: month,
        payDate: `${month}-${String(Math.min(28, Math.max(1, settings?.defaultSalaryPayDay || 5))).padStart(2, '0')}`,
        description: settings?.defaultSalaryDescription || 'Salário Mensal Base (Padrão)',
        status: settings?.defaultSalaryStatus || 'RECEIVED',
        isStandardDefault: true,
        repeatMonthly: true,
        createdAt: settings?.createdAt || new Date().toISOString(),
        updatedAt: settings?.updatedAt || new Date().toISOString(),
      }
    : null;

  if (monthSalaries.length === 0) {
    return defaultSalaryItem ? [defaultSalaryItem] : [];
  }

  // If there are specific salary items for this month, check if one of them is already the standard/main base salary
  const hasStandardInList = monthSalaries.some(
    (s) => s.isStandardDefault || (s.id && s.id.startsWith('std-salary-'))
  );

  // If a standard entry is already stored in the array, or there's no settings default salary, return monthSalaries
  if (hasStandardInList || !defaultSalaryItem) {
    return monthSalaries;
  }

  // If the user added specific salary additions (like 1/3 de Férias, 13º Salário, Adiantamento, etc.)
  // but doesn't have a stored base salary document, keep the base salary alongside the additions!
  return [defaultSalaryItem, ...monthSalaries];
};

/**
 * Returns all effective extra incomes for a given month:
 * - Recurring standard extra incomes (isRecurring === true, which repeat across all months)
 * - Punctual extra incomes specifically assigned to this month (referenceMonth === month && !isRecurring)
 */
export const getEffectiveIncomesForMonth = (
  month: string,
  incomes: ExtraIncome[]
): ExtraIncome[] => {
  return incomes.filter((i) => {
    if (i.isRecurring) return true;
    const itemMonth = i.referenceMonth || (i.date ? i.date.substring(0, 7) : '');
    return itemMonth === month;
  });
};

export const calculateMonthSummary = (
  month: string,
  salaries: Salary[],
  incomes: ExtraIncome[],
  expenses: Expense[],
  settings?: UserSettings | null
): MonthFinancialSummary => {
  // 1. Effective salaries for target referenceMonth (including standardized default if applicable)
  const monthSalaries = getEffectiveSalariesForMonth(month, salaries, settings);

  // 2. Effective extra incomes (recurring standard incomes + month punctual incomes)
  const monthIncomes = getEffectiveIncomesForMonth(month, incomes);

  // 3. Expenses for target referenceMonth
  const monthExpenses = expenses.filter((e) => e.referenceMonth === month);

  // Salaries calculations
  const totalSalary = monthSalaries.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const receivedSalary = monthSalaries
    .filter((s) => s.status === 'RECEIVED')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const pendingSalary = totalSalary - receivedSalary;

  // Extra Incomes calculations
  const totalExtraIncome = monthIncomes.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const receivedExtraIncome = monthIncomes
    .filter((i) => i.status === 'RECEIVED')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const pendingExtraIncome = totalExtraIncome - receivedExtraIncome;

  // Total Revenues
  const totalRevenue = totalSalary + totalExtraIncome;
  const receivedRevenue = receivedSalary + receivedExtraIncome;
  const pendingRevenue = pendingSalary + pendingExtraIncome;

  // Expenses calculations
  const totalExpenses = monthExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const paidExpenses = monthExpenses
    .filter((e) => e.status === 'PAGA')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const pendingExpenses = totalExpenses - paidExpenses;

  // Credit card invoice for this month (excluding Pix, Boleto, Débito, and Dinheiro)
  const creditCardInvoiceTotal = monthExpenses
    .filter(
      (e) =>
        e.paymentMethod === 'CARTAO_CREDITO' &&
        !isPixExpense(e) &&
        !isBoletoExpense(e) &&
        !isDebitExpense(e) &&
        !isCashExpense(e)
    )
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // Balances
  // Saldo do Salário: Salário total - Total de despesas
  const salaryBalance = totalSalary - totalExpenses;
  // Saldo Total: Receita Total - Total de despesas
  const totalBalance = totalRevenue - totalExpenses;
  // Saldo Efetivo Atual: Receitas já recebidas - Despesas já pagas
  const currentEffectiveBalance = receivedRevenue - paidExpenses;

  return {
    referenceMonth: month,
    totalSalary,
    receivedSalary,
    pendingSalary,
    totalExtraIncome,
    receivedExtraIncome,
    pendingExtraIncome,
    totalRevenue,
    receivedRevenue,
    pendingRevenue,
    totalExpenses,
    paidExpenses,
    pendingExpenses,
    salaryBalance,
    totalBalance,
    currentEffectiveBalance,
    creditCardInvoiceTotal,
    expensesCount: monthExpenses.length,
  };
};

export const calculateCardLimit = (
  card: CreditCard,
  allExpenses: Expense[],
  currentMonth: string,
  installmentPurchases: InstallmentPurchase[] = [],
  registeredCards: CreditCard[] = []
): CardLimitSummary => {
  // All credit card expenses for this card that are not yet paid, or future installments
  const cardExpenses = allExpenses.filter(
    (e) =>
      e.cardId === card.id ||
      isExpenseMatchingCard(e, card.id, card.name, registeredCards.length > 0 ? registeredCards : [card])
  );

  // Current month invoice: all card expenses mapped to currentMonth
  const currentMonthInvoice = cardExpenses
    .filter((e) => e.referenceMonth === currentMonth)
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // Total used limit:
  // - Fixed purchases & standard installments: all unpaid expenses (past, present, and future) consume limit
  // - Indefinite recurring purchases (prazo indeterminado): only unpaid expenses for current and past months (referenceMonth <= currentMonth) consume limit! Future projections do not lock limit.
  const usedLimit = cardExpenses
    .filter((e) => {
      if (e.status !== 'PENDENTE') return false;
      const isIndefinite = isIndefiniteExpense(e, installmentPurchases);
      if (isIndefinite && e.referenceMonth && e.referenceMonth > currentMonth) {
        return false;
      }
      return true;
    })
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const availableLimit = Math.max(0, card.totalLimit - usedLimit);
  const usagePercentage = card.totalLimit > 0 
    ? Math.min(100, Math.round((usedLimit / card.totalLimit) * 100))
    : 0;

  return {
    card,
    totalLimit: card.totalLimit,
    usedLimit,
    currentMonthInvoice,
    availableLimit,
    usagePercentage,
  };
};

/**
 * Builds installment distribution given total amount, installment count, and starting month.
 * Supports both fixed installments (e.g. 12x) and Indefinite / Continuous recurrence (tempo indeterminado).
 */
export const generateInstallmentsPlan = (
  description: string,
  totalAmount: number,
  count: number,
  startMonth: string,
  categoryId: string,
  categoryName: string,
  cardId: string,
  purchaseId: string,
  userId: string,
  defaultDay: number = 10,
  isIndefinite: boolean = false,
  cardName?: string
): Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>[] => {
  const result: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  if (isIndefinite) {
    // For indefinite installment/recurrence, generate initial 6 months projection (user can extend by 3 or 6 months when reaching the end)
    const projectionMonths = 6;
    const monthlyVal = totalAmount; // For indefinite, totalAmount entered is the monthly amount

    const effectiveMethod: PaymentMethod = isPixExpense({ cardName, cardId, categoryName, categoryId })
      ? 'PIX'
      : isBoletoExpense({ cardName, cardId, categoryName, categoryId })
      ? 'BOLETO'
      : isDebitExpense({ cardName, cardId, categoryName, categoryId })
      ? 'CARTAO_DEBITO'
      : isCashExpense({ cardName, cardId, categoryName, categoryId })
      ? 'DINHEIRO'
      : 'CARTAO_CREDITO';

    for (let i = 0; i < projectionMonths; i++) {
      const installmentMonth = getAdjacentMonth(startMonth, i);
      const dayStr = String(Math.min(28, Math.max(1, defaultDay))).padStart(2, '0');
      const dateStr = `${installmentMonth}-${dayStr}`;

      result.push({
        userId,
        description: `${description} (Mês ${i + 1} - Indeterminado)`,
        amount: monthlyVal,
        date: dateStr,
        referenceMonth: installmentMonth,
        categoryId,
        categoryName,
        paymentMethod: effectiveMethod,
        cardId,
        cardName,
        isInstallment: true,
        isIndefinite: true,
        installmentPurchaseId: purchaseId,
        installmentNumber: i + 1,
        totalInstallments: 0, // 0 signifies indefinite
        status: 'PENDENTE',
        notes: `Lançamento contínuo por tempo indeterminado (Mês ${i + 1}/6). Pode ser prorrogado por mais 3 ou 6 meses ou interrompido a qualquer tempo.`,
      });
    }

    return result;
  }

  // Standard fixed installments (e.g. 2x to 36x)
  const parts = splitInstallments(totalAmount, count);
  const effectiveMethod: PaymentMethod = isPixExpense({ cardName, cardId, categoryName, categoryId })
    ? 'PIX'
    : isBoletoExpense({ cardName, cardId, categoryName, categoryId })
    ? 'BOLETO'
    : isDebitExpense({ cardName, cardId, categoryName, categoryId })
    ? 'CARTAO_DEBITO'
    : isCashExpense({ cardName, cardId, categoryName, categoryId })
    ? 'DINHEIRO'
    : 'CARTAO_CREDITO';

  for (let i = 0; i < count; i++) {
    const installmentMonth = getAdjacentMonth(startMonth, i);
    const dayStr = String(Math.min(28, Math.max(1, defaultDay))).padStart(2, '0');
    const dateStr = `${installmentMonth}-${dayStr}`;

    result.push({
      userId,
      description: `${description} (${i + 1}/${count})`,
      amount: parts[i],
      date: dateStr,
      referenceMonth: installmentMonth,
      categoryId,
      categoryName,
      paymentMethod: effectiveMethod,
      cardId,
      cardName,
      isInstallment: true,
      isIndefinite: false,
      installmentPurchaseId: purchaseId,
      installmentNumber: i + 1,
      totalInstallments: count,
      status: 'PENDENTE',
      notes: `Parcela ${i + 1} de ${count} da compra "${description}"`,
    });
  }

  return result;
};

/**
 * Calculates summary of final installments (últimas parcelas) and single / à vista expenses for a selected month,
 * as well as the combined non-recurring total that will be released from future months' budgets.
 */
export const calculateMonthInstallmentsAndSingleSummary = (
  referenceMonth: string,
  expenses: Expense[],
  installmentPurchases: InstallmentPurchase[] = []
): MonthInstallmentsAndSingleSummary => {
  const monthExpenses = expenses.filter(
    (e) => (e.referenceMonth || (e.date ? e.date.substring(0, 7) : '')) === referenceMonth
  );

  // 1. Últimas Parcelas (Finalizam neste mês)
  // Despesas parceladas com prazo fixo onde o número da parcela é igual ao total de parcelas (ex: 4/4, 6/6, 12/12)
  const lastInstallments: Expense[] = [];

  // 2. Compras à Vista (Pagas em 1x / sem parcelamento)
  const singleExpenses: Expense[] = [];

  for (const exp of monthExpenses) {
    const isIndefinite = isIndefiniteExpense(exp, installmentPurchases);

    if (isIndefinite) {
      // Indefinite continuous subscriptions are recurring, not fixed single or fixed final installments
      continue;
    }

    if (exp.isInstallment && exp.totalInstallments && exp.totalInstallments > 1) {
      if (exp.installmentNumber === exp.totalInstallments) {
        lastInstallments.push(exp);
      }
    } else {
      // Single / À vista (Cartão à vista, Pix, Boleto, Débito, Dinheiro, etc.)
      singleExpenses.push(exp);
    }
  }

  const lastInstallmentsTotal = lastInstallments.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const lastInstallmentsCount = lastInstallments.length;

  const singleExpensesTotal = singleExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const singleExpensesCount = singleExpenses.length;

  const singleCardExpenses = singleExpenses.filter(
    (e) =>
      e.paymentMethod === 'CARTAO_CREDITO' &&
      !isPixExpense(e) &&
      !isBoletoExpense(e) &&
      !isDebitExpense(e) &&
      !isCashExpense(e)
  );
  const singleCardExpensesTotal = singleCardExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const singleCardExpensesCount = singleCardExpenses.length;

  const singleOtherExpenses = singleExpenses.filter(
    (e) =>
      e.paymentMethod !== 'CARTAO_CREDITO' ||
      isPixExpense(e) ||
      isBoletoExpense(e) ||
      isDebitExpense(e) ||
      isCashExpense(e)
  );
  const singleOtherExpensesTotal = singleOtherExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const singleOtherExpensesCount = singleOtherExpenses.length;

  const combinedTotal = lastInstallmentsTotal + singleExpensesTotal;
  const combinedCount = lastInstallmentsCount + singleExpensesCount;

  return {
    referenceMonth,
    lastInstallmentsTotal,
    lastInstallmentsCount,
    lastInstallments,
    singleExpensesTotal,
    singleExpensesCount,
    singleExpenses,
    singleCardExpensesTotal,
    singleCardExpensesCount,
    singleOtherExpensesTotal,
    singleOtherExpensesCount,
    combinedTotal,
    combinedCount,
  };
};
