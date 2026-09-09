import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, X, FileSpreadsheet, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { Exam, Payor } from '../../hooks/useCostControl';
import {
  validarLinhasImportacaoFontePagadora,
  type LinhaImportacaoFontePagadora,
  type LinhaValidada,
} from './domain/importacaoFontesPagadoras';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PayorImportModalProps {
  open: boolean;
  onClose: () => void;
  payors: Payor[];
  exams: Exam[];
  onImport: (fontePagadora: string, tabelaAssociada: string, rows: LinhaImportacaoFontePagadora[]) => Promise<number>;
}

const REQUIRED_COLUMNS = ['TUSS', 'NOME DO EXAME', 'VALOR', 'ATENDIDO'];

const normalizeHeader = (h: string): string =>
  h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const PayorImportModal: React.FC<PayorImportModalProps> = ({ open, onClose, payors, exams, onImport }) => {
  const [fontePagadora, setFontePagadora] = useState('');
  const [tabelaAssociada, setTabelaAssociada] = useState('');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<LinhaValidada[]>([]);
  const [columnError, setColumnError] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const tussValidos = useMemo(() => new Set(exams.map(e => e.tuss).filter(Boolean)), [exams]);

  const fontesPagadoras = useMemo(() => Array.from(new Set(payors.map(p => p.payor))).sort(), [payors]);

  const tabelasAssociadas = useMemo(() => {
    const nomeFonte = fontePagadora.trim();
    const base = nomeFonte ? payors.filter(p => p.payor === nomeFonte) : payors;
    return Array.from(new Set(base.map(p => p.table).filter(Boolean))).sort();
  }, [payors, fontePagadora]);

  if (!open) return null;

  const podeEscolherArquivo = fontePagadora.trim().length > 0;

  const reset = () => {
    setFontePagadora('');
    setTabelaAssociada('');
    setFileName('');
    setRows([]);
    setColumnError('');
    setDone(null);
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    setRows([]);
    setColumnError('');
    setDone(null);
    setError('');
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = evt.target?.result;
        // XLSX.read detecta o formato pelo conteúdo — funciona tanto para
        // .xlsx/.xls (binário) quanto para .csv (texto), sem código separado.
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

        if (json.length === 0) {
          setColumnError('A planilha está vazia.');
          return;
        }

        const headerMap = new Map<string, string>();
        Object.keys(json[0]).forEach(k => headerMap.set(normalizeHeader(k), k));

        const missing = REQUIRED_COLUMNS.filter(c => !headerMap.has(c));
        if (missing.length > 0) {
          setColumnError(
            `Colunas obrigatórias ausentes: ${missing.join(', ')}. Baixe o modelo para conferir o formato esperado.`
          );
          return;
        }

        const brutas = json.map(raw => ({
          tuss: raw[headerMap.get('TUSS')!],
          nomeExame: raw[headerMap.get('NOME DO EXAME')!],
          valor: raw[headerMap.get('VALOR')!],
          atendido: raw[headerMap.get('ATENDIDO')!],
        }));

        setRows(validarLinhasImportacaoFontePagadora(brutas, tussValidos));
      } catch {
        setColumnError('Não foi possível ler o arquivo. Confira se é um .xlsx, .xls ou .csv válido.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([
      { TUSS: '40304361', 'Nome do Exame': 'Hemograma Completo', Valor: 25.5, Atendido: 'Sim' },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fontes Pagadoras');
    XLSX.writeFile(workbook, 'modelo_importacao_custos_fontes_pagadoras.xlsx');
  };

  const validRows = rows.filter((r): r is LinhaValidada & { data: LinhaImportacaoFontePagadora } => r.data !== null);
  const invalidRows = rows.filter(r => r.data === null);

  const handleImport = async () => {
    if (validRows.length === 0 || !podeEscolherArquivo) return;
    setImporting(true);
    setError('');
    try {
      const count = await onImport(fontePagadora.trim(), tabelaAssociada.trim(), validRows.map(r => r.data));
      setDone(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar custos de fontes pagadoras.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Importar custos de fonte pagadora</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Aceita arquivos .xlsx, .xls e .csv</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {done !== null ? (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-sm text-emerald-800 dark:text-emerald-300">
                {done} linha{done !== 1 ? 's' : ''} importada{done !== 1 ? 's' : ''} com sucesso!
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                    Fonte Pagadora <span className="text-red-500">*</span>
                  </label>
                  <input
                    list="payor-import-fontes"
                    value={fontePagadora}
                    onChange={e => setFontePagadora(e.target.value)}
                    placeholder="Selecione ou digite a fonte pagadora…"
                    className="w-full px-3 py-2.5 text-sm rounded-xl bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                  />
                  <datalist id="payor-import-fontes">
                    {fontesPagadoras.map(nome => (
                      <option key={nome} value={nome} />
                    ))}
                  </datalist>
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                    Tabela Associada
                  </label>
                  <input
                    list="payor-import-tabelas"
                    value={tabelaAssociada}
                    onChange={e => setTabelaAssociada(e.target.value)}
                    placeholder="Opcional"
                    className="w-full px-3 py-2.5 text-sm rounded-xl bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                  />
                  <datalist id="payor-import-tabelas">
                    {tabelasAssociadas.map(nome => (
                      <option key={nome} value={nome} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div
                className={`rounded-xl border border-dashed p-6 text-center ${
                  podeEscolherArquivo ? 'border-gray-300 dark:border-gray-600' : 'border-gray-200 dark:border-gray-700 opacity-50'
                }`}
              >
                <FileSpreadsheet className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  {podeEscolherArquivo
                    ? 'Selecione uma planilha com as colunas: TUSS, Nome do Exame, Valor, Atendido.'
                    : 'Selecione a Fonte Pagadora acima para habilitar o upload.'}
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  disabled={!podeEscolherArquivo}
                  onChange={onFileInputChange}
                />
                <button
                  type="button"
                  disabled={!podeEscolherArquivo}
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Upload className="w-4 h-4" /> Escolher arquivo
                </button>
                {fileName && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{fileName}</p>}
              </div>

              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Download className="w-3.5 h-3.5" /> Baixar modelo de planilha
              </button>

              {columnError && (
                <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800 dark:text-red-300">{columnError}</div>
                </div>
              )}

              {rows.length > 0 && !columnError && (
                <div className="space-y-2">
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-900/30 p-4 text-sm text-gray-700 dark:text-gray-200">
                    <strong className="text-gray-900 dark:text-gray-100">{validRows.length}</strong> linha
                    {validRows.length !== 1 ? 's' : ''} pronta{validRows.length !== 1 ? 's' : ''} para importar
                    {invalidRows.length > 0 && (
                      <>
                        {' · '}
                        <span className="text-amber-600 dark:text-amber-400">
                          {invalidRows.length} linha{invalidRows.length !== 1 ? 's' : ''} ignorada
                          {invalidRows.length !== 1 ? 's' : ''}
                        </span>
                      </>
                    )}
                  </div>
                  {invalidRows.length > 0 && (
                    <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 max-h-24 overflow-y-auto">
                      {invalidRows.slice(0, 10).map(r => (
                        <li key={r.row}>Linha {r.row}: {r.error}</li>
                      ))}
                      {invalidRows.length > 10 && <li>e mais {invalidRows.length - 10}…</li>}
                    </ul>
                  )}
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800 dark:text-red-300">{error}</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 active:scale-[.98] transition-all"
          >
            {done !== null ? 'Fechar' : 'Cancelar'}
          </button>
          {done === null && (
            <button
              type="button"
              disabled={validRows.length === 0 || importing || !podeEscolherArquivo}
              onClick={handleImport}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md shadow-blue-500/25 active:scale-[.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              {importing ? 'Importando…' : `Importar ${validRows.length} linha${validRows.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PayorImportModal;
