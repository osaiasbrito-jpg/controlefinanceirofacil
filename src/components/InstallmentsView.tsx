import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Calendar,
  CreditCard as CardIcon,
  Infinity as InfinityIcon,
  Ban,
  FileSpreadsheet,
  CalendarPlus,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { InstallmentPurchase, Expense } from '../types';
import { formatCurrency, getMonthName } from '../utils/formatters';
import { ExtendIndefiniteModal } from './modals/ExtendIndefiniteModal';

interface InstallmentsViewProps {
  onOpenExpenseModal: () => void;
  onDeleteInstallmentPurchase: (purchaseId: string, expenseId?: string) => void;
  onOpenImportExcel?: () => void;
}

export const InstallmentsView: React.FC<InstallmentsViewProps> = ({
  onOpenExpenseModal,
  onDeleteInstallmentPurchase,
  onOpenImportExcel,
}) => {
  const {
    installmentPurchases,
    expenses,
    creditCards,
    toggleExpenseStatus,
    interruptInstallmentPurchase,
    extendIndefinitePurchase,
  } = useFinance();
  const [expandedPurchases, setExpandedPurchases] = useState<Record<string, boolean>>({});
  const [extendModalPurchase, setExtendModalPurchase] = useState<InstallmentPurchase | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedPurchases((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">Compras Parceladas e Recorrentes</h2>
          </div>
          <p className="text-xs text-slate-500">
            Acompanhe o progresso de quitação das suas compras parceladas ou por tempo indeterminado e a projeção nos meses futuros.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {onOpenImportExcel && (
            <button
              id="installments-import-excel-btn"
              onClick={onOpenImportExcel}
              className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
              title="Importar lançamentos futuros e compras parceladas de planilha Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Importar Planilha</span>
            </button>
          )}

          <button
            onClick={onOpenExpenseModal}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200 flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Compra / Parcelamento</span>
          </button>
        </div>
      </div>

      {/* List of Installment Purchases */}
      {installmentPurchases.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 mb-3">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Nenhuma compra parcelada registrada</h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1 mb-5">
            Ao cadastrar uma nova despesa com cartão de crédito, você pode parcelar em meses fixos ou por tempo indeterminado (podendo interromper a qualquer momento).
          </p>
          <button
            onClick={onOpenExpenseModal}
            className="px-5 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
          >
            + Cadastrar Compra Parcelada
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {installmentPurchases.map((purchase) => {
            const card = creditCards.find((c) => c.id === purchase.cardId);
            const linkedExpenses = expenses
              .filter((e) => e.installmentPurchaseId === purchase.id)
              .sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));

            const paidCount = linkedExpenses.filter((e) => e.status === 'PAGA').length;
            const totalCount = purchase.isIndefinite ? linkedExpenses.length : (purchase.installmentCount || linkedExpenses.length || 1);
            const progressPercent = purchase.isIndefinite
              ? Math.min(100, Math.round((paidCount / Math.max(1, totalCount)) * 100))
              : Math.round((paidCount / totalCount) * 100);

            const isExpanded = expandedPurchases[purchase.id];
            const isInterrupted = purchase.status === 'INTERRUPTED';

            return (
              <div
                key={purchase.id}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col gap-4 transition-all"
              >
                {/* Purchase Top Summary */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-900 text-base">
                        {purchase.title}
                      </span>
                      {purchase.isIndefinite ? (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold flex items-center gap-1">
                          <InfinityIcon className="w-3 h-3" />
                          Tempo Indeterminado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-bold">
                          {purchase.installmentCount}x
                        </span>
                      )}

                      {isInterrupted && (
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-[10px] font-bold flex items-center gap-1">
                          <Ban className="w-3 h-3" />
                          Interrompido
                        </span>
                      )}

                      {(card || purchase.cardName) && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-semibold flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: card?.color || '#6366F1' }}
                          />
                          <CardIcon className="w-3 h-3 text-slate-400" />
                          {card ? `${card.name} (${card.bank})` : purchase.cardName}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 mt-1">
                      Início em {getMonthName(purchase.startMonth)} • Categoria: {purchase.categoryName || 'Geral'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        {purchase.isIndefinite ? 'Valor Mensal' : 'Valor Total'}
                      </span>
                      <span className="text-lg font-black text-slate-900">
                        {formatCurrency(purchase.monthlyAmount || purchase.totalAmount)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {purchase.isIndefinite && !isInterrupted && (
                        <>
                          <button
                            onClick={() => setExtendModalPurchase(purchase)}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Estender projeção para mais 3 ou 6 meses"
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                            <span>Estender (+3/+6 m)</span>
                          </button>

                          <button
                            onClick={async () => {
                              if (window.confirm('Deseja interromper este parcelamento por tempo indeterminado? As cobranças futuras pendentes serão canceladas.')) {
                                await interruptInstallmentPurchase(purchase.id);
                              }
                            }}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Interromper parcelamento a qualquer momento"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Interromper</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => toggleExpand(purchase.id)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <span>Parcelas ({linkedExpenses.length})</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => onDeleteInstallmentPurchase(purchase.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                        title="Excluir Compra Parcelada"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-600">
                      {purchase.isIndefinite
                        ? `${paidCount} cobranças pagas de ${linkedExpenses.length} geradas`
                        : `${paidCount} de ${totalCount} parcelas pagas`}
                    </span>
                    <span className={progressPercent === 100 ? 'text-emerald-600' : 'text-indigo-600'}>
                      {purchase.isIndefinite ? `${paidCount} pagas` : `${progressPercent}%`}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        progressPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, progressPercent))}%` }}
                    />
                  </div>
                </div>

                {/* Expanded Installments List */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100 animate-in fade-in duration-200">
                    <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3">
                      Detalhamento dos Lançamentos Mensais
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                      {linkedExpenses.map((exp) => {
                        const isPaid = exp.status === 'PAGA';
                        return (
                          <div
                            key={exp.id}
                            className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 transition-all ${
                              isPaid ? 'bg-emerald-50/50 border-emerald-200/80' : 'bg-slate-50 border-slate-200/70'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="text-[11px] font-bold text-slate-800 capitalize">
                                {getMonthName(exp.referenceMonth)}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500">
                                {purchase.isIndefinite ? `Mês ${exp.installmentNumber}` : `${exp.installmentNumber}/${exp.totalInstallments}`}
                              </span>
                            </div>

                            <div className="flex justify-between items-center pt-1 border-t border-black/5">
                              <span className="text-xs font-extrabold text-slate-900">
                                {formatCurrency(exp.amount)}
                              </span>
                              <button
                                onClick={() => toggleExpenseStatus(exp.id, exp.status)}
                                className={`px-2.5 py-0.5 rounded-full text-[9px] font-black transition-colors ${
                                  isPaid
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                }`}
                              >
                                {exp.status}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
