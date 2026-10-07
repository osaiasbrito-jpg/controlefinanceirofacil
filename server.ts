import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { optionalAuth, requireAuth, AuthRequest } from './src/middleware/auth';
import {
  getOrCreateUser,
  getFullUserData,
  syncUserData,
  deleteEntity,
  upsertUserSettings,
  testDatabaseConnection,
  getMassoterapiaRecords,
  upsertMassoterapiaRecord,
  deleteMassoterapiaRecord,
  deleteMultipleMassoterapiaRecords,
  cleanAllTestRecords,
  syncIntegrationsLogToMassoterapia,
  fetchGestaoMassoterapiaSessionsFromDatabase,
  importGestaoMassoterapiaSessions,
  autoImportGestaoMassoterapiaSessions,
  createGestaoMassoterapiaDemoSession,
  upsertAbatimento,
  deleteAbatimentoRecord,
  updateExpenseInPostgresRepo,
  updateMultipleExpensesStatusInPostgresRepo,
} from './src/db/repositories';
import { db } from './src/db/index';
import { systemIntegrationsLog } from './src/db/schema';
import { ensureDatabaseTables } from './src/db/init';
import {
  iniciarAgendadorMovimento,
  getMovimentoStatus,
  lancarMovimento,
  apagarMovimento,
  executarCicloMovimento,
} from './src/services/movimentoService';

const __filenameSafe = typeof import.meta !== 'undefined' && import.meta.url ? fileURLToPath(import.meta.url) : (process.argv[1] || '');
const __dirnameSafe = __filenameSafe ? path.dirname(__filenameSafe) : process.cwd();

async function startServer() {
  // Initialize Database Tables in PostgreSQL
  try {
    await ensureDatabaseTables();
  } catch (err) {
    console.error('Falha ao inicializar tabelas PostgreSQL:', err);
  }

  // Inicializa o agendador automático diário da tabela movimento (08h lançamento, 20h remoção)
  try {
    iniciarAgendadorMovimento();
  } catch (err) {
    console.error('Falha ao inicializar agendador da tabela movimento:', err);
  }

  const app = express();
  const PORT = 3000;

  // Enable CORS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, X-User-Email, X-User-Password, x-access-password, User-Agent, user-agent, x-user-email, x-user-password, *'
    );
    res.header('Access-Control-Expose-Headers', '*');
    res.header('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // PostgreSQL Database Health Check
  app.get('/api/health/db', async (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    try {
      const dbStatus = await testDatabaseConnection();
      res.json(dbStatus);
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // Rotinas e Monitoramento da Tabela Movimento (Keep-Alive Automático)
  app.get('/api/movimento/status', async (_req, res) => {
    try {
      const status = await getMovimentoStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  app.post('/api/movimento/lancar', async (req, res) => {
    try {
      const { force, descricao, tipo, status, agendadoMeiaNoite } = req.body || {};
      const result = await lancarMovimento({
        force: Boolean(force),
        customDesc: descricao,
        tipo,
        status,
        agendadoMeiaNoite: Boolean(agendadoMeiaNoite),
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/movimento/lancar-teste-meia-noite', async (req, res) => {
    try {
      const { descricao } = req.body || {};
      const result = await lancarMovimento({
        force: true,
        agendadoMeiaNoite: true,
        tipo: 'TESTE_MEIA_NOITE',
        status: 'ATIVO_ATE_MEIA_NOITE',
        customDesc:
          descricao ||
          'Teste de Atividade Solicitado - Lançado com a data de hoje (Programado para apagar automaticamente à Meia-Noite)',
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/movimento/apagar', async (req, res) => {
    try {
      const { data, forceAll } = req.body || {};
      const result = await apagarMovimento({ targetDate: data, forceAll: Boolean(forceAll) });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/movimento/executar-ciclo', async (_req, res) => {
    try {
      const result = await executarCicloMovimento();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Super User direct authentication via PostgreSQL
  app.post('/api/auth/superuser-login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const cleanEmail = email?.toLowerCase()?.trim();
      const validPass = password === 'Ojf6994@#gestaoPessoas' || password === 'Ojf6994@#' || password === 'Ojf6994@#gestãoPessoas';

      if (cleanEmail === 'osaiasbrito@gmail.com' && validPass) {
        const user = await getOrCreateUser(
          'osaiasbrito@gmail.com',
          'osaiasbrito@gmail.com',
          'Osaias Brito (Super Usuário)'
        );
        return res.json({
          success: true,
          isSuperUser: true,
          role: 'SUPERADMIN',
          user: {
            uid: 'osaiasbrito@gmail.com',
            email: 'osaiasbrito@gmail.com',
            displayName: 'Osaias Brito (Super Usuário)',
            role: 'SUPERADMIN',
            isSuperUser: true,
          },
        });
      }
      return res.status(401).json({ error: 'Credenciais de super usuário inválidas' });
    } catch (error: any) {
      res.status(500).json({ error: 'Erro na autenticação de super usuário', details: error.message });
    }
  });

  // User Authentication & Registration in PostgreSQL
  app.post('/api/auth/sync-user', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid || req.body?.uid;
      const email = req.user?.email || req.body?.email || 'usuario@meucontrole.app';
      const name = req.user?.name || req.body?.name;
      const photoUrl = req.user?.picture || req.body?.photoUrl;

      if (!uid) {
        return res.status(400).json({ error: 'UID de usuário é obrigatório' });
      }

      const dbUser = await getOrCreateUser(uid, email, name, photoUrl);
      res.json({ success: true, user: dbUser });
    } catch (error: any) {
      console.error('Erro ao sincronizar usuário no PostgreSQL:', error);
      res.status(500).json({ error: 'Erro ao registrar usuário', details: error.message });
    }
  });

  // Fetch Full User Financial Data from PostgreSQL
  app.get('/api/data', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.uid || (req.query.userId as string);
      const userEmail = req.user?.email || (req.query.email as string);
      if (!userId && !userEmail) {
        return res.status(400).json({ error: 'Identificador do usuário é obrigatório' });
      }

      const effectiveUserId = userId || userEmail || 'osaiasbrito@gmail.com';
      const data = await getFullUserData(effectiveUserId, userEmail);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao carregar dados do PostgreSQL:', error);
      res.status(500).json({ error: 'Erro ao buscar dados no banco PostgreSQL', details: error.message });
    }
  });

  // Bulk Sync Financial Data into PostgreSQL
  app.post('/api/sync', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.uid || req.body?.userId;
      if (!userId) {
        return res.status(400).json({ error: 'Identificador do usuário é obrigatório' });
      }

      const payload = { ...req.body, userId };
      const syncResult = await syncUserData(payload);
      res.json(syncResult);
    } catch (error: any) {
      console.error('Erro na sincronização com PostgreSQL:', error);
      res.status(500).json({ error: 'Falha ao sincronizar dados com o banco de dados', details: error.message });
    }
  });

  // Save / Update User Settings in PostgreSQL
  app.post('/api/settings', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.uid || req.body?.userId;
      if (!userId) {
        return res.status(400).json({ error: 'Identificador do usuário é obrigatório' });
      }

      const updated = await upsertUserSettings(userId, req.body.settings || req.body);
      res.json({ success: true, settings: updated });
    } catch (error: any) {
      console.error('Erro ao atualizar configurações no PostgreSQL:', error);
      res.status(500).json({ error: 'Falha ao salvar configurações', details: error.message });
    }
  });

  // Delete Entity from PostgreSQL
  app.delete('/api/entity/:table/:id', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userEmail = req.user?.email || (req.query.email as string) || (req.body?.email as string);
      const rawUserId = (req.query.userId as string) || req.user?.uid || (req.body?.userId as string);
      const isOsaias =
        userEmail?.toLowerCase().includes('osaias') ||
        rawUserId?.toLowerCase().includes('osaias') ||
        req.user?.uid?.toLowerCase().includes('osaias');
      const effectiveUserId = isOsaias ? 'osaiasbrito@gmail.com' : (rawUserId || userEmail || 'osaiasbrito@gmail.com');
      const { table, id } = req.params;
      const deleteFuture = req.query.deleteFuture === 'true' || req.body?.deleteFuture === true;
      const deleteAll = req.query.deleteAll === 'true' || req.body?.deleteAll === true;

      if (!id || !table) {
        return res.status(400).json({ error: 'Parâmetros incompletos para remoção' });
      }

      const result = await deleteEntity(table, id, effectiveUserId, {
        deleteFutureInstallments: deleteFuture,
        deleteAllInstallments: deleteAll,
        userEmail,
      });

      broadcastSyncEvent('data_refreshed', { action: 'delete', table, id, timestamp: Date.now() });

      res.json(result);
    } catch (error: any) {
      console.error('Erro ao deletar registro no PostgreSQL:', error);
      res.status(500).json({ error: 'Falha ao deletar registro no banco', details: error.message });
    }
  });

  // Endpoints Dedicados para Atualização Direta de Despesas no PostgreSQL
  app.patch('/api/expenses/:id', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updated = await updateExpenseInPostgresRepo(id, req.body);
      broadcastSyncEvent('data_refreshed', { action: 'update_expense', id, status: req.body?.status, timestamp: Date.now() });
      res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error('Erro ao atualizar despesa no PostgreSQL:', error);
      res.status(500).json({ error: 'Falha ao atualizar despesa', details: error.message });
    }
  });

  app.put('/api/expenses/:id', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updated = await updateExpenseInPostgresRepo(id, req.body);
      broadcastSyncEvent('data_refreshed', { action: 'update_expense', id, status: req.body?.status, timestamp: Date.now() });
      res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error('Erro ao atualizar despesa no PostgreSQL:', error);
      res.status(500).json({ error: 'Falha ao atualizar despesa', details: error.message });
    }
  });

  app.post('/api/expenses/bulk-status', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { ids, status } = req.body;
      if (!Array.isArray(ids) || !status) {
        return res.status(400).json({ error: 'IDs e status são obrigatórios' });
      }
      const updated = await updateMultipleExpensesStatusInPostgresRepo(ids, status);
      broadcastSyncEvent('data_refreshed', { action: 'bulk_status_expense', ids, status, timestamp: Date.now() });
      res.json({ success: true, count: updated.length, data: updated });
    } catch (error: any) {
      console.error('Erro ao atualizar status em lote no PostgreSQL:', error);
      res.status(500).json({ error: 'Falha ao atualizar status em lote', details: error.message });
    }
  });

  // Endpoints Dedicados para Renda Massoterapia
  app.get('/api/renda-massoterapia', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.uid || (req.query.userId as string) || req.user?.email || 'osaiasbrito@gmail.com';
      const mes = req.query.mes as string | undefined;
      const records = await getMassoterapiaRecords(userId, mes);
      res.json({ success: true, data: records });
    } catch (error: any) {
      console.error('Erro ao buscar lançamentos de massoterapia:', error);
      res.status(500).json({ error: 'Falha ao buscar lançamentos de massoterapia', details: error.message });
    }
  });

  app.post('/api/renda-massoterapia', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.uid || req.body?.userId || req.user?.email || 'osaiasbrito@gmail.com';
      const valor = req.body?.valor !== undefined ? req.body.valor : (req.body?.amount !== undefined ? req.body.amount : req.body?.price);
      const dataLancamento = req.body?.dataLancamento || req.body?.data || req.body?.date || new Date().toISOString().substring(0, 10);
      const observacao = req.body?.observacao || req.body?.notes || req.body?.description || null;
      const clientePaciente = req.body?.clientePaciente || req.body?.clientName || req.body?.cliente || req.body?.paciente || null;
      const procedimento = req.body?.procedimento || req.body?.tecnicas || req.body?.servico || null;
      const id = req.body?.id || req.body?.incomeId || req.body?.sessionId;

      if (valor === undefined || valor === null || Number(valor) <= 0) {
        return res.status(400).json({ error: 'O valor da renda de massoterapia deve ser positivo e maior que zero.' });
      }

      const saved = await upsertMassoterapiaRecord(userId, {
        id,
        valor: Number(valor),
        dataLancamento,
        observacao,
        clientePaciente,
        clientName: clientePaciente,
        procedimento,
        tecnicas: procedimento,
        tipo: req.body?.tipo || req.body?.tipoSessao || 'Sessão Avulsa',
        status: req.body?.status || 'Realizado',
        profissional: req.body?.profissional || req.body?.professional || 'Osaias Brito',
        origem: req.body?.origem || 'Terapias Pro',
        dadosExtras: req.body?.dadosExtras || req.body,
      });

      res.status(201).json({
        success: true,
        message: 'Renda de massoterapia lançada com sucesso.',
        data: saved,
      });
    } catch (error: any) {
      console.error('Erro ao lançar renda de massoterapia:', error);
      res.status(500).json({ error: 'Falha ao lançar renda de massoterapia', details: error.message });
    }
  });

  // Server-Sent Events (SSE) para Notificação em Tempo Real Instantânea
  const sseClients = new Set<express.Response>();

  app.get('/api/events/live-sync', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n');
    res.write(': connected\n\n');
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  function broadcastSyncEvent(event: string, data: any) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(message);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  // Webhook / Endpoint de Integração Direta com Terapias Pro / Qi Zen / Sistemas Externos
  const handleAtendimentoIntegration = async (req: AuthRequest, res: any) => {
    try {
      const query = req.query || {};
      const body = { ...query, ...(req.body || {}) };
      const userId = req.user?.uid || body.userId || req.user?.email || body.email || 'osaiasbrito@gmail.com';
      const valor = body.valor !== undefined ? body.valor : (body.amount !== undefined ? body.amount : (body.price || 0));
      const dataLancamento = body.dataLancamento || body.data || body.date || new Date().toISOString().substring(0, 10);
      const clientName = body.clientName || body.nomeCliente || body.clientePaciente || body.cliente || body.paciente || 'Cliente';
      const procedimento = body.procedimento || body.tecnicas || body.servico || body.description || 'Massoterapia';
      const observacao = body.observacao || body.notes || body.description || `${body.tipo || 'Sessão Avulsa'} - ${procedimento} • ${clientName}`;
      const id = body.id || body.sessionId || body.incomeId || `sessao_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const systemName = body.systemName || body.appOrigem || 'Terapias Pro';

      const saved = await upsertMassoterapiaRecord(userId, {
        id,
        valor: Number(valor) || 0,
        dataLancamento,
        observacao,
        clientePaciente: clientName,
        clientName,
        procedimento,
        tecnicas: procedimento,
        tipo: body.tipo || body.tipoSessao || 'Sessão Avulsa',
        status: body.status || 'Realizado',
        profissional: body.profissional || body.professional || 'Osaias Brito',
        origem: systemName,
        dadosExtras: body,
      });

      // Gravar também no log de integração para histórico e auditoria
      try {
        await db.insert(systemIntegrationsLog).values({
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          userId,
          systemName,
          action: 'ATENDIMENTO_SESSAO',
          amount: Number(valor) || 0,
          clientName,
          description: 'MASSOTERAPIA',
          payload: body,
          response: {
            status: 'SUCCESS',
            incomeId: saved.id,
            amount: saved.valor,
            month: saved.dataLancamento?.substring(0, 7),
          },
        });
      } catch (logErr) {
        console.warn('Aviso ao registrar log de integração:', logErr);
      }

      // Notificar todos os clientes conectados instantaneamente via SSE
      broadcastSyncEvent('atendimento_synced', {
        id: saved.id,
        clientName: saved.clientName,
        valor: saved.valor,
        dataLancamento: saved.dataLancamento,
        origem: saved.origem,
        timestamp: Date.now(),
      });

      res.status(200).json({
        status: 'SUCCESS',
        message: 'Atendimento de massoterapia integrado automaticamente ao financeiro com sucesso.',
        incomeId: saved.id,
        amount: saved.valor,
        month: saved.dataLancamento ? saved.dataLancamento.substring(0, 7) : new Date().toISOString().substring(0, 7),
        data: saved,
      });
    } catch (error: any) {
      console.error('Erro na integração de atendimento:', error);
      res.status(500).json({ status: 'ERROR', error: error.message });
    }
  };

  // Aliases abrangentes de endpoints de integração (POST & GET)
  const integrationRoutes = [
    '/api/renda-massoterapia/integracao',
    '/api/integrations/atendimento',
    '/api/integrations/atendimentos',
    '/api/integracao/atendimento',
    '/api/integracao/atendimentos',
    '/api/integracao/massoterapia',
    '/api/integracao',
    '/api/integracoes',
    '/api/atendimentos',
    '/api/atendimento',
    '/api/sessoes',
    '/api/sessao',
    '/api/renda-extra',
    '/api/webhook',
    '/api/webhooks',
    '/api/webhook/atendimento',
    '/api/webhook/terapias-pro',
    '/api/external/atendimento',
    '/api/external/massoterapia',
    '/api/external/session',
  ];

  for (const route of integrationRoutes) {
    app.post(route, optionalAuth, handleAtendimentoIntegration);
    app.get(route, optionalAuth, handleAtendimentoIntegration);
  }

  // Endpoint para sincronização forçada imediata
  app.post('/api/renda-massoterapia/sync-now', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const count = await syncIntegrationsLogToMassoterapia();
      broadcastSyncEvent('data_refreshed', { count, timestamp: Date.now() });
      res.json({ success: true, syncedCount: count, message: `${count} atendimentos sincronizados com sucesso.` });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao sincronizar', details: err.message });
    }
  });

  // Daemon em segundo plano: Sincronização e importação automática periódica do banco de Gestão de Pessoas
  let lastKnownCount = 0;
  let isDaemonSyncing = false;
  setInterval(async () => {
    if (isDaemonSyncing) return;
    isDaemonSyncing = true;
    try {
      const count = await syncIntegrationsLogToMassoterapia();
      const autoRes = await autoImportGestaoMassoterapiaSessions('osaiasbrito@gmail.com');
      if ((count > 0 && count !== lastKnownCount) || (autoRes && autoRes.count > 0)) {
        lastKnownCount = count;
        broadcastSyncEvent('data_refreshed', { count, autoCount: autoRes?.count || 0, timestamp: Date.now() });
      }
    } catch (err: any) {
      // Capturar falhas de rede transitórias sem interromper o serviço
      if (!err?.message?.includes('Connection terminated unexpectedly')) {
        console.warn('Aviso no ciclo do daemon de integração:', err?.message || err);
      }
    } finally {
      isDaemonSyncing = false;
    }
  }, 25000);

  // Teste de Conexão em Tempo Real com o Sistema de Massoterapia (Terapias Pro / Qi Zen)
  // Garante estritamente que NÃO haverá mais de um registro de teste para nunca poluir o banco de dados
  app.post('/api/renda-massoterapia/test-connection', optionalAuth, async (req: AuthRequest, res) => {
    const startTime = Date.now();
    try {
      const userId = req.user?.uid || req.body?.userId || req.user?.email || 'osaiasbrito@gmail.com';

      // 1. Limpeza preventiva de qualquer teste anterior para garantir estritamente a política de não poluição
      await cleanAllTestRecords(userId);

      const now = new Date();
      const dateStr = now.toISOString().substring(0, 10);
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      // 2. Criação controlada de exatamente 1 lançamento de teste com identificação clara
      const savedTest = await upsertMassoterapiaRecord(userId, {
        id: 'teste_conexao_massoterapia',
        valor: 1.0,
        dataLancamento: dateStr,
        observacao: `Comunicação ativa em tempo real verificada às ${timeStr}! Webhook, SSE e banco sincronizados.`,
        clientePaciente: '[TESTE DE CONEXÃO]',
        clientName: '[TESTE DE CONEXÃO]',
        procedimento: 'Sessão Teste • Sistema de Massoterapia',
        tecnicas: 'Sessão Teste',
        tipo: 'Teste em Tempo Real',
        tipoSessao: 'Teste em Tempo Real',
        status: 'Realizado',
        profissional: 'Terapias Pro / Qi Zen',
        mesReferencia: dateStr.substring(0, 7),
        referenceMonth: dateStr.substring(0, 7),
        origem: 'Teste de Conexão Terapias Pro',
        dadosExtras: {
          isTest: true,
          testedAt: now.toISOString(),
          sistema: 'Terapias Pro / Qi Zen',
        },
      });

      const latencyMs = Math.max(12, Date.now() - startTime);

      // 3. Notificação broadcast imediata para todos os clientes conectados via SSE (perceptível em tempo real!)
      broadcastSyncEvent('test_ping', {
        status: 'CONNECTED',
        message: 'Comunicação em tempo real confirmada com sucesso!',
        latencyMs,
        timestamp: Date.now(),
        testRecord: savedTest,
      });

      broadcastSyncEvent('atendimento_synced', {
        id: savedTest.id,
        clientName: savedTest.clientName,
        valor: savedTest.valor,
        dataLancamento: savedTest.dataLancamento,
        origem: savedTest.origem,
        isTest: true,
        timestamp: Date.now(),
      });

      broadcastSyncEvent('data_refreshed', {
        action: 'test_connection',
        latencyMs,
        isTest: true,
        timestamp: Date.now(),
      });

      res.status(200).json({
        success: true,
        status: 'ONLINE',
        message: 'Comunicação em tempo real estabelecida com sucesso!',
        latencyMs,
        testRecord: savedTest,
        timestamp: now.toISOString(),
      });
    } catch (error: any) {
      console.error('Erro no teste de conexão de massoterapia:', error);
      res.status(500).json({
        success: false,
        status: 'ERROR',
        error: 'Falha ao testar conexão em tempo real',
        details: error.message,
      });
    }
  });

  // Limpeza de Registros de Teste do Banco de Dados a Qualquer Momento pelo Usuário
  app.delete('/api/renda-massoterapia/clean-tests', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.uid || (req.query.userId as string) || req.user?.email || 'osaiasbrito@gmail.com';
      await cleanAllTestRecords(userId);

      broadcastSyncEvent('data_refreshed', { action: 'clean_tests', timestamp: Date.now() });

      res.json({
        success: true,
        message: 'Registros de teste excluídos do banco de dados com sucesso.',
      });
    } catch (error: any) {
      console.error('Erro ao limpar testes de massoterapia:', error);
      res.status(500).json({ error: 'Falha ao limpar registros de teste', details: error.message });
    }
  });

  app.put('/api/renda-massoterapia/:id', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.uid || req.body?.userId || req.user?.email || 'osaiasbrito@gmail.com';
      const { id } = req.params;
      const { valor, dataLancamento, observacao } = req.body;

      if (valor !== undefined && Number(valor) <= 0) {
        return res.status(400).json({ error: 'O valor da renda de massoterapia deve ser positivo e maior que zero.' });
      }

      const updated = await upsertMassoterapiaRecord(userId, {
        id,
        valor: valor !== undefined ? Number(valor) : undefined,
        dataLancamento,
        observacao,
      });

      broadcastSyncEvent('data_refreshed', { action: 'update', id, timestamp: Date.now() });

      res.json({
        success: true,
        message: 'Lançamento de massoterapia atualizado com sucesso.',
        data: updated,
      });
    } catch (error: any) {
      console.error('Erro ao atualizar lançamento de massoterapia:', error);
      res.status(500).json({ error: 'Falha ao atualizar lançamento de massoterapia', details: error.message });
    }
  });

  app.delete('/api/renda-massoterapia/:id', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.uid || (req.query.userId as string) || req.user?.email || 'osaiasbrito@gmail.com';
      const { id } = req.params;

      if (id === 'clean-tests' || id === 'teste_conexao_massoterapia') {
        await cleanAllTestRecords(userId);
      } else {
        await deleteMassoterapiaRecord(userId, id);
      }

      broadcastSyncEvent('data_refreshed', { action: 'delete', id, timestamp: Date.now() });
      res.json({ success: true, message: 'Lançamento de massoterapia excluído com sucesso.' });
    } catch (error: any) {
      console.error('Erro ao excluir lançamento de massoterapia:', error);
      res.status(500).json({ error: 'Falha ao excluir lançamento de massoterapia', details: error.message });
    }
  });

  // Exclusão em Lote de Lançamentos de Massoterapia
  app.post('/api/renda-massoterapia/bulk-delete', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.uid || (req.body?.userId as string) || req.user?.email || 'osaiasbrito@gmail.com';
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Nenhum identificador fornecido para exclusão.' });
      }

      const result = await deleteMultipleMassoterapiaRecords(userId, ids);

      broadcastSyncEvent('data_refreshed', { action: 'bulk_delete', count: result.count, timestamp: Date.now() });

      res.json({
        success: true,
        message: `${result.count} lançamento(s) excluído(s) do banco de dados com sucesso.`,
        deletedCount: result.count,
      });
    } catch (error: any) {
      console.error('Erro na exclusão em lote de massoterapia:', error);
      res.status(500).json({ error: 'Falha ao excluir atendimentos selecionados', details: error.message });
    }
  });

  // Buscar Lançamentos de Sessões no Banco de Dados (salvo pelo Sistema de Gestão de Pessoas de Massoterapia)
  app.get('/api/renda-massoterapia/database-sessions', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.uid || (req.query.userId as string) || req.user?.email || 'osaiasbrito@gmail.com';
      const mesReferencia = req.query.mesReferencia as string;
      const result = await fetchGestaoMassoterapiaSessionsFromDatabase(userId, mesReferencia);
      res.json(result);
    } catch (error: any) {
      console.error('Erro ao buscar lançamentos no banco de dados:', error);
      res.status(500).json({
        success: false,
        error: 'Falha ao buscar lançamentos no banco de dados',
        details: error.message,
      });
    }
  });

  // Importar / Sincronizar Sessões selecionadas para o Sistema Financeiro
  app.post('/api/renda-massoterapia/import-database-sessions', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.uid || req.body?.userId || req.user?.email || 'osaiasbrito@gmail.com';
      const { sessions } = req.body;
      if (!Array.isArray(sessions) || sessions.length === 0) {
        return res.status(400).json({ error: 'Nenhuma sessão informada para importação.' });
      }

      const result = await importGestaoMassoterapiaSessions(userId, sessions);
      broadcastSyncEvent('data_refreshed', { action: 'import_sessions', count: result.count, timestamp: Date.now() });

      res.json(result);
    } catch (error: any) {
      console.error('Erro ao importar sessões para o financeiro:', error);
      res.status(500).json({
        success: false,
        error: 'Falha ao importar lançamentos de sessões',
        details: error.message,
      });
    }
  });

  // Importação Automática de Sessões Avulsas do Banco de Gestão de Pessoas para o Fluxo de Receitas Financeiras
  app.post('/api/renda-massoterapia/auto-import', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.uid || req.body?.userId || (req.query.userId as string) || req.user?.email || 'osaiasbrito@gmail.com';
      const result = await autoImportGestaoMassoterapiaSessions(userId);

      if (result.count > 0) {
        broadcastSyncEvent('data_refreshed', { action: 'auto_import_sessions', count: result.count, timestamp: Date.now() });
        broadcastSyncEvent('atendimento_synced', {
          count: result.count,
          totalAmount: result.totalAmount,
          message: result.message,
          timestamp: Date.now(),
        });
      }

      res.json(result);
    } catch (error: any) {
      console.error('Erro ao importar automaticamente do banco de gestão:', error);
      res.status(500).json({
        success: false,
        error: 'Falha na importação automática de sessões avulsas',
        details: error.message,
      });
    }
  });

  app.get('/api/renda-massoterapia/auto-import', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.uid || (req.query.userId as string) || req.user?.email || 'osaiasbrito@gmail.com';
      const result = await autoImportGestaoMassoterapiaSessions(userId);

      if (result.count > 0) {
        broadcastSyncEvent('data_refreshed', { action: 'auto_import_sessions', count: result.count, timestamp: Date.now() });
      }

      res.json(result);
    } catch (error: any) {
      console.error('Erro ao importar automaticamente do banco de gestão:', error);
      res.status(500).json({
        success: false,
        error: 'Falha na importação automática de sessões avulsas',
        details: error.message,
      });
    }
  });

  // Criar / Registrar Sessão Avulsa diretamente no banco (Simulação / Teste do formulário da tela Print 02)
  app.post('/api/renda-massoterapia/create-gestao-session', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.uid || req.body?.userId || req.user?.email || 'osaiasbrito@gmail.com';
      const result = await createGestaoMassoterapiaDemoSession(userId, req.body);

      broadcastSyncEvent('data_refreshed', { action: 'create_gestao_session', session: result.session, timestamp: Date.now() });

      res.json(result);
    } catch (error: any) {
      console.error('Erro ao registrar sessão avulsa:', error);
      res.status(500).json({
        success: false,
        error: 'Falha ao registrar sessão avulsa no banco de dados',
        details: error.message,
      });
    }
  });

  app.get('/api/renda-massoterapia/resumo', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.uid || (req.query.userId as string) || req.user?.email || 'osaiasbrito@gmail.com';
      const mes = (req.query.mes as string) || new Date().toISOString().substring(0, 7);
      const records = await getMassoterapiaRecords(userId, mes);

      const totalRecebido = records.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
      const quantidade = records.length;
      const mediaPorLancamento = quantidade > 0 ? totalRecebido / quantidade : 0;

      res.json({
        success: true,
        mes,
        totalRecebido,
        quantidade,
        mediaPorLancamento,
      });
    } catch (error: any) {
      console.error('Erro ao buscar resumo de massoterapia:', error);
      res.status(500).json({ error: 'Falha ao buscar resumo de massoterapia', details: error.message });
    }
  });

  // ==============================================================================
  // ENDPOINTS DE ABATIMENTOS E ADIANTAMENTOS DE PAGAMENTO
  // ==============================================================================
  app.post('/api/abatimentos', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.uid || req.body?.userId || req.user?.email || 'osaiasbrito@gmail.com';
      const { amount, targetType, cardId, cardName, paymentMethod, paymentMethodId, paymentMethodName, date, referenceMonth, description, sourceMethod, notes } = req.body;

      if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ error: 'O valor do abatimento deve ser maior que zero.' });
      }

      const saved = await upsertAbatimento(userId, {
        id: req.body.id,
        amount: Number(amount),
        targetType: targetType || 'CREDIT_CARD',
        cardId,
        cardName,
        paymentMethod,
        paymentMethodId,
        paymentMethodName,
        date: date || new Date().toISOString().substring(0, 10),
        referenceMonth: referenceMonth || (date ? date.substring(0, 7) : 'GLOBAL'),
        description: description || 'Abatimento de Pagamento',
        sourceMethod,
        notes,
      });

      broadcastSyncEvent('data_refreshed', { action: 'create_abatimento', id: saved.id, timestamp: Date.now() });

      res.json({
        success: true,
        message: 'Abatimento registrado com sucesso!',
        data: saved,
      });
    } catch (error: any) {
      console.error('Erro ao registrar abatimento no PostgreSQL:', error);
      res.status(500).json({ error: 'Falha ao registrar abatimento no banco de dados', details: error.message });
    }
  });

  app.delete('/api/abatimentos/:id', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userEmail = req.user?.email || (req.query.email as string);
      const rawUserId = (req.query.userId as string) || req.user?.uid;
      const isOsaias =
        userEmail?.toLowerCase().includes('osaias') ||
        rawUserId?.toLowerCase().includes('osaias') ||
        req.user?.uid?.toLowerCase().includes('osaias');
      const userId = isOsaias ? 'osaiasbrito@gmail.com' : (rawUserId || userEmail || 'osaiasbrito@gmail.com');
      const { id } = req.params;

      const result = await deleteAbatimentoRecord(userId, id);
      broadcastSyncEvent('data_refreshed', { action: 'delete_abatimento', id, timestamp: Date.now() });

      res.json({
        success: true,
        message: 'Abatimento excluído com sucesso!',
        data: result,
      });
    } catch (error: any) {
      console.error('Erro ao excluir abatimento:', error);
      res.status(500).json({ error: 'Falha ao excluir abatimento', details: error.message });
    }
  });

  // Gemini Financial Advisor API Endpoint
  app.post('/api/gemini/analyze-expenses', async (req, res) => {
    try {
      const {
        month,
        monthName,
        totalRevenue,
        totalSalary,
        totalExtraIncome,
        totalExpenses,
        totalBalance,
        pendingExpenses,
        paidExpenses,
        creditCardInvoiceTotal,
        categories,
        topExpenses,
        installmentsCount,
      } = req.body;

      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        // Provide a robust smart fallback if the API key is not yet set
        return res.json({
          success: true,
          source: 'local-fallback',
          data: generateSmartLocalFinancialAdvice({
            monthName: monthName || month,
            totalRevenue: Number(totalRevenue) || 0,
            totalExpenses: Number(totalExpenses) || 0,
            totalBalance: Number(totalBalance) || 0,
            creditCardInvoiceTotal: Number(creditCardInvoiceTotal) || 0,
            pendingExpenses: Number(pendingExpenses) || 0,
            categories: Array.isArray(categories) ? categories : [],
            topExpenses: Array.isArray(topExpenses) ? topExpenses : [],
          }),
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `Você é um consultor financeiro pessoal especialista em finanças familiares no Brasil (padrão BRL R$).
Analise com precisão os dados financeiros do usuário para o mês de ${monthName || month} e forneça um diagnóstico financeiro objetivo, um índice de saúde financeira (0 a 100) e dicas práticas e personalizadas para economizar e otimizar os gastos.

DADOS DO MÊS (${monthName || month}):
- Receita Total: R$ ${(Number(totalRevenue) || 0).toFixed(2)} (Salário: R$ ${(Number(totalSalary) || 0).toFixed(2)}, Renda Extra: R$ ${(Number(totalExtraIncome) || 0).toFixed(2)})
- Despesas Totais: R$ ${(Number(totalExpenses) || 0).toFixed(2)} (Pagas: R$ ${(Number(paidExpenses) || 0).toFixed(2)}, Pendentes: R$ ${(Number(pendingExpenses) || 0).toFixed(2)})
- Fatura de Cartões de Crédito: R$ ${(Number(creditCardInvoiceTotal) || 0).toFixed(2)}
- Saldo Final Líquido: R$ ${(Number(totalBalance) || 0).toFixed(2)}
- Quantidade de Compras Parceladas/Lançamentos Futuros: ${Number(installmentsCount) || 0}

DISTRIBUIÇÃO POR CATEGORIAS:
${
  Array.isArray(categories) && categories.length > 0
    ? categories
        .map((c: { name: string; amount: number; percentage?: number }) => `- ${c.name}: R$ ${Number(c.amount || 0).toFixed(2)} (${c.percentage || 0}%)`)
        .join('\n')
    : 'Nenhuma categoria específica registrada.'
}

PRINCIPAIS LANÇAMENTOS DO MÊS:
${
  Array.isArray(topExpenses) && topExpenses.length > 0
    ? topExpenses
        .slice(0, 10)
        .map((e: { description: string; amount: number; categoryName?: string; paymentMethod?: string; status?: string }) => `- ${e.description} (${e.categoryName || 'Geral'} / ${e.paymentMethod || 'Outro'}): R$ ${Number(e.amount || 0).toFixed(2)} [${e.status || 'PENDENTE'}]`)
        .join('\n')
    : 'Sem despesas cadastradas.'
}

DIRETRIZES DE RESPOSTA:
1. Responda em Português do Brasil de forma acolhedora, encorajadora, direta e sem jargões complexos.
2. Calcule uma pontuação de saúde financeira de 0 a 100 baseada na relação entre receita x despesas, peso do cartão de crédito e contas pendentes.
3. Classifique o status entre: "excelente", "bom", "atencao", ou "critico".
4. Gere de 2 a 4 dicas práticas, específicas e acionáveis para economizar ou equilibrar o orçamento neste mês.
5. Destaque um alerta ou oportunidade principal (highlightInsight).
6. Estime um potencial de economia mensal realista em Reais (ex: 150.00).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          systemInstruction: 'Você é um consultor financeiro de alto nível especializado em finanças pessoais brasileiras. Gere saídas estritamente no formato JSON estruturado conforme o schema solicitado.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: {
                type: Type.INTEGER,
                description: 'Pontuação de saúde financeira do mês de 0 a 100.',
              },
              status: {
                type: Type.STRING,
                description: 'Status: excelente, bom, atencao ou critico.',
              },
              statusLabel: {
                type: Type.STRING,
                description: 'Rótulo descritivo do status em português (ex: "Excelente Controle", "Saúde Financeira Boa", "Requer Atenção", "Alerta Vermelho").',
              },
              summary: {
                type: Type.STRING,
                description: 'Resumo conciso de 1 a 2 frases sobre a situação financeira do mês.',
              },
              highlightInsight: {
                type: Type.STRING,
                description: 'O principal ponto de atenção ou oportunidade do mês.',
              },
              potentialMonthlySavings: {
                type: Type.NUMBER,
                description: 'Estimativa de economia sugerida em Reais (número).',
              },
              savingsTips: {
                type: Type.ARRAY,
                description: 'Lista de 2 a 4 dicas práticas e personalizadas.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: {
                      type: Type.STRING,
                      description: 'Título curto e chamativo da dica.',
                    },
                    description: {
                      type: Type.STRING,
                      description: 'Explicação detalhada e ação prática a ser tomada.',
                    },
                    category: {
                      type: Type.STRING,
                      description: 'Categoria relacionada ou geral (ex: Alimentação, Cartão, Fixas, Economia).',
                    },
                    impact: {
                      type: Type.STRING,
                      description: 'Impacto estimado: "alto", "medio" ou "baixo".',
                    },
                  },
                  required: ['title', 'description', 'category'],
                },
              },
            },
            required: ['score', 'status', 'statusLabel', 'summary', 'highlightInsight', 'savingsTips', 'potentialMonthlySavings'],
          },
        },
      });

      const responseText = response.text?.trim() || '{}';
      const parsedData = JSON.parse(responseText);

      return res.json({
        success: true,
        source: 'gemini-ai',
        data: parsedData,
      });
    } catch (error: any) {
      console.error('Erro na análise de despesas com Gemini:', error);
      // Fallback response on error so client never breaks
      const { monthName, totalRevenue, totalExpenses, totalBalance, creditCardInvoiceTotal, categories, topExpenses } = req.body || {};
      const fallbackData = generateSmartLocalFinancialAdvice({
        monthName: monthName || 'este mês',
        totalRevenue: Number(totalRevenue) || 0,
        totalExpenses: Number(totalExpenses) || 0,
        totalBalance: Number(totalBalance) || 0,
        creditCardInvoiceTotal: Number(creditCardInvoiceTotal) || 0,
        pendingExpenses: 0,
        categories: Array.isArray(categories) ? categories : [],
        topExpenses: Array.isArray(topExpenses) ? topExpenses : [],
      });

      return res.json({
        success: true,
        source: 'fallback-after-error',
        data: fallbackData,
        error: error?.message,
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

/**
 * Smart algorithmic financial analyzer as fallback
 */
function generateSmartLocalFinancialAdvice(params: {
  monthName: string;
  totalRevenue: number;
  totalExpenses: number;
  totalBalance: number;
  creditCardInvoiceTotal: number;
  pendingExpenses: number;
  categories: Array<{ name: string; amount: number; percentage?: number }>;
  topExpenses: Array<{ description: string; amount: number; categoryName?: string }>;
}) {
  const {
    monthName,
    totalRevenue,
    totalExpenses,
    totalBalance,
    creditCardInvoiceTotal,
    categories,
    topExpenses,
  } = params;

  let score = 70;
  let status = 'bom';
  let statusLabel = 'Equilíbrio Financeiro';
  let highlightInsight = 'Mantenha o acompanhamento rigoroso das despesas diárias.';
  let potentialMonthlySavings = 0;
  const tips: Array<{ title: string; description: string; category: string; impact: string }> = [];

  if (totalRevenue === 0 && totalExpenses === 0) {
    return {
      score: 50,
      status: 'atencao',
      statusLabel: 'Sem Dados Cadastrados',
      summary: `Comece cadastrando suas receitas e despesas de ${monthName} para receber um diagnóstico completo com IA.`,
      highlightInsight: 'Cadastre seu salário e contas fixas para desbloquear previsões precisas.',
      potentialMonthlySavings: 0,
      savingsTips: [
        {
          title: 'Cadastrar Receitas e Salário',
          description: 'Insira seus rendimentos mensais para que o sistema calcule automaticamente o percentual de economia disponível.',
          category: 'Receitas',
          impact: 'alto',
        },
        {
          title: 'Registrar Contas Fixas',
          description: 'Adicione aluguel, luz, água e internet com seus respectivos vencimentos para não perder datas de pagamento.',
          category: 'Contas Fixas',
          impact: 'medio',
        },
      ],
    };
  }

  const expenseRatio = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 100;
  const cardRatio = totalRevenue > 0 ? (creditCardInvoiceTotal / totalRevenue) * 100 : 50;

  if (totalBalance < 0) {
    score = Math.max(20, Math.round(50 - Math.abs(totalBalance / (totalRevenue || 1)) * 30));
    status = 'critico';
    statusLabel = 'Alerta: Déficit no Mês';
    highlightInsight = `Suas despesas superam as receitas em R$ ${Math.abs(totalBalance).toFixed(2)}. É fundamental priorizar pagamentos essenciais e conter gastos discricionários.`;
  } else if (expenseRatio > 85) {
    score = 60;
    status = 'atencao';
    statusLabel = 'Orçamento Apertado';
    highlightInsight = `Você está comprometendo ${expenseRatio.toFixed(0)}% da sua renda total com despesas. O ideal para reserva de emergência é manter abaixo de 70%.`;
  } else if (expenseRatio > 60) {
    score = 80;
    status = 'bom';
    statusLabel = 'Boa Gestão Financeira';
    highlightInsight = `Parabéns! Você está poupando cerca de ${(100 - expenseRatio).toFixed(0)}% da sua renda neste mês.`;
  } else {
    score = 95;
    status = 'excelente';
    statusLabel = 'Excelente Saúde Financeira';
    highlightInsight = `Superávit expressivo de R$ ${totalBalance.toFixed(2)}. Ótimo momento para direcionar o excedente para investimentos ou amortizações.`;
  }

  // Identify top category
  if (categories.length > 0) {
    const topCat = categories[0];
    if (topCat.amount > 0) {
      potentialMonthlySavings += Math.round(topCat.amount * 0.1);
      tips.push({
        title: `Revisar Gastos em ${topCat.name}`,
        description: `A categoria "${topCat.name}" representa R$ ${topCat.amount.toFixed(2)} (${topCat.percentage || Math.round((topCat.amount / (totalExpenses || 1)) * 100)}% das despesas). Uma redução de 10% economizaria R$ ${(topCat.amount * 0.1).toFixed(2)}.`,
        category: topCat.name,
        impact: 'alto',
      });
    }
  }

  // Credit card tip
  if (creditCardInvoiceTotal > 0) {
    if (cardRatio > 40) {
      tips.push({
        title: 'Atenção com a Fatura do Cartão',
        description: `O cartão consome ${cardRatio.toFixed(0)}% da sua renda (R$ ${creditCardInvoiceTotal.toFixed(2)}). Procure utilizar mais débito/PIX para manter controle em tempo real.`,
        category: 'Cartão de Crédito',
        impact: 'alto',
      });
    } else {
      tips.push({
        title: 'Controle de Parcelas Futuras',
        description: `A fatura atual está em R$ ${creditCardInvoiceTotal.toFixed(2)}. Evite novos parcelamentos longos para manter os próximos meses com folga financeira.`,
        category: 'Cartão de Crédito',
        impact: 'medio',
      });
    }
  }

  // General savings tip
  if (totalBalance > 0) {
    tips.push({
      title: 'Reserva Estratégica',
      description: `Com o saldo positivo de R$ ${totalBalance.toFixed(2)}, separe pelo menos R$ ${(totalBalance * 0.3).toFixed(2)} imediatamente para sua reserva de oportunidade.`,
      category: 'Investimento',
      impact: 'medio',
    });
  }

  if (tips.length === 0) {
    tips.push({
      title: 'Regra dos 50/30/20',
      description: 'Destine 50% da receita para necessidades essenciais, 30% para estilo de vida e 20% para reserva financeira.',
      category: 'Planejamento',
      impact: 'medio',
    });
  }

  potentialMonthlySavings = Math.max(potentialMonthlySavings, Math.round(totalExpenses * 0.08));

  return {
    score,
    status,
    statusLabel,
    summary: `Diagnóstico financeiro de ${monthName}: Total de receitas R$ ${totalRevenue.toFixed(2)} contra R$ ${totalExpenses.toFixed(2)} em despesas, gerando saldo de R$ ${totalBalance.toFixed(2)}.`,
    highlightInsight,
    potentialMonthlySavings,
    savingsTips: tips,
  };
}

startServer();
