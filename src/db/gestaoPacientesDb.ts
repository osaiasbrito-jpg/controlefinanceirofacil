import { Pool } from 'pg';

// Configurações de Conexão com o Banco de Dados de GESTÃO DE PACIENTES (Supabase)
// Projeto: gestopacientes (ID: bvggeztgmorusfkedsbj)
const GESTAO_PACIENTES_HOST =
  process.env.GESTAO_PACIENTES_DB_HOST || 'db.bvggeztgmorusfkedsbj.supabase.co';
const GESTAO_PACIENTES_PORT = Number(process.env.GESTAO_PACIENTES_DB_PORT) || 5432;
const GESTAO_PACIENTES_USER = process.env.GESTAO_PACIENTES_DB_USER || 'postgres';
const GESTAO_PACIENTES_PASSWORD =
  process.env.GESTAO_PACIENTES_DB_PASSWORD ||
  process.env.SUPABASE_DB_PASSWORD ||
  'Ojf6994@#gestaoPessoas';
const GESTAO_PACIENTES_DATABASE =
  process.env.GESTAO_PACIENTES_DB_NAME || 'postgres';

let gestaoPool: Pool | null = null;

export function getGestaoPacientesPool(): Pool {
  if (!gestaoPool) {
    const connectionString =
      process.env.GESTAO_PACIENTES_DB_URL ||
      `postgresql://${GESTAO_PACIENTES_USER}:${encodeURIComponent(
        GESTAO_PACIENTES_PASSWORD
      )}@${GESTAO_PACIENTES_HOST}:${GESTAO_PACIENTES_PORT}/${GESTAO_PACIENTES_DATABASE}`;

    gestaoPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    gestaoPool.on('error', (err) => {
      console.warn('Aviso no pool do banco de Gestão de Pacientes:', err.message);
    });
  }

  return gestaoPool;
}

export interface GestaoPacientesRendaItem {
  id: string;
  tenant_id?: string;
  data_lancamento: string;
  valor_recebido: number;
  observacao?: string;
  usuario_responsavel?: string;
  referencia_atendimento?: string;
  paciente_id?: string;
  paciente_nome?: string;
  origem_tipo?: string;
  origem_id?: string;
  mes_referencia?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Busca todos os registros de renda de massoterapia e sessões concluídas
 * diretamente no banco de dados do Gestão de Pacientes.
 */
export async function fetchGestaoPacientesMassoterapia(mesReferencia?: string) {
  const pool = getGestaoPacientesPool();

  try {
    // 1. Buscar registros existentes na tabela renda_massoterapia do Gestão de Pacientes
    const rendaQuery = `
      SELECT 
        id,
        tenant_id,
        data_lancamento,
        valor_recebido,
        observacao,
        usuario_responsavel,
        referencia_atendimento,
        paciente_id,
        paciente_nome,
        origem_tipo,
        origem_id,
        mes_referencia,
        status,
        created_at,
        updated_at
      FROM renda_massoterapia
      ORDER BY data_lancamento DESC, created_at DESC;
    `;

    const rendaResult = await pool.query(rendaQuery);
    const existingRefIds = new Set<string>();

    const items = rendaResult.rows.map((row) => {
      if (row.referencia_atendimento) existingRefIds.add(row.referencia_atendimento);
      if (row.origem_id) existingRefIds.add(row.origem_id);
      existingRefIds.add(row.id);

      const val = Number(row.valor_recebido) || 0;
      const dataLanc = row.data_lancamento || (row.created_at ? String(row.created_at).substring(0, 10) : new Date().toISOString().substring(0, 10));
      const mesRef = row.mes_referencia || dataLanc.substring(0, 7);

      return {
        id: row.id,
        userId: 'osaiasbrito@gmail.com',
        dataLancamento: dataLanc,
        data: dataLanc,
        valor: val,
        amount: val,
        observacao: row.observacao || 'Atendimento Massoterapia',
        clientePaciente: row.paciente_nome || 'Paciente',
        procedimento: row.observacao?.includes(' - ') ? row.observacao.split(' - ')[1] : 'Massoterapia',
        tipoSessao: row.origem_tipo === 'pacote_massoterapia' ? 'Pacote' : 'Sessão Avulsa',
        tipo: row.origem_tipo === 'pacote_massoterapia' ? 'Pacote' : 'Sessão Avulsa',
        status: row.status || 'RECEBIDO',
        profissional: row.usuario_responsavel || 'Osaias Brito',
        mesReferencia: mesRef,
        referenceMonth: mesRef,
        origem: 'Gestão de Pacientes (Supabase)',
        origemId: row.origem_id || row.referencia_atendimento,
        pacienteId: row.paciente_id,
        tenantId: row.tenant_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    // 2. Buscar também da tabela sessions do Gestão de Pacientes (se houver atendimento com price que ainda não está em renda_massoterapia)
    try {
      const sessionsQuery = `
        SELECT 
          id,
          tenant_id,
          patient_id,
          patient_name,
          professional_name,
          price,
          scheduled_date,
          status,
          procedures,
          created_at
        FROM sessions
        WHERE price IS NOT NULL AND price > 0
        ORDER BY scheduled_date DESC;
      `;
      const sessionsResult = await pool.query(sessionsQuery);

      for (const row of sessionsResult.rows) {
        // Pular se já constar em renda_massoterapia
        if (existingRefIds.has(row.id)) continue;

        const val = Number(row.price) || 0;
        const dataLanc = row.scheduled_date || (row.created_at ? String(row.created_at).substring(0, 10) : new Date().toISOString().substring(0, 10));
        const mesRef = dataLanc.substring(0, 7);
        const proceduresList = Array.isArray(row.procedures) ? row.procedures.join(', ') : 'Massoterapia';

        // Opcional: auto-cadastrar na tabela renda_massoterapia do Gestão de Pacientes para persistência definitiva
        const newRendaId = `rm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        try {
          await pool.query(
            `INSERT INTO renda_massoterapia (
              id, tenant_id, data_lancamento, valor_recebido, observacao, usuario_responsavel,
              referencia_atendimento, paciente_id, paciente_nome, origem_tipo, origem_id,
              mes_referencia, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING;`,
            [
              newRendaId,
              row.tenant_id || 'tenant-demo-1',
              dataLanc,
              val,
              `Atendimento Massoterapia - ${proceduresList}`,
              row.professional_name || 'Osaias Brito',
              row.id,
              row.patient_id,
              row.patient_name || 'Paciente',
              'atendimento_massoterapia',
              row.id,
              mesRef,
              row.status === 'COMPLETED' ? 'RECEBIDO' : 'CONFIRMADO',
            ]
          );
        } catch (insertErr) {
          console.warn('Aviso ao sincronizar session para renda_massoterapia:', insertErr);
        }

        items.push({
          id: newRendaId,
          userId: 'osaiasbrito@gmail.com',
          dataLancamento: dataLanc,
          data: dataLanc,
          valor: val,
          amount: val,
          observacao: `Atendimento Massoterapia - ${proceduresList}`,
          clientePaciente: row.patient_name || 'Paciente',
          procedimento: proceduresList,
          tipoSessao: 'Sessão Avulsa',
          tipo: 'Sessão Avulsa',
          status: row.status === 'COMPLETED' ? 'RECEBIDO' : 'CONFIRMADO',
          profissional: row.professional_name || 'Osaias Brito',
          mesReferencia: mesRef,
          referenceMonth: mesRef,
          origem: 'Gestão de Pacientes (Sessions)',
          origemId: row.id,
          pacienteId: row.patient_id,
          tenantId: row.tenant_id,
          createdAt: row.created_at,
          updatedAt: row.created_at,
        });
      }
    } catch (sessionErr) {
      console.warn('Aviso ao consultar sessions do Gestão de Pacientes:', sessionErr);
    }

    // Filtrar por mês se especificado e não for "TODOS"
    if (mesReferencia && mesReferencia !== 'TODOS') {
      return items.filter(
        (it) => it.mesReferencia === mesReferencia || it.dataLancamento.startsWith(mesReferencia)
      );
    }

    return items;
  } catch (error) {
    console.error('Erro ao buscar renda massoterapia em Gestão de Pacientes:', error);
    throw error;
  }
}

/**
 * Salva ou atualiza um lançamento de massoterapia DIRETAMENTE no banco de dados do Gestão de Pacientes.
 */
export async function saveGestaoPacientesMassoterapia(item: any) {
  const pool = getGestaoPacientesPool();

  const id = String(
    item.id || `rm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
  );
  const dataLancamento =
    item.dataLancamento ||
    item.data ||
    item.date ||
    new Date().toISOString().substring(0, 10);
  const mesReferencia =
    item.mesReferencia ||
    item.referenceMonth ||
    dataLancamento.substring(0, 7);
  const valor =
    Number(
      item.valor !== undefined
        ? item.valor
        : item.amount !== undefined
        ? item.amount
        : item.price
    ) || 0;
  const pacienteNome =
    item.clientePaciente ||
    item.clientName ||
    item.cliente ||
    item.paciente ||
    'Paciente';
  const procedimento =
    item.procedimento || item.tecnicas || item.servico || 'Massagem';
  const observacao =
    item.observacao ||
    item.notes ||
    item.description ||
    `Atendimento Massoterapia - ${procedimento}`;
  const usuarioResponsavel =
    item.profissional || item.professional || 'Osaias Brito';
  const status = (item.status || 'RECEBIDO').toUpperCase();
  const tenantId = item.tenantId || item.tenant_id || 'tenant-demo-1';
  const origemTipo =
    item.origemTipo ||
    (item.tipoSessao === 'Pacote' ? 'pacote_massoterapia' : 'atendimento_massoterapia');
  const referenciaAtendimento = item.referenciaAtendimento || item.origemId || null;

  const query = `
    INSERT INTO renda_massoterapia (
      id,
      tenant_id,
      data_lancamento,
      valor_recebido,
      observacao,
      usuario_responsavel,
      referencia_atendimento,
      paciente_id,
      paciente_nome,
      origem_tipo,
      origem_id,
      mes_referencia,
      status,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      data_lancamento = EXCLUDED.data_lancamento,
      valor_recebido = EXCLUDED.valor_recebido,
      observacao = EXCLUDED.observacao,
      usuario_responsavel = EXCLUDED.usuario_responsavel,
      paciente_nome = EXCLUDED.paciente_nome,
      origem_tipo = EXCLUDED.origem_tipo,
      mes_referencia = EXCLUDED.mes_referencia,
      status = EXCLUDED.status,
      updated_at = NOW()
    RETURNING *;
  `;

  const values = [
    id,
    tenantId,
    dataLancamento,
    valor,
    observacao,
    usuarioResponsavel,
    referenciaAtendimento,
    item.pacienteId || null,
    pacienteNome,
    origemTipo,
    referenciaAtendimento,
    mesReferencia,
    status,
  ];

  const result = await pool.query(query, values);
  const row = result.rows[0];

  return {
    id: row.id,
    userId: 'osaiasbrito@gmail.com',
    dataLancamento: row.data_lancamento,
    data: row.data_lancamento,
    valor: Number(row.valor_recebido) || 0,
    amount: Number(row.valor_recebido) || 0,
    observacao: row.observacao,
    clientePaciente: row.paciente_nome,
    procedimento,
    tipoSessao: row.origem_tipo === 'pacote_massoterapia' ? 'Pacote' : 'Sessão Avulsa',
    tipo: row.origem_tipo === 'pacote_massoterapia' ? 'Pacote' : 'Sessão Avulsa',
    status: row.status,
    profissional: row.usuario_responsavel,
    mesReferencia: row.mes_referencia,
    referenceMonth: row.mes_referencia,
    origem: 'Gestão de Pacientes (Supabase)',
    tenantId: row.tenant_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Exclui um registro de massoterapia DIRETAMENTE do banco de dados do Gestão de Pacientes.
 */
export async function deleteGestaoPacientesMassoterapia(id: string) {
  const pool = getGestaoPacientesPool();
  const query = `DELETE FROM renda_massoterapia WHERE id = $1 RETURNING id;`;
  const result = await pool.query(query, [id]);
  return { success: true, count: result.rowCount || 0 };
}

/**
 * Exclusão em lote no banco de dados do Gestão de Pacientes.
 */
export async function deleteMultipleGestaoPacientesMassoterapia(ids: string[]) {
  if (!ids || ids.length === 0) return { success: true, count: 0 };
  const pool = getGestaoPacientesPool();
  const query = `DELETE FROM renda_massoterapia WHERE id = ANY($1::text[]) RETURNING id;`;
  const result = await pool.query(query, [ids]);
  return { success: true, count: result.rowCount || 0 };
}

/**
 * Testa a conexão com o banco de Gestão de Pacientes.
 */
export async function testGestaoPacientesConnection() {
  const pool = getGestaoPacientesPool();
  const start = Date.now();
  const res = await pool.query(
    'SELECT current_database(), current_user, version(), count(*) as total_masso FROM renda_massoterapia;'
  );
  const latency = Date.now() - start;
  return {
    connected: true,
    database: res.rows[0]?.current_database,
    user: res.rows[0]?.current_user,
    totalRecords: Number(res.rows[0]?.total_masso) || 0,
    latencyMs: latency,
    host: GESTAO_PACIENTES_HOST,
  };
}
