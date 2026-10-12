import React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Briefcase,
  PlusCircle,
  Receipt,
  CreditCard as CardIcon,
  Layers,
  Tag,
  BarChart3,
  Database,
  Settings,
  User,
  LogOut,
  Sparkles,
  Crown,
  Clock,
  Lock,
  FileSpreadsheet,
} from 'lucide-react';
import { ActiveTab } from '../types';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenPaymentModal?: () => void;
  onOpenImportExcel?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpenMobile,
  onCloseMobile,
  onOpenPaymentModal,
  onOpenImportExcel,
}) => {
  const {
    userProfile,
    currentUser,
    signOut,
    isDemoUser,
    isSuperAdmin,
    accessStatus,
    trialDaysLeft,
    isLifetimeActive,
  } = useAuth();

  const navItems: { id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'receitas', label: 'Receitas', icon: TrendingUp },
    { id: 'salario', label: 'Salário', icon: Briefcase },
    { id: 'renda-extra', label: 'Renda Extra', icon: PlusCircle },
    { id: 'despesas', label: 'Despesas', icon: Receipt },
    { id: 'cartoes', label: 'Cartões e Outros Tipos', icon: CardIcon },
    { id: 'parcelamentos', label: 'Parcelamentos', icon: Layers },
    { id: 'categorias', label: 'Categorias', icon: Tag },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
    { id: 'backup', label: 'Backup & Restauro', icon: Database },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  if (isSuperAdmin) {
    navItems.push({ id: 'super-admin', label: 'Painel Super Usuário', icon: Crown });
  }

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    onCloseMobile();
  };

  const displayName = userProfile?.displayName || currentUser?.displayName || 'Usuário';
  const email = userProfile?.email || currentUser?.email || '';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      <nav
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200/80 flex flex-col p-5 h-full shrink-0 transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Logo */}
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md shadow-emerald-200 shrink-0">
            M
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-slate-900 text-base tracking-tight leading-tight">
              Meu Controle
            </span>
            <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
              Financeiro
            </span>
          </div>
        </div>

        {/* User Status Badges */}
        {isSuperAdmin && (
          <div className="mb-3 px-3 py-2 bg-slate-900 text-white rounded-xl flex items-center gap-2 text-[11px] font-bold shadow-xs">
            <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Super Usuário (Acesso Total)</span>
          </div>
        )}

        {!isSuperAdmin && isLifetimeActive && (
          <div className="mb-3 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 text-[11px] font-bold">
            <Crown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Acesso Vitalício Liberado</span>
          </div>
        )}

        {!isSuperAdmin && !isLifetimeActive && accessStatus === 'trial' && (
          <div className="mb-3 p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex flex-col gap-1.5 text-[11px]">
            <div className="flex items-center justify-between text-blue-900 font-bold">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-600" /> Teste Grátis
              </span>
              <span className="text-blue-700">{trialDaysLeft} dias</span>
            </div>
            {onOpenPaymentModal && (
              <button
                onClick={onOpenPaymentModal}
                className="w-full py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
              >
                Liberar Vitalício
              </button>
            )}
          </div>
        )}

        {!isSuperAdmin && !isLifetimeActive && accessStatus === 'expired' && (
          <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex flex-col gap-1.5 text-[11px]">
            <div className="flex items-center gap-1 text-rose-900 font-bold">
              <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>Teste Expirado</span>
            </div>
            <p className="text-[10px] text-rose-700 leading-tight">
              Lançamentos bloqueados após 30 dias.
            </p>
            {onOpenPaymentModal && (
              <button
                onClick={onOpenPaymentModal}
                className="w-full py-1.5 px-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                Pagar Taxa & Liberar
              </button>
            )}
          </div>
        )}

        {isDemoUser && (
          <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-800 text-[11px] font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Modo Demonstração</span>
          </div>
        )}

        {/* Navigation Items */}
        <div className="flex flex-col gap-1 flex-1 overflow-y-auto pr-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isSuperItem = item.id === 'super-admin';
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full px-3.5 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-3 transition-all text-left ${
                  isActive
                    ? isSuperItem
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-700 shadow-xs'
                    : isSuperItem
                    ? 'text-amber-700 bg-amber-50/50 hover:bg-amber-100/70'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive
                      ? isSuperItem
                        ? 'text-amber-400'
                        : 'text-emerald-600'
                      : isSuperItem
                      ? 'text-amber-600'
                      : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Action button for Excel Import */}
        {onOpenImportExcel && (
          <button
            id="sidebar-import-excel-btn"
            onClick={() => {
              onOpenImportExcel();
              onCloseMobile();
            }}
            className="my-2 w-full px-3.5 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between transition-all shadow-2xs group cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col text-left leading-tight">
                <span>Transferir Planilha</span>
                <span className="text-[10px] text-emerald-600 font-medium">Excel (.xlsx)</span>
              </div>
            </div>
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all" />
          </button>
        )}

        {/* User Card & Logout */}
        <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-2">
          <div className="flex items-center gap-3 px-1 py-1">
            {userProfile?.photoURL ? (
              <img
                src={userProfile.photoURL}
                alt={displayName}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-xs shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-bold text-slate-800 truncate">{displayName}</span>
              <span className="text-[10px] text-slate-400 truncate">{email}</span>
            </div>
          </div>

          <button
            onClick={() => signOut()}
            className="w-full mt-1 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold text-xs flex items-center justify-center gap-2 transition-colors border border-rose-100 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair do sistema</span>
          </button>
        </div>
      </nav>
    </>
  );
};

