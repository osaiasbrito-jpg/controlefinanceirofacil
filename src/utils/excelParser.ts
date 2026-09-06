import * as XLSX from 'xlsx';
import { Expense, InstallmentPurchase, ExtraIncome, Salary, Category, CreditCard } from '../types';
import { getCurrentMonth, getAdjacentMonth } from './formatters';

export interface ParsedSpreadsheetItem {
  id: string;
  type: 'EXPENSE' | 'INSTALLMENT' | 'INCOME' | 'SALARY';
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  referenceMonth: string; // YYYY-MM
  categoryName: string;
  paymentMethod: 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'BOLETO' | 'DINHEIRO';
  cardName?: string;
  installmentCount?: number;
  currentInstallment?: number;
  isPaid: boolean;
  notes?: string;
  rawRow: Record<string, any>;
  isValid: boolean;
  validationError?: string;
}

export interface SpreadsheetParseResult {
  sheetNames: string[];
  activeSheetName: string;
  totalRows: number;
  validItems: ParsedSpreadsheetItem[];
  invalidItems: ParsedSpreadsheetItem[];
  detectedColumns: string[];
  columnMapping: Record<string, string>;
  stats: {
    expensesCount: number;
    installmentsCount: number;
    incomesCount: number;
    totalExpensesAmount: number;
    totalInstallmentsAmount: number;
    totalIncomesAmount: number;
  };
}

// Convert Excel date value (number or string) to YYYY-MM-DD
export function normalizeExcelDate(value: any): { date: string; referenceMonth: string; day: number } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
  const fallbackDate = `${currentYear}-${currentMonthStr}-10`;
  const fallbackMonth = `${currentYear}-${currentMonthStr}`;

  if (value === null || value === undefined || value === '') {
    return { date: fallbackDate, referenceMonth: fallbackMonth, day: 10 };
  }

  // 1. If it is an Excel serial date number (e.g. 45321)
  if (typeof value === 'number' && value > 1000) {
    try {
      const dateObj = XLSX.SSF.parse_date_code(value);
      if (dateObj) {
        const y = dateObj.y;
        const m = String(dateObj.m).padStart(2, '0');
        const d = String(dateObj.d).padStart(2, '0');
        return {
          date: `${y}-${m}-${d}`,
          referenceMonth: `${y}-${m}`,
          day: dateObj.d,
        };
      }
    } catch {
      // ignore
    }
  }

  // 2. If it's already a JS Date
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return {
      date: `${y}-${m}-${d}`,
      referenceMonth: `${y}-${m}`,
      day: value.getDate(),
    };
  }

  // 3. If it's a string (e.g. "15/03/2026", "2026-03-15", "03/2026", "15/03")
  const str = String(value).trim();

  // Pattern DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10);
    const year = parseInt(ddmmyyyyMatch[3], 10);
    const mStr = String(month).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    return {
      date: `${year}-${mStr}-${dStr}`,
      referenceMonth: `${year}-${mStr}`,
      day,
    };
  }

  // Pattern YYYY-MM-DD
  const yyyymmddMatch = str.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})$/);
  if (yyyymmddMatch) {
    const year = parseInt(yyyymmddMatch[1], 10);
    const month = parseInt(yyyymmddMatch[2], 10);
    const day = parseInt(yyyymmddMatch[3], 10);
    const mStr = String(month).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    return {
      date: `${year}-${mStr}-${dStr}`,
      referenceMonth: `${year}-${mStr}`,
      day,
    };
  }

  // Pattern MM/YYYY
  const mmyyyyMatch = str.match(/^(\d{1,2})[\/\.-](\d{4})$/);
  if (mmyyyyMatch) {
    const month = parseInt(mmyyyyMatch[1], 10);
    const year = parseInt(mmyyyyMatch[2], 10);
    const mStr = String(month).padStart(2, '0');
    return {
      date: `${year}-${mStr}-10`,
      referenceMonth: `${year}-${mStr}`,
      day: 10,
    };
  }

  // Pattern DD/MM (assume current year)
  const ddmmMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})$/);
  if (ddmmMatch) {
    const day = parseInt(ddmmMatch[1], 10);
    const month = parseInt(ddmmMatch[2], 10);
    const mStr = String(month).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    return {
      date: `${currentYear}-${mStr}-${dStr}`,
      referenceMonth: `${currentYear}-${mStr}`,
      day,
    };
  }

  return { date: fallbackDate, referenceMonth: fallbackMonth, day: 10 };
}

// Convert monetary text/number to float
export function normalizeExcelAmount(value: any): number {
  if (typeof value === 'number') {
    return Math.abs(value);
  }
  if (!value) return 0;

  let str = String(value).trim();
  // Remove currency symbol, whitespace, quotes
  str = str.replace(/R\$/gi, '').replace(/\s/g, '').replace(/["']/g, '');

  // Handle format like "1.250,50" -> "1250.50"
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // Brazilian standard: 1.250,50
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // US standard: 1,250.50
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Only comma: 250,50
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.abs(num);
}

// Normalize payment method
export function normalizePaymentMethod(value: any): 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'BOLETO' | 'DINHEIRO' {
  if (!value) return 'PIX';
  const str = String(value).toUpperCase().trim();

  if (str.includes('CRÉDITO') || str.includes('CREDITO') || str.includes('CARTAO DE CREDITO') || str.includes('CARD') || str.includes('PARCELA')) {
    return 'CARTAO_CREDITO';
  }
  if (str.includes('DÉBITO') || str.includes('DEBITO')) {
    return 'CARTAO_DEBITO';
  }
  if (str.includes('BOLETO') || str.includes('FATURA')) {
    return 'BOLETO';
  }
  if (str.includes('DINHEIRO') || str.includes('ESPECIE') || str.includes('CASH')) {
    return 'DINHEIRO';
  }
  return 'PIX';
}

// Helper to find best matching column in raw keys
export function findColumnMatch(keys: string[], targetKeywords: string[]): string | undefined {
  const cleanKeys = keys.map((k) => ({
    original: k,
    normalized: k
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ''),
  }));

  for (const kw of targetKeywords) {
    const normKw = kw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

    // Exact match
    const exact = cleanKeys.find((c) => c.normalized === normKw);
    if (exact) return exact.original;

    // Partial contains match
    const partial = cleanKeys.find((c) => c.normalized.includes(normKw) || normKw.includes(c.normalized));
    if (partial) return partial.original;
  }

  return undefined;
}

// Auto detect column mapping from headers
export function detectColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  const dateCol = findColumnMatch(headers, ['data', 'vencimento', 'datacompra', 'datavencimento', 'dia', 'mes', 'periodo']);
  if (dateCol) mapping['date'] = dateCol;

  const descCol = findColumnMatch(headers, ['descricao', 'nome', 'item', 'historico', 'titulo', 'lancamento', 'detalhes']);
  if (descCol) mapping['description'] = descCol;

  const amountCol = findColumnMatch(headers, ['valor', 'total', 'preco', 'valortotal', 'quantia', 'valordaoperacao', 'valordaparcela']);
  if (amountCol) mapping['amount'] = amountCol;

  const catCol = findColumnMatch(headers, ['categoria', 'classificacao', 'tipo', 'grupo', 'departamento']);
  if (catCol) mapping['category'] = catCol;

  const methodCol = findColumnMatch(headers, ['formadepagamento', 'pagamento', 'meio', 'metodo', 'formapagamento', 'tipopagamento']);
  if (methodCol) mapping['paymentMethod'] = methodCol;

  const cardCol = findColumnMatch(headers, ['cartao', 'nomecartao', 'bandeira', 'cartaocredito', 'banco']);
  if (cardCol) mapping['cardName'] = cardCol;

  const installmentsCol = findColumnMatch(headers, ['parcelas', 'qtdparcelas', 'numparcelas', 'totalparcelas', 'parcelamento', 'nparcelas']);
  if (installmentsCol) mapping['installmentCount'] = installmentsCol;

  const currentInstCol = findColumnMatch(headers, ['parcelaatual', 'numparcela', 'parcela', 'nparcela']);
  if (currentInstCol) mapping['currentInstallment'] = currentInstCol;

  const statusCol = findColumnMatch(headers, ['status', 'pago', 'situacao', 'quitado', 'estadopagamento']);
  if (statusCol) mapping['status'] = statusCol;

  const notesCol = findColumnMatch(headers, ['observacao', 'obs', 'notas', 'comentarios', 'detalhe']);
  if (notesCol) mapping['notes'] = notesCol;

  const typeCol = findColumnMatch(headers, ['tipolancamento', 'natureza', 'operacao', 'receitaoudespesa']);
  if (typeCol) mapping['type'] = typeCol;

  return mapping;
}

// Parse an entire Excel workbook buffer
export function parseExcelWorkbook(
  arrayBuffer: ArrayBuffer,
  targetSheetName?: string,
  customMapping?: Record<string, string>
): SpreadsheetParseResult {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const sheetNames = workbook.SheetNames;
  const activeSheet = targetSheetName && sheetNames.includes(targetSheetName) ? targetSheetName : sheetNames[0];
  const worksheet = workbook.Sheets[activeSheet];

  // Convert to JSON array of objects
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,
    dateNF: 'yyyy-mm-dd',
  });

  const detectedColumns: string[] = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
  const columnMapping = { ...detectColumnMapping(detectedColumns), ...(customMapping || {}) };

  const validItems: ParsedSpreadsheetItem[] = [];
  const invalidItems: ParsedSpreadsheetItem[] = [];

  let totalExpensesAmount = 0;
  let totalInstallmentsAmount = 0;
  let totalIncomesAmount = 0;
  let expensesCount = 0;
  let installmentsCount = 0;
  let incomesCount = 0;

  rawRows.forEach((row, index) => {
    const rawDesc = columnMapping['description'] ? row[columnMapping['description']] : row['Descrição'] || row['Descricao'] || row['Nome'] || row['Item'] || '';
    const rawAmount = columnMapping['amount'] ? row[columnMapping['amount']] : row['Valor'] || row['Total'] || row['Preço'] || '';
    const rawDate = columnMapping['date'] ? row[columnMapping['date']] : row['Data'] || row['Vencimento'] || row['Mês'] || '';
    const rawCat = columnMapping['category'] ? row[columnMapping['category']] : row['Categoria'] || row['Classificação'] || 'Geral';
    const rawMethod = columnMapping['paymentMethod'] ? row[columnMapping['paymentMethod']] : row['Forma de Pagamento'] || row['Pagamento'] || '';
    const rawCard = columnMapping['cardName'] ? row[columnMapping['cardName']] : row['Cartão'] || row['Cartao'] || '';
    const rawInstCount = columnMapping['installmentCount'] ? row[columnMapping['installmentCount']] : row['Parcelas'] || row['Qtd Parcelas'] || '';
    const rawCurrentInst = columnMapping['currentInstallment'] ? row[columnMapping['currentInstallment']] : row['Parcela'] || row['Parcela Atual'] || '';
    const rawStatus = columnMapping['status'] ? row[columnMapping['status']] : row['Status'] || row['Pago'] || row['Situação'] || '';
    const rawNotes = columnMapping['notes'] ? row[columnMapping['notes']] : row['Observação'] || row['Obs'] || '';
    const rawType = columnMapping['type'] ? row[columnMapping['type']] : row['Tipo'] || '';

    const description = String(rawDesc || '').trim();
    const amount = normalizeExcelAmount(rawAmount);
    const { date, referenceMonth } = normalizeExcelDate(rawDate);
    const categoryName = String(rawCat || 'Outros').trim() || 'Outros';
    const catLower = categoryName.toLowerCase();
    let paymentMethod = normalizePaymentMethod(rawMethod || (rawCard ? 'CARTAO_CREDITO' : ''));
    if (catLower === 'pix' || /\bpix\b/i.test(catLower)) {
      paymentMethod = 'PIX';
    } else if (catLower === 'boleto' || /\bboleto\b/i.test(catLower)) {
      paymentMethod = 'BOLETO';
    } else if (catLower.includes('debito') || catLower.includes('débito')) {
      paymentMethod = 'CARTAO_DEBITO';
    } else if (catLower.includes('dinheiro') || catLower.includes('especie') || catLower.includes('espécie')) {
      paymentMethod = 'DINHEIRO';
    }
    const cardName = paymentMethod === 'CARTAO_CREDITO' && rawCard ? String(rawCard).trim() : undefined;
    const notes = rawNotes ? String(rawNotes).trim() : undefined;

    // Detect paid status
    const statusStr = String(rawStatus || '').toUpperCase().trim();
    const isPaid = statusStr === 'SIM' || statusStr === 'PAGO' || statusStr === 'PAGA' || statusStr === 'QUITADO' || statusStr === 'TRUE' || statusStr === '1';

    // Detect installment count / future entry
    let installmentCount = 1;
    let currentInstallment = 1;

    // Look at installment count field or description formatted like "Notebook 2/10" or "3x"
    if (rawInstCount) {
      const matchNumber = String(rawInstCount).match(/(\d+)/);
      if (matchNumber) {
        installmentCount = parseInt(matchNumber[1], 10);
      }
    }

    // Check if description has "1/10" or "2/12" or "3x"
    const slashMatch = description.match(/(\d+)\s*[\/]\s*(\d+)/);
    if (slashMatch) {
      currentInstallment = parseInt(slashMatch[1], 10);
      installmentCount = Math.max(installmentCount, parseInt(slashMatch[2], 10));
    } else {
      const xMatch = description.match(/(\d+)\s*x/i);
      if (xMatch) {
        installmentCount = Math.max(installmentCount, parseInt(xMatch[1], 10));
      }
    }

    if (rawCurrentInst) {
      const matchCur = String(rawCurrentInst).match(/(\d+)/);
      if (matchCur) currentInstallment = parseInt(matchCur[1], 10);
    }

    // Determine type: INCOME, SALARY, INSTALLMENT, or standard EXPENSE
    const typeLower = String(rawType || '').toLowerCase();
    const descLower = description.toLowerCase();
    let type: 'EXPENSE' | 'INSTALLMENT' | 'INCOME' | 'SALARY' = 'EXPENSE';

    if (typeLower.includes('salario') || typeLower.includes('salário') || descLower.includes('salário') || descLower.includes('salario mensal')) {
      type = 'SALARY';
    } else if (typeLower.includes('receita') || typeLower.includes('renda') || typeLower.includes('entrada') || descLower.includes('freelance') || descLower.includes('renda extra')) {
      type = 'INCOME';
    } else if (installmentCount > 1 || typeLower.includes('parcela') || typeLower.includes('futuro') || typeLower.includes('parcelamento')) {
      type = 'INSTALLMENT';
    }

    const isValid = !!(description && amount > 0);
    const validationError = !description ? 'Descrição ausente' : amount <= 0 ? 'Valor inválido ou zerado' : undefined;

    const item: ParsedSpreadsheetItem = {
      id: `row-${index + 1}-${Date.now()}`,
      type,
      description: description || `Item Linha ${index + 1}`,
      amount,
      date,
      referenceMonth,
      categoryName,
      paymentMethod,
      cardName,
      installmentCount: installmentCount > 1 ? installmentCount : undefined,
      currentInstallment: installmentCount > 1 ? currentInstallment : undefined,
      isPaid,
      notes,
      rawRow: row,
      isValid,
      validationError,
    };

    if (isValid) {
      validItems.push(item);
      if (type === 'EXPENSE') {
        expensesCount++;
        totalExpensesAmount += amount;
      } else if (type === 'INSTALLMENT') {
        installmentsCount++;
        totalInstallmentsAmount += amount;
      } else {
        incomesCount++;
        totalIncomesAmount += amount;
      }
    } else {
      invalidItems.push(item);
    }
  });

  return {
    sheetNames,
    activeSheetName: activeSheet,
    totalRows: rawRows.length,
    validItems,
    invalidItems,
    detectedColumns,
    columnMapping,
    stats: {
      expensesCount,
      installmentsCount,
      incomesCount,
      totalExpensesAmount,
      totalInstallmentsAmount,
      totalIncomesAmount,
    },
  };
}

// Generate a downloadable Brazilian Excel template (.xlsx) with sample data
export function generateSampleExcelTemplate(): void {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Despesas e Lançamentos
  const expensesData = [
    {
      'Data': '05/03/2026',
      'Descrição': 'Supermercado Mensal',
      'Valor': 650.0,
      'Categoria': 'Alimentação',
      'Forma de Pagamento': 'Cartão de Débito',
      'Cartão / Banco': 'Nubank Débito',
      'Parcelas': '1',
      'Status': 'Pago',
      'Observação': 'Compras do mês',
    },
    {
      'Data': '10/03/2026',
      'Descrição': 'Conta de Energia Elétrica',
      'Valor': 185.40,
      'Categoria': 'Moradia',
      'Forma de Pagamento': 'Pix',
      'Cartão / Banco': 'Inter',
      'Parcelas': '1',
      'Status': 'Pendente',
      'Observação': 'Vencimento dia 10',
    },
    {
      'Data': '12/03/2026',
      'Descrição': 'Smartphone Galaxy S24',
      'Valor': 3200.0,
      'Categoria': 'Tecnologia',
      'Forma de Pagamento': 'Cartão de Crédito',
      'Cartão / Banco': 'Mastercard Black',
      'Parcelas': '10',
      'Status': 'Pendente',
      'Observação': 'Compra parcelada em 10x de R$ 320,00',
    },
    {
      'Data': '15/03/2026',
      'Descrição': 'Combustível Posto Ipiranga',
      'Valor': 220.0,
      'Categoria': 'Transporte',
      'Forma de Pagamento': 'Pix',
      'Cartão / Banco': '',
      'Parcelas': '1',
      'Status': 'Pago',
      'Observação': 'Gasolina aditivada',
    },
    {
      'Data': '20/03/2026',
      'Descrição': 'Geladeira Frost Free',
      'Valor': 2800.0,
      'Categoria': 'Moradia',
      'Forma de Pagamento': 'Cartão de Crédito',
      'Cartão / Banco': 'Visa Platinum',
      'Parcelas': '8',
      'Status': 'Pendente',
      'Observação': '8x de R$ 350,00 lançadas automaticamente',
    },
  ];

  const wsExpenses = XLSX.utils.json_to_sheet(expensesData);
  // Column widths
  wsExpenses['!cols'] = [
    { wch: 14 },
    { wch: 30 },
    { wch: 14 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 10 },
    { wch: 12 },
    { wch: 35 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsExpenses, 'Despesas e Parcelamentos');

  // Sheet 2: Rendas e Receitas
  const incomesData = [
    {
      'Data': '05/03/2026',
      'Descrição': 'Salário Empresa Principal',
      'Valor': 5500.0,
      'Tipo': 'Salário',
      'Status': 'Recebido',
      'Observação': 'Salário líquido',
    },
    {
      'Data': '15/03/2026',
      'Descrição': 'Projeto Freelance Website',
      'Valor': 1200.0,
      'Tipo': 'Renda Extra',
      'Status': 'Recebido',
      'Observação': 'Desenvolvimento landing page',
    },
  ];

  const wsIncomes = XLSX.utils.json_to_sheet(incomesData);
  wsIncomes['!cols'] = [
    { wch: 14 },
    { wch: 30 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsIncomes, 'Receitas e Salários');

  // Trigger download
  XLSX.writeFile(workbook, 'modelo-importacao-meu-controle-financeiro.xlsx');
}
