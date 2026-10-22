import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Building2,
  Check,
  ChevronDown,
  Download,
  FlaskConical,
  Link2,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  CriarTabelaAssociada,
  Exam,
  Payor,
  PayorEditData,
  TabelaAssociada,
  buscarTodasFontesPagadoras,
  formatBRL,
  formatPct,
} from '../../hooks/useCostControl';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { useDialog } from '../../hooks/useDialog';
import { hasPermission } from '../../utils/permissions';
import ConfirmDialog from '../ConfirmDialog';
import Notification from '../Notification';
import ExamFormModal from './ExamFormModal';
import PayorFormModal from './PayorFormModal';
import AutocompleteInput from './AutocompleteInput';
import FiltroTabelaAssociada from './FiltroTabelaAssociada';
import PayorImportModal from './PayorImportModal';
import ValorExameFormModal from './ValorExameFormModal';
import TabelasDaFonte from './TabelasDaFonte';
import { contarLinhasPorTabela, fonteDaNovaTabela, gruposParaFiltroDeTabela, tabelasDaFonte } from './domain/tabelasAssociadas';
import {
  buscarExamesPorTermo,
  buscarFontesPagadorasPorTermo,
  casaTermo,
  edicaoSeparaDaLinhaGeral,
  examesPorFontePagadora,
  fontesPagadorasDoExame,
  irmaosNaLinha,
  type ExameDaFontePagadora,
} from './domain/busca';
import {
  CUSTO_NAO_LEVANTADO,
  linhasExportacaoExamesDaFonte,
  linhasExportacaoFontesDoExame,
  linhasExportacaoFontesPagadoras,
  type LinhaExportacao,
} from './domain/exportacao';
import type { PlanoImportacao } from './domain/importacaoFontesPagadoras';
import { ORDENACAO_PADRAO, alternarOrdenacao, ordenar, type EstadoOrdenacao } from './domain/ordenacao';
import { CabecalhoOrdenavel } from './domain/CabecalhoOrdenavel';

// Mesmo valor usado pelo backend (api/_lib/orcamentoParticular.ts,
// FONTE_PARTICULAR) pra identificar a fonte pagadora "Particular" — só ela
// usa elegivel_desconto_particular; nas outras 37 a coluna é sempre FALSE.
const FONTE_PARTICULAR = 'Particular';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PayorsScreenProps {
  payors: Payor[];
  tabelasAssociadas: TabelaAssociada[];
  exams: Exam[];
  exameExclusions: Set<string>;
  exameValoresPersonalizados: Map<string, number>;
  updatePayorAtendido: (id: string, atendido: boolean) => Promise<void>;
  updatePayorElegivelDescontoParticular: (id: string, elegivel: boolean) => Promise<void>;
  updatePayor: (id: string, data: PayorEditData) => Promise<void>;
  createPayor: (data: PayorEditData) => Promise<void>;
  deletePayor: (id: string) => Promise<void>;
  excludeExameDaFontePagadora: (payorId: string, exameId: string) => Promise<void>;
  setValorExameDaFontePagadora: (payorId: string, exameId: string, valor: number) => Promise<void>;
  restaurarValorPadraoExameDaFontePagadora: (payorId: string, exameId: string) => Promise<void>;
  updateExam: (id: string, data: Partial<Omit<Exam, 'id'>>) => Promise<void>;
  importPayors: (tabela: TabelaAssociada, plano: PlanoImportacao) => Promise<number>;
  createTabelaAssociada: CriarTabelaAssociada;
  updateVencimentoTabelaAssociada: (id: string, vencimento: string | null) => Promise<void>;
  renameTabelaAssociada: (id: string, nome: string) => Promise<void>;
  setAtivaTabelaAssociada: (id: string, ativa: boolean) => Promise<void>;
  deleteTabelaAssociada: (id: string) => Promise<void>;
}

// Dados de uma linha em edição no PayorFormModal — comum às duas tabelas de
// resultado (TabelaExamesDaFonte e TabelaFontesPagadoras), que expõem campos
// diferentes pra mesma linha de Payor.
// nomeConvenio: só pra saber se a linha é não levantada (edicaoSeparaDaLinhaGeral).
type LinhaEditavel = PayorEditData & { payorId: string; nomeConvenio: string | null };

// ═══════════════════════════════════════════════════════════════════════════════
// CAMPO DE BUSCA (combobox genérico — usado pra Fonte Pagadora; resolve pra
// um único item selecionado, com chip
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

type ColunaFontePagadora = 'payor' | 'table' | 'price' | 'atendido';

const VALOR_COLUNA_FONTE_PAGADORA: Record<ColunaFontePagadora, (item: ExameDaFontePagadora) => string | number> = {
  payor: item => item.fontePagadora,
  table: item => item.tabelaAssociada,
  price: item => item.valorCobrado,
  atendido: item => (item.atendido ? 1 : 0),
};

function TabelaFontesPagadoras({
  fontesPagadoras,
  custo,
  onSelectFontePagadora,
  onToggleAtendido,
  onEditLinha,
  onDeleteLinha,
  podeGerenciar,
}: {
  fontesPagadoras: ExameDaFontePagadora[];
  // Custo Total (direct + indirect) do exame selecionado, cadastrado na aba
  // Exames — igual pra todas as linhas aqui, já que a tabela é fixada num
  // único exame.
  custo: number;
  onSelectFontePagadora: (nome: string) => void;
  onToggleAtendido: (payorId: string, atendido: boolean) => void;
  onEditLinha: (item: ExameDaFontePagadora) => void;
  onDeleteLinha: (item: ExameDaFontePagadora) => void;
  podeGerenciar: boolean;
}) {
  const [ordenacao, setOrdenacao] = useState<EstadoOrdenacao>(ORDENACAO_PADRAO);
  const alternar = (coluna: ColunaFontePagadora) => setOrdenacao(atual => alternarOrdenacao(atual, coluna));

  const linhas = useMemo(
    () =>
      ordenar(
        fontesPagadoras,
        ordenacao,
        (item, coluna) => VALOR_COLUNA_FONTE_PAGADORA[coluna as ColunaFontePagadora](item),
        (a, b) => a.valorCobrado - b.valorCobrado,
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
              <th className="px-5 py-3 text-right font-bold">Custo</th>
              <CabecalhoOrdenavel coluna="atendido" titulo="Atendido" ordenacao={ordenacao} onClick={alternar} align="right" />
              {podeGerenciar && <th className="px-5 py-3 text-right font-bold w-24">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={podeGerenciar ? 6 : 5} className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  Nenhuma fonte pagadora cadastrada para este exame.
                </td>
              </tr>
            ) : (
              linhas.map(p => (
                <tr key={p.payorId} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/[.04] transition-colors">
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => onSelectFontePagadora(p.fontePagadora)}
                      className="flex items-center gap-2 text-left hover:underline"
                    >
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-gray-800 dark:text-gray-100">{p.fontePagadora}</span>
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {p.tabelaAssociada}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                    {formatBRL(p.valorCobrado)}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {formatBRL(custo)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => onToggleAtendido(p.payorId, !p.atendido)}
                      disabled={!podeGerenciar}
                      aria-pressed={p.atendido}
                      title={
                        podeGerenciar
                          ? p.atendido
                            ? 'Atendido pelo plano de saúde — clique para marcar como só particular'
                            : 'Só atendido como particular — clique para marcar como atendido pelo plano'
                          : 'Somente leitura — requer permissão para gerenciar contas a receber'
                      }
                      className={`ml-auto flex items-center justify-center w-6 h-6 rounded-md border transition-colors ${
                        p.atendido
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
                          onClick={() => onEditLinha(p)}
                          title="Editar"
                          className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-500/10 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteLinha(p)}
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
          {linhas.length} {linhas.length === 1 ? 'fonte pagadora' : 'fontes pagadoras'}
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

type ColunaExameDaFonte =
  | 'exame'
  | 'tuss'
  | 'tabelaAssociada'
  | 'valorCobrado'
  | 'custo'
  | 'dif'
  | 'percentualCsp'
  | 'atendido'
  | 'elegivelDescontoParticular';

const VALOR_COLUNA_EXAME_DA_FONTE: Record<ColunaExameDaFonte, (item: ExameDaFontePagadora) => string | number> = {
  exame: item => item.exame,
  tuss: item => item.tuss,
  tabelaAssociada: item => item.tabelaAssociada,
  valorCobrado: item => item.valorCobrado,
  custo: item => item.custo,
  dif: item => item.dif,
  percentualCsp: item => item.percentualCsp,
  atendido: item => (item.atendido ? 1 : 0),
  elegivelDescontoParticular: item => (item.elegivelDescontoParticular ? 1 : 0),
};

function TabelaExamesDaFonte({
  examesDaFonte,
  onSelectExame,
  onEditExame,
  onToggleAtendido,
  onToggleElegivelDescontoParticular,
  mostrarColunaElegibilidade,
  onEditLinha,
  onDeleteLinha,
  onNovaLinha,
  podeGerenciar,
  mensagemVazia = 'Nenhum exame cadastrado para esta fonte pagadora.',
}: {
  examesDaFonte: ExameDaFontePagadora[];
  onSelectExame: (exameId: string) => void;
  onEditExame: (exameId: string) => void;
  onToggleAtendido: (payorId: string, atendido: boolean) => void;
  onToggleElegivelDescontoParticular: (payorId: string, elegivel: boolean) => void;
  // Coluna só faz sentido pra fonte pagadora "Particular" — nas outras 37 a
  // coluna elegivel_desconto_particular é sempre FALSE e ignorada.
  mostrarColunaElegibilidade: boolean;
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

  // Nomes de exame que compartilham o mesmo payorId (mesmo registro de
  // custo_fontes_pagadoras) — um TUSS pode cobrir vários exames com nomes
  // diferentes (ver examesPorFontePagadora). Alterar atendido/elegibilidade
  // ou excluir uma dessas linhas afeta todas as outras que aparecem aqui.
  const nomesIrmaosPorPayorId = useMemo(() => {
    const porPayorId = new Map<string, string[]>();
    for (const e of examesDaFonte) {
      porPayorId.set(e.payorId, [...(porPayorId.get(e.payorId) ?? []), e.exame]);
    }
    return porPayorId;
  }, [examesDaFonte]);

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
              {mostrarColunaElegibilidade && (
                <CabecalhoOrdenavel
                  coluna="elegivelDescontoParticular"
                  titulo="Elegível p/ desconto"
                  ordenacao={ordenacao}
                  onClick={alternar}
                  align="right"
                />
              )}
              {podeGerenciar && <th className="px-5 py-3 text-right font-bold w-24">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {linhas.length === 0 ? (
              <tr>
                <td
                  colSpan={8 + (mostrarColunaElegibilidade ? 1 : 0) + (podeGerenciar ? 1 : 0)}
                  className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  {mensagemVazia}
                </td>
              </tr>
            ) : (
              linhas.map(e => {
                const irmaos = (nomesIrmaosPorPayorId.get(e.payorId) ?? []).filter(nome => nome !== e.exame);
                return (
                <tr key={`${e.payorId}-${e.exameId}`} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/[.04] transition-colors">
                  <td className="px-5 py-3.5">
                    {e.exameId === null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                          <FlaskConical className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800 dark:text-gray-100">{e.exame}</div>
                          <div className="text-[11px] text-amber-600 dark:text-amber-400">
                            Nome no convênio · sem exame vinculado
                          </div>
                        </div>
                      </div>
                    ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectExame(e.exameId)}
                        className="flex items-center gap-2 text-left hover:underline"
                      >
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                          <FlaskConical className="w-3.5 h-3.5" />
                        </div>
                        <span>
                          <span className="block font-semibold text-gray-800 dark:text-gray-100">{e.exame}</span>
                          {e.nomeConvenio && e.nomeConvenio !== e.exame && (
                            <span className="block text-[11px] font-normal text-gray-500 dark:text-gray-400">
                              No convênio: {e.nomeConvenio}
                            </span>
                          )}
                        </span>
                      </button>
                      {irmaos.length > 0 && (
                        <span
                          title={`Mesmo TUSS de: ${irmaos.join(', ')}. Atendido/elegibilidade aqui afeta essas linhas também; valor e exclusão são só deste exame.`}
                          className="shrink-0 text-amber-500 dark:text-amber-400"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {podeGerenciar && (
                        <button
                          type="button"
                          onClick={() => onEditExame(e.exameId)}
                          title="Editar exame"
                          className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-500/10 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-500 dark:text-gray-400">{e.tuss}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {e.tabelaAssociada}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="inline-flex items-center gap-1.5">
                      {e.temValorPersonalizado && (
                        <span
                          title={`Valor personalizado pra este exame — o padrão do TUSS (e dos irmãos) é ${formatBRL(e.valorPadraoTuss)}.`}
                          className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400"
                        />
                      )}
                      {formatBRL(e.valorCobrado)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {e.custoLevantado ? (
                      formatBRL(e.custo)
                    ) : (
                      <span className="whitespace-nowrap text-xs font-medium text-amber-600 dark:text-amber-400">
                        {CUSTO_NAO_LEVANTADO}
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-5 py-3.5 text-right tabular-nums font-semibold ${
                      e.custoLevantado && e.dif < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {e.custoLevantado ? formatBRL(e.dif) : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {e.custoLevantado ? formatPct(e.percentualCsp) : '—'}
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
                  {mostrarColunaElegibilidade && (
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => onToggleElegivelDescontoParticular(e.payorId, !e.elegivelDescontoParticular)}
                        disabled={!podeGerenciar}
                        aria-pressed={e.elegivelDescontoParticular}
                        title={
                          podeGerenciar
                            ? e.elegivelDescontoParticular
                              ? 'Elegível para desconto automático — clique para desmarcar'
                              : 'Não elegível para desconto automático — clique para marcar'
                            : 'Somente leitura — requer permissão para gerenciar contas a receber'
                        }
                        className={`ml-auto flex items-center justify-center w-6 h-6 rounded-md border transition-colors ${
                          e.elegivelDescontoParticular
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-transparent border-gray-300 dark:border-gray-600 text-transparent'
                        } ${podeGerenciar ? '' : 'opacity-60 cursor-not-allowed'}`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
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
                );
              })
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
  tabelasAssociadas,
  exams,
  exameExclusions,
  exameValoresPersonalizados,
  updatePayorAtendido,
  updatePayorElegivelDescontoParticular,
  updatePayor,
  createPayor,
  deletePayor,
  excludeExameDaFontePagadora,
  setValorExameDaFontePagadora,
  restaurarValorPadraoExameDaFontePagadora,
  importPayors,
  createTabelaAssociada,
  updateVencimentoTabelaAssociada,
  renameTabelaAssociada,
  setAtivaTabelaAssociada,
  deleteTabelaAssociada,
  updateExam,
}) => {
  const { userProfile } = useAuth();
  const podeGerenciar = hasPermission(userProfile?.permissions || [], 'canManageBilling');
  const { notification, showSuccess, showWarning, showError, hideNotification } = useNotification();
  const { confirmDialog, showConfirmDialog, hideConfirmDialog, handleConfirmDialogConfirm } = useDialog();
  const [termoFonte, setTermoFonte] = useState('');
  const [termoExame, setTermoExame] = useState('');
  // O input mostra termoExame direto (sem delay); só o filtro/render da
  // tabela (potencialmente muitas linhas) usa a versão adiada, pra digitar
  // continuar instantâneo mesmo com a lista grande recalculando por trás.
  const termoExameDiferido = useDeferredValue(termoExame);
  const [fontePagadoraSelecionada, setFontePagadoraSelecionada] = useState<string | null>(null);
  // Tabela associada escolhida no filtro: fixa a fonte dela e restringe a
  // tabela de exames às linhas dessa tabela.
  const [tabelaSelecionada, setTabelaSelecionada] = useState<TabelaAssociada | null>(null);
  const [exameSelecionado, setExameSelecionado] = useState<Exam | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingLinha, setEditingLinha] = useState<LinhaEditavel | null>(null);
  const [creatingNovaLinha, setCreatingNovaLinha] = useState(false);
  const [creatingNovaFontePagadora, setCreatingNovaFontePagadora] = useState(false);
  const [payorFormOpen, setPayorFormOpen] = useState(false);
  const [savingPayor, setSavingPayor] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editingValorExame, setEditingValorExame] = useState<ExameDaFontePagadora | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Exames cobertos pela fonte pagadora selecionada (base pros dois casos em
  // que ela está preenchida: só fonte, ou fonte + exame).
  const examesDaFonte = useMemo(
    () =>
      fontePagadoraSelecionada
        ? examesPorFontePagadora(exams, payors, fontePagadoraSelecionada, exameExclusions, exameValoresPersonalizados)
        : [],
    [exams, payors, fontePagadoraSelecionada, exameExclusions, exameValoresPersonalizados]
  );

  // Filtro livre por nome/TUSS (igual à aba Exames) — não depende de
  // exameSelecionado: digitar "painel" mostra todos os exames da fonte que
  // batem, em vez de exigir escolher um só. Clicar no nome de um exame na
  // tabela (onSelectExame) seta termoExame com o nome exato, então acaba
  // isolando aquele exame pelo mesmo mecanismo, sem precisar de um filtro
  // por id separado.
  const examesDaTabela = useMemo(
    () => (tabelaSelecionada ? examesDaFonte.filter(e => e.tabelaId === tabelaSelecionada.id) : examesDaFonte),
    [examesDaFonte, tabelaSelecionada]
  );

  const examesDaFonteFiltrados = useMemo(
    () =>
      termoExameDiferido.trim()
        ? examesDaTabela.filter(
            e =>
              casaTermo(e.exame, termoExameDiferido) ||
              casaTermo(e.tuss, termoExameDiferido) ||
              (!!e.nomeConvenio && casaTermo(e.nomeConvenio, termoExameDiferido))
          )
        : examesDaTabela,
    [examesDaTabela, termoExameDiferido]
  );

  // Fontes pagadoras do exame selecionado — só relevante quando nenhuma
  // fonte está fixada ainda (senão o caso acima já resolve).
  const fontesDoExame = useMemo(
    () =>
      !fontePagadoraSelecionada && exameSelecionado
        ? fontesPagadorasDoExame(exams, payors, exameSelecionado.id, exameExclusions, exameValoresPersonalizados)
        : [],
    [exams, payors, fontePagadoraSelecionada, exameSelecionado, exameExclusions, exameValoresPersonalizados]
  );

  // Sugestões do campo Fonte Pagadora: se já tem exame fixado, restringe às
  // fontes que efetivamente cobrem aquele exame.
  const sugestoesFonte = useMemo(() => {
    if (fontePagadoraSelecionada) return [];
    const base = exameSelecionado ? payors.filter(p => fontesDoExame.some(f => f.payorId === p.id)) : payors;
    return buscarFontesPagadorasPorTermo(base, termoFonte);
  }, [payors, termoFonte, fontePagadoraSelecionada, exameSelecionado, fontesDoExame]);

  // Sugestões do campo Exame: campo sempre livre (não trava num chip depois
  // de selecionar, ver AutocompleteInput) — continua filtrando pelo texto
  // atual mesmo com um exame já selecionado, pra permitir buscar de novo sem
  // precisar limpar antes. Se já tem fonte fixada, restringe aos exames que
  // aquela fonte realmente cobre. Campo vazio mostra a base inteira (em vez
  // da lista vazia que buscarExamesPorTermo devolve pra termo vazio) porque
  // aqui o campo funciona como combobox de navegação (showAllWhenEmpty),
  // não só autocomplete de formulário.
  const sugestoesExame = useMemo(() => {
    const base = fontePagadoraSelecionada
      ? exams.filter(e => examesDaFonte.some(x => x.tuss === e.tuss))
      : exams;
    return termoExameDiferido.trim() ? buscarExamesPorTermo(base, termoExameDiferido) : base;
  }, [exams, termoExameDiferido, fontePagadoraSelecionada, examesDaFonte]);

  const gruposTabela = useMemo(
    () => gruposParaFiltroDeTabela(tabelasAssociadas, fontePagadoraSelecionada),
    [tabelasAssociadas, fontePagadoraSelecionada]
  );

  const handleSelecionarFonte = (nome: string) => {
    setFontePagadoraSelecionada(nome);
    setTermoFonte('');
    setTabelaSelecionada(null);
  };

  const handleLimparFonte = () => {
    setFontePagadoraSelecionada(null);
    setTermoFonte('');
    setTabelaSelecionada(null);
  };

  // A tabela é de uma fonte só: escolher a tabela já escolhe a fonte dela.
  // null = "Todas as tabelas".
  const handleSelecionarTabela = (tabela: TabelaAssociada | null) => {
    setTabelaSelecionada(tabela);
    if (tabela) {
      setFontePagadoraSelecionada(tabela.fontePagadora);
      setTermoFonte('');
    }
  };

  const handleSelecionarExame = (exame: Exam) => {
    setExameSelecionado(exame);
    setTermoExame(exame.name);
  };

  const handleLimparExame = () => {
    setExameSelecionado(null);
    setTermoExame('');
  };

  // Por id, não por TUSS: um TUSS pode ser compartilhado por vários exames
  // com nomes diferentes (ver examesPorFontePagadora), então resolver pelo
  // id garante que a linha clicada seleciona/edita o exame certo, não
  // qualquer um que bata o TUSS.
  const handleSelecionarExamePorId = (exameId: string) => {
    const exame = exams.find(e => e.id === exameId);
    if (!exame) return;
    handleSelecionarExame(exame);
  };

  const handleEditExame = (exameId: string) => {
    const exame = exams.find(e => e.id === exameId);
    if (!exame) return;
    setEditingExam(exame);
  };

  const handleSaveExame = async (data: Omit<Exam, 'id'>) => {
    if (!editingExam) return;
    try {
      await updateExam(editingExam.id, data);
      showSuccess('Exame atualizado com sucesso!');
      setEditingExam(null);
    } catch (err) {
      showError('Erro ao atualizar exame', err instanceof Error ? err.message : undefined);
    }
  };

  const handleToggleAtendido = (payorId: string, atendido: boolean) => {
    updatePayorAtendido(payorId, atendido).catch(err => {
      console.error('Falha ao atualizar Atendido da fonte pagadora', err);
      showError('Erro ao atualizar Atendido', err instanceof Error ? err.message : undefined);
    });
  };

  const handleToggleElegivelDescontoParticular = (payorId: string, elegivel: boolean) => {
    updatePayorElegivelDescontoParticular(payorId, elegivel).catch(err => {
      console.error('Falha ao atualizar elegibilidade de desconto particular', err);
      showError('Erro ao atualizar elegibilidade de desconto', err instanceof Error ? err.message : undefined);
    });
  };

  const handleEditLinha = (item: LinhaEditavel) => {
    setEditingLinha(item);
    setPayorFormOpen(true);
  };

  // Com irmãos (mesmo TUSS compartilhado por mais de um exame), editar aqui
  // não pode mexer direto no valor padrão da linha de custo_fontes_pagadoras
  // (isso mudaria o preço de todos os irmãos junto) — abre o modal de valor
  // personalizado por exame em vez do PayorFormModal. Sem irmãos, não há
  // ambiguidade: edita a linha inteira (fonte/tabela/TUSS/valor) normalmente.
  const handleEditExameDaFonte = (item: ExameDaFontePagadora) => {
    if (irmaosNaLinha(exams, payors, item, exameExclusions).length > 0) {
      setEditingValorExame(item);
      return;
    }
    // item.exameId é o exame exibido NESTA linha — não necessariamente o
    // exameId gravado no registro de custo_fontes_pagadoras (null numa linha
    // geral do TUSS). O que vai pro modal é o do Payor (`payors`), não o do
    // item de exibição.
    const fonte = payors.find(p => p.id === item.payorId);
    handleEditLinha({
      payorId: item.payorId,
      payor: item.fontePagadora,
      table: item.tabelaAssociada,
      tabelaId: fonte?.tabelaId ?? null,
      tus: item.tuss,
      price: item.valorCobrado,
      exameId: fonte?.exameId ?? null,
      nomeConvenio: fonte?.nomeConvenio ?? null,
    });
  };

  const tabelasDaFonteSelecionada = useMemo(
    () => (fontePagadoraSelecionada ? tabelasDaFonte(tabelasAssociadas, fontePagadoraSelecionada) : []),
    [tabelasAssociadas, fontePagadoraSelecionada]
  );

  const handleSalvarVencimento = async (tabela: TabelaAssociada, vencimento: string | null): Promise<boolean> => {
    try {
      await updateVencimentoTabelaAssociada(tabela.id, vencimento);
      showSuccess('Vencimento atualizado com sucesso!');
      return true;
    } catch (err) {
      showError('Erro ao atualizar vencimento', err instanceof Error ? err.message : undefined);
      return false;
    }
  };

  const linhasPorTabela = useMemo(() => contarLinhasPorTabela(payors), [payors]);

  const handleCriarTabela = async (nome: string, vencimento: string | null): Promise<boolean> => {
    if (!fontePagadoraSelecionada) return false;
    try {
      await createTabelaAssociada(
        fonteDaNovaTabela(tabelasDaFonteSelecionada, fontePagadoraSelecionada),
        nome,
        vencimento
      );
      showSuccess('Tabela criada com sucesso!');
      return true;
    } catch (err) {
      showError('Erro ao criar tabela', err instanceof Error ? err.message : undefined);
      return false;
    }
  };

  const handleRenomearTabela = async (tabela: TabelaAssociada, nome: string): Promise<boolean> => {
    try {
      await renameTabelaAssociada(tabela.id, nome);
      showSuccess('Tabela renomeada com sucesso!');
      return true;
    } catch (err) {
      showError('Erro ao renomear tabela', err instanceof Error ? err.message : undefined);
      return false;
    }
  };

  const handleAlternarAtivaTabela = async (tabela: TabelaAssociada) => {
    try {
      await setAtivaTabelaAssociada(tabela.id, !tabela.ativa);
      showSuccess(tabela.ativa ? 'Tabela desativada.' : 'Tabela reativada.');
    } catch (err) {
      showError(tabela.ativa ? 'Erro ao desativar tabela' : 'Erro ao reativar tabela', err instanceof Error ? err.message : undefined);
    }
  };

  const handleExcluirTabela = (tabela: TabelaAssociada) => {
    showConfirmDialog(
      'Excluir tabela',
      `Tem certeza que deseja excluir a tabela "${tabela.nome || '(sem nome)'}" da fonte ${tabela.fontePagadora}? Esta ação não pode ser desfeita.`,
      async () => {
        try {
          await deleteTabelaAssociada(tabela.id);
          showSuccess('Tabela excluída com sucesso!');
        } catch (err) {
          showError('Erro ao excluir tabela', err instanceof Error ? err.message : undefined);
        }
      },
      { type: 'danger', confirmText: 'Excluir' }
    );
  };

  const handleSaveValorExame = async (valor: number) => {
    if (!editingValorExame) return;
    try {
      await setValorExameDaFontePagadora(editingValorExame.payorId, editingValorExame.exameId, valor);
      showSuccess('Valor deste exame atualizado com sucesso!');
      setEditingValorExame(null);
    } catch (err) {
      showError('Erro ao atualizar valor do exame', err instanceof Error ? err.message : undefined);
    }
  };

  const handleRestaurarValorPadraoExame = async () => {
    if (!editingValorExame) return;
    try {
      await restaurarValorPadraoExameDaFontePagadora(editingValorExame.payorId, editingValorExame.exameId);
      showSuccess('Valor restaurado ao padrão do TUSS!');
      setEditingValorExame(null);
    } catch (err) {
      showError('Erro ao restaurar valor padrão', err instanceof Error ? err.message : undefined);
    }
  };

  const handleNovaLinha = () => {
    setCreatingNovaLinha(true);
    setPayorFormOpen(true);
  };

  const handleNovaFontePagadora = () => {
    setCreatingNovaFontePagadora(true);
    setPayorFormOpen(true);
  };

  // Memorizado: o modal reinicia o formulário quando `payor` muda, e um objeto
  // novo a cada render apagava o que foi digitado sempre que a tela
  // re-renderizava — ex.: ao criar uma tabela pelo "+ Nova tabela".
  const payorDoFormulario = useMemo<PayorEditData | null>(
    () =>
      editingLinha
        ? {
            payor: editingLinha.payor,
            table: editingLinha.table,
            tabelaId: editingLinha.tabelaId,
            tus: editingLinha.tus,
            price: editingLinha.price,
            exameId: editingLinha.exameId,
          }
        : creatingNovaLinha
        ? { payor: fontePagadoraSelecionada ?? '', table: '', tabelaId: null, tus: '', price: 0, exameId: null }
        : creatingNovaFontePagadora
        ? { payor: '', table: '', tabelaId: null, tus: '', price: 0, exameId: null }
        : null,
    [editingLinha, creatingNovaLinha, creatingNovaFontePagadora, fontePagadoraSelecionada]
  );

  const handleCloseFormModal = () => {
    if (savingPayor) return;
    setPayorFormOpen(false);
    setEditingLinha(null);
    setCreatingNovaLinha(false);
    setCreatingNovaFontePagadora(false);
  };

  const handleSavePayorEdit = async (data: PayorEditData) => {
    if (savingPayor) return;
    setSavingPayor(true);
    try {
      // Escolher um exame só numa linha geral de TUSS compartilhado grava
      // uma linha de exame nova — a geral segue valendo pros irmãos.
      const separaDaGeral = !!editingLinha && edicaoSeparaDaLinhaGeral(editingLinha, data, exams);
      if (editingLinha && !separaDaGeral) {
        await updatePayor(editingLinha.payorId, data);
      } else {
        await createPayor(data);
        if (creatingNovaFontePagadora) {
          handleSelecionarFonte(data.payor);
        }
      }

      // examesPorFontePagadora casa a linha pelo exameId (linha de exame) ou
      // pelo TUSS (linha geral) — em ambos os casos, se o alvo não existir
      // mais em Exames, a linha é gravada mas não aparece em nenhuma tabela
      // até isso ser corrigido. Linha não levantada aparece sempre.
      const linhaVaiAparecer = data.exameId
        ? exams.some(e => e.id === data.exameId)
        : !!editingLinha?.nomeConvenio || exams.some(e => e.tuss === data.tus);
      if (linhaVaiAparecer) {
        showSuccess(editingLinha ? 'Fonte pagadora atualizada com sucesso!' : 'Linha criada com sucesso!');
      } else {
        showWarning(
          editingLinha ? 'Fonte pagadora atualizada' : 'Linha criada',
          !data.exameId
            ? `TUSS "${data.tus}" não está cadastrado na aba Exames — a linha foi salva, mas não vai aparecer aqui até um exame com esse TUSS existir.`
            : 'O exame vinculado não foi encontrado na aba Exames — a linha foi salva, mas não vai aparecer aqui até isso ser corrigido.'
        );
      }
      setSavingPayor(false);
      handleCloseFormModal();
    } catch (err) {
      setSavingPayor(false);
      showError(
        editingLinha ? 'Erro ao atualizar fonte pagadora' : 'Erro ao criar linha',
        err instanceof Error ? err.message : undefined
      );
    }
  };

  const handleDeleteLinha = (payorId: string, descricao: string) => {
    showConfirmDialog(
      'Excluir linha',
      `Tem certeza que deseja excluir a linha de "${descricao}"? Esta ação não pode ser desfeita.`,
      async () => {
        try {
          await deletePayor(payorId);
          showSuccess('Linha excluída com sucesso!');
        } catch (err) {
          showError('Erro ao excluir linha', err instanceof Error ? err.message : undefined);
        }
      },
      { type: 'danger', confirmText: 'Excluir' }
    );
  };

  const handleDeleteExameDaFonte = (item: ExameDaFontePagadora) => {
    // Um TUSS pode ser compartilhado por exames com nomes diferentes (ver
    // examesPorFontePagadora) — nesse caso várias linhas exibidas têm o
    // MESMO payorId (é o mesmo registro de custo_fontes_pagadoras). Nesse
    // caso, excluir marca só ESTE exame como não oferecido por essa fonte
    // pagadora (custo_fontes_pagadoras_exclusoes) — o preço e os exames
    // irmãos continuam intactos. Sem irmãos, não há preço compartilhado pra
    // preservar, então exclui a linha de preço de verdade.
    const irmaos = irmaosNaLinha(exams, payors, item, exameExclusions);

    if (irmaos.length > 0) {
      showConfirmDialog(
        'Excluir exame desta fonte pagadora',
        `Tem certeza que deseja excluir "${item.exame}" (TUSS ${item.tuss}) desta fonte pagadora? O preço continua valendo para ${irmaos.map(i => `"${i.exame}"`).join(', ')}, que compartilha${irmaos.length > 1 ? 'm' : ''} o mesmo TUSS.`,
        async () => {
          try {
            await excludeExameDaFontePagadora(item.payorId, item.exameId);
            showSuccess('Exame excluído desta fonte pagadora!');
          } catch (err) {
            showError('Erro ao excluir exame', err instanceof Error ? err.message : undefined);
          }
        },
        { type: 'danger', confirmText: 'Excluir' }
      );
      return;
    }

    handleDeleteLinha(item.payorId, `${item.exame} (TUSS ${item.tuss})`);
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
        gerarArquivoExportacao(linhasExportacaoExamesDaFonte(examesDaFonteFiltrados, tabelasAssociadas), 'Exames', formato);
        return;
      }

      if (exameSelecionado) {
        if (fontesDoExame.length === 0) {
          showError('Nada para exportar', 'Nenhuma fonte pagadora cadastrada para este exame.');
          return;
        }
        gerarArquivoExportacao(linhasExportacaoFontesDoExame(fontesDoExame, tabelasAssociadas), 'Fontes Pagadoras', formato);
        return;
      }

      setExportando(true);
      const todas = await buscarTodasFontesPagadoras();
      if (todas.length === 0) {
        showError('Nada para exportar', 'Nenhuma fonte pagadora cadastrada.');
        return;
      }
      gerarArquivoExportacao(linhasExportacaoFontesPagadoras(todas, tabelasAssociadas), 'Fontes Pagadoras', formato);
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

          <FiltroTabelaAssociada
            grupos={gruposTabela}
            selecionada={tabelaSelecionada}
            onSelecionar={handleSelecionarTabela}
          />

          <div className="flex-1 min-w-0">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Exame</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
              <AutocompleteInput
                value={termoExame}
                onValueChange={setTermoExame}
                onSelect={handleSelecionarExame}
                suggestions={sugestoesExame}
                renderSuggestion={exame => (
                  <>
                    <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{exame.name}</span>
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400 shrink-0">{exame.tuss}</span>
                  </>
                )}
                keyOf={exame => exame.id}
                emptyLabel="Nenhum exame encontrado."
                placeholder="Buscar exame ou código TUSS…"
                className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                showAllWhenEmpty
              />
              {termoExame.trim().length > 0 && (
                <button
                  type="button"
                  onClick={handleLimparExame}
                  aria-label="Limpar Exame"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {mostrarConvite && (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30 p-10 text-center text-sm text-gray-500 dark:text-gray-400">
          Preencha ao menos um dos campos — fonte pagadora, tabela associada ou exame — pra ver os dados.
        </div>
      )}

      {fontePagadoraSelecionada && (
        <TabelasDaFonte
          key={`tabelas-${fontePagadoraSelecionada}`}
          tabelas={tabelasDaFonteSelecionada}
          linhasPorTabela={linhasPorTabela}
          podeGerenciar={podeGerenciar}
          onCriar={handleCriarTabela}
          onSalvarVencimento={handleSalvarVencimento}
          onRenomear={handleRenomearTabela}
          onAlternarAtiva={handleAlternarAtivaTabela}
          onExcluir={handleExcluirTabela}
        />
      )}

      {fontePagadoraSelecionada && (
        <TabelaExamesDaFonte
          key={fontePagadoraSelecionada}
          examesDaFonte={examesDaFonteFiltrados}
          onSelectExame={handleSelecionarExamePorId}
          onEditExame={handleEditExame}
          onToggleAtendido={handleToggleAtendido}
          onToggleElegivelDescontoParticular={handleToggleElegivelDescontoParticular}
          mostrarColunaElegibilidade={fontePagadoraSelecionada === FONTE_PARTICULAR}
          onEditLinha={handleEditExameDaFonte}
          onDeleteLinha={handleDeleteExameDaFonte}
          onNovaLinha={handleNovaLinha}
          podeGerenciar={podeGerenciar}
          mensagemVazia={
            termoExameDiferido.trim()
              ? 'Nenhum exame desta fonte pagadora bate com essa busca.'
              : tabelaSelecionada
              ? 'Nenhum exame cadastrado nesta tabela associada.'
              : 'Nenhum exame cadastrado para esta fonte pagadora.'
          }
        />
      )}

      {!fontePagadoraSelecionada && exameSelecionado && (
        <TabelaFontesPagadoras
          key={exameSelecionado.id}
          fontesPagadoras={fontesDoExame}
          custo={exameSelecionado.direct + exameSelecionado.indirect}
          onSelectFontePagadora={handleSelecionarFonte}
          onToggleAtendido={handleToggleAtendido}
          onEditLinha={handleEditExameDaFonte}
          onDeleteLinha={handleDeleteExameDaFonte}
          podeGerenciar={podeGerenciar}
        />
      )}

      {podeGerenciar && (
        <PayorImportModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          payors={payors}
          exams={exams}
          tabelasAssociadas={tabelasAssociadas}
          onCriarTabela={createTabelaAssociada}
          onImport={importPayors}
        />
      )}

      {podeGerenciar && (
        <PayorFormModal
          open={payorFormOpen}
          mode={editingLinha ? 'edit' : 'create'}
          exams={exams}
          payors={payors}
          tabelasAssociadas={tabelasAssociadas}
          onCriarTabela={createTabelaAssociada}
          editingPayorId={editingLinha?.payorId}
          payor={payorDoFormulario}
          onClose={handleCloseFormModal}
          onSave={handleSavePayorEdit}
          saving={savingPayor}
        />
      )}

      {podeGerenciar && (
        <ExamFormModal
          open={editingExam !== null}
          exam={editingExam}
          onClose={() => setEditingExam(null)}
          onSave={handleSaveExame}
        />
      )}

      {podeGerenciar && (
        <ValorExameFormModal
          open={editingValorExame !== null}
          item={editingValorExame}
          onClose={() => setEditingValorExame(null)}
          onSave={handleSaveValorExame}
          onRestaurarPadrao={handleRestaurarValorPadraoExame}
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
