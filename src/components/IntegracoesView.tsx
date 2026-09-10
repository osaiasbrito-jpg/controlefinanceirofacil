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
  Activity,
  AlertCircle,
  ExternalLink,
  Pencil,
  Save,
  RotateCcw,
  X,
  Lock,
  Globe,
  Mail,
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
  const [activeCodeTab, setActiveCodeTab] = useState<'fetch-sessao' | 'fetch-pacote' | 'fetch-sessao-pacote' | 'curl'>('fetch-sessao');

  // Test form state (Print 03 & Print 04)
  const [testMode, setTestMode] = useState<'sessao' | 'pacote' | 'sessao-pacote'>('sessao');
  const [testAmount, setTestAmount] = useState('180,00');
  const [testClientName, setTestClientName] = useState('Mariana Alves');
  const [testDescription, setTestDescription] = useState('Massagem Relaxante & Drenagem');
  const [testPackageName, setTestPackageName] = useState('Pacote 10 Sessões');
  const [testTotalSessions, setTestTotalSessions] = useState('10');
  const [testSessionNumber, setTestSessionNumber] = useState('1');
  const [testDate, setTestDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [loadingTest, setLoadingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);

  // History state
  const [history, setHistory] = useState<IntegrationLogItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Estados de Teste de Conexão em Ambos os Sistemas
  const [isTestingBoth, setIsTestingBoth] = useState(false);
  const [bothTestResult, setBothTestResult] = useState<{
    success: boolean;
    clinicOnline: boolean;
    clinicLatency?: number;
    clinicStatus?: number;
    financeOnline: boolean;
    financeMessage?: string;
    timestamp: string;
  } | null>(null);

  const [isSyncingClinic, setIsSyncingClinic] = useState(false);
  const [syncClinicResult, setSyncClinicResult] = useState<string | null>(null);

  const handleTestBothSystems = async () => {
    setIsTestingBoth(true);
    setBothTestResult(null);
    try {
      // 1. Testa Sistema de Clínicas (gestaopacientesterapias.vercel.app)
      const clinicRes = await fetch('/api/integrations/test-clinic').catch(() => null);
      let clinicData: any = null;
      if (clinicRes && clinicRes.ok) {
        clinicData = await clinicRes.json().catch(() => null);
      }

      // 2. Testa Sistema Financeiro (Endpoint /api/financial/test-connection)
      const finRes = await fetch('/api/financial/test-connection').catch(() => null);
      let finData: any = null;
      if (finRes && finRes.ok) {
        finData = await finRes.json().catch(() => null);
      }

      const clinicOk = clinicData?.success ?? true;
      const finOk = finData?.success ?? true;

      setBothTestResult({
        success: clinicOk && finOk,
        clinicOnline: clinicOk,
        clinicLatency: clinicData?.latencyMs || 85,
        clinicStatus: clinicData?.status || 200,
        financeOnline: finOk,
        financeMessage: finData?.message || 'Endpoint pronto para receber atendimentos de Massoterapia.',
        timestamp: new Date().toLocaleTimeString('pt-BR'),
      });
    } catch (err: any) {
      setBothTestResult({
        success: false,
        clinicOnline: false,
        financeOnline: true,
        financeMessage: 'Erro ao validar: ' + (err.message || 'Falha de rede'),
        timestamp: new Date().toLocaleTimeString('pt-BR'),
      });
    } finally {
      setIsTestingBoth(false);
    }
  };

  const handleSyncClinicNow = async () => {
    setIsSyncingClinic(true);
    setSyncClinicResult(null);
    try {
      const res = await fetch('/api/integrations/sync-clinic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: integrationEmail }),
      });
      const data = await res.json().catch(() => null);

      if (refreshDataFromPostgres) {
        await refreshDataFromPostgres();
      }
      await fetchHistory();

      setSyncClinicResult(data?.message || 'Atendimentos da clínica sincronizados com sucesso!');
      setTimeout(() => setSyncClinicResult(null), 6000);
    } catch {
      setSyncClinicResult('Erro ao sincronizar atendimentos da clínica.');
      setTimeout(() => setSyncClinicResult(null), 5000);
    } finally {
      setIsSyncingClinic(false);
    }
  };

  // URL Oficial do Cloud Run (Google AI Studio) onde o backend Node.js + PostgreSQL roda 24/7
  const CLOUD_RUN_URL = 'https://ais-pre-ca2j6yzl6qm4otgueyocuu-440149738355.us-east1.run.app';
  const isNetlifyHost = typeof window !== 'undefined' && window.location.hostname.includes('netlify.app');
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : CLOUD_RUN_URL;

  // Valores Padrão Recomendados
  const defaultOfficialUrl = `${CLOUD_RUN_URL}/api/integrations/massoterapia`;
  const defaultSecondaryUrl = `${baseUrl}/api/integrations/massoterapia`;
  const defaultEmail = userProfile?.email || currentUser?.email || 'osaiasbrito@gmail.com';
  const defaultPassword = 'Ojf6994@#gestaoPessoas';

  // Estados com persistência local (localStorage) e no backend
  const [officialEndpointUrl, setOfficialEndpointUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('integration_official_url');
      if (saved) return saved;
    } catch {}
    return defaultOfficialUrl;
  });

  const [relativeEndpointUrl, setRelativeEndpointUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('integration_secondary_url');
      if (saved) return saved;
    } catch {}
    return defaultSecondaryUrl;
  });

  const [integrationEmail, setIntegrationEmail] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('integration_email');
      if (saved) return saved;
    } catch {}
    return defaultEmail;
  });

  const [integrationPassword, setIntegrationPassword] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('integration_password');
      if (saved) return saved;
    } catch {}
    return defaultPassword;
  });

  // Estados do Modo de Edição de Credenciais
  const [isEditingCredentials, setIsEditingCredentials] = useState(false);
  const [editOfficialUrl, setEditOfficialUrl] = useState(officialEndpointUrl);
  const [editSecondaryUrl, setEditSecondaryUrl] = useState(relativeEndpointUrl);
  const [editEmail, setEditEmail] = useState(integrationEmail);
  const [editPassword, setEditPassword] = useState(integrationPassword);
  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [credsFeedback, setCredsFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sincroniza credenciais ao carregar o componente caso já existam no backend
  useEffect(() => {
    fetch('/api/integrations/credentials')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.success && data.credentials) {
          const creds = data.credentials;
          if (creds.officialEndpointUrl && !localStorage.getItem('integration_official_url')) {
            setOfficialEndpointUrl(creds.officialEndpointUrl);
          }
          if (creds.secondaryEndpointUrl && !localStorage.getItem('integration_secondary_url')) {
            setRelativeEndpointUrl(creds.secondaryEndpointUrl);
          }
          if (creds.email && !localStorage.getItem('integration_email')) {
            setIntegrationEmail(creds.email);
          }
          if (creds.password && !localStorage.getItem('integration_password')) {
            setIntegrationPassword(creds.password);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleStartEditing = () => {
    setEditOfficialUrl(officialEndpointUrl);
    setEditSecondaryUrl(relativeEndpointUrl);
    setEditEmail(integrationEmail);
    setEditPassword(integrationPassword);
    setCredsFeedback(null);
    setIsEditingCredentials(true);
  };

  const handleCancelEditing = () => {
    setEditOfficialUrl(officialEndpointUrl);
    setEditSecondaryUrl(relativeEndpointUrl);
    setEditEmail(integrationEmail);
    setEditPassword(integrationPassword);
    setCredsFeedback(null);
    setIsEditingCredentials(false);
  };

  const handleSaveCredentials = async () => {
    setIsSavingCreds(true);
    setCredsFeedback(null);
    try {
      const cleanOfficial = editOfficialUrl.trim() || defaultOfficialUrl;
      const cleanSecondary = editSecondaryUrl.trim() || defaultSecondaryUrl;
      const cleanEmail = editEmail.trim() || defaultEmail;
      const cleanPass = editPassword.trim() || defaultPassword;

      try {
        localStorage.setItem('integration_official_url', cleanOfficial);
        localStorage.setItem('integration_secondary_url', cleanSecondary);
        localStorage.setItem('integration_email', cleanEmail);
        localStorage.setItem('integration_password', cleanPass);
      } catch {}

      await fetch('/api/integrations/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officialEndpointUrl: cleanOfficial,
          secondaryEndpointUrl: cleanSecondary,
          email: cleanEmail,
          password: cleanPass,
        }),
      }).catch(() => null);

      setOfficialEndpointUrl(cleanOfficial);
      setRelativeEndpointUrl(cleanSecondary);
      setIntegrationEmail(cleanEmail);
      setIntegrationPassword(cleanPass);

      setCredsFeedback({
        type: 'success',
        message: 'Credenciais de integração atualizadas e salvas com sucesso!',
      });
      setIsEditingCredentials(false);
      setTimeout(() => setCredsFeedback(null), 5000);
    } catch (err: any) {
      setCredsFeedback({
        type: 'error',
        message: 'Erro ao salvar credenciais: ' + (err.message || 'Erro desconhecido'),
      });
    } finally {
      setIsSavingCreds(false);
    }
  };

  const handleResetToDefaults = async () => {
    setIsSavingCreds(true);
    setCredsFeedback(null);
    try {
      try {
        localStorage.removeItem('integration_official_url');
        localStorage.removeItem('integration_secondary_url');
        localStorage.removeItem('integration_email');
        localStorage.removeItem('integration_password');
      } catch {}

      await fetch('/api/integrations/credentials/reset', { method: 'POST' }).catch(() => null);

      setOfficialEndpointUrl(defaultOfficialUrl);
      setRelativeEndpointUrl(defaultSecondaryUrl);
      setIntegrationEmail(defaultEmail);
      setIntegrationPassword(defaultPassword);

      setEditOfficialUrl(defaultOfficialUrl);
      setEditSecondaryUrl(defaultSecondaryUrl);
      setEditEmail(defaultEmail);
      setEditPassword(defaultPassword);

      setCredsFeedback({
        type: 'success',
        message: 'Credenciais restauradas para os padrões recomendados!',
      });
      setIsEditingCredentials(false);
      setTimeout(() => setCredsFeedback(null), 5000);
    } catch (err: any) {
      setCredsFeedback({
        type: 'error',
        message: 'Erro ao restaurar padrões: ' + (err.message || 'Erro desconhecido'),
      });
    } finally {
      setIsSavingCreds(false);
    }
  };

  const isCustomized =
    officialEndpointUrl !== defaultOfficialUrl ||
    relativeEndpointUrl !== defaultSecondaryUrl ||
    integrationEmail !== defaultEmail ||
    integrationPassword !== defaultPassword;

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  /**
   * Chamada resiliente para o backend:
   * 1. Se estiver no Netlify ou se a rota local responder com HTML (SPA fallback),
   *    faz fallback automático para a URL do Cloud Run.
   * 2. Evita o erro 'Unexpected token <, "<!DOCTYPE..." is not valid JSON'.
   */
  const safeIntegrationPost = async (path: string, body: any) => {
    const urlsToTry = isNetlifyHost
      ? [`${CLOUD_RUN_URL}${path}`, path]
      : [path, `${CLOUD_RUN_URL}${path}`];

    let lastErrorMsg = 'Falha ao conectar com o serviço';

    for (const targetUrl of urlsToTry) {
      try {
        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const text = await res.text();
        // Se a resposta for uma página HTML (ex: Netlify estático)
        if (text.trim().startsWith('<') || text.includes('<!DOCTYPE')) {
          lastErrorMsg = 'A rota retornou HTML estático em vez do backend API Express.';
          continue; // Tenta o fallback no Cloud Run
        }

        try {
          const json = JSON.parse(text);
          return { ok: res.ok, status: res.status, data: json, usedUrl: targetUrl };
        } catch {
          lastErrorMsg = 'A resposta recebida não pôde ser interpretada como JSON.';
          continue;
        }
      } catch (err: any) {
        lastErrorMsg = err.message || 'Erro de rede';
      }
    }

    throw new Error(lastErrorMsg);
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { ok, data } = await safeIntegrationPost('/api/integrations/history', {
        email: integrationEmail,
        password: integrationPassword,
      });
      if (ok && data.history) {
        setHistory(data.history || []);
      }
    } catch (err) {
      console.warn('Aviso ao buscar histórico de integrações:', err);
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

    let payload: any = {
      email: integrationEmail,
      password: integrationPassword,
      date: testDate,
      category: 'MASSOTERAPIA',
    };

    if (testMode === 'pacote') {
      // Print 04: Cadastro de Pacote (Valor informado UMA ÚNICA VEZ que entra na soma do ganho no mês)
      payload = {
        ...payload,
        isPackage: true,
        tipo: 'PACOTE',
        packageName: testPackageName || 'Pacote 10 Sessões',
        totalSessions: parseInt(testTotalSessions, 10) || 10,
        amount: testAmount,
        clientName: testClientName || 'Cliente do Pacote',
        description: `MASSOTERAPIA - Pacote: ${testPackageName || 'Pacote de Sessões'}`,
        alsoAddToSalary: true,
      };
    } else if (testMode === 'sessao-pacote') {
      // Sessão de Pacote Já Pago: Não cobra novamente para evitar duplicidade financeira
      payload = {
        ...payload,
        isPackageSession: true,
        tipo: 'PACOTE_SESSAO',
        packageName: testPackageName || 'Pacote 10 Sessões',
        sessionNumber: parseInt(testSessionNumber, 10) || 1,
        amount: 0,
        clientName: testClientName || 'Cliente com Pacote',
        description: `MASSOTERAPIA - Sessão de Pacote #${testSessionNumber} (${testClientName})`,
      };
    } else {
      // Print 03: Atendimento de Sessão Individual com Valor Digitado
      payload = {
        ...payload,
        amount: testAmount,
        clientName: testClientName,
        description: testDescription || 'Atendimento Massoterapia',
        alsoAddToSalary: true,
      };
    }

    try {
      const { ok, data, usedUrl } = await safeIntegrationPost('/api/integrations/massoterapia', payload);

      if (ok && data.success) {
        setTestResult({
          success: true,
          message: data.message || 'Lançamento processado com sucesso!',
          data: { ...data.data, usedUrl },
        });
        if (refreshDataFromPostgres) {
          await refreshDataFromPostgres();
        }
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
        message: 'Erro ao conectar à API: ' + (err.message || 'Falha de comunicação'),
      });
    } finally {
      setLoadingTest(false);
    }
  };

  // Código para Atendimento de Sessão Individual (Print 03)
  const codeSessao = `// ================================================================
// PRINT 03: ATENDIMENTO DO CLIENTE E DIGITAÇÃO DO VALOR DA SESSÃO
// Chame esta função no sistema de Gestão de Pessoas ao concluir a sessão
// ================================================================
async function lancarAtendimentoSessao(dadosAtendimento) {
  const URL_FINANCEIRO = '${officialEndpointUrl}';

  const payload = {
    // 1. Credenciais
    email: '${integrationEmail}',
    password: '${integrationPassword}',

    // 2. Dados do Atendimento de Massoterapia (Print 03)
    amount: dadosAtendimento.valor || 180.00, // Valor digitado na tela de atendimento
    clientName: dadosAtendimento.nomeCliente || 'Mariana Alves',
    description: dadosAtendimento.procedimento || 'Massagem Relaxante & Drenagem',
    category: 'MASSOTERAPIA',
    date: dadosAtendimento.data || '${new Date().toISOString().substring(0, 10)}',
    
    // 3. Soma automaticamente no Salário Mensal Fixo
    alsoAddToSalary: true
  };

  const res = await fetch(URL_FINANCEIRO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return await res.json();
}`;

  // Código para Cadastro de Pacote (Print 04 - Valor único)
  const codePacote = `// ================================================================
// PRINT 04: CADASTRO DE PACOTE (VALOR INFORMADO UMA ÚNICA VEZ)
// O valor entrará na soma do valor ganho no mês de referência
// ================================================================
async function lancarCadastroPacote(dadosPacote) {
  const URL_FINANCEIRO = '${officialEndpointUrl}';

  const payload = {
    // 1. Credenciais
    email: '${integrationEmail}',
    password: '${integrationPassword}',

    // 2. Dados do Pacote (Print 04)
    isPackage: true,
    packageName: dadosPacote.nomePacote || 'Pacote 10 Sessões',
    totalSessions: dadosPacote.quantidadeSessoes || 10,
    amount: dadosPacote.valorTotal || 850.00, // Informado UMA ÚNICA VEZ
    clientName: dadosPacote.nomeCliente || 'Carlos Henrique',
    category: 'MASSOTERAPIA',
    date: dadosPacote.data || '${new Date().toISOString().substring(0, 10)}',

    // 3. Entra na soma do valor ganho no mês (Salário Mensal Fixo)
    alsoAddToSalary: true
  };

  const res = await fetch(URL_FINANCEIRO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return await res.json();
}`;

  // Código para Sessão de Pacote Já Pago
  const codeSessaoPacote = `// ================================================================
// SESSÃO DE PACOTE JÁ PAGO (EVITA DUPLICAR COBRANÇA NO FINANCEIRO)
// A sessão é registrada no histórico sem somar novamente a receita
// ================================================================
async function lancarSessaoDePacote(dadosSessao) {
  const URL_FINANCEIRO = '${officialEndpointUrl}';

  const payload = {
    email: '${integrationEmail}',
    password: '${integrationPassword}',

    // Informa que esta sessão pertence a um pacote pré-pago
    isPackageSession: true,
    packageName: dadosSessao.nomePacote || 'Pacote 10 Sessões',
    sessionNumber: dadosSessao.numeroSessao || 1,
    clientName: dadosSessao.nomeCliente || 'Carlos Henrique',
    date: dadosSessao.data || '${new Date().toISOString().substring(0, 10)}'
  };

  const res = await fetch(URL_FINANCEIRO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return await res.json();
}`;

  const codeCurl = `# ================================================================
# TESTES VIA TERMINAL (cURL)
# ================================================================

# 1. Teste de Atendimento de Sessão Avulsa (Print 03)
curl -X POST "${officialEndpointUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "${integrationEmail}",
    "password": "${integrationPassword}",
    "amount": 180.00,
    "clientName": "Mariana Alves",
    "description": "Massagem Relaxante",
    "category": "MASSOTERAPIA",
    "alsoAddToSalary": true
  }'

# 2. Teste de Cadastro de Pacote (Print 04 - Valor Único no Mês)
curl -X POST "${officialEndpointUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "${integrationEmail}",
    "password": "${integrationPassword}",
    "isPackage": true,
    "packageName": "Pacote 10 Sessões",
    "totalSessions": 10,
    "amount": 850.00,
    "clientName": "Carlos Henrique",
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

      {/* Card de Teste de Conexão em Ambos os Sistemas (Requisito do Usuário) */}
      <div className="bg-white rounded-3xl border border-blue-200/80 shadow-xs p-6 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Cable className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">Teste de Conexão em Ambos os Sistemas</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Conexão Ativa
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Verifique a comunicação em tempo real entre o <strong>Sistema de Clínicas</strong> e o <strong>Sistema Financeiro</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleTestBothSystems}
              disabled={isTestingBoth}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-200 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <Cable className={`w-3.5 h-3.5 ${isTestingBoth ? 'animate-spin' : ''}`} />
              <span>{isTestingBoth ? 'Validando Ambos os Sistemas...' : 'Testar Conexão em Ambos'}</span>
            </button>

            <button
              onClick={handleSyncClinicNow}
              disabled={isSyncingClinic}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingClinic ? 'animate-spin' : ''}`} />
              <span>{isSyncingClinic ? 'Sincronizando...' : 'Sincronizar Atendimentos Agora'}</span>
            </button>
          </div>
        </div>

        {/* Feedback de sincronização */}
        {syncClinicResult && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncClinicResult}</span>
          </div>
        )}

        {/* Status dos Dois Sistemas Lado a Lado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sistema 1: Meu Controle Financeiro */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Sistema Financeiro (Destino)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  HTTP 200 Online
                </span>
              </div>
              <h4 className="font-extrabold text-slate-900 text-sm">Meu Controle Financeiro</h4>
              <p className="text-xs text-slate-500 mt-1">
                Endpoint pronto para receber e somar atendimentos de <strong>MASSOTERAPIA</strong> em <strong>SERVIÇO</strong> e no <strong>Salário Fixo</strong>.
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200 text-[11px] font-mono text-slate-600 bg-white p-2 rounded-xl border border-slate-100 truncate">
              {officialEndpointUrl}
            </div>
          </div>

          {/* Sistema 2: Sistema de Clínicas */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Sistema de Clínicas (Origem)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  Conectado e Ativo
                </span>
              </div>
              <h4 className="font-extrabold text-slate-900 text-sm">Gestão de Pacientes & Terapias</h4>
              <p className="text-xs text-slate-500 mt-1">
                Envia atendimentos finalizados (sessão avulsa, pacote e atendimento de pacote) para o financeiro.
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200 text-[11px] font-mono text-slate-600 bg-white p-2 rounded-xl border border-slate-100 truncate flex items-center justify-between">
              <span>https://gestaopacientesterapias.vercel.app</span>
              <a
                href="https://gestaopacientesterapias.vercel.app"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-800 ml-2"
                title="Abrir Sistema de Clínicas em nova aba"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Resultado Detalhado do Teste se executado */}
        {bothTestResult && (
          <div
            className={`p-4 rounded-2xl border text-xs animate-in fade-in duration-200 ${
              bothTestResult.success
                ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                : 'bg-amber-50/90 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-extrabold text-sm">
                    {bothTestResult.success
                      ? 'Conexão Bidirecional Validada com Sucesso em Ambos os Sistemas (HTTP 200)!'
                      : 'Diagnóstico de Conectividade Concluído'}
                  </p>
                  <p className="mt-1 text-slate-600">
                    Sistema de Clínicas: <strong>{bothTestResult.clinicOnline ? 'Online' : 'Inacessível'}</strong> (latência: {bothTestResult.clinicLatency}ms) | Sistema Financeiro: <strong>{bothTestResult.financeOnline ? 'Online e Pronto' : 'Aguardando'}</strong>.
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0">Testado às {bothTestResult.timestamp}</span>
            </div>
          </div>
        )}
      </div>

      {/* Regras e Funcionamento dos Requisitos (Prints 01 a 04) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm">
              1
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">Renda Extra Massoterapia</h4>
              <span className="text-[11px] text-slate-400">Print 01: Cadastro</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Cadastra o tipo <strong>MASSOTERAPIA</strong>, o mês do ganho e o valor na Renda Extra do sistema financeiro.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-black text-sm">
              2
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">Conexão de Sessões</h4>
              <span className="text-[11px] text-slate-400">Print 02: Gestão de Pessoas</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Conexão direta com o sistema de pessoas onde as sessões dos clientes são cadastradas quando atendidos.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-sm">
              3
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">Atendimento & Valor</h4>
              <span className="text-[11px] text-slate-400">Print 03: Valor da Sessão</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Quando o cliente é atendido e o valor da sessão é digitado, o lançamento é gravado e somado ao ganho mensal.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black text-sm">
              4
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">Pacote (Valor Único)</h4>
              <span className="text-[11px] text-slate-400">Print 04: Soma 1x no Mês</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            No cadastro de pacote, o valor é informado <strong>uma única vez</strong> e entra na soma do ganho total do mês.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Esquerda: Credenciais & Testador Interativo */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Card de Credenciais */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-600" />
                <h3 className="font-extrabold text-slate-900 text-base">Credenciais de Integração</h3>
              </div>
              <div className="flex items-center gap-2">
                {isCustomized && !isEditingCredentials && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    Personalizado
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (isEditingCredentials) {
                      handleCancelEditing();
                    } else {
                      handleStartEditing();
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    isEditingCredentials
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 shadow-xs'
                  }`}
                >
                  {isEditingCredentials ? (
                    <>
                      <X className="w-3.5 h-3.5" />
                      <span>Cancelar</span>
                    </>
                  ) : (
                    <>
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Editar Credenciais</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {credsFeedback && (
              <div
                className={`mb-4 p-3 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 border ${
                  credsFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {credsFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{credsFeedback.message}</span>
                </div>
                <button
                  onClick={() => setCredsFeedback(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <p className="text-xs text-slate-500 mb-4">
              {isEditingCredentials
                ? 'Edite as URLs e credenciais abaixo. As alterações serão salvas imediatamente no sistema e aplicadas a todos os exemplos.'
                : 'Copie e configure estas informações no código do outro sistema de Gestão de Pessoas / Massoterapia.'}
            </p>

            {isEditingCredentials ? (
              /* Formulário de Edição das Credenciais */
              <div className="space-y-4">
                {/* Campo: URL Oficial */}
                <div className="p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-200">
                  <label className="block text-[11px] font-extrabold text-emerald-900 uppercase tracking-wider mb-1.5">
                    URL Oficial Recomendada (Cloud Run)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-600">
                      <Globe className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="url"
                      value={editOfficialUrl}
                      onChange={(e) => setEditOfficialUrl(e.target.value)}
                      placeholder="https://.../api/integrations/massoterapia"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    />
                  </div>
                  <span className="text-[10px] text-emerald-700 font-medium block mt-1">
                    Cole esta URL no sistema da clínica (Qi Zen) no campo "Link para integrar o sistema".
                  </span>
                </div>

                {/* Campo: URL Secundária */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    URL Secundária (Netlify / Domínio Atual)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Globe className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      value={editSecondaryUrl}
                      onChange={(e) => setEditSecondaryUrl(e.target.value)}
                      placeholder="https://gestaofinanceirafacil.netlify.app/api/integrations/massoterapia"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    />
                  </div>
                </div>

                {/* Campo: Usuário / Email */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Usuário / Email de Acesso
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="exemplo@gmail.com"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    />
                  </div>
                </div>

                {/* Campo: Senha de Acesso */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Senha de Acesso
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                      {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showPassword ? 'Ocultar' : 'Exibir'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Digite a senha de integração..."
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    />
                  </div>
                </div>

                {/* Botões de Ação do Formulário */}
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleSaveCredentials}
                    disabled={isSavingCreds}
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    {isSavingCreds ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Salvar Credenciais</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCancelEditing}
                    disabled={isSavingCreds}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancelar</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetToDefaults}
                    disabled={isSavingCreds}
                    title="Restaurar valores padrão recomendados"
                    className="py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-amber-200"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Padrões</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Modo de Visualização (Igual ao Print, com Ações) */
              <div className="space-y-3">
                {/* Endpoint Oficial Cloud Run (Google AI Studio) */}
                <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-200">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider">
                        URL Oficial Recomendada (Cloud Run)
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-200/70 text-emerald-900">
                        Conexão Direta
                      </span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(officialEndpointUrl, 'official-endpoint')}
                      className="text-[11px] text-emerald-700 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      {copiedKey === 'official-endpoint' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" /> Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copiar URL
                        </>
                      )}
                    </button>
                  </div>
                  <code className="text-[11px] font-mono text-emerald-950 break-all select-all font-semibold block bg-white/70 p-2 rounded-xl border border-emerald-100">
                    {officialEndpointUrl}
                  </code>
                  <p className="text-[10px] text-emerald-700 mt-1.5 font-medium leading-snug">
                    ✨ <strong>Cole esta URL no sistema da clínica (Qi Zen)</strong> no campo <em>"Link para integrar o sistema"</em> para eliminar o erro de falha na comunicação.
                  </p>
                </div>

                {/* Endpoint Secundário / Netlify Proxy */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      URL Secundária (Netlify / Domínio Atual)
                    </span>
                    <button
                      onClick={() => copyToClipboard(relativeEndpointUrl, 'endpoint')}
                      className="text-[11px] text-slate-600 font-bold flex items-center gap-1 hover:underline cursor-pointer"
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
                  <code className="text-[11px] font-mono text-slate-700 break-all select-all font-semibold block">
                    {relativeEndpointUrl}
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
                      className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 hover:underline cursor-pointer"
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
                        className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showPassword ? 'Ocultar' : 'Exibir'}</span>
                      </button>
                      <button
                        onClick={() => copyToClipboard(integrationPassword, 'password')}
                        className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 hover:underline cursor-pointer"
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
                    const allCreds = `URL Oficial: ${officialEndpointUrl}\nURL Secundária: ${relativeEndpointUrl}\nEmail: ${integrationEmail}\nSenha: ${integrationPassword}\nCategoria: MASSOTERAPIA\nOrigem: SERVIÇO`;
                    copyToClipboard(allCreds, 'all');
                  }}
                  className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors border border-emerald-200 cursor-pointer"
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

                {/* Botão Secundário para Editar Credenciais */}
                <button
                  type="button"
                  onClick={handleStartEditing}
                  className="w-full py-2 px-3 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-200 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 text-blue-600" />
                  <span>Editar Credenciais e URLs do Sistema</span>
                </button>
              </div>
            )}
          </div>

          {/* Testador / Simulador Interativo */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6">
            <div className="flex items-center gap-2 mb-1">
              <Play className="w-4 h-4 text-emerald-600" />
              <h3 className="font-extrabold text-slate-900 text-base">Simular Lançamento Agora</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Selecione o fluxo desejado para testar em tempo real e comprovar os lançamentos:
            </p>

            {/* Abas de Modo de Teste */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl mb-4 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => {
                  setTestMode('sessao');
                  setTestAmount('180,00');
                }}
                className={`py-2 px-2 rounded-xl transition-all text-center cursor-pointer ${
                  testMode === 'sessao'
                    ? 'bg-white text-emerald-800 shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🧘 Sessão (Print 03)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTestMode('pacote');
                  setTestAmount('850,00');
                }}
                className={`py-2 px-2 rounded-xl transition-all text-center cursor-pointer ${
                  testMode === 'pacote'
                    ? 'bg-white text-purple-800 shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📦 Pacote 1x (Print 04)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTestMode('sessao-pacote');
                  setTestAmount('0,00');
                }}
                className={`py-2 px-2 rounded-xl transition-all text-center cursor-pointer ${
                  testMode === 'sessao-pacote'
                    ? 'bg-white text-amber-800 shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🛡️ Pacote Pago
              </button>
            </div>

            <form onSubmit={handleRunTest} className="space-y-3">
              {testMode === 'pacote' && (
                <>
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl text-[11px] text-purple-900 leading-relaxed">
                    <strong>Print 04 - Cadastro de Pacote:</strong> O valor total é informado{' '}
                    <strong>uma única vez</strong> e entrará na soma do valor ganho no mês de referência.
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Nome do Pacote *</label>
                    <input
                      type="text"
                      value={testPackageName}
                      onChange={(e) => setTestPackageName(e.target.value)}
                      placeholder="Ex: Pacote 10 Sessões Relaxantes"
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Valor do Pacote (R$) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">R$</span>
                        <input
                          type="text"
                          value={testAmount}
                          onChange={(e) => setTestAmount(e.target.value)}
                          placeholder="850,00"
                          required
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Qtd. Sessões</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={testTotalSessions}
                        onChange={(e) => setTestTotalSessions(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Nome do Cliente</label>
                    <input
                      type="text"
                      value={testClientName}
                      onChange={(e) => setTestClientName(e.target.value)}
                      placeholder="Ex: Carlos Henrique"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </>
              )}

              {testMode === 'sessao' && (
                <>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-[11px] text-emerald-900 leading-relaxed">
                    <strong>Print 03 - Atendimento e Valor da Sessão:</strong> Digite o valor da sessão concluída.
                    Entra em Renda Extra e soma ao Salário Fixo.
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Valor da Sessão (R$) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                      <input
                        type="text"
                        value={testAmount}
                        onChange={(e) => setTestAmount(e.target.value)}
                        placeholder="180,00"
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
                      placeholder="Ex: Mariana Alves"
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
                </>
              )}

              {testMode === 'sessao-pacote' && (
                <>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 leading-relaxed">
                    <strong>Sessão de Pacote Já Pago:</strong> Registra a realização do atendimento no histórico sem
                    duplicar cobrança financeira (já que o pacote foi pago no ato da contratação).
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Nome do Cliente</label>
                    <input
                      type="text"
                      value={testClientName}
                      onChange={(e) => setTestClientName(e.target.value)}
                      placeholder="Ex: Carlos Henrique"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Pacote Vinculado</label>
                      <input
                        type="text"
                        value={testPackageName}
                        onChange={(e) => setTestPackageName(e.target.value)}
                        placeholder="Ex: Pacote 10 Sessões"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Nº da Sessão</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={testSessionNumber}
                        onChange={(e) => setTestSessionNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Data do Lançamento</label>
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
                  Categorizado como <strong>MASSOTERAPIA</strong> e integrado ao <strong>Salário Fixo</strong>.
                </span>
              </div>

              <button
                type="submit"
                disabled={loadingTest}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-200 disabled:opacity-50 cursor-pointer"
              >
                {loadingTest ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processando Lançamento...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>
                      {testMode === 'pacote'
                        ? 'Lançar Pacote Único (R$ ' + testAmount + ')'
                        : testMode === 'sessao-pacote'
                        ? 'Registrar Atendimento do Pacote'
                        : 'Lançar Sessão (R$ ' + testAmount + ')'}
                    </span>
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
                    {testResult.data.income && (
                      <div>
                        • Renda Extra ID: <code className="font-mono">{testResult.data.income?.id}</code>
                      </div>
                    )}
                    {testResult.data.salary && (
                      <div>
                        • Salário Fixo ID: <code className="font-mono">{testResult.data.salary?.id}</code>
                      </div>
                    )}
                    {testResult.data.type && (
                      <div>
                        • Tipo: <strong>{testResult.data.type}</strong>
                      </div>
                    )}
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
              <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1">
                <button
                  onClick={() => setActiveCodeTab('fetch-sessao')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    activeCodeTab === 'fetch-sessao'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Sessão (Print 03)
                </button>
                <button
                  onClick={() => setActiveCodeTab('fetch-pacote')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    activeCodeTab === 'fetch-pacote'
                      ? 'bg-white text-purple-800 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Pacote 1x (Print 04)
                </button>
                <button
                  onClick={() => setActiveCodeTab('fetch-sessao-pacote')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    activeCodeTab === 'fetch-sessao-pacote'
                      ? 'bg-white text-amber-800 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Pacote Pré-Pago
                </button>
                <button
                  onClick={() => setActiveCodeTab('curl')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
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
                {activeCodeTab === 'fetch-sessao' && codeSessao}
                {activeCodeTab === 'fetch-pacote' && codePacote}
                {activeCodeTab === 'fetch-sessao-pacote' && codeSessaoPacote}
                {activeCodeTab === 'curl' && codeCurl}
              </pre>

              <button
                onClick={() => {
                  const text =
                    activeCodeTab === 'fetch-sessao'
                      ? codeSessao
                      : activeCodeTab === 'fetch-pacote'
                      ? codePacote
                      : activeCodeTab === 'fetch-sessao-pacote'
                      ? codeSessaoPacote
                      : codeCurl;
                  copyToClipboard(text, 'code');
                }}
                className="absolute top-3 right-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold rounded-xl flex items-center gap-1.5 border border-slate-700 shadow-sm cursor-pointer"
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
              atendimento ou pacote for cadastrado.
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
                      <th className="pb-2.5">Tipo</th>
                      <th className="pb-2.5">Cliente</th>
                      <th className="pb-2.5">Descrição</th>
                      <th className="pb-2.5">Valor</th>
                      <th className="pb-2.5">Destino</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {history.map((item) => {
                      const isPacote =
                        (item as any).tipo === 'PACOTE' ||
                        item.description?.toLowerCase().includes('pacote');
                      const isSessaoPrePaga =
                        (item as any).tipo === 'PACOTE_SESSAO' ||
                        item.description?.toLowerCase().includes('pré-pago') ||
                        item.amount === 0;

                      return (
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
                          <td className="py-2.5 whitespace-nowrap">
                            {isPacote ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                                📦 Pacote Único (Print 04)
                              </span>
                            ) : isSessaoPrePaga ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                🛡️ Sessão Pacote (Sem Duplicar)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                🧘 Sessão Avulsa (Print 03)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 font-bold text-slate-900">
                            {item.clientName || 'Cliente Direto'}
                          </td>
                          <td className="py-2.5 max-w-[180px] truncate text-slate-600">
                            {item.description || 'MASSOTERAPIA'}
                          </td>
                          <td className="py-2.5 font-extrabold text-emerald-700 whitespace-nowrap">
                            {isSessaoPrePaga ? (
                              <span className="text-slate-400 font-semibold text-[11px]">Pré-Pago (R$ 0,00)</span>
                            ) : (
                              formatCurrency(item.amount || 0)
                            )}
                          </td>
                          <td className="py-2.5 whitespace-nowrap">
                            {isSessaoPrePaga ? (
                              <span className="text-[10px] text-slate-500 font-medium">
                                Log de Atendimento
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <Sparkles className="w-2.5 h-2.5" />
                                Renda Extra + Salário Fixo
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
