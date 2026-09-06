import React, { useState, useEffect } from 'react';
import { X, CreditCard as CardIcon, DollarSign, Calendar, Palette } from 'lucide-react';
import { CreditCard } from '../../types';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency } from '../../utils/formatters';

interface CardModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardToEdit?: CreditCard | null;
}

const CARD_COLORS = [
  { name: 'Roxo Nubank', value: '#8B5CF6' },
  { name: 'Preto Black / Titanium', value: '#1E293B' },
  { name: 'Laranja Inter', value: '#F97316' },
  { name: 'Azul Itaú / C6', value: '#2563EB' },
  { name: 'Verde Santander / Sicredi', value: '#059669' },
  { name: 'Vermelho Bradesco', value: '#DC2626' },
  { name: 'Ouro / Dourado', value: '#D97706' },
  { name: 'Rosa Neon', value: '#EC4899' },
];

export const CardModal: React.FC<CardModalProps> = ({
  isOpen,
  onClose,
  cardToEdit,
}) => {
  const { addCreditCard, updateCreditCard } = useFinance();

  const [name, setName] = useState('');
  const [bank, setBank] = useState('');
  const [totalLimit, setTotalLimit] = useState<number | string>('');
  const [closingDay, setClosingDay] = useState<number>(10);
  const [dueDay, setDueDay] = useState<number>(17);
  const [color, setColor] = useState('#8B5CF6');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (cardToEdit) {
      setName(cardToEdit.name);
      setBank(cardToEdit.bank);
      setTotalLimit(cardToEdit.totalLimit);
      setClosingDay(cardToEdit.closingDay);
      setDueDay(cardToEdit.dueDay);
      setColor(cardToEdit.color || '#8B5CF6');
    } else {
      setName('');
      setBank('');
      setTotalLimit('');
      setClosingDay(10);
      setDueDay(17);
      setColor('#8B5CF6');
    }
    setErrorMsg(null);
  }, [cardToEdit, isOpen]);

  if (!isOpen) return null;

  const numLimit = typeof totalLimit === 'number' ? totalLimit : parseFloat(totalLimit) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Por favor, informe o nome ou apelido do cartão.');
      return;
    }
    if (!bank.trim()) {
      setErrorMsg('Por favor, informe o banco ou instituição emissora.');
      return;
    }
    if (!numLimit || numLimit <= 0) {
      setErrorMsg('Por favor, informe um limite total válido maior que zero.');
      return;
    }

    setSaving(true);
    try {
      if (cardToEdit) {
        await updateCreditCard(cardToEdit.id, {
          name: name.trim(),
          bank: bank.trim(),
          totalLimit: numLimit,
          closingDay,
          dueDay,
          color,
          isActive: true,
        });
      } else {
        await addCreditCard({
          name: name.trim(),
          bank: bank.trim(),
          totalLimit: numLimit,
          closingDay,
          dueDay,
          color,
          isActive: true,
        });
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving credit card:', err);
      setErrorMsg(err.message || 'Erro ao salvar cartão de crédito.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <CardIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {cardToEdit ? 'Editar Cartão' : 'Novo Cartão de Crédito'}
              </h2>
              <p className="text-xs text-slate-500">
                Configure limites, datas de fechamento e vencimento
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

        {/* Live Card Preview */}
        <div
          className="rounded-2xl p-5 text-white shadow-xl flex flex-col justify-between h-36 transition-all relative overflow-hidden"
          style={{ backgroundColor: color }}
        >
          <div className="flex justify-between items-start">
            <div className="w-10 h-7 bg-amber-400/30 border border-amber-300/40 rounded-md backdrop-blur-xs flex items-center justify-center">
              <div className="w-6 h-4 border-y border-amber-300/40"></div>
            </div>
            <span className="text-[10px] font-black tracking-widest uppercase opacity-80">
              {bank || 'BANCO EMISSOR'}
            </span>
          </div>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-xs opacity-75 font-medium">Limite Total</div>
              <div className="text-xl font-bold tracking-tight">
                {formatCurrency(numLimit || 0)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold">{name || 'Meu Cartão'}</div>
              <div className="text-[9px] opacity-75 font-mono">
                Fecha dia {closingDay} • Vence dia {dueDay}
              </div>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Nome do Cartão *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Nubank Black"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-hidden text-xs"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Banco / Emissor *
              </label>
              <input
                type="text"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                placeholder="Ex: Nubank, Inter, XP"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-hidden text-xs"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Limite Total (R$) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-slate-400 font-bold text-sm">R$</span>
              <input
                type="number"
                step="1"
                min="10"
                value={totalLimit}
                onChange={(e) => setTotalLimit(e.target.value)}
                placeholder="5000"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-hidden text-base"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Dia Fechamento *
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={closingDay}
                onChange={(e) => setClosingDay(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-hidden text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Dia Vencimento *
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={dueDay}
                onChange={(e) => setDueDay(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-hidden text-xs"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Cor de Identificação
            </label>
            <div className="flex flex-wrap gap-2">
              {CARD_COLORS.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-7 h-7 rounded-full transition-transform border-2 ${
                    color === c.value ? 'scale-115 border-slate-900 shadow-md' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
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
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : cardToEdit ? 'Atualizar' : 'Salvar Cartão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
