import React, { useState, useEffect } from 'react';
import { X, Wallet, Check, Sparkles, QrCode, FileText, CreditCard as CardIcon, Banknote, HelpCircle } from 'lucide-react';
import { CustomPaymentMethod, PaymentMethod } from '../../types';
import { useFinance } from '../../context/FinanceContext';

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  methodToEdit?: CustomPaymentMethod | null;
}

const PRESET_COLORS = [
  '#0D9488', // Teal (Pix)
  '#D97706', // Amber (Boleto)
  '#2563EB', // Blue (Débito)
  '#059669', // Emerald (Dinheiro)
  '#7C3AED', // Violet
  '#EA580C', // Orange
  '#DB2777', // Pink
  '#475569', // Slate
];

const METHOD_TYPES: { type: PaymentMethod; label: string; icon: React.ReactNode; defaultColor: string; placeholder: string }[] = [
  {
    type: 'PIX',
    label: 'Pix Instantâneo',
    icon: <QrCode className="w-4 h-4" />,
    defaultColor: '#0D9488',
    placeholder: 'Ex: Chave CPF, Chave Aleatória ou Chave Celular',
  },
  {
    type: 'BOLETO',
    label: 'Boleto Bancário',
    icon: <FileText className="w-4 h-4" />,
    defaultColor: '#D97706',
    placeholder: 'Ex: Pagamento de Contas / DDA / Código de Barras',
  },
  {
    type: 'CARTAO_DEBITO',
    label: 'Cartão de Débito',
    icon: <CardIcon className="w-4 h-4" />,
    defaultColor: '#2563EB',
    placeholder: 'Ex: Débito Automático Conta Inter / Nubank',
  },
  {
    type: 'DINHEIRO',
    label: 'Dinheiro em Espécie',
    icon: <Banknote className="w-4 h-4" />,
    defaultColor: '#059669',
    placeholder: 'Ex: Carteira Física / Dinheiro em Mãos',
  },
  {
    type: 'OUTROS',
    label: 'Outro Tipo Personalizado',
    icon: <Wallet className="w-4 h-4" />,
    defaultColor: '#7C3AED',
    placeholder: 'Ex: Transferência Bancária, Vale Alimentação, etc.',
  },
];

export const PaymentMethodModal: React.FC<PaymentMethodModalProps> = ({
  isOpen,
  onClose,
  methodToEdit,
}) => {
  const { addPaymentMethod, updatePaymentMethod } = useFinance();

  const [name, setName] = useState('');
  const [type, setType] = useState<PaymentMethod>('PIX');
  const [details, setDetails] = useState('');
  const [color, setColor] = useState('#0D9488');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (methodToEdit) {
      setName(methodToEdit.name);
      setType(methodToEdit.type || 'PIX');
      setDetails(methodToEdit.details || '');
      setColor(methodToEdit.color || '#0D9488');
      setIsActive(methodToEdit.isActive !== false);
    } else {
      setName('');
      setType('PIX');
      setDetails('');
      setColor('#0D9488');
      setIsActive(true);
    }
    setErrorMsg(null);
  }, [methodToEdit, isOpen]);

  if (!isOpen) return null;

  const handleTypeSelect = (selectedType: PaymentMethod) => {
    setType(selectedType);
    const preset = METHOD_TYPES.find((m) => m.type === selectedType);
    if (preset && (!methodToEdit || methodToEdit.type !== selectedType)) {
      setColor(preset.defaultColor);
      if (!name || METHOD_TYPES.some((m) => m.label.includes(name) || name === m.type)) {
        setName(preset.label.split(' ')[0]);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Por favor, informe o nome do tipo de pagamento.');
      return;
    }

    setSaving(true);
    try {
      if (methodToEdit) {
        await updatePaymentMethod(methodToEdit.id, {
          name: name.trim(),
          type,
          details: details.trim(),
          color,
          isActive,
        });
      } else {
        await addPaymentMethod({
          name: name.trim(),
          type,
          details: details.trim(),
          color,
          isActive,
        });
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erro ao salvar tipo de pagamento.');
    } finally {
      setSaving(false);
    }
  };

  const selectedPreset = METHOD_TYPES.find((m) => m.type === type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md shadow-slate-200"
              style={{ backgroundColor: color }}
            >
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {methodToEdit ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'}
              </h3>
              <p className="text-xs text-slate-500">
                Configure Pix, Boleto, Débito e outros tipos para organizar suas despesas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Tipo Base *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {METHOD_TYPES.map((m) => {
                const isSelected = type === m.type;
                return (
                  <button
                    type="button"
                    key={m.type}
                    onClick={() => handleTypeSelect(m.type)}
                    className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all text-xs font-bold ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className={isSelected ? 'text-white' : 'text-slate-500'}>
                      {m.icon}
                    </span>
                    <span className="truncate">{m.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Nome do Meio de Pagamento *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Pix Banco Inter, Boleto Condomínio, Dinheiro"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition-all text-sm"
              required
            />
          </div>

          {/* Details / Description */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Detalhes / Chave / Observações (Opcional)
            </label>
            <input
              type="text"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={selectedPreset?.placeholder || 'Ex: Informações adicionais'}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition-all text-sm"
            />
          </div>

          {/* Color Palette */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Cor do Identificador Visual
            </label>
            <div className="flex flex-wrap gap-2.5 items-center">
              {PRESET_COLORS.map((c) => {
                const isSelected = color.toLowerCase() === c.toLowerCase();
                return (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-xl transition-all flex items-center justify-center shadow-xs ${
                      isSelected ? 'ring-3 ring-offset-2 ring-slate-900 scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white drop-shadow-xs" />}
                  </button>
                );
              })}
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded-xl cursor-pointer border-0 bg-transparent"
                  title="Escolher cor personalizada"
                />
                <span className="text-[11px] font-mono text-slate-400">{color}</span>
              </div>
            </div>
          </div>

          {/* Visual Preview */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs font-bold"
                style={{ backgroundColor: color }}
              >
                {selectedPreset?.icon || <Wallet className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-xs font-extrabold text-slate-800 block">
                  {name || 'Nome do Meio'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {details || selectedPreset?.label || 'Sem detalhes'}
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              {type}
            </span>
          </div>

          {/* Active switch */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <span className="text-xs font-bold text-slate-700 block">Forma de Pagamento Ativa</span>
              <span className="text-[11px] text-slate-400">
                Disponível para seleção ao criar ou editar despesas
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                isActive ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  isActive ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-200 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{methodToEdit ? 'Salvar Alterações' : 'Cadastrar Forma de Pagamento'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
