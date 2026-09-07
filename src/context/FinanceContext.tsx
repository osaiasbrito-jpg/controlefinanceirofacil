import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  setDoc,
  getDocs,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import {
  Salary,
  ExtraIncome,
  Expense,
  CreditCard,
  InstallmentPurchase,
  Category,
  UserSettings,
  MonthFinancialSummary,
  CardLimitSummary,
  ExpenseFilters,
  BackupData,
  CustomPaymentMethod,
  PaymentMethod,
  MonthInstallmentsAndSingleSummary,
} from '../types';
import { DEFAULT_CATEGORIES } from '../utils/defaultCategories';
import {
  getCanonicalCardInfo,
  isExpenseMatchingCard,
  isPixExpense,
  isBoletoExpense,
  isDebitExpense,
  isCashExpense,
} from '../utils/cardUtils';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import { getCurrentMonth, getAdjacentMonth } from '../utils/formatters';
import {
  calculateMonthSummary,
  calculateCardLimit,
  generateInstallmentsPlan,
  getEffectiveSalariesForMonth,
  getEffectiveIncomesForMonth,
  calculateMonthInstallmentsAndSingleSummary,
} from '../utils/calculations';
import { ParsedSpreadsheetItem } from '../utils/excelParser';
import { syncDataToPostgres, deleteEntityFromPostgres, loadUserDataFromPostgres } from '../services/api';

// Sanitize object before sending to Firestore to avoid 'undefined' field errors
function sanitizeData<T extends Record<string, any>>(data: T): T {
  const clean: any = {};
  Object.entries(data).forEach(([key, val]) => {
    if (val !== undefined) {
      clean[key] = val;
    }
  });
  return clean;
}

interface FinanceContextType {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToCurrentMonth: () => void;

  salaries: Salary[];
  effectiveSalariesForMonth: Salary[];
  incomes: ExtraIncome[];
  effectiveIncomesForMonth: ExtraIncome[];
  expenses: Expense[];
  creditCards: CreditCard[];
  paymentMethods: CustomPaymentMethod[];
  installmentPurchases: InstallmentPurchase[];
  categories: Category[];
  settings: UserSettings | null;

  monthSummary: MonthFinancialSummary;
  cardLimitSummaries: CardLimitSummary[];
  monthInstallmentsAndSingleSummary: MonthInstallmentsAndSingleSummary;
  loading: boolean;
  error: string | null;

  // CRUD Operations
  addSalary: (data: Omit<Salary, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateSalary: (id: string, data: Partial<Salary>) => Promise<void>;
  deleteSalary: (id: string) => Promise<void>;
  toggleSalaryStatus: (id: string, currentStatus: 'RECEIVED' | 'PENDING') => Promise<void>;
  setDefaultSalary: (data: {
    amount: number;
    payDay?: number;
    description?: string;
    status?: 'RECEIVED' | 'PENDING';
    active?: boolean;
  }) => Promise<void>;

  addIncome: (data: Omit<ExtraIncome, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateIncome: (id: string, data: Partial<ExtraIncome>) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  toggleIncomeStatus: (id: string, currentStatus: 'RECEIVED' | 'PENDING') => Promise<void>;

  addExpense: (data: Omit<Expense, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateExpense: (id: string, data: Partial<Expense>, updateAllInstallments?: boolean) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  deleteMultipleExpenses: (
    expenseIds: string[],
    deleteAllLinkedInstallments?: boolean
  ) => Promise<{ deletedExpensesCount: number; deletedInstallmentsCount: number }>;
  updateMultipleExpensesStatus: (
    expenseIds: string[],
    targetStatus: 'PAGA' | 'PENDENTE'
  ) => Promise<void>;
  toggleExpenseStatus: (id: string, currentStatus: 'PAGA' | 'PENDENTE') => Promise<void>;

  addCreditCard: (data: Omit<CreditCard, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateCreditCard: (id: string, data: Partial<CreditCard>) => Promise<void>;
  deleteCreditCard: (id: string) => Promise<void>;

  // Payment Methods (Outros Tipos) CRUD
  addPaymentMethod: (data: Omit<CustomPaymentMethod, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updatePaymentMethod: (id: string, data: Partial<CustomPaymentMethod>) => Promise<void>;
  deletePaymentMethod: (id: string) => Promise<void>;

  // Batch Status Operations
  markAllCardExpensesStatus: (
    cardCanonicalId: string,
    cardCanonicalName: string,
    targetStatus: 'PAGA' | 'PENDENTE',
    month: string
  ) => Promise<void>;
  markAllMethodExpensesStatus: (
    method: PaymentMethod | string,
    targetStatus: 'PAGA' | 'PENDENTE',
    month: string
  ) => Promise<void>;

  createInstallmentPurchase: (
    purchaseData: {
      title: string;
      totalAmount: number;
      installmentCount: number;
      startMonth: string;
      cardId: string;
      cardName?: string;
      categoryId: string;
      categoryName: string;
      defaultDay?: number;
      isIndefinite?: boolean;
      monthlyAmount?: number;
    }
  ) => Promise<string>;
  extendIndefinitePurchase: (
    purchaseId: string,
    additionalMonths: 3 | 6,
    newMonthlyAmount?: number
  ) => Promise<void>;
  deleteInstallmentPurchase: (purchaseId: string, deleteOnlyExpenseId?: string) => Promise<void>;
  interruptInstallmentPurchase: (purchaseId: string, stopFromMonth?: string) => Promise<void>;

  addCategory: (data: Omit<Category, 'id' | 'userId'>) => Promise<string>;
  deleteCategory: (id: string) => Promise<void>;

  updateSettings: (data: Partial<UserSettings>) => Promise<void>;

  filters: ExpenseFilters;
  setFilters: React.Dispatch<React.SetStateAction<ExpenseFilters>>;
  resetFilters: () => void;
  filteredExpenses: Expense[];

  exportBackupData: () => BackupData;
  importBackupData: (data: BackupData) => Promise<{ success: boolean; message: string; count: number }>;
  importSpreadsheetData: (items: ParsedSpreadsheetItem[]) => Promise<{
    success: boolean;
    expensesCount: number;
    installmentsCount: number;
    incomesCount: number;
    salariesCount: number;
    totalCreated: number;
    message: string;
  }>;
  loadSampleDemoData: () => Promise<void>;
  refreshDataFromPostgres?: () => Promise<void>;
}

export const DEFAULT_PAYMENT_METHODS: Omit<CustomPaymentMethod, 'userId'>[] = [
  {
    id: 'default-pm-pix',
    name: 'Pix',
    type: 'PIX',
    details: 'Chave Pix Instantâneo',
    color: '#0D9488',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'default-pm-boleto',
    name: 'Boleto Bancário',
    type: 'BOLETO',
    details: 'Código de barras / DDA',
    color: '#D97706',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'default-pm-debito',
    name: 'Cartão de Débito',
    type: 'CARTAO_DEBITO',
    details: 'Débito em conta corrente',
    color: '#2563EB',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'default-pm-dinheiro',
    name: 'Dinheiro em Espécie',
    type: 'DINHEIRO',
    details: 'Carteira Física / Dinheiro Vivo',
    color: '#059669',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const defaultFilters: ExpenseFilters = {
  searchQuery: '',
  referenceMonth: 'SELECTED',
  year: 'ALL',
  categoryId: 'ALL',
  paymentMethod: 'ALL',
  cardId: 'ALL',
  status: 'ALL',
};

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, isDemoUser, isDataEntryBlocked } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());

  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [incomes, setIncomes] = useState<ExtraIncome[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<CustomPaymentMethod[]>([]);
  const [installmentPurchases, setInstallmentPurchases] = useState<InstallmentPurchase[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ExpenseFilters>(defaultFilters);

  // Month navigation
  const goToPreviousMonth = useCallback(() => {
    setSelectedMonth((prev) => getAdjacentMonth(prev, -1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setSelectedMonth((prev) => getAdjacentMonth(prev, 1));
  }, []);

  const goToCurrentMonth = useCallback(() => {
    setSelectedMonth(getCurrentMonth());
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  // Demo initial seed data function
  const seedDemoData = useCallback((uid: string) => {
    const curMonth = getCurrentMonth();
    const prevMonth = getAdjacentMonth(curMonth, -1);
    const nextMonth = getAdjacentMonth(curMonth, 1);

    const demoCards: CreditCard[] = [
      {
        id: 'demo-card-1',
        userId: uid,
        name: 'Nubank Ultravioleta',
        bank: 'Nubank',
        totalLimit: 6500,
        closingDay: 10,
        dueDay: 17,
        color: '#8B5CF6',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'demo-card-2',
        userId: uid,
        name: 'XP Visa Infinite',
        bank: 'XP Investimentos',
        totalLimit: 12000,
        closingDay: 5,
        dueDay: 12,
        color: '#0F172A',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const demoSalaries: Salary[] = [
      {
        id: 'demo-sal-1',
        userId: uid,
        amount: 5500,
        referenceMonth: curMonth,
        payDate: `${curMonth}-05`,
        description: 'Salário Mensal - Empresa Principal',
        status: 'RECEIVED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'demo-sal-prev',
        userId: uid,
        amount: 5500,
        referenceMonth: prevMonth,
        payDate: `${prevMonth}-05`,
        description: 'Salário Mensal',
        status: 'RECEIVED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const demoIncomes: ExtraIncome[] = [
      {
        id: 'demo-inc-1',
        userId: uid,
        description: 'Rendimento de FIIs / Aluguel Fixo',
        amount: 650,
        referenceMonth: curMonth,
        date: `${curMonth}-10`,
        origin: 'Rendimento',
        status: 'RECEIVED',
        isRecurring: true,
        recurrenceDay: 10,
        notes: 'Renda mensal fixa recorrente aplicada em todos os meses',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'demo-inc-2',
        userId: uid,
        description: 'Consultoria Web / Projeto React',
        amount: 1400,
        referenceMonth: curMonth,
        date: `${curMonth}-14`,
        origin: 'Freelance',
        status: 'RECEIVED',
        isRecurring: false,
        notes: 'Pagamento pontual deste mês',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'demo-inc-3',
        userId: uid,
        description: 'Venda de Equipamento Usado',
        amount: 450,
        referenceMonth: curMonth,
        date: `${curMonth}-22`,
        origin: 'Venda',
        status: 'PENDING',
        isRecurring: false,
        notes: 'Comprador retirará dia 22',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const demoInstallments: InstallmentPurchase[] = [
      {
        id: 'demo-inst-1',
        userId: uid,
        title: 'Notebook Dell Inspiron',
        totalAmount: 3600,
        installmentCount: 6,
        startMonth: prevMonth,
        cardId: 'demo-card-1',
        categoryId: 'cat-eletronicos',
        categoryName: 'Compras',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const demoExpenses: Expense[] = [
      {
        id: 'demo-exp-1',
        userId: uid,
        description: 'Aluguel do Apartamento',
        amount: 1650,
        date: `${curMonth}-10`,
        referenceMonth: curMonth,
        categoryId: 'cat-moradia',
        categoryName: 'Moradia',
        paymentMethod: 'PIX',
        status: 'PAGA',
        notes: 'Pago via comprovante WhatsApp',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'demo-exp-2',
        userId: uid,
        description: 'Supermercado Mensal Pão de Açúcar',
        amount: 720.5,
        date: `${curMonth}-08`,
        referenceMonth: curMonth,
        categoryId: 'cat-alimentacao',
        categoryName: 'Alimentação',
        paymentMethod: 'CARTAO_DEBITO',
        status: 'PAGA',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'demo-exp-3',
        userId: uid,
        description: 'Energia Elétrica (Enel)',
        amount: 215.3,
        date: `${curMonth}-18`,
        referenceMonth: curMonth,
        categoryId: 'cat-energia',
        categoryName: 'Energia',
        paymentMethod: 'BOLETO',
        status: 'PENDENTE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'demo-exp-4',
        userId: uid,
        description: 'Internet Fibra Óptica 500MB',
        amount: 119.9,
        date: `${curMonth}-20`,
        referenceMonth: curMonth,
        categoryId: 'cat-internet',
        categoryName: 'Internet',
        paymentMethod: 'PIX',
        status: 'PENDENTE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'demo-exp-5',
        userId: uid,
        description: 'Notebook Dell Inspiron (2/6)',
        amount: 600,
        date: `${curMonth}-10`,
        referenceMonth: curMonth,
        categoryId: 'cat-compras',
        categoryName: 'Compras',
        paymentMethod: 'CARTAO_CREDITO',
        cardId: 'demo-card-1',
        isInstallment: true,
        installmentPurchaseId: 'demo-inst-1',
        installmentNumber: 2,
        totalInstallments: 6,
        status: 'PENDENTE',
        notes: 'Parcela 2 de 6 da compra "Notebook Dell Inspiron"',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'demo-exp-6',
        userId: uid,
        description: 'Notebook Dell Inspiron (3/6)',
        amount: 600,
        date: `${nextMonth}-10`,
        referenceMonth: nextMonth,
        categoryId: 'cat-compras',
        categoryName: 'Compras',
        paymentMethod: 'CARTAO_CREDITO',
        cardId: 'demo-card-1',
        isInstallment: true,
        installmentPurchaseId: 'demo-inst-1',
        installmentNumber: 3,
        totalInstallments: 6,
        status: 'PENDENTE',
        notes: 'Parcela 3 de 6 da compra "Notebook Dell Inspiron"',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'demo-exp-7',
        userId: uid,
        description: 'Abastecimento Posto Shell',
        amount: 240,
        date: `${curMonth}-12`,
        referenceMonth: curMonth,
        categoryId: 'cat-combustivel',
        categoryName: 'Combustível',
        paymentMethod: 'CARTAO_CREDITO',
        cardId: 'demo-card-1',
        status: 'PENDENTE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const initialCategories: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({
      id: `default-cat-${i}`,
      ...c,
    }));

    const demoPaymentMethods: CustomPaymentMethod[] = DEFAULT_PAYMENT_METHODS.map((pm) => ({
      ...pm,
      userId: uid,
    }));

    setCreditCards(demoCards);
    setPaymentMethods(demoPaymentMethods);
    setSalaries(demoSalaries);
    setIncomes(demoIncomes);
    setExpenses(demoExpenses);
    setInstallmentPurchases(demoInstallments);
    setCategories(initialCategories);
    setSettings({
      userId: uid,
      theme: 'light',
      currency: 'BRL',
      alertThresholdPercentage: 80,
      emailNotifications: true,
      defaultSalaryAmount: 5500,
      defaultSalaryPayDay: 5,
      defaultSalaryDescription: 'Salário Mensal Base (Padrão)',
      defaultSalaryStatus: 'RECEIVED',
      defaultSalaryActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }, []);

  // Sync Firestore or demo data when user changes
  useEffect(() => {
    if (!currentUser) {
      setSalaries([]);
      setIncomes([]);
      setExpenses([]);
      setCreditCards([]);
      setPaymentMethods([]);
      setInstallmentPurchases([]);
      setCategories(DEFAULT_CATEGORIES.map((c, i) => ({ id: `default-cat-${i}`, ...c })));
      setSettings(null);
      setLoading(false);
      return;
    }

    if (isDemoUser) {
      seedDemoData(currentUser.uid);
      setLoading(false);
      return;
    }

    setLoading(true);
    const uid = currentUser.uid;

    // Subscriptions
    const salariesQuery = query(collection(db, 'salaries'), where('userId', '==', uid));
    const incomesQuery = query(collection(db, 'incomes'), where('userId', '==', uid));
    const expensesQuery = query(collection(db, 'expenses'), where('userId', '==', uid));
    const cardsQuery = query(collection(db, 'creditCards'), where('userId', '==', uid));
    const paymentMethodsQuery = query(collection(db, 'paymentMethods'), where('userId', 'in', [uid, 'default']));
    const installmentsQuery = query(collection(db, 'installmentPurchases'), where('userId', '==', uid));
    const categoriesQuery = query(collection(db, 'categories'), where('userId', 'in', [uid, 'system']));
    const settingsDocRef = doc(db, 'userSettings', uid);

    const unsubSalaries = onSnapshot(
      salariesQuery,
      (snapshot) => {
        const list: Salary[] = [];
        snapshot.forEach((docSnap) => list.push({ id: docSnap.id, ...(docSnap.data() as any) }));
        setSalaries(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'salaries')
    );

    const unsubIncomes = onSnapshot(
      incomesQuery,
      (snapshot) => {
        const list: ExtraIncome[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const refMonth = data.referenceMonth || (data.date ? data.date.substring(0, 7) : '');
          list.push({ id: docSnap.id, ...data, referenceMonth: refMonth });
        });

        // Auto-heal any vacation/ferias registered at the end of August for the upcoming September cycle
        list.forEach(async (item) => {
          const isFerias =
            item.description?.toLowerCase().includes('férias') ||
            item.description?.toLowerCase().includes('ferias') ||
            item.description?.toLowerCase().includes('terço');
          if (isFerias && item.referenceMonth === '2026-08' && item.date?.startsWith('2026-08')) {
            try {
              await updateDoc(doc(db, 'incomes', item.id), {
                referenceMonth: '2026-09',
                date: '2026-09-01',
                origin: item.origin || '1/3 de Férias',
                updatedAt: new Date().toISOString(),
              });
            } catch {
              // Ignore silent update errors
            }
          }
        });

        setIncomes(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'incomes')
    );

    const unsubExpenses = onSnapshot(
      expensesQuery,
      (snapshot) => {
        const list: Expense[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const refMonth = data.referenceMonth || (data.date ? data.date.substring(0, 7) : '');
          list.push({ id: docSnap.id, ...data, referenceMonth: refMonth });
        });
        setExpenses(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'expenses')
    );

    const unsubCards = onSnapshot(
      cardsQuery,
      (snapshot) => {
        const list: CreditCard[] = [];
        snapshot.forEach((docSnap) => list.push({ id: docSnap.id, ...(docSnap.data() as any) }));
        setCreditCards(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'creditCards')
    );

    const unsubPaymentMethods = onSnapshot(
      paymentMethodsQuery,
      (snapshot) => {
        const list: CustomPaymentMethod[] = [];
        snapshot.forEach((docSnap) => list.push({ id: docSnap.id, ...(docSnap.data() as any) }));
        if (list.length === 0) {
          const defaults: CustomPaymentMethod[] = DEFAULT_PAYMENT_METHODS.map((pm) => ({
            ...pm,
            userId: uid,
          }));
          setPaymentMethods(defaults);
        } else {
          setPaymentMethods(list);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'paymentMethods')
    );

    const unsubInstallments = onSnapshot(
      installmentsQuery,
      (snapshot) => {
        const list: InstallmentPurchase[] = [];
        snapshot.forEach((docSnap) => list.push({ id: docSnap.id, ...(docSnap.data() as any) }));
        setInstallmentPurchases(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'installmentPurchases')
    );

    const unsubCategories = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        const list: Category[] = [];
        snapshot.forEach((docSnap) => list.push({ id: docSnap.id, ...(docSnap.data() as any) }));

        // Merge with default system categories if empty
        if (list.length === 0) {
          const defaults = DEFAULT_CATEGORIES.map((c, i) => ({ id: `default-cat-${i}`, ...c }));
          setCategories(defaults);
        } else {
          setCategories(list);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'categories')
    );

    const unsubSettings = onSnapshot(
      settingsDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setSettings(docSnap.data() as UserSettings);
        } else {
          const initialSettings: UserSettings = {
            userId: uid,
            theme: 'light',
            currency: 'BRL',
            alertThresholdPercentage: 80,
            emailNotifications: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setDoc(settingsDocRef, initialSettings).catch((err) =>
            handleFirestoreError(err, OperationType.WRITE, `userSettings/${uid}`)
          );
          setSettings(initialSettings);
        }
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `userSettings/${uid}`);
        setLoading(false);
      }
    );

    return () => {
      unsubSalaries();
      unsubIncomes();
      unsubExpenses();
      unsubCards();
      unsubPaymentMethods();
      unsubInstallments();
      unsubCategories();
      unsubSettings();
    };
  }, [currentUser, isDemoUser, seedDemoData]);

  // Synchronize financial data to PostgreSQL database in background
  useEffect(() => {
    if (!currentUser || isDemoUser) return;

    const timeoutId = setTimeout(async () => {
      try {
        let token: string | undefined;
        try {
          token = await currentUser.getIdToken();
        } catch {
          // Continue without token if expired
        }

        await syncDataToPostgres({
          userId: currentUser.uid,
          salaries,
          incomes,
          expenses,
          creditCards,
          paymentMethods,
          installmentPurchases,
          categories,
          settings,
        }, token);
      } catch (err) {
        console.warn('Erro ao sincronizar com PostgreSQL:', err);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [
    currentUser,
    isDemoUser,
    salaries,
    incomes,
    expenses,
    creditCards,
    paymentMethods,
    installmentPurchases,
    categories,
    settings,
  ]);

  // Sincronização e merge de dados externos inseridos diretamente no PostgreSQL via API de Integração
  const refreshDataFromPostgres = useCallback(async () => {
    if (!currentUser || isDemoUser) return;
    try {
      let token: string | undefined;
      try {
        token = await currentUser.getIdToken();
      } catch {}

      const isOsaias =
        currentUser.email?.toLowerCase() === 'osaiasbrito@gmail.com' ||
        currentUser.uid?.toLowerCase().includes('osaias');
      const targetUserId = isOsaias ? 'osaiasbrito@gmail.com' : (currentUser.uid || 'osaiasbrito@gmail.com');

      const pgData = await loadUserDataFromPostgres(targetUserId, token, currentUser.email || undefined);
      if (!pgData) return;

      // 1. Mesclar Incomes do PostgreSQL (ex: Atendimentos de MASSOTERAPIA)
      if (Array.isArray(pgData.incomes) && pgData.incomes.length > 0) {
        setIncomes((prev) => {
          const map = new Map<string, ExtraIncome>();
          prev.forEach((item) => map.set(item.id, item));
          let hasNew = false;
          pgData.incomes.forEach((pgInc: any) => {
            const formatted: ExtraIncome = {
              id: pgInc.id,
              userId: currentUser.uid || pgInc.userId || 'osaiasbrito@gmail.com',
              description: pgInc.description,
              amount: Number(pgInc.amount),
              referenceMonth: pgInc.referenceMonth || (pgInc.date ? pgInc.date.substring(0, 7) : ''),
              date: pgInc.date,
              origin: pgInc.source || 'MASSOTERAPIA',
              status: pgInc.status === 'PENDING' ? 'PENDING' : 'RECEIVED',
              notes: pgInc.notes || '',
              createdAt: pgInc.createdAt || new Date().toISOString(),
              updatedAt: pgInc.updatedAt || new Date().toISOString(),
            };

            if (!map.has(pgInc.id)) {
              map.set(pgInc.id, formatted);
              hasNew = true;
            }

            // Grava com segurança no Firestore do cliente autenticado
            if (db && currentUser) {
              setDoc(doc(db, 'incomes', pgInc.id), sanitizeData(formatted), { merge: true }).catch(() => {});
            }
          });
          return hasNew ? Array.from(map.values()) : prev;
        });
      }

      // 2. Mesclar Salaries do PostgreSQL (ex: Salários de Massoterapia somados ao Salário Fixo)
      if (Array.isArray(pgData.salaries) && pgData.salaries.length > 0) {
        setSalaries((prev) => {
          const map = new Map<string, Salary>();
          prev.forEach((item) => map.set(item.id, item));
          let hasNew = false;
          pgData.salaries.forEach((pgSal: any) => {
            const formatted: Salary = {
              id: pgSal.id,
              userId: currentUser.uid || pgSal.userId || 'osaiasbrito@gmail.com',
              amount: Number(pgSal.amount),
              referenceMonth: pgSal.referenceMonth,
              description: pgSal.description,
              payDate: pgSal.payDate || `${pgSal.referenceMonth || '2026-09'}-05`,
              status: pgSal.status === 'PENDING' ? 'PENDING' : 'RECEIVED',
              createdAt: pgSal.createdAt || new Date().toISOString(),
              updatedAt: pgSal.updatedAt || new Date().toISOString(),
            };

            if (!map.has(pgSal.id)) {
              map.set(pgSal.id, formatted);
              hasNew = true;
            }

            // Grava com segurança no Firestore do cliente autenticado
            if (db && currentUser) {
              setDoc(doc(db, 'salaries', pgSal.id), sanitizeData(formatted), { merge: true }).catch(() => {});
            }
          });
          return hasNew ? Array.from(map.values()) : prev;
        });
      }
    } catch (err) {
      console.warn('Aviso ao sincronizar dados externos do PostgreSQL:', err);
    }
  }, [currentUser, isDemoUser]);

  // Polling periódico e recarregamento automático de dados externos
  useEffect(() => {
    if (!currentUser || isDemoUser) return;

    // Sincronização inicial
    refreshDataFromPostgres();

    // Polling a cada 20 segundos para capturar novos atendimentos do outro sistema
    const intervalId = setInterval(() => {
      refreshDataFromPostgres();
    }, 20000);

    // Recarregar quando o usuário volta para a aba do sistema
    const handleFocus = () => {
      refreshDataFromPostgres();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentUser, isDemoUser, refreshDataFromPostgres]);

  // Effective salaries for selected month (including standardized salary if no specific entry)
  const effectiveSalariesForMonth = useMemo(() => {
    return getEffectiveSalariesForMonth(selectedMonth, salaries, settings);
  }, [selectedMonth, salaries, settings]);

  // Effective extra incomes for selected month (recurring standard + month punctual)
  const effectiveIncomesForMonth = useMemo(() => {
    return getEffectiveIncomesForMonth(selectedMonth, incomes);
  }, [selectedMonth, incomes]);

  // Financial summary for selected month
  const monthSummary = useMemo(() => {
    return calculateMonthSummary(selectedMonth, salaries, incomes, expenses, settings);
  }, [selectedMonth, salaries, incomes, expenses, settings]);

  // Installments & Single expenses summary for selected month
  const monthInstallmentsAndSingleSummary = useMemo(() => {
    return calculateMonthInstallmentsAndSingleSummary(selectedMonth, expenses, installmentPurchases);
  }, [selectedMonth, expenses, installmentPurchases]);

  // Credit cards summary
  const cardLimitSummaries = useMemo(() => {
    return creditCards.map((card) =>
      calculateCardLimit(card, expenses, selectedMonth, installmentPurchases, creditCards)
    );
  }, [creditCards, expenses, selectedMonth, installmentPurchases]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const expMonth = e.referenceMonth || (e.date ? e.date.substring(0, 7) : '');

      // Month filter: default to selectedMonth unless explicitly 'ALL' or custom month
      if (filters.referenceMonth === 'ALL') {
        // Show all months
      } else if (filters.referenceMonth && filters.referenceMonth !== 'SELECTED') {
        if (expMonth !== filters.referenceMonth) return false;
      } else {
        // Default: strictly filter by selectedMonth
        if (expMonth !== selectedMonth) return false;
      }
      // Year filter
      if (filters.year !== 'ALL') {
        if (!expMonth.startsWith(filters.year)) return false;
      }
      // Category filter
      if (filters.categoryId !== 'ALL') {
        const catFilterLower = filters.categoryId.toLowerCase().trim();
        const catIdMatch = e.categoryId === filters.categoryId;
        const catNameMatch = e.categoryName?.toLowerCase().trim() === catFilterLower;
        if (!catIdMatch && !catNameMatch) return false;
      }
      // Payment method filter
      if (filters.paymentMethod !== 'ALL') {
        if (e.paymentMethod !== filters.paymentMethod) return false;
      }
      // Card filter
      if (filters.cardId !== 'ALL') {
        const cardMatch = e.cardId === filters.cardId || isExpenseMatchingCard(e, filters.cardId, '', creditCards);
        if (!cardMatch) return false;
      }
      // Status filter
      if (filters.status !== 'ALL') {
        if (e.status !== filters.status) return false;
      }
      // Min amount
      if (filters.minAmount !== undefined && filters.minAmount > 0) {
        if (e.amount < filters.minAmount) return false;
      }
      // Max amount
      if (filters.maxAmount !== undefined && filters.maxAmount > 0) {
        if (e.amount > filters.maxAmount) return false;
      }
      // Search query: description, category, notes, card name, and date (raw & DD/MM/YYYY)
      if (filters.searchQuery.trim()) {
        const queryLower = filters.searchQuery.trim().toLowerCase();
        const descMatch = e.description?.toLowerCase().includes(queryLower);
        const catMatch = e.categoryName?.toLowerCase().includes(queryLower);
        const notesMatch = e.notes?.toLowerCase().includes(queryLower);
        const cardMatch = e.cardName?.toLowerCase().includes(queryLower);

        // Date matching: support both ISO (2026-08-21) and BR format (21/08/2026 or 21/08)
        const rawDate = (e.date || '').toLowerCase();
        let dateBR = '';
        if (e.date && e.date.includes('-')) {
          const parts = e.date.split('-');
          if (parts.length === 3) {
            dateBR = `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
        }
        const dateMatch = rawDate.includes(queryLower) || (dateBR && dateBR.includes(queryLower));

        if (!descMatch && !catMatch && !notesMatch && !cardMatch && !dateMatch) return false;
      }
      return true;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [expenses, filters, selectedMonth, creditCards]);

  // ================= CRUD IMPLEMENTATIONS ================= //

  // Salary CRUD
  const addSalary = async (data: Omit<Salary, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    if (!currentUser) throw new Error('Usuário não autenticado');
    if (isDataEntryBlocked) {
      throw new Error('Seu período de teste de 30 dias expirou. Efetue o pagamento da taxa definida pelo Super Usuário para liberar novos lançamentos.');
    }
    const nowIso = new Date().toISOString();

    if (isDemoUser) {
      const newId = `demo-sal-${Date.now()}`;
      const newItem: Salary = { ...data, id: newId, userId: currentUser.uid, createdAt: nowIso, updatedAt: nowIso };
      setSalaries((prev) => [newItem, ...prev]);
      return newId;
    }

    const docRef = await addDoc(collection(db, 'salaries'), sanitizeData({
      ...data,
      userId: currentUser.uid,
      createdAt: nowIso,
      updatedAt: nowIso,
      serverCreatedAt: serverTimestamp(),
    }));
    return docRef.id;
  };

  const updateSalary = async (id: string, data: Partial<Salary>): Promise<void> => {
    const nowIso = new Date().toISOString();
    if (isDemoUser) {
      setSalaries((prev) => prev.map((s) => (s.id === id ? { ...s, ...data, updatedAt: nowIso } : s)));
      return;
    }
    await updateDoc(doc(db, 'salaries', id), sanitizeData({ ...data, updatedAt: nowIso, serverUpdatedAt: serverTimestamp() }));
  };

  const deleteSalary = async (id: string): Promise<void> => {
    if (isDemoUser) {
      setSalaries((prev) => prev.filter((s) => s.id !== id));
      return;
    }
    await deleteDoc(doc(db, 'salaries', id));
  };

  const toggleSalaryStatus = async (id: string, currentStatus: 'RECEIVED' | 'PENDING'): Promise<void> => {
    const nextStatus = currentStatus === 'RECEIVED' ? 'PENDING' : 'RECEIVED';
    // If it's a virtual standard salary (id starts with std-salary-)
    if (id.startsWith('std-salary-')) {
      const month = id.replace('std-salary-', '');
      // Create a real salary entry for this month with the toggled status
      await addSalary({
        amount: settings?.defaultSalaryAmount || 0,
        payDate: `${month}-${String(settings?.defaultSalaryPayDay || 5).padStart(2, '0')}`,
        referenceMonth: month,
        description: settings?.defaultSalaryDescription || 'Salário Mensal Base (Padrão)',
        status: nextStatus,
        isStandardDefault: true,
        repeatMonthly: true,
      });
      return;
    }
    await updateSalary(id, { status: nextStatus });
  };

  const setDefaultSalary = async (data: {
    amount: number;
    payDay?: number;
    description?: string;
    status?: 'RECEIVED' | 'PENDING';
    active?: boolean;
  }): Promise<void> => {
    if (!currentUser) throw new Error('Usuário não autenticado');
    if (isDataEntryBlocked) {
      throw new Error('Seu período de teste de 30 dias expirou. Efetue o pagamento da taxa definida pelo Super Usuário para liberar novos lançamentos.');
    }
    await updateSettings({
      defaultSalaryAmount: data.amount,
      defaultSalaryPayDay: data.payDay !== undefined ? data.payDay : 5,
      defaultSalaryDescription: data.description !== undefined ? data.description : 'Salário Mensal Base (Padrão)',
      defaultSalaryStatus: data.status !== undefined ? data.status : 'RECEIVED',
      defaultSalaryActive: data.active !== undefined ? data.active : true,
    });
  };

  // Income CRUD
  const addIncome = async (data: Omit<ExtraIncome, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    if (!currentUser) throw new Error('Usuário não autenticado');
    if (isDataEntryBlocked) {
      throw new Error('Seu período de teste de 30 dias expirou. Efetue o pagamento da taxa definida pelo Super Usuário para liberar novos lançamentos.');
    }
    const nowIso = new Date().toISOString();

    if (isDemoUser) {
      const newId = `demo-inc-${Date.now()}`;
      const newItem: ExtraIncome = { ...data, id: newId, userId: currentUser.uid, createdAt: nowIso, updatedAt: nowIso };
      setIncomes((prev) => [newItem, ...prev]);
      return newId;
    }

    const docRef = await addDoc(collection(db, 'incomes'), sanitizeData({
      ...data,
      userId: currentUser.uid,
      createdAt: nowIso,
      updatedAt: nowIso,
      serverCreatedAt: serverTimestamp(),
    }));
    return docRef.id;
  };

  const updateIncome = async (id: string, data: Partial<ExtraIncome>): Promise<void> => {
    const nowIso = new Date().toISOString();
    if (isDemoUser) {
      setIncomes((prev) => prev.map((i) => (i.id === id ? { ...i, ...data, updatedAt: nowIso } : i)));
      return;
    }
    await updateDoc(doc(db, 'incomes', id), sanitizeData({ ...data, updatedAt: nowIso, serverUpdatedAt: serverTimestamp() }));
  };

  const deleteIncome = async (id: string): Promise<void> => {
    if (isDemoUser) {
      setIncomes((prev) => prev.filter((s) => s.id !== id));
      return;
    }
    await deleteDoc(doc(db, 'incomes', id));
  };

  const toggleIncomeStatus = async (id: string, currentStatus: 'RECEIVED' | 'PENDING'): Promise<void> => {
    const nextStatus = currentStatus === 'RECEIVED' ? 'PENDING' : 'RECEIVED';
    await updateIncome(id, { status: nextStatus });
  };

  // Expense CRUD
  const addExpense = async (data: Omit<Expense, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    if (!currentUser) throw new Error('Usuário não autenticado');
    if (isDataEntryBlocked) {
      throw new Error('Seu período de teste de 30 dias expirou. Efetue o pagamento da taxa definida pelo Super Usuário para liberar novos lançamentos.');
    }
    const nowIso = new Date().toISOString();

    if (isDemoUser) {
      const newId = `demo-exp-${Date.now()}`;
      const newItem: Expense = { ...data, id: newId, userId: currentUser.uid, createdAt: nowIso, updatedAt: nowIso };
      setExpenses((prev) => [newItem, ...prev]);
      return newId;
    }

    const expDocRef = doc(collection(db, 'expenses'));
    const newId = expDocRef.id;
    const newItem: Expense = { ...data, id: newId, userId: currentUser.uid, createdAt: nowIso, updatedAt: nowIso };

    // Optimistic local state update for instant UI response
    setExpenses((prev) => [newItem, ...prev.filter((e) => e.id !== newId)]);

    try {
      await setDoc(expDocRef, sanitizeData({
        ...data,
        userId: currentUser.uid,
        createdAt: nowIso,
        updatedAt: nowIso,
        serverCreatedAt: serverTimestamp(),
      }));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `expenses/${newId}`);
    }

    return newId;
  };

  const updateExpense = async (
    id: string,
    data: Partial<Expense>,
    updateAllInstallments: boolean = false
  ): Promise<void> => {
    const nowIso = new Date().toISOString();
    const targetExp = expenses.find((e) => e.id === id);

    if (isDemoUser) {
      if (updateAllInstallments && targetExp?.installmentPurchaseId) {
        setExpenses((prev) =>
          prev.map((e) =>
            e.installmentPurchaseId === targetExp.installmentPurchaseId
              ? {
                  ...e,
                  paymentMethod: data.paymentMethod ?? e.paymentMethod,
                  cardId: data.cardId !== undefined ? data.cardId : e.cardId,
                  cardName: data.cardName !== undefined ? data.cardName : e.cardName,
                  categoryId: data.categoryId ?? e.categoryId,
                  categoryName: data.categoryName ?? e.categoryName,
                  updatedAt: nowIso,
                  ...(e.id === id ? data : {}),
                }
              : e.id === id
              ? { ...e, ...data, updatedAt: nowIso }
              : e
          )
        );
        setInstallmentPurchases((prev) =>
          prev.map((p) =>
            p.id === targetExp.installmentPurchaseId
              ? {
                  ...p,
                  cardId: data.cardId || p.cardId,
                  cardName: data.cardName || p.cardName,
                  categoryId: data.categoryId || p.categoryId,
                  categoryName: data.categoryName || p.categoryName,
                  updatedAt: nowIso,
                }
              : p
          )
        );
        return;
      }

      setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...data, updatedAt: nowIso } : e)));
      return;
    }

    // Firestore implementation
    if (updateAllInstallments && targetExp?.installmentPurchaseId) {
      const relatedExpenses = expenses.filter(
        (e) => e.installmentPurchaseId === targetExp.installmentPurchaseId
      );
      const batch = writeBatch(db);
      relatedExpenses.forEach((rel) => {
        const docRef = doc(db, 'expenses', rel.id);
        const updatePayload: any = {
          updatedAt: nowIso,
          serverUpdatedAt: serverTimestamp(),
        };
        if (data.paymentMethod !== undefined) updatePayload.paymentMethod = data.paymentMethod;
        if (data.cardId !== undefined) updatePayload.cardId = data.cardId;
        if (data.cardName !== undefined) updatePayload.cardName = data.cardName;
        if (data.categoryId !== undefined) updatePayload.categoryId = data.categoryId;
        if (data.categoryName !== undefined) updatePayload.categoryName = data.categoryName;
        if (rel.id === id) {
          Object.assign(updatePayload, sanitizeData(data));
        }
        batch.update(docRef, sanitizeData(updatePayload));
      });

      const purchaseRef = doc(db, 'installmentPurchases', targetExp.installmentPurchaseId);
      batch.update(
        purchaseRef,
        sanitizeData({
          cardId: data.cardId,
          cardName: data.cardName,
          categoryId: data.categoryId,
          categoryName: data.categoryName,
          updatedAt: nowIso,
          serverUpdatedAt: serverTimestamp(),
        })
      );
      await batch.commit();
      return;
    }

    await updateDoc(
      doc(db, 'expenses', id),
      sanitizeData({ ...data, updatedAt: nowIso, serverUpdatedAt: serverTimestamp() })
    );
  };

  const deleteExpense = async (id: string): Promise<void> => {
    // Immediate state update for responsive UI feedback
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    if (isDemoUser) return;

    try {
      await deleteDoc(doc(db, 'expenses', id));
    } catch (err) {
      console.error('Erro ao excluir despesa do Firestore:', err);
      handleFirestoreError(err, OperationType.DELETE, 'expenses');
    }
  };

  const deleteMultipleExpenses = async (
    expenseIds: string[],
    deleteAllLinkedInstallments: boolean = false
  ): Promise<{ deletedExpensesCount: number; deletedInstallmentsCount: number }> => {
    if (!expenseIds || expenseIds.length === 0) {
      return { deletedExpensesCount: 0, deletedInstallmentsCount: 0 };
    }

    const previousExpenses = [...expenses];
    const previousPurchases = [...installmentPurchases];

    const targetExpenseIdSet = new Set(expenseIds);
    const targetExpenses = expenses.filter((e) => targetExpenseIdSet.has(e.id));

    // If deleteAllLinkedInstallments is requested, collect all purchase IDs and all their linked expenses
    const purchaseIdsToDelete = new Set<string>();
    if (deleteAllLinkedInstallments) {
      targetExpenses.forEach((e) => {
        if (e.isInstallment && e.installmentPurchaseId) {
          purchaseIdsToDelete.add(e.installmentPurchaseId);
        }
      });
    }

    // Expand targetExpenseIdSet if linked installments are included
    if (purchaseIdsToDelete.size > 0) {
      expenses.forEach((e) => {
        if (e.installmentPurchaseId && purchaseIdsToDelete.has(e.installmentPurchaseId)) {
          targetExpenseIdSet.add(e.id);
        }
      });
    }

    // Immediately update local state for responsive, zero-latency UI
    setExpenses((prev) => prev.filter((e) => !targetExpenseIdSet.has(e.id)));
    if (purchaseIdsToDelete.size > 0) {
      setInstallmentPurchases((prev) => prev.filter((p) => !purchaseIdsToDelete.has(p.id)));
    }

    if (!isDemoUser) {
      try {
        // Query Firestore for any linked installment expenses not in memory
        if (purchaseIdsToDelete.size > 0) {
          for (const purchaseId of Array.from(purchaseIdsToDelete)) {
            try {
              const q = query(collection(db, 'expenses'), where('installmentPurchaseId', '==', purchaseId));
              const snap = await getDocs(q);
              snap.forEach((d) => {
                targetExpenseIdSet.add(d.id);
              });
            } catch (err) {
              console.warn('Erro ao consultar despesas vinculadas no Firestore:', err);
            }
          }
        }

        const allExpenseIdsToDelete = Array.from(targetExpenseIdSet);
        const allPurchaseIdsToDelete = Array.from(purchaseIdsToDelete);

        // Group operations into transactional chunks to strictly guarantee atomicity
        const allOperations: Array<{ type: 'purchase' | 'expense'; id: string }> = [
          ...allPurchaseIdsToDelete.map((id) => ({ type: 'purchase' as const, id })),
          ...allExpenseIdsToDelete.map((id) => ({ type: 'expense' as const, id })),
        ];

        const chunkSize = 400;
        for (let i = 0; i < allOperations.length; i += chunkSize) {
          const chunk = allOperations.slice(i, i + chunkSize);
          await runTransaction(db, async (transaction) => {
            for (const op of chunk) {
              if (op.type === 'purchase') {
                transaction.delete(doc(db, 'installmentPurchases', op.id));
              } else {
                transaction.delete(doc(db, 'expenses', op.id));
              }
            }
          });
        }
      } catch (err) {
        console.error('Erro na transação de exclusão em lote no Firestore:', err);
        // Rollback optimistic state on error to maintain integrity
        setExpenses(previousExpenses);
        setInstallmentPurchases(previousPurchases);
        handleFirestoreError(err, OperationType.DELETE, 'expenses');
        throw err;
      }
    }

    return {
      deletedExpensesCount: targetExpenseIdSet.size,
      deletedInstallmentsCount: purchaseIdsToDelete.size,
    };
  };

  const updateMultipleExpensesStatus = async (
    expenseIds: string[],
    targetStatus: 'PAGA' | 'PENDENTE'
  ): Promise<void> => {
    if (!expenseIds || expenseIds.length === 0) return;

    const idSet = new Set(expenseIds);
    const nowIso = new Date().toISOString();

    // Immediate state update
    setExpenses((prev) =>
      prev.map((e) => (idSet.has(e.id) ? { ...e, status: targetStatus, updatedAt: nowIso } : e))
    );

    if (!isDemoUser) {
      try {
        for (let i = 0; i < expenseIds.length; i += 300) {
          const chunk = expenseIds.slice(i, i + 300);
          const batch = writeBatch(db);
          for (const expId of chunk) {
            batch.update(doc(db, 'expenses', expId), sanitizeData({
              status: targetStatus,
              updatedAt: nowIso,
              serverUpdatedAt: serverTimestamp(),
            }));
          }
          await batch.commit();
        }
      } catch (err) {
        console.error('Erro ao atualizar status das despesas em lote:', err);
      }
    }
  };

  const toggleExpenseStatus = async (id: string, currentStatus: 'PAGA' | 'PENDENTE'): Promise<void> => {
    const nextStatus = currentStatus === 'PAGA' ? 'PENDENTE' : 'PAGA';
    await updateExpense(id, { status: nextStatus });
  };

  // Credit Card CRUD
  const addCreditCard = async (data: Omit<CreditCard, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    if (!currentUser) throw new Error('Usuário não autenticado');
    if (isDataEntryBlocked) {
      throw new Error('Seu período de teste de 30 dias expirou. Efetue o pagamento da taxa definida pelo Super Usuário para liberar novos lançamentos.');
    }
    const nowIso = new Date().toISOString();

    if (isDemoUser) {
      const newId = `demo-card-${Date.now()}`;
      const newItem: CreditCard = { ...data, id: newId, userId: currentUser.uid, createdAt: nowIso, updatedAt: nowIso };
      setCreditCards((prev) => [...prev, newItem]);
      return newId;
    }

    const docRef = await addDoc(collection(db, 'creditCards'), sanitizeData({
      ...data,
      userId: currentUser.uid,
      createdAt: nowIso,
      updatedAt: nowIso,
      serverCreatedAt: serverTimestamp(),
    }));
    return docRef.id;
  };

  const updateCreditCard = async (id: string, data: Partial<CreditCard>): Promise<void> => {
    const nowIso = new Date().toISOString();
    if (isDemoUser) {
      setCreditCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...data, updatedAt: nowIso } : c)));
      return;
    }
    await updateDoc(doc(db, 'creditCards', id), sanitizeData({ ...data, updatedAt: nowIso, serverUpdatedAt: serverTimestamp() }));
  };

  const deleteCreditCard = async (id: string): Promise<void> => {
    if (isDemoUser) {
      setCreditCards((prev) => prev.filter((c) => c.id !== id));
      return;
    }
    await deleteDoc(doc(db, 'creditCards', id));
  };

  // Payment Methods (Outros Tipos) CRUD
  const addPaymentMethod = async (data: Omit<CustomPaymentMethod, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    if (!currentUser) throw new Error('Usuário não autenticado');
    if (isDataEntryBlocked) {
      throw new Error('Seu período de teste de 30 dias expirou. Efetue o pagamento da taxa definida pelo Super Usuário para liberar novos lançamentos.');
    }
    const nowIso = new Date().toISOString();

    if (isDemoUser) {
      const newId = `demo-pm-${Date.now()}`;
      const newItem: CustomPaymentMethod = { ...data, id: newId, userId: currentUser.uid, createdAt: nowIso, updatedAt: nowIso };
      setPaymentMethods((prev) => [...prev, newItem]);
      return newId;
    }

    const docRef = await addDoc(collection(db, 'paymentMethods'), sanitizeData({
      ...data,
      userId: currentUser.uid,
      createdAt: nowIso,
      updatedAt: nowIso,
      serverCreatedAt: serverTimestamp(),
    }));
    return docRef.id;
  };

  const updatePaymentMethod = async (id: string, data: Partial<CustomPaymentMethod>): Promise<void> => {
    const nowIso = new Date().toISOString();
    if (isDemoUser) {
      setPaymentMethods((prev) => prev.map((pm) => (pm.id === id ? { ...pm, ...data, updatedAt: nowIso } : pm)));
      return;
    }
    await updateDoc(doc(db, 'paymentMethods', id), sanitizeData({ ...data, updatedAt: nowIso, serverUpdatedAt: serverTimestamp() }));
  };

  const deletePaymentMethod = async (id: string): Promise<void> => {
    if (isDemoUser) {
      setPaymentMethods((prev) => prev.filter((pm) => pm.id !== id));
      return;
    }
    await deleteDoc(doc(db, 'paymentMethods', id));
  };

  // Batch Status Operations
  const markAllCardExpensesStatus = async (
    cardCanonicalId: string,
    cardCanonicalName: string,
    targetStatus: 'PAGA' | 'PENDENTE',
    month: string
  ): Promise<void> => {
    const targetExpenses = expenses.filter(
      (e) =>
        e.referenceMonth === month &&
        isExpenseMatchingCard(e, cardCanonicalId, cardCanonicalName, creditCards)
    );

    if (targetExpenses.length === 0) return;

    if (isDemoUser) {
      const targetIds = new Set(targetExpenses.map((e) => e.id));
      const nowIso = new Date().toISOString();
      setExpenses((prev) =>
        prev.map((e) => (targetIds.has(e.id) ? { ...e, status: targetStatus, updatedAt: nowIso } : e))
      );
      return;
    }

    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();
    for (const exp of targetExpenses) {
      batch.update(doc(db, 'expenses', exp.id), {
        status: targetStatus,
        updatedAt: nowIso,
        serverUpdatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  };

  const markAllMethodExpensesStatus = async (
    method: PaymentMethod | string,
    targetStatus: 'PAGA' | 'PENDENTE',
    month: string
  ): Promise<void> => {
    const targetExpenses = expenses.filter(
      (e) => e.referenceMonth === month && (e.paymentMethod === method || e.paymentMethodId === method)
    );

    if (targetExpenses.length === 0) return;

    if (isDemoUser) {
      const targetIds = new Set(targetExpenses.map((e) => e.id));
      const nowIso = new Date().toISOString();
      setExpenses((prev) =>
        prev.map((e) => (targetIds.has(e.id) ? { ...e, status: targetStatus, updatedAt: nowIso } : e))
      );
      return;
    }

    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();
    for (const exp of targetExpenses) {
      batch.update(doc(db, 'expenses', exp.id), {
        status: targetStatus,
        updatedAt: nowIso,
        serverUpdatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  };

  // Installment Purchases with automatic month distribution & cents precision
  const createInstallmentPurchase = async (purchaseData: {
    title: string;
    totalAmount: number;
    installmentCount: number;
    startMonth: string;
    cardId: string;
    cardName?: string;
    categoryId: string;
    categoryName: string;
    defaultDay?: number;
    isIndefinite?: boolean;
    monthlyAmount?: number;
  }): Promise<string> => {
    if (!currentUser) throw new Error('Usuário não autenticado');
    if (isDataEntryBlocked) {
      throw new Error('Seu período de teste de 30 dias expirou. Efetue o pagamento da taxa definida pelo Super Usuário para liberar novos lançamentos.');
    }
    const nowIso = new Date().toISOString();

    const isIndefinite = !!purchaseData.isIndefinite;
    const count = isIndefinite ? 6 : (purchaseData.installmentCount || 2);
    const card = creditCards.find((c) => c.id === purchaseData.cardId);
    const cardName = purchaseData.cardName || card?.name || 'Cartão Crédito';

    // 1. Create parent installment purchase
    const masterPurchaseData: Omit<InstallmentPurchase, 'id'> = {
      userId: currentUser.uid,
      title: purchaseData.title,
      totalAmount: purchaseData.totalAmount,
      installmentCount: count,
      monthlyAmount: isIndefinite ? purchaseData.totalAmount : undefined,
      isIndefinite,
      isInterrupted: false,
      startMonth: purchaseData.startMonth,
      cardId: purchaseData.cardId,
      cardName,
      categoryId: purchaseData.categoryId,
      categoryName: purchaseData.categoryName,
      status: 'ACTIVE',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (isDemoUser) {
      const purchaseId = `demo-inst-${Date.now()}`;
      const newPurchase: InstallmentPurchase = { id: purchaseId, ...masterPurchaseData };
      
      const installments = generateInstallmentsPlan(
        purchaseData.title,
        purchaseData.totalAmount,
        count,
        purchaseData.startMonth,
        purchaseData.categoryId,
        purchaseData.categoryName,
        purchaseData.cardId,
        purchaseId,
        currentUser.uid,
        purchaseData.defaultDay || 10,
        isIndefinite,
        cardName
      );

      const demoExpenseItems: Expense[] = installments.map((inst, idx) => ({
        id: `demo-inst-exp-${purchaseId}-${idx}`,
        ...inst,
        createdAt: nowIso,
        updatedAt: nowIso,
      }));

      setInstallmentPurchases((prev) => [newPurchase, ...prev]);
      setExpenses((prev) => [...prev, ...demoExpenseItems]);
      return purchaseId;
    }

    // Real Firestore batch creation
    const purchaseDocRef = doc(collection(db, 'installmentPurchases'));
    const purchaseId = purchaseDocRef.id;

    const installments = generateInstallmentsPlan(
      purchaseData.title,
      purchaseData.totalAmount,
      count,
      purchaseData.startMonth,
      purchaseData.categoryId,
      purchaseData.categoryName,
      purchaseData.cardId,
      purchaseId,
      currentUser.uid,
      purchaseData.defaultDay || 10,
      isIndefinite,
      cardName
    );

    const realExpenseItems: Expense[] = installments.map((item) => {
      const expDoc = doc(collection(db, 'expenses'));
      return {
        id: expDoc.id,
        ...item,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    });

    const newPurchase: InstallmentPurchase = { id: purchaseId, ...masterPurchaseData };

    // Immediate optimistic local state update
    setInstallmentPurchases((prev) => [newPurchase, ...prev.filter((p) => p.id !== purchaseId)]);
    setExpenses((prev) => [...realExpenseItems, ...prev]);

    // Commit all records to Firestore in a single batch
    try {
      const batch = writeBatch(db);
      batch.set(purchaseDocRef, sanitizeData({
        ...masterPurchaseData,
        serverCreatedAt: serverTimestamp(),
      }));

      for (const item of realExpenseItems) {
        batch.set(doc(db, 'expenses', item.id), sanitizeData({
          ...item,
          serverCreatedAt: serverTimestamp(),
        }));
      }

      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `installmentPurchases/${purchaseId}`);
    }

    return purchaseId;
  };

  const extendIndefinitePurchase = async (
    purchaseId: string,
    additionalMonths: 3 | 6,
    newMonthlyAmount?: number
  ): Promise<void> => {
    if (!currentUser) throw new Error('Usuário não autenticado');
    if (isDataEntryBlocked) {
      throw new Error('Seu período de teste de 30 dias expirou.');
    }

    const purchase = installmentPurchases.find((p) => p.id === purchaseId);
    if (!purchase) throw new Error('Compra/Assinatura não encontrada');

    const linkedExpenses = expenses
      .filter((e) => e.installmentPurchaseId === purchaseId)
      .sort((a, b) => (a.referenceMonth || '').localeCompare(b.referenceMonth || ''));

    // Determine the last reference month and last installment number
    let lastMonth = purchase.startMonth;
    let lastNum = 0;
    let defaultDay = 10;
    const effectiveAmount =
      newMonthlyAmount && newMonthlyAmount > 0
        ? newMonthlyAmount
        : purchase.monthlyAmount || purchase.totalAmount || 0;

    if (linkedExpenses.length > 0) {
      const lastExp = linkedExpenses[linkedExpenses.length - 1];
      lastMonth =
        lastExp.referenceMonth ||
        (lastExp.date ? lastExp.date.substring(0, 7) : purchase.startMonth);
      lastNum = lastExp.installmentNumber || linkedExpenses.length;
      const dayFromDate = lastExp.date ? parseInt(lastExp.date.split('-')[2] || '10', 10) : 10;
      defaultDay = Math.min(28, Math.max(1, dayFromDate));
    }

    const nowIso = new Date().toISOString();
    const newExpenses: Expense[] = [];

    for (let i = 1; i <= additionalMonths; i++) {
      const nextMonth = getAdjacentMonth(lastMonth, i);
      const dayStr = String(defaultDay).padStart(2, '0');
      const dateStr = `${nextMonth}-${dayStr}`;
      const currentNum = lastNum + i;

      const effectiveMethod: PaymentMethod = isPixExpense({ cardName: purchase.cardName, cardId: purchase.cardId, categoryName: purchase.categoryName, categoryId: purchase.categoryId })
        ? 'PIX'
        : isBoletoExpense({ cardName: purchase.cardName, cardId: purchase.cardId, categoryName: purchase.categoryName, categoryId: purchase.categoryId })
        ? 'BOLETO'
        : isDebitExpense({ cardName: purchase.cardName, cardId: purchase.cardId, categoryName: purchase.categoryName, categoryId: purchase.categoryId })
        ? 'CARTAO_DEBITO'
        : isCashExpense({ cardName: purchase.cardName, cardId: purchase.cardId, categoryName: purchase.categoryName, categoryId: purchase.categoryId })
        ? 'DINHEIRO'
        : 'CARTAO_CREDITO';

      newExpenses.push({
        id: isDemoUser ? `demo-inst-exp-${purchaseId}-${currentNum}-${Date.now()}` : '',
        userId: currentUser.uid,
        description: `${purchase.title} (Mês ${currentNum} - Indeterminado)`,
        amount: effectiveAmount,
        date: dateStr,
        referenceMonth: nextMonth,
        categoryId: purchase.categoryId,
        categoryName: purchase.categoryName,
        paymentMethod: effectiveMethod,
        cardId: purchase.cardId,
        cardName: purchase.cardName,
        isInstallment: true,
        isIndefinite: true,
        installmentPurchaseId: purchaseId,
        installmentNumber: currentNum,
        totalInstallments: 0,
        status: 'PENDENTE',
        notes: `Prorrogação de assinatura contínua (+${additionalMonths} meses). Lançamento mês ${currentNum}.`,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    const updatedPurchaseCount = (purchase.installmentCount || linkedExpenses.length) + additionalMonths;
    const updatedPurchaseData: Partial<InstallmentPurchase> = {
      installmentCount: updatedPurchaseCount,
      monthlyAmount: effectiveAmount,
      status: 'ACTIVE',
      isInterrupted: false,
      updatedAt: nowIso,
    };

    if (isDemoUser) {
      setInstallmentPurchases((prev) =>
        prev.map((p) => (p.id === purchaseId ? { ...p, ...updatedPurchaseData } : p))
      );
      setExpenses((prev) => [...prev, ...newExpenses]);
      return;
    }

    const batch = writeBatch(db);
    batch.update(
      doc(db, 'installmentPurchases', purchaseId),
      sanitizeData({
        ...updatedPurchaseData,
        serverUpdatedAt: serverTimestamp(),
      })
    );

    const realExpenseItems: Expense[] = [];
    for (const exp of newExpenses) {
      const expDoc = doc(collection(db, 'expenses'));
      const realItem = { ...exp, id: expDoc.id };
      realExpenseItems.push(realItem);
      batch.set(
        expDoc,
        sanitizeData({
          ...realItem,
          serverCreatedAt: serverTimestamp(),
        })
      );
    }

    setInstallmentPurchases((prev) =>
      prev.map((p) => (p.id === purchaseId ? { ...p, ...updatedPurchaseData } : p))
    );
    setExpenses((prev) => [...prev, ...realExpenseItems]);

    await batch.commit();
  };

  const deleteInstallmentPurchase = async (purchaseId: string, deleteOnlyExpenseId?: string): Promise<void> => {
    if (deleteOnlyExpenseId) {
      // User chose to delete ONLY this specific installment expense
      await deleteExpense(deleteOnlyExpenseId);
      return;
    }

    const previousExpenses = [...expenses];
    const previousPurchases = [...installmentPurchases];

    // User chose to delete ALL installments of this purchase
    // Immediately update local state for fast UI response
    setInstallmentPurchases((prev) => prev.filter((p) => p.id !== purchaseId));
    setExpenses((prev) => prev.filter((e) => e.installmentPurchaseId !== purchaseId));

    if (isDemoUser) return;

    try {
      // Collect all linked expense doc IDs from memory and Firestore
      const docsToDelete = new Set<string>();
      expenses.filter((e) => e.installmentPurchaseId === purchaseId).forEach((e) => docsToDelete.add(e.id));

      try {
        const q = query(collection(db, 'expenses'), where('installmentPurchaseId', '==', purchaseId));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((d) => docsToDelete.add(d.id));
      } catch (err) {
        console.warn('Erro ao consultar despesas vinculadas no Firestore:', err);
      }

      const docIds = Array.from(docsToDelete);

      // Execute atomic transaction for master record + all linked installment expenses
      const allOps: Array<{ collection: string; id: string }> = [
        { collection: 'installmentPurchases', id: purchaseId },
        ...docIds.map((id) => ({ collection: 'expenses', id })),
      ];

      const chunkSize = 400;
      for (let i = 0; i < allOps.length; i += chunkSize) {
        const chunk = allOps.slice(i, i + chunkSize);
        await runTransaction(db, async (transaction) => {
          for (const op of chunk) {
            transaction.delete(doc(db, op.collection, op.id));
          }
        });
      }
    } catch (err) {
      console.error('Erro ao excluir parcelamento completo via transação:', err);
      setExpenses(previousExpenses);
      setInstallmentPurchases(previousPurchases);
      handleFirestoreError(err, OperationType.DELETE, 'installmentPurchases');
      throw err;
    }
  };

  const interruptInstallmentPurchase = async (purchaseId: string, stopFromMonth?: string): Promise<void> => {
    const cutMonth = stopFromMonth || selectedMonth;
    const nowIso = new Date().toISOString();

    if (isDemoUser) {
      setInstallmentPurchases((prev) =>
        prev.map((p) =>
          p.id === purchaseId
            ? {
                ...p,
                status: 'INTERRUPTED',
                isInterrupted: true,
                interruptedMonth: cutMonth,
                interruptedAt: nowIso,
                updatedAt: nowIso,
              }
            : p
        )
      );
      // Remove all future pending installments after cutMonth
      setExpenses((prev) =>
        prev.filter((e) => !(e.installmentPurchaseId === purchaseId && e.referenceMonth > cutMonth && e.status === 'PENDENTE'))
      );
      return;
    }

    // Update purchase document
    await updateDoc(doc(db, 'installmentPurchases', purchaseId), sanitizeData({
      status: 'INTERRUPTED',
      isInterrupted: true,
      interruptedMonth: cutMonth,
      interruptedAt: nowIso,
      updatedAt: nowIso,
      serverUpdatedAt: serverTimestamp(),
    }));

    // Delete future pending expenses after cutMonth
    const linkedExpenses = expenses.filter(
      (e) => e.installmentPurchaseId === purchaseId && e.referenceMonth > cutMonth && e.status === 'PENDENTE'
    );
    if (linkedExpenses.length > 0) {
      const batch = writeBatch(db);
      for (const item of linkedExpenses) {
        batch.delete(doc(db, 'expenses', item.id));
      }
      await batch.commit();
    }
  };

  // Category CRUD
  const addCategory = async (data: Omit<Category, 'id' | 'userId'>): Promise<string> => {
    if (!currentUser) throw new Error('Usuário não autenticado');
    const nowIso = new Date().toISOString();

    if (isDemoUser) {
      const newId = `demo-cat-${Date.now()}`;
      const newItem: Category = { ...data, id: newId, userId: currentUser.uid, createdAt: nowIso, updatedAt: nowIso };
      setCategories((prev) => [...prev, newItem]);
      return newId;
    }

    const docRef = await addDoc(collection(db, 'categories'), {
      ...data,
      userId: currentUser.uid,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    return docRef.id;
  };

  const deleteCategory = async (id: string): Promise<void> => {
    if (isDemoUser) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
      return;
    }
    await deleteDoc(doc(db, 'categories', id));
  };

  // User Settings
  const updateSettings = async (data: Partial<UserSettings>): Promise<void> => {
    if (!currentUser) return;
    const nowIso = new Date().toISOString();
    const newSettings: UserSettings = {
      ...(settings || {
        userId: currentUser.uid,
        theme: 'light',
        currency: 'BRL',
        alertThresholdPercentage: 80,
        emailNotifications: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      }),
      ...data,
      updatedAt: nowIso,
    };

    setSettings(newSettings);
    if (!isDemoUser) {
      await setDoc(doc(db, 'userSettings', currentUser.uid), newSettings, { merge: true });
    }
  };

  // Backup Export
  const exportBackupData = (): BackupData => {
    if (!currentUser) throw new Error('Usuário não autenticado');
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      userId: currentUser.uid,
      userEmail: currentUser.email || undefined,
      salaries,
      incomes,
      expenses,
      creditCards,
      installmentPurchases,
      categories: categories.filter((c) => c.userId !== 'system'),
      settings: settings || undefined,
    };
  };

  // Backup Import with comprehensive validation
  const importBackupData = async (data: BackupData): Promise<{ success: boolean; message: string; count: number }> => {
    if (!currentUser) throw new Error('Usuário não autenticado');
    if (!data || typeof data !== 'object') {
      throw new Error('Arquivo de backup inválido: formato corrompido.');
    }
    if (!Array.isArray(data.expenses) && !Array.isArray(data.salaries) && !Array.isArray(data.incomes)) {
      throw new Error('Arquivo de backup inválido: estrutura de registros ausente.');
    }

    const nowIso = new Date().toISOString();
    let totalRestored = 0;

    if (isDemoUser) {
      if (Array.isArray(data.salaries)) setSalaries(data.salaries.map((s) => ({ ...s, userId: currentUser.uid })));
      if (Array.isArray(data.incomes)) setIncomes(data.incomes.map((i) => ({ ...i, userId: currentUser.uid })));
      if (Array.isArray(data.expenses)) setExpenses(data.expenses.map((e) => ({ ...e, userId: currentUser.uid })));
      if (Array.isArray(data.creditCards)) setCreditCards(data.creditCards.map((c) => ({ ...c, userId: currentUser.uid })));
      if (Array.isArray(data.installmentPurchases)) setInstallmentPurchases(data.installmentPurchases.map((p) => ({ ...p, userId: currentUser.uid })));
      if (Array.isArray(data.categories)) {
        const nonSystem = data.categories.filter((c) => c.userId !== 'system').map((c) => ({ ...c, userId: currentUser.uid }));
        const systemDefaults = DEFAULT_CATEGORIES.map((c, i) => ({ id: `default-cat-${i}`, ...c }));
        setCategories([...systemDefaults, ...nonSystem]);
      }
      totalRestored = (data.salaries?.length || 0) + (data.incomes?.length || 0) + (data.expenses?.length || 0) + (data.creditCards?.length || 0);
      return { success: true, message: 'Backup restaurado com sucesso na sessão de demonstração!', count: totalRestored };
    }

    // Real Firestore batch restoration
    const batch = writeBatch(db);

    if (Array.isArray(data.salaries)) {
      for (const s of data.salaries) {
        const docRef = doc(collection(db, 'salaries'));
        batch.set(docRef, { ...s, userId: currentUser.uid, updatedAt: nowIso });
        totalRestored++;
      }
    }

    if (Array.isArray(data.incomes)) {
      for (const inc of data.incomes) {
        const docRef = doc(collection(db, 'incomes'));
        batch.set(docRef, { ...inc, userId: currentUser.uid, updatedAt: nowIso });
        totalRestored++;
      }
    }

    if (Array.isArray(data.expenses)) {
      for (const exp of data.expenses) {
        const docRef = doc(collection(db, 'expenses'));
        batch.set(docRef, { ...exp, userId: currentUser.uid, updatedAt: nowIso });
        totalRestored++;
      }
    }

    if (Array.isArray(data.creditCards)) {
      for (const card of data.creditCards) {
        const docRef = doc(collection(db, 'creditCards'));
        batch.set(docRef, { ...card, userId: currentUser.uid, updatedAt: nowIso });
        totalRestored++;
      }
    }

    if (Array.isArray(data.installmentPurchases)) {
      for (const p of data.installmentPurchases) {
        const docRef = doc(collection(db, 'installmentPurchases'));
        batch.set(docRef, { ...p, userId: currentUser.uid, updatedAt: nowIso });
        totalRestored++;
      }
    }

    await batch.commit();

    return {
      success: true,
      message: `Restauração concluída com sucesso! ${totalRestored} registros foram importados para sua conta.`,
      count: totalRestored,
    };
  };

  // Direct Excel / Spreadsheet Import with Automatic Future Entry Generation
  const importSpreadsheetData = async (
    items: ParsedSpreadsheetItem[]
  ): Promise<{
    success: boolean;
    expensesCount: number;
    installmentsCount: number;
    incomesCount: number;
    salariesCount: number;
    totalCreated: number;
    message: string;
  }> => {
    if (!currentUser) throw new Error('Usuário não autenticado');
    if (isDataEntryBlocked) {
      throw new Error('Seu período de teste expirou. Efetue o pagamento para liberar novos lançamentos.');
    }

    const validRows = items.filter((it) => it.isValid && it.amount > 0 && it.description);
    if (validRows.length === 0) {
      throw new Error('Nenhum registro válido encontrado para importação na planilha.');
    }

    const nowIso = new Date().toISOString();
    let expensesCount = 0;
    let installmentsCount = 0;
    let incomesCount = 0;
    let salariesCount = 0;
    let totalCreated = 0;

    // Track or create category and card lookups
    const existingCatMap = new Map<string, string>();
    categories.forEach((c) => existingCatMap.set(c.name.toLowerCase().trim(), c.id));

    const existingCardMap = new Map<string, string>();
    creditCards.forEach((c) => existingCardMap.set(c.name.toLowerCase().trim(), c.id));

    // Handle Demo Mode
    if (isDemoUser) {
      const newExpenses: Expense[] = [];
      const newPurchases: InstallmentPurchase[] = [];
      const newIncomes: ExtraIncome[] = [];
      const newSalaries: Salary[] = [];

      for (const row of validRows) {
        const catName = row.categoryName || 'Outros';
        let catId = existingCatMap.get(catName.toLowerCase().trim()) || 'cat-outros';

        if (row.type === 'EXPENSE') {
          const expId = `demo-exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          newExpenses.push({
            id: expId,
            userId: currentUser.uid,
            description: row.description,
            amount: row.amount,
            referenceMonth: row.referenceMonth,
            date: row.date,
            categoryId: catId,
            categoryName: catName,
            paymentMethod: row.paymentMethod,
            cardName: row.cardName,
            status: row.isPaid ? 'PAGA' : 'PENDENTE',
            notes: row.notes,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
          expensesCount++;
          totalCreated++;
        } else if (row.type === 'INSTALLMENT') {
          const count = row.installmentCount && row.installmentCount > 1 ? row.installmentCount : 2;
          const purchaseId = `demo-inst-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const cardName = row.cardName || 'Cartão de Crédito';
          const cardId = existingCardMap.get(cardName.toLowerCase().trim()) || 'demo-card-default';

          const purchase: InstallmentPurchase = {
            id: purchaseId,
            userId: currentUser.uid,
            title: row.description,
            totalAmount: row.amount,
            installmentCount: count,
            isIndefinite: false,
            isInterrupted: false,
            startMonth: row.referenceMonth,
            cardId,
            cardName,
            categoryId: catId,
            categoryName: catName,
            status: 'ACTIVE',
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          newPurchases.push(purchase);
          installmentsCount++;

          const generated = generateInstallmentsPlan(
            row.description,
            row.amount,
            count,
            row.referenceMonth,
            catId,
            catName,
            cardId,
            purchaseId,
            currentUser.uid,
            parseInt(row.date.split('-')[2] || '10', 10),
            false,
            cardName
          );

          generated.forEach((genExp, gIdx) => {
            newExpenses.push({
              id: `demo-inst-exp-${purchaseId}-${gIdx}`,
              ...genExp,
              createdAt: nowIso,
              updatedAt: nowIso,
            });
            totalCreated++;
          });
        } else if (row.type === 'INCOME') {
          const incId = `demo-inc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          newIncomes.push({
            id: incId,
            userId: currentUser.uid,
            description: row.description,
            amount: row.amount,
            referenceMonth: row.referenceMonth,
            date: row.date,
            origin: row.categoryName || 'Planilha Excel',
            status: row.isPaid ? 'RECEIVED' : 'PENDING',
            notes: row.notes,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
          incomesCount++;
          totalCreated++;
        } else if (row.type === 'SALARY') {
          const salId = `demo-sal-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          newSalaries.push({
            id: salId,
            userId: currentUser.uid,
            description: row.description,
            amount: row.amount,
            referenceMonth: row.referenceMonth,
            payDate: row.date,
            status: row.isPaid ? 'RECEIVED' : 'PENDING',
            isStandardDefault: false,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
          salariesCount++;
          totalCreated++;
        }
      }

      setExpenses((prev) => [...newExpenses, ...prev]);
      setInstallmentPurchases((prev) => [...newPurchases, ...prev]);
      setIncomes((prev) => [...newIncomes, ...prev]);
      setSalaries((prev) => [...newSalaries, ...prev]);

      return {
        success: true,
        expensesCount,
        installmentsCount,
        incomesCount,
        salariesCount,
        totalCreated,
        message: `${totalCreated} lançamentos importados com sucesso da planilha Excel!`,
      };
    }

    // Real Firestore Batch Execution
    let currentBatch = writeBatch(db);
    let opCount = 0;

    const commitBatchIfNeeded = async () => {
      if (opCount >= 300) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        opCount = 0;
      }
    };

    for (const row of validRows) {
      const catName = row.categoryName || 'Outros';
      let catId = existingCatMap.get(catName.toLowerCase().trim());
      if (!catId) {
        catId = `cat_${catName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      }

      if (row.type === 'EXPENSE') {
        const expDocRef = doc(collection(db, 'expenses'));
        currentBatch.set(expDocRef, sanitizeData({
          userId: currentUser.uid,
          description: row.description,
          amount: row.amount,
          referenceMonth: row.referenceMonth,
          date: row.date,
          categoryId: catId,
          categoryName: catName,
          paymentMethod: row.paymentMethod,
          cardName: row.cardName || (row.paymentMethod === 'CARTAO_CREDITO' ? 'Cartão Principal' : undefined),
          status: row.isPaid ? 'PAGA' : 'PENDENTE',
          notes: row.notes,
          createdAt: nowIso,
          updatedAt: nowIso,
          serverCreatedAt: serverTimestamp(),
        }));
        opCount++;
        expensesCount++;
        totalCreated++;
        await commitBatchIfNeeded();
      } else if (row.type === 'INSTALLMENT') {
        const count = row.installmentCount && row.installmentCount > 1 ? row.installmentCount : 2;
        const purchaseDocRef = doc(collection(db, 'installmentPurchases'));
        const purchaseId = purchaseDocRef.id;
        const cardName = row.cardName || 'Cartão Principal';
        const cardId = existingCardMap.get(cardName.toLowerCase().trim()) || 'card-excel-import';

        currentBatch.set(purchaseDocRef, sanitizeData({
          userId: currentUser.uid,
          title: row.description,
          totalAmount: row.amount,
          installmentCount: count,
          isIndefinite: false,
          isInterrupted: false,
          startMonth: row.referenceMonth,
          cardId,
          cardName,
          categoryId: catId,
          categoryName: catName,
          status: 'ACTIVE',
          createdAt: nowIso,
          updatedAt: nowIso,
          serverCreatedAt: serverTimestamp(),
        }));
        opCount++;
        installmentsCount++;
        await commitBatchIfNeeded();

        // Generate all monthly occurrences
        const generated = generateInstallmentsPlan(
          row.description,
          row.amount,
          count,
          row.referenceMonth,
          catId,
          catName,
          cardId,
          purchaseId,
          currentUser.uid,
          parseInt(row.date.split('-')[2] || '10', 10),
          false,
          cardName
        );

        for (const genExp of generated) {
          const expDocRef = doc(collection(db, 'expenses'));
          currentBatch.set(expDocRef, sanitizeData({
            ...genExp,
            createdAt: nowIso,
            updatedAt: nowIso,
            serverCreatedAt: serverTimestamp(),
          }));
          opCount++;
          totalCreated++;
          await commitBatchIfNeeded();
        }
      } else if (row.type === 'INCOME') {
        const incDocRef = doc(collection(db, 'incomes'));
        currentBatch.set(incDocRef, sanitizeData({
          userId: currentUser.uid,
          description: row.description,
          amount: row.amount,
          referenceMonth: row.referenceMonth,
          date: row.date,
          origin: row.categoryName || 'Planilha Excel',
          status: row.isPaid ? 'RECEIVED' : 'PENDING',
          notes: row.notes,
          createdAt: nowIso,
          updatedAt: nowIso,
          serverCreatedAt: serverTimestamp(),
        }));
        opCount++;
        incomesCount++;
        totalCreated++;
        await commitBatchIfNeeded();
      } else if (row.type === 'SALARY') {
        const salDocRef = doc(collection(db, 'salaries'));
        currentBatch.set(salDocRef, sanitizeData({
          userId: currentUser.uid,
          description: row.description,
          amount: row.amount,
          referenceMonth: row.referenceMonth,
          payDate: row.date,
          status: row.isPaid ? 'RECEIVED' : 'PENDING',
          isStandardDefault: false,
          createdAt: nowIso,
          updatedAt: nowIso,
          serverCreatedAt: serverTimestamp(),
        }));
        opCount++;
        salariesCount++;
        totalCreated++;
        await commitBatchIfNeeded();
      }
    }

    if (opCount > 0) {
      await currentBatch.commit();
    }

    return {
      success: true,
      expensesCount,
      installmentsCount,
      incomesCount,
      salariesCount,
      totalCreated,
      message: `${totalCreated} lançamentos importados e gerados com sucesso no banco de dados!`,
    };
  };

  const loadSampleDemoData = async () => {
    if (!currentUser) return;
    seedDemoData(currentUser.uid);
  };

  return (
    <FinanceContext.Provider
      value={{
        selectedMonth,
        setSelectedMonth,
        goToPreviousMonth,
        goToNextMonth,
        goToCurrentMonth,
        salaries,
        effectiveSalariesForMonth,
        incomes,
        effectiveIncomesForMonth,
        expenses,
        creditCards,
        paymentMethods,
        installmentPurchases,
        categories,
        settings,
        monthSummary,
        cardLimitSummaries,
        monthInstallmentsAndSingleSummary,
        loading,
        error,
        addSalary,
        updateSalary,
        deleteSalary,
        toggleSalaryStatus,
        setDefaultSalary,
        addIncome,
        updateIncome,
        deleteIncome,
        toggleIncomeStatus,
        addExpense,
        updateExpense,
        deleteExpense,
        deleteMultipleExpenses,
        updateMultipleExpensesStatus,
        toggleExpenseStatus,
        addCreditCard,
        updateCreditCard,
        deleteCreditCard,
        addPaymentMethod,
        updatePaymentMethod,
        deletePaymentMethod,
        markAllCardExpensesStatus,
        markAllMethodExpensesStatus,
        createInstallmentPurchase,
        extendIndefinitePurchase,
        deleteInstallmentPurchase,
        interruptInstallmentPurchase,
        addCategory,
        deleteCategory,
        updateSettings,
        filters,
        setFilters,
        resetFilters,
        filteredExpenses,
        exportBackupData,
        importBackupData,
        importSpreadsheetData,
        loadSampleDemoData,
        refreshDataFromPostgres,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
