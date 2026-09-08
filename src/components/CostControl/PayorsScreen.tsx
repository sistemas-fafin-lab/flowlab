import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Building2, FlaskConical, Lock, Search, X } from 'lucide-react';
import { Exam, Payor, formatBRL } from '../../hooks/useCostControl';
import { buscarUnificado, examesPorFontePagadora, fontesPagadorasPorTuss, type ExameDaFontePagadora } from './domain/busca';
import { ORDENACAO_PADRAO, alternarOrdenacao, ordenar, type EstadoOrdenacao } from './domain/ordenacao';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PayorsScreenProps {
  payors: Payor[];
  exams: Exam[];
}

type Selecao =
  | { tipo: 'exame'; exame: Exam }
  | { tipo: 'fontePagadora'; nome: string };

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

type ColunaExameDaFonte = 'exame' | 'tuss' | 'tabelaAssociada' | 'valorCobrado';

const VALOR_COLUNA_EXAME_DA_FONTE: Record<ColunaExameDaFonte, (item: ExameDaFontePagadora) => string | number> = {
  exame: item => item.exame,
  tuss: item => item.tuss,
  tabelaAssociada: item => item.tabelaAssociada,
  valorCobrado: item => item.valorCobrado,
};

function TabelaExamesDaFonte({
  examesDaFonte,
  onSelectExame,
}: {
  examesDaFonte: ExameDaFontePagadora[];
  onSelectExame: (tuss: string) => void;
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
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-gray-900/40 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <tr>
              <CabecalhoOrdenavel coluna="exame" titulo="Exame" ordenacao={ordenacao} onClick={alternar} />
              <CabecalhoOrdenavel coluna="tuss" titulo="TUSS" ordenacao={ordenacao} onClick={alternar} />
              <CabecalhoOrdenavel coluna="tabelaAssociada" titulo="Tabela Associada" ordenacao={ordenacao} onClick={alternar} />
              <CabecalhoOrdenavel coluna="valorCobrado" titulo="Valor Cobrado" ordenacao={ordenacao} onClick={alternar} align="right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  Nenhum exame cadastrado para esta fonte pagadora.
                </td>
              </tr>
            ) : (
              linhas.map(e => (
                <tr key={`${e.tuss}-${e.tabelaAssociada}`} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/[.04] transition-colors">
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
          <Lock className="w-3 h-3" />
          Dados somente leitura — espelhados do APLIS
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const PayorsScreen: React.FC<PayorsScreenProps> = ({ payors, exams }) => {
  const [search, setSearch] = useState('');
  const [selecao, setSelecao] = useState<Selecao | null>(null);

  const termoDigitado = search.trim().length > 0;

  const resultado = useMemo(
    () => (selecao ? { exames: [], fontesPagadoras: [] } : buscarUnificado(exams, payors, search)),
    [exams, payors, search, selecao]
  );

  const totalMatches = resultado.exames.length + resultado.fontesPagadoras.length;

  const fontesPagadoras = useMemo(
    () =>
      selecao?.tipo === 'exame'
        ? fontesPagadorasPorTuss(payors, selecao.exame.tuss)
        : [],
    [payors, selecao]
  );

  const examesDaFonte = useMemo(
    () =>
      selecao?.tipo === 'fontePagadora'
        ? examesPorFontePagadora(exams, payors, selecao.nome)
        : [],
    [exams, payors, selecao]
  );

  const handleSelectExam = (exame: Exam) => {
    setSelecao({ tipo: 'exame', exame });
    setSearch('');
  };

  const handleSelectFontePagadora = (nome: string) => {
    setSelecao({ tipo: 'fontePagadora', nome });
    setSearch('');
  };

  const handleSelectExameByTuss = (tuss: string) => {
    // TUSS pode se repetir entre exames (sem examId confiável vindo do
    // APLIS) — mesma regra de "último vence" usada em examesPorFontePagadora,
    // pra bater com o exame que a tabela de origem realmente mostrou.
    const exame = exams.reduce<Exam | undefined>(
      (ultimo, atual) => (atual.tuss === tuss ? atual : ultimo),
      undefined,
    );
    if (!exame) return;
    handleSelectExam(exame);
  };

  const handleClear = () => {
    setSelecao(null);
    setSearch('');
  };

  const mostrarDropdown = !selecao && termoDigitado && totalMatches >= 1;
  const mostrarNenhumEncontrado = !selecao && termoDigitado && totalMatches === 0;
  const mostrarConvite = !selecao && !termoDigitado;

  return (
    <div className="space-y-5">
      {/* Header + search */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Fontes Pagadoras</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Busque por exame, código TUSS ou fonte pagadora para ver os valores cobrados.
          </p>
        </div>

        <div className="mt-5 relative">
          {selecao ? (
            <div className="flex items-center gap-2 pl-9 pr-2 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
              <span className="flex-1 min-w-0 text-sm font-medium text-blue-700 dark:text-blue-300 truncate">
                <span className="text-blue-500 dark:text-blue-400">
                  {selecao.tipo === 'exame' ? 'Exame: ' : 'Fonte Pagadora: '}
                </span>
                {selecao.tipo === 'exame' ? (
                  <>
                    {selecao.exame.name}
                    <span className="ml-2 font-mono text-xs text-blue-500 dark:text-blue-400">
                      {selecao.exame.tuss}
                    </span>
                  </>
                ) : (
                  selecao.nome
                )}
              </span>
              <button
                type="button"
                onClick={handleClear}
                aria-label="Limpar seleção"
                className="shrink-0 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por exame, código TUSS ou fonte pagadora…"
                autoComplete="on"
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              />
              {mostrarDropdown && (
                <ul className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-64 overflow-y-auto">
                  {resultado.exames.length > 0 && (
                    <>
                      <li className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-slate-50 dark:bg-gray-900/40">
                        Exames
                      </li>
                      {resultado.exames.map(exame => (
                        <li key={exame.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectExam(exame)}
                            className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                          >
                            <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{exame.name}</span>
                            <span className="font-mono text-xs text-gray-500 dark:text-gray-400 shrink-0">{exame.tuss}</span>
                          </button>
                        </li>
                      ))}
                    </>
                  )}
                  {resultado.fontesPagadoras.length > 0 && (
                    <>
                      <li className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-slate-50 dark:bg-gray-900/40">
                        Fontes Pagadoras
                      </li>
                      {resultado.fontesPagadoras.map(nome => (
                        <li key={nome}>
                          <button
                            type="button"
                            onClick={() => handleSelectFontePagadora(nome)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                          >
                            <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{nome}</span>
                          </button>
                        </li>
                      ))}
                    </>
                  )}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {mostrarConvite && (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30 p-10 text-center text-sm text-gray-500 dark:text-gray-400">
          Pesquise por um exame, código TUSS ou fonte pagadora para ver os dados.
        </div>
      )}

      {mostrarNenhumEncontrado && (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30 p-10 text-center text-sm text-gray-500 dark:text-gray-400">
          Nenhum resultado encontrado.
        </div>
      )}

      {selecao?.tipo === 'exame' && (
        <TabelaFontesPagadoras
          key={selecao.exame.tuss}
          fontesPagadoras={fontesPagadoras}
          onSelectFontePagadora={handleSelectFontePagadora}
        />
      )}

      {selecao?.tipo === 'fontePagadora' && (
        <TabelaExamesDaFonte
          key={selecao.nome}
          examesDaFonte={examesDaFonte}
          onSelectExame={handleSelectExameByTuss}
        />
      )}
    </div>
  );
};

export default PayorsScreen;
