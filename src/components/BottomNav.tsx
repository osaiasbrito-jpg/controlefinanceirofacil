import React, { useState } from 'react';
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  CreditCard as CardIcon,
  Menu,
  Plus,
  X,
  Briefcase,
  PlusCircle,
  FileSpreadsheet,
  Layers,
  Sparkles,
  DollarSign,
} from 'lucide-react';
import { ActiveTab } from '../types';
import { useFinance } from '../context/FinanceContext';

interface BottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onToggleMobileMenu: () => void;
  onOpenExpenseModal: () => void;
  onOpenIncomeModal: () => void;
  onOpenSalaryModal: () => void;
  onOpenCardModal: () => void;
  onOpenImportExcel?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  onToggleMobileMenu,
  onOpenExpenseModal,
  onOpenIncomeModal,
  onOpenSalaryModal,
  onOpenCardModal,
  onOpenImportExcel,
}) => {
  const { monthSummary, expenses, selectedMonth } = useFinance();
  const [showQuickSheet, setShowQuickSheet] = useState(false);

  // Count pending expenses for current month for quick badge
  const pendingCount = expenses.filter(
    (e) => e.referenceMonth === selectedMonth && e.status === 'PENDENTE'
  ).length;

  const handleOpenAction = (action: () => void) => {
    setShowQuickSheet(false);
    action();
  };

  return (
    <>
      {/* Mobile Quick Action Bottom Sheet (Floating Modal) */}
      {showQuickSheet && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setShowQuickSheet(false)}
          />

          <div className="relative bg-white rounded-t-3xl border-t border-slate-200 shadow-2xl p-5 z-10 animate-in slide-in-from-bottom-6 duration-300">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Novo Lançamento</h3>
                <p className="text-xs text-slate-500">Escolha o tipo de operação rápida</p>
              </div>
              <button
                onClick={() => setShowQuickSheet(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Nova Despesa */}
              <button
                onClick={() => handleOpenAction(onOpenExpenseModal)}
                className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-left flex flex-col justify-between transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold mb-3 shadow-md shadow-emerald-200 group-hover:scale-110 transition-transform">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-black text-slate-900 text-sm block">Nova Despesa</span>
                  <span className="text-[11px] text-emerald-700 font-semibold">Conta, compra ou fatura</span>
                </div>
              </button>

              {/* Nova Renda Extra */}
              <button
                onClick={() => handleOpenAction(onOpenIncomeModal)}
                className="p-4 rounded-2xl bg-blue-50 border border-blue-200 hover:bg-blue-100 text-left flex flex-col justify-between transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold mb-3 shadow-md shadow-blue-200 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-black text-slate-900 text-sm block">Renda Extra</span>
                  <span className="text-[11px] text-blue-700 font-semibold">Pix, bônus, freela</span>
                </div>
              </button>

              {/* Salário */}
              <button
                onClick={() => handleOpenAction(onOpenSalaryModal)}
                className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-left flex flex-col justify-between transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold mb-3 shadow-md shadow-indigo-200 group-hover:scale-110 transition-transform">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-black text-slate-900 text-sm block">Salário</span>
                  <span className="text-[11px] text-indigo-700 font-semibold">Salário mensal ou padrão</span>
                </div>
              </button>

              {/* Novo Cartão */}
              <button
                onClick={() => handleOpenAction(onOpenCardModal)}
                className="p-4 rounded-2xl bg-purple-50 border border-purple-200 hover:bg-purple-100 text-left flex flex-col justify-between transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold mb-3 shadow-md shadow-purple-200 group-hover:scale-110 transition-transform">
                  <CardIcon className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-black text-slate-900 text-sm block">Novo Cartão</span>
                  <span className="text-[11px] text-purple-700 font-semibold">Gerenciar limites & datas</span>
                </div>
              </button>
            </div>

            {/* Importar Planilha Excel */}
            {onOpenImportExcel && (
              <button
                onClick={() => handleOpenAction(onOpenImportExcel)}
                className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer mb-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Importar Planilha Excel (.xlsx)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Mobile Navigation Bar */}
      <nav
        id="mobile-bottom-navigation"
        className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1.5 flex items-center justify-around safe-area-pb"
      >
        {/* 1. Dashboard */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl min-w-[56px] min-h-[48px] transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'text-emerald-700 font-extrabold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'dashboard' ? 'bg-emerald-100 text-emerald-700 scale-105' : ''
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Início</span>
        </button>

        {/* 2. Despesas */}
        <button
          onClick={() => setActiveTab('despesas')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl min-w-[56px] min-h-[48px] transition-all relative cursor-pointer ${
            activeTab === 'despesas'
              ? 'text-rose-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl relative transition-all ${
              activeTab === 'despesas' ? 'bg-rose-100 text-rose-600 scale-105' : ''
            }`}
          >
            <Receipt className="w-5 h-5" />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white rounded-full text-[9px] font-black flex items-center justify-center shadow-xs">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Despesas</span>
        </button>

        {/* 3. Center Elevated FAB (+) Button */}
        <div className="relative -top-3.5 flex flex-col items-center">
          <button
            id="mobile-fab-quick-add"
            onClick={() => setShowQuickSheet(true)}
            className="w-13 h-13 rounded-full bg-linear-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer ring-4 ring-white"
            title="Adicionar Novo Lançamento"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
          <span className="text-[9px] font-extrabold text-emerald-800 tracking-tight mt-0.5">
            Adicionar
          </span>
        </div>

        {/* 4. Receitas */}
        <button
          onClick={() => setActiveTab('receitas')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl min-w-[56px] min-h-[48px] transition-all cursor-pointer ${
            activeTab === 'receitas' || activeTab === 'salario' || activeTab === 'renda-extra'
              ? 'text-emerald-700 font-extrabold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'receitas' || activeTab === 'salario' || activeTab === 'renda-extra'
                ? 'bg-emerald-100 text-emerald-700 scale-105'
                : ''
            }`}
          >
            <TrendingUp className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Receitas</span>
        </button>

        {/* 5. Menu / Mais */}
        <button
          id="mobile-bottom-nav-menu"
          onClick={onToggleMobileMenu}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-2xl min-w-[56px] min-h-[48px] text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
        >
          <div className="p-1.5 rounded-xl text-slate-600">
            <Menu className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight font-medium mt-0.5">Menu</span>
        </button>
      </nav>
    </>
  );
};
