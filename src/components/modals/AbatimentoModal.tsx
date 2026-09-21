import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CreditCard as CardIcon,
  Wallet,
  Calendar,
  DollarSign,
  TrendingDown,
  ArrowDownRight,
  FileText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, getMonthName } from '../../utils/formatters';
import { getCanonicalCardInfo, isExpenseMatchingCard, isExpenseMatchingPaymentMethod } from '../../utils/cardUtils';

interface AbatimentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTargetType?: 'CREDIT_CARD' | 'PAYMENT_METHOD';
  initialCardId?: string;
  initialPaymentMethod?: string;
}

export const AbatimentoModal: React.FC<AbatimentoModalProps> = ({
  isOpen,
  onClose,
  initialTargetType = 'CREDIT_CARD',
  initialCardId,
  initialPaymentMethod,
}) => {
  const {
    creditCards,
    paymentMethods,
    categories,
    expenses,
    selectedMonth,
    addAbatimento,
  } = useFinance();

  const [targetType, setTargetType] = useState<'CREDIT_CARD' | 'PAYMENT_METHOD'>(initialTargetType);
  const [cardId, setCardId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('BOLETO');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [referenceMonth, setReferenceMonth] = useState<string>(selectedMonth);
  const [description, setDescription] = useState<string>('');
  const [sourceMethod, setSourceMethod] = useState<string>('PIX');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Consolidated Credit Cards list
  const consolidatedCards = useMemo(() => {
    const map = new Map<string, {
      canonicalId: string;
      canonicalName: string;
      bank: string;
      color: string;
      originalCards: typeof creditCards;
    }>();

    for (const card of creditCards) {
      const canonical = getCanonicalCardInfo(card.id, card.name, creditCards);
      const key = canonical.canonicalName || card.name.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, {
          canonicalId: card.id,
          canonicalName: canonical.canonicalName || card.name,
          bank: card.bank || canonical.bank || card.name,
          color: card.color || canonical.color || '#4F46E5',
          originalCards: [card],
        });
      } else {
        map.get(key)!.originalCards.push(card);
      }
    }
    return Array.from(map.values());
  }, [creditCards]);

  // Initialize selections when opened
  useEffect(() => {
    if (isOpen) {
      setTargetType(initialTargetType);
      setReferenceMonth(selectedMonth);
      setDate(new Date().toISOString().substring(0, 10));
      setAmountStr('');
      setNotes('');
      setErrorMessage(null);

      if (initialCardId) {
        setCardId(initialCardId);
      } else if (consolidatedCards.length > 0) {
        setCardId(consolidatedCards[0].canonicalId);
      }

      if (initialPaymentMethod) {
        setPaymentMethod(initialPaymentMethod);
      } else {
        setPaymentMethod('BOLETO');
      }

      setSourceMethod('PIX');
    }
  }, [isOpen, initialTargetType, initialCardId, initialPaymentMethod, selectedMonth, consolidatedCards]);

  // Selected Card Details & Current Invoice Calculation
  const selectedCard = useMemo(() => {
    return consolidatedCards.find((c) => c.canonicalId === cardId);
  }, [consolidatedCards, cardId]);

  // Calculate gross current invoice for the selected card or method in referenceMonth
  const targetCurrentTotal = useMemo(() => {
    if (targetType === 'CREDIT_CARD' && selectedCard) {
      const matchingExpenses = expenses.filter((e) => {
        const expMonth = e.referenceMonth || (e.date ? e.date.substring(0, 7) : '');
        if (expMonth !== referenceMonth) return false;
        return isExpenseMatchingCard(e, selectedCard.canonicalId, selectedCard.canonicalName, creditCards);
      });
      return matchingExpenses.reduce((sum, e) => sum + e.amount, 0);
    }

    if (targetType === 'PAYMENT_METHOD') {
      const matchingExpenses = expenses.filter((e) => {
        const expMonth = e.referenceMonth || (e.date ? e.date.substring(0, 7) : '');
        if (expMonth !== referenceMonth) return false;
        return isExpenseMatchingPaymentMethod(
          e,
          paymentMethod as any,
          paymentMethodId || undefined,
          categories,
          paymentMethods,
          creditCards
        );
      });
      return matchingExpenses.reduce((sum, e) => sum + e.amount, 0);
    }

    return 0;
  }, [targetType, selectedCard, referenceMonth, expenses, creditCards, paymentMethod, paymentMethodId, categories, paymentMethods]);

  const numericAmount = useMemo(() => {
    const clean = amountStr.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [amountStr]);

  const netProjectedTotal = useMemo(() => {
    return Math.max(0, targetCurrentTotal - numericAmount);
  }, [targetCurrentTotal, numericAmount]);

  // Auto-fill description if empty
  useEffect(() => {
    if (targetType === 'CREDIT_CARD' && selectedCard) {
      setDescription(`Adiantamento ${selectedCard.canonicalName}`);
    } else if (targetType === 'PAYMENT_METHOD') {
      const methodObj = paymentMethods.find((p) => p.id === paymentMethodId);
      const label = methodObj ? methodObj.name : paymentMethod;
      setDescription(`Abatimento ${label}`);
    }
  }, [targetType, selectedCard, paymentMethod, paymentMethodId, paymentMethods]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (numericAmount <= 0) {
      setErrorMessage('Informe um valor de abatimento maior que zero.');
      return;
    }

    if (targetType === 'CREDIT_CARD' && !cardId) {
      setErrorMessage('Selecione o cartão de crédito onde deseja aplicar o abatimento.');
      return;
    }

    setLoading(true);
    try {
      const cardName = selectedCard ? selectedCard.canonicalName : undefined;
      const methodObj = paymentMethods.find((p) => p.id === paymentMethodId);

      await addAbatimento({
        userId: '',
        amount: numericAmount,
        targetType,
        cardId: targetType === 'CREDIT_CARD' ? cardId : undefined,
        cardName: targetType === 'CREDIT_CARD' ? cardName : undefined,
        paymentMethod: targetType === 'PAYMENT_METHOD' ? (paymentMethod as any) : undefined,
        paymentMethodId: targetType === 'PAYMENT_METHOD' ? (paymentMethodId || undefined) : undefined,
        paymentMethodName: targetType === 'PAYMENT_METHOD' ? (methodObj?.name || paymentMethod) : undefined,
        referenceMonth,
        date,
        description: description.trim() || 'Abatimento de Pagamento',
        sourceMethod,
        notes: notes.trim() || undefined,
      });

      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar abatimento:', err);
      setErrorMessage(err.message || 'Falha ao registrar abatimento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold shadow-xs">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Lançar Abatimento / Adiantamento
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Adiantar pagamento reduzirá o valor final a pagar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Target Type Selector (Cartão de Crédito vs Outro Método) */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
              Onde Deseja Abater? *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTargetType('CREDIT_CARD')}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer ${
                  targetType === 'CREDIT_CARD'
                    ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <CardIcon className="w-4 h-4" />
                <span>Cartão de Crédito</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetType('PAYMENT_METHOD')}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer ${
                  targetType === 'PAYMENT_METHOD'
                    ? 'bg-teal-50 border-teal-600 text-teal-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>Boleto / Outro Método</span>
              </button>
            </div>
          </div>

          {/* Target Selection Details */}
          {targetType === 'CREDIT_CARD' ? (
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                Qual Cartão de Crédito? *
              </label>
              <select
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="" disabled>
                  Selecione um cartão de crédito...
                </option>
                {consolidatedCards.map((card) => (
                  <option key={card.canonicalId} value={card.canonicalId}>
                    {card.canonicalName} ({card.bank})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tipo de Pagamento *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value);
                    setPaymentMethodId('');
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600"
                >
                  <option value="BOLETO">Boleto Bancário</option>
                  <option value="PIX">Pix</option>
                  <option value="CARTAO_DEBITO">Cartão de Débito</option>
                  <option value="DINHEIRO">Dinheiro em Espécie</option>
                  <option value="OUTROS">Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Conta / Método Específico (Opcional)
                </label>
                <select
                  value={paymentMethodId}
                  onChange={(e) => setPaymentMethodId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600"
                >
                  <option value="">Geral / Todos</option>
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name} ({pm.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Amount and Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                Valor do Abatimento (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                  R$
                </span>
                <input
                  type="text"
                  value={amountStr}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.,]/g, '');
                    setAmountStr(val);
                  }}
                  placeholder="0,00"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                Data do Adiantamento *
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600"
                  required
                />
              </div>
            </div>
          </div>

          {/* Reference Month & Source Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                Mês da Fatura / Competência *
              </label>
              <input
                type="month"
                value={referenceMonth}
                onChange={(e) => setReferenceMonth(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                Forma Usada para Pagar (Origem)
              </label>
              <select
                value={sourceMethod}
                onChange={(e) => setSourceMethod(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600"
              >
                <option value="PIX">Pix (Conta Bancária)</option>
                <option value="DEBITO">Cartão de Débito</option>
                <option value="DINHEIRO">Dinheiro Físico</option>
                <option value="SALDO">Saldo em Carteira</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              Descrição do Abatimento
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Adiantamento fatura Mercado Pago"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600"
            />
          </div>

          {/* Live Calculation Preview Box */}
          <div className="p-4 bg-gradient-to-br from-slate-50 to-indigo-50/30 border border-indigo-100/80 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold border-b border-slate-200/60 pb-2">
              <span>Fatura Bruta Original ({getMonthName(referenceMonth)})</span>
              <span className="text-slate-900 font-extrabold">
                {formatCurrency(targetCurrentTotal)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-rose-600 font-bold border-b border-slate-200/60 pb-2">
              <span className="flex items-center gap-1">
                <ArrowDownRight className="w-3.5 h-3.5" />
                Valor a Abater / Adiantado
              </span>
              <span className="font-extrabold">
                - {formatCurrency(numericAmount)}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-xs font-black text-slate-900 block">
                  Novo Total Atualizado a Pagar:
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {targetType === 'CREDIT_CARD' ? 'Fatura líquida do cartão' : 'Total líquido a pagar'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-emerald-700 block">
                  {formatCurrency(netProjectedTotal)}
                </span>
                {numericAmount > 0 && targetCurrentTotal > 0 && (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                    Redução de {Math.round((numericAmount / targetCurrentTotal) * 100)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              Observações (Opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações adicionais sobre o adiantamento..."
              rows={2}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading || numericAmount <= 0}
              className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-md shadow-teal-200 flex items-center gap-2 transition-all cursor-pointer"
            >
              {loading ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar Abatimento</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
