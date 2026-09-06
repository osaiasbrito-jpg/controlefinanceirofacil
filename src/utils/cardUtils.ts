import { Category, CreditCard, CustomPaymentMethod, Expense, PaymentMethod } from '../types';

export interface CanonicalCardInfo {
  canonicalId: string;
  canonicalName: string;
  bank: string;
  color: string;
  isRegistered: boolean;
  registeredCard?: CreditCard;
}

// Helpers com regex segura (com delimitadores de palavra \b) para não casar substrings genéricas
const isInterMatch = (s: string) =>
  (/\b(banco\s*inter|cartao\s*inter|intermedium)\b/i.test(s) || (/\binter\b/i.test(s) && !/\b(internet|internacional|interior|interesse)\b/i.test(s)));

const isMercadoPagoMatch = (s: string) =>
  (/\b(mercado\s*pago|mercadopago)\b/i.test(s) || /\bmp\b/i.test(s));

const isNubankMatch = (s: string) =>
  (/\b(nubank|nu\s*bank|roxinho)\b/i.test(s) || /\bnu\b/i.test(s));

const isItauMatch = (s: string) =>
  /\b(ita[uú]|itaucard|credicard)\b/i.test(s);

const isBradescoMatch = (s: string) =>
  /\b(bradesco|bradescard|next)\b/i.test(s);

const isSantanderMatch = (s: string) =>
  /\b(santander|cartao\s*way)\b/i.test(s);

const isC6Match = (s: string) =>
  /\b(c6|c6\s*bank|c6bank)\b/i.test(s);

const isCaixaMatch = (s: string) =>
  /\b(caixa|caixa\s*econ[oô]mica|cef)\b/i.test(s);

const isBancoDoBrasilMatch = (s: string) =>
  (/\b(banco\s*do\s*brasil|ourocard)\b/i.test(s) || /\bbb\b/i.test(s));

/**
 * Identifica se uma despesa é do tipo PIX considerando paymentMethod,
 * cardName, cardId, categoryName, categoryId, paymentMethodName ou descrição/notas.
 */
export function isPixExpense(
  expense: Partial<Expense>,
  categories: Category[] = []
): boolean {
  if (!expense) return false;

  // 1. Check explicit paymentMethod
  if (expense.paymentMethod === 'PIX') return true;

  // 2. Check cardName & cardId
  const cardName = (expense.cardName || '').toLowerCase().trim();
  if (cardName === 'pix' || /\bpix\b/i.test(cardName)) return true;

  const cardId = (expense.cardId || '').toLowerCase().trim();
  if (cardId === 'default-pm-pix' || cardId === 'pix' || cardId.includes('pix')) return true;

  // 3. Check paymentMethodId & paymentMethodName
  const pmId = (expense.paymentMethodId || '').toLowerCase().trim();
  if (pmId === 'default-pm-pix' || pmId === 'pix' || pmId.includes('pix')) return true;

  const pmName = (expense.paymentMethodName || '').toLowerCase().trim();
  if (pmName === 'pix' || /\bpix\b/i.test(pmName)) return true;

  // 4. Check categoryName
  const catName = (expense.categoryName || '').toLowerCase().trim();
  if (catName === 'pix' || /\bpix\b/i.test(catName)) return true;

  // 5. Check category by categoryId
  if (expense.categoryId && categories.length > 0) {
    const cat = categories.find((c) => c.id === expense.categoryId);
    if (cat) {
      const cName = cat.name.toLowerCase().trim();
      if (cName === 'pix' || /\bpix\b/i.test(cName)) return true;
    }
  }

  // 6. Check description or notes if marked as Pix
  const desc = (expense.description || '').toLowerCase();
  const notes = (expense.notes || '').toLowerCase();
  if (
    (/\bpix\b/i.test(desc) && (desc.startsWith('pix') || desc.includes('[pix]') || desc.includes('(pix)') || desc.includes('via pix') || desc.includes('no pix'))) ||
    (/\bpix\b/i.test(notes) && (notes.includes('chave pix') || notes.includes('via pix') || notes.includes('[pix]') || notes.includes('pago com pix') || notes.includes('pagamento pix')))
  ) {
    return true;
  }

  return false;
}

export function isBoletoExpense(
  expense: Partial<Expense>,
  categories: Category[] = []
): boolean {
  if (!expense) return false;
  if (expense.paymentMethod === 'BOLETO') return true;

  const cardName = (expense.cardName || '').toLowerCase().trim();
  if (cardName.includes('boleto')) return true;

  const cardId = (expense.cardId || '').toLowerCase().trim();
  if (cardId.includes('boleto')) return true;

  const pmId = (expense.paymentMethodId || '').toLowerCase().trim();
  if (pmId.includes('boleto')) return true;

  const pmName = (expense.paymentMethodName || '').toLowerCase().trim();
  if (pmName.includes('boleto')) return true;

  const catName = (expense.categoryName || '').toLowerCase().trim();
  if (catName.includes('boleto')) return true;

  if (expense.categoryId && categories.length > 0) {
    const cat = categories.find((c) => c.id === expense.categoryId);
    if (cat && cat.name.toLowerCase().includes('boleto')) return true;
  }

  const desc = (expense.description || '').toLowerCase();
  const notes = (expense.notes || '').toLowerCase();
  if (desc.includes('boleto') || notes.includes('boleto')) return true;

  return false;
}

export function isDebitExpense(
  expense: Partial<Expense>,
  categories: Category[] = []
): boolean {
  if (!expense) return false;
  if (expense.paymentMethod === 'CARTAO_DEBITO') return true;

  const cardName = (expense.cardName || '').toLowerCase().trim();
  if (cardName.includes('debito') || cardName.includes('débito')) return true;

  const cardId = (expense.cardId || '').toLowerCase().trim();
  if (cardId.includes('debito') || cardId.includes('débito')) return true;

  const pmId = (expense.paymentMethodId || '').toLowerCase().trim();
  if (pmId.includes('debito') || pmId.includes('débito')) return true;

  const pmName = (expense.paymentMethodName || '').toLowerCase().trim();
  if (pmName.includes('debito') || pmName.includes('débito')) return true;

  const catName = (expense.categoryName || '').toLowerCase().trim();
  if (catName.includes('debito') || catName.includes('débito')) return true;

  if (expense.categoryId && categories.length > 0) {
    const cat = categories.find((c) => c.id === expense.categoryId);
    if (cat && (cat.name.toLowerCase().includes('debito') || cat.name.toLowerCase().includes('débito'))) return true;
  }

  const desc = (expense.description || '').toLowerCase();
  const notes = (expense.notes || '').toLowerCase();
  if (desc.includes('débito') || desc.includes('debito') || notes.includes('débito') || notes.includes('debito')) return true;

  return false;
}

export function isCashExpense(
  expense: Partial<Expense>,
  categories: Category[] = []
): boolean {
  if (!expense) return false;
  if (expense.paymentMethod === 'DINHEIRO') return true;

  const cardName = (expense.cardName || '').toLowerCase().trim();
  if (cardName.includes('dinheiro') || cardName.includes('especie') || cardName.includes('espécie')) return true;

  const cardId = (expense.cardId || '').toLowerCase().trim();
  if (cardId.includes('dinheiro') || cardId.includes('especie') || cardId.includes('espécie')) return true;

  const pmId = (expense.paymentMethodId || '').toLowerCase().trim();
  if (pmId.includes('dinheiro') || pmId.includes('especie') || pmId.includes('espécie')) return true;

  const pmName = (expense.paymentMethodName || '').toLowerCase().trim();
  if (pmName.includes('dinheiro') || pmName.includes('especie') || pmName.includes('espécie')) return true;

  const catName = (expense.categoryName || '').toLowerCase().trim();
  if (catName.includes('dinheiro') || catName.includes('especie') || catName.includes('espécie')) return true;

  if (expense.categoryId && categories.length > 0) {
    const cat = categories.find((c) => c.id === expense.categoryId);
    if (cat && (cat.name.toLowerCase().includes('dinheiro') || cat.name.toLowerCase().includes('especie') || cat.name.toLowerCase().includes('espécie'))) return true;
  }

  const desc = (expense.description || '').toLowerCase();
  const notes = (expense.notes || '').toLowerCase();
  if (desc.includes('dinheiro') || desc.includes('em espécie') || notes.includes('dinheiro') || notes.includes('em espécie')) return true;

  return false;
}

/**
 * Retorna a forma de pagamento efetiva de uma despesa, dando prioridade
 * a PIX, Boleto, Débito e Dinheiro caso identificados na categoria ou meio.
 */
export function resolveEffectivePaymentMethod(
  expense: Partial<Expense>,
  categories: Category[] = [],
  registeredCards: CreditCard[] = []
): PaymentMethod {
  if (isPixExpense(expense, categories)) return 'PIX';
  if (isBoletoExpense(expense, categories)) return 'BOLETO';
  if (isDebitExpense(expense, categories)) return 'CARTAO_DEBITO';
  if (isCashExpense(expense, categories)) return 'DINHEIRO';

  if (expense.paymentMethod === 'CARTAO_CREDITO') {
    return 'CARTAO_CREDITO';
  }

  if (expense.cardId || expense.cardName) {
    const canonical = getCanonicalCardInfo(expense.cardId, expense.cardName, registeredCards);
    if (canonical.isRegistered) {
      return 'CARTAO_CREDITO';
    }
  }

  return expense.paymentMethod || 'PIX';
}

/**
 * Verifica se uma despesa pertence a uma forma de pagamento específica (Pix, Boleto, etc.)
 */
export function isExpenseMatchingPaymentMethod(
  expense: Expense,
  targetMethod: PaymentMethod,
  targetMethodId?: string,
  categories: Category[] = [],
  paymentMethods: CustomPaymentMethod[] = [],
  registeredCards: CreditCard[] = []
): boolean {
  if (targetMethodId) {
    if (expense.paymentMethodId === targetMethodId) return true;
    const pm = paymentMethods.find((p) => p.id === targetMethodId);
    if (pm && expense.paymentMethodName && expense.paymentMethodName.toLowerCase() === pm.name.toLowerCase()) {
      return true;
    }
  }

  if (targetMethod === 'PIX') {
    return isPixExpense(expense, categories);
  }
  if (targetMethod === 'BOLETO') {
    return isBoletoExpense(expense, categories);
  }
  if (targetMethod === 'CARTAO_DEBITO') {
    return isDebitExpense(expense, categories);
  }
  if (targetMethod === 'DINHEIRO') {
    return isCashExpense(expense, categories);
  }

  const effective = resolveEffectivePaymentMethod(expense, categories, registeredCards);
  return effective === targetMethod;
}

/**
 * Normaliza e consolida variações de nomes de cartões (ex: "INTER", "BANCO INTER", "Banco Inter S.A.")
 * e associa com os cartões de crédito cadastrados pelo usuário.
 */
export function getCanonicalCardInfo(
  cardId?: string,
  cardName?: string,
  registeredCards: CreditCard[] = []
): CanonicalCardInfo {
  const rawName = (cardName || '').trim();
  const lowerName = rawName.toLowerCase();

  // 1. Tentar encontrar por ID exato no cadastro
  if (cardId) {
    const matchedById = registeredCards.find((c) => c.id === cardId);
    if (matchedById) {
      return {
        canonicalId: matchedById.id,
        canonicalName: matchedById.name.toUpperCase(),
        bank: matchedById.bank || 'Crédito',
        color: matchedById.color || '#8B5CF6',
        isRegistered: true,
        registeredCard: matchedById,
      };
    }
  }

  // 2. Tentar match inteligente nos cartões cadastrados pelo nome
  if (rawName) {
    const matchedByName = registeredCards.find((c) => {
      const cLower = c.name.toLowerCase().trim();
      if (cLower === lowerName) return true;
      if (isInterMatch(cLower) && isInterMatch(lowerName)) return true;
      if (isNubankMatch(cLower) && isNubankMatch(lowerName)) return true;
      if (isMercadoPagoMatch(cLower) && isMercadoPagoMatch(lowerName)) return true;
      if (isItauMatch(cLower) && isItauMatch(lowerName)) return true;
      if (isBradescoMatch(cLower) && isBradescoMatch(lowerName)) return true;
      if (isSantanderMatch(cLower) && isSantanderMatch(lowerName)) return true;
      if (isC6Match(cLower) && isC6Match(lowerName)) return true;
      if (isCaixaMatch(cLower) && isCaixaMatch(lowerName)) return true;
      if (isBancoDoBrasilMatch(cLower) && isBancoDoBrasilMatch(lowerName)) return true;
      return false;
    });

    if (matchedByName) {
      return {
        canonicalId: matchedByName.id,
        canonicalName: matchedByName.name.toUpperCase(),
        bank: matchedByName.bank || 'Crédito',
        color: matchedByName.color || '#8B5CF6',
        isRegistered: true,
        registeredCard: matchedByName,
      };
    }
  }

  // 3. Normalização canônica por bancos conhecidos (caso não haja cadastro ou tenha nomes variados)
  let canonicalName = rawName ? rawName.toUpperCase() : 'CARTÃO DE CRÉDITO';
  let bank = 'Crédito';
  let color = '#8B5CF6';

  if (isInterMatch(lowerName)) {
    canonicalName = 'BANCO INTER';
    bank = 'Banco Inter';
    color = '#FF7A00';
  } else if (isMercadoPagoMatch(lowerName)) {
    canonicalName = 'MERCADO PAGO';
    bank = 'Mercado Pago';
    color = '#009EE3';
  } else if (isNubankMatch(lowerName)) {
    canonicalName = 'NUBANK';
    bank = 'Nubank';
    color = '#820AD1';
  } else if (isItauMatch(lowerName)) {
    canonicalName = 'ITAÚ';
    bank = 'Itaú Unibanco';
    color = '#EC7000';
  } else if (isBradescoMatch(lowerName)) {
    canonicalName = 'BRADESCO';
    bank = 'Bradesco';
    color = '#CC092F';
  } else if (isSantanderMatch(lowerName)) {
    canonicalName = 'SANTANDER';
    bank = 'Santander';
    color = '#EA1D25';
  } else if (isC6Match(lowerName)) {
    canonicalName = 'C6 BANK';
    bank = 'C6 Bank';
    color = '#1E293B';
  } else if (isCaixaMatch(lowerName)) {
    canonicalName = 'CAIXA';
    bank = 'Caixa Econômica';
    color = '#005CA9';
  } else if (isBancoDoBrasilMatch(lowerName)) {
    canonicalName = 'BANCO DO BRASIL';
    bank = 'Banco do Brasil';
    color = '#EAB308';
  }

  const slug = canonicalName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const canonicalId = `canonical-card-${slug}`;

  return {
    canonicalId,
    canonicalName,
    bank,
    color,
    isRegistered: false,
  };
}

/**
 * Verifica se uma despesa pertence ao cartão especificado
 */
export function isExpenseMatchingCard(
  expense: Expense,
  targetCanonicalId: string,
  targetCanonicalName: string,
  registeredCards: CreditCard[] = [],
  categories: Category[] = []
): boolean {
  if (expense.paymentMethod !== 'CARTAO_CREDITO') return false;

  // Se a despesa for identificada como Pix/Boleto/Dinheiro, não pertence a cartão
  if (isPixExpense(expense, categories) || isBoletoExpense(expense, categories) || isCashExpense(expense, categories)) {
    return false;
  }

  const targetIdClean = (targetCanonicalId || '').trim();
  const targetNameClean = (targetCanonicalName || '').trim().toLowerCase();
  const expCardId = (expense.cardId || '').trim();
  const expCardNameClean = (expense.cardName || '').trim().toLowerCase();

  // 1. Match direto por ID
  if (targetIdClean && (expCardId === targetIdClean || expense.paymentMethodId === targetIdClean)) {
    return true;
  }

  // Se a despesa possui um cardId associado e esse cardId pertence a OUTRO cartão registrado, rejeita
  if (expCardId && registeredCards.length > 0) {
    const isOtherRegistered = registeredCards.some(
      (c) => c.id === expCardId && c.id !== targetIdClean && c.name.toLowerCase().trim() !== targetNameClean
    );
    if (isOtherRegistered) {
      return false;
    }
  }

  // 2. Match direto por nome idêntico
  if (expCardNameClean && targetNameClean && expCardNameClean === targetNameClean) {
    return true;
  }

  // 3. Match canônico inteligente
  const info = getCanonicalCardInfo(expense.cardId, expense.cardName, registeredCards);

  if (targetIdClean && info.canonicalId === targetIdClean) return true;
  if (info.canonicalName.trim().toLowerCase() === targetNameClean) return true;
  if (info.registeredCard && (info.registeredCard.id === targetIdClean || info.registeredCard.name.trim().toLowerCase() === targetNameClean)) {
    return true;
  }

  // 4. Se targetCanonicalId for id de um cartão registrado na lista
  const targetCard = registeredCards.find((c) => c.id === targetIdClean || c.name.trim().toLowerCase() === targetNameClean);
  if (targetCard) {
    if (expCardId === targetCard.id) return true;
    if (expCardNameClean && expCardNameClean === targetCard.name.trim().toLowerCase()) {
      return true;
    }
  }

  return false;
}
