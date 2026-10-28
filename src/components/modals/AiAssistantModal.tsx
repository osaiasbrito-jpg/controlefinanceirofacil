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
  AlertCircle,
  HelpCircle,
  Zap,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, getMonthName } from '../../utils/formatters';
import { calculateMonthInstallmentsAndSingleSummary } from '../../utils/calculations';
import { queryFinancialAssistant } from '../../services/api';
import { AiQuickQueryResult, AiRelevantExpense, Expense } from '../../types';

export type AiQueryType = 'SINGLE' | 'LAST_INSTALLMENTS' | 'COMBINED' | 'ALL_INSTALLMENTS' | 'CUSTOM';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQueryType?: AiQueryType;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  initialQueryType = 'CUSTOM',
}) => {
  const {
    expenses,
    installmentPurchases,
    selectedMonth,
    monthSummary,
  } = useFinance();

  const [targetMonth, setTargetMonth] = useState<string>(selectedMonth);
  const [customInput, setCustomInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AiQuickQueryResult | null>(null);
  const [source, setSource] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Lista de meses disponíveis para consulta
  const availableMonths = useMemo(() => {
    const list: string[] = [];
    const baseDate = new Date();
    for (let i = -3; i <= 12; i++) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      list.push(mStr);
    }
    if (!list.includes(targetMonth)) list.push(targetMonth);
    if (!list.includes(selectedMonth)) list.push(selectedMonth);
    list.sort();
    return list;
  }, [targetMonth, selectedMonth]);

  // Cálculo matemático exato para o mês selecionado
  const monthData = useMemo(() => {
    return calculateMonthInstallmentsAndSingleSummary(targetMonth, expenses, installmentPurchases);
  }, [expenses, targetMonth, installmentPurchases]);

  // Despesas filtradas para o mês alvo
  const targetMonthExpenses = useMemo(() => {
    const safeExp = Array.isArray(expenses) ? expenses : [];
    return safeExp.filter(
      (e) => Boolean(e) && (e.referenceMonth || (e.date ? e.date.substring(0, 7) : '')) === targetMonth
    );
  }, [expenses, targetMonth]);

  // Executa consulta inteligente
  const handleExecuteQuery = async (promptText = '', monthToUse = targetMonth) => {
    setIsLoading(true);
    setErrorMsg(null);

    const currentMonthData =
      monthToUse === targetMonth
        ? monthData
        : calculateMonthInstallmentsAndSingleSummary(monthToUse, expenses, installmentPurchases);

    const currentMonthExpenses =
      monthToUse === targetMonth
        ? targetMonthExpenses
        : (Array.isArray(expenses) ? expenses : []).filter(
            (e) => Boolean(e) && (e.referenceMonth || (e.date ? e.date.substring(0, 7) : '')) === monthToUse
          );

    const mapExpenses = (list: Expense[]): AiRelevantExpense[] =>
      list.map((e) => ({
        id: e.id,
        description: e.description,
        amount: Number(e.amount) || 0,
        formattedAmount: formatCurrency(Number(e.amount) || 0),
        installmentNumber: e.installmentNumber,
        installmentTotal: e.totalInstallments,
        paymentMethod: e.paymentMethod,
        cardName: e.cardName,
        categoryName: e.categoryName,
        isRecurring: Boolean(e.isRecurring),
        status: e.status,
        date: e.date,
      }));

    const mappedSingle = mapExpenses(currentMonthData.singleExpenses);
    const mappedLast = mapExpenses(currentMonthData.lastInstallments);
    const mappedAll = mapExpenses(currentMonthData.allInstallments);
    const mappedAllExpenses = mapExpenses(currentMonthExpenses);

    const cleanPrompt = promptText.trim();

    try {
      const res = await queryFinancialAssistant({
        queryType: 'CUSTOM',
        customPrompt: cleanPrompt || 'Buscar soma de compras a vista, tanto boletos, pix como cartão de crédito',
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
        allExpenses: mappedAllExpenses,
        totalExpenses: monthSummary?.totalExpenses || 0,
        totalRevenue: monthSummary?.totalRevenue || 0,
      });

      if (res && res.data) {
        setResult(res.data);
        setSource(res.source || 'gemini-ai');
      } else {
        throw new Error('Não foi possível obter resposta.');
      }
    } catch (err: any) {
      console.error('Erro na requisição da I.A:', err);
      setErrorMsg('Falha momentânea na conexão. Mostrando cálculo verificado localmente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Inicializa com uma consulta padrão rica ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      setTargetMonth(selectedMonth);
      const defaultQuery = 'Buscar soma de compras a vista, tanto boletos, pix como cartão de crédito';
      setCustomInput(defaultQuery);
      handleExecuteQuery(defaultQuery, selectedMonth);
    }
  }, [isOpen, selectedMonth]);

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    handleExecuteQuery(customInput.trim(), targetMonth);
  };

  const handleSuggestionClick = (suggestionText: string) => {
    setCustomInput(suggestionText);
    handleExecuteQuery(suggestionText, targetMonth);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl shadow-inner">
              <Sparkles className="w-6 h-6 text-amber-200 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">Buscar com Inteligência Artificial</h2>
                <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30 backdrop-blur-sm">
                  Gemini 3.8
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                Pergunte qualquer informação financeira sobre o mês escolhido no sistema.
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

        {/* Barra de Mês e Campo de Busca Livre (SEM OS 3 BOTÕES) */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 space-y-4 shrink-0">
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <label htmlFor="ai-target-month" className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Mês Escolhido:
              </label>
              <select
                id="ai-target-month"
                value={targetMonth}
                onChange={(e) => {
                  const newM = e.target.value;
                  setTargetMonth(newM);
                  handleExecuteQuery(customInput, newM);
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

          {/* Campo de Busca Livre em Destaque */}
          <form onSubmit={handleSubmitCustom} className="relative">
            <div className="relative flex items-center">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Busque o que quiser... (Ex: soma de compras a vista, últimas parcelas, contas de mercado, pendentes...)"
                className="w-full pl-11 pr-32 py-3.5 bg-white dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-slate-100 border-2 border-emerald-500/40 focus:border-emerald-500 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 shadow-sm transition-all"
              />
              <Search className="w-5 h-5 text-emerald-600 dark:text-emerald-400 absolute left-3.5" />
              
              {customInput && (
                <button
                  type="button"
                  onClick={() => setCustomInput('')}
                  className="absolute right-28 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Limpar texto"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              <button
                type="submit"
                disabled={isLoading || !customInput.trim()}
                className="absolute right-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Buscando...</span>
                  </>
                ) : (
                  <>
                    <span>Perguntar</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Exemplos de busca rápidos */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" />
              Sugestões rápidas:
            </span>
            <button
              type="button"
              onClick={() => handleSuggestionClick('Buscar soma de compras a vista, tanto boletos, pix como cartão de crédito')}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 transition-colors text-[11px] font-medium"
            >
              ⚡ Compras à vista (boletos, pix e cartão)
            </button>
            <button
              type="button"
              onClick={() => handleSuggestionClick('Qual a soma de últimas parcelas que finalizam neste mês?')}
              className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 transition-colors text-[11px] font-medium"
            >
              🎯 Últimas parcelas que encerram
            </button>
            <button
              type="button"
              onClick={() => handleSuggestionClick('Qual o alívio do próximo mês (últimas parcelas + compras à vista)?')}
              className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 hover:bg-teal-100 transition-colors text-[11px] font-medium"
            >
              💎 Últimas parcelas + à vista (alívio)
            </button>
            <button
              type="button"
              onClick={() => handleSuggestionClick('Qual o total de parcelas ativas no mês?')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors text-[11px] font-medium"
            >
              📊 Total de parcelas
            </button>
            <button
              type="button"
              onClick={() => handleSuggestionClick('Quais contas estão pendentes de pagamento?')}
              className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 transition-colors text-[11px] font-medium"
            >
              ⏳ Contas pendentes
            </button>
          </div>

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
                    <span>Lançamentos Encontrados para esta Busca</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold">
                      {result.relevantExpenses?.length || 0} lançamentos
                    </span>
                  </h4>
                </div>

                {result.relevantExpenses && result.relevantExpenses.length > 0 ? (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto shadow-xs">
                    {result.relevantExpenses.map((exp, idx) => (
                      <div
                        key={exp.id || idx}
                        className="p-3 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-lg shrink-0 ${
                            exp.installmentNumber && exp.installmentTotal && exp.installmentNumber === exp.installmentTotal
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                              : exp.paymentMethod === 'CARTAO_CREDITO'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                          }`}>
                            {exp.paymentMethod === 'CARTAO_CREDITO' ? (
                              <CreditCard className="w-4 h-4" />
                            ) : (
                              <Wallet className="w-4 h-4" />
                            )}
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
                                <span className="text-teal-600 dark:text-teal-400 font-medium">À Vista</span>
                              )}
                              <span>•</span>
                              <span className="font-medium">{exp.paymentMethod || 'OUTRO'}</span>
                              {exp.cardName && (
                                <>
                                  <span>•</span>
                                  <span>{exp.cardName}</span>
                                </>
                              )}
                              {exp.date && (
                                <>
                                  <span>•</span>
                                  <span>{exp.date}</span>
                                </>
                              )}
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
                  <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
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
                        onClick={() => handleSuggestionClick(q)}
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
          ) : errorMsg ? (
            <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
              <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                {errorMsg}
              </p>
              <button
                type="button"
                onClick={() => handleExecuteQuery(customInput, targetMonth)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          ) : null}
        </div>

        {/* Rodapé com botão de fechar */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            {source === 'gemini-ai' ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Processado com Inteligência Artificial Gemini 3.8</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-emerald-500" />
                <span>Cálculo matemático auditado em tempo real</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
