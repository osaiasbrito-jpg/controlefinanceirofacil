import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Database,
  Search,
  DownloadCloud,
  CheckCircle2,
  AlertCircle,
  Calendar,
  User,
  DollarSign,
  RefreshCw,
  Plus,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  fetchDatabaseSessions,
  importDatabaseSessions,
  createGestaoSessionInDatabase,
  autoImportDatabaseSessions,
} from '../../services/api';

interface GestaoSession {
  id: string;
  clientePaciente: string;
  valor: number;
  dataLancamento: string;
  mesReferencia: string;
  procedimento: string;
  tipoSessao: string;
  profissional: string;
  formaPagamento?: string;
  observacao?: string;
  status: string;
  origem: string;
  sourceTable: string;
  alreadyInFinance: boolean;
  createdAt?: string;
}

interface DatabaseSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  selectedMonth: string;
  onSessionsImported?: () => void;
}

export const DatabaseSessionsModal: React.FC<DatabaseSessionsModalProps> = ({
  isOpen,
  onClose,
  userId,
  selectedMonth,
  onSessionsImported,
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'create' | 'info'>('search');
  const [filterMonth, setFilterMonth] = useState<string>(selectedMonth || '2026-09');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [sessions, setSessions] = useState<GestaoSession[]>([]);
  const [tablesChecked, setTablesChecked] = useState<string[]>([]);
  const [databaseName, setDatabaseName] = useState('PostgreSQL (Supabase - Gestão de Pessoas)');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Formulário da tela Print 02: Lançamento de Sessões Avulsas
  const [newSessionForm, setNewSessionForm] = useState({
    cliente: '',
    data: new Date().toISOString().substring(0, 10),
    procedimento: 'Massagem Relaxante',
    valor: '150.00',
    profissional: 'Osaias Brito',
    formaPagamento: 'PIX',
    observacao: '',
  });

  // Carregar sessões do banco de dados
  const loadSessions = async (monthToFilter = filterMonth) => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const mesParam = monthToFilter === 'TODOS' ? undefined : monthToFilter;
      const res = await fetchDatabaseSessions(userId, mesParam);
      if (res && res.success) {
        setSessions(res.sessions || []);
        setTablesChecked(res.tablesChecked || []);
        if (res.database) setDatabaseName(res.database);

        // Pré-selecionar sessões pendentes que ainda não estão no financeiro
        const pendings = (res.sessions || []).filter((s: GestaoSession) => !s.alreadyInFinance);
        setSelectedIds(new Set(pendings.map((s: GestaoSession) => s.id)));
      } else {
        setSessions([]);
      }
    } catch (err: any) {
      console.error('Erro ao consultar banco de dados:', err);
      setFeedback({
        text: 'Não foi possível consultar o banco de dados. Verifique a conexão.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setFilterMonth(selectedMonth || '2026-09');
      loadSessions(selectedMonth || '2026-09');
    }
  }, [isOpen, selectedMonth]);

  // Lista filtrada pelo termo de busca
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase().trim();
    return sessions.filter(
      (s) =>
        s.clientePaciente.toLowerCase().includes(q) ||
        s.procedimento.toLowerCase().includes(q) ||
        (s.observacao && s.observacao.toLowerCase().includes(q)) ||
        s.dataLancamento.includes(q) ||
        s.origem.toLowerCase().includes(q) ||
        s.sourceTable.toLowerCase().includes(q)
    );
  }, [sessions, searchQuery]);

  // Contadores
  const totalCount = filteredSessions.length;
  const pendingCount = filteredSessions.filter((s) => !s.alreadyInFinance).length;
  const alreadyInCount = filteredSessions.filter((s) => s.alreadyInFinance).length;
  const totalAmount = filteredSessions.reduce((acc, curr) => acc + curr.valor, 0);

  // Selecionar / Deselecionar
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllPending = () => {
    const pendings = filteredSessions.filter((s) => !s.alreadyInFinance);
    setSelectedIds(new Set(pendings.map((s) => s.id)));
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredSessions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSessions.map((s) => s.id)));
    }
  };

  // Importar sessões selecionadas
  const handleImportSelected = async () => {
    const toImport = filteredSessions.filter((s) => selectedIds.has(s.id));
    if (toImport.length === 0) {
      setFeedback({ text: 'Selecione ao menos um lançamento para importar.', type: 'info' });
      return;
    }

    setIsImporting(true);
    setFeedback(null);
    try {
      const res = await importDatabaseSessions(toImport, userId);
      if (res && res.success) {
        setFeedback({
          text: `${res.count || toImport.length} lançamento(s) de sessão avulsa importado(s) com sucesso no Sistema Financeiro!`,
          type: 'success',
        });
        await loadSessions(filterMonth);
        if (onSessionsImported) {
          onSessionsImported();
        }
      } else {
        setFeedback({ text: 'Falha ao importar registros.', type: 'error' });
      }
    } catch (err: any) {
      setFeedback({ text: `Erro na importação: ${err.message}`, type: 'error' });
    } finally {
      setIsImporting(false);
    }
  };

  // Importar uma única sessão diretamente
  const handleImportSingle = async (session: GestaoSession) => {
    setIsImporting(true);
    setFeedback(null);
    try {
      const res = await importDatabaseSessions([session], userId);
      if (res && res.success) {
        setFeedback({
          text: `Sessão de ${session.clientePaciente} importada para o financeiro!`,
          type: 'success',
        });
        await loadSessions(filterMonth);
        if (onSessionsImported) {
          onSessionsImported();
        }
      }
    } catch (err: any) {
      setFeedback({ text: `Erro: ${err.message}`, type: 'error' });
    } finally {
      setIsImporting(false);
    }
  };

  // Importar automaticamente todas as sessões pendentes no banco de dados
  const handleAutoImportAll = async () => {
    setIsImporting(true);
    setFeedback(null);
    try {
      const res = await autoImportDatabaseSessions(userId);
      if (res && res.success) {
        setFeedback({
          text: res.message || `${res.count || 0} lançamento(s) de sessão importado(s) automaticamente para o fluxo de receitas financeiras!`,
          type: 'success',
        });
        await loadSessions(filterMonth);
        if (onSessionsImported) {
          onSessionsImported();
        }
      } else {
        setFeedback({
          text: res.error || 'Nenhum lançamento pendente encontrado para importar.',
          type: 'info',
        });
      }
    } catch (err: any) {
      setFeedback({ text: `Erro: ${err.message}`, type: 'error' });
    } finally {
      setIsImporting(false);
    }
  };

  // Submeter formulário de Sessão Avulsa (Print 02)
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionForm.cliente.trim()) {
      setFeedback({ text: 'Por favor, informe o nome do cliente/paciente.', type: 'error' });
      return;
    }

    const valorNum = parseFloat(newSessionForm.valor.replace(',', '.'));
    if (isNaN(valorNum) || valorNum <= 0) {
      setFeedback({ text: 'Informe um valor válido para a sessão.', type: 'error' });
      return;
    }

    setIsCreating(true);
    setFeedback(null);
    try {
      const res = await createGestaoSessionInDatabase(
        {
          ...newSessionForm,
          valor: valorNum,
        },
        userId
      );

      if (res && res.success) {
        setFeedback({
          text: 'Sessão Avulsa gravada no banco de dados e disponibilizada no financeiro com sucesso!',
          type: 'success',
        });
        setNewSessionForm({
          cliente: '',
          data: new Date().toISOString().substring(0, 10),
          procedimento: 'Massagem Relaxante',
          valor: '150.00',
          profissional: 'Osaias Brito',
          formaPagamento: 'PIX',
          observacao: '',
        });
        setActiveTab('search');
        await loadSessions(filterMonth);
        if (onSessionsImported) {
          onSessionsImported();
        }
      } else {
        setFeedback({ text: res?.error || 'Erro ao salvar sessão.', type: 'error' });
      }
    } catch (err: any) {
      setFeedback({ text: `Erro: ${err.message}`, type: 'error' });
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-buscar-banco-gestao"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Cabeçalho do Modal */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between bg-linear-to-r from-slate-50 via-white to-indigo-50/40">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Buscar Lançamentos no Banco de Dados
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  PostgreSQL Conectado
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Consulta em tempo real de <strong className="text-slate-700 font-semibold">Sessões Avulsas</strong> salvas pelo Sistema de Gestão de Pessoas de Massoterapia
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
            title="Fechar janela"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas de Navegação */}
        <div className="flex items-center gap-2 px-5 sm:px-6 pt-3 border-b border-slate-100 bg-slate-50/50">
          <button
            id="tab-buscar-lancamentos"
            onClick={() => setActiveTab('search')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'search'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Consultar Lançamentos</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            id="tab-cadastrar-sessao-avulsa"
            onClick={() => setActiveTab('create')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'create'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Lançar Sessão Avulsa (Print 02)</span>
          </button>

          <button
            id="tab-info-integracao"
            onClick={() => setActiveTab('info')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ml-auto ${
              activeTab === 'info'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tabelas e Endpoints</span>
          </button>
        </div>

        {/* Alertas de Feedback */}
        {feedback && (
          <div
            className={`mx-5 sm:mx-6 mt-4 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs font-medium border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : feedback.type === 'error'
                ? 'bg-rose-50 text-rose-900 border-rose-200'
                : 'bg-indigo-50 text-indigo-900 border-indigo-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : feedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <Zap className="w-4 h-4 text-indigo-600 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Conteúdo Principal do Modal */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'search' && (
            <>
              {/* Barra de Filtros e Busca */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Seleção do Mês */}
                <div className="relative min-w-[160px]">
                  <select
                    id="select-mes-busca-banco"
                    value={filterMonth}
                    onChange={(e) => {
                      const newMonth = e.target.value;
                      setFilterMonth(newMonth);
                      loadSessions(newMonth);
                    }}
                    className="w-full pl-9 pr-8 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 appearance-none transition-all cursor-pointer"
                  >
                    <option value="2026-09">Setembro 2026</option>
                    <option value="2026-08">Agosto 2026</option>
                    <option value="2026-10">Outubro 2026</option>
                    <option value="2026-07">Julho 2026</option>
                    <option value="TODOS">Todos os Períodos</option>
                  </select>
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Campo de Busca Livre */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="input-busca-sessao"
                    type="text"
                    placeholder="Filtrar por paciente, técnica, observação..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all"
                  />
                </div>

                {/* Botão Atualizar Consulta */}
                <button
                  id="btn-recarregar-busca-banco"
                  onClick={() => loadSessions(filterMonth)}
                  disabled={isLoading}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                  title="Atualizar busca no banco de dados agora"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
                  <span>{isLoading ? 'Consultando...' : 'Atualizar Busca'}</span>
                </button>
              </div>

              {/* Cards de Métricas e Diagnóstico */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Total no Banco
                  </span>
                  <div className="text-lg font-black text-slate-800 mt-0.5">
                    {totalCount} <span className="text-xs font-medium text-slate-500">sessões</span>
                  </div>
                </div>

                <div className="bg-amber-50/70 border border-amber-200/60 rounded-2xl p-3.5">
                  <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                    Pendentes
                  </span>
                  <div className="text-lg font-black text-amber-900 mt-0.5">
                    {pendingCount} <span className="text-xs font-medium text-amber-600">a importar</span>
                  </div>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-2xl p-3.5">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                    No Financeiro
                  </span>
                  <div className="text-lg font-black text-emerald-900 mt-0.5">
                    {alreadyInCount} <span className="text-xs font-medium text-emerald-600">integrados</span>
                  </div>
                </div>

                <div className="bg-indigo-50/70 border border-indigo-200/60 rounded-2xl p-3.5">
                  <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">
                    Faturamento Localizado
                  </span>
                  <div className="text-lg font-black text-indigo-900 mt-0.5">
                    R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Informação das tabelas consultadas */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 flex-wrap gap-2">
                <span>
                  Tabelas verificadas no PostgreSQL:{' '}
                  <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
                    sessoes_avulsas
                  </code>
                  ,{' '}
                  <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
                    atendimentos
                  </code>
                  ,{' '}
                  <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
                    renda_massoterapia
                  </code>
                  ,{' '}
                  <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
                    renda_extra
                  </code>
                </span>

                {pendingCount > 0 && (
                  <button
                    onClick={handleSelectAllPending}
                    className="text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer text-xs"
                  >
                    Selecionar todas pendentes ({pendingCount})
                  </button>
                )}
              </div>

              {/* Lista de Sessões */}
              {isLoading ? (
                <div className="py-16 text-center">
                  <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-700">
                    Consultando lançamentos no banco de dados...
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Buscando em sessoes_avulsas, atendimentos e logs de integração
                  </p>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                  <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-slate-800">
                    Nenhum lançamento encontrado para o período selecionado
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Não encontramos registros pendentes nas tabelas de gestão de massoterapia para {filterMonth}.
                    Você pode alterar o mês, buscar em todos os períodos ou lançar uma nova sessão avulsa para testar.
                  </p>
                  <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                    <button
                      onClick={() => {
                        setFilterMonth('TODOS');
                        loadSessions('TODOS');
                      }}
                      className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Buscar em Todos os Períodos
                    </button>
                    <button
                      onClick={() => setActiveTab('create')}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Lançar Sessão Avulsa de Teste
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filteredSessions.length && filteredSessions.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        title="Selecionar todos"
                      />
                      <span>Cliente / Procedimento</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="hidden sm:inline">Data</span>
                      <span className="hidden sm:inline">Origem</span>
                      <span>Valor / Ação</span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                    {filteredSessions.map((session) => {
                      const isSelected = selectedIds.has(session.id);
                      return (
                        <div
                          key={session.id}
                          className={`p-4 transition-all flex items-center justify-between gap-3 hover:bg-slate-50/80 ${
                            isSelected ? 'bg-indigo-50/40' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(session.id)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 mt-1 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-extrabold text-slate-900 truncate">
                                  {session.clientePaciente}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                                  {session.tipoSessao || 'Sessão Avulsa'}
                                </span>
                                {session.alreadyInFinance ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    No Financeiro
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                                    Pendente
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 mt-0.5 truncate">
                                {session.procedimento}
                                {session.observacao && (
                                  <span className="text-slate-400 font-normal">
                                    {' '}• {session.observacao}
                                  </span>
                                )}
                              </p>
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                                <span>Tabela: <strong className="text-slate-500">{session.sourceTable}</strong></span>
                                {session.formaPagamento && (
                                  <span>• Forma: {session.formaPagamento}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0 text-right">
                            <div className="hidden sm:block text-right">
                              <span className="text-xs font-semibold text-slate-700 block">
                                {session.dataLancamento ? session.dataLancamento.split('-').reverse().join('/') : '-'}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate max-w-[120px]">
                                {session.origem}
                              </span>
                            </div>

                            <div>
                              <span className="text-xs sm:text-sm font-black text-emerald-700 block">
                                R$ {session.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>

                              {!session.alreadyInFinance && (
                                <button
                                  onClick={() => handleImportSingle(session)}
                                  disabled={isImporting}
                                  className="mt-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ml-auto disabled:opacity-50"
                                  title="Importar apenas este atendimento para o financeiro"
                                >
                                  <DownloadCloud className="w-3 h-3" />
                                  <span>Importar</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'create' && (
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-indigo-950">
                    Lançamento de Sessões Avulsas (Tela Print 02)
                  </h4>
                  <p className="text-xs text-indigo-800/90 mt-0.5 leading-relaxed">
                    Este formulário registra a Sessão Avulsa diretamente na tabela{' '}
                    <code className="bg-white/80 px-1 py-0.5 rounded font-mono text-[11px]">sessoes_avulsas</code> do
                    banco de dados (PostgreSQL/Supabase) e a sincroniza simultaneamente com o Sistema Financeiro.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nome do Cliente / Paciente *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: Mariana Silva"
                      value={newSessionForm.cliente}
                      onChange={(e) =>
                        setNewSessionForm((prev) => ({ ...prev, cliente: e.target.value }))
                      }
                      className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Data da Sessão *
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      required
                      value={newSessionForm.data}
                      onChange={(e) =>
                        setNewSessionForm((prev) => ({ ...prev, data: e.target.value }))
                      }
                      className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Procedimento / Técnica *
                  </label>
                  <select
                    value={newSessionForm.procedimento}
                    onChange={(e) =>
                      setNewSessionForm((prev) => ({ ...prev, procedimento: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Massagem Relaxante">Massagem Relaxante</option>
                    <option value="Massagem Terapêutica">Massagem Terapêutica</option>
                    <option value="Drenagem Linfática">Drenagem Linfática</option>
                    <option value="Ventosaterapia">Ventosaterapia</option>
                    <option value="Shiatsu">Shiatsu</option>
                    <option value="Reflexologia Podal">Reflexologia Podal</option>
                    <option value="Liberação Miofascial">Liberação Miofascial</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Valor da Sessão (R$) *
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="150.00"
                      value={newSessionForm.valor}
                      onChange={(e) =>
                        setNewSessionForm((prev) => ({ ...prev, valor: e.target.value }))
                      }
                      className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-emerald-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Profissional
                  </label>
                  <input
                    type="text"
                    value={newSessionForm.profissional}
                    onChange={(e) =>
                      setNewSessionForm((prev) => ({ ...prev, profissional: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Forma de Pagamento
                  </label>
                  <select
                    value={newSessionForm.formaPagamento}
                    onChange={(e) =>
                      setNewSessionForm((prev) => ({ ...prev, formaPagamento: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Transferência">Transferência</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Observações do Atendimento
                </label>
                <textarea
                  rows={2}
                  placeholder="Anotações técnicas, queixa principal, evolução da sessão..."
                  value={newSessionForm.observacao}
                  onChange={(e) =>
                    setNewSessionForm((prev) => ({ ...prev, observacao: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('search')}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-200 disabled:opacity-50"
                >
                  {isCreating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isCreating ? 'Gravando no Banco...' : 'Salvar no Banco de Dados'}</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'info' && (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="font-extrabold text-slate-900">
                    Estrutura de Integração do Banco de Dados
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  O Meu Controle Financeiro está conectado diretamente ao PostgreSQL no Supabase,
                  compartilhando a base do <strong>Sistema de Gestão de Pessoas de Massoterapia</strong>.
                  Qualquer lançamento inserido pelo sistema externo nas tabelas abaixo é lido e sincronizado:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-800 block text-xs">
                      1. Tabela: <code className="text-indigo-600 font-mono">sessoes_avulsas</code>
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Campos: id, cliente, valor, data_lancamento, procedimento, profissional, forma_pagamento.
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-800 block text-xs">
                      2. Tabela: <code className="text-indigo-600 font-mono">atendimentos</code>
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Campos: id, nome_cliente, valor, data_atendimento, servico, status.
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-800 block text-xs">
                      3. Tabela: <code className="text-indigo-600 font-mono">renda_massoterapia</code>
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Tabela consolidada do faturamento com sincronização bidirecional.
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-800 block text-xs">
                      4. Webhook HTTP REST
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Endpoint: <code className="text-indigo-600 font-mono">POST /api/integracao/atendimento</code>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-slate-500">
            {selectedIds.size > 0 ? (
              <span>
                <strong className="text-indigo-700 font-bold">{selectedIds.size}</strong> lançamento(s) selecionado(s)
              </span>
            ) : (
              <span>Nenhum lançamento selecionado</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              Fechar
            </button>

            {activeTab === 'search' && (
              <>
                {pendingCount > 0 && (
                  <button
                    id="btn-importar-todas-automaticamente"
                    type="button"
                    onClick={handleAutoImportAll}
                    disabled={isImporting}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    title="Importar automaticamente todas as sessões pendentes no banco para o fluxo de receitas financeiras"
                  >
                    {isImporting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                    )}
                    <span>Importar Todas ({pendingCount})</span>
                  </button>
                )}

                <button
                  id="btn-importar-selecionados-financeiro"
                  onClick={handleImportSelected}
                  disabled={isImporting || selectedIds.size === 0}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isImporting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <DownloadCloud className="w-4 h-4" />
                  )}
                  <span>
                    {isImporting
                      ? 'Importando...'
                      : `Importar Selecionados (${selectedIds.size})`}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
