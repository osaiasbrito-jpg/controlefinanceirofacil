import React, { useState, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Filter,
  Search,
  RotateCcw,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  CreditCard as CardIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Infinity as InfinityIcon,
  Ban,
  FileSpreadsheet,
  Wallet,
  TrendingUp,
  DollarSign,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Tag,
  Check,
  Zap,
  FileText,
  Banknote,
  X,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { Expense, PaymentMethod, InstallmentPurchase } from '../types';
import { formatCurrency, formatDateBR, getMonthName, getCurrentMonth } from '../utils/formatters';
import {
  getCanonicalCardInfo,
  isExpenseMatchingCard,
  isPixExpense,
  isBoletoExpense,
  isDebitExpense,
  isCashExpense,
  isExpenseMatchingPaymentMethod,
} from '../utils/cardUtils';
import { ConfirmDeleteModal } from './modals/ConfirmDeleteModal';
import { NonRecurringExpensesSummary } from './NonRecurringExpensesSummary';
import { IndefiniteEndingAlerts } from './IndefiniteEndingAlerts';
import { ExtendIndefiniteModal } from './modals/ExtendIndefiniteModal';

interface ExpensesViewProps {
  onOpenExpenseModal: (expenseToEdit?: Expense) => void;
  onDeleteExpense: (expense: Expense) => void;
  onOpenImportExcel?: () => void;
}

type ActiveBreakdownFilter =
  | { type: 'ALL' }
  | { type: 'CARD'; cardKey: string; cardId: string; name: string }
  | { type: 'METHOD'; method: PaymentMethod; methodId?: string; label: string };

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  onOpenExpenseModal,
  onDeleteExpense,
  onOpenImportExcel,
}) => {
  const {
    expenses,
    selectedMonth,
    setSelectedMonth,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    categories,
    creditCards,
    paymentMethods,
    filters,
    setFilters,
    resetFilters,
    filteredExpenses,
    toggleExpenseStatus,
    deleteExpense,
    deleteMultipleExpenses,
    updateMultipleExpensesStatus,
    interruptInstallmentPurchase,
    extendIndefinitePurchase,
    monthSummary,
    monthInstallmentsAndSingleSummary,
    installmentPurchases,
  } = useFinance();

  const [showFilters, setShowFilters] = useState(false);
  const [activeTabStatus, setActiveTabStatus] = useState<'ALL' | 'PENDENTE' | 'PAGA'>('ALL');
  const [extendModalPurchase, setExtendModalPurchase] = useState<InstallmentPurchase | null>(null);
  const [activeBreakdownFilter, setActiveBreakdownFilter] = useState<ActiveBreakdownFilter>({
    type: 'ALL',
  });

  // Multi-selection state for batch operations
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);

  const isCurrentMonth = selectedMonth === getCurrentMonth();

  // Unified breakdown of Cards and Non-Card Payment Methods for the selected month (Canonical & Consolidated)
  const paymentBreakdown = useMemo(() => {
    // Only consider expenses of the selected month
    const monthExpenses = expenses.filter(
      (e) => (e.referenceMonth || (e.date ? e.date.substring(0, 7) : '')) === selectedMonth
    );

    // 1. Credit cards map - STRICTLY based on registered creditCards from "Cartões e Outros Tipos" tab!
    // No phantom cards (like "Cartão Fábio") will ever appear here.
    const cardGroupMap = new Map<
      string,
      {
        key: string;
        cardId: string;
        cardName: string;
        bank: string;
        color: string;
        count: number;
        total: number;
      }
    >();

    // Consolidate registered credit cards by canonical name/bank
    creditCards.forEach((c) => {
      const canonical = getCanonicalCardInfo(c.id, c.name, creditCards);
      const groupKey = canonical.canonicalName || c.name.toUpperCase();
      if (!cardGroupMap.has(groupKey)) {
        cardGroupMap.set(groupKey, {
          key: groupKey,
          cardId: c.id,
          cardName: canonical.canonicalName || c.name,
          bank: c.bank || canonical.bank || 'Crédito',
          color: c.color || canonical.color || '#8B5CF6',
          count: 0,
          total: 0,
        });
      }
    });

    // 2. Non-card payment methods (Pix, Boleto, Débito, Dinheiro, etc.)
    // Ensure all registered payment methods and standard types are represented, ALWAYS including Pix!
    const methodMap = new Map<
      string,
      {
        key: string;
        method: PaymentMethod;
        methodId?: string;
        label: string;
        subtitle: string;
        iconType: 'pix' | 'boleto' | 'debito' | 'dinheiro' | 'outros';
        color: string;
        count: number;
        total: number;
      }
    >();

    // Seed with registered custom payment methods (from "Cartões e Outros Tipos")
    paymentMethods.forEach((pm) => {
      const iconType =
        pm.type === 'PIX'
          ? 'pix'
          : pm.type === 'BOLETO'
          ? 'boleto'
          : pm.type === 'CARTAO_DEBITO'
          ? 'debito'
          : pm.type === 'DINHEIRO'
          ? 'dinheiro'
          : 'outros';

      methodMap.set(pm.id, {
        key: pm.id,
        method: pm.type,
        methodId: pm.id,
        label: pm.name,
        subtitle: pm.details || (pm.type === 'PIX' ? 'Chave Instantânea' : pm.type === 'BOLETO' ? 'Código de barras' : 'Outro'),
        iconType,
        color: pm.color || '#0D9488',
        count: 0,
        total: 0,
      });
    });

    // If Pix is not yet in methodMap, ensure standard Pix is ALWAYS present
    const hasPix = Array.from(methodMap.values()).some((m) => m.method === 'PIX');
    if (!hasPix) {
      methodMap.set('default-pix', {
        key: 'default-pix',
        method: 'PIX',
        label: 'Pix',
        subtitle: 'Instantâneo',
        iconType: 'pix',
        color: '#0D9488',
        count: 0,
        total: 0,
      });
    }

    // Ensure Boleto is present if not already added
    const hasBoleto = Array.from(methodMap.values()).some((m) => m.method === 'BOLETO');
    if (!hasBoleto) {
      methodMap.set('default-boleto', {
        key: 'default-boleto',
        method: 'BOLETO',
        label: 'Boleto Bancário',
        subtitle: 'Código de barras',
        iconType: 'boleto',
        color: '#D97706',
        count: 0,
        total: 0,
      });
    }

    // Consolidate expenses into cards and non-card payment methods
    monthExpenses.forEach((exp) => {
      const isPix = isPixExpense(exp, categories);
      const isBoleto = !isPix && isBoletoExpense(exp, categories);
      const isDebit = !isPix && !isBoleto && isDebitExpense(exp, categories);
      const isCash = !isPix && !isBoleto && !isDebit && isCashExpense(exp, categories);
      const isNonCard = isPix || isBoleto || isDebit || isCash || exp.paymentMethod !== 'CARTAO_CREDITO';

      if (!isNonCard && exp.paymentMethod === 'CARTAO_CREDITO') {
        const canonical = getCanonicalCardInfo(exp.cardId, exp.cardName, creditCards);
        if (canonical.isRegistered) {
          const groupKey = canonical.canonicalName;
          const existing = cardGroupMap.get(groupKey);
          if (existing) {
            existing.count += 1;
            existing.total += exp.amount || 0;
          }
        }
      } else {
        // Non-card payment (Pix, Boleto, Débito, Dinheiro, etc.)
        let method: PaymentMethod = 'PIX';
        if (isPix) method = 'PIX';
        else if (isBoleto) method = 'BOLETO';
        else if (isDebit) method = 'CARTAO_DEBITO';
        else if (isCash) method = 'DINHEIRO';
        else method = exp.paymentMethod || 'PIX';

        // Try match by paymentMethodId first
        let matchedItem = exp.paymentMethodId ? methodMap.get(exp.paymentMethodId) : undefined;
        // If not matched by id, match by method type (e.g. PIX)
        if (!matchedItem) {
          matchedItem = Array.from(methodMap.values()).find((m) => m.method === method);
        }

        if (matchedItem) {
          matchedItem.count += 1;
          matchedItem.total += exp.amount || 0;
        } else {
          // Fallback create for unlisted method
          const label =
            method === 'PIX'
              ? 'Pix'
              : method === 'BOLETO'
              ? 'Boleto Bancário'
              : method === 'CARTAO_DEBITO'
              ? 'Cartão de Débito'
              : method === 'DINHEIRO'
              ? 'Dinheiro'
              : 'Outro';
          const subtitle =
            method === 'PIX'
              ? 'Instantâneo'
              : method === 'BOLETO'
              ? 'Código de barras'
              : method === 'CARTAO_DEBITO'
              ? 'Débito em conta'
              : 'Em espécie';
          const iconType =
            method === 'PIX'
              ? 'pix'
              : method === 'BOLETO'
              ? 'boleto'
              : method === 'CARTAO_DEBITO'
              ? 'debito'
              : 'dinheiro';
          const color =
            method === 'PIX'
              ? '#0D9488'
              : method === 'BOLETO'
              ? '#D97706'
              : method === 'CARTAO_DEBITO'
              ? '#2563EB'
              : '#059669';

          methodMap.set(method, {
            key: method,
            method,
            label,
            subtitle,
            iconType,
            color,
            count: 1,
            total: exp.amount || 0,
          });
        }
      }
    });

    const cardsList = Array.from(cardGroupMap.values());
    const methodsList = Array.from(methodMap.values());

    return {
      cards: cardsList,
      methods: methodsList,
      totalCardCount: cardsList.reduce((acc, c) => acc + c.count, 0),
    };
  }, [expenses, selectedMonth, creditCards, paymentMethods, categories]);

  // Filtered by sub-tab and clicked breakdown card/method
  const displayedExpenses = useMemo(() => {
    return filteredExpenses.filter((e) => {
      // Sub-tab status (ALL | PENDENTE | PAGA)
      if (activeTabStatus !== 'ALL' && e.status !== activeTabStatus) return false;

      // Breakdown click filter
      if (activeBreakdownFilter.type === 'CARD') {
        if (e.paymentMethod !== 'CARTAO_CREDITO') return false;
        const matches = isExpenseMatchingCard(
          e,
          activeBreakdownFilter.cardId,
          activeBreakdownFilter.name,
          creditCards,
          categories
        );
        if (!matches) return false;
      } else if (activeBreakdownFilter.type === 'METHOD') {
        const matches = isExpenseMatchingPaymentMethod(
          e,
          activeBreakdownFilter.method,
          activeBreakdownFilter.methodId,
          categories,
          paymentMethods,
          creditCards
        );
        if (!matches) return false;
      }

      return true;
    });
  }, [filteredExpenses, activeTabStatus, activeBreakdownFilter, creditCards, categories, paymentMethods]);

  // Expenses matching active card/method filter (regardless of activeTabStatus) for accurate tab badges
  const expensesMatchingBreakdown = useMemo(() => {
    return filteredExpenses.filter((e) => {
      if (activeBreakdownFilter.type === 'CARD') {
        if (e.paymentMethod !== 'CARTAO_CREDITO') return false;
        return isExpenseMatchingCard(
          e,
          activeBreakdownFilter.cardId,
          activeBreakdownFilter.name,
          creditCards,
          categories
        );
      } else if (activeBreakdownFilter.type === 'METHOD') {
        return isExpenseMatchingPaymentMethod(
          e,
          activeBreakdownFilter.method,
          activeBreakdownFilter.methodId,
          categories,
          paymentMethods,
          creditCards
        );
      }
      return true;
    });
  }, [filteredExpenses, activeBreakdownFilter, creditCards, categories, paymentMethods]);

  // Categories summary for current month to show quick filter chips
  const monthCategoriesSummary = useMemo(() => {
    const monthExpenses = expenses.filter(
      (e) => (e.referenceMonth || (e.date ? e.date.substring(0, 7) : '')) === selectedMonth
    );
    const catMap = new Map<
      string,
      { id: string; name: string; icon?: string; color?: string; count: number; total: number }
    >();

    // Seed registered categories
    categories.forEach((cat) => {
      catMap.set(cat.name.toLowerCase().trim(), {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        count: 0,
        total: 0,
      });
    });

    monthExpenses.forEach((e) => {
      const catName = e.categoryName || 'Geral';
      const catKey = catName.toLowerCase().trim();
      const existing = catMap.get(catKey);
      if (existing) {
        existing.count += 1;
        existing.total += e.amount || 0;
      } else {
        catMap.set(catKey, {
          id: e.categoryId || catKey,
          name: catName,
          count: 1,
          total: e.amount || 0,
        });
      }
    });

    return Array.from(catMap.values()).filter((c) => c.count > 0);
  }, [expenses, selectedMonth, categories]);

  const countAll = expensesMatchingBreakdown.length;
  const countPending = expensesMatchingBreakdown.filter((e) => e.status === 'PENDENTE').length;
  const countPaid = expensesMatchingBreakdown.filter((e) => e.status === 'PAGA').length;

  // Multi-selection computed values and handlers
  const toggleSelectExpense = (id: string) => {
    setSelectedExpenseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllDisplayed = () => {
    const displayedIds = displayedExpenses.map((e) => e.id);
    const allSelected = displayedIds.length > 0 && displayedIds.every((id) => selectedExpenseIds.has(id));
    if (allSelected) {
      setSelectedExpenseIds((prev) => {
        const next = new Set(prev);
        displayedIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedExpenseIds((prev) => {
        const next = new Set(prev);
        displayedIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const selectedExpensesList = useMemo(() => {
    return expenses.filter((e) => selectedExpenseIds.has(e.id));
  }, [expenses, selectedExpenseIds]);

  const selectedTotalAmount = useMemo(() => {
    return selectedExpensesList.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [selectedExpensesList]);

  const hasInstallmentsInSelection = useMemo(() => {
    return selectedExpensesList.some(
      (e) => e.isInstallment || !!e.installmentPurchaseId || (e.totalInstallments && e.totalInstallments > 1)
    );
  }, [selectedExpensesList]);

  const handleConfirmBulkDelete = async (deleteAllLinkedInstallments?: boolean) => {
    const ids = Array.from(selectedExpenseIds);
    await deleteMultipleExpenses(ids, deleteAllLinkedInstallments);
    setSelectedExpenseIds(new Set());
    setBulkDeleteModalOpen(false);
  };

  const handleBulkMarkStatus = async (status: 'PAGA' | 'PENDENTE') => {
    const ids = Array.from(selectedExpenseIds);
    await updateMultipleExpensesStatus(ids, status);
  };

  // Current month totals based on monthSummary
  const totalMonthExpenses = monthSummary.totalExpenses;
  const paidMonthExpenses = monthSummary.paidExpenses;
  const pendingMonthExpenses = monthSummary.pendingExpenses;
  const totalSalary = monthSummary.totalSalary;
  const totalExtraIncome = monthSummary.totalExtraIncome;
  const totalRevenue = monthSummary.totalRevenue;
  const salaryBalance = monthSummary.salaryBalance; // Salário - Despesas
  const totalBalance = monthSummary.totalBalance; // (Salário + Renda Extra) - Despesas

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 pb-16">
      {/* Header card with Month Navigation */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <span>Despesas & Gastos</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                  {getMonthName(selectedMonth)}
                </span>
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Exibindo somente as despesas do mês selecionado. Alterne o status entre Paga e Pendente com um clique.
          </p>
        </div>

        {/* Action Buttons & Month Picker Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Month Selector in Header */}
          <div className="flex items-center bg-slate-100/90 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={goToPreviousMonth}
              className="p-1.5 rounded-xl hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
              title="Mês Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 px-2.5 py-0.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-extrabold text-slate-800 capitalize min-w-[100px] text-center">
                {getMonthName(selectedMonth)}
              </span>
            </div>
            <button
              onClick={goToNextMonth}
              className="p-1.5 rounded-xl hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
              title="Próximo Mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {!isCurrentMonth && (
              <button
                onClick={goToCurrentMonth}
                className="ml-1 px-2 py-1 bg-white hover:bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-extrabold border border-emerald-200 transition-colors cursor-pointer"
              >
                Mês Atual
              </button>
            )}
          </div>

          {onOpenImportExcel && (
            <button
              id="expenses-import-excel-btn"
              onClick={onOpenImportExcel}
              className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              title="Importar despesas de planilha Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Importar Excel</span>
            </button>
          )}

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
              showFilters
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          <button
            onClick={() => onOpenExpenseModal()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-extrabold shadow-md shadow-emerald-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Despesa</span>
          </button>
        </div>
      </div>

      {/* Indefinite Continuous Subscriptions Expiry Alerts */}
      <IndefiniteEndingAlerts
        selectedMonth={selectedMonth}
        installmentPurchases={installmentPurchases}
        expenses={expenses}
        onOpenExtendModal={(purchase) => setExtendModalPurchase(purchase)}
      />

      {/* Financial Balances & Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Despesas do Mês */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Despesas de {getMonthName(selectedMonth)}
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatCurrency(totalMonthExpenses)}
            </div>
            <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-100">
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Pagas: {formatCurrency(paidMonthExpenses)}
              </span>
              <span className="text-amber-600 font-bold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Pend: {formatCurrency(pendingMonthExpenses)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Saldo do Salário */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Saldo do Salário
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div
              className={`text-2xl font-black tracking-tight ${
                salaryBalance >= 0 ? 'text-indigo-900' : 'text-rose-600'
              }`}
            >
              {formatCurrency(salaryBalance)}
            </div>
            <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-100 text-slate-500">
              <span>Salário: {formatCurrency(totalSalary)}</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                  salaryBalance >= 0
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {salaryBalance >= 0 ? 'Sobra do Salário' : 'Déficit no Salário'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Saldo com Salário + Renda Extra */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Saldo (Salário + Renda Extra)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div
              className={`text-2xl font-black tracking-tight ${
                totalBalance >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {formatCurrency(totalBalance)}
            </div>
            <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-100 text-slate-500">
              <span>Receitas: {formatCurrency(totalRevenue)}</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                  totalBalance >= 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {totalBalance >= 0 ? 'Superávit Total' : 'Saldo Negativo'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Fatura Cartões de Crédito */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Fatura de Cartões
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <CardIcon className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatCurrency(monthSummary.creditCardInvoiceTotal)}
            </div>
            <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-100 text-slate-500">
              <span>{paymentBreakdown.cards.length} cartão(ões) com gasto</span>
              <span className="text-[10px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded-md border border-purple-200">
                {paymentBreakdown.totalCardCount} parcelas/gastos
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Resumo de Últimas Parcelas e Compras à Vista (Não-Recorrentes) */}
      <NonRecurringExpensesSummary
        summary={monthInstallmentsAndSingleSummary}
      />

      {/* Payment Methods & Credit Cards Breakdown Banner (Print 02 Feature) */}
      {(paymentBreakdown.cards.length > 0 || paymentBreakdown.methods.length > 0) && (
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col gap-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <CardIcon className="w-4 h-4 text-purple-600" />
                <span>Formas de Pagamento & Cartões em {getMonthName(selectedMonth)}</span>
              </h4>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Clique sobre qualquer cartão ou tipo de pagamento (Pix, Boleto, etc.) para filtrar a lista abaixo instantaneamente.
              </p>
            </div>
            {activeBreakdownFilter.type !== 'ALL' && (
              <button
                onClick={() => setActiveBreakdownFilter({ type: 'ALL' })}
                className="text-[11px] text-purple-700 hover:text-purple-900 font-extrabold flex items-center gap-1 cursor-pointer self-start sm:self-auto bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Ver Todas as Formas</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Credit Cards Items */}
            {paymentBreakdown.cards.map((item) => {
              const isSelected =
                activeBreakdownFilter.type === 'CARD' &&
                (activeBreakdownFilter.cardKey === item.key ||
                  activeBreakdownFilter.name.toLowerCase() === item.cardName.toLowerCase());

              return (
                <button
                  key={item.key}
                  onClick={() =>
                    setActiveBreakdownFilter(
                      isSelected
                        ? { type: 'ALL' }
                        : { type: 'CARD', cardKey: item.key, cardId: item.cardId, name: item.cardName }
                    )
                  }
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50/80 ring-2 ring-purple-500/30 shadow-xs'
                      : 'border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-purple-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="flex flex-col truncate">
                        <span className="text-xs font-black text-slate-900 truncate">
                          {item.cardName.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold truncate">
                          {item.bank} • Crédito
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-lg border shrink-0 ${
                        isSelected
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {item.count} un
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between pt-1.5 border-t border-slate-200/60">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Fatura Mês
                    </span>
                    <span className="text-sm font-black text-slate-900">
                      {formatCurrency(item.total)}
                    </span>
                  </div>
                </button>
              );
            })}

            {/* Non-Card Items: Pix, Boleto, Débito, Dinheiro */}
            {paymentBreakdown.methods.map((methodItem) => {
              const isSelected =
                activeBreakdownFilter.type === 'METHOD' &&
                (activeBreakdownFilter.methodId
                  ? activeBreakdownFilter.methodId === methodItem.methodId
                  : activeBreakdownFilter.method === methodItem.method);

              return (
                <button
                  key={methodItem.key}
                  onClick={() =>
                    setActiveBreakdownFilter(
                      isSelected
                        ? { type: 'ALL' }
                        : {
                            type: 'METHOD',
                            method: methodItem.method,
                            methodId: methodItem.methodId,
                            label: methodItem.label,
                          }
                    )
                  }
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative ${
                    isSelected
                      ? 'border-teal-600 bg-teal-50/80 ring-2 ring-teal-500/30 shadow-xs'
                      : 'border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-teal-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-7 h-7 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                        style={{ backgroundColor: methodItem.color }}
                      >
                        {methodItem.method === 'PIX' ? (
                          <Zap className="w-3.5 h-3.5" />
                        ) : methodItem.method === 'BOLETO' ? (
                          <FileText className="w-3.5 h-3.5" />
                        ) : methodItem.method === 'CARTAO_DEBITO' ? (
                          <CardIcon className="w-3.5 h-3.5" />
                        ) : (
                          <Banknote className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="text-xs font-black text-slate-900 truncate">
                          {methodItem.label}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold truncate">
                          {methodItem.subtitle}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-lg border shrink-0 ${
                        isSelected
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {methodItem.count} un
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between pt-1.5 border-t border-slate-200/60">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Total Mês
                    </span>
                    <span className="text-sm font-black text-slate-900">
                      {formatCurrency(methodItem.total)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Panel (Collapsible) */}
      {showFilters && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
              Filtros Avançados
            </span>
            <button
              onClick={() => {
                resetFilters();
                setActiveBreakdownFilter({ type: 'ALL' });
                setActiveTabStatus('ALL');
              }}
              className="text-[11px] text-slate-500 hover:text-emerald-600 font-bold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Limpar Filtros
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
            {/* Search */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Pesquisar Texto
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={filters.searchQuery}
                  onChange={(e) => setFilters((p) => ({ ...p, searchQuery: e.target.value }))}
                  placeholder="Ex: Mercado, Netflix, SELFIT..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            {/* Reference Month Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Visualização de Mês
              </label>
              <select
                value={filters.referenceMonth}
                onChange={(e) => setFilters((p) => ({ ...p, referenceMonth: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium cursor-pointer"
              >
                <option value="SELECTED">Somente Mês Selecionado ({getMonthName(selectedMonth)})</option>
                <option value="ALL">Todos os Meses (Geral)</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Categoria
              </label>
              <select
                value={filters.categoryId}
                onChange={(e) => setFilters((p) => ({ ...p, categoryId: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium cursor-pointer"
              >
                <option value="ALL">Todas as Categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Forma de Pagamento
              </label>
              <select
                value={filters.paymentMethod}
                onChange={(e) => setFilters((p) => ({ ...p, paymentMethod: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium cursor-pointer"
              >
                <option value="ALL">Todas as Formas</option>
                <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                <option value="PIX">Pix</option>
                <option value="CARTAO_DEBITO">Cartão de Débito</option>
                <option value="BOLETO">Boleto</option>
                <option value="DINHEIRO">Dinheiro</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium cursor-pointer"
              >
                <option value="ALL">Todos os Status</option>
                <option value="PAGA">Apenas Pagas</option>
                <option value="PENDENTE">Apenas Pendentes</option>
              </select>
            </div>

            {/* Card */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Filtrar por Cartão
              </label>
              <select
                value={filters.cardId}
                onChange={(e) => setFilters((p) => ({ ...p, cardId: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium cursor-pointer"
              >
                <option value="ALL">Todos os Cartões</option>
                {creditCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.bank})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Main Expenses Table Container */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Instant Search Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-white">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <input
                id="expenses-instant-search-input"
                type="text"
                value={filters.searchQuery}
                onChange={(e) => setFilters((p) => ({ ...p, searchQuery: e.target.value }))}
                placeholder="Buscar por descrição, categoria, data (ex: 21/08, 2026-08), cartão ou notas..."
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-2xs focus:ring-2 focus:ring-emerald-500/20"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              {filters.searchQuery && (
                <button
                  type="button"
                  onClick={() => setFilters((p) => ({ ...p, searchQuery: '' }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition-colors cursor-pointer"
                  title="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {filters.searchQuery && (
              <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
                  {displayedExpenses.length} resultado(s) encontrado(s)
                </span>
                <button
                  type="button"
                  onClick={() => setFilters((p) => ({ ...p, searchQuery: '' }))}
                  className="text-xs text-slate-500 hover:text-rose-600 font-bold px-2 py-1.5 transition-colors cursor-pointer"
                >
                  Limpar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Table Sub-Header with Quick Status Tabs & Selection Actions */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTabStatus('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTabStatus === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Todas as Despesas ({countAll})
            </button>
            <button
              onClick={() => setActiveTabStatus('PENDENTE')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTabStatus === 'PENDENTE'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pendentes ({countPending})</span>
            </button>
            <button
              onClick={() => setActiveTabStatus('PAGA')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTabStatus === 'PAGA'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Pagas ({countPaid})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {displayedExpenses.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAllDisplayed}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Selecionar ou desmarcar todas as despesas exibidas nesta lista"
              >
                {displayedExpenses.length > 0 && displayedExpenses.every((e) => selectedExpenseIds.has(e.id)) ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Desmarcar Todas ({displayedExpenses.length})</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                    <span>Selecionar Todas ({displayedExpenses.length})</span>
                  </>
                )}
              </button>
            )}

            {activeBreakdownFilter.type !== 'ALL' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-purple-800 font-bold bg-purple-50 px-3 py-1 rounded-xl border border-purple-200 flex items-center gap-1.5 shadow-xs">
                  {activeBreakdownFilter.type === 'CARD' ? (
                    <CardIcon className="w-3.5 h-3.5 text-purple-600" />
                  ) : (
                    <Zap className="w-3.5 h-3.5 text-teal-600" />
                  )}
                  <span>
                    Exibindo apenas:{' '}
                    <strong>
                      {activeBreakdownFilter.type === 'CARD'
                        ? activeBreakdownFilter.name
                        : activeBreakdownFilter.label}
                    </strong>{' '}
                    ({displayedExpenses.length})
                  </span>
                </span>
                <button
                  onClick={() => setActiveBreakdownFilter({ type: 'ALL' })}
                  className="text-[11px] text-slate-500 hover:text-slate-900 font-bold underline cursor-pointer"
                >
                  Limpar Filtro
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Category Filter Bar */}
        {monthCategoriesSummary.length > 0 && (
          <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Tag className="w-3 h-3 text-slate-400" />
              Categorias:
            </span>
            <button
              onClick={() => setFilters((p) => ({ ...p, categoryId: 'ALL' }))}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                filters.categoryId === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Todas ({monthCategoriesSummary.reduce((acc, c) => acc + c.count, 0)})
            </button>
            {monthCategoriesSummary.map((cat) => {
              const isSelected =
                filters.categoryId === cat.id ||
                filters.categoryId.toLowerCase().trim() === cat.name.toLowerCase().trim();
              return (
                <button
                  key={cat.id || cat.name}
                  onClick={() =>
                    setFilters((p) => ({
                      ...p,
                      categoryId: isSelected ? 'ALL' : cat.name,
                    }))
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
            {filters.categoryId !== 'ALL' && (
              <button
                onClick={() => setFilters((p) => ({ ...p, categoryId: 'ALL' }))}
                className="text-[11px] text-slate-400 hover:text-rose-600 font-bold shrink-0 underline ml-1 cursor-pointer"
              >
                Limpar Categoria
              </button>
            )}
          </div>
        )}

        {/* Expenses Table (Desktop) & Mobile Cards List (Mobile/Tablet) */}
        {displayedExpenses.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 mb-3 shadow-xs">
              <Receipt className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-extrabold text-slate-800">
              Nenhuma despesa para {getMonthName(selectedMonth)}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1.5 mb-5 leading-relaxed">
              Não há lançamentos de despesas cadastrados para este mês com os filtros atuais.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenExpenseModal()}
                className="px-4 py-2.5 bg-emerald-600 text-white text-xs font-extrabold rounded-2xl hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
              >
                + Adicionar Despesa
              </button>
              {onOpenImportExcel && (
                <button
                  onClick={onOpenImportExcel}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold rounded-2xl transition-colors cursor-pointer"
                >
                  Importar Planilha
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Mobile & Tablet Card List View */}
            <div className="block lg:hidden divide-y divide-slate-100">
              {displayedExpenses.map((expense) => {
                const card = creditCards.find((c) => c.id === expense.cardId);
                const isPaid = expense.status === 'PAGA';
                const isSelected = selectedExpenseIds.has(expense.id);

                return (
                  <div
                    key={`mobile-${expense.id}`}
                    className={`p-4 transition-colors flex flex-col gap-3 ${
                      isSelected
                        ? 'bg-rose-50/40 border-l-4 border-rose-500'
                        : isPaid
                        ? 'bg-emerald-50/20'
                        : 'bg-white'
                    }`}
                  >
                    {/* Top Row: Multi-select Checkbox, Quick Paid Toggle, Description & Amount */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        {/* Multi-Select Checkbox */}
                        <div className="pt-0.5 shrink-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectExpense(expense.id)}
                            className="w-5 h-5 rounded-md text-rose-600 border-slate-300 focus:ring-rose-500 cursor-pointer"
                            title="Selecionar despesa para ação em lote"
                          />
                        </div>

                        {/* Checkbox Quick Paid Toggle */}
                        <button
                          type="button"
                          onClick={() => toggleExpenseStatus(expense.id, expense.status)}
                          className={`w-7 h-7 rounded-xl border flex items-center justify-center transition-all cursor-pointer shrink-0 mt-0.5 ${
                            isPaid
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                              : 'border-slate-300 hover:border-emerald-500 bg-white text-transparent'
                          }`}
                          title={isPaid ? 'Marcar como Pendente' : 'Marcar como Paga'}
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                        </button>

                        <div className="flex flex-col min-w-0">
                          <span
                            className={`font-black text-sm tracking-tight leading-snug break-words ${
                              isPaid ? 'line-through text-slate-500' : 'text-slate-900'
                            }`}
                          >
                            {expense.description}
                          </span>
                          {expense.notes && (
                            <span className="text-[11px] text-slate-400 font-normal mt-0.5 line-clamp-2">
                              {expense.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-base font-black tracking-tight ${
                            isPaid ? 'text-slate-500' : 'text-slate-900'
                          }`}
                        >
                          {formatCurrency(expense.amount)}
                        </span>
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={() => toggleExpenseStatus(expense.id, expense.status)}
                            className={`px-2.5 py-1 rounded-full text-[9px] font-black cursor-pointer inline-flex items-center gap-1 shadow-2xs ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {isPaid ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>PAGA</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>PENDENTE</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Middle Row: Category, Date, Payment Method */}
                    <div className="flex items-center justify-between text-xs flex-wrap gap-2 pt-2 border-t border-slate-100/80">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Category badge */}
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg font-bold text-[10px]">
                          {expense.categoryName || 'Geral'}
                        </span>

                        {/* Date badge */}
                        <span className="text-[10px] text-slate-400 font-medium font-mono flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {formatDateBR(expense.date)}
                        </span>
                      </div>

                      {/* Payment Method / Card */}
                      <div className="flex items-center gap-1.5">
                        {expense.paymentMethod === 'CARTAO_CREDITO' ? (
                          <div className="flex items-center gap-1 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-lg">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: card?.color || '#6366F1' }}
                            />
                            <span className="text-[10px] font-black text-purple-900 truncate max-w-[110px]">
                              {card ? card.name.toUpperCase() : (expense.cardName || 'CARTÃO').toUpperCase()}
                            </span>
                            {expense.isInstallment && (
                              <span className="text-[9px] font-extrabold text-purple-700 ml-0.5">
                                {expense.isIndefinite ? '∞' : `${expense.installmentNumber}/${expense.totalInstallments}`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg font-bold text-[10px]">
                            {expense.paymentMethod === 'PIX'
                              ? 'Pix'
                              : expense.paymentMethod === 'CARTAO_DEBITO'
                              ? 'Débito'
                              : expense.paymentMethod === 'BOLETO'
                              ? 'Boleto'
                              : 'Dinheiro'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100/60">
                      {expense.isInstallment && expense.isIndefinite && expense.installmentPurchaseId && (
                        <button
                          onClick={async () => {
                            if (
                              window.confirm(
                                'Deseja interromper este lançamento contínuo a partir deste mês? As cobranças futuras serão canceladas.'
                              )
                            ) {
                              await interruptInstallmentPurchase(
                                expense.installmentPurchaseId!,
                                expense.referenceMonth
                              );
                            }
                          }}
                          className="px-2.5 py-1 text-amber-600 hover:text-amber-800 bg-amber-50 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Interromper</span>
                        </button>
                      )}

                      <button
                        onClick={() => onOpenExpenseModal(expense)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>

                      <button
                        onClick={() => onDeleteExpense(expense)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/70">
                  <tr className="h-11">
                    {/* Master Checkbox Header */}
                    <th className="font-extrabold px-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={displayedExpenses.length > 0 && displayedExpenses.every((e) => selectedExpenseIds.has(e.id))}
                        ref={(el) => {
                          if (el) {
                            const someSelected = displayedExpenses.some((e) => selectedExpenseIds.has(e.id));
                            const allSelected = displayedExpenses.length > 0 && displayedExpenses.every((e) => selectedExpenseIds.has(e.id));
                            el.indeterminate = someSelected && !allSelected;
                          }
                        }}
                        onChange={toggleSelectAllDisplayed}
                        className="w-4 h-4 rounded text-rose-600 border-slate-300 focus:ring-rose-500 cursor-pointer"
                        title="Selecionar ou desmarcar todas as despesas exibidas"
                      />
                    </th>
                    <th className="font-extrabold px-3 text-center w-12">Pago</th>
                    <th className="font-extrabold py-2">Descrição</th>
                    <th className="font-extrabold py-2">Categoria</th>
                    <th className="font-extrabold py-2 text-center">Data</th>
                    <th className="font-extrabold py-2">Forma / Cartão & Parcela</th>
                    <th className="font-extrabold py-2 text-right">Valor</th>
                    <th className="font-extrabold py-2 text-center">Status</th>
                    <th className="font-extrabold py-2 text-right pr-4">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-100">
                  {displayedExpenses.map((expense) => {
                    const card = creditCards.find((c) => c.id === expense.cardId);
                    const isPaid = expense.status === 'PAGA';
                    const isSelected = selectedExpenseIds.has(expense.id);

                    return (
                      <tr
                        key={expense.id}
                        className={`hover:bg-slate-50/90 transition-colors h-14 ${
                          isSelected
                            ? 'bg-rose-50/30'
                            : isPaid
                            ? 'bg-emerald-50/20'
                            : ''
                        }`}
                      >
                        {/* Multi-Select Row Checkbox */}
                        <td className="px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectExpense(expense.id)}
                            className="w-4 h-4 rounded text-rose-600 border-slate-300 focus:ring-rose-500 cursor-pointer"
                            title="Selecionar esta despesa"
                          />
                        </td>

                        {/* Checkbox Quick Paid Toggle */}
                        <td className="px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleExpenseStatus(expense.id, expense.status)}
                            className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all cursor-pointer mx-auto ${
                              isPaid
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                                : 'border-slate-300 hover:border-emerald-500 bg-white text-transparent'
                            }`}
                            title={isPaid ? 'Marcar como Pendente' : 'Marcar como Paga'}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        </td>

                        {/* Description & Notes */}
                        <td className="font-bold text-slate-800 pr-2 py-2.5">
                          <div className="flex flex-col">
                            <span className={isPaid ? 'line-through text-slate-500' : 'text-slate-900'}>
                              {expense.description}
                            </span>
                            {expense.notes && (
                              <span className="text-[10px] text-slate-400 font-normal truncate max-w-xs">
                                {expense.notes}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Category */}
                        <td className="text-slate-500 font-medium whitespace-nowrap py-2.5">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold text-[10px]">
                            {expense.categoryName || 'Geral'}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="text-center text-slate-500 font-mono whitespace-nowrap py-2.5">
                          {formatDateBR(expense.date)}
                        </td>

                        {/* Payment Method / Card & Installment Breakdown */}
                        <td className="text-slate-600 font-medium whitespace-nowrap py-2.5">
                          {(() => {
                            const isPix = isPixExpense(expense, categories);
                            const isBoleto = !isPix && isBoletoExpense(expense, categories);
                            const isDebit = !isPix && !isBoleto && isDebitExpense(expense, categories);
                            const isCash = !isPix && !isBoleto && !isDebit && isCashExpense(expense, categories);
                            const isCreditCard = !isPix && !isBoleto && !isDebit && !isCash && expense.paymentMethod === 'CARTAO_CREDITO';

                            if (isCreditCard) {
                              return (
                                <div className="flex flex-col gap-1">
                                  {/* Card Name */}
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                                      style={{ backgroundColor: card?.color || '#6366F1' }}
                                    />
                                    <span className="text-xs font-black text-slate-900">
                                      {card ? card.name.toUpperCase() : (expense.cardName || 'CARTÃO DE CRÉDITO').toUpperCase()}
                                    </span>
                                    {card?.bank && (
                                      <span className="text-[10px] text-slate-400 font-semibold">
                                        ({card.bank})
                                      </span>
                                    )}
                                  </div>

                                  {/* Installment Badge */}
                                  {expense.isInstallment && (
                                    <div className="flex items-center gap-1">
                                      {expense.isIndefinite ? (
                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[9px] font-extrabold flex items-center gap-1">
                                          <InfinityIcon className="w-2.5 h-2.5" />
                                          Mês {expense.installmentNumber} (Indeterminado)
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded-md text-[10px] font-black tracking-tight">
                                          Parcela {expense.installmentNumber}/{expense.totalInstallments}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            const methodLabel = isPix
                              ? 'Pix'
                              : isBoleto
                              ? 'Boleto Bancário'
                              : isDebit
                              ? 'Cartão de Débito'
                              : isCash
                              ? 'Dinheiro em Espécie'
                              : expense.paymentMethod === 'PIX'
                              ? 'Pix'
                              : expense.paymentMethod === 'CARTAO_DEBITO'
                              ? 'Cartão de Débito'
                              : expense.paymentMethod === 'BOLETO'
                              ? 'Boleto Bancário'
                              : 'Outro';

                            const dotColor = isPix
                              ? '#0D9488'
                              : isBoleto
                              ? '#D97706'
                              : isDebit
                              ? '#2563EB'
                              : '#059669';

                            return (
                              <div className="flex flex-col gap-1 items-start">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: dotColor }}
                                  />
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md font-bold text-[10px]">
                                    {methodLabel}
                                  </span>
                                </div>
                                {expense.isInstallment && (
                                  <div className="flex items-center gap-1">
                                    {expense.isIndefinite ? (
                                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[9px] font-extrabold flex items-center gap-1">
                                        <InfinityIcon className="w-2.5 h-2.5" />
                                        Mês {expense.installmentNumber} (Indeterminado)
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded-md text-[10px] font-black tracking-tight">
                                        Parcela {expense.installmentNumber}/{expense.totalInstallments}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* Amount */}
                        <td className="text-right font-black text-slate-900 whitespace-nowrap py-2.5">
                          {formatCurrency(expense.amount)}
                        </td>

                        {/* Status Toggle Button (PAGA / PENDENTE) */}
                        <td className="text-center whitespace-nowrap py-2.5">
                          <button
                            type="button"
                            onClick={() => toggleExpenseStatus(expense.id, expense.status)}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-black cursor-pointer transition-all inline-flex items-center gap-1.5 shadow-xs ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200'
                            }`}
                            title="Clique para alternar entre Paga e Pendente"
                          >
                            {isPaid ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>PAGA</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>PENDENTE</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="text-right pr-4 whitespace-nowrap py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            {expense.isInstallment && expense.isIndefinite && expense.installmentPurchaseId && (
                              <button
                                onClick={async () => {
                                 if (
                                    window.confirm(
                                      'Deseja interromper este lançamento contínuo a partir deste mês? As cobranças futuras serão canceladas.'
                                    )
                                  ) {
                                    await interruptInstallmentPurchase(
                                      expense.installmentPurchaseId!,
                                      expense.referenceMonth
                                    );
                                  }
                                }}
                                className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-xl transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                                title="Interromper cobrança contínua a partir deste mês"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => onOpenExpenseModal(expense)}
                              className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                              title="Editar Despesa"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteExpense(expense)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="Excluir Despesa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Floating Bulk Action Bar (appears when 1 or more expenses are selected) */}
      {selectedExpenseIds.size > 0 && (
        <div className="fixed bottom-6 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3.5 rounded-3xl shadow-2xl border border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-2xl w-full animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <span className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 font-extrabold flex items-center justify-center text-xs shrink-0 border border-rose-500/30">
              {selectedExpenseIds.size}
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-black text-slate-100">
                {selectedExpenseIds.size} {selectedExpenseIds.size === 1 ? 'despesa selecionada' : 'despesas selecionadas'}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Total: <strong className="text-white">{formatCurrency(selectedTotalAmount)}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedExpenseIds(new Set())}
              className="sm:hidden text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              Limpar
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            <button
              type="button"
              onClick={() => handleBulkMarkStatus('PAGA')}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Marcar todas selecionadas como Pagas"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Marcar</span> Pagas
            </button>

            <button
              type="button"
              onClick={() => handleBulkMarkStatus('PENDENTE')}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Marcar todas selecionadas como Pendentes"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Marcar</span> Pendentes
            </button>

            <button
              type="button"
              onClick={() => setBulkDeleteModalOpen(true)}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Excluir despesas selecionadas permanentemente do banco de dados"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedExpenseIds(new Set())}
              className="hidden sm:flex px-2.5 py-2 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-colors items-center gap-1 cursor-pointer"
              title="Desmarcar todas"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      <ConfirmDeleteModal
        isOpen={bulkDeleteModalOpen}
        title="Excluir Despesas Selecionadas"
        description={`Tem certeza que deseja excluir ${selectedExpenseIds.size} despesas selecionadas permanentemente do banco de dados?`}
        selectedCount={selectedExpenseIds.size}
        hasInstallmentsInSelection={hasInstallmentsInSelection}
        onConfirm={handleConfirmBulkDelete}
        onClose={() => setBulkDeleteModalOpen(false)}
      />

      {/* Modal de Prorrogação de Lançamento por Prazo Indeterminado */}
      <ExtendIndefiniteModal
        isOpen={!!extendModalPurchase}
        purchase={extendModalPurchase}
        onClose={() => setExtendModalPurchase(null)}
        onExtend={async (purchaseId, months, amount) => {
          await extendIndefinitePurchase(purchaseId, months, amount);
        }}
        onInterrupt={async (purchaseId) => {
          await interruptInstallmentPurchase(purchaseId);
        }}
      />
    </div>
  );
};
