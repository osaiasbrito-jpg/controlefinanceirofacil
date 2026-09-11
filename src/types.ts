export type PaymentMethod = 'DINHEIRO' | 'PIX' | 'BOLETO' | 'CARTAO_DEBITO' | 'CARTAO_CREDITO' | 'OUTROS';

export type ExpenseStatus = 'PAGA' | 'PENDENTE';
export type IncomeStatus = 'RECEIVED' | 'PENDING';
export type AppTheme = 'light' | 'dark';

export type UserRole = 'user' | 'super_admin';
export type AccessStatus = 'pending_approval' | 'trial' | 'lifetime' | 'expired' | 'blocked';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phone?: string | null;
  role?: UserRole;
  accessStatus?: AccessStatus;
  trialStartDate?: string;
  trialEndDate?: string;
  lifetimeUnlockedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccessRequest {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  phone?: string;
  status: AccessStatus;
  requestedAt: string;
  trialStartDate?: string;
  trialEndDate?: string;
  approvedAt?: string;
  approvedBy?: string;
  paidAmount?: number;
  paymentId?: string;
  notes?: string;
}

export interface PaymentGatewaySettings {
  id?: string;
  lifetimePrice: number; // Ex: 97.00
  trialDays: number; // Ex: 30
  superAdminEmails: string[];
  
  // PIX Direto
  pixKey: string;
  pixKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';
  pixBeneficiaryName: string;
  pixCity: string;
  pixBankName: string;
  pixDirectEnabled: boolean;

  // Mercado Pago
  mercadoPagoPublicKey: string;
  mercadoPagoAccessToken: string;
  mercadoPagoEnabled: boolean;

  // Stone / Pagar.me
  stoneMerchantId: string;
  stoneApiKey: string;
  stoneEnabled: boolean;

  updatedAt?: string;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  amount: number;
  gateway: 'MERCADO_PAGO' | 'STONE' | 'PIX_DIRECT' | 'SUPER_ADMIN_MANUAL';
  method: 'PIX' | 'CREDIT_CARD' | 'MANUAL';
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  transactionId: string;
  cardLastFour?: string;
  installments?: number;
  details?: string;
  createdAt: string;
  approvedAt?: string;
}

export interface Salary {
  id: string;
  userId: string;
  amount: number;
  referenceMonth: string; // YYYY-MM format
  payDate: string; // YYYY-MM-DD
  description?: string;
  status: IncomeStatus;
  isStandardDefault?: boolean; // Indica se é a regra padrão global ou um ajuste de mês
  repeatMonthly?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExtraIncome {
  id: string;
  userId: string;
  description: string;
  amount: number;
  referenceMonth: string; // YYYY-MM
  date: string; // YYYY-MM-DD
  origin: string; // Freelance, Hora extra, Venda, Serviço, Comissão, Outros, etc.
  status: IncomeStatus;
  isRecurring?: boolean; // true = Padrão / Recorrente para todos os meses; false = Pontual deste mês
  recurrenceDay?: number; // Dia previsto de recebimento todo mês (1-31)
  clientName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  userId: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  referenceMonth: string; // YYYY-MM
  categoryId: string;
  categoryName: string;
  paymentMethod: PaymentMethod;
  paymentMethodId?: string;
  paymentMethodName?: string;
  cardId?: string;
  cardName?: string;
  isInstallment?: boolean;
  isIndefinite?: boolean; // Parcelamento / Recorrência por tempo indeterminado
  installmentPurchaseId?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  isRecurring?: boolean;
  recurringExpenseId?: string;
  invoiceMonth?: string;
  status: ExpenseStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomPaymentMethod {
  id: string;
  userId: string;
  name: string; // Ex: "Pix Nubank", "Pix Inter", "Boleto Financiamento", "Vale Refeição", "Alelo", "Dinheiro Carteira"
  type: 'PIX' | 'BOLETO' | 'CARTAO_DEBITO' | 'DINHEIRO' | 'OUTROS';
  details?: string; // Chave pix, número de conta, observações
  color: string;
  icon?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreditCard {
  id: string;
  userId: string;
  name: string;
  bank: string;
  totalLimit: number;
  closingDay: number; // 1-31
  dueDay: number; // 1-31
  color: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InstallmentPurchase {
  id: string;
  userId: string;
  title: string;
  totalAmount: number;
  installmentCount: number;
  monthlyAmount?: number;
  isIndefinite?: boolean; // Tempo indeterminado
  isInterrupted?: boolean; // Se foi interrompido pelo usuário
  interruptedAt?: string;
  interruptedMonth?: string; // Mês em que foi interrompido
  startMonth: string; // YYYY-MM
  cardId: string;
  cardName?: string;
  categoryId: string;
  categoryName: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'INTERRUPTED';
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  userId: string; // 'system' for defaults, or specific userId
  name: string;
  icon: string;
  color: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryBudget {
  id: string;
  userId: string;
  categoryId: string; // ID da categoria ou 'GLOBAL'
  categoryName: string;
  monthlyLimit: number; // Meta limite em R$
  referenceMonth?: string; // 'GLOBAL' (padrão para todos os meses) ou 'YYYY-MM'
  alertThresholdPercentage?: number; // Ex: 80 para alertar aos 80% do limite
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetExecutionItem {
  budgetId?: string;
  categoryId: string;
  categoryName: string;
  icon?: string;
  color?: string;
  monthlyLimit: number;
  spentAmount: number;
  remainingAmount: number;
  percentageUsed: number;
  status: 'NORMAL' | 'WARNING' | 'EXCEEDED'; // NORMAL (< threshold), WARNING (threshold a 100%), EXCEEDED (> 100%)
  alertThresholdPercentage: number;
  isCustom: boolean; // se o usuário definiu uma meta explícita
  referenceMonth?: string;
}

export interface MonthBudgetSummary {
  referenceMonth: string;
  totalBudgeted: number;
  totalSpent: number;
  totalRemaining: number;
  overallPercentage: number;
  normalCount: number;
  warningCount: number;
  exceededCount: number;
  hasBudgets: boolean;
  items: BudgetExecutionItem[];
  criticalAlerts: BudgetExecutionItem[]; // Apenas itens em WARNING ou EXCEEDED
}

export interface MonthInstallmentsAndSingleSummary {
  referenceMonth: string;
  // Todas as parcelas ativas no mês
  allInstallmentsTotal: number;
  allInstallmentsCount: number;
  allInstallments: Expense[];
  // Últimas parcelas (finalizando este mês)
  lastInstallmentsTotal: number;
  lastInstallmentsCount: number;
  lastInstallments: Expense[];
  // Compras à vista (geral)
  singleExpensesTotal: number;
  singleExpensesCount: number;
  singleExpenses: Expense[];
  // Compras à vista no cartão de crédito
  singleCardExpensesTotal: number;
  singleCardExpensesCount: number;
  // Compras à vista em outros métodos (Pix, Boleto, Débito, Dinheiro, etc.)
  singleOtherExpensesTotal: number;
  singleOtherExpensesCount: number;
  // Total combinado (Parcelas + Compras à vista)
  combinedTotal: number;
  combinedCount: number;
  // Total de despesas não-recorrentes (Últimas Parcelas + Compras à Vista)
  nonRecurringTotal?: number;
  nonRecurringCount?: number;
}

export interface UserSettings {
  userId: string;
  theme: AppTheme;
  currency: string;
  alertThresholdPercentage: number; // e.g. 80 (%)
  emailNotifications: boolean;
  // Salário Padronizado para todos os meses
  defaultSalaryAmount?: number;
  defaultSalaryPayDay?: number; // 1-31
  defaultSalaryDescription?: string;
  defaultSalaryStatus?: IncomeStatus;
  defaultSalaryActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MonthFinancialSummary {
  referenceMonth: string;
  totalSalary: number;
  receivedSalary: number;
  pendingSalary: number;
  totalExtraIncome: number;
  receivedExtraIncome: number;
  pendingExtraIncome: number;
  totalRevenue: number; // Salário + Renda Extra
  receivedRevenue: number;
  pendingRevenue: number;
  totalExpenses: number;
  paidExpenses: number;
  pendingExpenses: number;
  salaryBalance: number; // Salário - Total de Despesas (ou despesas do mês)
  totalBalance: number; // Receita Total - Total de Despesas
  currentEffectiveBalance: number; // Receitas Recebidas - Despesas Pagas
  creditCardInvoiceTotal: number; // Total gastos em cartão neste mês
  expensesCount: number;
}

export interface CardLimitSummary {
  card: CreditCard;
  totalLimit: number;
  usedLimit: number; // Total de faturas pendentes e parcelas futuras em aberto
  currentMonthInvoice: number;
  availableLimit: number;
  usagePercentage: number;
}

export interface ExpenseFilters {
  searchQuery: string;
  referenceMonth: string; // 'ALL' or 'YYYY-MM'
  year: string; // 'ALL' or 'YYYY'
  categoryId: string; // 'ALL' or specific
  paymentMethod: string; // 'ALL' or specific
  cardId: string; // 'ALL' or specific
  status: string; // 'ALL' | 'PAGA' | 'PENDENTE'
  installmentType?: 'ALL' | 'A_VISTA' | 'PARCELADA';
  minAmount?: number;
  maxAmount?: number;
}

export interface BackupData {
  version: string;
  exportedAt: string;
  userId: string;
  userEmail?: string;
  salaries: Salary[];
  incomes: ExtraIncome[];
  expenses: Expense[];
  creditCards: CreditCard[];
  installmentPurchases: InstallmentPurchase[];
  categories: Category[];
  budgets?: CategoryBudget[];
  settings?: UserSettings;
}

export type ActiveTab = 
  | 'dashboard'
  | 'receitas'
  | 'salario'
  | 'renda-extra'
  | 'despesas'
  | 'orcamento'
  | 'cartoes'
  | 'parcelamentos'
  | 'categorias'
  | 'relatorios'
  | 'backup'
  | 'configuracoes'
  | 'perfil'
  | 'super-admin';

export interface GeminiSavingsTip {
  title: string;
  description: string;
  category: string;
  impact?: 'alto' | 'medio' | 'baixo' | string;
}

export interface GeminiFinancialAnalysis {
  score: number; // 0 - 100
  status: 'excelente' | 'bom' | 'atencao' | 'critico' | string;
  statusLabel: string;
  summary: string;
  highlightInsight: string;
  potentialMonthlySavings: number;
  savingsTips: GeminiSavingsTip[];
  analyzedAt?: string;
  source?: string;
}

