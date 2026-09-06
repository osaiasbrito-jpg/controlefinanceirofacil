import React, { useState, useMemo } from 'react';
import {
  Briefcase,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Calendar,
  DollarSign,
  Repeat,
  Sparkles,
  Search,
  X,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { Salary } from '../types';
import { formatCurrency, formatDateBR, getMonthName } from '../utils/formatters';

interface SalariesViewProps {
  onOpenSalaryModal: (salaryToEdit?: Salary) => void;
  onDeleteSalary: (salary: Salary) => void;
}

export const SalariesView: React.FC<SalariesViewProps> = ({
  onOpenSalaryModal,
  onDeleteSalary,
}) => {
  const { salaries, effectiveSalariesForMonth, selectedMonth, toggleSalaryStatus, settings } = useFinance();
  const [searchQuery, setSearchQuery] = useState('');

  // Selected month effective salary
  const currentMonthSalary = effectiveSalariesForMonth[0] || salaries.find((s) => s.referenceMonth === selectedMonth);

  // Other months salaries with instant search filtering
  const allSalariesSorted = useMemo(() => {
    let list = [...salaries];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((s) => {
        const descMatch = s.description?.toLowerCase().includes(q);
        const monthName = getMonthName(s.referenceMonth).toLowerCase();
        const monthRefMatch = s.referenceMonth.toLowerCase().includes(q) || monthName.includes(q);
        const rawDate = (s.payDate || '').toLowerCase();
        let dateBR = '';
        if (s.payDate && s.payDate.includes('-')) {
          const parts = s.payDate.split('-');
          if (parts.length === 3) {
            dateBR = `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
        }
        const dateMatch = rawDate.includes(q) || (dateBR && dateBR.includes(q));

        return descMatch || monthRefMatch || dateMatch;
      });
    }

    return list.sort((a, b) => b.referenceMonth.localeCompare(a.referenceMonth));
  }, [salaries, searchQuery]);

  const hasStandardSalary = !!(settings?.defaultSalaryAmount && settings.defaultSalaryAmount > 0 && settings.defaultSalaryActive !== false);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 pb-12">
      {/* Standard Salary Banner / Quick Config Card */}
      <div className="bg-white rounded-3xl border border-indigo-100 shadow-xs p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-linear-to-r from-indigo-50/40 via-white to-slate-50">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-200 shrink-0">
            <Repeat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-extrabold text-slate-900">Salário Padrão Padronizado</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Válido para Todos os Meses
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              {hasStandardSalary
                ? `Salário fixado em ${formatCurrency(settings?.defaultSalaryAmount || 0)}, com previsão todo dia ${settings?.defaultSalaryPayDay || 5} para todos os meses do sistema.`
                : 'Defina um salário padrão que será preenchido e calculado automaticamente em todos os meses sem precisar recadastrar todo mês.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
          <button
            onClick={() => onOpenSalaryModal()}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{hasStandardSalary ? 'Alterar Salário Padrão / Adicionar' : 'Definir Salário Padrão'}</span>
          </button>
        </div>
      </div>

      {/* Current Month Highlight */}
      <div className="bg-linear-to-r from-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider block">
              Salário em Vigor ({getMonthName(selectedMonth)})
            </span>
            {currentMonthSalary?.isStandardDefault && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/40 text-indigo-200 border border-indigo-400/30">
                Padrão Automático
              </span>
            )}
          </div>

          <div className="text-3xl sm:text-4xl font-black tracking-tight">
            {currentMonthSalary ? formatCurrency(currentMonthSalary.amount) : 'R$ 0,00'}
          </div>
          {currentMonthSalary ? (
            <div className="flex items-center gap-3 mt-3 text-xs text-indigo-200 flex-wrap">
              <span>Data Prevista: {formatDateBR(currentMonthSalary.payDate)}</span>
              <span>•</span>
              <span className="font-semibold">{currentMonthSalary.description || 'Salário Mensal'}</span>
            </div>
          ) : (
            <p className="text-xs text-indigo-200 mt-2">
              Nenhum salário padrão ou específico ativo para este mês.
            </p>
          )}
        </div>

        {currentMonthSalary ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => toggleSalaryStatus(currentMonthSalary.id, currentMonthSalary.status)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                currentMonthSalary.status === 'RECEIVED'
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'bg-amber-400 text-slate-900 hover:bg-amber-500'
              }`}
            >
              {currentMonthSalary.status === 'RECEIVED' ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>RECEBIDO</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  <span>A RECEBER</span>
                </>
              )}
            </button>

            <button
              onClick={() => onOpenSalaryModal(currentMonthSalary)}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors cursor-pointer"
              title="Editar salário deste mês"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onOpenSalaryModal()}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-lg transition-colors cursor-pointer"
          >
            + Cadastrar Salário
          </button>
        )}
      </div>

      {/* Histórico e Meses Cadastrados */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Instant Search Bar if there are registered salaries or active query */}
        {(salaries.length > 0 || searchQuery) && (
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-white">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <input
                  id="salaries-instant-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar salários por descrição, mês (ex: Janeiro, 2026-08) ou data..."
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-2xs focus:ring-2 focus:ring-indigo-500/20"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition-colors cursor-pointer"
                    title="Limpar busca"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {searchQuery && (
                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-2 rounded-xl">
                    {allSalariesSorted.length} registro(s) encontrado(s)
                  </span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-slate-500 hover:text-rose-600 font-bold px-2 py-1.5 transition-colors cursor-pointer"
                  >
                    Limpar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-slate-900 text-base">
              Lançamentos e Ajustes Específicos por Mês
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {allSalariesSorted.length} {allSalariesSorted.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>

          {allSalariesSorted.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs font-medium bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              {searchQuery ? (
                <div className="flex flex-col items-center gap-1.5 py-4">
                  <span className="font-bold text-slate-700">Nenhum salário encontrado para "{searchQuery}"</span>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-2 px-3 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 cursor-pointer"
                  >
                    Limpar busca
                  </button>
                </div>
              ) : hasStandardSalary ? (
                <div className="flex flex-col items-center gap-1.5">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  <span className="font-bold text-slate-700">Salário Padrão Ativo em todos os meses!</span>
                  <span className="text-slate-500 text-[11px]">Você só precisa criar lançamentos aqui se houver bonificação ou ajuste individual em um mês específico.</span>
                </div>
              ) : (
                'Nenhum lançamento de salário específico cadastrado.'
              )}
            </div>
          ) : (
          <>
            {/* Mobile Card List */}
            <div className="block lg:hidden divide-y divide-slate-100">
              {allSalariesSorted.map((salary) => (
                <div key={`mob-sal-${salary.id}`} className="py-3.5 flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-extrabold text-sm text-slate-900 capitalize block">
                        {getMonthName(salary.referenceMonth)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {salary.description || 'Salário Mensal'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-base text-slate-900 block">
                        {formatCurrency(salary.amount)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatDateBR(salary.payDate)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => toggleSalaryStatus(salary.id, salary.status)}
                      className={`px-3 py-1 rounded-full text-[10px] font-extrabold cursor-pointer transition-colors inline-flex items-center gap-1 ${
                        salary.status === 'RECEIVED'
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                      }`}
                    >
                      {salary.status === 'RECEIVED' ? 'RECEBIDO' : 'A RECEBER'}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onOpenSalaryModal(salary)}
                        className="px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => onDeleteSalary(salary)}
                        className="px-2.5 py-1 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <tr className="h-10">
                    <th className="font-bold pb-2">Mês de Referência</th>
                    <th className="font-bold pb-2">Descrição</th>
                    <th className="font-bold pb-2 text-center">Data Recebimento</th>
                    <th className="font-bold pb-2 text-right">Valor</th>
                    <th className="font-bold pb-2 text-center">Status</th>
                    <th className="font-bold pb-2 text-right pr-2">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-50">
                  {allSalariesSorted.map((salary) => (
                    <tr key={salary.id} className="hover:bg-slate-50/80 transition-colors h-14">
                      <td className="font-bold text-slate-800 capitalize">
                        {getMonthName(salary.referenceMonth)}
                      </td>
                      <td className="text-slate-500 font-medium">
                        {salary.description || 'Salário Mensal'}
                      </td>
                      <td className="text-center text-slate-400 font-mono">
                        {formatDateBR(salary.payDate)}
                      </td>
                      <td className="text-right font-extrabold text-slate-900">
                        {formatCurrency(salary.amount)}
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() => toggleSalaryStatus(salary.id, salary.status)}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors inline-flex items-center gap-1 ${
                            salary.status === 'RECEIVED'
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          }`}
                        >
                          {salary.status === 'RECEIVED' ? 'RECEBIDO' : 'A RECEBER'}
                        </button>
                      </td>
                      <td className="text-right pr-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenSalaryModal(salary)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteSalary(salary)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
};
