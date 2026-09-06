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
  onFilterByLastInstallments?: () => void;
  onFilterBySingleExpenses?: () => void;
  className?: string;
}

export const NonRecurringExpensesSummary: React.FC<NonRecurringExpensesSummaryProps> = ({
  summary,
  onFilterByLastInstallments,
  onFilterBySingleExpenses,
  className = '',
}) => {
  const [showLastInstallmentsList, setShowLastInstallmentsList] = useState(false);
  const [showSingleList, setShowSingleList] = useState(false);

  const {
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
  } = summary;

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* 3-Column Bento Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Últimas Parcelas (Finalizam no Mês) */}
        <div
          id="summary-last-installments-card"
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
                  Últimas Parcelas
                </span>
              </div>
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-lg text-[10px] font-extrabold">
                {lastInstallmentsCount} {lastInstallmentsCount === 1 ? 'finalizando' : 'finalizando'}
              </span>
            </div>

            <div className="mt-1">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {formatCurrency(lastInstallmentsTotal)}
              </span>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Parcelas finais (ex: 4/4, 6/6) que encerram neste mês
              </p>
            </div>
          </div>

          {/* Details toggle / breakdown preview */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
            {lastInstallmentsCount > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowLastInstallmentsList((prev) => !prev)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center justify-between w-full transition-colors"
                >
                  <span>Ver detalhes das {lastInstallmentsCount} parcelas</span>
                  {showLastInstallmentsList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showLastInstallmentsList && (
                  <div className="flex flex-col gap-1.5 mt-1 max-h-48 overflow-y-auto pr-1">
                    {lastInstallments.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                      >
                        <div className="flex flex-col truncate pr-2">
                          <span className="font-bold text-slate-800 truncate">{item.description}</span>
                          <span className="text-[10px] text-indigo-600 font-semibold">
                            Parcela {item.installmentNumber}/{item.totalInstallments} • {item.cardName || 'Cartão'}
                          </span>
                        </div>
                        <span className="font-black text-slate-900 shrink-0">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <span className="text-[11px] text-slate-400 italic">
                Nenhum parcelamento encerra em {getMonthName(referenceMonth)}.
              </span>
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

            {singleExpensesCount > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowSingleList((prev) => !prev)}
                  className="text-xs font-bold text-teal-600 hover:text-teal-800 flex items-center justify-between w-full transition-colors mt-1"
                >
                  <span>Ver todas as {singleExpensesCount} compras à vista</span>
                  {showSingleList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showSingleList && (
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
              </>
            )}
          </div>
        </div>

        {/* Card 3: Soma Total Não-Recorrente (Últimas Parcelas + À Vista) */}
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
                  Soma Total Não-Recorrente
                </span>
              </div>
              <span className="px-2 py-0.5 bg-white/20 text-white rounded-lg text-[10px] font-extrabold">
                Últimas + À Vista
              </span>
            </div>

            <div className="mt-1">
              <span className="text-3xl font-black text-white tracking-tight">
                {formatCurrency(combinedTotal)}
              </span>
              <p className="text-[11px] text-emerald-100 font-medium mt-0.5">
                Total de gastos deste mês que <strong>NÃO</strong> se repetem no próximo mês
              </p>
            </div>
          </div>

          {/* Formula explanation */}
          <div className="mt-4 pt-3 border-t border-white/20 relative z-10 flex flex-col gap-1.5 text-xs text-emerald-100">
            <div className="flex items-center justify-between">
              <span>Últimas Parcelas:</span>
              <span className="font-bold text-white">{formatCurrency(lastInstallmentsTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Compras à Vista (Cartão + Pix + Outros):</span>
              <span className="font-bold text-white">{formatCurrency(singleExpensesTotal)}</span>
            </div>
            <div className="mt-1 bg-white/15 p-2 rounded-xl text-[11px] text-white flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>
                <strong>{formatCurrency(combinedTotal)}</strong> estarão liberados no seu orçamento do mês que vem!
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
