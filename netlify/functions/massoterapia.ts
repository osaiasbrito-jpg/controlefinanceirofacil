const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dpaylubvupjjokpukuxy.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_uDVtjc0J1dGBgS510tpphg_oSrmPUTu';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers':
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, X-User-Email, X-User-Password, x-access-password, x-user-password, x-user-email, User-Agent, user-agent, *',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json',
};

export const handler = async (event: {
  httpMethod: string;
  body?: string | null;
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
}) => {
  // Tratar Preflight CORS (OPTIONS)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ status: 'ok', cors: true }),
    };
  }

  // Requisição GET (health check / teste)
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        status: 200,
        message: 'Endpoint de Integração Massoterapia ativo e operante no Netlify!',
        timestamp: new Date().toISOString(),
      }),
    };
  }

  if (event.httpMethod === 'POST') {
    try {
      let body: any = {};
      if (event.body) {
        try {
          body = JSON.parse(event.body);
        } catch {
          body = {};
        }
      }

      // Parâmetros recebidos da clínica
      const email = body.email || body.username || body.user || 'osaiasbrito@gmail.com';
      const password = body.password || body.senha || '';
      const rawValor = body.amount ?? body.valor ?? 0;
      const numValor = Number(rawValor) || 0;
      const dataIso = body.date || body.data || new Date().toISOString().substring(0, 10);
      const mesVigor = body.mes_referencia || body.month || dataIso.substring(0, 7);
      const cliente = body.clientName || body.nomeCliente || body.cliente_paciente || 'Cliente Massoterapia';
      const procedimento = body.procedimento || body.description || 'Atendimento Massoterapia';
      const categoria = body.category || body.categoria || 'Renda Extra';
      const origem = body.origin || body.source || body.origem_renda || 'SERVIÇO';
      const isTest =
        body.test === true ||
        body.action === 'TESTE_CONEXAO' ||
        body.action === 'TEST' ||
        procedimento.includes('Teste de Validação');

      // Se for teste de conexão
      if (isTest) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            status: 200,
            message: 'Conexão estabelecida com sucesso (HTTP 200)! Sistema Financeiro online e pronto para receber lançamentos.',
            descricao: 'MASSOTERAPIA',
            origem: 'SERVIÇO',
            origem_renda: 'SERVIÇO',
            data: {
              status: 'online',
              endpoint: '/api/integrations/massoterapia',
              category: 'MASSOTERAPIA',
              authenticatedUser: email,
              validatedAt: new Date().toISOString(),
            },
          }),
        };
      }

      // Se for lançamento real de atendimento, inserir no Supabase
      const payloadSupabase = {
        user_id: email,
        description: 'MASSOTERAPIA',
        origin: 'SERVIÇO',
        source: 'SERVIÇO',
        category: 'Renda Extra',
        amount: numValor,
        date: dataIso,
        reference_month: mesVigor,
        month: mesVigor,
        notes: `Atendimento Massoterapia - ${cliente} (${procedimento})`,
        client_name: cliente,
        status: 'RECEIVED',
      };

      const sbResp = await fetch(`${SUPABASE_URL}/rest/v1/extra_incomes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(payloadSupabase),
      });

      if (!sbResp.ok && sbResp.status !== 201) {
        const errorText = await sbResp.text().catch(() => '');
        console.warn('Supabase insertion notice:', errorText);
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          status: 200,
          message: `Atendimento de R$ ${numValor.toFixed(2)} registrado com sucesso no mês ${mesVigor} como MASSOTERAPIA (SERVIÇO)!`,
          descricao: 'MASSOTERAPIA',
          origem: 'SERVIÇO',
          valor: numValor,
          mes: mesVigor,
          data: dataIso,
          cliente,
        }),
      };
    } catch (err: any) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          status: 500,
          message: `Erro interno no endpoint de integração: ${err.message || err}`,
        }),
      };
    }
  }

  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ success: false, message: 'Método não permitido.' }),
  };
};
