/**
 * Utilitário de Geração de Código PIX BR Code (Padrão Banco Central / EMVCo)
 * Gera a string Copia e Cola Oficial com CRC16-CCITT
 */

// Formata campo no padrão ID + TAMANHO (2 dígitos) + VALOR
function formatField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

// Cálculo do CRC16 (Polinômio 0x1021) conforme especificação do Banco Central
function calculateCRC16(payload: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface PixPayloadParams {
  key: string;
  beneficiaryName: string;
  beneficiaryCity: string;
  amount?: number;
  txId?: string;
  description?: string;
}

export function generatePixPayload({
  key,
  beneficiaryName,
  beneficiaryCity,
  amount,
  txId = 'CONTROLEFINAN',
  description = 'Acesso Vitalicio Meu Controle Financeiro',
}: PixPayloadParams): string {
  // Limpeza de campos
  const cleanKey = key.trim();
  const cleanName = beneficiaryName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .slice(0, 25) || 'MEU CONTROLE FINAN';
  const cleanCity = beneficiaryCity
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .slice(0, 15) || 'BRASIL';
  const cleanTxId = (txId || '***').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || '***';

  // 00: Payload Format Indicator (01)
  let payload = formatField('00', '01');

  // 01: Point of Initiation Method (12 = Dinâmico ou 11 = Estático)
  payload += formatField('01', '12');

  // 26: Merchant Account Information - Pix
  const gui = formatField('00', 'br.gov.bcb.pix');
  const keyField = formatField('01', cleanKey);
  const descField = description ? formatField('02', description.slice(0, 40)) : '';
  const merchantAccount = gui + keyField + descField;
  payload += formatField('26', merchantAccount);

  // 52: Merchant Category Code (0000 = Padrão)
  payload += formatField('52', '0000');

  // 53: Transaction Currency (986 = BRL Real Brasileiro)
  payload += formatField('53', '986');

  // 54: Transaction Amount
  if (amount && amount > 0) {
    payload += formatField('54', amount.toFixed(2));
  }

  // 58: Country Code
  payload += formatField('58', 'BR');

  // 59: Merchant Name
  payload += formatField('59', cleanName);

  // 60: Merchant City
  payload += formatField('60', cleanCity);

  // 62: Additional Data Field Template (TxID)
  const txField = formatField('05', cleanTxId);
  payload += formatField('62', txField);

  // 63: CRC16 prefix
  payload += '6304';

  // Calculate & Append CRC16
  const crc = calculateCRC16(payload);
  return payload + crc;
}
