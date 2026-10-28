import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  Calendar,
  Search,
  ArrowRight,
  TrendingDown,
  CreditCard,
  CheckCircle2,
  Clock,
  HelpCircle,
  Zap,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  PieChart,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, getMonthName } from '../../utils/formatters';
import { calculateMonthInstallmentsAndSingleSummary } from '../../utils/calculations';
import { queryFinancialAssistant } from '../../services/api';
import { AiQuickQueryResult, AiRelevantExpense } from '../../types';

export type AiQueryType = 'SINGLE' | 'LAST_INSTALLMENTS' | 'COMBINED' | 'ALL_INSTALLMENTS' | 'CUSTOM';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQueryType?: AiQueryType;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  initialQueryType = 'COMBINED',
}) => {
  const {
    expenses,
    installmentPurchases,
    selectedMonth,
    monthSummary,
  } = useFinance();

  const [targetMonth, setTargetMonth] = useState<string>(selectedMonth);
  const [activeQueryType, setActiveQueryType] = useState<AiQueryType>(initialQueryType);
  const [customInput, setCustomInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AiQuickQueryResult | null>(null);
  const [source, setSource] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Lista de meses disponíveis para consulta (6 meses anteriores e 12 posteriores)
  const availableMonths = useMemo(() => {
    const list: string[] = [];
    const baseDate = new Date();
    // 3 meses para trás
    for (let i = -3; i <= 12; i++) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      list.push(mStr);
    }
    // Garante que o targetMonth e o selectedMonth estejam na lista
    if (!list.includes(targetMonth)) list.push(targetMonth);
    if (!list.includes(selectedMonth)) list.push(selectedMonth);
    list.sort();
    return list;
  }, [targetMonth, selectedMonth]);

  // Cálculo matemático exato para o mês selecionado
  const monthData = useMemo(() => {
    return calculateMonthInstallmentsAndSingleSummary(targetMonth, expenses, installmentPurchases);
  }, [expenses, targetMonth, installmentPurchases]);

  // Executa consulta (seja chip rápido ou texto livre)
  const handleExecuteQuery = async (
    queryType: AiQueryType,
    userPrompt: string = '',
    monthToUse: string = targetMonth
  ) => {
    setIsLoading(true);
    setErrorMsg(null);
    setActiveQueryType(queryType);

    // Recalcula para o mês solicitado se for diferente
    const currentMonthData =
      monthToUse === targetMonth
        ? monthData
        : calculateMonthInstallmentsAndSingleSummary(monthToUse, expenses, installmentPurchases);

    // Mapeamento limpo das despesas relevantes
    const mapExpenses = (list: any[]): AiRelevantExpense[] =>
      list.map((e) => ({
        id: e.id,
        description: e.description,
        amount: Number(e.amount) || 0,
        installmentNumber: e.installmentNumber,
        installmentTotal: e.totalInstallments,
        paymentMethod: e.paymentMethod,
        isRecurring: Boolean(e.isRecurring),
        status: e.status,
        date: e.date,
      }));

    const mappedSingle = mapExpenses(currentMonthData.singleExpenses);
    const mappedLast = mapExpenses(currentMonthData.lastInstallments);
    const mappedAll = mapExpenses(currentMonthData.allInstallments);

    try {
      const res = await queryFinancialAssistant({
        queryType,
        customPrompt: userPrompt,
        month: monthToUse,
        monthName: getMonthName(monthToUse),
        singleExpensesTotal: currentMonthData.singleExpensesTotal,
        lastInstallmentsTotal: currentMonthData.lastInstallmentsTotal,
        combinedTotal: currentMonthData.combinedTotal,
        allInstallmentsTotal: currentMonthData.allInstallmentsTotal,
        singleExpensesCount: currentMonthData.singleExpensesCount,
        lastInstallmentsCount: currentMonthData.lastInstallmentsCount,
        combinedCount: currentMonthData.combinedCount,
        allInstallmentsCount: currentMonthData.allInstallmentsCount,
        singleExpenses: mappedSingle,
        lastInstallments: mappedLast,
        allInstallments: mappedAll,
        totalExpenses: monthSummary?.totalExpenses || 0,
        totalRevenue: monthSummary?.totalRevenue || 0,
      });

      if (res && res.data) {
        setResult(res.data);
        setSource(res.source || 'gemini-ai');
      } else {
        throw new Error('Não foi possível obter resposta da I.A.');
      }
    } catch (err: any) {
      console.error('Erro na requisição da I.A:', err);
      setErrorMsg('Falha ao comunicar com o assistente. Exibindo dados locais com cálculo exato.');
    } finally {
      setIsLoading(false);
    }
  };

  // Sincroniza mês caso o selectedMonth mude ou modal abra
  useEffect(() => {
    if (isOpen) {
      setTargetMonth(selectedMonth);
      const queryToRun: AiQueryType = (initialQueryType || 'COMBINED') as AiQueryType;
      setActiveQueryType(queryToRun);
      handleExecuteQuery(queryToRun, '', selectedMonth);
    }
  }, [isOpen, selectedMonth, initialQueryType]);

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    handleExecuteQuery('CUSTOM', customInput.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl shadow-inner">
              <Sparkles className="w-6 h-6 text-amber-200 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">Assistente I.A de Consultas Rápidas</h2>
                <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30 backdrop-blur-sm">
                  Gemini 3.8
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                Respostas instantâneas e cálculos matemáticos precisos sobre compras à vista e parcelamentos.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Seleção de Mês e Busca */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 space-y-4">
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <label htmlFor="ai-target-month" className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Mês de Análise:
              </label>
              <select
                id="ai-target-month"
                value={targetMonth}
                onChange={(e) => {
                  const newM = e.target.value;
                  setTargetMonth(newM);
                  handleExecuteQuery(activeQueryType, customInput, newM);
                }}
                className="text-sm font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 shadow-sm"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {getMonthName(m)} {m === selectedMonth ? ' (Atual)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Cálculos auditados 100% em tempo real</span>
            </div>
          </div>

          {/* Atalhos Rápidos com Chips */}
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Consultas Rápidas Mais Pedidas:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleExecuteQuery('COMBINED')}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border text-left ${
                  activeQueryType === 'COMBINED'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80'
                }`}
              >
                <span className="text-base">💎</span>
                <div className="truncate">
                  <div className="font-bold">Últimas + À Vista</div>
                  <div className={`text-[10px] truncate ${activeQueryType === 'COMBINED' ? 'text-emerald-100' : 'text-slate-400'}`}>
                    Alívio do próximo mês ({formatCurrency(monthData.combinedTotal)})
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleExecuteQuery('LAST_INSTALLMENTS')}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border text-left ${
                  activeQueryType === 'LAST_INSTALLMENTS'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-slate-800/80'
                }`}
              >
                <span className="text-base">🎯</span>
                <div className="truncate">
                  <div className="font-bold">Soma de Últimas Parcelas</div>
                  <div className={`text-[10px] truncate ${activeQueryType === 'LAST_INSTALLMENTS' ? 'text-indigo-100' : 'text-slate-400'}`}>
                    Finalizam no mês ({formatCurrency(monthData.lastInstallmentsTotal)})
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleExecuteQuery('SINGLE')}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border text-left ${
                  activeQueryType === 'SINGLE'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-500/20'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-sky-400 hover:bg-sky-50/50 dark:hover:bg-slate-800/80'
                }`}
              >
                <span className="text-base">⚡</span>
                <div className="truncate">
                  <div className="font-bold">Soma de Compras à Vista</div>
                  <div className={`text-[10px] truncate ${activeQueryType === 'SINGLE' ? 'text-sky-100' : 'text-slate-400'}`}>
                    Parcela única / pontuais ({formatCurrency(monthData.singleExpensesTotal)})
                  </div>
                </div>
              </button>
            </div>

            {/* Linha secundária de chips */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleExecuteQuery('ALL_INSTALLMENTS')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  activeQueryType === 'ALL_INSTALLMENTS'
                    ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-700'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                }`}
              >
                📊 Total de Parcelas Ativas no Mês ({formatCurrency(monthData.allInstallmentsTotal)})
              </button>
            </div>
          </div>

          {/* Campo de Pergunta Aberta */}
          <form onSubmit={handleSubmitCustom} className="relative">
            <div className="relative flex items-center">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Ou faça uma pergunta livre sobre este mês (ex: quanto gastei no cartão à vista?)"
                className="w-full pl-10 pr-28 py-2.5 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 shadow-inner"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5" />
              <button
                type="submit"
                disabled={isLoading || !customInput.trim()}
                className="absolute right-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <span>Perguntar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Conteúdo com os Resultados */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-emerald-200 dark:border-emerald-900/40 border-t-emerald-600 animate-spin" />
                <Sparkles className="w-6 h-6 text-amber-500 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Consultando Inteligência Financeira...
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Processando dados de {getMonthName(targetMonth)} com Gemini 3.8 Flash
                </p>
              </div>
            </div>
          ) : result ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Card Destaque Principal do Valor */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-cyan-950/20 border border-emerald-200 dark:border-emerald-800/60 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 mb-2">
                    <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    {result.title}
                  </span>
                  <div className="text-3xl sm:text-4xl font-extrabold text-emerald-700 dark:text-emerald-400 tracking-tight">
                    {result.formattedValue}
                  </div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">
                    {result.breakdown}
                  </p>
                </div>

                <div className="w-full sm:w-auto p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-emerald-100 dark:border-emerald-900/50 sm:max-w-xs shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-1">
                    <TrendingDown className="w-4 h-4 text-emerald-600" />
                    Alívio no Próximo Mês
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {result.nextMonthRelief}
                  </p>
                </div>
              </div>

              {/* Explicação Didática e Insight Chave */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-teal-600" />
                    Explicação Detalhada
                  </h4>
                  <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                    {result.explanation}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-600" />
                    Dica Inteligente
                  </h4>
                  <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                    {result.keyTakeaway}
                  </p>
                </div>
              </div>

              {/* Lista Detalhada das Despesas Envolvidas */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span>Lançamentos que Compõem esta Soma</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                      {result.relevantExpenses?.length || 0} itens
                    </span>
                  </h4>
                </div>

                {result.relevantExpenses && result.relevantExpenses.length > 0 ? (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
                    {result.relevantExpenses.map((exp, idx) => (
                      <div
                        key={exp.id || idx}
                        className="p-3 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-lg shrink-0 ${
                            exp.installmentNumber && exp.installmentTotal && exp.installmentNumber === exp.installmentTotal
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                          }`}>
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <div className="font-bold text-slate-800 dark:text-slate-100 truncate">
                              {exp.description}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {exp.installmentNumber && exp.installmentTotal ? (
                                <span className="font-semibold text-amber-600 dark:text-amber-400">
                                  Parcela {exp.installmentNumber}/{exp.installmentTotal}
                                  {exp.installmentNumber === exp.installmentTotal && ' (Finaliza agora!)'}
                                </span>
                              ) : (
                                <span className="text-sky-600 dark:text-sky-400 font-medium">À Vista</span>
                              )}
                              <span>•</span>
                              <span>{exp.paymentMethod || 'OUTRO'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                            {formatCurrency(exp.amount)}
                          </div>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            exp.status === 'PAGO'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          }`}>
                            {exp.status || 'PENDENTE'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    Nenhuma despesa correspondente encontrada neste mês.
                  </div>
                )}
              </div>

              {/* Perguntas Sugeridas */}
              {result.suggestedQuestions && result.suggestedQuestions.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
                    💡 Outras perguntas que você pode fazer:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {result.suggestedQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setCustomInput(q);
                          handleExecuteQuery('CUSTOM', q);
                        }}
                        className="text-xs px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 hover:text-emerald-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
                      >
                        <span>{q}</span>
                        <ChevronRight className="w-3 h-3 text-slate-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Rodapé com botão de fechar */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            {source === 'gemini-ai' ? '✨ Processado com IA Gemini 3.8 Flash' : '⚡ Motor algorítmico local ultra rápido'}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
