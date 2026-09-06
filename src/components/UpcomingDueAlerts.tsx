import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Bell,
  BellRing,
  Calendar,
  CreditCard,
  ArrowRight,
  Sparkles,
  Check,
  ChevronRight,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency, formatDateBR, getMonthName } from '../utils/formatters';
import { Expense, ActiveTab } from '../types';

interface UpcomingDueAlertsProps {
  onNavigateTab?: (tab: ActiveTab) => void;
  onOpenExpenseModal?: (expense?: Expense) => void;
}

export const UpcomingDueAlerts: React.FC<UpcomingDueAlertsProps> = ({
  onNavigateTab,
  onOpenExpenseModal,
}) => {
  const { expenses, toggleExpenseStatus, creditCards } = useFinance();
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [permissionPromptStatus, setPermissionPromptStatus] = useState<string | null>(null);

  // Check browser Notification support on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission('unsupported');
    }
  }, []);

  // Calculate today and target dates (next 3 days)
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const getDaysDiff = (dateString: string) => {
    if (!dateString) return 999;
    const [year, month, day] = dateString.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - todayDate.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  // Filter pending expenses due in <= 3 days (including overdue)
  const alertExpenses = React.useMemo(() => {
    return expenses
      .filter((e) => e.status === 'PENDENTE' && e.date)
      .map((e) => {
        const daysDiff = getDaysDiff(e.date);
        return {
          ...e,
          daysDiff,
        };
      })
      .filter((e) => e.daysDiff <= 3) // overdue (daysDiff < 0) or due in 0, 1, 2, 3 days
      .sort((a, b) => a.daysDiff - b.daysDiff);
  }, [expenses]);

  const overdueCount = alertExpenses.filter((e) => e.daysDiff < 0).length;
  const todayCount = alertExpenses.filter((e) => e.daysDiff === 0).length;
  const next3DaysCount = alertExpenses.filter((e) => e.daysDiff > 0 && e.daysDiff <= 3).length;
  const totalAlertSum = alertExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // Handle Request Notification Permission & trigger reminder
  const handleEnablePushNotifications = async () => {
    if (!('Notification' in window)) {
      alert('Seu navegador não possui suporte para notificações push na web.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted') {
        setPermissionPromptStatus('Notificações ativadas com sucesso!');
        // Send a test notification if there are upcoming expenses
        if (alertExpenses.length > 0) {
          const topExpense = alertExpenses[0];
          new Notification('Meu Controle Financeiro 🔔', {
            body: `Atenção: Você tem ${alertExpenses.length} despesa(s) vencendo em breve. Próxima: ${topExpense.description} (${formatCurrency(topExpense.amount)}).`,
            icon: '/icon-192.png',
          });
        } else {
          new Notification('Meu Controle Financeiro 🔔', {
            body: 'Notificações ativadas! Você será avisado sempre que houver despesas prestes a vencer.',
            icon: '/icon-192.png',
          });
        }
      } else {
        setPermissionPromptStatus('Permissão para notificações não foi autorizada.');
      }
    } catch (err) {
      console.error('Erro ao solicitar permissão de notificações:', err);
    }
  };

  const getDueBadge = (daysDiff: number) => {
    if (daysDiff < 0) {
      const days = Math.abs(daysDiff);
      return (
        <span className="px-2.5 py-1 rounded-xl bg-rose-100 text-rose-800 text-[10px] font-extrabold border border-rose-200 flex items-center gap-1 shrink-0 animate-pulse">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          Vencida há {days} {days === 1 ? 'dia' : 'dias'}
        </span>
      );
    }
    if (daysDiff === 0) {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 text-[10px] font-black border border-amber-600 flex items-center gap-1 shrink-0 animate-pulse shadow-xs">
          <Clock className="w-3 h-3 text-slate-950" />
          Vence Hoje!
        </span>
      );
    }
    if (daysDiff === 1) {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 text-[10px] font-extrabold border border-amber-300 flex items-center gap-1 shrink-0">
          <Clock className="w-3 h-3 text-amber-700" />
          Vence Amanhã
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-xl bg-sky-100 text-sky-800 text-[10px] font-extrabold border border-sky-200 flex items-center gap-1 shrink-0">
        <Calendar className="w-3 h-3 text-sky-600" />
        Vence em {daysDiff} dias
      </span>
    );
  };

  // If there are no alerts at all, show a clean, reassuring status card
  if (alertExpenses.length === 0) {
    return (
      <div
        id="dashboard-upcoming-alerts-clean"
        className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold border border-emerald-100 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-extrabold text-slate-900">
                Tudo em Dia nos Próximos 3 Dias!
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200">
                0 Pendências Imediatas
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Nenhuma despesa pendente com vencimento para hoje ou para os próximos 3 dias.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
            <button
              onClick={handleEnablePushNotifications}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Receber alertas push no navegador"
            >
              <Bell className="w-3.5 h-3.5 text-slate-500" />
              <span>Ativar Alertas Push</span>
            </button>
          )}
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('despesas')}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>Ver Todas as Despesas</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      id="dashboard-upcoming-alerts-card"
      className="bg-white rounded-3xl border border-amber-200/90 shadow-sm overflow-hidden transition-all"
    >
      {/* Alert Header Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500 via-amber-600 to-rose-600 text-slate-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-slate-950 text-amber-400 flex items-center justify-center font-bold shadow-md shrink-0">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-white text-base tracking-tight">
                Alertas de Vencimento
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-950 text-amber-300 font-extrabold text-[10px] border border-amber-400/30">
                {alertExpenses.length} {alertExpenses.length === 1 ? 'pendência' : 'pendências'}
              </span>
              {overdueCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 font-black text-[10px] border border-rose-400/30 animate-pulse">
                  {overdueCount} vencida{overdueCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-amber-100 mt-0.5 font-medium">
              Total a pagar neste período: <strong className="text-white font-black">{formatCurrency(totalAlertSum)}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
            <button
              onClick={handleEnablePushNotifications}
              className="px-3.5 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-950 text-amber-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Ativar notificações push no navegador"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Notificações</span>
            </button>
          )}

          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('despesas')}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-amber-50 text-slate-950 text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
            >
              <span>Ver na Tela de Despesas</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {permissionPromptStatus && (
        <div className="px-5 py-2 bg-emerald-50 border-b border-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <Info className="w-4 h-4 text-emerald-600" />
          <span>{permissionPromptStatus}</span>
        </div>
      )}
    </div>
  );
};
