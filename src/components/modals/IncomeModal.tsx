import React, { useState, useEffect } from 'react';
import { X, TrendingUp, DollarSign, Calendar, CheckCircle2, Clock, Sparkles, Repeat, Target } from 'lucide-react';
import { ExtraIncome, IncomeStatus } from '../../types';
import { useFinance } from '../../context/FinanceContext';
import { getCurrentDate, getCurrentMonth, getMonthName } from '../../utils/formatters';
import { INCOME_ORIGINS } from '../../utils/defaultCategories';

interface IncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  incomeToEdit?: ExtraIncome | null;
}

export const IncomeModal: React.FC<IncomeModalProps> = ({
  isOpen,
  onClose,
  incomeToEdit,
}) => {
  const { selectedMonth, addIncome, updateIncome } = useFinance();

  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDay, setRecurrenceDay] = useState<number>(10);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | string>('');
  const [date, setDate] = useState(getCurrentDate());
  const [referenceMonth, setReferenceMonth] = useState(selectedMonth || getCurrentMonth());
  const [origin, setOrigin] = useState('Freelance');
  const [status, setStatus] = useState<IncomeStatus>('RECEIVED');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (incomeToEdit) {
      setIsRecurring(!!incomeToEdit.isRecurring);
      setRecurrenceDay(incomeToEdit.recurrenceDay || 10);
      setDescription(incomeToEdit.description);
      setAmount(incomeToEdit.amount);
      setDate(incomeToEdit.date || getCurrentDate());
      setReferenceMonth(incomeToEdit.referenceMonth || selectedMonth || getCurrentMonth());
      setOrigin(incomeToEdit.origin || 'Freelance');
      setStatus(incomeToEdit.status);
      setNotes(incomeToEdit.notes || '');
    } else {
      setIsRecurring(false);
      setRecurrenceDay(10);
      setDescription('');
      setAmount('');
      const targetMonth = selectedMonth || getCurrentMonth();
      const initialDate = targetMonth === getCurrentMonth() ? getCurrentDate() : `${targetMonth}-01`;
      setDate(initialDate);
      setReferenceMonth(targetMonth);
      setOrigin('1/3 de Férias');
      setStatus('RECEIVED');
      setNotes('');
    }
    setErrorMsg(null);
  }, [incomeToEdit, isOpen, selectedMonth]);

  if (!isOpen) return null;

  const numAmount = typeof amount === 'number' ? amount : parseFloat(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!description.trim()) {
      setErrorMsg('Por favor, informe a descrição da renda extra.');
      return;
    }
    if (!numAmount || numAmount <= 0) {
      setErrorMsg('Por favor, informe um valor válido maior que zero.');
      return;
    }

    setSaving(true);
    try {
      const effectiveDate = isRecurring
        ? `${referenceMonth}-${String(Math.min(28, Math.max(1, recurrenceDay || 10))).padStart(2, '0')}`
        : date;

      const targetRefMonth = isRecurring
        ? 'ALL'
        : (referenceMonth || (effectiveDate ? effectiveDate.substring(0, 7) : selectedMonth) || getCurrentMonth());

      if (incomeToEdit) {
        await updateIncome(incomeToEdit.id, {
          description: description.trim(),
          amount: numAmount,
          date: effectiveDate,
          referenceMonth: targetRefMonth,
          origin,
          status,
          isRecurring,
          recurrenceDay: isRecurring ? recurrenceDay : undefined,
          notes: notes.trim(),
        });
      } else {
        await addIncome({
          description: description.trim(),
          amount: numAmount,
          date: effectiveDate,
          referenceMonth: targetRefMonth,
          origin,
          status,
          isRecurring,
          recurrenceDay: isRecurring ? recurrenceDay : undefined,
          notes: notes.trim(),
        });
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving income:', err);
      setErrorMsg(err.message || 'Erro ao salvar renda extra.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {incomeToEdit ? 'Editar Renda Extra' : 'Nova Renda Extra'}
              </h2>
              <p className="text-xs text-slate-500">
                {isRecurring ? 'Renda extra padrão recorrente para todos os meses' : `Mês de referência: ${getMonthName(referenceMonth)}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Recurrence Mode Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Frequência da Renda Extra
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsRecurring(false)}
                className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  !isRecurring
                    ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <div className={`p-2 rounded-xl mt-0.5 ${!isRecurring ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-xs text-slate-900 block">
                    Pontual deste Mês
                  </span>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                    Valor único inserido apenas em {getMonthName(referenceMonth)}.
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsRecurring(true)}
                className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  isRecurring
                    ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <div className={`p-2 rounded-xl mt-0.5 ${isRecurring ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <Repeat className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-xs text-slate-900 block">
                    Padrão / Todos os Meses
                  </span>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                    Valor fixo repetido todo mês (aluguel, dividendos, etc).
                  </span>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Descrição da Renda Extra *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: 1/3 de Férias, Massoterapia, Freelance, 13º Salário..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition-all text-sm"
              required
              autoFocus
            />
            {/* Quick Suggestions Chips */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-1">Sugestões:</span>
              {[
                { label: '1/3 de Férias', origin: '1/3 de Férias' },
                { label: 'Férias', origin: 'Férias' },
                { label: '13º Salário', origin: '13º Salário' },
                { label: 'Massoterapia', origin: 'Serviço' },
                { label: 'Freelance', origin: 'Freelance' },
                { label: 'Hora Extra', origin: 'Hora extra' },
                { label: 'Bônus / PLR', origin: 'Bônus / PLR' },
                { label: 'Adiantamento', origin: 'Adiantamento Salarial' },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    setDescription(chip.label);
                    setOrigin(chip.origin);
                  }}
                  className="px-2 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-600 transition-colors cursor-pointer"
                >
                  + {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Valor (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-slate-400 font-bold text-sm">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition-all text-base"
                  required
                />
              </div>
            </div>

            {isRecurring ? (
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Dia do Mês (1-31) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={recurrenceDay}
                  onChange={(e) => setRecurrenceDay(parseInt(e.target.value, 10) || 10)}
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-hidden text-sm"
                  required
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Data do Recebimento *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setDate(newDate);
                    if (newDate && newDate.length >= 7) {
                      setReferenceMonth(newDate.substring(0, 7));
                    }
                  }}
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-hidden text-sm"
                  required
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Origem da Renda
            </label>
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-hidden text-sm cursor-pointer"
            >
              {INCOME_ORIGINS.map((orig) => (
                <option key={orig} value={orig}>
                  {orig}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Status do Recebimento
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus('RECEIVED')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  status === 'RECEIVED'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-400/20 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                RECEBIDO
              </button>

              <button
                type="button"
                onClick={() => setStatus('PENDING')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  status === 'PENDING'
                    ? 'bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-400/20 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-4 h-4 text-amber-600" />
                A RECEBER
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Observação (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes ou contato do pagador"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-hidden text-xs"
            />
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-slate-100 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Salvando...' : incomeToEdit ? 'Atualizar' : isRecurring ? 'Salvar Renda Recorrente' : 'Salvar Renda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
