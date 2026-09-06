export const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return 'R$ 0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatDateBR = (dateString: string | undefined | null): string => {
  if (!dateString) return '--/--/----';
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1];
      const day = parts[2].substring(0, 2);
      return `${day}/${month}/${year}`;
    }
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateString;
  }
};

export const getMonthName = (monthStr: string): string => {
  if (!monthStr || !monthStr.includes('-')) return monthStr;
  const [yearStr, mStr] = monthStr.split('-');
  const monthIndex = parseInt(mStr, 10) - 1;
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const monthName = months[monthIndex] || mStr;
  return `${monthName} ${yearStr}`;
};

export const getShortMonthName = (monthStr: string): string => {
  if (!monthStr || !monthStr.includes('-')) return monthStr;
  const [yearStr, mStr] = monthStr.split('-');
  const monthIndex = parseInt(mStr, 10) - 1;
  const months = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];
  const monthName = months[monthIndex] || mStr;
  return `${monthName}/${yearStr.slice(-2)}`;
};

export const getCurrentMonth = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const getCurrentDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getAdjacentMonth = (monthStr: string, offset: number): string => {
  if (!monthStr || !monthStr.includes('-')) return getCurrentMonth();
  const [yearStr, mStr] = monthStr.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(mStr, 10) + offset;

  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }

  return `${year}-${String(month).padStart(2, '0')}`;
};

/**
 * Splits totalAmount into count parts with precise cent distribution.
 * e.g. R$ 100.00 / 3 => [33.34, 33.33, 33.33] -> Sum is exactly 100.00
 */
export const splitInstallments = (totalAmount: number, count: number): number[] => {
  if (count <= 1) return [Number(totalAmount.toFixed(2))];
  
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents % count;
  
  const installments: number[] = [];
  for (let i = 0; i < count; i++) {
    // Distribute remainder cents to first N installments
    const centsForThis = baseCents + (i < remainderCents ? 1 : 0);
    installments.push(centsForThis / 100);
  }
  
  return installments;
};
