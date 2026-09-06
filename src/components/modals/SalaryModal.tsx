import React, { useState, useEffect } from 'react';
import { X, Briefcase, DollarSign, Calendar, CheckCircle2, Clock, Sparkles, Repeat } from 'lucide-react';
import { Salary, IncomeStatus } from '../../types';
import { useFinance } from '../../context/FinanceContext';
import { getCurrentDate, getCurrentMonth, getMonthName } from '../../utils/formatters';

interface SalaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  salaryToEdit?: Salary | null;
  initialAsStandard?: boolean;
}

export const SalaryModal: React.FC<SalaryModalProps> = ({
  isOpen,
  onClose,
  salaryToEdit,
  initialAsStandard = false,
}) => {
  const { selectedMonth, addSalary, updateSalary, setDefaultSalary, settings } = useFinance();

  const [isStandard, setIsStandard] = useState(true);
  const [amount, setAmount] = useState<number | string>('');
  const [payDay, setPayDay] = useState<number>(5);
  const [payDate, setPayDate] = useState(getCurrentDate());
  const [referenceMonth, setReferenceMonth] = useState(selectedMonth || getCurrentMonth());
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<IncomeStatus>('RECEIVED');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (salaryToEdit) {
      const isStd = salaryToEdit.isStandardDefault || (salaryToEdit.id && salaryToEdit.id.startsWith('std-salary-')) || false;
      setIsStandard(isStd);
      setAmount(salaryToEdit.amount);
      setPayDate(salaryToEdit.payDate || getCurrentDate());
      const extractedDay = salaryToEdit.payDate ? parseInt(salaryToEdit.payDate.split('-')[2] || '5', 10) : 5;
      setPayDay(extractedDay || 5);
      setReferenceMonth(salaryToEdit.referenceMonth || selectedMonth || getCurrentMonth());
      setDescription(salaryToEdit.description || '');
      setStatus(salaryToEdit.status);
    } else if (initialAsStandard || (settings?.defaultSalaryAmount && !salaryToEdit)) {
      setIsStandard(true);
      setAmount(settings?.defaultSalaryAmount || '');
      const dDay = settings?.defaultSalaryPayDay || 5;
      setPayDay(dDay);
      setPayDate(`${selectedMonth || getCurrentMonth()}-${String(dDay).padStart(2, '0')}`);
      setReferenceMonth(selectedMonth || getCurrentMonth());
      setDescription(settings?.defaultSalaryDescription || 'Salário Mensal Base');
      setStatus(settings?.defaultSalaryStatus || 'RECEIVED');
    } else {
      setIsStandard(true);
      setAmount('');
      setPayDay(5);
      setPayDate(`${selectedMonth || getCurrentMonth()}-05`);
      setReferenceMonth(selectedMonth || getCurrentMonth());
      setDescription('Salário Mensal Base');
      setStatus('RECEIVED');
    }
    setErrorMsg(null);
  }, [salaryToEdit, isOpen, selectedMonth, initialAsStandard, settings]);

  if (!isOpen) return null;

  const numAmount = typeof amount === 'number' ? amount : parseFloat(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!numAmount || numAmount <= 0) {
      setErrorMsg('Por favor, informe um valor de salário válido maior que zero.');
      return;
    }

    setSaving(true);
    try {
      if (isStandard) {
        // Update user settings default salary
        await setDefaultSalary({
          amount: numAmount,
          payDay: payDay || 5,
          description: description.trim() || 'Salário Mensal Base (Padrão)',
          status,
          active: true,
        });

        // Also if salaryToEdit exists and is a real document, update it
        if (salaryToEdit && !salaryToEdit.id.startsWith('std-salary-')) {
          await updateSalary(salaryToEdit.id, {
            amount: numAmount,
            payDate: `${referenceMonth}-${String(payDay || 5).padStart(2, '0')}`,
            referenceMonth,
            description: description.trim() || 'Salário Mensal Base (Padrão)',
            status,
            isStandardDefault: true,
            repeatMonthly: true,
          });
        }
      } else {
        // Specific month adjustment
        if (salaryToEdit && !salaryToEdit.id.startsWith('std-salary-')) {
          await updateSalary(salaryToEdit.id, {
            amount: numAmount,
            payDate,
            referenceMonth,
            description: description.trim() || 'Ajuste de Salário',
            status,
            isStandardDefault: false,
          });
        } else {
          await addSalary({
            amount: numAmount,
            payDate,
            referenceMonth,
            description: description.trim() || 'Ajuste de Salário',
            status,
            isStandardDefault: false,
          });
        }
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving salary:', err);
      setErrorMsg(err.message || 'Erro ao salvar salário.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {salaryToEdit ? 'Editar Salário' : 'Configurar Salário'}
              </h2>
              <p className="text-xs text-slate-500">
                {isStandard ? 'Salário padrão recorrente para todos os meses' : `Mês de referência: ${getMonthName(referenceMonth)}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
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
          {/* Mode Selector: Padronizado vs Pontual */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Tipo de Aplicação do Salário
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsStandard(true)}
                className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  isStandard
                    ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <div className={`p-2 rounded-xl mt-0.5 ${isStandard ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <Repeat className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-xs text-slate-900 block">
                    Salário Padrão
                  </span>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                    Aplica-se a <strong>todos os meses</strong> automaticamente.
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsStandard(false)}
                className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  !isStandard
                    ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <div className={`p-2 rounded-xl mt-0.5 ${!isStandard ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-xs text-slate-900 block">
                    Ajuste Específico
                  </span>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                    Apenas para o mês de {getMonthName(referenceMonth)}.
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Valor do Salário Líquido (R$) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-slate-400 font-bold text-sm">R$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="5.500,00"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all text-base"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Date controls */}
          {isStandard ? (
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Dia do Recebimento Todo Mês (1 a 31) *
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={payDay}
                  onChange={(e) => setPayDay(parseInt(e.target.value, 10) || 5)}
                  className="w-24 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden text-sm"
                  required
                />
                <span className="text-xs text-slate-500 font-medium">
                  Ex: Todo 5º dia útil ou dia {payDay || 5} de cada mês
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Mês de Referência *
                </label>
                <input
                  type="month"
                  value={referenceMonth}
                  onChange={(e) => setReferenceMonth(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Data do Recebimento *
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden text-xs"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Empresa / Empregador / Descrição
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Salário Empresa Principal, CLT, Pró-labore"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Status Inicial do Recebimento
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

          <div className="flex items-center gap-3 pt-3 border-t border-slate-100 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : isStandard ? 'Salvar Salário Padrão' : 'Salvar Ajuste'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
