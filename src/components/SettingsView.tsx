import React, { useState } from 'react';
import { Settings, User, Shield, Moon, Sun, Sparkles, LogOut, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';

export const SettingsView: React.FC = () => {
  const { currentUser, userProfile, signOut, isDemoUser, signInDemo } = useAuth();
  const { seedDemoData } = useFinance();
  const [seeding, setSeeding] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSeedData = async () => {
    setSeeding(true);
    setSuccessMsg(null);
    try {
      await seedDemoData();
      setSuccessMsg('Dados de demonstração gerados com sucesso!');
    } catch (err: any) {
      console.error(err);
    } finally {
      setSeeding(false);
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

        {/* Demo & Developer Helpers Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Dados de Demonstração
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Gera automaticamente um conjunto completo de dados simulados (salário, rendas extras, despesas fixas, compras parceladas e cartões) para você testar todas as funcionalidades do sistema instantaneamente.
            </p>

            <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-2xl text-[11px] text-amber-800 mb-4">
              <strong>Dica:</strong> Útil para visualizar os gráficos de relatórios, barras de limite de cartão e saldo do mês sem precisar preencher tudo manualmente.
            </div>
          </div>

          <button
            onClick={handleSeedData}
            disabled={seeding}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {seeding ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Gerando registros de teste...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Carregar Dados de Exemplo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
