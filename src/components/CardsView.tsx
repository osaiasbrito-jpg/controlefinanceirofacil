import React, { useState, useMemo } from 'react';
import {
  CreditCard as CardIcon,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  TrendingDown,
  QrCode,
  FileText,
  Banknote,
  Wallet,
  Clock,
  Layers,
  ChevronRight,
  ListFilter,
  CheckCheck,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { CreditCard, CustomPaymentMethod, PaymentMethod } from '../types';
import { formatCurrency, getMonthName } from '../utils/formatters';
import { getCanonicalCardInfo, isExpenseMatchingCard, isExpenseMatchingPaymentMethod } from '../utils/cardUtils';
import { isIndefiniteExpense } from '../utils/calculations';
import { PaymentDetailsModal } from './modals/PaymentDetailsModal';
import { PaymentMethodModal } from './modals/PaymentMethodModal';

interface CardsViewProps {
  onOpenCardModal: (cardToEdit?: CreditCard) => void;
  onDeleteCard: (card: CreditCard) => void;
}

type TabFilter = 'ALL' | 'CREDIT_CARDS' | 'OTHER_METHODS';

export const CardsView: React.FC<CardsViewProps> = ({
  onOpenCardModal,
  onDeleteCard,
}) => {
  const {
    creditCards,
    paymentMethods,
    categories,
    expenses,
    installmentPurchases,
    selectedMonth,
    deletePaymentMethod,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<TabFilter>('ALL');

  // Modals state
  const [selectedDrillDownCard, setSelectedDrillDownCard] = useState<any | null>(null);
  const [selectedDrillDownMethod, setSelectedDrillDownMethod] = useState<CustomPaymentMethod | null>(null);
  const [isDrillDownOpen, setIsDrillDownOpen] = useState(false);
  const [isMethodModalOpen, setIsMethodModalOpen] = useState(false);
  const [methodToEdit, setMethodToEdit] = useState<CustomPaymentMethod | null>(null);

  // Consolidated Credit Cards:
  // "O cartão Banco Inter deverá aparecer apenas 1 vez somando todas as despesas do cartão Inter"
  const consolidatedCards = useMemo(() => {
    const map = new Map<string, {
      canonicalId: string;
      canonicalName: string;
      brandKey: string;
      color: string;
      bank: string;
      totalLimit: number;
      closingDay: number;
      dueDay: number;
      originalCards: CreditCard[];
    }>();

    // 1. Group registered cards by canonical key
    for (const card of creditCards) {
      const canonical = getCanonicalCardInfo(card.id, card.name, creditCards);
      const groupKey = canonical.canonicalName || card.name.toLowerCase().trim() || card.id;

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          canonicalId: card.id,
          canonicalName: canonical.canonicalName || card.name,
          brandKey: groupKey,
          color: card.color || canonical.color || '#4F46E5',
          bank: card.bank || canonical.bank || card.name,
          totalLimit: card.totalLimit,
          closingDay: card.closingDay,
          dueDay: card.dueDay,
          originalCards: [card],
        });
      } else {
        const existing = map.get(groupKey)!;
        existing.totalLimit += card.totalLimit;
        existing.originalCards.push(card);
      }
    }

    // 2. Calculate expenses & invoices for each consolidated card
    return Array.from(map.values()).map((group) => {
      // Find all expenses in the system matching this card group
      const cardExpenses = expenses.filter((e) =>
        isExpenseMatchingCard(e, group.canonicalId, group.canonicalName, creditCards)
      );

      // Current month invoice
      const monthExpenses = cardExpenses.filter((e) => e.referenceMonth === selectedMonth);
      const currentMonthInvoice = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const monthPaid = monthExpenses.filter((e) => e.status === 'PAGA').reduce((sum, e) => sum + e.amount, 0);
      const monthPending = monthExpenses.filter((e) => e.status === 'PENDENTE').reduce((sum, e) => sum + e.amount, 0);

      // Total used limit:
      // - Fixed purchases & standard installments: all unpaid expenses (past, present, and future) consume limit
      // - Indefinite recurring purchases (prazo indeterminado): only unpaid expenses for current and past months (referenceMonth <= selectedMonth) consume limit! Future projections do not lock limit.
      const usedLimit = cardExpenses
        .filter((e) => {
          if (e.status !== 'PENDENTE') return false;
          const isIndefinite = isIndefiniteExpense(e, installmentPurchases);
          if (isIndefinite && e.referenceMonth && e.referenceMonth > selectedMonth) {
            return false;
          }
          return true;
        })
        .reduce((sum, exp) => sum + exp.amount, 0);

      const availableLimit = Math.max(0, group.totalLimit - usedLimit);
      const usagePercentage = group.totalLimit > 0
        ? Math.min(100, Math.round((usedLimit / group.totalLimit) * 100))
        : 0;

      return {
        ...group,
        usedLimit,
        availableLimit,
        currentMonthInvoice,
        monthPaid,
        monthPending,
        usagePercentage,
        monthCount: monthExpenses.length,
      };
    });
  }, [creditCards, expenses, selectedMonth, installmentPurchases]);

  // Consolidated Other Payment Methods (Pix, Boleto, Débito, etc.)
  const paymentMethodsSummary = useMemo(() => {
    return paymentMethods.map((pm) => {
      // Expenses matching this payment method in the selected month
      const monthExpenses = expenses.filter((e) => {
        const expMonth = e.referenceMonth || (e.date ? e.date.substring(0, 7) : '');
        if (expMonth !== selectedMonth) return false;
        return isExpenseMatchingPaymentMethod(
          e,
          pm.type,
          pm.id,
          categories,
          paymentMethods,
          creditCards
        );
      });

      const totalAmount = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const paidAmount = monthExpenses.filter((e) => e.status === 'PAGA').reduce((sum, e) => sum + e.amount, 0);
      const pendingAmount = monthExpenses.filter((e) => e.status === 'PENDENTE').reduce((sum, e) => sum + e.amount, 0);

      return {
        method: pm,
        totalAmount,
        paidAmount,
        pendingAmount,
        count: monthExpenses.length,
      };
    });
  }, [paymentMethods, expenses, selectedMonth, categories, creditCards]);

  const handleOpenDrillDownCard = (group: any) => {
    setSelectedDrillDownCard({
      id: group.canonicalId,
      name: group.canonicalName,
      bank: group.bank,
      color: group.color,
      totalLimit: group.totalLimit,
      closingDay: group.closingDay,
      dueDay: group.dueDay,
    });
    setSelectedDrillDownMethod(null);
    setIsDrillDownOpen(true);
  };

  const handleOpenDrillDownMethod = (method: CustomPaymentMethod) => {
    setSelectedDrillDownMethod(method);
    setSelectedDrillDownCard(null);
    setIsDrillDownOpen(true);
  };

  const handleOpenEditMethod = (e: React.MouseEvent, method: CustomPaymentMethod) => {
    e.stopPropagation();
    setMethodToEdit(method);
    setIsMethodModalOpen(true);
  };

  const handleDeleteMethod = (e: React.MouseEvent, method: CustomPaymentMethod) => {
    e.stopPropagation();
    if (window.confirm(`Deseja excluir a forma de pagamento "${method.name}"?`)) {
      deletePaymentMethod(method.id);
    }
  };

  const getMethodIcon = (type: PaymentMethod) => {
    switch (type) {
      case 'PIX':
        return <QrCode className="w-5 h-5" />;
      case 'BOLETO':
        return <FileText className="w-5 h-5" />;
      case 'CARTAO_DEBITO':
        return <CardIcon className="w-5 h-5" />;
      case 'DINHEIRO':
        return <Banknote className="w-5 h-5" />;
      default:
        return <Wallet className="w-5 h-5" />;
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-xs">
              <CardIcon className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-slate-900">Cartões e Outros Tipos</h2>
          </div>
          <p className="text-xs text-slate-500">
            Configure e gerencie cartões de crédito, Pix, Boletos e débitos. Clique em qualquer item para ver as despesas consolidadas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setMethodToEdit(null);
              setIsMethodModalOpen(true);
            }}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Tipo (Pix/Boleto)</span>
          </button>

          <button
            onClick={() => onOpenCardModal()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200 flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Cartão de Crédito</span>
          </button>
        </div>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2 overflow-x-auto no-scrollbar flex-nowrap -mx-2 px-2 sm:mx-0 sm:px-0">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          Visão Geral ({consolidatedCards.length + paymentMethodsSummary.length})
        </button>
        <button
          onClick={() => setActiveTab('CREDIT_CARDS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'CREDIT_CARDS'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <CardIcon className="w-3.5 h-3.5" />
          <span>Cartões de Crédito ({consolidatedCards.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('OTHER_METHODS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'OTHER_METHODS'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>Pix, Boleto e Outros ({paymentMethodsSummary.length})</span>
        </button>
      </div>

      {/* SECTION 1: Credit Cards (Consolidated by Bank/Name) */}
      {(activeTab === 'ALL' || activeTab === 'CREDIT_CARDS') && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardIcon className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">
                Cartões de Crédito (Consolidados)
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Fatura de {getMonthName(selectedMonth)}
            </span>
          </div>

          {consolidatedCards.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-10 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 mb-3">
                <CardIcon className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">Nenhum cartão cadastrado</h4>
              <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
                Cadastre seus cartões de crédito para ter controle total do limite consumido e faturas futuras.
              </p>
              <button
                onClick={() => onOpenCardModal()}
                className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-xs"
              >
                + Cadastrar Cartão de Crédito
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {consolidatedCards.map((group) => {
                const isHighUsage = group.usagePercentage >= 80;
                const primaryCard = group.originalCards[0];

                return (
                  <div
                    key={group.canonicalId}
                    onClick={() => handleOpenDrillDownCard(group)}
                    className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between gap-5 transition-all hover:shadow-md hover:border-indigo-300 cursor-pointer group"
                  >
                    {/* Visual Card Representation */}
                    <div
                      className="rounded-2xl p-5 text-white shadow-lg flex flex-col justify-between h-44 relative overflow-hidden transition-all group-hover:scale-[1.01]"
                      style={{ backgroundColor: group.color || '#1E293B' }}
                    >
                      <div className="flex justify-between items-start z-10">
                        <div className="w-10 h-6 bg-amber-400/30 border border-amber-300/40 rounded-md backdrop-blur-xs flex items-center justify-center">
                          <div className="w-6 h-3 border-y border-amber-300/40"></div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black tracking-wider uppercase opacity-95 block">
                            {group.canonicalName}
                          </span>
                          <span className="text-[10px] opacity-80 font-medium">{group.bank}</span>
                        </div>
                      </div>

                      <div className="mt-1 z-10">
                        <div className="text-[10px] opacity-75">Limite Disponível</div>
                        <div className="text-2xl font-black tracking-tight">
                          {formatCurrency(group.availableLimit)}
                        </div>
                      </div>

                      <div className="flex justify-between items-end text-[10px] opacity-90 border-t border-white/15 pt-2 font-mono z-10">
                        <span>Fecha dia {group.closingDay}</span>
                        <span>Vence dia {group.dueDay}</span>
                      </div>
                    </div>

                    {/* Metrics Breakdown & Current Month Invoice */}
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div>
                          <span className="text-[11px] text-slate-500 font-medium block">
                            Fatura de {getMonthName(selectedMonth)}
                          </span>
                          <span className="font-black text-slate-900 text-base">
                            {formatCurrency(group.currentMonthInvoice)}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 block">
                            {group.monthCount} compras
                          </span>
                          <span className="text-[10px] font-extrabold text-indigo-600 flex items-center gap-0.5 justify-end group-hover:underline">
                            <span>Ver Detalhes</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>

                      {/* Limit Usage Gauge */}
                      <div className="flex flex-col gap-1.5 pt-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-slate-500">Utilização do Limite</span>
                          <span className={isHighUsage ? 'text-rose-600' : 'text-emerald-600'}>
                            {group.usagePercentage}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isHighUsage ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${group.usagePercentage}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 font-medium pt-0.5">
                          <span>Utilizado: {formatCurrency(group.usedLimit)}</span>
                          <span>Total: {formatCurrency(group.totalLimit)}</span>
                        </div>
                      </div>

                      {isHighUsage && (
                        <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-700 text-[11px] font-semibold">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>Atenção: Cartão acima de 80% do limite!</span>
                        </div>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDrillDownCard(group);
                        }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        <ListFilter className="w-3.5 h-3.5" />
                        <span>Ver Fatura Completa</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenCardModal(primaryCard);
                          }}
                          className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors text-xs font-bold"
                          title="Editar Cartão"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteCard(primaryCard);
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-xs font-bold"
                          title="Excluir Cartão"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: Other Payment Types (Pix, Boleto, Cartão de Débito, etc.) */}
      {(activeTab === 'ALL' || activeTab === 'OTHER_METHODS') && (
        <div className="flex flex-col gap-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-teal-700" />
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">
                Pix, Boletos e Outros Tipos de Pagamento
              </h3>
            </div>
            <button
              onClick={() => {
                setMethodToEdit(null);
                setIsMethodModalOpen(true);
              }}
              className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Forma</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {paymentMethodsSummary.map(({ method, totalAmount, paidAmount, pendingAmount, count }) => {
              const isDefaultSystem = method.id.startsWith('default-pm-');

              return (
                <div
                  key={method.id}
                  onClick={() => handleOpenDrillDownMethod(method)}
                  className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between gap-4 transition-all hover:shadow-md hover:border-teal-300 cursor-pointer group"
                >
                  {/* Top Info */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs font-bold"
                        style={{ backgroundColor: method.color || '#0D9488' }}
                      >
                        {getMethodIcon(method.type)}
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-teal-800 transition-colors">
                          {method.name}
                        </h4>
                        <span className="text-[11px] text-slate-400 font-medium line-clamp-1">
                          {method.details || method.type}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Monthly Stats */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex flex-col gap-1.5">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Total no Mês</span>
                      <span className="text-base font-black text-slate-900">
                        {formatCurrency(totalAmount)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-200/60">
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {formatCurrency(paidAmount)} pago
                      </span>
                      <span className="text-amber-700 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatCurrency(pendingAmount)} pend.
                      </span>
                    </div>
                  </div>

                  {/* Bottom Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-[11px] font-extrabold text-teal-700 flex items-center gap-1 group-hover:underline">
                      <span>{count} lançamentos</span>
                      <ChevronRight className="w-3 h-3" />
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditMethod(e, method)}
                        className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors text-xs font-bold"
                        title="Editar Forma de Pagamento"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {!isDefaultSystem && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteMethod(e, method)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-xs font-bold"
                          title="Excluir Forma de Pagamento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Drill-down Modal (Detailed view of purchases for a specific card or payment method) */}
      <PaymentDetailsModal
        isOpen={isDrillDownOpen}
        onClose={() => setIsDrillDownOpen(false)}
        targetType={selectedDrillDownCard ? 'CARD' : 'METHOD'}
        card={selectedDrillDownCard}
        method={selectedDrillDownMethod}
      />

      {/* Custom Payment Method Modal */}
      <PaymentMethodModal
        isOpen={isMethodModalOpen}
        onClose={() => {
          setIsMethodModalOpen(false);
          setMethodToEdit(null);
        }}
        methodToEdit={methodToEdit}
      />
    </div>
  );
};
