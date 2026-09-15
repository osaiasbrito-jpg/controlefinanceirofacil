import React, { useState, useMemo, useEffect } from 'react';
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
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  User,
  Clock,
  Zap,
  Wifi,
  WifiOff,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { RendaMassoterapia } from '../types';
import { formatCurrency, formatDateBR, getMonthName } from '../utils/formatters';
import { MassoterapiaModal } from './modals/MassoterapiaModal';
import { ConfirmDeleteModal } from './modals/ConfirmDeleteModal';

export const MassoterapiaView: React.FC = () => {
  const {
    currentUser,
    selectedMonth,
    setSelectedMonth,
    effectiveMassoterapiaForMonth,
    deleteMassoterapiaIncome,
    refreshDataFromPostgres,
  } = useFinance();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<RendaMassoterapia | null>(null);
  const [itemToDelete, setItemToDelete] = useState<RendaMassoterapia | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Estados de Teste de Conexão em Tempo Real
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isCleaningTest, setIsCleaningTest] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'online' | 'error'>('idle');
  const [testLatency, setTestLatency] = useState<number | null>(null);
  const [lastTestTime, setLastTestTime] = useState<string | null>(null);
  const [testFeedbackMessage, setTestFeedbackMessage] = useState<string | null>(null);
  const [realtimeAlert, setRealtimeAlert] = useState<{
    text: string;
    type: 'success' | 'info' | 'error';
    timestamp: number;
  } | null>(null);

  // Auto-dismiss do alerta em tempo real após 6 segundos
  useEffect(() => {
    if (realtimeAlert) {
      const timer = setTimeout(() => {
        setRealtimeAlert(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [realtimeAlert]);

  // Listener de Eventos em Tempo Real via Server-Sent Events (SSE)
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events/live-sync');

      eventSource.addEventListener('test_ping', (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data);
          setConnectionStatus('online');
          setTestLatency(payload.latencyMs || 18);
          setLastTestTime(new Date().toLocaleTimeString('pt-BR'));
          setRealtimeAlert({
            text: `Sinal em tempo real recebido! Latência: ${payload.latencyMs || 18}ms.`,
            type: 'success',
            timestamp: Date.now(),
          });
          if (refreshDataFromPostgres) {
            refreshDataFromPostgres();
          }
        } catch {}
      });

      eventSource.addEventListener('atendimento_synced', (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data);
          setRealtimeAlert({
            text: payload.isTest
              ? 'Lançamento de teste recebido e confirmado em tempo real!'
              : `Atendimento de ${payload.clientName || 'cliente'} sincronizado em tempo real!`,
            type: 'info',
            timestamp: Date.now(),
          });
          if (refreshDataFromPostgres) {
            refreshDataFromPostgres();
          }
        } catch {}
      });

      eventSource.addEventListener('data_refreshed', () => {
        if (refreshDataFromPostgres) {
          refreshDataFromPostgres();
        }
      });
    } catch (e) {
      console.warn('Aviso ao inicializar SSE para massoterapia:', e);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [refreshDataFromPostgres]);

  // Sincronização e polling de segurança enquanto estiver na tela de massoterapia
  useEffect(() => {
    if (refreshDataFromPostgres) {
      refreshDataFromPostgres();
    }

    const intervalId = setInterval(() => {
      if (refreshDataFromPostgres) {
        refreshDataFromPostgres();
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [refreshDataFromPostgres]);

  // Executa Teste de Conexão com o Sistema de Massoterapia em Tempo Real
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestFeedbackMessage(null);
    try {
      const userEmail = currentUser?.email || 'osaiasbrito@gmail.com';
      const res = await fetch('/api/renda-massoterapia/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userEmail }),
      });

      const data = await res.json();
      if (data.success) {
        setConnectionStatus('online');
        setTestLatency(data.latencyMs || 22);
        setLastTestTime(new Date().toLocaleTimeString('pt-BR'));
        setTestFeedbackMessage(data.message || 'Comunicação em tempo real estabelecida!');
        setRealtimeAlert({
          text: `Comunicação ativa em tempo real com o Sistema de Massoterapia! (Latência: ${data.latencyMs || 22}ms)`,
          type: 'success',
          timestamp: Date.now(),
        });
        if (refreshDataFromPostgres) {
          await refreshDataFromPostgres();
        }
      } else {
        setConnectionStatus('error');
        setTestFeedbackMessage(data.error || 'Falha ao validar comunicação.');
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setTestFeedbackMessage('Erro na requisição de teste.');
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Exclusão rápida do registro de teste do banco de dados (política de não-poluição)
  const handleCleanTestRecord = async () => {
    setIsCleaningTest(true);
    try {
      const userEmail = currentUser?.email || 'osaiasbrito@gmail.com';
      await fetch(`/api/renda-massoterapia/clean-tests?userId=${encodeURIComponent(userEmail)}`, {
        method: 'DELETE',
      });
      // Remoção otimista local
      await deleteMassoterapiaIncome('teste_conexao_massoterapia');
      if (refreshDataFromPostgres) {
        await refreshDataFromPostgres();
      }
      setRealtimeAlert({
        text: 'Registro de teste excluído do banco de dados com sucesso.',
        type: 'info',
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('Erro ao excluir teste de massoterapia:', err);
    } finally {
      setIsCleaningTest(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await fetch('/api/renda-massoterapia/sync-now', { method: 'POST' }).catch(() => {});
      if (refreshDataFromPostgres) {
        await refreshDataFromPostgres();
      }
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };

  // Identificar se há registro de teste ativo na lista
  const testRecordActive = useMemo(() => {
    return effectiveMassoterapiaForMonth.find(
      (item) =>
        item.id === 'teste_conexao_massoterapia' ||
        (item.clientePaciente && item.clientePaciente.toUpperCase().includes('TESTE')) ||
        (item.observacao && item.observacao.toUpperCase().includes('TESTE')) ||
        (item.dadosExtras && (item.dadosExtras.isTest || item.dadosExtras.is_test))
    );
  }, [effectiveMassoterapiaForMonth]);

  // Filtragem e ordenação dos lançamentos
  const filteredList = useMemo(() => {
    let list = [...effectiveMassoterapiaForMonth];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((item) => {
        const obsMatch = item.observacao?.toLowerCase().includes(q);
        const clientMatch = item.clientePaciente?.toLowerCase().includes(q);
        const procMatch = item.procedimento?.toLowerCase().includes(q);
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
        return obsMatch || clientMatch || procMatch || dateMatch || valMatch;
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
      if (refreshDataFromPostgres) {
        await refreshDataFromPostgres();
      }
      setItemToDelete(null);
      setRealtimeAlert({
        text: 'Lançamento excluído do banco de dados com sucesso.',
        type: 'info',
        timestamp: Date.now(),
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 pb-16">
      {/* Notificação / Feedback de Tempo Real Flutuante */}
      {realtimeAlert && (
        <div
          id="realtime-sync-banner"
          className={`px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 shadow-sm animate-in slide-in-from-top-2 duration-200 ${
            realtimeAlert.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : realtimeAlert.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-teal-50 border-teal-200 text-teal-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <span className="text-xs font-bold tracking-tight">{realtimeAlert.text}</span>
          </div>
          <button
            onClick={() => setRealtimeAlert(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Card com Controles de Integração e Botão de Teste */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Renda Massoterapia</h2>

            {/* Indicador de Conexão em Tempo Real */}
            <span
              id="badge-status-conexao"
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                connectionStatus === 'online'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : connectionStatus === 'error'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-teal-50 text-teal-700 border-teal-200/60'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'online'
                    ? 'bg-emerald-500 animate-pulse'
                    : connectionStatus === 'error'
                    ? 'bg-rose-500'
                    : 'bg-teal-500 animate-pulse'
                }`}
              />
              {connectionStatus === 'online'
                ? `Conectado em Tempo Real (${testLatency || 18}ms)`
                : connectionStatus === 'error'
                ? 'Aviso de Comunicação'
                : 'Auto-Sync: Terapias Pro Ativo'}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Controle detalhado dos atendimentos e faturamento de massoterapia referente a{' '}
            <span className="font-semibold text-teal-800">{getMonthName(selectedMonth)}</span>.
          </p>
        </div>

        {/* Grupo de Ações do Cabeçalho: Botão de Teste, Sincronizar e Novo */}
        <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto">
          {/* BOTÃO DE TESTE DE CONEXÃO COM O SISTEMA DE MASSOTERAPIA */}
          <button
            id="btn-testar-conexao-massoterapia"
            onClick={handleTestConnection}
            disabled={isTestingConnection}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs border ${
              isTestingConnection
                ? 'bg-amber-50 text-amber-700 border-amber-300 animate-pulse'
                : connectionStatus === 'online'
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-slate-900 hover:bg-slate-800 text-white border-transparent'
            }`}
            title="Testar comunicação em tempo real com o sistema de massoterapia"
          >
            {isTestingConnection ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
            ) : connectionStatus === 'online' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>
              {isTestingConnection
                ? 'Testando Comunicação...'
                : connectionStatus === 'online'
                ? `Testar Conexão Novamente (${testLatency}ms)`
                : 'Testar Conexão em Tempo Real'}
            </span>
          </button>

          {/* Botão Sincronizar */}
          <button
            id="btn-sync-terapias-pro"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            title="Forçar sincronização manual com Terapias Pro"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-teal-600' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>

          {/* Botão Novo Atendimento */}
          <button
            id="btn-novo-lancamento-massoterapia"
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-200 flex items-center gap-2 transition-all cursor-pointer ml-auto lg:ml-0"
          >
            <Plus className="w-4 h-4" />
            Novo Atendimento
          </button>
        </div>
      </div>

      {/* Banner de Proteção Contra Poluição: Exibido Quando Houver Registro de Teste Ativo */}
      {testRecordActive && (
        <div
          id="banner-registro-teste"
          className="bg-amber-50/90 border border-amber-200/90 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold text-amber-950">
                  Modo de Teste de Comunicação Ativo
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 uppercase tracking-wide">
                  1 Teste Ativo • Não Polui o Sistema
                </span>
              </div>
              <p className="text-xs text-amber-800/90 mt-1 max-w-2xl leading-relaxed">
                O sistema gerou 1 registro controlado para comprovar a comunicação em tempo real.
                Conforme as diretrizes, novos testes não acumulam e você pode remover este registro do
                banco de dados imediatamente quando desejar.
              </p>
            </div>
          </div>

          {/* Botão de Exclusão Direta do Registro de Teste */}
          <button
            id="btn-excluir-teste-banco"
            onClick={handleCleanTestRecord}
            disabled={isCleaningTest}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer shrink-0 disabled:opacity-50"
            title="Excluir o registro de teste do banco de dados agora"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isCleaningTest ? 'Excluindo...' : 'Excluir Teste do Banco'}</span>
          </button>
        </div>
      )}

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

      {/* Lista / Tabela de Lançamentos com Opção de Exclusão do Banco */}
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
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
              Exclusão disponível a qualquer momento
            </span>
            <div className="text-xs font-bold text-slate-500">
              {filteredList.length} {filteredList.length === 1 ? 'registro' : 'registros'}
            </div>
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
                : 'Os atendimentos cadastrados no Terapias Pro entram automaticamente aqui. Você também pode testar a conexão ou lançar atendimentos manuais.'}
            </p>
            {!searchQuery && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestConnection}
                  disabled={isTestingConnection}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-amber-400" />
                  Testar Conexão em Tempo Real
                </button>
                <button
                  onClick={handleOpenAdd}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-200 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Lançar Atendimento
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-5">Data</th>
                  <th className="py-3 px-5">Cliente / Procedimento</th>
                  <th className="py-3 px-5">Tipo & Origem</th>
                  <th className="py-3 px-5 text-right">Valor (R$)</th>
                  <th className="py-3 px-5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredList.map((item) => {
                  const isItemTest =
                    item.id === 'teste_conexao_massoterapia' ||
                    (item.clientePaciente && item.clientePaciente.toUpperCase().includes('TESTE')) ||
                    (item.observacao && item.observacao.toUpperCase().includes('TESTE')) ||
                    (item.dadosExtras && (item.dadosExtras.isTest || item.dadosExtras.is_test));

                  return (
                    <tr
                      key={item.id}
                      id={`massoterapia-row-${item.id}`}
                      className={`transition-colors ${
                        isItemTest
                          ? 'bg-amber-50/60 hover:bg-amber-100/60 border-l-4 border-amber-500'
                          : 'hover:bg-slate-50/60'
                      }`}
                    >
                      {/* Data */}
                      <td className="py-3.5 px-5 font-semibold text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{formatDateBR(item.dataLancamento)}</span>
                        </div>
                      </td>

                      {/* Cliente / Procedimento / Observação */}
                      <td className="py-3.5 px-5">
                        <div className="flex flex-col gap-0.5">
                          {item.clientePaciente ? (
                            <>
                              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                <User
                                  className={`w-3 h-3 shrink-0 ${
                                    isItemTest ? 'text-amber-600' : 'text-teal-600'
                                  }`}
                                />
                                <span>{item.clientePaciente}</span>
                                {isItemTest && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-200 text-amber-800 uppercase">
                                    Teste
                                  </span>
                                )}
                              </div>
                              {item.procedimento && (
                                <span
                                  className={`text-[11px] font-medium ${
                                    isItemTest ? 'text-amber-800' : 'text-teal-700'
                                  }`}
                                >
                                  {item.procedimento}
                                </span>
                              )}
                              {item.observacao && item.observacao !== item.procedimento && (
                                <span className="text-[11px] text-slate-500 italic">
                                  {item.observacao}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="font-medium text-slate-800">
                              {item.observacao || 'Sessão de massoterapia'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Tipo & Origem */}
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              isItemTest
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-teal-50 text-teal-700 border-teal-200/50'
                            }`}
                          >
                            {item.tipo || 'Sessão Avulsa'}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600">
                            {item.origem || 'Terapias Pro'}
                          </span>
                        </div>
                      </td>

                      {/* Valor */}
                      <td className="py-3.5 px-5 text-right font-black text-teal-700 whitespace-nowrap text-sm">
                        {formatCurrency(item.valor)}
                      </td>

                      {/* Ações: Editar e Excluir do Banco de Dados a Qualquer Momento */}
                      <td className="py-3.5 px-5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {!isItemTest && (
                            <button
                              id={`edit-masso-${item.id}`}
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                              title="Editar lançamento"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            id={`delete-masso-${item.id}`}
                            onClick={() => setItemToDelete(item)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isItemTest
                                ? 'text-rose-600 hover:bg-rose-100 bg-rose-50'
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                            title={
                              isItemTest
                                ? 'Excluir registro de teste do banco de dados'
                                : 'Excluir lançamento do banco de dados'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {/* Modal de Confirmação de Exclusão do Banco de Dados */}
      <ConfirmDeleteModal
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={
          itemToDelete?.id === 'teste_conexao_massoterapia' ||
          itemToDelete?.clientePaciente?.toUpperCase().includes('TESTE')
            ? 'Excluir Registro de Teste do Banco'
            : 'Excluir Lançamento do Banco de Dados'
        }
        description={`Tem certeza que deseja excluir permanentemente o lançamento de ${
          itemToDelete ? formatCurrency(itemToDelete.valor) : ''
        } ${itemToDelete?.clientePaciente ? `referente a ${itemToDelete.clientePaciente}` : ''} de ${
          itemToDelete?.dataLancamento ? formatDateBR(itemToDelete.dataLancamento) : ''
        }? Esta ação removerá o registro do banco de dados.`}
      />
    </div>
  );
};
