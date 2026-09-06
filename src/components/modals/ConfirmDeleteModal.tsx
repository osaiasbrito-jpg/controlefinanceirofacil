import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, Layers, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteAllInstallments?: boolean) => void | Promise<void>;
  title: string;
  message?: string;
  description?: string;
  isInstallment?: boolean;
  isInstallmentChoice?: boolean;
  installmentDetails?: {
    currentNumber?: number;
    total?: number;
    title?: string;
  };
  selectedCount?: number;
  hasInstallmentsInSelection?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  description,
  isInstallment,
  isInstallmentChoice,
  installmentDetails,
  selectedCount,
  hasInstallmentsInSelection,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [includeAllLinked, setIncludeAllLinked] = useState(false);

  if (!isOpen) return null;

  const displayMessage = description || message || '';
  const isInstallmentItem = isInstallment || isInstallmentChoice;

  const handleAction = async (deleteAll: boolean) => {
    try {
      setIsDeleting(true);
      await onConfirm(deleteAll);
    } catch (err) {
      console.error('Erro ao confirmar exclusão:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title and Message */}
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">{title}</h3>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">{displayMessage}</p>
        </div>

        {/* Option 1: Single Installment Item Deletion */}
        {isInstallmentItem ? (
          <div className="flex flex-col gap-3 pt-1">
            <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200 flex items-center gap-2.5 text-xs text-amber-900 font-semibold">
              <Layers className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Esta despesa é a parcela{' '}
                <strong>
                  {installmentDetails?.currentNumber || 1}/{installmentDetails?.total || 1}
                </strong>
                . Como deseja remover do banco de dados?
              </span>
            </div>

            {/* Option A: Delete ALL installments (Default / Primary Choice) */}
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => handleAction(true)}
              className="w-full p-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-md shadow-rose-200 text-left flex items-center justify-between cursor-pointer disabled:opacity-50 group"
            >
              <div className="flex flex-col">
                <span className="font-extrabold text-sm flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4 text-white" />
                  Excluir TODAS as parcelas
                </span>
                <span className="text-[11px] text-rose-100 font-normal mt-0.5">
                  Apaga todas as parcelas de todos os meses do banco de dados
                </span>
              </div>
            </button>

            {/* Option B: Delete ONLY this specific installment */}
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => handleAction(false)}
              className="w-full p-3.5 rounded-2xl bg-slate-50 hover:bg-amber-50 text-slate-800 hover:text-amber-900 font-bold text-xs transition-all border border-slate-200 hover:border-amber-300 text-left flex items-center justify-between cursor-pointer disabled:opacity-50"
            >
              <div className="flex flex-col">
                <span className="font-extrabold text-xs">
                  Excluir APENAS esta parcela ({installmentDetails?.currentNumber || 1}/{installmentDetails?.total || 1})
                </span>
                <span className="text-[10px] text-slate-500 font-normal mt-0.5">
                  Mantém as outras parcelas dos demais meses intactas
                </span>
              </div>
            </button>

            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors text-center cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        ) : selectedCount && selectedCount > 1 ? (
          /* Option 2: Multi-Selected Items Deletion */
          <div className="flex flex-col gap-3 pt-1">
            <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-900 flex flex-col gap-1.5">
              <div className="font-extrabold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Exclusão em Lote ({selectedCount} despesas)</span>
              </div>
              <span className="text-[11px] text-rose-700">
                Os itens selecionados serão excluídos permanentemente do banco de dados.
              </span>
            </div>

            {hasInstallmentsInSelection && (
              <label className="flex items-start gap-2.5 p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={includeAllLinked}
                  onChange={(e) => setIncludeAllLinked(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-rose-600 border-slate-300 focus:ring-rose-500"
                />
                <div className="flex flex-col text-xs">
                  <span className="font-extrabold text-slate-900">
                    Excluir também todas as outras parcelas vinculadas
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Se marcado, compras parceladas terão todas as suas parcelas de todos os meses removidas.
                  </span>
                </div>
              </label>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-2xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleAction(includeAllLinked)}
                className="flex-1 py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-all shadow-md shadow-rose-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Excluindo...' : `Excluir ${selectedCount} Itens`}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Option 3: Standard Single Item Deletion */
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-2xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => handleAction(false)}
              className="flex-1 py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-all shadow-md shadow-rose-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isDeleting ? 'Excluindo...' : 'Excluir'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
