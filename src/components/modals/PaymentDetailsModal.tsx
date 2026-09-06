import React, { useState } from 'react';
import {
  X,
  CreditCard as CardIcon,
  Calendar,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Layers,
  ArrowDownCircle,
  Filter,
  CheckCheck,
  RotateCcw,
  Sparkles,
  QrCode,
  FileText,
  Banknote,
  Wallet,
  Tag,
} from 'lucide-react';
import { Expense, CreditCard, CustomPaymentMethod, PaymentMethod } from '../../types';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, getMonthName, getAdjacentMonth, formatDateBR } from '../../utils/formatters';
import { isExpenseMatchingCard } from '../../utils/cardUtils';

interface PaymentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Either a card view or a payment method view
  targetType: 'CARD' | 'METHOD';
  card?: {
    id: string;
    name: string;
    bank?: string;
    color?: string;
    totalLimit?: number;
    closingDay?: number;
    dueDay?: number;
  };
  method?: CustomPaymentMethod;
}

export const PaymentDetailsModal: React.FC<PaymentDetailsModalProps> = ({
  isOpen,
  onClose,
  targetType,
  card,
  method,
}) => {
  const {
    expenses,
    creditCards,
    selectedMonth,
    setSelectedMonth,
    toggleExpenseStatus,
    markAllCardExpensesStatus,
    markAllMethodExpensesStatus,
  } = useFinance();

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDENTE' | 'PAGA'>('ALL');
  const [activeTab, setActiveTab] = useState<'ALL' | 'AVISTA' | 'PARCELADA'>('ALL');
  const [processing, setProcessing] = useState(false);

  if (!isOpen || (!card && !method)) return null;

  // Filter expenses matching this card or payment method in the selectedMonth
  const allMatchingExpenses = expenses.filter((e) => {
    if (e.referenceMonth !== selectedMonth) return false;

    if (targetType === 'CARD' && card) {
      return isExpenseMatchingCard(e, card.id, card.name, creditCards);
    }

    if (targetType === 'METHOD' && method) {
      return (
        e.paymentMethodId === method.id ||
        (e.paymentMethod === method.type && (!e.paymentMethodId || e.paymentMethodId === method.id)) ||
        (e.paymentMethodName && e.paymentMethodName.toLowerCase() === method.name.toLowerCase())
      );
    }

    return false;
  });

  // Calculate totals
  const totalAmount = allMatchingExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  const paidExpenses = allMatchingExpenses.filter((e) => e.status === 'PAGA');
  const pendingExpenses = allMatchingExpenses.filter((e) => e.status === 'PENDENTE');
  const totalPaid = paidExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  const totalPending = pendingExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  const installmentExpenses = allMatchingExpenses.filter((e) => e.isInstallment);
  const singleExpenses = allMatchingExpenses.filter((e) => !e.isInstallment);
  const totalInstallments = installmentExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  const totalSingle = singleExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  // Filter based on status and installment tab
  const filteredList = allMatchingExpenses.filter((e) => {
    if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
    if (activeTab === 'AVISTA' && e.isInstallment) return false;
    if (activeTab === 'PARCELADA' && !e.isInstallment) return false;
    return true;
  });

  // Batch toggle actions
  const handleMarkAll = async (targetStatus: 'PAGA' | 'PENDENTE') => {
    setProcessing(true);
    try {
      if (targetType === 'CARD' && card) {
        await markAllCardExpensesStatus(card.id, card.name, targetStatus, selectedMonth);
      } else if (targetType === 'METHOD' && method) {
        await markAllMethodExpensesStatus(method.id || method.type, targetStatus, selectedMonth);
      }
    } catch (err) {
      console.error('Erro ao marcar despesas em lote:', err);
    } finally {
      setProcessing(false);
    }
  };

  const entityTitle = targetType === 'CARD' ? card?.name : method?.name;
  const entitySubtitle =
    targetType === 'CARD'
      ? card?.bank || 'Cartão de Crédito'
      : method?.details || method?.type || 'Forma de Pagamento';
  const entityColor = (targetType === 'CARD' ? card?.color : method?.color) || '#4F46E5';

  const getMethodIcon = () => {
    if (targetType === 'CARD') return <CardIcon className="w-5 h-5" />;
    switch (method?.type) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-3xl overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Visual Theme */}
        <div
          className="p-6 text-white relative overflow-hidden transition-all flex flex-col gap-4"
          style={{ backgroundColor: entityColor }}
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-xs">
                {getMethodIcon()}
              </div>
              <div>
                <span className="text-[10px] font-black tracking-widest uppercase opacity-80 block">
                  {targetType === 'CARD' ? 'Fatura / Compras Consolidadas' : 'Lançamentos Consolidados'}
                </span>
                <h2 className="text-xl font-black tracking-tight">{entityTitle}</h2>
                <span className="text-xs opacity-80">{entitySubtitle}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Month Selector inside Header */}
          <div className="flex items-center justify-between bg-black/20 backdrop-blur-md rounded-2xl px-4 py-2 border border-white/10 z-10">
            <button
              onClick={() => setSelectedMonth(getAdjacentMonth(selectedMonth, -1))}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Mês Anterior</span>
            </button>

            <div className="flex items-center gap-2 font-black text-sm uppercase tracking-wide">
              <Calendar className="w-4 h-4 opacity-75" />
              <span>{getMonthName(selectedMonth)}</span>
            </div>

            <button
              onClick={() => setSelectedMonth(getAdjacentMonth(selectedMonth, 1))}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
            >
              <span className="hidden sm:inline">Próximo Mês</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Key Summary Stats in Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 z-10 pt-1">
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-3 border border-white/15 flex flex-col">
              <span className="text-[10px] uppercase font-bold opacity-80">Total no Mês</span>
              <span className="text-lg font-black tracking-tight mt-0.5">
                {formatCurrency(totalAmount)}
              </span>
              <span className="text-[10px] opacity-75">{allMatchingExpenses.length} lançamentos</span>
            </div>

            <div className="bg-emerald-500/25 backdrop-blur-md rounded-2xl p-3 border border-emerald-300/30 flex flex-col">
              <span className="text-[10px] uppercase font-bold text-emerald-100 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Pagas / Baixadas
              </span>
              <span className="text-lg font-black text-white tracking-tight mt-0.5">
                {formatCurrency(totalPaid)}
              </span>
              <span className="text-[10px] text-emerald-100">{paidExpenses.length} itens</span>
            </div>

            <div className="bg-amber-500/25 backdrop-blur-md rounded-2xl p-3 border border-amber-300/30 flex flex-col">
              <span className="text-[10px] uppercase font-bold text-amber-100 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Pendentes
              </span>
              <span className="text-lg font-black text-white tracking-tight mt-0.5">
                {formatCurrency(totalPending)}
              </span>
              <span className="text-[10px] text-amber-100">{pendingExpenses.length} itens</span>
            </div>

            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-3 border border-white/15 flex flex-col">
              <span className="text-[10px] uppercase font-bold opacity-80 flex items-center gap-1">
                <Layers className="w-3 h-3" />
                Parceladas / À Vista
              </span>
              <span className="text-xs font-black tracking-tight mt-0.5">
                {formatCurrency(totalInstallments)} <span className="opacity-70 font-normal">parc.</span>
              </span>
              <span className="text-[10px] opacity-80">
                {formatCurrency(totalSingle)} <span className="opacity-70 font-normal">à vista</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200/90 flex flex-wrap items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200/80 shadow-2xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas ({allMatchingExpenses.length})
            </button>
            <button
              onClick={() => setStatusFilter('PENDENTE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === 'PENDENTE'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              <Clock className="w-3 h-3" />
              Pendentes ({pendingExpenses.length})
            </button>
            <button
              onClick={() => setStatusFilter('PAGA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === 'PAGA'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              Pagas ({paidExpenses.length})
            </button>
          </div>

          {/* Quick Batch Actions */}
          <div className="flex items-center gap-2">
            {pendingExpenses.length > 0 && (
              <button
                disabled={processing}
                onClick={() => handleMarkAll('PAGA')}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                title="Marcar todas as despesas deste cartão/tipo no mês como pagas"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Marcar Todas como Pagas</span>
              </button>
            )}

            {paidExpenses.length > 0 && (
              <button
                disabled={processing}
                onClick={() => handleMarkAll('PENDENTE')}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                title="Reabrir / Deixar todas como pendentes"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Deixar Pendentes</span>
              </button>
            )}
          </div>
        </div>

        {/* Expenses List */}
        <div className="p-6 overflow-y-auto flex-1 divide-y divide-slate-100">
          {filteredList.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <Filter className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">Nenhuma despesa encontrada</h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Não há despesas correspondentes a este filtro em {getMonthName(selectedMonth)}.
              </p>
            </div>
          ) : (
            filteredList.map((exp) => {
              const isPaid = exp.status === 'PAGA';

              return (
                <div
                  key={exp.id}
                  className="py-3.5 flex items-center justify-between gap-4 transition-colors hover:bg-slate-50/80 -mx-3 px-3 rounded-2xl"
                >
                  {/* Left Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => toggleExpenseStatus(exp.id, exp.status)}
                      title={isPaid ? 'Clique para desmarcar (deixar pendente)' : 'Clique para marcar como paga'}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                        isPaid
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      }`}
                    >
                      {isPaid ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-bold truncate ${
                            isPaid ? 'text-slate-500 line-through' : 'text-slate-900'
                          }`}
                        >
                          {exp.description}
                        </span>

                        {exp.isInstallment && (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-bold">
                            {exp.installmentNumber}/{exp.totalInstallments}
                          </span>
                        )}

                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-semibold">
                          {exp.categoryName || 'Geral'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                        <span>{formatDateBR(exp.date)}</span>
                        {exp.notes && <span className="truncate max-w-xs">• {exp.notes}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right Value & Toggle Action */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-slate-900 block">
                        {formatCurrency(exp.amount)}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          isPaid ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      >
                        {isPaid ? 'PAGA' : 'PENDENTE'}
                      </span>
                    </div>

                    <button
                      onClick={() => toggleExpenseStatus(exp.id, exp.status)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        isPaid
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                      }`}
                    >
                      {isPaid ? 'Reabrir' : 'Pagar'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Exibindo {filteredList.length} de {allMatchingExpenses.length} despesas em{' '}
            {getMonthName(selectedMonth)}
          </span>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
