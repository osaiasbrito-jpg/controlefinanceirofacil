import React, { useState } from 'react';
import {
  ShieldAlert,
  Users,
  CheckCircle2,
  Clock,
  Crown,
  Ban,
  Search,
  DollarSign,
  CreditCard,
  QrCode,
  Building,
  Key,
  Save,
  Plus,
  Trash2,
  ExternalLink,
  Receipt,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
  Sliders,
  Check,
  X,
  AlertTriangle,
  Database,
  Server,
  Activity,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDateBR } from '../utils/formatters';
import { PaymentGatewaySettings } from '../types';

export const SuperAdminView: React.FC = () => {
  const {
    userProfile,
    isSuperAdmin,
    gatewaySettings,
    updateGatewaySettings,
    accessRequests,
    paymentsList,
    approveTrialForUser,
    grantLifetimeForUser,
    extendTrialForUser,
    blockUserAccess,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'requests' | 'pricing' | 'gateways' | 'payments' | 'database'>('requests');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dbHealth, setDbHealth] = useState<any>(null);
  const [checkingDb, setCheckingDb] = useState(false);

  const checkDb = async () => {
    setCheckingDb(true);
    try {
      const res = await fetch('/api/health/db');
      const data = await res.json();
      setDbHealth(data);
    } catch (err: any) {
      setDbHealth({ status: 'error', error: err.message });
    } finally {
      setCheckingDb(false);
    }
  };

  // Form State for Pricing & Gateways
  const [formData, setFormData] = useState<PaymentGatewaySettings>({ ...gatewaySettings });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // Sync formData when gatewaySettings change
  React.useEffect(() => {
    setFormData({ ...gatewaySettings });
  }, [gatewaySettings]);

  if (!isSuperAdmin) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center max-w-lg mx-auto my-12 shadow-sm">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Acesso Restrito ao Super Usuário</h2>
        <p className="text-xs text-slate-500 mt-2">
          Este painel é exclusivo para o Super Usuário administrador do sistema.
        </p>
      </div>
    );
  }

  // Filtered Requests
  const filteredRequests = accessRequests.filter((req) => {
    const matchesSearch =
      req.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.phone?.includes(searchQuery);

    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : req.status?.toUpperCase() === statusFilter.toUpperCase();

    return matchesSearch && matchesStatus;
  });

  // Calculate metrics
  const totalUsers = accessRequests.length;
  const pendingCount = accessRequests.filter((r) => r.status === 'PENDING').length;
  const trialCount = accessRequests.filter((r) => r.status === 'TRIAL').length;
  const lifetimeCount = accessRequests.filter((r) => r.status === 'LIFETIME').length;
  const totalRevenue = paymentsList
    .filter((p) => p.status === 'APPROVED')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await updateGatewaySettings(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddAdminEmail = () => {
    if (!newAdminEmail.trim() || !newAdminEmail.includes('@')) return;
    const clean = newAdminEmail.trim().toLowerCase();
    if (!formData.superAdminEmails.includes(clean)) {
      setFormData((prev) => ({
        ...prev,
        superAdminEmails: [...prev.superAdminEmails, clean],
      }));
    }
    setNewAdminEmail('');
  };

  const handleRemoveAdminEmail = (emailToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      superAdminEmails: prev.superAdminEmails.filter((e) => e !== emailToRemove),
    }));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-linear-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 sm:p-8 rounded-3xl text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-700/50">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5" />
              Painel do Super Usuário
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Gestão de Acessos, Taxas & Bancos
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Gerencie solicitações de acesso de usuários, defina a taxa de liberação definitiva por tempo indeterminado e conecte as contas do Mercado Pago e Stone.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">
              Receita Total em Liberações
            </span>
            <span className="text-lg font-black text-emerald-300">
              {formatCurrency(totalRevenue)}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Usuários
            </span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <span className="text-2xl font-black text-slate-900">{totalUsers}</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
              Vitalícios Ativos
            </span>
            <Crown className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-2xl font-black text-emerald-600">{lifetimeCount}</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
              Teste de 30 Dias
            </span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-2xl font-black text-blue-600">{trialCount}</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
              Taxa Definida
            </span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-2xl font-black text-slate-900">
            {formatCurrency(gatewaySettings.lifetimePrice)}
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'requests'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Solicitações de Acesso ({accessRequests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('pricing')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'pricing'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Taxas & Planos</span>
        </button>

        <button
          onClick={() => setActiveTab('gateways')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'gateways'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Conexão Bancos (Mercado Pago & Stone)</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('database');
            if (!dbHealth) checkDb();
          }}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'database'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4 text-emerald-500" />
          <span>Banco PostgreSQL</span>
        </button>
      </div>

      {/* TAB 1: SOLICITAÇÕES DE ACESSO */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome, e-mail ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden"
              >
                <option value="ALL">Todos os Status</option>
                <option value="TRIAL">Em Teste (30 Dias)</option>
                <option value="LIFETIME">Vitalício Liberado</option>
                <option value="PENDING">Pendentes</option>
                <option value="BLOCKED">Bloqueados</option>
              </select>
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Nenhuma solicitação de acesso encontrada com os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Usuário</th>
                    <th className="py-3 px-4">Status de Acesso</th>
                    <th className="py-3 px-4">Período de Teste</th>
                    <th className="py-3 px-4">Data Solicitação</th>
                    <th className="py-3 px-4 text-right">Ações do Super Usuário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.map((req) => {
                    const isLifetime = req.status === 'LIFETIME';
                    const isTrial = req.status === 'TRIAL';
                    const isBlocked = req.status === 'BLOCKED';

                    // Calculate days left in trial
                    let trialDays = 0;
                    if (req.trialEndDate) {
                      const msLeft = new Date(req.trialEndDate).getTime() - Date.now();
                      trialDays = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
                    }

                    return (
                      <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{req.displayName || 'Sem nome'}</span>
                            <span className="text-[11px] text-slate-400">{req.email}</span>
                            {req.phone && <span className="text-[10px] text-emerald-600 font-medium">{req.phone}</span>}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {isLifetime && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center gap-1 w-fit">
                              <Crown className="w-3 h-3 text-emerald-600" />
                              Vitalício (Indefinido)
                            </span>
                          )}

                          {isTrial && (
                            <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px] flex items-center gap-1 w-fit">
                              <Clock className="w-3 h-3 text-blue-600" />
                              Teste ({trialDays} dias rest.)
                            </span>
                          )}

                          {isBlocked && (
                            <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px] flex items-center gap-1 w-fit">
                              <Ban className="w-3 h-3 text-rose-600" />
                              Bloqueado
                            </span>
                          )}

                          {!isLifetime && !isTrial && !isBlocked && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] w-fit">
                              Pendente
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-600">
                          {req.trialEndDate ? (
                            <div className="flex flex-col">
                              <span>Até {formatDateBR(req.trialEndDate.split('T')[0])}</span>
                              <span className="text-[10px] text-slate-400">
                                {trialDays > 0 ? `${trialDays} dias restantes` : 'Expirado'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-500">
                          {req.requestedAt ? formatDateBR(req.requestedAt.split('T')[0]) : '-'}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Grant Lifetime Button */}
                            {!isLifetime && (
                              <button
                                onClick={() => grantLifetimeForUser(req.userId || req.id)}
                                title="Liberar Acesso Total Definitivo"
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                              >
                                <Crown className="w-3 h-3" />
                                <span>Liberar Vitalício</span>
                              </button>
                            )}

                            {/* Renew Trial (30 Days) */}
                            <button
                              onClick={() => approveTrialForUser(req.userId || req.id, 30)}
                              title="Iniciar/Renovar 30 Dias de Teste Grátis"
                              className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Clock className="w-3 h-3 text-blue-600" />
                              <span>+30 Dias</span>
                            </button>

                            {/* Block / Revoke */}
                            {!isBlocked && (
                              <button
                                onClick={() => blockUserAccess(req.userId || req.id)}
                                title="Bloquear Acesso"
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
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
      )}

      {/* TAB 2: CONFIGURAÇÃO DE TAXAS E PLANOS */}
      {activeTab === 'pricing' && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6 max-w-3xl">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Configuração de Taxa para Liberação Total & Definitiva
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              O Super Usuário tem controle total para definir o valor único cobrado para que o usuário desbloqueie o sistema permanentemente (por tempo indefinido).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Valor da Taxa de Liberação Definitiva (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="1"
                  value={formData.lifetimePrice}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      lifetimePrice: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Valor exibido aos usuários que desejarem liberar o sistema ou após os 30 dias de teste.
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Dias de Teste Gratuito Padrão
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  required
                  min="1"
                  max="365"
                  value={formData.trialDays}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      trialDays: parseInt(e.target.value) || 30,
                    }))
                  }
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Período inicial sem custo para novos usuários (padrão: 30 dias).
              </span>
            </div>
          </div>

          {/* Super Admin Emails List */}
          <div className="pt-4 border-t border-slate-100">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
              E-mails com Permissão de Super Usuário (Acesso Irrestrito)
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="email"
                placeholder="novo.admin@gmail.com"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
              />
              <button
                type="button"
                onClick={handleAddAdminEmail}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {formData.superAdminEmails.map((adm) => (
                <div
                  key={adm}
                  className="px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 flex items-center gap-2"
                >
                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                  <span>{adm}</span>
                  {adm !== 'osaiasbrito@gmail.com' && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAdminEmail(adm)}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            {saveSuccess && (
              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Configurações salvas com sucesso!
              </span>
            )}
            {!saveSuccess && <span />}

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: CONFIGURAÇÃO DE GATEWAYS & CONEXÃO COM BANCOS (MERCADO PAGO E STONE) */}
      {activeTab === 'gateways' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* PIX Direto Config */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Chave PIX Direta (Recebimento Imediato no seu Banco)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Gera QR Code dinâmico e código Pix Copia e Cola padrão oficial do Banco Central.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.pixDirectEnabled}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, pixDirectEnabled: e.target.checked }))
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tipo de Chave PIX
                </label>
                <select
                  value={formData.pixKeyType}
                  onChange={(e: any) =>
                    setFormData((prev) => ({ ...prev, pixKeyType: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="EMAIL">E-mail</option>
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                  <option value="PHONE">Telefone / Celular</option>
                  <option value="RANDOM">Chave Aleatória (EVP)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Chave PIX
                </label>
                <input
                  type="text"
                  placeholder="osaiasbrito@gmail.com ou CPF/CNPJ"
                  value={formData.pixKey}
                  onChange={(e) => setFormData((prev) => ({ ...prev, pixKey: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nome do Titular / Beneficiário
                </label>
                <input
                  type="text"
                  placeholder="Nome Completo ou Razão Social"
                  value={formData.pixBeneficiaryName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, pixBeneficiaryName: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Cidade do Titular
                </label>
                <input
                  type="text"
                  placeholder="Ex: SAO PAULO"
                  value={formData.pixCity}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, pixCity: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nome do Banco
                </label>
                <input
                  type="text"
                  placeholder="Ex: Nubank / Itaú / Stone / Mercado Pago"
                  value={formData.pixBankName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, pixBankName: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Mercado Pago Integration */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Conexão Mercado Pago (Cartão de Crédito & PIX Automatizado)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Receba pagamentos com liberação instantânea direto na sua conta Mercado Pago.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.mercadoPagoEnabled}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, mercadoPagoEnabled: e.target.checked }))
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Public Key (Chave Pública)
                </label>
                <input
                  type="text"
                  placeholder="APP_USR-xxxxxx-xxxx ou TEST-xxxx"
                  value={formData.mercadoPagoPublicKey}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, mercadoPagoPublicKey: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Access Token (Chave Privada de Acesso)
                </label>
                <input
                  type="password"
                  placeholder="APP_USR-xxxxxx-xxxxxx-xxxx"
                  value={formData.mercadoPagoAccessToken}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, mercadoPagoAccessToken: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono"
                />
              </div>
            </div>

            <div className="mt-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-between text-xs text-blue-900">
              <span>Obtenha suas credenciais no painel oficial do Mercado Pago Developers.</span>
              <a
                href="https://www.mercadopago.com.br/developers/panel/credentials"
                target="_blank"
                rel="noreferrer"
                className="font-bold text-blue-700 hover:underline flex items-center gap-1"
              >
                <span>Acessar Painel Mercado Pago</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Stone / Pagar.me Integration */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Conexão Stone (Conta Digital & Gateway Pagar.me)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Receba pagamentos com a infraestrutura bancária da Stone.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.stoneEnabled}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, stoneEnabled: e.target.checked }))
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Merchant ID / Stone Code
                </label>
                <input
                  type="text"
                  placeholder="Código de estabelecimento Stone / Pagar.me"
                  value={formData.stoneMerchantId}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, stoneMerchantId: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Stone / Pagar.me Secret API Key
                </label>
                <input
                  type="password"
                  placeholder="sk_test_xxxx ou sk_live_xxxx"
                  value={formData.stoneApiKey}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, stoneApiKey: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
            {saveSuccess && (
              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Conexões bancárias salvas com sucesso!
              </span>
            )}
            {!saveSuccess && <span />}

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Salvando...' : 'Salvar Conexões Bancárias'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: EXTRATO DE PAGAMENTOS */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Histórico de Pagamentos Recebidos
            </h2>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
              Total Faturado: {formatCurrency(totalRevenue)}
            </span>
          </div>

          {paymentsList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Nenhum pagamento registrado ainda. Assim que os usuários realizarem o pagamento via PIX ou Cartão, os registros aparecerão aqui em tempo real.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Usuário</th>
                    <th className="py-3 px-4">Método / Gateway</th>
                    <th className="py-3 px-4">Transação</th>
                    <th className="py-3 px-4">Valor</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentsList.map((pmt) => (
                    <tr key={pmt.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-slate-600">
                        {pmt.createdAt ? formatDateBR(pmt.createdAt.split('T')[0]) : '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{pmt.userName || 'Usuário'}</span>
                          <span className="text-[11px] text-slate-400">{pmt.userEmail}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-800 font-bold text-[10px]">
                          {pmt.method} ({pmt.gateway})
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {pmt.transactionId}
                      </td>
                      <td className="py-3.5 px-4 font-black text-emerald-600">
                        {formatCurrency(pmt.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          Aprovado & Liberado
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: BANCO DE DADOS POSTGRESQL */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-600" />
                  Conexão Direta com Banco PostgreSQL (Supabase)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Gerenciador e monitoramento de conexão exclusiva com o banco relacional PostgreSQL (Supabase Cloud).
                </p>
              </div>

              <button
                onClick={checkDb}
                disabled={checkingDb}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${checkingDb ? 'animate-spin' : ''}`} />
                <span>{checkingDb ? 'Testando Conexão...' : 'Testar Conexão'}</span>
              </button>
            </div>

            {/* Status Card */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Motor de Banco
                </span>
                <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  PostgreSQL (Supabase Cloud)
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Super Usuário Autorizado
                </span>
                <span className="text-sm font-black text-emerald-600">
                  osaiasbrito@gmail.com
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  ORM & Camada de Acesso
                </span>
                <span className="text-sm font-black text-slate-900">
                  Drizzle ORM + PG Driver
                </span>
              </div>
            </div>

            {dbHealth && (
              <div
                className={`p-4 rounded-2xl border text-xs font-semibold space-y-2 transition-all ${
                  dbHealth.status === 'ok' || dbHealth.connected === true
                    ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50/90 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  {dbHealth.status === 'ok' || dbHealth.connected === true ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                      <span>Conexão ativa e operando com sucesso!</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
                      <span>Falha na conexão com o banco de dados</span>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                  <div className="bg-white/80 p-2 rounded-xl border border-slate-200/60">
                    <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Status</span>
                    <span className="font-bold text-emerald-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      ONLINE
                    </span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-slate-200/60">
                    <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Latência / Ping</span>
                    <span className="font-bold text-slate-800">{dbHealth.latencyMs ? `${dbHealth.latencyMs} ms` : '< 50 ms'}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-slate-200/60">
                    <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Banco Conectado</span>
                    <span className="font-bold text-slate-800">{dbHealth.database || 'postgres'}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-slate-200/60">
                    <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Último Teste</span>
                    <span className="font-bold text-slate-800">
                      {dbHealth.timestamp ? new Date(dbHealth.timestamp).toLocaleTimeString('pt-BR') : new Date().toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                </div>

                {dbHealth.version && (
                  <p className="text-[10px] text-slate-500 font-mono truncate pt-1">
                    Versão: {dbHealth.version}
                  </p>
                )}

                {dbHealth.error && (
                  <p className="text-xs text-rose-700 bg-rose-100/70 p-2.5 rounded-xl font-mono">
                    Detalhes do erro: {dbHealth.error}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Tables Overview */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-slate-700" />
              Tabelas Ativas no PostgreSQL
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[
                { name: 'users', label: 'Usuários & Super Usuário', icon: Users },
                { name: 'user_settings', label: 'Configurações de Usuário', icon: Sliders },
                { name: 'salaries', label: 'Salários & Rendimentos', icon: DollarSign },
                { name: 'extra_incomes', label: 'Rendas Extras Avulsas', icon: TrendingUp },
                { name: 'expenses', label: 'Despesas & Lançamentos', icon: Receipt },
                { name: 'credit_cards', label: 'Cartões de Crédito', icon: CreditCard },
                { name: 'payment_methods', label: 'Métodos de Pagamento', icon: Check },
                { name: 'installment_purchases', label: 'Compras Parceladas', icon: Clock },
                { name: 'categories', label: 'Categorias do Usuário', icon: Sparkles },
                { name: 'budgets', label: 'Orçamentos Mensais', icon: Crown },
                { name: 'backups', label: 'Cópias de Segurança', icon: Database },
              ].map((t) => {
                const IconComponent = t.icon;
                return (
                  <div key={t.name} className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/70 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                      <IconComponent className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="font-mono font-bold text-xs text-slate-900">{t.name}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 block leading-tight">{t.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
