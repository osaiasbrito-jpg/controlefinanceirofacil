import { pgTable, serial, text, doublePrecision, boolean, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table (PostgreSQL / Auth)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // User UID / Identifier
  email: text('email').notNull(),
  name: text('name'),
  photoUrl: text('photo_url'),
  role: text('role').default('USER'), // 'SUPERADMIN' | 'ADMIN' | 'USER'
  isSuperUser: boolean('is_super_user').default(false),
  password: text('password'), // Direct password or hash
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User Settings
export const userSettings = pgTable('user_settings', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  theme: text('theme').default('system'),
  currency: text('currency').default('BRL'),
  hideValuesByDefault: boolean('hide_values_by_default').default(false),
  enableNotifications: boolean('enable_notifications').default(true),
  dueDayAlertDays: integer('due_day_alert_days').default(3),
  aiAdviceEnabled: boolean('ai_advice_enabled').default(true),
  monthlyIncomeTarget: doublePrecision('monthly_income_target').default(0),
  monthlySavingsTarget: doublePrecision('monthly_savings_target').default(0),
  currentSelectedMonth: text('current_selected_month'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Categories
export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  type: text('type').default('EXPENSE'),
  icon: text('icon'),
  color: text('color'),
  isDefault: boolean('is_default').default(false),
  isArchived: boolean('is_archived').default(false),
  monthlyLimit: doublePrecision('monthly_limit'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Category Budgets
export const budgets = pgTable('budgets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  categoryId: text('category_id').notNull(),
  categoryName: text('category_name').notNull(),
  monthlyLimit: doublePrecision('monthly_limit').notNull(),
  referenceMonth: text('reference_month').default('GLOBAL'),
  alertThresholdPercentage: integer('alert_threshold_percentage').default(80),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Monthly Salaries
export const salaries = pgTable('salaries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  amount: doublePrecision('amount').notNull(),
  referenceMonth: text('reference_month').notNull(), // 'GLOBAL' or 'YYYY-MM'
  description: text('description').default('Salário Mensal'),
  payDay: integer('pay_day').default(5),
  status: text('status').default('RECEIVED'), // 'RECEIVED' or 'PENDING'
  active: boolean('active').default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Extra Incomes
export const extraIncomes = pgTable('extra_incomes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  amount: doublePrecision('amount').notNull(),
  description: text('description').notNull(),
  source: text('source').default('Outros'),
  date: text('date').notNull(), // YYYY-MM-DD
  referenceMonth: text('reference_month'), // YYYY-MM
  status: text('status').default('RECEIVED'), // 'RECEIVED' or 'PENDING'
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Credit Cards
export const creditCards = pgTable('credit_cards', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  brand: text('brand').default('OUTRO'),
  lastDigits: text('last_digits'),
  limitAmount: doublePrecision('limit_amount').notNull().default(0),
  closingDay: integer('closing_day').notNull().default(1),
  dueDay: integer('due_day').notNull().default(10),
  color: text('color').default('#059669'),
  isArchived: boolean('is_archived').default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Custom Payment Methods
export const customPaymentMethods = pgTable('payment_methods', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull().default('OUTROS'),
  details: text('details'),
  color: text('color').default('#0D9488'),
  isActive: boolean('is_active').default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Installment Purchases
export const installmentPurchases = pgTable('installment_purchases', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  totalAmount: doublePrecision('total_amount').notNull(),
  installmentCount: integer('installment_count').notNull(),
  installmentAmount: doublePrecision('installment_amount').notNull(),
  startMonth: text('start_month').notNull(),
  cardId: text('card_id').notNull(),
  cardName: text('card_name'),
  categoryId: text('category_id').notNull(),
  categoryName: text('category_name').notNull(),
  defaultDay: integer('default_day').default(1),
  isIndefinite: boolean('is_indefinite').default(false),
  isInterrupted: boolean('is_interrupted').default(false),
  interruptedMonth: text('interrupted_month'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Expenses
export const expenses = pgTable('expenses', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  description: text('description').notNull(),
  amount: doublePrecision('amount').notNull(),
  categoryId: text('category_id').notNull(),
  categoryName: text('category_name').notNull(),
  paymentMethod: text('payment_method').notNull().default('PIX'),
  paymentMethodId: text('payment_method_id'),
  creditCardId: text('credit_card_id'),
  creditCardName: text('credit_card_name'),
  date: text('date').notNull(), // YYYY-MM-DD
  referenceMonth: text('reference_month'), // YYYY-MM
  status: text('status').notNull().default('PENDENTE'), // 'PAGA' | 'PENDENTE'
  isRecurring: boolean('is_recurring').default(false),
  recurringExpenseId: text('recurring_expense_id'),
  isInstallment: boolean('is_installment').default(false),
  isIndefinite: boolean('is_indefinite').default(false),
  installmentNumber: integer('installment_number'),
  totalInstallments: integer('total_installments'),
  installmentPurchaseId: text('installment_purchase_id'),
  notes: text('notes'),
  invoiceMonth: text('invoice_month'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Backups / Snapshots
export const backups = pgTable('backups', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  backupDate: text('backup_date').notNull(),
  description: text('description'),
  sizeBytes: integer('size_bytes').default(0),
  dataJson: jsonb('data_json').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// System Integrations Log
export const systemIntegrationsLog = pgTable('system_integrations_log', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  systemName: text('system_name').notNull().default('Gestão de Pessoas - Massoterapia'),
  action: text('action').notNull(),
  amount: doublePrecision('amount'),
  clientName: text('client_name'),
  description: text('description'),
  payload: jsonb('payload'),
  response: jsonb('response'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Tabela de Integração Renda Extra (Massoterapia - Gestão de Pacientes)
export const rendaExtra = pgTable('renda_extra', {
  id: text('id').primaryKey(),
  descricao: text('descricao').notNull().default('MASSOTERAPIA'),
  origemRenda: text('origem_renda').notNull().default('SERVIÇO'),
  origem: text('origem').default('SERVIÇO'),
  tipo: text('tipo').default('Renda Extra'),
  categoria: text('categoria').default('Renda Extra'),
  valor: doublePrecision('valor').notNull().default(0.0),
  data: text('data').notNull(),
  mesReferencia: text('mes_referencia').notNull(),
  mes: text('mes'),
  observacao: text('observacao'),
  clientePaciente: text('cliente_paciente'),
  procedimento: text('procedimento'),
  somarAoSalario: boolean('somar_ao_salario').default(true),
  userId: text('user_id').default('osaiasbrito@gmail.com'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  salaries: many(salaries),
  extraIncomes: many(extraIncomes),
  expenses: many(expenses),
  creditCards: many(creditCards),
  categories: many(categories),
  budgets: many(budgets),
  installmentPurchases: many(installmentPurchases),
}));
