import React, { useState, useRef } from 'react';
import {
  Database,
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FileJson,
  RefreshCw,
  FileSpreadsheet,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { BackupData } from '../types';
import { generateSampleExcelTemplate } from '../utils/excelParser';

interface BackupViewProps {
  onOpenImportExcel?: () => void;
}

export const BackupView: React.FC<BackupViewProps> = ({ onOpenImportExcel }) => {
  const { exportBackupData, importBackupData, salaries, incomes, expenses, creditCards } = useFinance();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importing, setImporting] = useState(false);
  const [parsedData, setParsedData] = useState<BackupData | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Handle Export
  const handleExport = () => {
    try {
      const data = exportBackupData();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `meu-controle-financeiro-backup-${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setStatusMessage({
        type: 'success',
        text: 'Arquivo de backup exportado com sucesso! Guarde-o em local seguro.',
      });
    } catch (err: any) {
      console.error('Export error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Erro ao gerar arquivo de backup.',
      });
    }
  };

  // Handle File Select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStatusMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content) as BackupData;

        // Basic structural validation
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Arquivo JSON corrompido ou formato inválido.');
        }

        setParsedData(parsed);
      } catch (err: any) {
        console.error('JSON parse error:', err);
        setStatusMessage({
          type: 'error',
          text: `Erro ao ler arquivo: ${err.message || 'Formato JSON inválido.'}`,
        });
      }
    };
    reader.readAsText(file);
  };

  // Execute Restore
  const handleConfirmRestore = async () => {
    if (!parsedData) return;
    setImporting(true);
    setStatusMessage(null);
    try {
      const res = await importBackupData(parsedData);
      setStatusMessage({
        type: 'success',
        text: res.message,
      });
      setParsedData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error('Restore error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Falha ao restaurar registros do backup.',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Database className="w-4 h-4" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Backup & Restauração</h2>
        </div>
        <p className="text-xs text-slate-500">
          Faça download de todos os seus dados em formato JSON ou restaure um backup prévio a qualquer momento.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Excel Spreadsheet Transfer Card */}
      <div className="bg-gradient-to-r from-emerald-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-start gap-4 z-10">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center font-bold shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-white">Transferir Dados de Planilha Excel (.xlsx / .csv)</h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30">
                Novo Recurso
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Importe suas despesas, pagamentos e compras parceladas diretamente de arquivos Excel. O sistema distribui automaticamente os lançamentos futuros mês a mês.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 z-10 w-full md:w-auto">
          <button
            onClick={generateSampleExcelTemplate}
            className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs font-bold transition-all flex items-center gap-2 justify-center flex-1 md:flex-none cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Baixar Modelo Excel</span>
          </button>

          {onOpenImportExcel && (
            <button
              onClick={onOpenImportExcel}
              className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 justify-center flex-1 md:flex-none cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Importar Planilha Agora</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid: Export vs Import */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between gap-6">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <Download className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-base mb-1">
              Exportar Backup Completo
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Gera um arquivo JSON contendo todos os seus salários, rendas extras, despesas, cartões de crédito e categorias cadastradas.
            </p>

            <div className="mt-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1.5 text-xs text-slate-600">
              <span className="font-bold text-slate-800">Resumo dos dados atuais:</span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <span>• {salaries.length} salários</span>
                <span>• {incomes.length} rendas extras</span>
                <span>• {expenses.length} despesas</span>
                <span>• {creditCards.length} cartões</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleExport}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold shadow-md flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Baixar Arquivo de Backup (.json)</span>
          </button>
        </div>

        {/* Import Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between gap-6">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-base mb-1">
              Restaurar Backup JSON
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Selecione um arquivo de backup previamente exportado para restaurar seus registros financeiros na conta.
            </p>

            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full mt-4 py-8 border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group"
            >
              <FileJson className="w-8 h-8 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-700">
                Clique para selecionar o arquivo .json
              </span>
              <span className="text-[10px] text-slate-400">
                Suporta backups oficiais do Meu Controle Financeiro
              </span>
            </button>
          </div>

          {parsedData && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col gap-3">
              <div className="text-xs font-bold text-emerald-900">
                Backup Válido Pronto para Importação:
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-emerald-800">
                <span>• Salários: {parsedData.salaries?.length || 0}</span>
                <span>• Rendas Extras: {parsedData.incomes?.length || 0}</span>
                <span>• Despesas: {parsedData.expenses?.length || 0}</span>
                <span>• Cartões: {parsedData.creditCards?.length || 0}</span>
              </div>
              <button
                onClick={handleConfirmRestore}
                disabled={importing}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Restaurando...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Confirmar Restauração</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
