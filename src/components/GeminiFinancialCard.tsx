import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  Zap,
  Tag,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  PiggyBank,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency, getMonthName } from '../utils/formatters';
import { GeminiFinancialAnalysis } from '../types';

export const GeminiFinancialCard: React.FC = () => {
  const {
    selectedMonth,
    monthSummary,
    expenses,
    currentUser,
    categories,
    installmentPurchases,
  } = useFinance();

  const [analysis, setAnalysis] = useState<GeminiFinancialAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Month-filtered expenses
  const monthExpenses = React.useMemo(() => {
    return expenses.filter((e) => e.referenceMonth === selectedMonth);
  }, [expenses, selectedMonth]);

  // Storage key based on user and current selected month
  const cacheKey = `gemini_fin_analysis_${currentUser?.uid || 'guest'}_${selectedMonth}`;

  // Load cached analysis when month changes
  useEffect(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setAnalysis(JSON.parse(cached));
      } else {
        setAnalysis(null);
      }
    } catch {
      setAnalysis(null);
    }
  }, [cacheKey, selectedMonth]);

  const handleAnalyzeExpenses = async (forceRefresh = false) => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      // Calculate category breakdown
      const totalExp = monthSummary.totalExpenses || 1;
      const catMap = new Map<string, number>();
      monthExpenses.forEach((exp) => {
        const cat = exp.categoryName || 'Outros';
        catMap.set(cat, (catMap.get(cat) || 0) + exp.amount);
      });

      const categoriesList = Array.from(catMap.entries()).map(([name, amount]) => ({
        name,
        amount,
        percentage: Math.round((amount / totalExp) * 100),
      }));

      // Top expenses sorted by amount
      const topExpenses = [...monthExpenses]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10)
        .map((e) => ({
          description: e.description,
          amount: e.amount,
          categoryName: e.categoryName,
          paymentMethod: e.paymentMethod,
          status: e.status,
        }));

      const payload = {
        month: selectedMonth,
        monthName: getMonthName(selectedMonth),
        totalRevenue: monthSummary.totalRevenue,
        totalSalary: monthSummary.totalSalary,
        totalExtraIncome: monthSummary.totalExtraIncome,
        totalExpenses: monthSummary.totalExpenses,
        totalBalance: monthSummary.totalBalance,
        pendingExpenses: monthSummary.pendingExpenses,
        paidExpenses: monthSummary.paidExpenses,
        creditCardInvoiceTotal: monthSummary.creditCardInvoiceTotal,
        categories: categoriesList,
        topExpenses,
        installmentsCount: installmentPurchases.length,
      };

      const response = await fetch('/api/gemini/analyze-expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Erro na análise (${response.status})`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        const analysisWithTimestamp: GeminiFinancialAnalysis = {
          ...result.data,
          analyzedAt: new Date().toISOString(),
          source: result.source || 'gemini-ai',
        };
        setAnalysis(analysisWithTimestamp);
        localStorage.setItem(cacheKey, JSON.stringify(analysisWithTimestamp));
      } else {
        throw new Error(result.error || 'Não foi possível gerar a dica financeira');
      }
    } catch (err: any) {
      console.error('Falha ao obter análise Gemini:', err);
      setError(err?.message || 'Erro ao conectar ao assistente Gemini.');
    } finally {
      setLoading(false);
    }
  };

  // Helper colors for health score
  const getScoreTheme = (score: number) => {
    if (score >= 80) {
      return {
        bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600',
        badge: 'bg-emerald-600 text-white',
        bar: 'bg-emerald-500',
        text: 'text-emerald-700',
      };
    }
    if (score >= 60) {
      return {
        bg: 'bg-sky-500/10 border-sky-500/30 text-sky-600',
        badge: 'bg-sky-600 text-white',
        bar: 'bg-sky-500',
        text: 'text-sky-700',
      };
    }
    if (score >= 40) {
      return {
        bg: 'bg-amber-500/10 border-amber-500/30 text-amber-600',
        badge: 'bg-amber-600 text-white',
        bar: 'bg-amber-500',
        text: 'text-amber-700',
      };
    }
    return {
      bg: 'bg-rose-500/10 border-rose-500/30 text-rose-600',
      badge: 'bg-rose-600 text-white',
      bar: 'bg-rose-500',
      text: 'text-rose-700',
    };
  };

  const getImpactBadge = (impact?: string) => {
    if (impact === 'alto') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
          Alto Impacto
        </span>
      );
    }
    if (impact === 'medio') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-700 border border-amber-200">
          Médio Impacto
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-200">
        Otimização
      </span>
    );
  };

  return (
    <div
      id="gemini-financial-advisor-card"
      className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden transition-all"
    >
      {/* Card Header */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-500 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-emerald-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-white text-base sm:text-lg tracking-tight">
                Consultor Gemini AI • {getMonthName(selectedMonth)}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30">
                Inteligência Financeira
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Análise personalizada dos seus gastos com sugestões práticas de economia
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {analysis && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}
            >
              {isExpanded ? (
                <>
                  <span>Recolher</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>Ver Detalhes</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}

          <button
            id="btn-analyze-gemini"
            onClick={() => handleAnalyzeExpenses(true)}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
              loading
                ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Analisando...' : analysis ? 'Atualizar Dicas' : 'Gerar Análise com IA'}</span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="p-6 bg-slate-50/50 flex flex-col gap-4 animate-pulse">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-200 rounded-2xl" />
              <div className="space-y-2">
                <div className="w-32 h-4 bg-slate-200 rounded-md" />
                <div className="w-48 h-3 bg-slate-200 rounded-md" />
              </div>
            </div>
            <div className="w-44 h-8 bg-slate-200 rounded-xl" />
          </div>

          <div className="w-full h-14 bg-slate-200 rounded-2xl" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="h-28 bg-slate-200 rounded-2xl" />
            <div className="h-28 bg-slate-200 rounded-2xl" />
            <div className="h-28 bg-slate-200 rounded-2xl" />
          </div>
        </div>
      )}

      {/* Initial Empty State (Not analyzed yet) */}
      {!analysis && !loading && (
        <div className="p-8 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-3">
            <BrainCircuit className="w-7 h-7" />
          </div>
          <h3 className="text-base font-extrabold text-slate-800">
            Descubra onde economizar em {getMonthName(selectedMonth)}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mt-1.5 mb-5 leading-relaxed">
            O Gemini analisa o total de receitas, gastos com cartão de crédito, contas pendentes e categorias com maior peso para gerar um plano sob medida de economia para o seu orçamento.
          </p>
          <button
            onClick={() => handleAnalyzeExpenses()}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-extrabold shadow-md shadow-emerald-200 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-300" />
            <span>Gerar Diagnóstico & Dicas com IA</span>
          </button>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="m-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => handleAnalyzeExpenses(true)}
            className="font-bold underline hover:text-rose-900 cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Analysis Result Display */}
      {analysis && !loading && (
        <div className="p-5 sm:p-6 flex flex-col gap-5">
          {/* Top Score & Highlights Banner */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* Score pill */}
            <div className="md:col-span-4 p-4 rounded-2xl border bg-slate-50/80 border-slate-200/80 flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-extrabold shrink-0 border ${
                  getScoreTheme(analysis.score).bg
                }`}
              >
                <span className="text-xl leading-none">{analysis.score}</span>
                <span className="text-[9px] uppercase tracking-wider font-bold">/100</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Saúde Financeira
                </span>
                <span className={`text-sm font-extrabold ${getScoreTheme(analysis.score).text}`}>
                  {analysis.statusLabel || 'Avaliação do Mês'}
                </span>
                <div className="w-28 bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div
                    className={`h-full ${getScoreTheme(analysis.score).bar}`}
                    style={{ width: `${Math.min(100, Math.max(5, analysis.score))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Potential Savings Banner */}
            <div className="md:col-span-8 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50/60 border border-emerald-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-200">
                  <PiggyBank className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                    Potencial Estimado de Economia
                  </span>
                  <div className="text-lg font-black text-emerald-950">
                    {formatCurrency(analysis.potentialMonthlySavings || 0)}
                    <span className="text-xs font-semibold text-emerald-700 ml-1">/mês sugerido</span>
                  </div>
                </div>
              </div>

              {analysis.analyzedAt && (
                <span className="text-[10px] text-slate-400 font-medium">
                  Atualizado em {new Date(analysis.analyzedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>

          {/* Executive Summary Quote */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1 text-xs">
              <p className="font-semibold text-slate-800 leading-relaxed">
                {analysis.summary}
              </p>
              {analysis.highlightInsight && (
                <p className="text-indigo-900 font-bold">
                  💡 <span className="underline decoration-indigo-300">{analysis.highlightInsight}</span>
                </p>
              )}
            </div>
          </div>

          {/* Detailed Tips Grid (Collapsible) */}
          {isExpanded && analysis.savingsTips && analysis.savingsTips.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Dicas Personalizadas de Otimização</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-semibold">
                  {analysis.savingsTips.length} recomendações práticas
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {analysis.savingsTips.map((tip, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-300 hover:shadow-xs transition-all flex flex-col justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center gap-1">
                          <Tag className="w-2.5 h-2.5 text-slate-400" />
                          <span>{tip.category || 'Geral'}</span>
                        </span>
                        {getImpactBadge(tip.impact)}
                      </div>
                      <h5 className="font-extrabold text-slate-900 text-xs leading-snug group-hover:text-emerald-700 transition-colors">
                        {tip.title}
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed font-normal">
                        {tip.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center text-[10px] font-bold text-emerald-600 gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span>Ação recomendada</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
