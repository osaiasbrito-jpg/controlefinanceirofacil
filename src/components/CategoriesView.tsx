import React from 'react';
import { Tag, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { Category } from '../types';

interface CategoriesViewProps {
  onOpenCategoryModal: () => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({ onOpenCategoryModal }) => {
  const { categories, deleteCategory, expenses } = useFinance();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Tag className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">Categorias de Despesas</h2>
          </div>
          <p className="text-xs text-slate-500">
            Categorias padrão do sistema e categorias personalizadas criadas por você.
          </p>
        </div>

        <button
          onClick={onOpenCategoryModal}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200 flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Categoria</span>
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        {categories.map((cat) => {
          const expenseCount = expenses.filter(
            (e) => e.categoryId === cat.id || e.categoryName === cat.name
          ).length;

          return (
            <div
              key={cat.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between gap-3 hover:border-slate-300 transition-all"
            >
              <div className="flex items-center justify-between">
                <div
                  className="w-3.5 h-3.5 rounded-full"
                  style={{ backgroundColor: cat.color || '#10B981' }}
                />
                {!cat.isDefault && cat.userId !== 'system' && (
                  <button
                    onClick={() => deleteCategory(cat.id)}
                    className="text-slate-300 hover:text-rose-600 p-1 rounded-md transition-colors"
                    title="Excluir categoria"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs truncate">{cat.name}</h4>
                <span className="text-[10px] text-slate-400 font-medium">
                  {expenseCount} lançamento(s)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
