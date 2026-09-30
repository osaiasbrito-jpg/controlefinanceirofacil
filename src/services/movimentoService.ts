import { pool, withDbRetry } from '../db/index';

export interface BrasiliaDateTime {
  now: Date;
  dateStr: string; // YYYY-MM-DD (ex: 2026-09-30)
  dateFormattedBR: string; // DD/MM/YYYY (ex: 30/09/2026)
  timeFormatted: string; // HH:mm:ss (ex: 08:00:00)
  hour: number; // 0..23
  minute: number; // 0..59
  second: number; // 0..59
  isDayWindow: boolean; // true se entre 08:00 e 19:59 (período de lançamento ativo)
}

/**
 * Retorna a data, horário e componentes temporais atuais calculados com precisão
 * no fuso horário oficial de Brasília (America/Sao_Paulo, UTC-3).
 */
export function getBrasiliaDateTime(): BrasiliaDateTime {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const dateFormattedBR = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const timeFormatted = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });

  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const second = parseInt(parts.find((p) => p.type === 'second')?.value || '0', 10);

  // Período de atividade diária: das 08h00 às 19h59
  const isDayWindow = hour >= 8 && hour < 20;

  return {
    now,
    dateStr,
    dateFormattedBR,
    timeFormatted,
    hour,
    minute,
    second,
    isDayWindow,
  };
}

let lastLoggedAction = '';
let lastActionTimestamp = '';
let midnightTimeout: NodeJS.Timeout | null = null;

/**
 * Calcula os milissegundos restantes até a próxima meia-noite (00:00:00) no Horário de Brasília (UTC-3).
 */
export function getMsUntilNextMidnightBrasilia(): number {
  const bDate = getBrasiliaDateTime();
  const [year, month, day] = bDate.dateStr.split('-').map(Number);
  // America/Sao_Paulo é UTC-3. 00:00:00 do dia seguinte em Brasília = 03:00:00 UTC do dia seguinte
  const nextMidnightUtc = Date.UTC(year, month - 1, day + 1, 3, 0, 0);
  const diff = nextMidnightUtc - Date.now();
  return Math.max(diff, 1000);
}

/**
 * Agenda um timer dedicado para apagar os dados exatamente à meia-noite (00:00:00 no fuso de Brasília).
 */
export function agendarExclusaoMeiaNoite() {
  if (midnightTimeout) {
    clearTimeout(midnightTimeout);
  }
  const ms = getMsUntilNextMidnightBrasilia();
  const minutes = Math.round(ms / 60000);
  console.log(`[Movimento Banco Ativo] ⏰ Exclusão de Meia-Noite agendada para daqui a ${minutes} minuto(s) (às 00:00:00 em Brasília)`);

  midnightTimeout = setTimeout(async () => {
    try {
      console.log('[Movimento Banco Ativo] 🌙 MEIA-NOITE ATINGIDA! Executando exclusão dos registros de teste...');
      const res = await apagarMovimento({ forceAll: true });
      lastLoggedAction = `REMOÇÃO_MEIA_NOITE (${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })})`;
      lastActionTimestamp = new Date().toISOString();
      console.log(`[Movimento Banco Ativo] 🌙 Registros apagados à meia-noite: ${res.deletedCount}`);
    } catch (err) {
      console.error('[Movimento Banco Ativo] Erro ao apagar registros à meia-noite:', err);
    }
  }, ms);
}

/**
 * Lança no banco de dados na tabela 'movimento' a data atual.
 * Suporta lançamento normal (08h) ou teste agendado para apagar à meia-noite.
 */
export async function lancarMovimento(options?: {
  force?: boolean;
  customDesc?: string;
  tipo?: string;
  status?: string;
  agendadoMeiaNoite?: boolean;
}) {
  return await withDbRetry(async () => {
    const client = await pool.connect();
    try {
      const bDate = getBrasiliaDateTime();
      const isMidnightTest = options?.agendadoMeiaNoite || options?.tipo === 'TESTE_MEIA_NOITE';
      const tipo = options?.tipo || (isMidnightTest ? 'TESTE_MEIA_NOITE' : 'KEEP_ALIVE');
      const status = options?.status || (isMidnightTest ? 'ATIVO_ATE_MEIA_NOITE' : 'ATIVO');
      const desc =
        options?.customDesc ||
        (isMidnightTest
          ? `Teste de Atividade - Lançado em ${bDate.dateFormattedBR} às ${bDate.timeFormatted} (Programado para apagar à Meia-Noite)`
          : `Atividade Diária 08h - Manutenção de Banco Ativo (Supabase Keep-Alive - Lançado em ${bDate.dateFormattedBR} às ${bDate.timeFormatted})`);

      // 1. Verifica se já existe registro lançado para a data atual
      const checkRes = await client.query(
        'SELECT * FROM "movimento" WHERE "data" = $1 ORDER BY "id" DESC LIMIT 1',
        [bDate.dateStr]
      );

      if (checkRes.rows.length > 0 && !options?.force) {
        if (isMidnightTest) {
          agendarExclusaoMeiaNoite();
        }
        return {
          success: true,
          action: 'JA_LANCADO',
          message: `Registro de hoje (${bDate.dateFormattedBR}) já está ativo na tabela movimento.`,
          record: checkRes.rows[0],
          brasiliaTime: bDate,
        };
      }

      // 2. Insere o registro de movimento com a data atual
      const insertRes = await client.query(
        `INSERT INTO "movimento" (
          "data", "data_formatada", "hora_lancamento", "descricao", "tipo", "status", "created_at", "updated_at"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, NOW(), NOW()
        ) RETURNING *`,
        [bDate.dateStr, bDate.dateFormattedBR, bDate.timeFormatted, desc, tipo, status]
      );

      lastLoggedAction = isMidnightTest
        ? `TESTE_LANÇADO_MEIA_NOITE (${bDate.dateFormattedBR} às ${bDate.timeFormatted})`
        : `INSERÇÃO_08H (${bDate.dateFormattedBR} às ${bDate.timeFormatted})`;
      lastActionTimestamp = new Date().toISOString();
      console.log(`[Movimento Banco Ativo] ✅ Data lançada com sucesso às ${bDate.timeFormatted}: ${bDate.dateFormattedBR} (ID: ${insertRes.rows[0]?.id}, Tipo: ${tipo})`);

      if (isMidnightTest) {
        agendarExclusaoMeiaNoite();
      }

      return {
        success: true,
        action: 'INSERIDO',
        message: isMidnightTest
          ? `Teste lançado com sucesso no banco com a data de hoje (${bDate.dateFormattedBR} às ${bDate.timeFormatted}). Agendado para apagar automaticamente à meia-noite!`
          : `Data lançada com sucesso na tabela movimento (${bDate.dateFormattedBR} às ${bDate.timeFormatted}).`,
        record: insertRes.rows[0],
        brasiliaTime: bDate,
        apagarMeiaNoite: isMidnightTest,
      };
    } finally {
      client.release();
    }
  });
}

/**
 * Apaga da tabela 'movimento' a data atual (ou anteriores).
 * Executado automaticamente todos os dias às 20h da noite.
 */
export async function apagarMovimento(options?: { targetDate?: string; forceAll?: boolean }) {
  return await withDbRetry(async () => {
    const client = await pool.connect();
    try {
      const bDate = getBrasiliaDateTime();
      const targetDate = options?.targetDate || bDate.dateStr;

      let query = 'DELETE FROM "movimento" WHERE "data" <= $1 RETURNING *';
      let params = [targetDate];

      if (options?.forceAll) {
        query = 'DELETE FROM "movimento" RETURNING *';
        params = [];
      }

      const deleteRes = await client.query(query, params);

      lastLoggedAction = `REMOÇÃO_20H (${bDate.dateFormattedBR} às ${bDate.timeFormatted})`;
      lastActionTimestamp = new Date().toISOString();

      if (deleteRes.rowCount && deleteRes.rowCount > 0) {
        console.log(`[Movimento Banco Ativo] 🗑️ Data apagada com sucesso às ${bDate.timeFormatted}: ${deleteRes.rowCount} registro(s) removido(s) da tabela movimento.`);
      }

      return {
        success: true,
        action: 'REMOVIDO',
        deletedCount: deleteRes.rowCount || 0,
        message: `${deleteRes.rowCount || 0} registro(s) apagado(s) da tabela movimento conforme rotina das 20h.`,
        deletedRecords: deleteRes.rows,
        brasiliaTime: bDate,
      };
    } finally {
      client.release();
    }
  });
}

/**
 * Obtém o status completo da tabela movimento e da rotina diária
 */
export async function getMovimentoStatus() {
  return await withDbRetry(async () => {
    const client = await pool.connect();
    try {
      const bDate = getBrasiliaDateTime();

      // Consulta todos os registros presentes
      const recordsRes = await client.query(
        'SELECT * FROM "movimento" ORDER BY "id" DESC LIMIT 50'
      );

      const hasActiveToday = recordsRes.rows.some((r: any) => {
        const rowDate = r.data instanceof Date ? r.data.toISOString().slice(0, 10) : String(r.data);
        return rowDate === bDate.dateStr;
      });

      const hasMidnightTest = recordsRes.rows.some(
        (r: any) => r.tipo === 'TESTE_MEIA_NOITE' || r.status === 'ATIVO_ATE_MEIA_NOITE'
      );

      let nextAction = bDate.isDayWindow
        ? `Remoção programada às 20h da noite (${bDate.dateFormattedBR})`
        : `Lançamento programado às 08h da manhã (${bDate.dateFormattedBR})`;

      if (hasMidnightTest && bDate.hour >= 20) {
        const ms = getMsUntilNextMidnightBrasilia();
        const mins = Math.round(ms / 60000);
        nextAction = `Exclusão de Teste programada para à Meia-Noite (em ~${mins} min / 00:00:00 em Brasília)`;
      }

      return {
        status: 'ok',
        brasiliaTime: {
          dataAtual: bDate.dateFormattedBR,
          dataISO: bDate.dateStr,
          horaAtual: bDate.timeFormatted,
          hora: bDate.hour,
          minuto: bDate.minute,
          segundo: bDate.second,
          janelaDiurnaAtiva: bDate.isDayWindow,
        },
        bancoAtivo: true,
        temRegistroHoje: hasActiveToday,
        temTesteMeiaNoite: hasMidnightTest,
        totalRegistros: recordsRes.rows.length,
        proximaAcao: nextAction,
        ultimaAcao: lastLoggedAction || 'Rotina aguardando próximo horário',
        ultimaAcaoTimestamp: lastActionTimestamp || null,
        registros: recordsRes.rows,
      };
    } finally {
      client.release();
    }
  });
}

/**
 * Avalia o horário atual no fuso de Brasília e executa a transição necessária:
 * - Se estiver no horário das 08h00 às 19h59: garante que o registro de hoje foi lançado.
 * - Se estiver no horário das 20h00 às 07h59:
 *   - Se houver teste agendado para a meia-noite e ainda for 20h-23h: preserva o registro até meia-noite!
 *   - Se passar da meia-noite (00:00 em diante): apaga o registro de teste!
 */
export async function executarCicloMovimento(): Promise<any> {
  const bDate = getBrasiliaDateTime();

  try {
    if (bDate.isDayWindow) {
      // Período Diurno (08:00 às 19:59): Deve manter a data atual lançada na tabela
      return await lancarMovimento();
    } else {
      // Período Noturno (20:00 às 07:59):
      // Verifica se existe algum registro com tipo TESTE_MEIA_NOITE
      const client = await pool.connect();
      let hasMidnightTest = false;
      try {
        const checkTest = await client.query(
          "SELECT * FROM \"movimento\" WHERE (\"tipo\" = 'TESTE_MEIA_NOITE' OR \"status\" = 'ATIVO_ATE_MEIA_NOITE') LIMIT 5"
        );
        hasMidnightTest = checkTest.rows.length > 0;
      } finally {
        client.release();
      }

      // Se ainda estiver antes da meia-noite (entre 20h e 23h59) e houver teste ativo de meia-noite:
      if (hasMidnightTest && bDate.hour >= 20 && bDate.hour <= 23) {
        // Assegura que o timeout de meia-noite está ativo
        if (!midnightTimeout) {
          agendarExclusaoMeiaNoite();
        }
        return {
          success: true,
          action: 'AGUARDANDO_MEIA_NOITE',
          message: 'Registro de teste ativo no banco. Agendado para apagar automaticamente à meia-noite.',
          brasiliaTime: bDate,
        };
      }

      // Se for 00h (meia-noite em ponto ou madrugada): apaga os registros da data atual ou anterior
      return await apagarMovimento({ targetDate: bDate.dateStr });
    }
  } catch (error: any) {
    // Erros temporários de rede não quebram o ciclo
    console.error('[Movimento Banco Ativo] Aviso na execução do ciclo automático:', error?.message || error);
    return {
      success: false,
      error: error?.message || 'Falha ao processar ciclo de movimento',
      brasiliaTime: bDate,
    };
  }
}

let schedulerTimer: NodeJS.Timeout | null = null;
let isCycleRunning = false;

/**
 * Inicializa o daemon agendador de movimento.
 * Executa na inicialização e monitora continuamente a cada 30 segundos.
 */
export function iniciarAgendadorMovimento() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }

  console.log('[Movimento Banco Ativo] 🚀 Agendador automático inicializado (Lançamento às 08h e Remoção às 20h em Horário de Brasília)');

  // Execução imediata na inicialização do servidor
  setTimeout(async () => {
    try {
      await executarCicloMovimento();
    } catch (err) {
      console.warn('[Movimento Banco Ativo] Aviso na verificação inicial de inicialização:', err);
    }
  }, 3000);

  // Monitora a cada 30 segundos para detectar a virada precisa de 08:00 e 20:00
  schedulerTimer = setInterval(async () => {
    if (isCycleRunning) return;
    isCycleRunning = true;
    try {
      await executarCicloMovimento();
    } catch (err) {
      console.warn('[Movimento Banco Ativo] Falha no ciclo do agendador:', err);
    } finally {
      isCycleRunning = false;
    }
  }, 30000);
}
