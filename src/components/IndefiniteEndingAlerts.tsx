import React from 'react';
import { AlertCircle, CalendarPlus, Clock, Infinity as InfinityIcon } from 'lucide-react';
import { InstallmentPurchase, Expense } from '../types';
import { formatCurrency, getMonthName } from '../utils/formatters';

interface IndefiniteEndingAlertsProps {
  selectedMonth: string;
  installmentPurchases: InstallmentPurchase[];
  expenses: Expense[];
  onOpenExtendModal: (purchase: InstallmentPurchase) => void;
}

export const IndefiniteEndingAlerts: React.FC<IndefiniteEndingAlertsProps> = ({
  selectedMonth,
  installmentPurchases,
  expenses,
  onOpenExtendModal,
}) => {
  // Find active indefinite purchases that end in selectedMonth or have no future projection past selectedMonth
  const expiringPurchases = installmentPurchases.filter((purchase) => {
    if (!purchase.isIndefinite || purchase.status === 'INTERRUPTED') return false;

    const linkedExpenses = expenses
      .filter((e) => e.installmentPurchaseId === purchase.id)
      .sort((a, b) => (a.referenceMonth || '').localeCompare(b.referenceMonth || ''));

    if (linkedExpenses.length === 0) return false;

    const lastExpense = linkedExpenses[linkedExpenses.length - 1];
    const lastMonth = lastExpense.referenceMonth || (lastExpense.date ? lastExpense.date.substring(0, 7) : '');

    // Is the last projected month equal to selectedMonth, or is selectedMonth >= lastMonth?
    return lastMonth === selectedMonth || (lastMonth < selectedMonth && linkedExpenses.length <= 6);
  });

  if (expiringPurchases.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 animate-in fade-in duration-300">
      {expiringPurchases.map((purchase) => {
        const linkedExpenses = expenses
          .filter((e) => e.installmentPurchaseId === purchase.id)
          .sort((a, b) => (a.referenceMonth || '').localeCompare(b.referenceMonth || ''));
        const lastExpense = linkedExpenses[linkedExpenses.length - 1];
        const lastMonth = lastExpense?.referenceMonth || purchase.startMonth;
        const currentAmount = purchase.monthlyAmount || purchase.totalAmount || 0;

        return (
          <div
            key={purchase.id}
            id={`indefinite-expiry-alert-${purchase.id}`}
            className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-amber-950">
                    Última Mensalidade Projetada: "{purchase.title}"
                  </span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-extrabold flex items-center gap-1">
                    <InfinityIcon className="w-3 h-3" />
                    Fim da Projeção de 6 meses
                  </span>
                </div>
                <p className="text-xs text-amber-800/90 mt-0.5">
                  A projeção deste serviço termina em <strong>{getMonthName(lastMonth)}</strong> ({formatCurrency(currentAmount)}/mês). Deseja estender por mais 3 ou 6 meses ou verificar se o valor continua o mesmo?
                </p>
              </div>
            </div>

            <button
              onClick={() => onOpenExtendModal(purchase)}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-colors shrink-0 self-end sm:self-center"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              <span>Estender Assinatura (+3 / +6 meses)</span>
            </button>
          </div>
        );
      })}
    </div>
  );
};
