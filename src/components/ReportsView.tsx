import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  PieChart as PieIcon,
  Layers,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency, getMonthName, getShortMonthName, getAdjacentMonth } from '../utils/formatters';
import { calculateMonthSummary } from '../utils/calculations';
import { resolveEffectivePaymentMethod } from '../utils/cardUtils';

const COLORS = [
  '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#64748B',
];

export const ReportsView: React.FC = () => {
  const { selectedMonth, salaries, incomes, expenses, categories, creditCards, paymentMethods, monthSummary } = useFinance();
  const [activeTab, setActiveTab] = useState<'evolution' | 'categories' | 'monthBalance'>('evolution');

  // Month-specific expense items
  const monthExpenses = useMemo(
    () => expenses.filter((e) => e.referenceMonth === selectedMonth),
    [expenses, selectedMonth]
  );

  // 6-Month Evolution Data for Recharts BarChart
  const sixMonthsData = useMemo(() => {
    const list = [];
    for (let i = 5; i >= 0; i--) {
      const m = getAdjacentMonth(selectedMonth, -i);
      const summary = calculateMonthSummary(m, salaries, incomes, expenses);
      list.push({
        referenceMonth: m,
        month: getShortMonthName(m),
        fullMonth: getMonthName(m),
        Receitas: summary.totalRevenue,
        Despesas: summary.totalExpenses,
        Saldo: summary.totalBalance,
      });
    }
    return list;
  }, [selectedMonth, salaries, incomes, expenses]);

  // Aggregated totals over the 6-month period
  const totalPeriodRevenue = useMemo(
    () => sixMonthsData.reduce((acc, curr) => acc + curr.Receitas, 0),
    [sixMonthsData]
  );
  const totalPeriodExpenses = useMemo(
    () => sixMonthsData.reduce((acc, curr) => acc + curr.Despesas, 0),
    [sixMonthsData]
  );
  const totalPeriodBalance = totalPeriodRevenue - totalPeriodExpenses;

  // Category distribution data for the selected month
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    for (const exp of monthExpenses) {
      const name = exp.categoryName || 'Outros';
      map.set(name, (map.get(name) || 0) + exp.amount);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthExpenses]);

  // Payment method distribution data
  const paymentMethodData = useMemo(() => {
    const map = new Map<string, number>();
    for (const exp of monthExpenses) {
      const method = resolveEffectivePaymentMethod(exp, categories, creditCards);
      const labelMap: Record<string, string> = {
        PIX: 'Pix',
        CARTAO_CREDITO: 'Cartão de Crédito',
        CARTAO_DEBITO: 'Cartão de Débito',
        BOLETO: 'Boleto',
        DINHEIRO: 'Dinheiro',
      };
      const label = labelMap[method] || method;
      map.set(label, (map.get(label) || 0) + exp.amount);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [monthExpenses, categories, creditCards]);

  // Single month comparison data
  const singleMonthComparisonData = [
    {
      name: getMonthName(selectedMonth),
      Receitas: monthSummary.totalRevenue,
      Despesas: monthSummary.totalExpenses,
      Saldo: Math.max(0, monthSummary.totalBalance),
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 pb-12">
      {/* Header & Tabs */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Relatórios & Análise Visual</h2>
              <p className="text-xs text-slate-500">
                Acompanhe o desempenho financeiro e comparativos de receitas vs despesas
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/60 w-full md:w-auto overflow-x-auto">
          <button
            id="tab-evolution-btn"
            onClick={() => setActiveTab('evolution')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'evolution'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Evolução 6 Meses
          </button>
          <button
            id="tab-categories-btn"
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'categories'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5" />
            Categorias ({getMonthName(selectedMonth).split(' ')[0]})
          </button>
          <button
            id="tab-month-balance-btn"
            onClick={() => setActiveTab('monthBalance')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'monthBalance'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Balanço Mensal
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'evolution' && (
        <div className="flex flex-col gap-6">
          {/* 6-Month Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Receitas (6 Meses)
                </p>
                <h3 className="text-xl font-black text-emerald-600">
                  {formatCurrency(totalPeriodRevenue)}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Despesas (6 Meses)
                </p>
                <h3 className="text-xl font-black text-rose-600">
                  {formatCurrency(totalPeriodExpenses)}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <ArrowDownRight className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Saldo Acumulado
                </p>
                <h3
                  className={`text-xl font-black ${
                    totalPeriodBalance >= 0 ? 'text-blue-600' : 'text-rose-600'
                  }`}
                >
                  {formatCurrency(totalPeriodBalance)}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Gráfico de Barras Principal: Despesas vs Receitas nos últimos 6 meses */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 md:p-8 flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <h3 className="font-extrabold text-slate-900 text-lg">
                    Evolução das Despesas vs Receitas (Últimos 6 Meses)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Comparação direta mês a mês das entradas e saídas financeiras
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
                  <span>Receitas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-rose-500 inline-block" />
                  <span>Despesas</span>
                </div>
              </div>
            </div>

            {/* Recharts BarChart */}
            <div className="h-80 sm:h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sixMonthsData}
                  margin={{ top: 20, right: 20, left: 10, bottom: 5 }}
                  barGap={8}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="month"
                    stroke="#64748B"
                    tick={{ fontSize: 12, fontWeight: 600 }}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis
                    tickFormatter={(val) =>
                      val >= 1000 ? `R$ ${(val / 1000).toFixed(0)}k` : `R$ ${val}`
                    }
                    stroke="#94A3B8"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      formatCurrency(Number(value)),
                      name === 'Receitas' ? 'Receitas Totais' : 'Despesas Totais',
                    ]}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload;
                      return item?.fullMonth || `Mês: ${label}`;
                    }}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '16px',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.08)',
                      padding: '12px 16px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, fontWeight: 600, paddingTop: 16 }}
                    iconType="circle"
                  />
                  <Bar
                    dataKey="Receitas"
                    name="Receitas"
                    fill="#10B981"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  />
                  <Bar
                    dataKey="Despesas"
                    name="Despesas"
                    fill="#EF4444"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gastos por Categoria (Donut Chart) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base mb-1">
                Distribuição por Categoria
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Principais categorias de despesas em {getMonthName(selectedMonth)}
              </p>
            </div>

            {categoryData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
                Nenhuma despesa registrada para o mês selecionado.
              </div>
            ) : (
              <div className="h-72 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={3}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'Total']} />
                    <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Despesas por Forma de Pagamento */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base mb-1">
                Formas de Pagamento
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Volume financeiro por método de pagamento em {getMonthName(selectedMonth)}
              </p>
            </div>

            {paymentMethodData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
                Nenhuma despesa registrada para o mês selecionado.
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={paymentMethodData}
                    layout="vertical"
                    margin={{ top: 10, right: 20, left: 30, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => `R$${v}`}
                      stroke="#94A3B8"
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#94A3B8"
                      tick={{ fontSize: 11, fontWeight: 600 }}
                    />
                    <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'Gasto']} />
                    <Bar dataKey="value" fill="#6366F1" radius={[0, 8, 8, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'monthBalance' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 md:p-8">
          <div className="mb-6">
            <h3 className="font-extrabold text-slate-900 text-lg mb-1">
              Balanço Financeiro de {getMonthName(selectedMonth)}
            </h3>
            <p className="text-xs text-slate-500">
              Comparativo direto entre o total de receitas, despesas e o saldo resultante
            </p>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={singleMonthComparisonData}
                margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                barGap={12}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} stroke="#64748B" />
                <YAxis
                  tickFormatter={(val) => `R$ ${val}`}
                  tick={{ fontSize: 11 }}
                  stroke="#94A3B8"
                />
                <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), '']} />
                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600, paddingTop: 16 }} />
                <Bar
                  dataKey="Receitas"
                  fill="#10B981"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={60}
                />
                <Bar
                  dataKey="Despesas"
                  fill="#EF4444"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={60}
                />
                <Bar
                  dataKey="Saldo"
                  fill="#3B82F6"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={60}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
