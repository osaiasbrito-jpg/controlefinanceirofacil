import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  ArrowRight,
  Sparkles,
  Calendar,
  Tag,
  DollarSign,
  CreditCard,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Clock,
  Filter,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  parseExcelWorkbook,
  generateSampleExcelTemplate,
  SpreadsheetParseResult,
  ParsedSpreadsheetItem,
} from '../../utils/excelParser';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency } from '../../utils/formatters';

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportExcelModal: React.FC<ImportExcelModalProps> = ({ isOpen, onClose }) => {
  const { importSpreadsheetData, categories, creditCards } = useFinance();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rawFileBuffer, setRawFileBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [parseResult, setParseResult] = useState<SpreadsheetParseResult | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [customMapping, setCustomMapping] = useState<Record<string, string>>({});
  const [showMappingConfig, setShowMappingConfig] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<'ALL' | 'EXPENSE' | 'INSTALLMENT' | 'INCOME' | 'INVALID'>('ALL');

  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSuccessResult, setImportSuccessResult] = useState<{
    expensesCount: number;
    installmentsCount: number;
    incomesCount: number;
    salariesCount: number;
    totalCreated: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Trigger file reading
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setImportSuccessResult(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileSize(`${(file.size / 1024).toFixed(1)} KB`);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        setRawFileBuffer(buffer);
        const result = parseExcelWorkbook(buffer);
        setParseResult(result);
        setSelectedSheet(result.activeSheetName);
        setCustomMapping(result.columnMapping);
      } catch (err: any) {
        console.error('Error reading Excel file:', err);
        setErrorMessage(err.message || 'Erro ao processar o arquivo Excel. Verifique se o formato é válido (.xlsx, .xls ou .csv).');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Re-parse when sheet changes
  const handleSheetChange = (sheetName: string) => {
    if (!rawFileBuffer) return;
    setSelectedSheet(sheetName);
    try {
      const result = parseExcelWorkbook(rawFileBuffer, sheetName, customMapping);
      setParseResult(result);
      setCustomMapping(result.columnMapping);
    } catch (err: any) {
      setErrorMessage(`Erro ao ler a aba "${sheetName}": ${err.message}`);
    }
  };

  // Update specific column mapping
  const handleMappingChange = (targetField: string, selectedHeader: string) => {
    if (!rawFileBuffer) return;
    const nextMapping = { ...customMapping, [targetField]: selectedHeader };
    setCustomMapping(nextMapping);
    try {
      const result = parseExcelWorkbook(rawFileBuffer, selectedSheet, nextMapping);
      setParseResult(result);
    } catch (err: any) {
      setErrorMessage(`Erro ao atualizar mapeamento de colunas: ${err.message}`);
    }
  };

  // Reset file
  const handleResetFile = () => {
    setRawFileBuffer(null);
    setFileName('');
    setParseResult(null);
    setImportSuccessResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Execute Import
  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.validItems.length === 0) return;
    setIsImporting(true);
    setErrorMessage(null);

    try {
      const res = await importSpreadsheetData(parseResult.validItems);
      setImportSuccessResult({
        expensesCount: res.expensesCount,
        installmentsCount: res.installmentsCount,
        incomesCount: res.incomesCount,
        salariesCount: res.salariesCount,
        totalCreated: res.totalCreated,
      });

      // Fire festive confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      console.error('Import spreadsheet execution error:', err);
      setErrorMessage(err.message || 'Erro ao importar os dados para o banco de dados.');
    } finally {
      setIsImporting(false);
    }
  };

  // Items to display in preview table based on filter
  const displayedItems = parseResult
    ? parseResult.validItems.concat(parseResult.invalidItems).filter((item) => {
        if (filterType === 'ALL') return true;
        if (filterType === 'INVALID') return !item.isValid;
        return item.type === filterType;
      })
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div
        id="import-excel-modal-card"
        className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden my-6"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Transferir Dados de Planilha Excel
              </h2>
              <p className="text-xs text-slate-500">
                Importe despesas, parcelamentos e lançamentos futuros automaticamente para sua conta
              </p>
            </div>
          </div>
          <button
            id="close-import-modal-btn"
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Aviso na Importação:</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Success Screen */}
          {importSuccessResult ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-4 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">
                  Importação Concluída com Sucesso!
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Todos os dados da planilha foram processados e lançados automaticamente no sistema com sincronização em tempo real.
                </p>
              </div>

              {/* Stats pill breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-xl mt-2">
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Despesas</span>
                  <p className="text-lg font-black text-slate-800">{importSuccessResult.expensesCount}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Parcelamentos / Futuros</span>
                  <p className="text-lg font-black text-indigo-600">{importSuccessResult.installmentsCount}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Receitas / Salários</span>
                  <p className="text-lg font-black text-emerald-600">
                    {importSuccessResult.incomesCount + importSuccessResult.salariesCount}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Lançado</span>
                  <p className="text-lg font-black text-slate-900">{importSuccessResult.totalCreated}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button
                  id="import-another-btn"
                  onClick={handleResetFile}
                  className="px-5 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Importar Outra Planilha
                </button>
                <button
                  id="finish-import-btn"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2"
                >
                  Concluir e Ver Dados
                </button>
              </div>
            </div>
          ) : !parseResult ? (
            /* Upload Screen */
            <div className="flex flex-col gap-6">
              {/* File Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-3xl p-8 sm:p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-slate-50/50 hover:bg-emerald-50/20 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shadow-xs">
                  <Upload className="w-7 h-7" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 mb-1">
                  Arraste ou clique para selecionar a planilha Excel
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mb-4">
                  Suporta arquivos nos formatos <strong>.xlsx</strong>, <strong>.xls</strong> e <strong>.csv</strong>.
                </p>
                <span className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs group-hover:border-emerald-300">
                  Selecionar Arquivo do Computador
                </span>
              </div>

              {/* Sample Template Download & Helper */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      Precisa de um modelo pronto para preencher?
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Baixe nossa planilha modelo pré-formatada com colunas de despesas, parcelas e categorias.
                    </p>
                  </div>
                </div>

                <button
                  id="download-sample-template-btn"
                  onClick={generateSampleExcelTemplate}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2 shrink-0 transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  Baixar Modelo (.xlsx)
                </button>
              </div>

              {/* Feature Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Lançamentos Automáticos</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Identifica valores, datas de vencimento, categorias e formas de pagamento automaticamente.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Distribuição de Futuros</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Compras parceladas (ex: 10x) são geradas mês a mês com ajuste de centavos exato.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-blue-600 font-bold text-xs">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Auto Categorização</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Cria ou associa as categorias e cartões de crédito automaticamente na sua conta.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Preview & Confirmation Screen */
            <div className="flex flex-col gap-5">
              {/* File Info Bar & Sheet Switcher */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-800">{fileName}</span>
                      <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        {fileSize}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {parseResult.totalRows} linhas lidas &bull; {parseResult.validItems.length} registros prontos para lançamento
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {parseResult.sheetNames.length > 1 && (
                    <select
                      value={selectedSheet}
                      onChange={(e) => handleSheetChange(e.target.value)}
                      className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {parseResult.sheetNames.map((sheet) => (
                        <option key={sheet} value={sheet}>
                          Aba: {sheet}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={handleResetFile}
                    className="text-xs text-slate-500 hover:text-slate-800 bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-bold transition-colors"
                  >
                    Trocar Arquivo
                  </button>
                </div>
              </div>

              {/* Statistics Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Despesas à Vista</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-black text-slate-800">{parseResult.stats.expensesCount}</span>
                    <span className="text-xs font-bold text-slate-600">{formatCurrency(parseResult.stats.totalExpensesAmount)}</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Futuros / Parcelas</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-black text-indigo-600">{parseResult.stats.installmentsCount}</span>
                    <span className="text-xs font-bold text-indigo-600">{formatCurrency(parseResult.stats.totalInstallmentsAmount)}</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Receitas / Entradas</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-black text-emerald-600">{parseResult.stats.incomesCount}</span>
                    <span className="text-xs font-bold text-emerald-600">{formatCurrency(parseResult.stats.totalIncomesAmount)}</span>
                  </div>
                </div>

                <div className="bg-emerald-50/60 rounded-2xl border border-emerald-200/80 p-3 shadow-2xs">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">Total a Lançar</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-black text-emerald-900">{parseResult.validItems.length}</span>
                    <span className="text-xs font-bold text-emerald-800">
                      {formatCurrency(parseResult.stats.totalExpensesAmount + parseResult.stats.totalInstallmentsAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Column Mapping Customizer (Toggle) */}
              <div className="border border-slate-200/80 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowMappingConfig(!showMappingConfig)}
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-slate-500" />
                    <span>Mapeamento de Colunas da Planilha</span>
                    <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Auto-detectado
                    </span>
                  </div>
                  {showMappingConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showMappingConfig && (
                  <div className="p-4 bg-white grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Coluna de Descrição</label>
                      <select
                        value={customMapping['description'] || ''}
                        onChange={(e) => handleMappingChange('description', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs"
                      >
                        <option value="">Não mapeada</option>
                        {parseResult.detectedColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Coluna de Valor (R$)</label>
                      <select
                        value={customMapping['amount'] || ''}
                        onChange={(e) => handleMappingChange('amount', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs"
                      >
                        <option value="">Não mapeada</option>
                        {parseResult.detectedColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Coluna de Data / Vencimento</label>
                      <select
                        value={customMapping['date'] || ''}
                        onChange={(e) => handleMappingChange('date', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs"
                      >
                        <option value="">Não mapeada</option>
                        {parseResult.detectedColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Coluna de Categoria</label>
                      <select
                        value={customMapping['category'] || ''}
                        onChange={(e) => handleMappingChange('category', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs"
                      >
                        <option value="">Não mapeada</option>
                        {parseResult.detectedColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Coluna de Parcelas / Qtd</label>
                      <select
                        value={customMapping['installmentCount'] || ''}
                        onChange={(e) => handleMappingChange('installmentCount', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs"
                      >
                        <option value="">Não mapeada</option>
                        {parseResult.detectedColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Coluna de Cartão / Forma</label>
                      <select
                        value={customMapping['cardName'] || customMapping['paymentMethod'] || ''}
                        onChange={(e) => handleMappingChange('cardName', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs"
                      >
                        <option value="">Não mapeada</option>
                        {parseResult.detectedColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Table Filters & Preview List */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    <button
                      onClick={() => setFilterType('ALL')}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        filterType === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Todos ({parseResult.validItems.length})
                    </button>
                    <button
                      onClick={() => setFilterType('EXPENSE')}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        filterType === 'EXPENSE' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Despesas ({parseResult.stats.expensesCount})
                    </button>
                    <button
                      onClick={() => setFilterType('INSTALLMENT')}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        filterType === 'INSTALLMENT' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      }`}
                    >
                      Futuros / Parcelamentos ({parseResult.stats.installmentsCount})
                    </button>
                    <button
                      onClick={() => setFilterType('INCOME')}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        filterType === 'INCOME' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      Receitas ({parseResult.stats.incomesCount})
                    </button>
                    {parseResult.invalidItems.length > 0 && (
                      <button
                        onClick={() => setFilterType('INVALID')}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                          filterType === 'INVALID' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        Inválidos ({parseResult.invalidItems.length})
                      </button>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-400">
                    Exibindo {displayedItems.length} registros
                  </span>
                </div>

                {/* Table */}
                <div className="border border-slate-200/90 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Tipo</th>
                        <th className="py-2.5 px-3">Data / Mês</th>
                        <th className="py-2.5 px-3">Descrição</th>
                        <th className="py-2.5 px-3">Categoria</th>
                        <th className="py-2.5 px-3">Forma / Cartão</th>
                        <th className="py-2.5 px-3 text-right">Valor</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {displayedItems.map((item) => (
                        <tr key={item.id} className={item.isValid ? 'hover:bg-slate-50/70' : 'bg-rose-50/50'}>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {item.type === 'INSTALLMENT' ? (
                              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                                {item.installmentCount}x Parcelas
                              </span>
                            ) : item.type === 'INCOME' || item.type === 'SALARY' ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                                Receita
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">
                                Despesa
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                            {item.date}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {item.description}
                            {item.notes && (
                              <span className="block text-[10px] text-slate-400 truncate max-w-xs">
                                {item.notes}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px]">
                              {item.categoryName}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                            {item.cardName || item.paymentMethod}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black whitespace-nowrap text-slate-900">
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {item.isPaid ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                Pago
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                                Pendente
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {parseResult && !importSuccessResult && (
          <div className="p-4 sm:p-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
            <button
              onClick={handleResetFile}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors w-full sm:w-auto"
            >
              Cancelar e Escolher Outro Arquivo
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all w-full sm:w-auto"
              >
                Fechar
              </button>
              <button
                id="confirm-import-spreadsheet-btn"
                onClick={handleConfirmImport}
                disabled={isImporting || parseResult.validItems.length === 0}
                className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                {isImporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Lançando {parseResult.validItems.length} Registros...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Lançar Automaticamente no Sistema ({parseResult.validItems.length})
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
