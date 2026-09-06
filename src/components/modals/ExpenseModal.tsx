import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CreditCard as CardIcon,
  Calendar,
  Tag,
  DollarSign,
  FileText,
  CheckCircle2,
  Clock,
  Infinity as InfinityIcon,
  Calculator,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Expense, PaymentMethod, ExpenseStatus } from '../../types';
import { useFinance } from '../../context/FinanceContext';
import {
  getCurrentDate,
  getCurrentMonth,
  getAdjacentMonth,
  formatCurrency,
  getMonthName,
  splitInstallments,
} from '../../utils/formatters';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenseToEdit?: Expense | null;
}

type InstallmentMode = 'SINGLE' | 'FIXED' | 'INDEFINITE';
type AmountInputType = 'TOTAL' | 'PARCEL';

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  expenseToEdit,
}) => {
  const {
    categories,
    creditCards,
    paymentMethods,
    selectedMonth,
    addExpense,
    updateExpense,
    createInstallmentPurchase,
  } = useFinance();

  // Basic Information
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getCurrentDate());
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [cardId, setCardId] = useState('');
  const [status, setStatus] = useState<ExpenseStatus>('PENDENTE');
  const [notes, setNotes] = useState('');
  const [updateAllInstallments, setUpdateAllInstallments] = useState(true);

  // Value Entry Mode: Total or Parcel Value
  const [amountInputType, setAmountInputType] = useState<AmountInputType>('TOTAL');
  const [totalAmountInput, setTotalAmountInput] = useState<string>('');
  const [parcelAmountInput, setParcelAmountInput] = useState<string>('');

  // Installment Mode & Count
  const [installmentMode, setInstallmentMode] = useState<InstallmentMode>('SINGLE');
  const [installmentCount, setInstallmentCount] = useState<number>(2);
  const [customInstallments, setCustomInstallments] = useState<string>('');

  // Start Month for payments
  const [startMonth, setStartMonth] = useState<string>(selectedMonth || getCurrentMonth());

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active installment count
  const activeInstallmentCount = useMemo(() => {
    if (installmentMode === 'SINGLE') return 1;
    if (installmentMode === 'INDEFINITE') return 1;
    if (customInstallments) {
      const parsed = parseInt(customInstallments, 10);
      return parsed > 0 ? parsed : 2;
    }
    return installmentCount;
  }, [installmentMode, customInstallments, installmentCount]);

  // Sync inputs bidirectionally when mode, amount, or count changes
  useEffect(() => {
    if (installmentMode === 'SINGLE' || installmentMode === 'INDEFINITE') {
      // In single or indefinite mode, total and parcel are identical
      if (amountInputType === 'TOTAL' && totalAmountInput) {
        setParcelAmountInput(totalAmountInput);
      } else if (amountInputType === 'PARCEL' && parcelAmountInput) {
        setTotalAmountInput(parcelAmountInput);
      }
      return;
    }

    // In fixed installment mode (2x+)
    if (amountInputType === 'TOTAL') {
      const numTotal = parseFloat(totalAmountInput) || 0;
      if (numTotal > 0 && activeInstallmentCount > 0) {
        const calculatedParcel = (numTotal / activeInstallmentCount).toFixed(2);
        setParcelAmountInput(calculatedParcel);
      } else {
        setParcelAmountInput('');
      }
    } else {
      const numParcel = parseFloat(parcelAmountInput) || 0;
      if (numParcel > 0 && activeInstallmentCount > 0) {
        const calculatedTotal = (numParcel * activeInstallmentCount).toFixed(2);
        setTotalAmountInput(calculatedTotal);
      } else {
        setTotalAmountInput('');
      }
    }
  }, [amountInputType, totalAmountInput, parcelAmountInput, activeInstallmentCount, installmentMode]);

  // Derived effective numerical values
  const effectiveTotalAmount = useMemo(() => {
    if (amountInputType === 'TOTAL') {
      return parseFloat(totalAmountInput) || 0;
    } else {
      const p = parseFloat(parcelAmountInput) || 0;
      return installmentMode === 'FIXED' ? Number((p * activeInstallmentCount).toFixed(2)) : p;
    }
  }, [amountInputType, totalAmountInput, parcelAmountInput, installmentMode, activeInstallmentCount]);

  const effectiveParcelAmount = useMemo(() => {
    if (amountInputType === 'PARCEL') {
      return parseFloat(parcelAmountInput) || 0;
    } else {
      const t = parseFloat(totalAmountInput) || 0;
      return installmentMode === 'FIXED' && activeInstallmentCount > 0
        ? Number((t / activeInstallmentCount).toFixed(2))
        : t;
    }
  }, [amountInputType, totalAmountInput, parcelAmountInput, installmentMode, activeInstallmentCount]);

  // Initialize or reset form on open or edit change
  useEffect(() => {
    if (expenseToEdit) {
      setDescription(expenseToEdit.description);
      const valStr = String(expenseToEdit.amount || '');
      setTotalAmountInput(valStr);
      setParcelAmountInput(valStr);
      setAmountInputType('TOTAL');
      setDate(expenseToEdit.date || getCurrentDate());
      setCategoryId(expenseToEdit.categoryId || (categories[0]?.id ?? ''));
      setPaymentMethod(expenseToEdit.paymentMethod);
      setPaymentMethodId(expenseToEdit.paymentMethodId || '');

      const matchedCard = creditCards.find(
        (c) =>
          c.id === expenseToEdit.cardId ||
          c.name.toLowerCase() === (expenseToEdit.cardName || '').toLowerCase()
      );
      setCardId(matchedCard?.id || expenseToEdit.cardId || (creditCards[0]?.id ?? ''));

      setStatus(expenseToEdit.status);
      setNotes(expenseToEdit.notes || '');
      setInstallmentMode('SINGLE');
      setUpdateAllInstallments(true);
      setStartMonth(expenseToEdit.referenceMonth || selectedMonth || getCurrentMonth());
    } else {
      setDescription('');
      setTotalAmountInput('');
      setParcelAmountInput('');
      setAmountInputType('TOTAL');
      setDate(getCurrentDate());
      setCategoryId(categories[0]?.id || '');
      setPaymentMethod('PIX');
      setPaymentMethodId('');
      setCardId(creditCards[0]?.id || '');
      setStatus('PENDENTE');
      setNotes('');
      setInstallmentMode('SINGLE');
      setInstallmentCount(2);
      setCustomInstallments('');
      setStartMonth(selectedMonth || getCurrentMonth());
      setUpdateAllInstallments(true);
    }
    setErrorMsg(null);
  }, [expenseToEdit, isOpen, categories, creditCards, selectedMonth]);

  if (!isOpen) return null;

  // Selected card details
  const selectedCard = creditCards.find((c) => c.id === cardId) || creditCards[0];

  // Compute live parcel preview for fixed installments
  const parcelList =
    installmentMode === 'FIXED' && effectiveTotalAmount > 0 && activeInstallmentCount > 1
      ? splitInstallments(effectiveTotalAmount, activeInstallmentCount).map((val, idx) => ({
          num: idx + 1,
          total: activeInstallmentCount,
          val,
          month: getAdjacentMonth(startMonth, idx),
        }))
      : [];

  const handleTotalInputChange = (val: string) => {
    setTotalAmountInput(val);
    if (amountInputType !== 'TOTAL') {
      setAmountInputType('TOTAL');
    }
  };

  const handleParcelInputChange = (val: string) => {
    setParcelAmountInput(val);
    if (amountInputType !== 'PARCEL') {
      setAmountInputType('PARCEL');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!description.trim()) {
      setErrorMsg('Por favor, informe a descrição da despesa.');
      return;
    }

    if (!effectiveTotalAmount || effectiveTotalAmount <= 0) {
      setErrorMsg('Por favor, informe um valor válido maior que zero.');
      return;
    }

    const selectedCat = categories.find((c) => c.id === categoryId) || categories[0];
    const categoryName = selectedCat?.name || 'Geral';
    const isPixCat = categoryName.toLowerCase().trim() === 'pix' || /\bpix\b/i.test(categoryName);
    const effectivePaymentMethod: PaymentMethod = isPixCat ? 'PIX' : paymentMethod;

    if (effectivePaymentMethod === 'CARTAO_CREDITO' && (!cardId || creditCards.length === 0)) {
      setErrorMsg('Por favor, selecione ou cadastre um cartão de crédito.');
      return;
    }

    const cardName = selectedCard ? `${selectedCard.name} (${selectedCard.bank})` : undefined;
    const selectedCustomMethod = paymentMethods.find((pm) => pm.id === paymentMethodId);
    const customMethodName = selectedCustomMethod?.name;

    // Use selected startMonth for referenceMonth or date month
    const referenceMonth = startMonth || date.substring(0, 7);
    const dayFromDate = date.split('-')[2] || '10';
    const effectiveDay = Math.min(28, Math.max(1, parseInt(dayFromDate, 10)));
    const targetDate = `${startMonth}-${String(effectiveDay).padStart(2, '0')}`;

    setSaving(true);
    try {
      if (expenseToEdit) {
        // Update existing expense
        await updateExpense(
          expenseToEdit.id,
          {
            description: description.trim(),
            amount: effectiveTotalAmount,
            date: targetDate,
            referenceMonth,
            categoryId: selectedCat?.id || '',
            categoryName,
            paymentMethod: effectivePaymentMethod,
            paymentMethodId:
              effectivePaymentMethod !== 'CARTAO_CREDITO' && paymentMethodId ? paymentMethodId : undefined,
            paymentMethodName: effectivePaymentMethod !== 'CARTAO_CREDITO' ? customMethodName : undefined,
            cardId: effectivePaymentMethod === 'CARTAO_CREDITO' ? cardId : undefined,
            cardName:
              effectivePaymentMethod === 'CARTAO_CREDITO'
                ? selectedCard?.name || expenseToEdit.cardName || 'Cartão de Crédito'
                : undefined,
            status,
            notes: notes.trim(),
          },
          updateAllInstallments
        );
      } else if (installmentMode === 'INDEFINITE') {
        // Create indefinite installment purchase (tempo indeterminado)
        await createInstallmentPurchase({
          title: description.trim(),
          totalAmount: effectiveParcelAmount, // monthly recurring amount
          installmentCount: 24,
          startMonth,
          cardId: effectivePaymentMethod === 'CARTAO_CREDITO' ? cardId : 'other-method',
          cardName: effectivePaymentMethod === 'CARTAO_CREDITO' ? cardName : customMethodName || effectivePaymentMethod,
          categoryId: selectedCat?.id || '',
          categoryName,
          defaultDay: effectiveDay,
          isIndefinite: true,
          monthlyAmount: effectiveParcelAmount,
        });
      } else if (installmentMode === 'FIXED' && activeInstallmentCount > 1) {
        // Create fixed installment purchase
        await createInstallmentPurchase({
          title: description.trim(),
          totalAmount: effectiveTotalAmount,
          installmentCount: activeInstallmentCount,
          startMonth,
          cardId: effectivePaymentMethod === 'CARTAO_CREDITO' ? cardId : 'other-method',
          cardName: effectivePaymentMethod === 'CARTAO_CREDITO' ? cardName : customMethodName || effectivePaymentMethod,
          categoryId: selectedCat?.id || '',
          categoryName,
          defaultDay: effectiveDay,
          isIndefinite: false,
        });
      } else {
        // Create single expense (À Vista 1x)
        await addExpense({
          description: description.trim(),
          amount: effectiveTotalAmount,
          date: targetDate,
          referenceMonth,
          categoryId: selectedCat?.id || '',
          categoryName,
          paymentMethod,
          paymentMethodId:
            paymentMethod !== 'CARTAO_CREDITO' && paymentMethodId ? paymentMethodId : undefined,
          paymentMethodName: paymentMethod !== 'CARTAO_CREDITO' ? customMethodName : undefined,
          cardId: paymentMethod === 'CARTAO_CREDITO' ? cardId : undefined,
          cardName: paymentMethod === 'CARTAO_CREDITO' ? cardName : undefined,
          status,
          notes: notes.trim(),
        });
      }

      onClose();
    } catch (err: any) {
      console.error('Error saving expense:', err);
      setErrorMsg(err.message || 'Erro ao salvar despesa. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-100 flex flex-col gap-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold shadow-xs">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {expenseToEdit ? 'Editar Despesa' : 'Nova Despesa'}
              </h2>
              <p className="text-xs text-slate-500">
                {expenseToEdit
                  ? 'Atualize os dados e o parcelamento do lançamento'
                  : 'Lance à vista, parcelado com cálculo automático ou por tempo indeterminado'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center gap-2">
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4.5">
          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Descrição da Despesa *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Supermercado, Notebook Dell, Seguro do Carro, Curso Online"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition-all text-sm"
              required
            />
          </div>

          {/* Installment / Payment Type Selector */}
          {!expenseToEdit && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  Condição de Pagamento
                </label>
                <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                  {installmentMode === 'SINGLE' && '1x À Vista'}
                  {installmentMode === 'FIXED' && `${activeInstallmentCount}x Parcelado`}
                  {installmentMode === 'INDEFINITE' && 'Recorrência Mensal'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 bg-slate-200/80 p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setInstallmentMode('SINGLE')}
                  className={`py-2 px-2 rounded-lg font-bold transition-all text-center ${
                    installmentMode === 'SINGLE'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  À Vista (1x)
                </button>
                <button
                  type="button"
                  onClick={() => setInstallmentMode('FIXED')}
                  className={`py-2 px-2 rounded-lg font-bold transition-all text-center ${
                    installmentMode === 'FIXED'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Parcelado (x)
                </button>
                <button
                  type="button"
                  onClick={() => setInstallmentMode('INDEFINITE')}
                  className={`py-2 px-2 rounded-lg font-bold transition-all text-center flex items-center justify-center gap-1 ${
                    installmentMode === 'INDEFINITE'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <InfinityIcon className="w-3 h-3" />
                  <span>Indeterminado</span>
                </button>
              </div>

              {/* Fixed Installments Selection */}
              {installmentMode === 'FIXED' && (
                <div className="pt-2 border-t border-slate-200/70 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Número de Parcelas
                    </label>
                    <select
                      value={customInstallments ? 'custom' : installmentCount}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setCustomInstallments('14');
                        } else {
                          setInstallmentCount(Number(e.target.value));
                          setCustomInstallments('');
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-xs"
                    >
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 36, 48].map((num) => (
                        <option key={num} value={num}>
                          {num}x parcelas
                        </option>
                      ))}
                      <option value="custom">Outro número de vezes...</option>
                    </select>
                  </div>

                  {customInstallments ? (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Digite a quantidade (ex: 15)
                      </label>
                      <input
                        type="number"
                        min="2"
                        max="120"
                        value={customInstallments}
                        onChange={(e) => setCustomInstallments(e.target.value)}
                        placeholder="Ex: 15"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Mês da 1ª Parcela
                      </label>
                      <input
                        type="month"
                        value={startMonth}
                        onChange={(e) => setStartMonth(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-xs"
                      />
                    </div>
                  )}

                  {customInstallments && (
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Mês da 1ª Parcela
                      </label>
                      <input
                        type="month"
                        value={startMonth}
                        onChange={(e) => setStartMonth(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-xs"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Indefinite Mode Start Month */}
              {installmentMode === 'INDEFINITE' && (
                <div className="pt-2 border-t border-slate-200/70">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Mês de Início da Recorrência
                  </label>
                  <input
                    type="month"
                    value={startMonth}
                    onChange={(e) => setStartMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-xs"
                  />
                </div>
              )}
            </div>
          )}

          {/* Amount Inputs: User Chooses to enter Total Amount OR Parcel Amount */}
          <div className="p-3.5 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-emerald-600" />
                Como deseja digitar o valor?
              </label>

              {installmentMode === 'FIXED' && activeInstallmentCount > 1 && (
                <div className="flex items-center p-0.5 bg-white border border-emerald-200 rounded-xl text-[11px]">
                  <button
                    type="button"
                    onClick={() => setAmountInputType('TOTAL')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      amountInputType === 'TOTAL'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Valor Total
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountInputType('PARCEL')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      amountInputType === 'PARCEL'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Valor da Parcela
                  </button>
                </div>
              )}
            </div>

            {/* Inputs Grid with Real-time automatic calculation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Total Amount Input */}
              <div
                className={`p-2.5 rounded-xl border transition-all ${
                  amountInputType === 'TOTAL'
                    ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'bg-white/70 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase">
                    {installmentMode === 'INDEFINITE' ? 'Valor Mensal' : 'Valor Total da Compra'}
                  </label>
                  {amountInputType === 'TOTAL' && (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.2 rounded">
                      Digitando
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={totalAmountInput}
                    onChange={(e) => handleTotalInputChange(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-8 pr-2 py-2 bg-transparent rounded-lg font-black text-slate-900 text-base focus:outline-hidden"
                    required={amountInputType === 'TOTAL'}
                  />
                </div>
              </div>

              {/* Parcel Amount Input (Auto Calculated or Direct Entry) */}
              {installmentMode === 'FIXED' && activeInstallmentCount > 1 && (
                <div
                  className={`p-2.5 rounded-xl border transition-all ${
                    amountInputType === 'PARCEL'
                      ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'bg-white/70 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700 uppercase">
                      Valor de Cada Parcela ({activeInstallmentCount}x)
                    </label>
                    {amountInputType === 'PARCEL' ? (
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.2 rounded">
                        Digitando
                      </span>
                    ) : (
                      <span className="text-[10px] text-indigo-700 font-bold bg-indigo-100 px-1.5 py-0.2 rounded">
                        Calculado
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={parcelAmountInput}
                      onChange={(e) => handleParcelInputChange(e.target.value)}
                      placeholder="0,00"
                      className="w-full pl-8 pr-2 py-2 bg-transparent rounded-lg font-black text-slate-900 text-base focus:outline-hidden"
                      required={amountInputType === 'PARCEL'}
                    />
                  </div>
                </div>
              )}

              {/* Date Input for Single/Edit */}
              {(installmentMode === 'SINGLE' || expenseToEdit) && (
                <div className="p-2.5 bg-white/70 border border-slate-200 rounded-xl">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Data do Pagamento *
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      if (e.target.value) {
                        setStartMonth(e.target.value.substring(0, 7));
                      }
                    }}
                    className="w-full px-2 py-1.5 bg-transparent font-medium text-slate-800 text-xs focus:outline-hidden"
                    required
                  />
                </div>
              )}
            </div>

            {/* Smart Summary Banner */}
            {effectiveTotalAmount > 0 && (
              <div className="p-2.5 bg-white rounded-xl border border-emerald-200/90 text-xs flex items-center justify-between text-emerald-950 font-medium">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  {installmentMode === 'SINGLE' ? (
                    <span>
                      Pagamento único à vista de <strong>{formatCurrency(effectiveTotalAmount)}</strong> em{' '}
                      <strong>{getMonthName(startMonth)}</strong>
                    </span>
                  ) : installmentMode === 'INDEFINITE' ? (
                    <span>
                      Cobrança mensal recorrente de <strong>{formatCurrency(effectiveParcelAmount)}</strong> a partir de{' '}
                      <strong>{getMonthName(startMonth)}</strong>
                    </span>
                  ) : (
                    <span>
                      <strong>{activeInstallmentCount}x</strong> de{' '}
                      <strong>{formatCurrency(effectiveParcelAmount)}</strong> = Total de{' '}
                      <strong>{formatCurrency(effectiveTotalAmount)}</strong>
                    </span>
                  )}
                </div>
                {installmentMode === 'FIXED' && activeInstallmentCount > 1 && (
                  <span className="text-[11px] text-emerald-700 font-bold">
                    Início: {getMonthName(startMonth)}
                  </span>
                )}
              </div>
            )}

            {/* Detailed Installment Distribution List Preview */}
            {parcelList.length > 0 && (
              <div className="bg-white border border-indigo-100 rounded-xl p-3 max-h-32 overflow-y-auto flex flex-col gap-1.5 shadow-2xs">
                <div className="text-[11px] font-bold text-indigo-900 flex justify-between border-b border-indigo-50 pb-1">
                  <span>Previsão de Lançamento nos Meses:</span>
                  <span>{activeInstallmentCount} parcelas</span>
                </div>
                <div className="flex flex-col gap-1">
                  {parcelList.map((p) => (
                    <div
                      key={p.num}
                      className="flex justify-between items-center text-[11px] text-slate-600 font-medium py-0.5 hover:bg-slate-50 px-1 rounded"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[9px] flex items-center justify-center">
                          {p.num}
                        </span>
                        {getMonthName(p.month)}
                      </span>
                      <span className="font-bold text-slate-900">{formatCurrency(p.val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Categoria
            </label>
            <select
              value={categoryId}
              onChange={(e) => {
                const newCatId = e.target.value;
                setCategoryId(newCatId);
                const selected = categories.find((c) => c.id === newCatId);
                if (selected) {
                  const lowerName = selected.name.toLowerCase().trim();
                  if (lowerName === 'pix' || /\bpix\b/i.test(lowerName)) {
                    setPaymentMethod('PIX');
                    const pixPm = paymentMethods.find((pm) => pm.type === 'PIX');
                    if (pixPm) setPaymentMethodId(pixPm.id);
                  } else if (lowerName === 'boleto' || /\bboleto\b/i.test(lowerName)) {
                    setPaymentMethod('BOLETO');
                    const bolPm = paymentMethods.find((pm) => pm.type === 'BOLETO');
                    if (bolPm) setPaymentMethodId(bolPm.id);
                  }
                }
              }}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition-all text-sm"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Forma de Pagamento
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'CARTAO_CREDITO', label: '💳 Cartão Crédito' },
                  { id: 'PIX', label: 'Pix' },
                  { id: 'CARTAO_DEBITO', label: 'Cartão Débito' },
                  { id: 'BOLETO', label: 'Boleto' },
                  { id: 'DINHEIRO', label: 'Dinheiro' },
                ] as const
              ).map((method) => (
                <button
                  type="button"
                  key={method.id}
                  onClick={() => {
                    setPaymentMethod(method.id);
                    const matching = paymentMethods.find((pm) => pm.type === method.id);
                    if (matching) setPaymentMethodId(matching.id);
                    else setPaymentMethodId('');
                  }}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all border ${
                    paymentMethod === method.id
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>

            {/* Custom Payment Methods for Selected Base Type */}
            {paymentMethod !== 'CARTAO_CREDITO' && (
              <div className="mt-2.5">
                {paymentMethods.filter((pm) => pm.type === paymentMethod).length > 0 && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Identificador / Conta Vinculada:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {paymentMethods
                        .filter((pm) => pm.type === paymentMethod)
                        .map((pm) => {
                          const isSelected = paymentMethodId === pm.id;
                          return (
                            <button
                              type="button"
                              key={pm.id}
                              onClick={() => setPaymentMethodId(pm.id)}
                              className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${
                                isSelected
                                  ? 'bg-teal-50 border-teal-600 ring-2 ring-teal-500/20 text-teal-950 font-bold'
                                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                              }`}
                            >
                              <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: pm.color || '#0D9488' }}
                              />
                              <span className="text-xs truncate">{pm.name}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Credit Card Specific Fields */}
          {paymentMethod === 'CARTAO_CREDITO' && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CardIcon className="w-3.5 h-3.5 text-indigo-600" />
                  Cartão de Crédito Utilizado *
                </span>
                {selectedCard && (
                  <span className="text-[10px] text-slate-500 font-semibold">
                    Limite: {formatCurrency(selectedCard.totalLimit)}
                  </span>
                )}
              </label>

              {creditCards.length === 0 ? (
                <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  Nenhum cartão cadastrado ainda! Acesse a aba "Cartões" para cadastrar seus cartões.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {creditCards.map((c) => {
                    const isSelected = (cardId || creditCards[0]?.id) === c.id;
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setCardId(c.id)}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                          isSelected
                            ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                        }`}
                      >
                        <div
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: c.color || '#6366F1' }}
                        />
                        <div className="flex flex-col truncate">
                          <span className="text-xs font-bold text-slate-900 truncate">{c.name}</span>
                          <span className="text-[10px] text-slate-500 truncate">{c.bank}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Installment Sync Option when editing */}
              {expenseToEdit && (expenseToEdit.isInstallment || expenseToEdit.installmentPurchaseId) && (
                <div className="p-3 bg-purple-50/80 rounded-xl border border-purple-200/90 flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="update-all-installments-checkbox"
                    checked={updateAllInstallments}
                    onChange={(e) => setUpdateAllInstallments(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                  <label
                    htmlFor="update-all-installments-checkbox"
                    className="text-xs text-purple-950 font-medium cursor-pointer"
                  >
                    <span className="font-bold block text-purple-900">
                      Atualizar este cartão em todas as parcelas deste lançamento
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Status do Pagamento
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus('PENDENTE')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                  status === 'PENDENTE'
                    ? 'bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-400/20 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-4 h-4 text-amber-600" />
                PENDENTE
              </button>

              <button
                type="button"
                onClick={() => setStatus('PAGA')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                  status === 'PAGA'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-400/20 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                PAGA
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Observação (Opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Adicione detalhes, notas ou observações adicionais..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-hidden text-xs resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? 'Salvando...' : expenseToEdit ? 'Atualizar Despesa' : 'Salvar Despesa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
