import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Check,
  ChevronDown,
  Download,
  FlaskConical,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Exam, Payor, PayorEditData, buscarTodasFontesPagadoras, formatBRL, formatPct } from '../../hooks/useCostControl';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { useDialog } from '../../hooks/useDialog';
import { hasPermission } from '../../utils/permissions';
import ConfirmDialog from '../ConfirmDialog';
import Notification from '../Notification';
import PayorFormModal from './PayorFormModal';
import PayorImportModal from './PayorImportModal';
import {
  buscarExamesPorTermo,
  buscarFontesPagadorasPorTermo,
  examesPorFontePagadora,
  fontesPagadorasPorTuss,
  type ExameDaFontePagadora,
} from './domain/busca';
import { linhasExportacaoExamesDaFonte, linhasExportacaoFontesPagadoras, type LinhaExportacao } from './domain/exportacao';
import type { LinhaImportacaoFontePagadora } from './domain/importacaoFontesPagadoras';
import { ORDENACAO_PADRAO, alternarOrdenacao, ordenar, type EstadoOrdenacao } from './domain/ordenacao';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PayorsScreenProps {
  payors: Payor[];
  exams: Exam[];
  updatePayorAtendido: (id: string, atendido: boolean) => Promise<void>;
  updatePayor: (id: string, data: PayorEditData) => Promise<void>;
  createPayor: (data: PayorEditData) => Promise<void>;
  deletePayor: (id: string) => Promise<void>;
  importPayors: (
    fontePagadora: string,
    tabelaAssociada: string,
    rows: LinhaImportacaoFontePagadora[]
  ) => Promise<number>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORDENAÇÃO DAS TABELAS DE RESULTADO
// ═══════════════════════════════════════════════════════════════════════════════

function IconeOrdenacao({ ativo, direcao }: { ativo: boolean; direcao: EstadoOrdenacao['direcao'] }) {
  if (!ativo || !direcao) return <ArrowUpDown className="w-3 h-3 opacity-40" aria-hidden />;
  return direcao === 'asc' ? (
    <ArrowUp className="w-3 h-3" aria-hidden />
  ) : (
    <ArrowDown className="w-3 h-3" aria-hidden />
  );
}

function CabecalhoOrdenavel<Coluna extends string>({
  coluna,
  titulo,
  ordenacao,
  onClick,
  align = 'left',
}: {
  coluna: Coluna;
  titulo: string;
  ordenacao: EstadoOrdenacao;
  onClick: (coluna: Coluna) => void;
  align?: 'left' | 'right';
}) {
  const ativo = ordenacao.coluna === coluna;
  return (
    <th className={`px-5 py-3 font-bold ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onClick(coluna)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-slate-700 dark:hover:text-slate-200 ${
          align === 'right' ? 'flex-row-reverse' : ''
        }`}
      >
        {titulo}
        <IconeOrdenacao ativo={ativo} direcao={ativo ? ordenacao.direcao : null} />
      </button>
    </th>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAMPO DE BUSCA (combobox genérico — usado uma vez pra Fonte Pagadora,
// outra pra Exame; cada um resolve pra um único item selecionado, com chip
// e X pra limpar, igual o campo único de antes)
// ═══════════════════════════════════════════════════════════════════════════════

function CampoBusca<T>({
  label,
  placeholder,
  itens,
  termo,
  onTermoChange,
  selecionado,
  onSelecionar,
  onLimpar,
  renderChip,
  renderSugestao,
  keyOf,
}: {
  label: string;
  placeholder: string;
  itens: T[];
  termo: string;
  onTermoChange: (v: string) => void;
  selecionado: T | null;
  onSelecionar: (item: T) => void;
  onLimpar: () => void;
  renderChip: (item: T) => React.ReactNode;
  renderSugestao: (item: T) => React.ReactNode;
  keyOf: (item: T) => string;
}) {
  const [indiceDestacado, setIndiceDestacado] = useState(0);

  useEffect(() => {
    setIndiceDestacado(0);
  }, [termo]);

  const termoDigitado = termo.trim().length > 0;
  const mostrarDropdown = !selecionado && termoDigitado;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!mostrarDropdown || itens.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceDestacado(i => (i + 1) % itens.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceDestacado(i => (i - 1 + itens.length) % itens.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onSelecionar(itens[indiceDestacado]);
    }
  };

  return (
    <div className="flex-1 min-w-0">
      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{label}</label>
      <div className="relative">
        {selecionado ? (
          <div className="flex items-center gap-2 pl-9 pr-2 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
            <span className="flex-1 min-w-0 text-sm font-medium text-blue-700 dark:text-blue-300 truncate">
              {renderChip(selecionado)}
            </span>
            <button
              type="button"
              onClick={onLimpar}
              aria-label={`Limpar ${label}`}
              className="shrink-0 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={termo}
              onChange={e => onTermoChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              autoComplete="off"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            />
            {mostrarDropdown && (
              <ul className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-64 overflow-y-auto">
                {itens.length === 0 ? (
                  <li className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400">Nenhum resultado encontrado.</li>
                ) : (
                  itens.map((item, i) => (
                    <li key={keyOf(item)}>
                      <button
                        type="button"
                        onClick={() => onSelecionar(item)}
                        onMouseEnter={() => setIndiceDestacado(i)}
                        aria-selected={i === indiceDestacado}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                          i === indiceDestacado ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-blue-50 dark:hover:bg-blue-500/10'
                        }`}
                      >
                        {renderSugestao(item)}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

type ColunaFontePagadora = 'payor' | 'table' | 'price';

const VALOR_COLUNA_FONTE_PAGADORA: Record<ColunaFontePagadora, (item: Payor) => string | number> = {
  payor: item => item.payor,
  table: item => item.table,
  price: item => item.price,
};

function TabelaFontesPagadoras({
  fontesPagadoras,
  onSelectFontePagadora,
}: {
  fontesPagadoras: Payor[];
  onSelectFontePagadora: (nome: string) => void;
}) {
  const [ordenacao, setOrdenacao] = useState<EstadoOrdenacao>(ORDENACAO_PADRAO);
  const alternar = (coluna: ColunaFontePagadora) => setOrdenacao(atual => alternarOrdenacao(atual, coluna));

  const linhas = useMemo(
    () =>
      ordenar(
        fontesPagadoras,
        ordenacao,
        (item, coluna) => VALOR_COLUNA_FONTE_PAGADORA[coluna as ColunaFontePagadora](item),
        (a, b) => a.price - b.price,
      ),
    [fontesPagadoras, ordenacao],
  );

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-gray-900/40 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <tr>
              <CabecalhoOrdenavel coluna="payor" titulo="Fonte Pagadora" ordenacao={ordenacao} onClick={alternar} />
              <CabecalhoOrdenavel coluna="table" titulo="Tabela Associada" ordenacao={ordenacao} onClick={alternar} />
              <CabecalhoOrdenavel coluna="price" titulo="Valor Cobrado" ordenacao={ordenacao} onClick={alternar} align="right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  Nenhuma fonte pagadora cadastrada para este exame.
                </td>
              </tr>
            ) : (
              linhas.map(p => (
                <tr key={p.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/[.04] transition-colors">
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => onSelectFontePagadora(p.payor)}
                      className="flex items-center gap-2 text-left hover:underline"
                    >
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-gray-800 dark:text-gray-100">{p.payor}</span>
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {p.table}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                    {formatBRL(p.price)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-900/30 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
        <span>
          {linhas.length} {linhas.length === 1 ? 'fonte pagadora' : 'fontes pagadoras'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Lock className="w-3 h-3" />
          Dados somente leitura — espelhados do APLIS
        </span>
      </div>
    </div>
  );
}

type ColunaExameDaFonte =
  | 'exame'
  | 'tuss'
  | 'tabelaAssociada'
  | 'valorCobrado'
  | 'custo'
  | 'dif'
  | 'percentualCsp'
  | 'atendido';

const VALOR_COLUNA_EXAME_DA_FONTE: Record<ColunaExameDaFonte, (item: ExameDaFontePagadora) => string | number> = {
  exame: item => item.exame,
  tuss: item => item.tuss,
  tabelaAssociada: item => item.tabelaAssociada,
  valorCobrado: item => item.valorCobrado,
  custo: item => item.custo,
  dif: item => item.dif,
  percentualCsp: item => item.percentualCsp,
  atendido: item => (item.atendido ? 1 : 0),
};

function TabelaExamesDaFonte({
  examesDaFonte,
  onSelectExame,
  onToggleAtendido,
  onEditLinha,
  onDeleteLinha,
  onNovaLinha,
  podeGerenciar,
  mensagemVazia = 'Nenhum exame cadastrado para esta fonte pagadora.',
}: {
  examesDaFonte: ExameDaFontePagadora[];
  onSelectExame: (tuss: string) => void;
  onToggleAtendido: (payorId: string, atendido: boolean) => void;
  onEditLinha: (item: ExameDaFontePagadora) => void;
  onDeleteLinha: (item: ExameDaFontePagadora) => void;
  onNovaLinha: () => void;
  podeGerenciar: boolean;
  mensagemVazia?: string;
}) {
  const [ordenacao, setOrdenacao] = useState<EstadoOrdenacao>(ORDENACAO_PADRAO);
  const alternar = (coluna: ColunaExameDaFonte) => setOrdenacao(atual => alternarOrdenacao(atual, coluna));

  const linhas = useMemo(
    () =>
      ordenar(
        examesDaFonte,
        ordenacao,
        (item, coluna) => VALOR_COLUNA_EXAME_DA_FONTE[coluna as ColunaExameDaFonte](item),
        (a, b) => a.valorCobrado - b.valorCobrado,
      ),
    [examesDaFonte, ordenacao],
  );

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      {podeGerenciar && (
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-end">
          <button
            type="button"
            onClick={onNovaLinha}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-gray-900/40 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <tr>
              <CabecalhoOrdenavel coluna="exame" titulo="Exame" ordenacao={ordenacao} onClick={alternar} />
              <CabecalhoOrdenavel coluna="tuss" titulo="TUSS" ordenacao={ordenacao} onClick={alternar} />
              <CabecalhoOrdenavel coluna="tabelaAssociada" titulo="Tabela Associada" ordenacao={ordenacao} onClick={alternar} />
              <CabecalhoOrdenavel coluna="valorCobrado" titulo="Valor Cobrado" ordenacao={ordenacao} onClick={alternar} align="right" />
              <CabecalhoOrdenavel coluna="custo" titulo="Custo" ordenacao={ordenacao} onClick={alternar} align="right" />
              <CabecalhoOrdenavel coluna="dif" titulo="Dif" ordenacao={ordenacao} onClick={alternar} align="right" />
              <CabecalhoOrdenavel coluna="percentualCsp" titulo="%CSP" ordenacao={ordenacao} onClick={alternar} align="right" />
              <CabecalhoOrdenavel coluna="atendido" titulo="Atendido" ordenacao={ordenacao} onClick={alternar} align="right" />
              {podeGerenciar && <th className="px-5 py-3 text-right font-bold w-24">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={podeGerenciar ? 9 : 8} className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  {mensagemVazia}
                </td>
              </tr>
            ) : (
              linhas.map(e => (
                <tr key={`${e.payorId}-${e.tuss}-${e.tabelaAssociada}`} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/[.04] transition-colors">
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => onSelectExame(e.tuss)}
                      className="flex items-center gap-2 text-left hover:underline"
                    >
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <FlaskConical className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-gray-800 dark:text-gray-100">{e.exame}</span>
                    </button>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-500 dark:text-gray-400">{e.tuss}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {e.tabelaAssociada}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                    {formatBRL(e.valorCobrado)}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {formatBRL(e.custo)}
                  </td>
                  <td
                    className={`px-5 py-3.5 text-right tabular-nums font-semibold ${
                      e.dif < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {formatBRL(e.dif)}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {formatPct(e.percentualCsp)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => onToggleAtendido(e.payorId, !e.atendido)}
                      disabled={!podeGerenciar}
                      aria-pressed={e.atendido}
                      title={
                        podeGerenciar
                          ? e.atendido
                            ? 'Atendido pelo plano de saúde — clique para marcar como só particular'
                            : 'Só atendido como particular — clique para marcar como atendido pelo plano'
                          : 'Somente leitura — requer permissão para gerenciar contas a receber'
                      }
                      className={`ml-auto flex items-center justify-center w-6 h-6 rounded-md border transition-colors ${
                        e.atendido
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                          : 'bg-transparent border-gray-300 dark:border-gray-600 text-transparent'
                      } ${podeGerenciar ? '' : 'opacity-60 cursor-not-allowed'}`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </td>
                  {podeGerenciar && (
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onEditLinha(e)}
                          title="Editar"
                          className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-500/10 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteLinha(e)}
                          title="Excluir"
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-900/30 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
        <span>
          {linhas.length} {linhas.length === 1 ? 'exame' : 'exames'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          {podeGerenciar ? (
            <>
              <Pencil className="w-3 h-3" />
              Editável manualmente — reimportação pode sobrescrever alterações
            </>
          ) : (
            <>
              <Lock className="w-3 h-3" />
              Somente leitura — requer permissão para gerenciar contas a receber
            </>
          )}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const PayorsScreen: React.FC<PayorsScreenProps> = ({
  payors,
  exams,
  updatePayorAtendido,
  updatePayor,
  createPayor,
  deletePayor,
  importPayors,
}) => {
  const { userProfile } = useAuth();
  const podeGerenciar = hasPermission(userProfile?.permissions || [], 'canManageBilling');
  const { notification, showSuccess, showWarning, showError, hideNotification } = useNotification();
  const { confirmDialog, showConfirmDialog, hideConfirmDialog, handleConfirmDialogConfirm } = useDialog();
  const [termoFonte, setTermoFonte] = useState('');
  const [termoExame, setTermoExame] = useState('');
  const [fontePagadoraSelecionada, setFontePagadoraSelecionada] = useState<string | null>(null);
  const [exameSelecionado, setExameSelecionado] = useState<Exam | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingLinha, setEditingLinha] = useState<ExameDaFontePagadora | null>(null);
  const [creatingNovaLinha, setCreatingNovaLinha] = useState(false);
  const [creatingNovaFontePagadora, setCreatingNovaFontePagadora] = useState(false);
  const [payorFormOpen, setPayorFormOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Exames cobertos pela fonte pagadora selecionada (base pros dois casos em
  // que ela está preenchida: só fonte, ou fonte + exame).
  const examesDaFonte = useMemo(
    () => (fontePagadoraSelecionada ? examesPorFontePagadora(exams, payors, fontePagadoraSelecionada) : []),
    [exams, payors, fontePagadoraSelecionada]
  );

  const examesDaFonteFiltrados = useMemo(
    () => (exameSelecionado ? examesDaFonte.filter(e => e.tuss === exameSelecionado.tuss) : examesDaFonte),
    [examesDaFonte, exameSelecionado]
  );

  // Fontes pagadoras do exame selecionado — só relevante quando nenhuma
  // fonte está fixada ainda (senão o caso acima já resolve).
  const fontesDoExame = useMemo(
    () =>
      !fontePagadoraSelecionada && exameSelecionado
        ? fontesPagadorasPorTuss(payors, exameSelecionado.tuss)
        : [],
    [payors, fontePagadoraSelecionada, exameSelecionado]
  );

  // Sugestões do campo Fonte Pagadora: se já tem exame fixado, restringe às
  // fontes que efetivamente cobrem aquele exame.
  const sugestoesFonte = useMemo(() => {
    if (fontePagadoraSelecionada) return [];
    const base = exameSelecionado ? payors.filter(p => p.tus === exameSelecionado.tuss) : payors;
    return buscarFontesPagadorasPorTermo(base, termoFonte);
  }, [payors, termoFonte, fontePagadoraSelecionada, exameSelecionado]);

  // Sugestões do campo Exame: se já tem fonte fixada, restringe aos exames
  // que aquela fonte realmente cobre.
  const sugestoesExame = useMemo(() => {
    if (exameSelecionado) return [];
    const base = fontePagadoraSelecionada
      ? exams.filter(e => examesDaFonte.some(x => x.tuss === e.tuss))
      : exams;
    return buscarExamesPorTermo(base, termoExame);
  }, [exams, termoExame, exameSelecionado, fontePagadoraSelecionada, examesDaFonte]);

  const handleSelecionarFonte = (nome: string) => {
    setFontePagadoraSelecionada(nome);
    setTermoFonte('');
  };

  const handleLimparFonte = () => {
    setFontePagadoraSelecionada(null);
    setTermoFonte('');
  };

  const handleSelecionarExame = (exame: Exam) => {
    setExameSelecionado(exame);
    setTermoExame('');
  };

  const handleLimparExame = () => {
    setExameSelecionado(null);
    setTermoExame('');
  };

  const handleSelecionarExamePorTuss = (tuss: string) => {
    // TUSS pode se repetir entre exames (sem examId confiável vindo do
    // APLIS) — mesma regra de "último vence" usada em examesPorFontePagadora,
    // pra bater com o exame que a tabela de origem realmente mostrou.
    const exame = exams.reduce<Exam | undefined>(
      (ultimo, atual) => (atual.tuss === tuss ? atual : ultimo),
      undefined,
    );
    if (!exame) return;
    handleSelecionarExame(exame);
  };

  const handleToggleAtendido = (payorId: string, atendido: boolean) => {
    updatePayorAtendido(payorId, atendido).catch(err => {
      console.error('Falha ao atualizar Atendido da fonte pagadora', err);
      showError('Erro ao atualizar Atendido', err instanceof Error ? err.message : undefined);
    });
  };

  const handleEditLinha = (item: ExameDaFontePagadora) => {
    setEditingLinha(item);
    setPayorFormOpen(true);
  };

  const handleNovaLinha = () => {
    setCreatingNovaLinha(true);
    setPayorFormOpen(true);
  };

  const handleNovaFontePagadora = () => {
    setCreatingNovaFontePagadora(true);
    setPayorFormOpen(true);
  };

  const handleCloseFormModal = () => {
    setPayorFormOpen(false);
    setEditingLinha(null);
    setCreatingNovaLinha(false);
    setCreatingNovaFontePagadora(false);
  };

  const handleSavePayorEdit = async (data: PayorEditData) => {
    try {
      if (editingLinha) {
        await updatePayor(editingLinha.payorId, data);
      } else {
        await createPayor(data);
        if (creatingNovaFontePagadora) {
          handleSelecionarFonte(data.payor);
        }
      }

      // examesPorFontePagadora casa a linha com um exame pelo TUSS — se o
      // TUSS informado não estiver cadastrado na aba Exames, a linha é
      // gravada mas não aparece em nenhuma tabela até isso ser corrigido.
      if (exams.some(e => e.tuss === data.tus)) {
        showSuccess(editingLinha ? 'Fonte pagadora atualizada com sucesso!' : 'Linha criada com sucesso!');
      } else {
        showWarning(
          editingLinha ? 'Fonte pagadora atualizada' : 'Linha criada',
          `TUSS "${data.tus}" não está cadastrado na aba Exames — a linha foi salva, mas não vai aparecer aqui até um exame com esse TUSS existir.`
        );
      }
      handleCloseFormModal();
    } catch (err) {
      showError(
        editingLinha ? 'Erro ao atualizar fonte pagadora' : 'Erro ao criar linha',
        err instanceof Error ? err.message : undefined
      );
    }
  };

  const handleDeleteLinha = (item: ExameDaFontePagadora) => {
    showConfirmDialog(
      'Excluir linha',
      `Tem certeza que deseja excluir a linha de "${item.exame}" (TUSS ${item.tuss})? Esta ação não pode ser desfeita.`,
      async () => {
        try {
          await deletePayor(item.payorId);
          showSuccess('Linha excluída com sucesso!');
        } catch (err) {
          showError('Erro ao excluir linha', err instanceof Error ? err.message : undefined);
        }
      },
      { type: 'danger', confirmText: 'Excluir' }
    );
  };

  const mostrarConvite = !fontePagadoraSelecionada && !exameSelecionado;

  // Fecha o dropdown de exportação ao clicar fora dele.
  useEffect(() => {
    if (!exportMenuOpen) return;
    const handle = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [exportMenuOpen]);

  const gerarArquivoExportacao = (linhas: LinhaExportacao[], nomeAba: string, formato: 'xlsx' | 'csv') => {
    const worksheet = XLSX.utils.json_to_sheet(linhas);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, nomeAba);
    const filename = `fontes_pagadoras_controle_custos_${new Date().toISOString().slice(0, 10)}.${formato}`;
    XLSX.writeFile(workbook, filename);
  };

  // Exporta exatamente o recorte exibido na tela (mesma precedência de
  // fontePagadoraSelecionada/exameSelecionado usada na renderização das
  // tabelas abaixo). Sem nenhum filtro ativo — estado em que a tela não
  // mostra tabela nenhuma — busca todas as linhas direto do Supabase, sem
  // depender de nada estar renderizado.
  const handleExport = async (formato: 'xlsx' | 'csv') => {
    setExportMenuOpen(false);
    try {
      if (fontePagadoraSelecionada) {
        if (examesDaFonteFiltrados.length === 0) {
          showError('Nada para exportar', 'Nenhum exame no recorte atual desta fonte pagadora.');
          return;
        }
        gerarArquivoExportacao(linhasExportacaoExamesDaFonte(examesDaFonteFiltrados), 'Exames', formato);
        return;
      }

      if (exameSelecionado) {
        if (fontesDoExame.length === 0) {
          showError('Nada para exportar', 'Nenhuma fonte pagadora cadastrada para este exame.');
          return;
        }
        gerarArquivoExportacao(linhasExportacaoFontesPagadoras(fontesDoExame), 'Fontes Pagadoras', formato);
        return;
      }

      setExportando(true);
      const todas = await buscarTodasFontesPagadoras();
      if (todas.length === 0) {
        showError('Nada para exportar', 'Nenhuma fonte pagadora cadastrada.');
        return;
      }
      gerarArquivoExportacao(linhasExportacaoFontesPagadoras(todas), 'Fontes Pagadoras', formato);
    } catch (err) {
      showError('Erro ao exportar', err instanceof Error ? err.message : undefined);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header + campos de busca */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Fontes Pagadoras</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Busque por fonte pagadora e/ou exame para ver os valores cobrados.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {podeGerenciar && (
              <button
                type="button"
                onClick={handleNovaFontePagadora}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 active:scale-[.98] transition-all"
              >
                <Plus className="w-4 h-4" /> Nova Fonte Pagadora
              </button>
            )}
            {podeGerenciar && (
              <button
                type="button"
                onClick={() => setImportModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 active:scale-[.98] transition-all"
              >
                <Upload className="w-4 h-4" /> Importar
              </button>
            )}
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setExportMenuOpen(o => !o)}
                disabled={exportando}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 active:scale-[.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" /> {exportando ? 'Exportando…' : 'Exportar'}
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-20 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handleExport('xlsx')}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
                  >
                    Exportar como .xlsx
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('csv')}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors border-t border-gray-100 dark:border-gray-700"
                  >
                    Exportar como .csv
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-4">
          <CampoBusca
            label="Fonte Pagadora"
            placeholder="Buscar fonte pagadora…"
            itens={sugestoesFonte}
            termo={termoFonte}
            onTermoChange={setTermoFonte}
            selecionado={fontePagadoraSelecionada}
            onSelecionar={handleSelecionarFonte}
            onLimpar={handleLimparFonte}
            renderChip={nome => <>{nome}</>}
            renderSugestao={nome => (
              <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{nome}</span>
            )}
            keyOf={nome => nome}
          />

          <CampoBusca
            label="Exame"
            placeholder="Buscar exame ou código TUSS…"
            itens={sugestoesExame}
            termo={termoExame}
            onTermoChange={setTermoExame}
            selecionado={exameSelecionado}
            onSelecionar={handleSelecionarExame}
            onLimpar={handleLimparExame}
            renderChip={exame => (
              <>
                {exame.name}
                <span className="ml-2 font-mono text-xs text-blue-500 dark:text-blue-400">{exame.tuss}</span>
              </>
            )}
            renderSugestao={exame => (
              <>
                <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{exame.name}</span>
                <span className="font-mono text-xs text-gray-500 dark:text-gray-400 shrink-0">{exame.tuss}</span>
              </>
            )}
            keyOf={exame => exame.id}
          />
        </div>
      </div>

      {mostrarConvite && (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30 p-10 text-center text-sm text-gray-500 dark:text-gray-400">
          Preencha ao menos um dos campos — fonte pagadora, exame, ou os dois — pra ver os dados.
        </div>
      )}

      {fontePagadoraSelecionada && (
        <TabelaExamesDaFonte
          key={`${fontePagadoraSelecionada}-${exameSelecionado?.tuss ?? ''}`}
          examesDaFonte={examesDaFonteFiltrados}
          onSelectExame={handleSelecionarExamePorTuss}
          onToggleAtendido={handleToggleAtendido}
          onEditLinha={handleEditLinha}
          onDeleteLinha={handleDeleteLinha}
          onNovaLinha={handleNovaLinha}
          podeGerenciar={podeGerenciar}
          mensagemVazia={
            exameSelecionado
              ? 'Este exame não está cadastrado para esta fonte pagadora.'
              : 'Nenhum exame cadastrado para esta fonte pagadora.'
          }
        />
      )}

      {!fontePagadoraSelecionada && exameSelecionado && (
        <TabelaFontesPagadoras
          key={exameSelecionado.tuss}
          fontesPagadoras={fontesDoExame}
          onSelectFontePagadora={handleSelecionarFonte}
        />
      )}

      {podeGerenciar && (
        <PayorImportModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          payors={payors}
          exams={exams}
          onImport={importPayors}
        />
      )}

      {podeGerenciar && (
        <PayorFormModal
          open={payorFormOpen}
          mode={editingLinha ? 'edit' : 'create'}
          payor={
            editingLinha
              ? {
                  payor: fontePagadoraSelecionada ?? '',
                  table: editingLinha.tabelaAssociada,
                  tus: editingLinha.tuss,
                  price: editingLinha.valorCobrado,
                }
              : creatingNovaLinha
              ? { payor: fontePagadoraSelecionada ?? '', table: '', tus: '', price: 0 }
              : creatingNovaFontePagadora
              ? { payor: '', table: '', tus: '', price: 0 }
              : null
          }
          onClose={handleCloseFormModal}
          onSave={handleSavePayorEdit}
        />
      )}

      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        type={confirmDialog.type}
        onConfirm={handleConfirmDialogConfirm}
        onCancel={hideConfirmDialog}
      />
    </div>
  );
};

export default PayorsScreen;
