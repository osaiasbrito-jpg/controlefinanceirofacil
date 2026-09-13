import React, { useState, useEffect } from 'react';
import { X, Sparkles, DollarSign, Calendar, FileText, CheckCircle } from 'lucide-react';
import { RendaMassoterapia } from '../../types';
import { useFinance } from '../../context/FinanceContext';
import { getCurrentDate, getCurrentMonth } from '../../utils/formatters';

interface MassoterapiaModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemToEdit?: RendaMassoterapia | null;
}

export const MassoterapiaModal: React.FC<MassoterapiaModalProps> = ({
  isOpen,
  onClose,
  itemToEdit,
}) => {
  const { selectedMonth, addMassoterapiaIncome, updateMassoterapiaIncome } = useFinance();

  const [dataLancamento, setDataLancamento] = useState(getCurrentDate());
  const [valor, setValor] = useState<number | string>('');
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (itemToEdit) {
      setDataLancamento(itemToEdit.dataLancamento || getCurrentDate());
      setValor(itemToEdit.valor || '');
      setObservacao(itemToEdit.observacao || '');
    } else {
      const targetMonth = selectedMonth || getCurrentMonth();
      const initialDate = targetMonth === getCurrentMonth() ? getCurrentDate() : `${targetMonth}-01`;
      setDataLancamento(initialDate);
      setValor('');
      setObservacao('');
    }
    setErrorMsg(null);
  }, [itemToEdit, isOpen, selectedMonth]);

  if (!isOpen) return null;

  const numValor = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(',', '.')) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!dataLancamento) {
      setErrorMsg('Por favor, informe a data do atendimento/recebimento.');
      return;
    }

    if (!numValor || numValor <= 0) {
      setErrorMsg('Por favor, informe um valor válido maior que zero.');
      return;
    }

    setSaving(true);
    try {
      const refMonth = dataLancamento.substring(0, 7) || selectedMonth || getCurrentMonth();

      if (itemToEdit) {
        await updateMassoterapiaIncome(itemToEdit.id, {
          dataLancamento,
          valor: numValor,
          observacao: observacao.trim() || undefined,
          referenceMonth: refMonth,
        });
      } else {
        await addMassoterapiaIncome({
          dataLancamento,
          valor: numValor,
          observacao: observacao.trim() || undefined,
          referenceMonth: refMonth,
        });
      }

      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar lançamento de massoterapia:', err);
      setErrorMsg(err.message || 'Falha ao salvar lançamento. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        id="massoterapia-modal"
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500 text-white flex items-center justify-center shadow-md shadow-teal-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {itemToEdit ? 'Editar Renda Massoterapia' : 'Novo Lançamento — Massoterapia'}
              </h2>
              <p className="text-xs text-slate-500">
                {itemToEdit ? 'Atualize as informações da sessão' : 'Registre o valor recebido por atendimento'}
              </p>
            </div>
          </div>
          <button
            id="close-massoterapia-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700">
              {errorMsg}
            </div>
          )}

          {/* Data do Recebimento */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              Data do Recebimento / Atendimento *
            </label>
            <input
              id="massoterapia-data-input"
              type="date"
              required
              value={dataLancamento}
              onChange={(e) => setDataLancamento(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-teal-600 focus:outline-none transition-all"
            />
          </div>

          {/* Valor */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-teal-600" />
              Valor Recebido (R$) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                R$
              </span>
              <input
                id="massoterapia-valor-input"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:bg-white focus:border-teal-600 focus:outline-none transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Este valor é contabilizado automaticamente como recebido na receita do mês.
            </p>
          </div>

          {/* Observação */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-teal-600" />
              Observação / Nome do Cliente (Opcional)
            </label>
            <textarea
              id="massoterapia-observacao-input"
              rows={3}
              placeholder="Ex: Massagem relaxante cliente Ana, drenagem linfática, pacote 4 sessões..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-teal-600 focus:outline-none transition-all resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              id="cancel-massoterapia-btn"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="submit-massoterapia-btn"
              disabled={saving}
              className="px-6 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {saving ? 'Salvando...' : itemToEdit ? 'Atualizar Lançamento' : 'Confirmar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
