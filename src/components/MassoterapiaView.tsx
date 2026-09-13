import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  DollarSign,
  Search,
  X,
  FileText,
  TrendingUp,
  Activity,
  Layers,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { RendaMassoterapia } from '../types';
import { formatCurrency, formatDateBR, getMonthName } from '../utils/formatters';
import { MassoterapiaModal } from './modals/MassoterapiaModal';
import { ConfirmDeleteModal } from './modals/ConfirmDeleteModal';

export const MassoterapiaView: React.FC = () => {
  const {
    selectedMonth,
    setSelectedMonth,
    effectiveMassoterapiaForMonth,
    deleteMassoterapiaIncome,
  } = useFinance();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<RendaMassoterapia | null>(null);
  const [itemToDelete, setItemToDelete] = useState<RendaMassoterapia | null>(null);

  // Filtragem e ordenação dos lançamentos
  const filteredList = useMemo(() => {
    let list = [...effectiveMassoterapiaForMonth];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((item) => {
        const obsMatch = item.observacao?.toLowerCase().includes(q);
        const rawDate = (item.dataLancamento || '').toLowerCase();
        let dateBR = '';
        if (item.dataLancamento && item.dataLancamento.includes('-')) {
          const parts = item.dataLancamento.split('-');
          if (parts.length === 3) {
            dateBR = `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
        }
        const dateMatch = rawDate.includes(q) || (dateBR && dateBR.includes(q));
        const valMatch = String(item.valor).includes(q);
        return obsMatch || dateMatch || valMatch;
      });
    }

    return list.sort((a, b) => (b.dataLancamento || '').localeCompare(a.dataLancamento || ''));
  }, [effectiveMassoterapiaForMonth, searchQuery]);

  // Cálculos de métricas do mês selecionado
  const totalMes = useMemo(() => {
    return effectiveMassoterapiaForMonth.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  }, [effectiveMassoterapiaForMonth]);

  const qtdAtendimentos = effectiveMassoterapiaForMonth.length;
  const mediaPorAtendimento = qtdAtendimentos > 0 ? totalMes / qtdAtendimentos : 0;

  const handleOpenAdd = () => {
    setItemToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: RendaMassoterapia) => {
    setItemToEdit(item);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (itemToDelete) {
      await deleteMassoterapiaIncome(itemToDelete.id);
      setItemToDelete(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 pb-16">
      {/* Header card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Renda Massoterapia</h2>
          </div>
          <p className="text-xs text-slate-500">
            Controle detalhado dos atendimentos e faturamento de massoterapia referente a{' '}
            <span className="font-semibold text-teal-800">{getMonthName(selectedMonth)}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            id="btn-novo-lancamento-massoterapia"
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-200 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Novo Atendimento / Recebimento
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Recebido no Mês */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Total do Mês</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-teal-700 tracking-tight">
              {formatCurrency(totalMes)}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              Faturamento líquido integrado à receita do mês
            </p>
          </div>
        </div>

        {/* Quantidade de Atendimentos */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Sessões / Atendimentos</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {qtdAtendimentos}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              {qtdAtendimentos === 1 ? '1 atendimento registrado' : `${qtdAtendimentos} atendimentos registrados`}
            </p>
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Média por Sessão</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-emerald-700 tracking-tight">
              {formatCurrency(mediaPorAtendimento)}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              Valor médio por sessão realizada
            </p>
          </div>
        </div>
      </div>

      {/* Lista / Tabela de Lançamentos */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
        {/* Barra de Filtro / Busca */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por cliente, observação ou data..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-teal-600 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs font-bold text-slate-500 self-end sm:self-center">
            {filteredList.length} {filteredList.length === 1 ? 'registro' : 'registros'}
          </div>
        </div>

        {/* Conteúdo da Tabela */}
        {filteredList.length === 0 ? (
          <div className="py-16 px-4 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-500 flex items-center justify-center mb-3">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm mb-1">
              Nenhum lançamento de massoterapia para {getMonthName(selectedMonth)}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-4">
              {searchQuery
                ? 'Nenhum resultado encontrado para a busca especificada.'
                : 'Registre os atendimentos e valores recebidos de massoterapia neste mês para acompanhar seu faturamento.'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-200 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Lançar Primeiro Atendimento
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-5">Data</th>
                  <th className="py-3 px-5">Observação / Descrição</th>
                  <th className="py-3 px-5 text-right">Valor (R$)</th>
                  <th className="py-3 px-5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredList.map((item) => (
                  <tr
                    key={item.id}
                    id={`massoterapia-row-${item.id}`}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Data */}
                    <td className="py-3.5 px-5 font-semibold text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{formatDateBR(item.dataLancamento)}</span>
                      </div>
                    </td>

                    {/* Observação */}
                    <td className="py-3.5 px-5 font-medium text-slate-800">
                      {item.observacao ? (
                        <span className="break-words">{item.observacao}</span>
                      ) : (
                        <span className="text-slate-400 italic">Sessão de massoterapia</span>
                      )}
                    </td>

                    {/* Valor */}
                    <td className="py-3.5 px-5 text-right font-black text-teal-700 whitespace-nowrap">
                      {formatCurrency(item.valor)}
                    </td>

                    {/* Ações */}
                    <td className="py-3.5 px-5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          id={`edit-masso-${item.id}`}
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar lançamento"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`delete-masso-${item.id}`}
                          onClick={() => setItemToDelete(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Excluir lançamento"
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
        )}
      </div>

      {/* Modal de Adição/Edição */}
      <MassoterapiaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        itemToEdit={itemToEdit}
      />

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmDeleteModal
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Lançamento de Massoterapia"
        description={`Tem certeza que deseja excluir o lançamento de ${
          itemToDelete ? formatCurrency(itemToDelete.valor) : ''
        } de ${
          itemToDelete?.dataLancamento ? formatDateBR(itemToDelete.dataLancamento) : ''
        }? Esta ação removerá o registro do sistema.`}
      />
    </div>
  );
};
