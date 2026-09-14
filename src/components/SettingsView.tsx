import React, { useState } from 'react';
import {
  Settings,
  User,
  Shield,
  Moon,
  Sun,
  Sparkles,
  LogOut,
  CheckCircle2,
  RefreshCw,
  Database,
  Server,
  Zap,
  CheckCircle,
  XCircle,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';
import { DatabaseTestModal, testDatabaseConnection, DbHealthResult } from './DatabaseTestModal';

export const SettingsView: React.FC = () => {
  const { currentUser, userProfile, signOut, isDemoUser } = useAuth();
  const { deleteAllDemoData } = useFinance();
  const [deletingDemo, setDeletingDemo] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Database Connection Test State
  const [showDbModal, setShowDbModal] = useState(false);
  const [testingDb, setTestingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<DbHealthResult | null>(null);

  const handleTestDatabase = async () => {
    setTestingDb(true);
    try {
      const res = await testDatabaseConnection();
      setDbTestResult(res);
      setShowDbModal(true);
    } finally {
      setTestingDb(false);
    }
  };

  const handleDeleteAllDemo = async () => {
    setDeletingDemo(true);
    setSuccessMsg(null);
    try {
      const res = await deleteAllDemoData();
      setSuccessMsg(res.message || 'Todos os dados fictícios foram excluídos com sucesso!');
      setConfirmDelete(false);
    } catch (err: any) {
      console.error(err);
    } finally {
      setDeletingDemo(false);
    }
  };

  const displayName = userProfile?.displayName || currentUser?.displayName || 'Usuário';
  const email = userProfile?.email || currentUser?.email || 'demo@meucontrole.com';

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <Settings className="w-4 h-4" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Configurações do Sistema</h2>
        </div>
        <p className="text-xs text-slate-500">
          Gerencie seu perfil, preferências de exibição e conexão com a nuvem.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Profile Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" />
              Conta & Autenticação
            </h3>

            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-4">
              {userProfile?.photoURL ? (
                <img
                  src={userProfile.photoURL}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-emerald-600 text-white font-black text-xl flex items-center justify-center shadow-xs">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-extrabold text-slate-900 text-sm">{displayName}</span>
                <span className="text-xs text-slate-400 font-medium">{email}</span>
                <span className="text-[10px] text-emerald-600 font-bold mt-1">
                  {isDemoUser ? 'Acesso Demonstração' : 'Conectado via Google OAuth'}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span>Moeda Padrão:</span>
                <span className="font-bold text-slate-900">Real Brasileiro (BRL - R$)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span>Fuso Horário / Formato:</span>
                <span className="font-bold text-slate-900">Brasília (DD/MM/AAAA)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span>Armazenamento / Banco:</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  PostgreSQL (Supabase Cloud)
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span>Status da Conexão:</span>
                <span className="font-bold text-slate-800">Conectado (Drizzle ORM)</span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100">
            <button
              onClick={() => signOut()}
              className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors border border-rose-100"
            >
              <LogOut className="w-4 h-4" />
              <span>Desconectar desta Conta</span>
            </button>
          </div>
        </div>

        {/* Database Sync & Cleanup Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base mb-2 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              Sincronização e Limpeza de Dados
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Garante que apenas seus dados reais do banco de dados (PostgreSQL) sejam exibidos na aplicação, eliminando quaisquer dados fictícios ou registros de demonstração remanescentes.
            </p>

            {confirmDelete ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-[11px] text-rose-800 mb-4 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold mb-1 text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Confirmar Exclusão de Dados Fictícios?
                </div>
                <p className="mb-3 text-rose-700 leading-relaxed">
                  Esta ação varre o armazenamento local e registros temporários para eliminar itens fictícios ou de teste ('demo-*', 'TESTE'), recarregando imediatamente seus registros 100% reais do banco de dados.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDeleteAllDemo}
                    disabled={deletingDemo}
                    className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {deletingDemo ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>Sim, Limpar e Sincronizar</span>
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={deletingDemo}
                    className="py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-bold text-xs transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl text-[11px] text-emerald-800 mb-4">
                <strong>Modo Dados Reais Ativo:</strong> A geração automática de dados fictícios está permanentemente desativada. O sistema opera exclusivamente com seus registros reais.
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            {!confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={deletingDemo}
                className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-100 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir Dados Fictícios & Recarregar Banco Real</span>
              </button>
            )}

            <button
              onClick={async () => {
                setDeletingDemo(true);
                setSuccessMsg(null);
                try {
                  const res = await deleteAllDemoData();
                  setSuccessMsg(res.message || 'Dados reais sincronizados com sucesso do banco!');
                } finally {
                  setDeletingDemo(false);
                }
              }}
              disabled={deletingDemo}
              className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-slate-600 ${deletingDemo ? 'animate-spin' : ''}`} />
              <span>Forçar Sincronização com o Banco Real</span>
            </button>
          </div>
        </div>

        {/* Database Connection Diagnostic Card (Solicitado pelo Usuário) */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between md:col-span-2">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                Diagnóstico & Conexão com o Banco de Dados
              </h3>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-black flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                PostgreSQL Relacional Ativo
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Verifique a integridade, o tempo de resposta e a conectividade direta com o banco de dados PostgreSQL Cloud SQL.
              <strong> Garantia de Preservação:</strong> Todas as atualizações realizam mesclagem segura (não-destrutiva), garantindo que dados históricos e edições nunca sejam apagados.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Instância / Banco</span>
                <span className="font-bold text-slate-800 font-mono">cloud_sql_development_database</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Porta & Provedor</span>
                <span className="font-bold text-slate-800">5432 (Cloud SQL Developer)</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Proteção Ativa</span>
                <span className="font-bold text-emerald-700">Upsert Seguro sem Exclusão</span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs text-slate-400">
              Clique para disparar um ping de verificação em tempo real:
            </span>
            <button
              onClick={handleTestDatabase}
              disabled={testingDb}
              className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-200 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingDb ? 'animate-spin' : ''}`} />
              <span>{testingDb ? 'Testando Conexão...' : 'Testar Conexão com Banco de Dados'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Teste de Conexão com Banco de Dados */}
      <DatabaseTestModal
        isOpen={showDbModal}
        onClose={() => setShowDbModal(false)}
      />
    </div>
  );
};
