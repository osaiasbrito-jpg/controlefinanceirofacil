import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard as CardIcon,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieIcon,
  BarChart3,
  Calendar,
  Layers,
  Sparkles,
  Percent,
  DollarSign,
  ShieldCheck,
  LayoutDashboard,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { useFinance } from '../context/FinanceContext';
import {
  formatCurrency,
  getMonthName,
  getShortMonthName,
  getAdjacentMonth,
  getCurrentMonth,
} from '../utils/formatters';
import { calculateMonthSummary } from '../utils/calculations';
import { resolveEffectivePaymentMethod } from '../utils/cardUtils';
import { Expense, ActiveTab, InstallmentPurchase } from '../types';
import { GeminiFinancialCard } from './GeminiFinancialCard';
import { UpcomingDueAlerts } from './UpcomingDueAlerts';
import { NonRecurringExpensesSummary } from './NonRecurringExpensesSummary';
import { IndefiniteEndingAlerts } from './IndefiniteEndingAlerts';
import { ExtendIndefiniteModal } from './modals/ExtendIndefiniteModal';

interface DashboardViewProps {
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenExpenseModal: () => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expense: Expense) => void;
  onOpenCardModal: () => void;
}

const CATEGORY_COLORS = [
  '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#64748B',
  '#14B8A6', '#6366F1',
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateTab,
  onOpenExpenseModal,
  onEditExpense,
  onDeleteExpense,
  onOpenCardModal,
}) => {
  const {
    selectedMonth,
    setSelectedMonth,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    monthSummary,
    monthInstallmentsAndSingleSummary,
    expenses,
    salaries,
    incomes,
    creditCards,
    cardLimitSummaries,
    categories,
    paymentMethods,
    installmentPurchases,
    extendIndefinitePurchase,
    interruptInstallmentPurchase,
  } = useFinance();

  const [chartViewMode, setChartViewMode] = useState<'month' | 'evolution'>('month');
  const [extendModalPurchase, setExtendModalPurchase] = useState<InstallmentPurchase | null>(null);

  // Filter current month expenses
  const monthExpenses = useMemo(
    () => expenses.filter((e) => e.referenceMonth === selectedMonth),
    [expenses, selectedMonth]
  );

  // Primary active credit card for showcase
  const primaryCardSummary = useMemo(
    () => cardLimitSummaries.find((c) => c.card.isActive) || cardLimitSummaries[0],
    [cardLimitSummaries]
  );

  // 1. Single Month Comparison Data (Receitas vs Despesas vs Saldo)
  const monthComparisonData = useMemo(() => {
    return [
      {
        name: 'Receitas',
        valor: monthSummary.totalRevenue,
        fill: '#10B981',
      },
      {
        name: 'Despesas',
        valor: monthSummary.totalExpenses,
        fill: '#F43F5E',
      },
      {
        name: 'Saldo',
        valor: Math.max(0, monthSummary.totalBalance),
        fill: '#6366F1',
      },
    ];
  }, [monthSummary]);

  // 2. 6-Month Evolution Data for Recharts
  const sixMonthsData = useMemo(() => {
    const list = [];
    for (let i = 5; i >= 0; i--) {
      const m = getAdjacentMonth(selectedMonth, -i);
      const summary = calculateMonthSummary(m, salaries, incomes, expenses);
      list.push({
        referenceMonth: m,
        mes: getShortMonthName(m),
        nomeCompleto: getMonthName(m),
        Receitas: summary.totalRevenue,
        Despesas: summary.totalExpenses,
        Saldo: summary.totalBalance,
      });
    }
    return list;
  }, [selectedMonth, salaries, incomes, expenses]);

  // 3. Category Breakdown Data for Donut Chart
  const categoryChartData = useMemo(() => {
    const total = monthSummary.totalExpenses || 1;
    const catMap = new Map<string, { name: string; value: number; color: string }>();

    for (const exp of monthExpenses) {
      const catName = exp.categoryName || 'Outros';
      const existing = catMap.get(catName);
      const catDef = categories.find((c) => c.name === catName);
      const color = catDef?.color || CATEGORY_COLORS[catMap.size % CATEGORY_COLORS.length];

      if (existing) {
        existing.value += exp.amount;
      } else {
        catMap.set(catName, { name: catName, value: exp.amount, color });
      }
    }

    return Array.from(catMap.values())
      .map((item) => ({
        ...item,
        percentage: Math.round((item.value / total) * 100),
      }))
      .sort((a, b) => b.value - a.value);
  }, [monthExpenses, monthSummary.totalExpenses, categories]);

  // 4. Revenue Composition (Salário vs Renda Extra)
  const revenueCompositionData = useMemo(() => {
    const total = monthSummary.totalRevenue || 1;
    const data = [];
    if (monthSummary.totalSalary > 0) {
      data.push({
        name: 'Salário Base',
        value: monthSummary.totalSalary,
        color: '#10B981',
        percentage: Math.round((monthSummary.totalSalary / total) * 100),
      });
    }
    if (monthSummary.totalExtraIncome > 0) {
      data.push({
        name: 'Renda Extra',
        value: monthSummary.totalExtraIncome,
        color: '#3B82F6',
        percentage: Math.round((monthSummary.totalExtraIncome / total) * 100),
      });
    }
    if (data.length === 0) {
      data.push({ name: 'Sem Receitas', value: 1, color: '#E2E8F0', percentage: 100 });
    }
    return data;
  }, [monthSummary]);

  // 5. Payment Methods Distribution Data
  const paymentMethodsData = useMemo(() => {
    const map = new Map<string, { name: string; value: number; color: string }>();
    const colorMap: Record<string, string> = {
      CARTAO_CREDITO: '#8B5CF6',
      PIX: '#0D9488',
      BOLETO: '#D97706',
      CARTAO_DEBITO: '#2563EB',
      DINHEIRO: '#059669',
      OUTRO: '#64748B',
    };

    for (const exp of monthExpenses) {
      const method = resolveEffectivePaymentMethod(exp, categories, creditCards);
      const label =
        method === 'CARTAO_CREDITO'
          ? 'Cartão de Crédito'
          : method === 'PIX'
          ? 'Pix'
          : method === 'BOLETO'
          ? 'Boleto'
          : method === 'CARTAO_DEBITO'
          ? 'Débito'
          : method === 'DINHEIRO'
          ? 'Dinheiro'
          : 'Outros';

      const existing = map.get(label);
      if (existing) {
        existing.value += exp.amount;
      } else {
        map.set(label, {
          name: label,
          value: exp.amount,
          color: colorMap[method] || '#64748B',
        });
      }
    }

    const total = monthSummary.totalExpenses || 1;
    return Array.from(map.values())
      .map((item) => ({
        ...item,
        percentage: Math.round((item.value / total) * 100),
      }))
      .sort((a, b) => b.value - a.value);
  }, [monthExpenses, monthSummary.totalExpenses, categories, creditCards]);

  // Key Financial Health Ratios
  const incomeCommitmentRate = useMemo(() => {
    if (monthSummary.totalRevenue <= 0) return 0;
    return Math.min(100, Math.round((monthSummary.totalExpenses / monthSummary.totalRevenue) * 100));
  }, [monthSummary]);

  const savingsRate = useMemo(() => {
    if (monthSummary.totalRevenue <= 0) return 0;
    return Math.max(0, Math.round((monthSummary.totalBalance / monthSummary.totalRevenue) * 100));
  }, [monthSummary]);

  const paidRate = useMemo(() => {
    if (monthSummary.totalExpenses <= 0) return 0;
    return Math.min(100, Math.round((monthSummary.paidExpenses / monthSummary.totalExpenses) * 100));
  }, [monthSummary]);

  // Custom tooltip for currency values
  const CustomCurrencyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl border border-slate-800 text-xs">
          <p className="font-extrabold text-slate-200 mb-1">{label || payload[0]?.name}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center gap-2 my-0.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: entry.color || entry.fill || '#10B981' }}
              />
              <span className="text-slate-300 font-medium">{entry.name || 'Valor'}:</span>
              <span className="font-bold text-white font-mono">
                {formatCurrency(Number(entry.value))}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 pb-12">
      {/* Month Navigation Header */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shadow-xs">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Visão Geral Financeira
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Gráficos e comparativos de receitas, despesas, cartões e saldo do mês
          </p>
        </div>

        {/* Month Navigation Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end bg-slate-50 p-1.5 rounded-2xl border border-slate-200/80">
          <button
            onClick={goToPreviousMonth}
            className="p-2 rounded-xl bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            title="Mês Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-extrabold text-xs sm:text-sm text-slate-900 capitalize tracking-tight">
              {getMonthName(selectedMonth)}
            </span>
            {selectedMonth === getCurrentMonth() && (
              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-md ml-1">
                Atual
              </span>
            )}
          </div>

          <button
            onClick={goToNextMonth}
            className="p-2 rounded-xl bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            title="Próximo Mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {selectedMonth !== getCurrentMonth() && (
            <button
              onClick={goToCurrentMonth}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-extrabold transition-colors cursor-pointer shadow-2xs"
              title="Voltar ao Mês Atual"
            >
              Mês Atual
            </button>
          )}
        </div>
      </div>

      {/* 4 Top Summary Bento Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 shrink-0">
        {/* Receita Total */}
        <div
          id="dashboard-card-receitas"
          onClick={() => onNavigateTab('receitas')}
          className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Receita Total
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight">
              {formatCurrency(monthSummary.totalRevenue)}
            </div>
          </div>
          <div className="text-[11px] mt-3 text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2 font-medium">
            <span>Salário: {formatCurrency(monthSummary.totalSalary)}</span>
            <span className="text-emerald-600 font-bold">+ Extra: {formatCurrency(monthSummary.totalExtraIncome)}</span>
          </div>
        </div>

        {/* Total Despesas */}
        <div
          id="dashboard-card-despesas"
          onClick={() => onNavigateTab('despesas')}
          className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-rose-300 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Total Despesas
              </span>
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-500 tracking-tight">
              {formatCurrency(monthSummary.totalExpenses)}
            </div>
          </div>
          <div className="text-[11px] mt-3 text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2 font-medium">
            <span>{monthSummary.expensesCount} lançamentos</span>
            <span className="text-rose-600 font-bold">Cartão: {formatCurrency(monthSummary.creditCardInvoiceTotal)}</span>
          </div>
        </div>

        {/* Saldo Total */}
        <div
          id="dashboard-card-saldo"
          className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Saldo (Salário + Extra)
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                monthSummary.totalBalance >= 0 ? 'text-slate-900' : 'text-rose-600'
              }`}
            >
              {formatCurrency(monthSummary.totalBalance)}
            </div>
          </div>
          <div className="text-[11px] mt-3 text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2 font-medium">
            <span>Saldo Salário:</span>
            <span
              className={`font-bold ${
                monthSummary.salaryBalance >= 0 ? 'text-indigo-600' : 'text-rose-600'
              }`}
            >
              {formatCurrency(monthSummary.salaryBalance)}
            </span>
          </div>
        </div>

        {/* Despesas Pendentes */}
        <div
          id="dashboard-card-pendentes"
          onClick={() => onNavigateTab('despesas')}
          className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-amber-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Despesas Pendentes
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight">
              {formatCurrency(monthSummary.pendingExpenses)}
            </div>
          </div>
          <div className="text-[11px] mt-3 text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2 font-medium">
            <span className="text-emerald-700 font-bold">Pagas: {formatCurrency(monthSummary.paidExpenses)}</span>
            <span className="text-amber-600 font-bold">A pagar</span>
          </div>
        </div>
      </div>

      {/* Sleek Visual Due Alerts Banner */}
      <UpcomingDueAlerts
        onNavigateTab={onNavigateTab}
        onOpenExpenseModal={onOpenExpenseModal}
      />

      {/* Indefinite Continuous Subscriptions Expiry Alerts */}
      <IndefiniteEndingAlerts
        selectedMonth={selectedMonth}
        installmentPurchases={installmentPurchases}
        expenses={expenses}
        onOpenExtendModal={(purchase) => setExtendModalPurchase(purchase)}
      />

      {/* Resumo de Últimas Parcelas e Compras à Vista (Não-Recorrentes) */}
      <NonRecurringExpensesSummary
        summary={monthInstallmentsAndSingleSummary}
      />

      {/* INDICATORS OF FINANCIAL HEALTH BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Comprometimento de Renda */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Comprometimento de Renda</span>
            <span
              className={`text-xs font-black px-2 py-0.5 rounded-md ${
                incomeCommitmentRate > 80
                  ? 'bg-rose-100 text-rose-700'
                  : incomeCommitmentRate > 60
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {incomeCommitmentRate}%
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                incomeCommitmentRate > 80 ? 'bg-rose-500' : incomeCommitmentRate > 60 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${incomeCommitmentRate}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 mt-2 font-medium">
            {incomeCommitmentRate <= 60
              ? 'Excelente: gastos controlados abaixo de 60% da receita'
              : incomeCommitmentRate <= 80
              ? 'Atenção: despesas próximas do limite ideal'
              : 'Crítico: gastos ultrapassam 80% das receitas'}
          </span>
        </div>

        {/* Taxa de Economia / Poupança */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Taxa de Poupança / Sobra</span>
            <span className="text-xs font-black px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700">
              {savingsRate}%
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-700"
              style={{ width: `${savingsRate}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 mt-2 font-medium">
            Sobra livre de {formatCurrency(monthSummary.totalBalance)} após todas as despesas
          </span>
        </div>

        {/* Taxa de Contas Quitadas */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Contas Pagas no Mês</span>
            <span className="text-xs font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
              {paidRate}%
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${paidRate}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 mt-2 font-medium">
            {formatCurrency(monthSummary.paidExpenses)} pagas de {formatCurrency(monthSummary.totalExpenses)}
          </span>
        </div>
      </div>

      {/* MAIN GRAPHS ROW: Receitas vs Despesas (Left 8 cols) & Categorias Donut (Right 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Chart 1: Balanço Mensal & Evolução Financeira (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                  {chartViewMode === 'month'
                    ? `Balanço de ${getMonthName(selectedMonth)}`
                    : 'Evolução Semestral (Receitas vs Despesas)'}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {chartViewMode === 'month'
                  ? 'Comparativo direto entre receitas arrecadadas, despesas totais e saldo'
                  : 'Acompanhamento do histórico financeiro dos últimos 6 meses'}
              </p>
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 shrink-0">
              <button
                id="btn-chart-month"
                onClick={() => setChartViewMode('month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartViewMode === 'month'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Mês Atual
              </button>
              <button
                id="btn-chart-evolution"
                onClick={() => setChartViewMode('evolution')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartViewMode === 'evolution'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Últimos 6 Meses
              </button>
            </div>
          </div>

          {/* Chart Rendering */}
          <div className="h-[280px] sm:h-[320px] w-full">
            {chartViewMode === 'month' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthComparisonData} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="name"
                    stroke="#94A3B8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `R$ ${(val / 1000).toFixed(val >= 1000 ? 1 : 0)}k`}
                  />
                  <Tooltip content={<CustomCurrencyTooltip />} />
                  <Bar
                    dataKey="valor"
                    radius={[10, 10, 0, 0]}
                    maxBarSize={70}
                  >
                    {monthComparisonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sixMonthsData} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="mes"
                    stroke="#94A3B8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `R$ ${(val / 1000).toFixed(val >= 1000 ? 1 : 0)}k`}
                  />
                  <Tooltip content={<CustomCurrencyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Area
                    type="monotone"
                    dataKey="Receitas"
                    stroke="#10B981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorReceitas)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Despesas"
                    stroke="#F43F5E"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorDespesas)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Quick Summary Footer */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 text-center">
            <div className="p-2 rounded-xl bg-emerald-50/50">
              <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">
                Total Receitas
              </span>
              <span className="text-sm sm:text-base font-black text-emerald-600">
                {formatCurrency(monthSummary.totalRevenue)}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-rose-50/50">
              <span className="text-[10px] text-rose-800 font-bold uppercase tracking-wider block">
                Total Despesas
              </span>
              <span className="text-sm sm:text-base font-black text-rose-500">
                {formatCurrency(monthSummary.totalExpenses)}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-indigo-50/50">
              <span className="text-[10px] text-indigo-800 font-bold uppercase tracking-wider block">
                Saldo Livre
              </span>
              <span
                className={`text-sm sm:text-base font-black ${
                  monthSummary.totalBalance >= 0 ? 'text-indigo-600' : 'text-rose-600'
                }`}
              >
                {formatCurrency(monthSummary.totalBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* Main Chart 2: Gastos por Categoria (Donut Chart) (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-purple-600" />
              <h3 className="font-extrabold text-slate-900 text-base">Despesas por Categoria</h3>
            </div>
            <button
              onClick={() => onNavigateTab('relatorios')}
              className="text-[11px] text-emerald-600 font-bold hover:underline cursor-pointer"
            >
              Ver Detalhes
            </button>
          </div>

          {categoryChartData.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 mb-2">
                <PieIcon className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-400 font-medium">Nenhuma despesa cadastrada este mês.</p>
            </div>
          ) : (
            <>
              {/* Donut Chart */}
              <div className="h-[180px] w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-cat-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomCurrencyTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Badge */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total</span>
                  <span className="text-xs font-black text-slate-800">
                    {formatCurrency(monthSummary.totalExpenses)}
                  </span>
                </div>
              </div>

              {/* Category Legend List */}
              <div className="flex flex-col gap-2.5 mt-2 max-h-[160px] overflow-y-auto pr-1">
                {categoryChartData.slice(0, 5).map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-semibold text-slate-700 truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-slate-900 font-mono">
                        {formatCurrency(item.value)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 w-7 text-right">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* SECONDARY ROW: Revenue Composition + Payment Methods + Credit Card Showcase */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Composição de Receitas (Donut) */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  Fontes de Receita
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('receitas')}
                className="text-[11px] text-emerald-600 font-bold hover:underline cursor-pointer"
              >
                Gerenciar
              </button>
            </div>

            <div className="h-[140px] w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueCompositionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {revenueCompositionData.map((entry, index) => (
                      <Cell key={`cell-rev-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomCurrencyTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-2 mt-2 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-600 font-medium">Salário Fixo:</span>
              </div>
              <span className="font-extrabold text-slate-900">
                {formatCurrency(monthSummary.totalSalary)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-slate-600 font-medium">Renda Extra:</span>
              </div>
              <span className="font-extrabold text-blue-600">
                + {formatCurrency(monthSummary.totalExtraIncome)}
              </span>
            </div>
          </div>
        </div>

        {/* Formas de Pagamento no Mês */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  Meios de Pagamento
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('despesas')}
                className="text-[11px] text-indigo-600 font-bold hover:underline cursor-pointer"
              >
                Ver Despesas
              </button>
            </div>

            {paymentMethodsData.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">
                Sem despesas registradas no mês.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 mt-2">
                {paymentMethodsData.map((pm) => (
                  <div key={pm.name} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: pm.color }}
                        />
                        <span className="text-slate-700">{pm.name}</span>
                      </div>
                      <span className="text-slate-900 font-bold font-mono">
                        {formatCurrency(pm.value)} ({pm.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ backgroundColor: pm.color, width: `${pm.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center">
            <span>Total em Cartão:</span>
            <span className="font-extrabold text-purple-700">
              {formatCurrency(monthSummary.creditCardInvoiceTotal)}
            </span>
          </div>
        </div>

        {/* Credit Card Showcase */}
        {primaryCardSummary ? (
          <div
            className="rounded-3xl p-6 text-white shadow-xl flex flex-col justify-between min-h-[220px] relative overflow-hidden transition-all"
            style={{ backgroundColor: primaryCardSummary.card.color || '#1E293B' }}
          >
            <div className="flex justify-between items-start">
              <div className="w-11 h-7 bg-amber-400/20 border border-amber-400/30 rounded-md backdrop-blur-xs flex items-center justify-center">
                <div className="w-6 h-3.5 border-y border-amber-400/40"></div>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-black tracking-widest uppercase opacity-90 block">
                  {primaryCardSummary.card.name}
                </span>
                <span className="text-[9px] opacity-75 font-medium">
                  {primaryCardSummary.card.bank}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[11px] opacity-75 mb-0.5">Limite Disponível</div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {formatCurrency(primaryCardSummary.availableLimit)}
              </div>
              <div className="text-[10px] text-emerald-300 font-bold uppercase mt-1">
                Fatura Atual: {formatCurrency(primaryCardSummary.currentMonthInvoice)} • Vence dia {primaryCardSummary.card.dueDay}
              </div>
            </div>

            <div className="mt-4 bg-white/10 rounded-2xl p-3.5 border border-white/15 backdrop-blur-xs">
              <div className="flex justify-between text-[10px] mb-1.5 opacity-90 font-medium">
                <span>Utilizado: {formatCurrency(primaryCardSummary.usedLimit)}</span>
                <span>Total: {formatCurrency(primaryCardSummary.totalLimit)}</span>
              </div>
              <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    primaryCardSummary.usagePercentage > 80 ? 'bg-rose-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${primaryCardSummary.usagePercentage}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div
            onClick={onOpenCardModal}
            className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-800 transition-colors min-h-[220px]"
          >
            <CardIcon className="w-10 h-10 text-emerald-400 mb-2" />
            <h3 className="font-bold text-sm">Nenhum Cartão Cadastrado</h3>
            <p className="text-xs text-slate-400 mt-1 mb-3">
              Cadastre seus cartões para controlar limite e faturas automaticamente.
            </p>
            <span className="px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs">
              + Cadastrar Cartão
            </span>
          </div>
        )}
      </div>

      {/* Gemini AI Financial Analysis & Savings Card */}
      <GeminiFinancialCard />

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
