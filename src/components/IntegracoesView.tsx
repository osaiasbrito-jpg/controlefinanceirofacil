import React, { useState, useEffect } from 'react';
import {
  Cable,
  Key,
  Copy,
  Check,
  Code2,
  Play,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
  User,
  DollarSign,
  Briefcase,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency } from '../utils/formatters';

interface IntegrationLogItem {
  id: string;
  userId: string;
  systemName: string;
  action: string;
  amount: number;
  clientName?: string;
  description?: string;
  createdAt: string;
}

export const IntegracoesView: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const { refreshDataFromPostgres, selectedMonth } = useFinance();

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<'fetch-direct' | 'fetch-auth' | 'curl'>('fetch-direct');

  // Test form state
  const [testAmount, setTestAmount] = useState('180,00');
  const [testClientName, setTestClientName] = useState('Mariana Alves');
  const [testDescription, setTestDescription] = useState('Massagem Relaxante & Drenagem');
  const [testDate, setTestDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [loadingTest, setLoadingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);

  // History state
  const [history, setHistory] = useState<IntegrationLogItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://meucontrolefinanceiro.app';
  const integrationEmail = userProfile?.email || currentUser?.email || 'osaiasbrito@gmail.com';
  const integrationPassword = 'Ojf6994@#gestaoPessoas';

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/integrations/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: integrationEmail, password: integrationPassword }),
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Erro ao buscar histórico de integrações:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [integrationEmail]);

  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingTest(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/integrations/massoterapia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: integrationEmail,
          password: integrationPassword,
          amount: testAmount,
          clientName: testClientName,
          description: testDescription || 'Atendimento Massoterapia',
          date: testDate,
          category: 'MASSOTERAPIA',
          alsoAddToSalary: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: data.message || 'Atendimento lançado com sucesso!',
          data: data.data,
        });
        // Atualiza os dados do frontend em tempo real
        if (refreshDataFromPostgres) {
          await refreshDataFromPostgres();
        }
        // Atualiza a tabela de histórico
        await fetchHistory();
      } else {
        setTestResult({
          success: false,
          message: data.error || data.message || 'Falha ao processar teste.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Erro ao conectar à API: ' + (err.message || 'Falha de rede'),
      });
    } finally {
      setLoadingTest(false);
    }
  };

  // Code snippets for the other system in Google AI Studio
  const codeDirectFetch = `// ================================================================
// CÓDIGO PARA O OUTRO SISTEMA NO GOOGLE AI STUDIO (GESTAO DE PESSOAS)
// Chame esta funcao ao concluir um atendimento de massoterapia
// ================================================================
async function lancarAtendimentoFinanceiro(dadosAtendimento) {
  const URL_FINANCEIRO = '${baseUrl}/api/integrations/massoterapia';

  const payload = {
    // 1. Credenciais de Acesso (solicitadas pelo financeiro)
    email: '${integrationEmail}',
    password: '${integrationPassword}',

    // 2. Dados do Atendimento de Massoterapia
    amount: dadosAtendimento.valor || 150.00, // Ex: 150.00 ou "150,00"
    clientName: dadosAtendimento.nomeCliente || 'Cliente Atendido',
    description: dadosAtendimento.procedimento || 'Atendimento Massoterapia',
    category: 'MASSOTERAPIA', // Categoria cadastrada
    date: dadosAtendimento.data || '${new Date().toISOString().substring(0, 10)}', // YYYY-MM-DD
    
    // 3. Soma automaticamente no Salario Mensal Fixo
    alsoAddToSalary: true
  };

  try {
    const resposta = await fetch(URL_FINANCEIRO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const resultado = await resposta.json();
    if (resultado.success) {
      console.log('✅ Lancamento registrado no financeiro com sucesso!', resultado);
      return resultado;
    } else {
      console.error('❌ Erro no financeiro:', resultado.error);
    }
  } catch (erro) {
    console.error('❌ Falha na conexao com o sistema financeiro:', erro);
  }
}`;

  const codeAuthStep = `// ================================================================
// FLUXO EM 2 PASSOS (LOGIN COM TOKEN + LANCAMENTO)
// ================================================================

// 1. Solicita autenticacao com usuario e senha
async function obterTokenIntegracao() {
  const res = await fetch('${baseUrl}/api/integrations/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: '${integrationEmail}',
      password: '${integrationPassword}'
    })
  });
  const data = await res.json();
  return data.token;
}

// 2. Realiza o lancamento do atendimento de Massoterapia
async function enviarMassoterapiaComToken(token, atendimento) {
  const res = await fetch('${baseUrl}/api/integrations/massoterapia', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      amount: atendimento.valor,
      clientName: atendimento.nomeCliente,
      description: 'Atendimento Massoterapia',
      category: 'MASSOTERAPIA',
      alsoAddToSalary: true // Soma ao Salario Mensal Fixo
    })
  });
  return await res.json();
}`;

  const codeCurl = `# Testar lancamento direto via terminal (cURL)
curl -X POST "${baseUrl}/api/integrations/massoterapia" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "${integrationEmail}",
    "password": "${integrationPassword}",
    "amount": 150.00,
    "clientName": "Maria Silva",
    "description": "Massoterapia - Drenagem Linfatica",
    "category": "MASSOTERAPIA",
    "alsoAddToSalary": true
  }'`;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 pb-16">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Cable className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">Integração entre Sistemas</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              API Ativa v2.0
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Conecte o outro sistema (Gestão de Pessoas / Atendimentos de Massagens do Google AI Studio) para
            lançar atendimentos em <strong>Renda Extra (MASSOTERAPIA)</strong> e somar automaticamente ao{' '}
            <strong>Salário Mensal Fixo</strong>.
          </p>
        </div>

        <button
          onClick={fetchHistory}
          disabled={loadingHistory}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-2xl border border-slate-200 transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
          <span>Atualizar Histórico</span>
        </button>
      </div>

      {/* Regras e Funcionamento dos 3 Requisitos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm">
              1
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">Acesso com Usuário & Senha</h4>
              <span className="text-[11px] text-slate-400">Autenticação Segura</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            O outro sistema solicita autorização via usuário e senha ou passa as credenciais no corpo da
            requisição para validação instantânea.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-sm">
              2
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">Categoria MASSOTERAPIA</h4>
              <span className="text-[11px] text-slate-400">Renda Extra Automática</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Cada atendimento concluído gera um registro em Renda Extra com o valor recebido, nome do cliente e a
            categoria <strong>MASSOTERAPIA</strong>.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black text-sm">
              3
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">Somado ao Salário Fixo</h4>
              <span className="text-[11px] text-slate-400">Composição Mensal</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            O valor lançado entra simultaneamente no <strong>Salário Mensal</strong> do mês corrente, elevando a
            receita e o saldo para pagamento de despesas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Esquerda: Credenciais & Testador Interativo */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Card de Credenciais */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6">
            <div className="flex items-center gap-2 mb-4">
              <Key className="w-4 h-4 text-emerald-600" />
              <h3 className="font-extrabold text-slate-900 text-base">Credenciais de Integração</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Copie e configure estas informações no código do outro sistema de Gestão de Pessoas /
              Massoterapia.
            </p>

            <div className="space-y-3">
              {/* Endpoint Base */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Endpoint de Lançamento
                  </span>
                  <button
                    onClick={() => copyToClipboard(`${baseUrl}/api/integrations/massoterapia`, 'endpoint')}
                    className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 hover:underline"
                  >
                    {copiedKey === 'endpoint' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copiar
                      </>
                    )}
                  </button>
                </div>
                <code className="text-xs font-mono text-slate-800 break-all select-all font-semibold">
                  {baseUrl}/api/integrations/massoterapia
                </code>
              </div>

              {/* Usuário / Email */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Usuário / Email
                  </span>
                  <button
                    onClick={() => copyToClipboard(integrationEmail, 'email')}
                    className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 hover:underline"
                  >
                    {copiedKey === 'email' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copiar
                      </>
                    )}
                  </button>
                </div>
                <div className="text-xs font-mono text-slate-800 font-semibold">{integrationEmail}</div>
              </div>

              {/* Senha */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Senha de Acesso
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                      {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showPassword ? 'Ocultar' : 'Exibir'}</span>
                    </button>
                    <button
                      onClick={() => copyToClipboard(integrationPassword, 'password')}
                      className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 hover:underline"
                    >
                      {copiedKey === 'password' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" /> Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copiar
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="text-xs font-mono text-slate-800 font-semibold">
                  {showPassword ? integrationPassword : '•••••••••••••••••••••'}
                </div>
              </div>

              {/* Botão Copiar Tudo */}
              <button
                onClick={() => {
                  const allCreds = `URL: ${baseUrl}/api/integrations/massoterapia\nEmail: ${integrationEmail}\nSenha: ${integrationPassword}\nCategoria: MASSOTERAPIA`;
                  copyToClipboard(allCreds, 'all');
                }}
                className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors border border-emerald-200"
              >
                {copiedKey === 'all' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Todas as Credenciais Copiadas!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-emerald-600" />
                    <span>Copiar Todas as Credenciais Juntas</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Testador / Simulador Interativo */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6">
            <div className="flex items-center gap-2 mb-1">
              <Play className="w-4 h-4 text-emerald-600" />
              <h3 className="font-extrabold text-slate-900 text-base">Simular Lançamento Agora</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Teste o envio de um atendimento de massoterapia e comprove a inclusão na Renda Extra e no Salário
              Fixo.
            </p>

            <form onSubmit={handleRunTest} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Valor do Atendimento (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="text"
                    value={testAmount}
                    onChange={(e) => setTestAmount(e.target.value)}
                    placeholder="150,00"
                    required
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Nome do Cliente</label>
                <input
                  type="text"
                  value={testClientName}
                  onChange={(e) => setTestClientName(e.target.value)}
                  placeholder="Ex: Roberto Silva"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Procedimento / Descrição
                </label>
                <input
                  type="text"
                  value={testDescription}
                  onChange={(e) => setTestDescription(e.target.value)}
                  placeholder="Ex: Massagem Relaxante"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Data do Atendimento</label>
                <input
                  type="date"
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl text-[11px] text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  O lançamento será categorizado como <strong>MASSOTERAPIA</strong> e somado ao{' '}
                  <strong>Salário Fixo</strong>.
                </span>
              </div>

              <button
                type="submit"
                disabled={loadingTest}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-200 disabled:opacity-50"
              >
                {loadingTest ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Lançando Atendimento...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Lançar Atendimento de Teste</span>
                  </>
                )}
              </button>
            </form>

            {/* Mensagem de resultado do teste */}
            {testResult && (
              <div
                className={`mt-4 p-3.5 rounded-2xl border text-xs leading-relaxed ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="font-extrabold flex items-center gap-2 mb-1">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
                {testResult.data && (
                  <div className="text-[11px] text-emerald-700 mt-2 space-y-1">
                    <div>
                      • Renda Extra ID: <code className="font-mono">{testResult.data.income?.id}</code>
                    </div>
                    <div>
                      • Salário Fixo ID: <code className="font-mono">{testResult.data.salary?.id}</code>
                    </div>
                    <div>
                      • Valor: <strong>{formatCurrency(testResult.data.income?.amount || 0)}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Coluna Direita: Código Pronto para o outro Sistema e Histórico */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Card de Código para o Outro Sistema */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-600" />
                <h3 className="font-extrabold text-slate-900 text-base">
                  Código Pronto para o Outro Sistema (AI Studio)
                </h3>
              </div>

              {/* Abas de Código */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                <button
                  onClick={() => setActiveCodeTab('fetch-direct')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    activeCodeTab === 'fetch-direct'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Fetch Direto (1 Passo)
                </button>
                <button
                  onClick={() => setActiveCodeTab('fetch-auth')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    activeCodeTab === 'fetch-auth'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Auth com Token
                </button>
                <button
                  onClick={() => setActiveCodeTab('curl')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    activeCodeTab === 'curl'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  cURL
                </button>
              </div>
            </div>

            <div className="relative">
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl font-mono text-xs overflow-x-auto leading-relaxed max-h-[340px]">
                {activeCodeTab === 'fetch-direct' && codeDirectFetch}
                {activeCodeTab === 'fetch-auth' && codeAuthStep}
                {activeCodeTab === 'curl' && codeCurl}
              </pre>

              <button
                onClick={() => {
                  const text =
                    activeCodeTab === 'fetch-direct'
                      ? codeDirectFetch
                      : activeCodeTab === 'fetch-auth'
                      ? codeAuthStep
                      : codeCurl;
                  copyToClipboard(text, 'code');
                }}
                className="absolute top-3 right-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold rounded-xl flex items-center gap-1.5 border border-slate-700 shadow-sm"
              >
                {copiedKey === 'code' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Código</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Basta copiar este código e colar dentro do sistema de Gestão de Pessoas no Google AI Studio quando o
              atendimento for concluído.
            </p>
          </div>

          {/* Histórico de Atendimentos Recebidos */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <h3 className="font-extrabold text-slate-900 text-base">Atendimentos Recebidos da Integração</h3>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {history.length} {history.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>

            {loadingHistory ? (
              <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Carregando histórico do banco de dados...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                Nenhum atendimento recebido ainda. Use o botão <strong>"Simular Lançamento Agora"</strong> ao lado
                para fazer o primeiro teste!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-2.5">Data / Hora</th>
                      <th className="pb-2.5">Cliente</th>
                      <th className="pb-2.5">Descrição</th>
                      <th className="pb-2.5">Valor</th>
                      <th className="pb-2.5">Destino</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {history.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 whitespace-nowrap text-slate-500">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </td>
                        <td className="py-2.5 font-bold text-slate-900">
                          {item.clientName || 'Cliente Direto'}
                        </td>
                        <td className="py-2.5 max-w-[180px] truncate text-slate-600">
                          {item.description || 'MASSOTERAPIA'}
                        </td>
                        <td className="py-2.5 font-extrabold text-emerald-700 whitespace-nowrap">
                          {formatCurrency(item.amount || 0)}
                        </td>
                        <td className="py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <Sparkles className="w-2.5 h-2.5" />
                            Renda Extra + Salário Fixo
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
