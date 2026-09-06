import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  TrendingUp,
  Receipt,
  Briefcase,
  Menu,
  Calendar,
  Search,
  Bell,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { getMonthName, getCurrentMonth, formatDateBR, formatCurrency } from '../utils/formatters';

interface HeaderProps {
  onOpenExpenseModal: () => void;
  onOpenIncomeModal: () => void;
  onOpenSalaryModal: () => void;
  onOpenImportExcel?: () => void;
  onToggleMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenExpenseModal,
  onOpenIncomeModal,
  onOpenSalaryModal,
  onOpenImportExcel,
  onToggleMobileMenu,
}) => {
  const {
    selectedMonth,
    setSelectedMonth,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    expenses,
    monthSummary,
    filters,
    setFilters,
    toggleExpenseStatus,
  } = useFinance();

  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);

  const isCurrent = selectedMonth === getCurrentMonth();

  // Compute smart alerts for next 3 days + overdue
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const getDaysDiff = (dateString: string) => {
    if (!dateString) return 999;
    const [year, month, day] = dateString.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    targetDate.setHours(0, 0, 0, 0);
    return Math.round((targetDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  const pendingWithDays = expenses
    .filter((e) => e.status === 'PENDENTE' && e.date)
    .map((e) => ({ ...e, daysDiff: getDaysDiff(e.date) }));

  const pendingOverdueExpenses = pendingWithDays.filter((e) => e.daysDiff < 0);
  const dueNext3DaysExpenses = pendingWithDays
    .filter((e) => e.daysDiff >= 0 && e.daysDiff <= 3)
    .sort((a, b) => a.daysDiff - b.daysDiff);

  const totalAlerts = pendingOverdueExpenses.length + dueNext3DaysExpenses.length;

  return (
    <header className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3.5 pb-2">
      {/* Left Area: Mobile Menu + Month Selector */}
      <div className="flex items-center justify-between sm:justify-start gap-2.5">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          title="Abrir Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Month Picker Control */}
        <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-2xl border border-slate-200/90 shadow-xs">
          <button
            onClick={goToPreviousMonth}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Mês Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 px-2">
            <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-bold text-slate-800 text-xs sm:text-sm min-w-[110px] text-center capitalize">
              {getMonthName(selectedMonth)}
            </span>
          </div>

          <button
            onClick={goToNextMonth}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Próximo Mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {!isCurrent && (
            <button
              onClick={goToCurrentMonth}
              className="ml-1 text-[10px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 font-bold text-slate-600 px-2 py-1 rounded-lg transition-colors"
              title="Voltar ao Mês Atual"
            >
              Atual
            </button>
          )}
        </div>
      </div>

      {/* Right Area: Search, Alerts & Action Buttons */}
      <div className="flex items-center gap-2.5 justify-end">
        {/* Quick Search */}
        <div className="relative hidden md:block">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
            placeholder="Pesquisar lançamentos..."
            className="pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-500 w-44 lg:w-52 transition-all shadow-xs"
          />
        </div>

        {/* Smart Alerts Bell */}
        <div className="relative">
          <button
            onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
            className={`p-2.5 rounded-2xl border transition-all relative ${
              totalAlerts > 0
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
            title="Notificações e Alertas"
          >
            <Bell className="w-4 h-4" />
            {totalAlerts > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-black flex items-center justify-center animate-pulse">
                {totalAlerts}
              </span>
            )}
          </button>

          {showAlertsDropdown && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowAlertsDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-3xl p-4 shadow-2xl border border-slate-200 z-30 flex flex-col gap-3 animate-in fade-in zoom-in-95">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Alertas Financeiros
                  </h4>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    {getMonthName(selectedMonth)}
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto flex flex-col gap-2">
                  {/* Overdue alert */}
                  {pendingOverdueExpenses.length > 0 && (
                    <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-2xl flex flex-col gap-1.5">
                      <span className="text-[11px] font-black text-rose-800 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        {pendingOverdueExpenses.length} despesa(s) já vencida(s)!
                      </span>
                      <div className="flex flex-col gap-1">
                        {pendingOverdueExpenses.slice(0, 3).map((exp) => (
                          <div key={exp.id} className="flex items-center justify-between text-[11px] bg-white p-1.5 rounded-xl border border-rose-200">
                            <span className="truncate max-w-[130px] font-bold text-slate-800">{exp.description}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-rose-700 font-bold">{formatCurrency(exp.amount)}</span>
                              <button
                                onClick={() => toggleExpenseStatus(exp.id, exp.status)}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-bold cursor-pointer"
                              >
                                Pagar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Due in next 3 days */}
                  {dueNext3DaysExpenses.length > 0 && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-2xl flex flex-col gap-1.5">
                      <span className="text-[11px] font-black text-amber-900 flex items-center gap-1">
                        <Bell className="w-3.5 h-3.5 text-amber-600" />
                        {dueNext3DaysExpenses.length} despesa(s) vencem nos próximos 3 dias
                      </span>
                      <div className="flex flex-col gap-1">
                        {dueNext3DaysExpenses.slice(0, 4).map((exp) => (
                          <div key={exp.id} className="flex items-center justify-between text-[11px] bg-white p-1.5 rounded-xl border border-amber-200">
                            <div className="flex flex-col min-w-0 pr-1">
                              <span className="truncate max-w-[120px] font-bold text-slate-800">{exp.description}</span>
                              <span className="text-[9px] text-amber-700 font-semibold">
                                {exp.daysDiff === 0 ? 'Vence hoje!' : exp.daysDiff === 1 ? 'Vence amanhã' : `Em ${exp.daysDiff} dias`}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-slate-900 font-bold">{formatCurrency(exp.amount)}</span>
                              <button
                                onClick={() => toggleExpenseStatus(exp.id, exp.status)}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-bold cursor-pointer"
                              >
                                Pagar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {monthSummary.salaryBalance < 0 && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-1">
                      <span className="text-[11px] font-bold text-slate-800">
                        Alerta de Saldo
                      </span>
                      <p className="text-[10px] text-slate-600">
                        As despesas deste mês superam o salário cadastrado.
                      </p>
                    </div>
                  )}

                  {totalAlerts === 0 && (
                    <div className="py-6 text-center text-xs text-slate-400 font-medium flex flex-col items-center gap-1">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-1" />
                      Tudo em ordem! Nenhuma conta vencendo nos próximos 3 dias.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onOpenImportExcel && (
            <button
              id="header-import-excel-btn"
              onClick={onOpenImportExcel}
              className="hidden lg:flex items-center gap-1.5 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200/90 text-emerald-800 px-3.5 py-2.5 rounded-xl font-bold text-xs shadow-2xs transition-all"
              title="Transferir dados de planilha Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Importar Excel</span>
            </button>
          )}

          <button
            onClick={onOpenIncomeModal}
            className="hidden sm:flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl font-bold text-xs text-slate-700 shadow-xs transition-all"
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>+ Renda Extra</span>
          </button>

          <button
            onClick={onOpenSalaryModal}
            className="hidden md:flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl font-bold text-xs text-slate-700 shadow-xs transition-all"
          >
            <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
            <span>+ Salário</span>
          </button>

          <button
            onClick={onOpenExpenseModal}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-emerald-200 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nova Despesa</span>
          </button>
        </div>
      </div>
    </header>
  );
};
