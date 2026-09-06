import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  DollarSign,
  Repeat,
  Target,
  Sparkles,
  Search,
  X,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { ExtraIncome } from '../types';
import { formatCurrency, formatDateBR, getMonthName } from '../utils/formatters';

interface IncomesViewProps {
  onOpenIncomeModal: (incomeToEdit?: ExtraIncome) => void;
  onDeleteIncome: (income: ExtraIncome) => void;
}

export const IncomesView: React.FC<IncomesViewProps> = ({
  onOpenIncomeModal,
  onDeleteIncome,
}) => {
  const { incomes, effectiveIncomesForMonth, selectedMonth, toggleIncomeStatus, monthSummary } = useFinance();
  const [searchQuery, setSearchQuery] = useState('');

  const monthIncomes = useMemo(() => {
    let list = [...effectiveIncomesForMonth];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((item) => {
        const descMatch = item.description?.toLowerCase().includes(q);
        const originMatch = item.origin?.toLowerCase().includes(q);
        const notesMatch = item.notes?.toLowerCase().includes(q);

        // Date matching
        const rawDate = (item.date || '').toLowerCase();
        let dateBR = '';
        if (item.date && item.date.includes('-')) {
          const parts = item.date.split('-');
          if (parts.length === 3) {
            dateBR = `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
        }
        const recDayStr = item.recurrenceDay ? `dia ${item.recurrenceDay}` : '';
        const dateMatch =
          rawDate.includes(q) ||
          (dateBR && dateBR.includes(q)) ||
          recDayStr.toLowerCase().includes(q) ||
          String(item.recurrenceDay || '').includes(q);

        return descMatch || originMatch || notesMatch || dateMatch;
      });
    }

    return list.sort((a, b) => {
      // Show recurring first or sorted by date
      if (a.isRecurring && !b.isRecurring) return -1;
      if (!a.isRecurring && b.isRecurring) return 1;
      return (b.date || '').localeCompare(a.date || '');
    });
  }, [effectiveIncomesForMonth, searchQuery]);

  const recurringCount = incomes.filter((i) => i.isRecurring).length;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 pb-12">
      {/* Header card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">Rendas Extras</h2>
          </div>
          <p className="text-xs text-slate-500">
            Controle rendas fixas padrão para todos os meses (aluguel, dividendos) ou lançamentos pontuais específicos por mês.
          </p>
        </div>

        <button
          onClick={() => onOpenIncomeModal()}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200 flex items-center gap-2 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Renda Extra</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Total Rendas Extras ({getMonthName(selectedMonth)})
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
            {formatCurrency(monthSummary.totalExtraIncome)}
          </div>
          <span className="text-[10px] text-slate-400 mt-2 block">
            {effectiveIncomesForMonth.length} lançamento(s) ativo(s) neste mês {recurringCount > 0 && `(${recurringCount} recorrente)`}
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Já Recebido
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {formatCurrency(monthSummary.receivedExtraIncome)}
          </div>
          <span className="text-[10px] text-emerald-600 font-bold mt-2 block">
            Disponível no caixa
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Aguardando Recebimento
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-600">
            {formatCurrency(monthSummary.pendingExtraIncome)}
          </div>
          <span className="text-[10px] text-amber-600 font-bold mt-2 block">
            Previsão futura
          </span>
        </div>
      </div>

      {/* Listagem de Rendas Extras */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Instant Search Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-white">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <input
                id="incomes-instant-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar receitas por descrição, categoria/origem, data (ex: 21/08, 2026-08) ou notas..."
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-2xs focus:ring-2 focus:ring-emerald-500/20"
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
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
                  {monthIncomes.length} renda(s) encontrada(s)
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

        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-slate-900 text-base">
              Rendas em Vigor para {getMonthName(selectedMonth)}
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {monthIncomes.length} {monthIncomes.length === 1 ? 'item' : 'itens'}
            </span>
          </div>

          {monthIncomes.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 mb-3">
                <TrendingUp className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">
                {searchQuery ? 'Nenhuma renda encontrada para a busca realizada' : 'Nenhuma renda extra cadastrada para este mês'}
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
                {searchQuery
                  ? `Nenhum resultado correspondente a "${searchQuery}". Tente outros termos de descrição, origem ou data.`
                  : 'Cadastre rendas padrão que se repetem todos os meses ou valores pontuais para acompanhar sua receita.'}
              </p>
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 transition-colors shadow-xs cursor-pointer"
                >
                  Limpar Busca
                </button>
              ) : (
                <button
                  onClick={() => onOpenIncomeModal()}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                >
                  + Adicionar Renda Extra
                </button>
              )}
            </div>
          ) : (
          <>
            {/* Mobile Card List */}
            <div className="block lg:hidden divide-y divide-slate-100">
              {monthIncomes.map((income) => (
                <div key={`mob-inc-${income.id}`} className="py-3.5 flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-extrabold text-sm text-slate-900 block">
                        {income.description}
                      </span>
                      {income.notes && (
                        <span className="text-[11px] text-slate-400 font-normal mt-0.5 line-clamp-2">
                          {income.notes}
                        </span>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {income.isRecurring ? (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-full font-bold text-[9px] inline-flex items-center gap-1">
                            <Repeat className="w-2.5 h-2.5" />
                            Todo dia {income.recurrenceDay || 10}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full font-medium text-[9px] inline-flex items-center gap-1">
                            <Target className="w-2.5 h-2.5 text-slate-400" />
                            {formatDateBR(income.date)}
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-semibold text-[9px]">
                          {income.origin || 'Outros'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-base text-emerald-600 block">
                        {formatCurrency(income.amount)}
                      </span>
                      <div className="mt-1.5">
                        <button
                          onClick={() => toggleIncomeStatus(income.id, income.status)}
                          className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold cursor-pointer transition-colors inline-flex items-center gap-1 shadow-2xs ${
                            income.status === 'RECEIVED'
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          }`}
                        >
                          {income.status === 'RECEIVED' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>RECEBIDO</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>A RECEBER</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100/60">
                    <button
                      onClick={() => onOpenIncomeModal(income)}
                      className="px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => onDeleteIncome(income)}
                      className="px-2.5 py-1 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <tr className="h-10">
                    <th className="font-bold pb-2">Descrição</th>
                    <th className="font-bold pb-2">Tipo / Frequência</th>
                    <th className="font-bold pb-2">Origem</th>
                    <th className="font-bold pb-2 text-center">Data / Dia</th>
                    <th className="font-bold pb-2 text-right">Valor</th>
                    <th className="font-bold pb-2 text-center">Status</th>
                    <th className="font-bold pb-2 text-right pr-2">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-50">
                  {monthIncomes.map((income) => (
                    <tr key={income.id} className="hover:bg-slate-50/80 transition-colors h-14">
                      <td className="font-bold text-slate-800 pr-2">
                        <div>
                          <span>{income.description}</span>
                          {income.notes && (
                            <span className="text-[10px] text-slate-400 font-normal block truncate max-w-xs">
                              {income.notes}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {income.isRecurring ? (
                          <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-full font-bold text-[10px] inline-flex items-center gap-1">
                            <Repeat className="w-3 h-3" />
                            Todos os Meses
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full font-medium text-[10px] inline-flex items-center gap-1">
                            <Target className="w-3 h-3 text-slate-400" />
                            Pontual deste Mês
                          </span>
                        )}
                      </td>
                      <td className="text-slate-500 font-medium">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold text-[10px]">
                          {income.origin || 'Outros'}
                        </span>
                      </td>
                      <td className="text-center text-slate-500 font-mono">
                        {income.isRecurring ? (
                          <span className="font-semibold text-slate-700">Todo dia {income.recurrenceDay || 10}</span>
                        ) : (
                          formatDateBR(income.date)
                        )}
                      </td>
                      <td className="text-right font-extrabold text-emerald-600">
                        {formatCurrency(income.amount)}
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() => toggleIncomeStatus(income.id, income.status)}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors inline-flex items-center gap-1 ${
                            income.status === 'RECEIVED'
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          }`}
                        >
                          {income.status === 'RECEIVED' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              RECEBIDO
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" />
                              A RECEBER
                            </>
                          )}
                        </button>
                      </td>
                      <td className="text-right pr-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenIncomeModal(income)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteIncome(income)}
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
