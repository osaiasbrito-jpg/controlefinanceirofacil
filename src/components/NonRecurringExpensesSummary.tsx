import React, { useState } from 'react';
import {
  CheckCircle,
  CreditCard,
  Layers,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  Receipt,
  Zap,
  ArrowRight,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { MonthInstallmentsAndSingleSummary, Expense } from '../types';
import { formatCurrency, getMonthName } from '../utils/formatters';

interface NonRecurringExpensesSummaryProps {
  summary: MonthInstallmentsAndSingleSummary;
  onFilterByAllInstallments?: () => void;
  onFilterByLastInstallments?: () => void;
  onFilterBySingleExpenses?: () => void;
  className?: string;
}

export const NonRecurringExpensesSummary: React.FC<NonRecurringExpensesSummaryProps> = ({
  summary,
  onFilterByAllInstallments,
  onFilterByLastInstallments,
  onFilterBySingleExpenses,
  className = '',
}) => {
  const [showInstallmentsList, setShowInstallmentsList] = useState(false);
  const [showSingleList, setShowSingleList] = useState(false);

  const {
    referenceMonth,
    allInstallmentsTotal = 0,
    allInstallmentsCount = 0,
    allInstallments = [],
    lastInstallmentsTotal = 0,
    lastInstallmentsCount = 0,
    lastInstallments = [],
    singleExpensesTotal = 0,
    singleExpensesCount = 0,
    singleExpenses = [],
    singleCardExpensesTotal = 0,
    singleCardExpensesCount = 0,
    singleOtherExpensesTotal = 0,
    singleOtherExpensesCount = 0,
    combinedTotal = 0,
    combinedCount = 0,
  } = summary;

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* 3-Column Bento Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Compras Parceladas (Ativas no Mês) */}
        <div
          id="summary-installments-card"
          className="bg-white rounded-3xl border border-indigo-100 p-5 shadow-xs flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-md group"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-indigo-900 tracking-wide uppercase">
                  Compras Parceladas
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-lg text-[10px] font-extrabold">
                  {allInstallmentsCount} {allInstallmentsCount === 1 ? 'parcela' : 'parcelas'}
                </span>
                {lastInstallmentsCount > 0 && (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-extrabold" title="Parcelas que encerram neste mês">
                    {lastInstallmentsCount} finalizando
                  </span>
                )}
              </div>
            </div>

            <div className="mt-1">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {formatCurrency(allInstallmentsTotal)}
              </span>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Parcelas ativas faturadas neste mês (Shopee, cartões, etc.)
              </p>
            </div>
          </div>

          {/* Details toggle / breakdown preview */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              {allInstallmentsCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowInstallmentsList((prev) => !prev)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                >
                  <span>{showInstallmentsList ? 'Ocultar detalhes' : `Ver ${allInstallmentsCount} parcelas`}</span>
                  {showInstallmentsList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              ) : (
                <span className="text-[11px] text-slate-400 italic">
                  Nenhuma parcela ativa em {getMonthName(referenceMonth)}.
                </span>
              )}

              {onFilterByAllInstallments && allInstallmentsCount > 0 && (
                <button
                  type="button"
                  onClick={onFilterByAllInstallments}
                  className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                  title="Filtrar apenas compras parceladas na lista abaixo"
                >
                  <span>Filtrar na tabela</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {showInstallmentsList && allInstallmentsCount > 0 && (
              <div className="flex flex-col gap-1.5 mt-1 max-h-52 overflow-y-auto pr-1">
                {allInstallments.map((item) => {
                  const isFinal = item.installmentNumber === item.totalInstallments;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                    >
                      <div className="flex flex-col truncate pr-2">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-bold text-slate-800 truncate">{item.description}</span>
                          {isFinal && (
                            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded">
                              Finaliza
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-indigo-600 font-semibold">
                          Parcela {item.installmentNumber || 1} de {item.totalInstallments || 1} • {item.cardName || 'Cartão'}
                        </span>
                      </div>
                      <span className="font-black text-slate-900 shrink-0">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Compras à Vista */}
        <div
          id="summary-single-purchases-card"
          className="bg-white rounded-3xl border border-teal-100 p-5 shadow-xs flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-md group"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                  <Receipt className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-teal-900 tracking-wide uppercase">
                  Compras à Vista
                </span>
              </div>
              <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded-lg text-[10px] font-extrabold">
                {singleExpensesCount} {singleExpensesCount === 1 ? 'compra' : 'compras'}
              </span>
            </div>

            <div className="mt-1">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {formatCurrency(singleExpensesTotal)}
              </span>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Gastos pontuais e pagamentos à vista no mês
              </p>
            </div>
          </div>

          {/* Sub-breakdown: Card vs Others */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
              <span className="flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                Cartão à vista ({singleCardExpensesCount}):
              </span>
              <span className="font-bold text-slate-900">{formatCurrency(singleCardExpensesTotal)}</span>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
              <span className="flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5 text-slate-400" />
                Pix / Boleto / Outros ({singleOtherExpensesCount}):
              </span>
              <span className="font-bold text-slate-900">{formatCurrency(singleOtherExpensesTotal)}</span>
            </div>

            <div className="flex items-center justify-between gap-2 mt-1">
              {singleExpensesCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowSingleList((prev) => !prev)}
                  className="text-xs font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1 transition-colors"
                >
                  <span>{showSingleList ? 'Ocultar detalhes' : `Ver ${singleExpensesCount} compras`}</span>
                  {showSingleList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              ) : (
                <span className="text-[11px] text-slate-400 italic">
                  Nenhuma compra à vista neste mês.
                </span>
              )}

              {onFilterBySingleExpenses && singleExpensesCount > 0 && (
                <button
                  type="button"
                  onClick={onFilterBySingleExpenses}
                  className="text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                  title="Filtrar apenas compras à vista na lista abaixo"
                >
                  <span>Filtrar na tabela</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {showSingleList && singleExpensesCount > 0 && (
              <div className="flex flex-col gap-1.5 mt-1 max-h-48 overflow-y-auto pr-1">
                {singleExpenses.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="font-bold text-slate-800 truncate">{item.description}</span>
                      <span className="text-[10px] text-teal-600 font-semibold">
                        {item.paymentMethod === 'CARTAO_CREDITO'
                          ? `Cartão (${item.cardName || 'Crédito'})`
                          : item.paymentMethod || 'À vista'}
                      </span>
                    </div>
                    <span className="font-black text-slate-900 shrink-0">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Soma Total Consolidada (Parceladas + À Vista) */}
        <div
          id="summary-combined-nonrecurring-card"
          className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-3xl p-5 shadow-md text-white flex flex-col justify-between relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />

          <div className="flex flex-col gap-2 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-emerald-100 tracking-wide uppercase">
                  Total Consolidado
                </span>
              </div>
              <span className="px-2 py-0.5 bg-white/20 text-white rounded-lg text-[10px] font-extrabold">
                Parceladas + À Vista
              </span>
            </div>

            <div className="mt-1">
              <span className="text-3xl font-black text-white tracking-tight">
                {formatCurrency(combinedTotal)}
              </span>
              <p className="text-[11px] text-emerald-100 font-medium mt-0.5">
                Total de despesas não recorrentes faturadas em <strong>{getMonthName(referenceMonth)}</strong>
              </p>
            </div>
          </div>

          {/* Formula explanation */}
          <div className="mt-4 pt-3 border-t border-white/20 relative z-10 flex flex-col gap-1.5 text-xs text-emerald-100">
            <div className="flex items-center justify-between">
              <span>Compras Parceladas ({allInstallmentsCount}):</span>
              <span className="font-bold text-white">{formatCurrency(allInstallmentsTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Compras à Vista ({singleExpensesCount}):</span>
              <span className="font-bold text-white">{formatCurrency(singleExpensesTotal)}</span>
            </div>
            {lastInstallmentsCount > 0 && (
              <div className="mt-1 bg-white/15 p-2 rounded-xl text-[11px] text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>
                  <strong>{formatCurrency(lastInstallmentsTotal)}</strong> ({lastInstallmentsCount} parcelas) terminam neste mês e aliviarão o próximo!
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
