import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Server,
  Zap,
  Clock,
  ShieldCheck,
  X,
  AlertTriangle,
} from 'lucide-react';
import { formatDateBR } from '../utils/formatters';

interface DatabaseTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface DbHealthResult {
  status: 'ok' | 'error';
  database: string;
  connected: boolean;
  latencyMs: number;
  timestamp: string;
  details?: {
    user?: string;
    serverTime?: string;
    version?: string;
  };
  error?: string;
}

export const testDatabaseConnection = async (): Promise<DbHealthResult> => {
  const startTime = performance.now();
  try {
    const res = await fetch('/api/health/db', {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
    const endTime = performance.now();
    const latency = Math.round(endTime - startTime);

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        status: 'error',
        database: 'cloud_sql_development_database',
        connected: false,
        latencyMs: latency,
        timestamp: new Date().toISOString(),
        error: errJson.error || `Erro HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = await res.json();
    return {
      status: 'ok',
      database: data.database || 'cloud_sql_development_database',
      connected: Boolean(data.connected),
      latencyMs: data.latencyMs || latency,
      timestamp: data.timestamp || new Date().toISOString(),
      details: data.details,
    };
  } catch (err: any) {
    const endTime = performance.now();
    return {
      status: 'error',
      database: 'cloud_sql_development_database',
      connected: false,
      latencyMs: Math.round(endTime - startTime),
      timestamp: new Date().toISOString(),
      error: err?.message || 'Falha de rede ao conectar ao servidor PostgreSQL.',
    };
  }
};

export const DatabaseTestModal: React.FC<DatabaseTestModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DbHealthResult | null>(null);

  const runTest = async () => {
    setLoading(true);
    try {
      const res = await testDatabaseConnection();
      setResult(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runTest();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isSuccess = result?.status === 'ok' && result?.connected;

  return (
    <div
      id="database-test-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                loading
                  ? 'bg-emerald-50 text-emerald-600'
                  : isSuccess
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">
                Teste de Conexão com Banco de Dados
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                PostgreSQL Relacional (Cloud SQL Developer Edition)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
              <span className="text-sm font-bold text-slate-700">
                Testando conectividade com o PostgreSQL...
              </span>
              <span className="text-xs text-slate-400">
                Executando verificação de ping, latência e integridade da sessão.
              </span>
            </div>
          ) : result ? (
            <div className="flex flex-col gap-3.5">
              {/* Status Banner */}
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                  isSuccess
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50/80 border-rose-200 text-rose-900'
                }`}
              >
                {isSuccess ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex flex-col">
                  <span className="text-sm font-black">
                    {isSuccess
                      ? 'Conexão Estabelecida com Sucesso!'
                      : 'Falha na Conexão com o Banco de Dados'}
                  </span>
                  <span className="text-xs mt-0.5 font-medium opacity-90">
                    {isSuccess
                      ? 'O banco de dados PostgreSQL está ativo, acessível e respondendo normalmente às consultas.'
                      : result.error || 'Não foi possível se comunicar com o banco de dados.'}
                  </span>
                </div>
              </div>

              {/* Diagnostic Grid */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col gap-1">
                  <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-slate-500" />
                    Banco de Dados
                  </span>
                  <span className="font-bold text-slate-800 font-mono truncate">
                    {result.database}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col gap-1">
                  <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    Latência do Servidor
                  </span>
                  <span
                    className={`font-black font-mono ${
                      result.latencyMs < 100
                        ? 'text-emerald-600'
                        : result.latencyMs < 300
                        ? 'text-amber-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {result.latencyMs} ms{' '}
                    <span className="text-[10px] font-normal text-slate-400">
                      ({result.latencyMs < 100 ? 'Excelente' : 'Normal'})
                    </span>
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col gap-1">
                  <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Usuário Autenticado
                  </span>
                  <span className="font-bold text-slate-800 font-mono">
                    {result.details?.user || 'ai_studio_admin'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col gap-1">
                  <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    Horário do Teste
                  </span>
                  <span className="font-bold text-slate-800">
                    {new Date(result.timestamp).toLocaleTimeString('pt-BR')} (
                    {formatDateBR(result.timestamp.substring(0, 10))})
                  </span>
                </div>
              </div>

              {result.details?.version && (
                <div className="p-2.5 bg-slate-100 rounded-xl text-[10px] text-slate-500 font-mono truncate">
                  <strong>Motor:</strong> {result.details.version}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={runTest}
            disabled={loading}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Testando...' : 'Executar Novo Teste'}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black transition-all shadow-xs cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
