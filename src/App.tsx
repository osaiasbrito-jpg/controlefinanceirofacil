import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { SalariesView } from './components/SalariesView';
import { IncomesView } from './components/IncomesView';
import { ExpensesView } from './components/ExpensesView';
import { CardsView } from './components/CardsView';
import { InstallmentsView } from './components/InstallmentsView';
import { CategoriesView } from './components/CategoriesView';
import { ReportsView } from './components/ReportsView';
import { BackupView } from './components/BackupView';
import { SettingsView } from './components/SettingsView';
import { SuperAdminView } from './components/SuperAdminView';
import { LoginView } from './components/LoginView';
import { BottomNav } from './components/BottomNav';

// Modals
import { ExpenseModal } from './components/modals/ExpenseModal';
import { SalaryModal } from './components/modals/SalaryModal';
import { IncomeModal } from './components/modals/IncomeModal';
import { CardModal } from './components/modals/CardModal';
import { CategoryModal } from './components/modals/CategoryModal';
import { ConfirmDeleteModal } from './components/modals/ConfirmDeleteModal';
import { PaymentUnlockModal } from './components/modals/PaymentUnlockModal';
import { ImportExcelModal } from './components/modals/ImportExcelModal';

import { ActiveTab, Expense, Salary, ExtraIncome, CreditCard } from './types';
import { Clock, Crown, Lock, Sparkles, AlertCircle } from 'lucide-react';
import { formatCurrency } from './utils/formatters';

const MainLayout: React.FC = () => {
  const {
    currentUser,
    isDemoUser,
    loading,
    isSuperAdmin,
    accessStatus,
    trialDaysLeft,
    isLifetimeActive,
    isDataEntryBlocked,
    gatewaySettings,
  } = useAuth();

  const {
    deleteExpense,
    deleteSalary,
    deleteIncome,
    deleteCard,
    deleteInstallmentPurchase,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Modal States
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | undefined>(undefined);

  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [salaryToEdit, setSalaryToEdit] = useState<Salary | undefined>(undefined);

  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [incomeToEdit, setIncomeToEdit] = useState<ExtraIncome | undefined>(undefined);

  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<CreditCard | undefined>(undefined);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [importExcelModalOpen, setImportExcelModalOpen] = useState(false);

  // Delete confirmation modal state
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    isInstallment?: boolean;
    isInstallmentChoice?: boolean;
    installmentDetails?: {
      currentNumber?: number;
      total?: number;
      title?: string;
    };
    selectedCount?: number;
    hasInstallmentsInSelection?: boolean;
    onConfirm: (deleteAllInstallments?: boolean) => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: async () => {},
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold tracking-wider text-slate-300">
            Carregando Meu Controle Financeiro...
          </span>
        </div>
      </div>
    );
  }

  // Not logged in and not in demo mode -> Show Login Screen
  if (!currentUser && !isDemoUser) {
    return <LoginView />;
  }

  // Helper trigger handlers
  const handleOpenExpenseModal = (expense?: Expense) => {
    if (isDataEntryBlocked) {
      setPaymentModalOpen(true);
      return;
    }
    setExpenseToEdit(expense);
    setExpenseModalOpen(true);
  };

  const handleOpenSalaryModal = (salary?: Salary) => {
    if (isDataEntryBlocked) {
      setPaymentModalOpen(true);
      return;
    }
    setSalaryToEdit(salary);
    setSalaryModalOpen(true);
  };

  const handleOpenIncomeModal = (income?: ExtraIncome) => {
    if (isDataEntryBlocked) {
      setPaymentModalOpen(true);
      return;
    }
    setIncomeToEdit(income);
    setIncomeModalOpen(true);
  };

  const handleOpenCardModal = (card?: CreditCard) => {
    if (isDataEntryBlocked) {
      setPaymentModalOpen(true);
      return;
    }
    setCardToEdit(card);
    setCardModalOpen(true);
  };

  // Delete triggers
  const handleDeleteExpense = (expense: Expense) => {
    const isInstallment = !!(
      expense.isInstallment ||
      expense.installmentPurchaseId ||
      (expense.totalInstallments && expense.totalInstallments > 1)
    );

    if (isInstallment) {
      setDeleteModalState({
        isOpen: true,
        title: 'Excluir Despesa Parcelada',
        description: `Esta despesa faz parte de uma compra parcelada (${expense.installmentNumber || 1}/${expense.totalInstallments || 1}) intitulada "${expense.description}". O que deseja fazer?`,
        isInstallment: true,
        isInstallmentChoice: true,
        installmentDetails: {
          currentNumber: expense.installmentNumber || 1,
          total: expense.totalInstallments || 1,
          title: expense.description,
        },
        onConfirm: async (deleteAll) => {
          if (deleteAll && expense.installmentPurchaseId) {
            await deleteInstallmentPurchase(expense.installmentPurchaseId);
          } else {
            await deleteExpense(expense.id);
          }
          setDeleteModalState((p) => ({ ...p, isOpen: false }));
        },
      });
    } else {
      setDeleteModalState({
        isOpen: true,
        title: 'Excluir Despesa',
        description: `Tem certeza que deseja excluir permanentemente "${expense.description}" do banco de dados?`,
        isInstallment: false,
        onConfirm: async () => {
          await deleteExpense(expense.id);
          setDeleteModalState((p) => ({ ...p, isOpen: false }));
        },
      });
    }
  };

  const handleDeleteSalary = (salary: Salary) => {
    setDeleteModalState({
      isOpen: true,
      title: 'Excluir Salário',
      description: `Tem certeza que deseja excluir este salário de ${salary.referenceMonth}?`,
      onConfirm: async () => {
        await deleteSalary(salary.id);
        setDeleteModalState((p) => ({ ...p, isOpen: false }));
      },
    });
  };

  const handleDeleteIncome = (income: ExtraIncome) => {
    setDeleteModalState({
      isOpen: true,
      title: 'Excluir Renda Extra',
      description: `Tem certeza que deseja excluir a renda extra "${income.description}"?`,
      onConfirm: async () => {
        await deleteIncome(income.id);
        setDeleteModalState((p) => ({ ...p, isOpen: false }));
      },
    });
  };

  const handleDeleteCard = (card: CreditCard) => {
    setDeleteModalState({
      isOpen: true,
      title: 'Excluir Cartão',
      description: `Tem certeza que deseja excluir o cartão "${card.name}"? As despesas vinculadas a ele serão mantidas no histórico.`,
      onConfirm: async () => {
        await deleteCard(card.id);
        setDeleteModalState((p) => ({ ...p, isOpen: false }));
      },
    });
  };

  const handleDeleteInstallmentPurchase = (purchaseId: string) => {
    setDeleteModalState({
      isOpen: true,
      title: 'Excluir Compra Parcelada',
      description: 'Deseja excluir esta compra parcelada e todas as suas parcelas de todos os meses?',
      onConfirm: async () => {
        await deleteInstallmentPurchase(purchaseId);
        setDeleteModalState((p) => ({ ...p, isOpen: false }));
      },
    });
  };

  return (
    <div className="flex h-screen w-screen bg-[#F1F5F9] font-sans text-slate-900 overflow-hidden select-none">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenPaymentModal={() => setPaymentModalOpen(true)}
        onOpenImportExcel={() => setImportExcelModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Status Notification Banner for Trial or Expired State */}
        {!isSuperAdmin && !isLifetimeActive && (
          <div
            className={`py-2 px-4 sm:px-8 text-xs font-medium flex flex-wrap items-center justify-between gap-2 border-b shrink-0 ${
              isDataEntryBlocked
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-emerald-900 text-white border-emerald-950'
            }`}
          >
            <div className="flex items-center gap-2">
              {isDataEntryBlocked ? (
                <>
                  <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    <strong>Seu período de teste de 30 dias expirou.</strong> Novos lançamentos estão temporariamente bloqueados.
                  </span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Você está no período de teste gratuito: <strong>{trialDaysLeft} dias restantes</strong> para testar sem restrições.
                  </span>
                </>
              )}
            </div>

            <button
              onClick={() => setPaymentModalOpen(true)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 ${
                isDataEntryBlocked
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Liberar Acesso Vitalício ({formatCurrency(gatewaySettings.lifetimePrice)})</span>
            </button>
          </div>
        )}

        <div className="p-3 sm:p-6 lg:p-8 pb-28 lg:pb-8 flex flex-col h-full overflow-y-auto">
          {/* Top Header with Month Navigator & Actions */}
          <Header
            onOpenExpenseModal={() => handleOpenExpenseModal()}
            onOpenIncomeModal={() => handleOpenIncomeModal()}
            onOpenSalaryModal={() => handleOpenSalaryModal()}
            onOpenImportExcel={() => setImportExcelModalOpen(true)}
            onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />

          {/* Active View Container */}
          <div className="mt-3 sm:mt-4 flex-1">
            {activeTab === 'dashboard' && (
              <DashboardView
                onNavigateTab={setActiveTab}
                onOpenExpenseModal={() => handleOpenExpenseModal()}
                onEditExpense={handleOpenExpenseModal}
                onDeleteExpense={handleDeleteExpense}
                onOpenCardModal={() => handleOpenCardModal()}
              />
            )}

            {activeTab === 'receitas' && (
              <div className="flex flex-col gap-6">
                <SalariesView
                  onOpenSalaryModal={handleOpenSalaryModal}
                  onDeleteSalary={handleDeleteSalary}
                />
                <IncomesView
                  onOpenIncomeModal={handleOpenIncomeModal}
                  onDeleteIncome={handleDeleteIncome}
                />
              </div>
            )}

            {activeTab === 'salario' && (
              <SalariesView
                onOpenSalaryModal={handleOpenSalaryModal}
                onDeleteSalary={handleDeleteSalary}
              />
            )}

            {activeTab === 'renda-extra' && (
              <IncomesView
                onOpenIncomeModal={handleOpenIncomeModal}
                onDeleteIncome={handleDeleteIncome}
              />
            )}

            {activeTab === 'despesas' && (
              <ExpensesView
                onOpenExpenseModal={handleOpenExpenseModal}
                onDeleteExpense={handleDeleteExpense}
                onOpenImportExcel={() => setImportExcelModalOpen(true)}
              />
            )}

            {activeTab === 'cartoes' && (
              <CardsView
                onOpenCardModal={handleOpenCardModal}
                onDeleteCard={handleDeleteCard}
              />
            )}

            {activeTab === 'parcelamentos' && (
              <InstallmentsView
                onOpenExpenseModal={() => handleOpenExpenseModal()}
                onDeleteInstallmentPurchase={handleDeleteInstallmentPurchase}
                onOpenImportExcel={() => setImportExcelModalOpen(true)}
              />
            )}

            {activeTab === 'categorias' && (
              <CategoriesView
                onOpenCategoryModal={() => setCategoryModalOpen(true)}
              />
            )}

            {activeTab === 'relatorios' && <ReportsView />}

            {activeTab === 'backup' && <BackupView onOpenImportExcel={() => setImportExcelModalOpen(true)} />}

            {activeTab === 'configuracoes' && <SettingsView />}

            {activeTab === 'super-admin' && <SuperAdminView />}
          </div>
        </div>

        {/* Bottom Navigation for Mobile / Tablets */}
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onOpenExpenseModal={() => handleOpenExpenseModal()}
          onOpenIncomeModal={() => handleOpenIncomeModal()}
          onOpenSalaryModal={() => handleOpenSalaryModal()}
          onOpenCardModal={() => handleOpenCardModal()}
          onOpenImportExcel={() => setImportExcelModalOpen(true)}
        />
      </main>

      {/* Global Modals */}
      <ExpenseModal
        isOpen={expenseModalOpen}
        onClose={() => {
          setExpenseModalOpen(false);
          setExpenseToEdit(undefined);
        }}
        expenseToEdit={expenseToEdit}
      />

      <SalaryModal
        isOpen={salaryModalOpen}
        onClose={() => {
          setSalaryModalOpen(false);
          setSalaryToEdit(undefined);
        }}
        salaryToEdit={salaryToEdit}
      />

      <IncomeModal
        isOpen={incomeModalOpen}
        onClose={() => {
          setIncomeModalOpen(false);
          setIncomeToEdit(undefined);
        }}
        incomeToEdit={incomeToEdit}
      />

      <CardModal
        isOpen={cardModalOpen}
        onClose={() => {
          setCardModalOpen(false);
          setCardToEdit(undefined);
        }}
        cardToEdit={cardToEdit}
      />

      <CategoryModal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalState.isOpen}
        title={deleteModalState.title}
        description={deleteModalState.description}
        isInstallment={deleteModalState.isInstallment || deleteModalState.isInstallmentChoice}
        isInstallmentChoice={deleteModalState.isInstallmentChoice}
        installmentDetails={deleteModalState.installmentDetails}
        selectedCount={deleteModalState.selectedCount}
        hasInstallmentsInSelection={deleteModalState.hasInstallmentsInSelection}
        onConfirm={deleteModalState.onConfirm}
        onClose={() => setDeleteModalState((p) => ({ ...p, isOpen: false }))}
      />

      <PaymentUnlockModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        reason={isDataEntryBlocked ? 'expired' : 'voluntary'}
      />

      <ImportExcelModal
        isOpen={importExcelModalOpen}
        onClose={() => setImportExcelModalOpen(false)}
      />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <FinanceProvider>
        <MainLayout />
      </FinanceProvider>
    </AuthProvider>
  );
}

export default App;
