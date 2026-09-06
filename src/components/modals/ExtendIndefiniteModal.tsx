import React, { useState } from 'react';
import { X, CalendarPlus, Check, AlertCircle, ArrowRight, Ban, Infinity as InfinityIcon } from 'lucide-react';
import { InstallmentPurchase } from '../../types';
import { formatCurrency, getMonthName } from '../../utils/formatters';

interface ExtendIndefiniteModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: InstallmentPurchase | null;
  onExtend: (purchaseId: string, months: 3 | 6, newAmount: number) => Promise<void>;
  onInterrupt?: (purchaseId: string) => Promise<void>;
}

export const ExtendIndefiniteModal: React.FC<ExtendIndefiniteModalProps> = ({
  isOpen,
  onClose,
  purchase,
  onExtend,
  onInterrupt,
}) => {
  if (!isOpen || !purchase) return null;

  const currentMonthlyAmount = purchase.monthlyAmount || purchase.totalAmount || 0;
  const [selectedMonths, setSelectedMonths] = useState<3 | 6>(6);
  const [amountOption, setAmountOption] = useState<'SAME' | 'NEW'>('SAME');
  const [customAmount, setCustomAmount] = useState<string>(currentMonthlyAmount.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveAmount =
    amountOption === 'SAME'
      ? currentMonthlyAmount
      : parseFloat(customAmount.replace(',', '.')) || currentMonthlyAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (effectiveAmount <= 0) {
      setError('Informe um valor mensal válido maior que zero.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onExtend(purchase.id, selectedMonths, effectiveAmount);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao estender lançamento. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl">
              <CalendarPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-100 font-bold uppercase tracking-wider">
                <InfinityIcon className="w-3.5 h-3.5" />
                <span>Assinatura / Prazo Indeterminado</span>
              </div>
              <h2 className="text-xl font-black mt-0.5">Estender Lançamento</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 overflow-y-auto">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Info Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lançamento</span>
                <h3 className="text-base font-extrabold text-slate-900">{purchase.title}</h3>
                <span className="text-xs text-slate-500">
                  Cartão: {purchase.cardName || 'Cartão de Crédito'} • Início: {getMonthName(purchase.startMonth)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Valor Atual</span>
                <p className="text-base font-black text-emerald-600">{formatCurrency(currentMonthlyAmount)}/mês</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-1 bg-white p-2.5 rounded-xl border border-slate-200/60">
              💡 Este serviço foi projetado inicialmente por 6 meses. Deseja estender as parcelas mensais e manter os lançamentos futuros atualizados?
            </p>
          </div>

          {/* Question 1: How many months? */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              1. Por quanto tempo deseja estender?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedMonths(3)}
                className={`p-3.5 rounded-2xl border-2 font-bold text-xs flex flex-col items-center gap-1 transition-all ${
                  selectedMonths === 3
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                }`}
              >
                <span className="text-base font-black">+ 3 Meses</span>
                <span className="text-[11px] text-slate-500 font-medium">Projeção trimestral</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMonths(6)}
                className={`p-3.5 rounded-2xl border-2 font-bold text-xs flex flex-col items-center gap-1 transition-all ${
                  selectedMonths === 6
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                }`}
              >
                <span className="text-base font-black">+ 6 Meses</span>
                <span className="text-[11px] text-slate-500 font-medium">Recomendado (Semestral)</span>
              </button>
            </div>
          </div>

          {/* Question 2: Does the value stay the same? */}
          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              2. O valor mensal continua o mesmo?
            </label>

            <div className="flex flex-col gap-2">
              <label
                onClick={() => setAmountOption('SAME')}
                className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  amountOption === 'SAME'
                    ? 'border-emerald-500 bg-emerald-50/60 text-emerald-950 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      amountOption === 'SAME' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                    }`}
                  >
                    {amountOption === 'SAME' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-xs font-bold">Sim, continua {formatCurrency(currentMonthlyAmount)}/mês</span>
                </div>
                <span className="text-xs font-black text-emerald-700">{formatCurrency(currentMonthlyAmount)}</span>
              </label>

              <label
                onClick={() => setAmountOption('NEW')}
                className={`flex flex-col p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  amountOption === 'NEW'
                    ? 'border-emerald-500 bg-emerald-50/60 text-emerald-950 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        amountOption === 'NEW' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                      }`}
                    >
                      {amountOption === 'NEW' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-xs font-bold">Não, houve reajuste de valor</span>
                  </div>
                </div>

                {amountOption === 'NEW' && (
                  <div className="mt-3 pl-7">
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Novo Valor Mensal (R$)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        R$
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        placeholder="0,00"
                        className="w-full pl-9 pr-3 py-2 bg-white border border-emerald-300 rounded-xl text-sm font-extrabold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
            {onInterrupt && (
              <button
                type="button"
                onClick={async () => {
                  if (
                    window.confirm(
                      `Deseja interromper a assinatura "${purchase.title}"? Não serão geradas novas cobranças futuras.`
                    )
                  ) {
                    await onInterrupt(purchase.id);
                    onClose();
                  }
                }}
                className="w-full sm:w-auto px-4 py-2.5 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Interromper Assinatura</span>
              </button>
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-200 transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmitting ? 'Estendendo...' : `Confirmar +${selectedMonths} Meses`}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
