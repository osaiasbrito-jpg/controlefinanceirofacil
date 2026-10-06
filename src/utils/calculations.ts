import {
  Salary,
  ExtraIncome,
  RendaMassoterapia,
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
  Abatimento,
} from '../types';
import { getAdjacentMonth, splitInstallments } from './formatters';
import {
  isExpenseMatchingCard,
  isPixExpense,
  isBoletoExpense,
  isDebitExpense,
  isCashExpense,
  getCanonicalCardInfo,
} from './cardUtils';

/**
 * Checks whether an expense is an indefinite / recurring continuous subscription (prazo indeterminado)
 */
export const isIndefiniteExpense = (
  expense: Partial<Expense>,
  installmentPurchases: InstallmentPurchase[] = []
): boolean => {
  if (!expense) return false;

  // 1. Flag explícita booleana ou string
  if (expense.isIndefinite === true || (expense.isIndefinite as any) === 'true') {
    return true;
  }

  // 2. Parcela sem total definido ou total igual a zero/null (assinaturas contínuas)
  if (
    expense.isInstallment &&
    (expense.totalInstallments === 0 ||
      expense.totalInstallments === null ||
      expense.totalInstallments === undefined)
  ) {
    return true;
  }

  // 3. Descrição ou notas indicando indeterminado ou contínuo
  const desc = (expense.description || '').toLowerCase();
  const notes = (expense.notes || '').toLowerCase();
  if (
    desc.includes('indeterminado') ||
    desc.includes('tempo indeterminado') ||
    notes.includes('indeterminado') ||
    notes.includes('tempo indeterminado') ||
    notes.includes('lançamento contínuo') ||
    notes.includes('lancamento continuo')
  ) {
    return true;
  }

  // 4. Vinculação com a compra parcelada pai
  if (expense.installmentPurchaseId && installmentPurchases && installmentPurchases.length > 0) {
    const parent = installmentPurchases.find((p) => p.id === expense.installmentPurchaseId);
    if (parent?.isIndefinite) return true;
  }

  // 5. Comparação por título com compras contínuas no array de compras parceladas
  if (desc && installmentPurchases && installmentPurchases.length > 0) {
    const cleanDesc = desc.replace(/\s*\(.*?\)\s*/g, '').trim();
    if (cleanDesc) {
      const parentByTitle = installmentPurchases.find(
        (p) => p.isIndefinite && p.title.toLowerCase().trim().includes(cleanDesc)
      );
      if (parentByTitle) return true;
    }
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

  // If there are specific salary items for this month, check if one of them is already the base/monthly salary
  const hasBaseSalaryInList = monthSalaries.some((s) => {
    if (s.isStandardDefault || (s.id && s.id.startsWith('std-salary-'))) return true;
    const desc = (s.description || '').toLowerCase().trim();
    if (
      desc.includes('salário mensal') ||
      desc.includes('salario mensal') ||
      desc.includes('salário base') ||
      desc.includes('salario base') ||
      desc === 'salário' ||
      desc === 'salario'
    ) {
      return true;
    }
    // Check if it's NOT an explicit bonus/additional income
    const isExplicitBonus =
      desc.includes('13') ||
      desc.includes('décimo') ||
      desc.includes('decimo') ||
      desc.includes('férias') ||
      desc.includes('ferias') ||
      desc.includes('adiantamento') ||
      desc.includes('bônus') ||
      desc.includes('bonus') ||
      desc.includes('comissão') ||
      desc.includes('comissao') ||
      desc.includes('extra') ||
      desc.includes('ajuste');
    return !isExplicitBonus;
  });

  // If a base salary entry is already registered for this month, or there's no settings default salary,
  // return monthSalaries without prepending defaultSalaryItem (prevents duplicate summing of 5.200 + 5.000)
  if (hasBaseSalaryInList || !defaultSalaryItem) {
    return monthSalaries;
  }

  // Only if the month has exclusively extra bonuses (like 13º Salário or Férias) and no base salary document,
  // keep the default base salary alongside the additions!
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

/**
 * Retorna os lançamentos de renda de massoterapia do mês de referência
 */
export const getEffectiveMassoterapiaForMonth = (
  month: string,
  massoterapiaIncomes: RendaMassoterapia[] = []
): RendaMassoterapia[] => {
  return massoterapiaIncomes.filter((m) => {
    const itemMonth = m.referenceMonth || (m.dataLancamento ? m.dataLancamento.substring(0, 7) : '');
    return itemMonth === month;
  });
};

/**
 * Retorna os abatimentos e pagamentos adiantados do mês de referência
 */
export const getEffectiveAbatimentosForMonth = (
  month: string,
  abatimentos: Abatimento[] = []
): Abatimento[] => {
  return (abatimentos || []).filter((a) => {
    const itemMonth = a.referenceMonth || (a.date ? a.date.substring(0, 7) : '');
    return itemMonth === month;
  });
};

/**
 * Verifica se um abatimento se aplica a um determinado cartão de crédito
 */
export const isAbatimentoMatchingCard = (
  abatimento: Abatimento,
  targetCardId?: string,
  targetCardName?: string,
  registeredCards: CreditCard[] = []
): boolean => {
  if (abatimento.targetType !== 'CREDIT_CARD') return false;

  // Direct ID match
  if (targetCardId && abatimento.cardId && abatimento.cardId === targetCardId) return true;

  // Canonical name matching (e.g. "Mercado Pago" vs "MERCADO PAGO" or Inter)
  const canonicalTarget = getCanonicalCardInfo(targetCardId, targetCardName, registeredCards);
  const canonicalAbatimento = getCanonicalCardInfo(abatimento.cardId, abatimento.cardName, registeredCards);

  if (canonicalTarget.canonicalName && canonicalAbatimento.canonicalName) {
    if (canonicalTarget.canonicalName.toUpperCase() === canonicalAbatimento.canonicalName.toUpperCase()) {
      return true;
    }
  }

  const abName = (abatimento.cardName || '').toLowerCase().trim();
  const tName = (targetCardName || '').toLowerCase().trim();
  if (abName && tName && (abName === tName || abName.includes(tName) || tName.includes(abName))) {
    return true;
  }

  return false;
};

/**
 * Verifica se um abatimento se aplica a uma forma de pagamento específica (Boleto, Pix, etc.)
 */
export const isAbatimentoMatchingPaymentMethod = (
  abatimento: Abatimento,
  targetMethod: PaymentMethod,
  targetMethodId?: string,
  targetMethodName?: string
): boolean => {
  if (targetMethodId && abatimento.paymentMethodId && abatimento.paymentMethodId === targetMethodId) {
    return true;
  }

  if (targetMethodName && abatimento.paymentMethodName) {
    if (abatimento.paymentMethodName.toLowerCase().trim() === targetMethodName.toLowerCase().trim()) {
      return true;
    }
  }

  if (abatimento.targetType === 'BOLETO' && targetMethod === 'BOLETO') return true;
  if (abatimento.targetType === 'PIX' && targetMethod === 'PIX') return true;
  if (abatimento.paymentMethod && abatimento.paymentMethod === targetMethod) return true;

  return false;
};

export const calculateMonthSummary = (
  month: string,
  salaries: Salary[],
  incomes: ExtraIncome[],
  expenses: Expense[],
  settings?: UserSettings | null,
  massoterapiaIncomes: RendaMassoterapia[] = [],
  abatimentos: Abatimento[] = []
): MonthFinancialSummary => {
  // 1. Effective salaries for target referenceMonth (including standardized default if applicable)
  const monthSalaries = getEffectiveSalariesForMonth(month, salaries, settings);

  // 2. Effective extra incomes (recurring standard incomes + month punctual incomes)
  const monthIncomes = getEffectiveIncomesForMonth(month, incomes);

  // 2.1. Effective massoterapia incomes for target referenceMonth
  const monthMassoterapia = getEffectiveMassoterapiaForMonth(month, massoterapiaIncomes);

  // 2.2. Effective abatimentos/adiantamentos for target referenceMonth
  const monthAbatimentos = getEffectiveAbatimentosForMonth(month, abatimentos);
  const totalAbatimentos = monthAbatimentos.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const cardAbatimentosTotal = monthAbatimentos
    .filter((a) => a.targetType === 'CREDIT_CARD')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const otherAbatimentosTotal = Math.max(0, totalAbatimentos - cardAbatimentosTotal);

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

  // Massoterapia calculations
  const totalMassoterapia = monthMassoterapia.reduce((acc, curr) => acc + (curr.valor || 0), 0);

  // Total Revenues: Salário Fixo + Renda Massoterapia + Renda Extra Avulsa
  const totalRevenue = totalSalary + totalMassoterapia + totalExtraIncome;
  const receivedRevenue = receivedSalary + totalMassoterapia + receivedExtraIncome;
  const pendingRevenue = pendingSalary + pendingExtraIncome;

  // Expenses calculations
  const totalExpensesGross = monthExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const paidExpenses = monthExpenses
    .filter((e) => e.status === 'PAGA')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // Valor atualizado líquido de despesas a pagar (após abatimentos aplicados)
  const totalExpenses = Math.max(0, totalExpensesGross - totalAbatimentos);
  const pendingExpenses = Math.max(0, totalExpensesGross - paidExpenses - totalAbatimentos);

  // Credit card invoice for this month (excluding Pix, Boleto, Débito, and Dinheiro)
  const creditCardInvoiceTotalGross = monthExpenses
    .filter(
      (e) =>
        e.paymentMethod === 'CARTAO_CREDITO' &&
        !isPixExpense(e) &&
        !isBoletoExpense(e) &&
        !isDebitExpense(e) &&
        !isCashExpense(e)
    )
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // Valor atualizado líquido da fatura de cartão (subtraindo abatimentos dos cartões)
  const creditCardInvoiceTotal = Math.max(0, creditCardInvoiceTotalGross - cardAbatimentosTotal);

  // Balances
  // Saldo do Salário: Salário total - Total de despesas atualizadas
  const salaryBalance = totalSalary - totalExpenses;
  // Saldo Total: Receita Total - Total de despesas atualizadas
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
    totalMassoterapia,
    totalRevenue,
    receivedRevenue,
    pendingRevenue,
    totalExpenses,
    totalExpensesGross,
    paidExpenses,
    pendingExpenses,
    salaryBalance,
    totalBalance,
    currentEffectiveBalance,
    creditCardInvoiceTotal,
    creditCardInvoiceTotalGross,
    totalAbatimentos,
    cardAbatimentosTotal,
    otherAbatimentosTotal,
    expensesCount: monthExpenses.length,
  };
};

export const calculateCardLimit = (
  card: CreditCard,
  allExpenses: Expense[],
  currentMonth: string,
  installmentPurchases: InstallmentPurchase[] = [],
  registeredCards: CreditCard[] = [],
  abatimentos: Abatimento[] = []
): CardLimitSummary => {
  // All credit card expenses for this card that are not yet paid, or future installments
  const cardExpenses = allExpenses.filter(
    (e) =>
      e.cardId === card.id ||
      isExpenseMatchingCard(e, card.id, card.name, registeredCards.length > 0 ? registeredCards : [card])
  );

  // Current month invoice gross: all card expenses mapped to currentMonth
  const currentMonthInvoiceGross = cardExpenses
    .filter((e) => e.referenceMonth === currentMonth)
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // Abatimentos aplicados especificamente a este cartão no mês
  const cardAbatimentos = getEffectiveAbatimentosForMonth(currentMonth, abatimentos).filter((a) =>
    isAbatimentoMatchingCard(a, card.id, card.name, registeredCards)
  );
  const abatimentoAmount = cardAbatimentos.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // Fatura líquida atualizada a pagar
  const currentMonthInvoice = Math.max(0, currentMonthInvoiceGross - abatimentoAmount);

  // Total used limit:
  // - Fixed purchases & standard installments: all unpaid expenses (past, present, and future) consume limit
  // - Indefinite recurring purchases (prazo indeterminado): only unpaid expenses for current and past months (referenceMonth <= currentMonth) consume limit! Future projections do not lock limit.
  // - O adiantamento/abatimento realizado já libera o limite do cartão!
  const rawUsedLimit = cardExpenses
    .filter((e) => {
      if (e.status !== 'PENDENTE') return false;
      const isIndefinite = isIndefiniteExpense(e, installmentPurchases);
      if (isIndefinite && e.referenceMonth && e.referenceMonth > currentMonth) {
        return false;
      }
      return true;
    })
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const usedLimit = Math.max(0, rawUsedLimit - abatimentoAmount);
  const availableLimit = Math.max(0, card.totalLimit - usedLimit);
  const usagePercentage = card.totalLimit > 0 
    ? Math.min(100, Math.round((usedLimit / card.totalLimit) * 100))
    : 0;

  return {
    card,
    totalLimit: card.totalLimit,
    usedLimit,
    currentMonthInvoice,
    currentMonthInvoiceGross,
    abatimentoAmount,
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
        cardId: effectiveMethod === 'CARTAO_CREDITO' ? cardId : undefined,
        cardName: effectiveMethod === 'CARTAO_CREDITO' ? cardName : undefined,
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
      cardId: effectiveMethod === 'CARTAO_CREDITO' ? cardId : undefined,
      cardName: effectiveMethod === 'CARTAO_CREDITO' ? cardName : undefined,
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

  // 1. Todas as Parcelas do Mês (ativas)
  const allInstallments: Expense[] = [];

  // 2. Últimas Parcelas (Finalizam neste mês)
  // Despesas parceladas com prazo fixo onde o número da parcela é igual ao total de parcelas (ex: 4/4, 6/6, 12/12)
  const lastInstallments: Expense[] = [];

  // 3. Compras à Vista (Pagas em 1x / sem parcelamento)
  const singleExpenses: Expense[] = [];

  for (const exp of monthExpenses) {
    // 1. Despesas indeterminadas / assinaturas contínuas são recorrentes por definição e NUNCA entram em Compras à Vista nem na Soma Total Não-Recorrente
    if (isIndefiniteExpense(exp, installmentPurchases)) {
      continue;
    }

    // 2. Se for despesa parcelada (isInstallment):
    if (exp.isInstallment) {
      if (exp.totalInstallments && exp.totalInstallments > 1) {
        allInstallments.push(exp);
        if (exp.installmentNumber === exp.totalInstallments) {
          lastInstallments.push(exp);
        }
      }
      // IMPORTANTE: Parcelas sem total fixo ou indeterminadas NUNCA caem em Compras à Vista
      continue;
    }

    // 3. Apenas despesas que comprovadamente NÃO são parceladas e NÃO são fixas/recorrentes
    if (!exp.isRecurring) {
      singleExpenses.push(exp);
    }
  }

  const allInstallmentsTotal = allInstallments.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const allInstallmentsCount = allInstallments.length;

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

  // Soma Total Não-Recorrente: Gastos pontuais deste mês que NÃO se repetem no próximo mês (Últimas Parcelas + Compras à Vista)
  const nonRecurringTotal = lastInstallmentsTotal + singleExpensesTotal;
  const nonRecurringCount = lastInstallmentsCount + singleExpensesCount;
  const combinedTotal = nonRecurringTotal;
  const combinedCount = nonRecurringCount;

  return {
    referenceMonth,
    allInstallmentsTotal,
    allInstallmentsCount,
    allInstallments,
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
    nonRecurringTotal,
    nonRecurringCount,
  };
};
