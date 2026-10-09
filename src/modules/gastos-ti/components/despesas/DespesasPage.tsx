import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { ArrowDown, ArrowUp, Download, FileSpreadsheet, Plus, Receipt, Search, Tags, X } from 'lucide-react';
import { useTheme } from '../../../../hooks/useTheme';
import { formatCurrency } from '../../../../utils/paymentUtils';
import { dayKey } from '../../../../utils/datas';
import { DEPARTMENTS } from '../../../../utils/permissions';
import { FORMAS_PAGAMENTO, RECORRENCIAS, RECORRENCIA_ROTULO, SITUACAO_DESPESA } from '../../constants';
import { formatarCompetencia } from '../../domain/competencia';
import { corDoSlot, slotsDeCor } from '../../domain/coresCategorias';
import { linhasExportacaoDespesas } from '../../domain/exportacao';
import { PREFIXO_CATEGORIA_NOVA } from '../../domain/importacao';
import {
  FILTROS_VAZIOS,
  custoRecorrenteMensal,
  filtrarLinhas,
  montarLinhas,
  nomesDistintos,
  ordenarLinhas,
  type ColunaOrdenacao,
  type DirecaoOrdenacao,
  type FiltrosDespesas,
} from '../../domain/listaDespesas';
import { useCanManageGastosTI } from '../../hooks/useCanManageGastosTI';
import { useCategoriasTI } from '../../hooks/useCategoriasTI';
import { useDespesasTI } from '../../hooks/useDespesasTI';
import { useFornecedoresTI } from '../../hooks/useFornecedoresTI';
import { useResponsaveisTI } from '../../hooks/useResponsaveisTI';
import type { Despesa, DespesaInput } from '../../types';
import GastosTIShell from '../GastosTIShell';
import CategoriasModal from '../categorias/CategoriasModal';
import DespesaFormModal from './DespesaFormModal';
import DespesaPainel from './DespesaPainel';
import EncerramentoModal from './EncerramentoModal';
import ExcluirDespesaModal from './ExcluirDespesaModal';
import ImportarDespesasModal from './ImportarDespesasModal';
import ReajusteModal from './ReajusteModal';

const VIDRO = 'bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/50 dark:border-slate-700/50 shadow-sm';
const classeFiltro =
  'w-full border border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30 rounded-xl px-3 py-2';

const formatarData = (iso: string): string => {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
};

/** Despesa sendo editada no formulário: 'nova' ou a própria despesa. */
type EmEdicao = 'nova' | Despesa | null;

const DespesasPage: React.FC = () => {
  const podeGerenciar = useCanManageGastosTI();
  const { theme } = useTheme();
  const categoriasTI = useCategoriasTI();
  const {
    despesas,
    loading,
    error,
    refetch,
    criarDespesa,
    atualizarDespesa,
    registrarReajuste,
    removerReajuste,
    definirFim,
    excluirDespesa,
    importarDespesas,
    adicionarAnexos,
    removerAnexo,
  } = useDespesasTI();
  const { fornecedores, criarFornecedorRapido } = useFornecedoresTI();
  const { responsaveis } = useResponsaveisTI();

  const [categoriasAberto, setCategoriasAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<EmEdicao>(null);
  // Painel guarda só o id: depois de reajustar/encerrar, a despesa vem nova do refetch.
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [acaoPainel, setAcaoPainel] = useState<'reajustar' | 'encerrar' | 'excluir' | null>(null);
  /** Aviso fora do formulário: a despesa gravou, mas algum anexo não subiu. */
  const [aviso, setAviso] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [importarAberto, setImportarAberto] = useState(false);
  const [buscaDigitada, setBuscaDigitada] = useState('');
  const [filtros, setFiltros] = useState<FiltrosDespesas>(FILTROS_VAZIOS);
  const [ordenacao, setOrdenacao] = useState<{ coluna: ColunaOrdenacao; direcao: DirecaoOrdenacao }>({
    coluna: 'descricao',
    direcao: 'asc',
  });

  // Debounce de 350 ms na busca (mesmo padrão de TitulosList.tsx): filtrar a cada tecla
  // recalcularia a lista inteira enquanto a pessoa ainda está digitando.
  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => (f.busca === buscaDigitada ? f : { ...f, busca: buscaDigitada })), 350);
    return () => clearTimeout(t);
  }, [buscaDigitada]);

  const hoje = dayKey(new Date());
  const categoriaPorId = useMemo(() => new Map(categoriasTI.categorias.map((c) => [c.id, c])), [categoriasTI.categorias]);
  const slots = useMemo(() => slotsDeCor(categoriasTI.categorias), [categoriasTI.categorias]);
  const linhas = useMemo(() => montarLinhas(despesas, hoje), [despesas, hoje]);
  const visiveis = useMemo(
    () =>
      ordenarLinhas(
        filtrarLinhas(linhas, filtros),
        ordenacao.coluna,
        ordenacao.direcao,
        (id) => categoriaPorId.get(id)?.nome ?? '',
      ),
    [linhas, filtros, ordenacao, categoriaPorId],
  );

  const autorizadores = useMemo(() => nomesDistintos(despesas.map((d) => d.autorizadoPor)), [despesas]);
  const nomesFornecedores = useMemo(() => nomesDistintos(despesas.map((d) => d.fornecedorNome)), [despesas]);
  const custoRecorrente = useMemo(() => custoRecorrenteMensal(visiveis), [visiveis]);
  const temFiltro = buscaDigitada.trim() !== '' || Object.entries(filtros).some(([k, v]) => k !== 'busca' && v !== '');

  const fecharCategorias = useCallback(() => setCategoriasAberto(false), []);
  const fecharFormulario = useCallback(() => setEmEdicao(null), []);
  const fecharPainel = useCallback(() => setSelecionadaId(null), []);
  const fecharAcao = useCallback(() => setAcaoPainel(null), []);

  const linhaSelecionada = selecionadaId ? linhas.find((l) => l.despesa.id === selecionadaId) ?? null : null;
  const nomeUsuario = useMemo(() => new Map(responsaveis.map((r) => [r.id, r.nome])), [responsaveis]);
  const contextoAuditoria = useMemo(
    () => ({
      nomeCategoria: (id: string) => categoriaPorId.get(id)?.nome,
      nomeUsuario: (id: string) => nomeUsuario.get(id),
    }),
    [categoriaPorId, nomeUsuario],
  );

  const definirFiltro = <K extends keyof FiltrosDespesas>(chave: K, valor: FiltrosDespesas[K]) =>
    setFiltros((f) => ({ ...f, [chave]: valor }));

  const limparFiltros = () => {
    setBuscaDigitada('');
    setFiltros(FILTROS_VAZIOS);
  };

  const alternarOrdenacao = (coluna: ColunaOrdenacao) =>
    setOrdenacao((atual) =>
      atual.coluna === coluna
        ? { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
        : // Valores começam do maior: é o que se quer ver primeiro num controle de gastos.
          { coluna, direcao: coluna === 'valor' || coluna === 'equivalente' ? 'desc' : 'asc' },
    );

  // Função que devolve JSX, não componente: um componente declarado aqui dentro
  // seria um tipo novo a cada render e remontaria o cabeçalho (perdendo o foco
  // do botão logo depois de ordenar).
  const cabecalho = (coluna: ColunaOrdenacao, rotulo: string, direita = false) => {
    const ativa = ordenacao.coluna === coluna;
    const Seta = ordenacao.direcao === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th
        scope="col"
        aria-sort={ativa ? (ordenacao.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`px-3 py-2.5 font-semibold ${direita ? 'text-right' : 'text-left'}`}
      >
        <button
          type="button"
          onClick={() => alternarOrdenacao(coluna)}
          className={`inline-flex items-center gap-1 hover:text-violet-700 dark:hover:text-violet-300 ${ativa ? 'text-violet-700 dark:text-violet-300' : ''}`}
        >
          {rotulo}
          {ativa && <Seta className="w-3 h-3" />}
        </button>
      </th>
    );
  };

  /**
   * Importação (issue 09): cria antes as categorias novas, troca o marcador
   * das linhas pelo id real e grava tudo numa inserção só. Se a inserção
   * falhar, as categorias criadas ficam (vazias e reaproveitáveis) — a
   * mensagem diz isso.
   */
  const importar = async (inputs: DespesaInput[], categoriasNovas: string[]): Promise<string | null> => {
    let idPorChave = new Map<string, string>();
    if (categoriasNovas.length > 0) {
      const criadas = await categoriasTI.criarCategoriasEmLote(categoriasNovas);
      if (criadas.ok === false) return criadas.erro;
      idPorChave = criadas.idPorChave;
    }
    const prontas = inputs.map((d) =>
      d.categoriaId.startsWith(PREFIXO_CATEGORIA_NOVA)
        ? { ...d, categoriaId: idPorChave.get(d.categoriaId.slice(PREFIXO_CATEGORIA_NOVA.length)) ?? '' }
        : d,
    );
    const erro = await importarDespesas(prontas);
    if (erro) {
      return categoriasNovas.length > 0
        ? `${erro} As categorias novas (${categoriasNovas.join(', ')}) já foram criadas e podem ser reaproveitadas.`
        : erro;
    }
    setSucesso(`${prontas.length} ${prontas.length === 1 ? 'despesa importada' : 'despesas importadas'}.`);
    return null;
  };

  const exportar = () => {
    const cnpj = new Map(fornecedores.map((f) => [f.id, f.cnpj]));
    const livro = XLSX.utils.book_new();
    const aba = XLSX.utils.aoa_to_sheet(
      linhasExportacaoDespesas(visiveis, (id) => categoriaPorId.get(id)?.nome ?? '', (id) => cnpj.get(id) ?? null),
    );
    aba['!cols'] = Array.from({ length: 24 }, (_, i) => ({ wch: i === 0 ? 36 : 18 }));
    XLSX.utils.book_append_sheet(livro, aba, 'Despesas');
    XLSX.writeFile(livro, `gastos_ti_despesas_${hoje}.xlsx`);
  };

  /**
   * Grava a despesa e só então sobe os anexos. Se um anexo falhar, a despesa
   * já existe: o formulário fecha (salvar de novo duplicaria a despesa) e o
   * aviso fica na página, mandando anexar pelo painel.
   */
  const salvarDespesa = async (input: Parameters<typeof criarDespesa>[0], arquivos: File[]): Promise<string | null> => {
    let id: string;
    if (emEdicao && emEdicao !== 'nova') {
      const erro = await atualizarDespesa(emEdicao.id, input);
      if (erro) return erro;
      id = emEdicao.id;
    } else {
      const resultado = await criarDespesa(input);
      if (resultado.ok === false) return resultado.erro;
      id = resultado.id;
    }
    if (arquivos.length > 0) {
      const erroAnexos = await adicionarAnexos(id, arquivos);
      if (erroAnexos) setAviso(`A despesa foi salva, mas nem todos os anexos subiram: ${erroAnexos} Anexe de novo pelo painel da despesa.`);
    }
    return null;
  };

  return (
    <GastosTIShell
      subtitulo="Despesas, recorrências e quem autorizou"
      acoes={
        <>
          <button
            type="button"
            onClick={() => setCategoriasAberto(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
          >
            <Tags className="w-4 h-4" />
            Categorias
          </button>
          <button
            type="button"
            onClick={exportar}
            disabled={visiveis.length === 0}
            title="Exporta a lista com os filtros aplicados, no formato do modelo de importação"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 hover:text-violet-700 dark:hover:text-violet-300 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
          {podeGerenciar && (
            <button
              type="button"
              onClick={() => setImportarAberto(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Importar
            </button>
          )}
          {podeGerenciar && (
            <button
              type="button"
              onClick={() => setEmEdicao('nova')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-500/25 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova despesa
            </button>
          )}
        </>
      }
    >
      {sucesso && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200"
        >
          <p>{sucesso}</p>
          <button type="button" onClick={() => setSucesso(null)} aria-label="Fechar mensagem" className="flex-shrink-0 p-0.5 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {aviso && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
        >
          <p>{aviso}</p>
          <button type="button" onClick={() => setAviso(null)} aria-label="Fechar aviso" className="flex-shrink-0 p-0.5 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className={`${VIDRO} rounded-3xl p-4 space-y-3 animate-fade-in-up`} style={{ animationDelay: '0.15s' }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              aria-label="Buscar despesas"
              value={buscaDigitada}
              onChange={(e) => setBuscaDigitada(e.target.value)}
              placeholder="Buscar por descrição, fornecedor, contrato ou quem autorizou"
              className={`${classeFiltro} pl-9`}
            />
          </div>
          {temFiltro && (
            <button
              type="button"
              onClick={limparFiltros}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" /> Limpar filtros
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
          <select aria-label="Categoria" value={filtros.categoriaId} onChange={(e) => definirFiltro('categoriaId', e.target.value)} className={classeFiltro}>
            <option value="">Todas as categorias</option>
            {categoriasTI.categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <select aria-label="Situação" value={filtros.situacao} onChange={(e) => definirFiltro('situacao', e.target.value as FiltrosDespesas['situacao'])} className={classeFiltro}>
            <option value="">Todas as situações</option>
            {Object.entries(SITUACAO_DESPESA).map(([valor, s]) => (
              <option key={valor} value={valor}>
                {s.rotulo}
              </option>
            ))}
          </select>
          <select aria-label="Recorrência" value={filtros.recorrencia} onChange={(e) => definirFiltro('recorrencia', e.target.value as FiltrosDespesas['recorrencia'])} className={classeFiltro}>
            <option value="">Toda recorrência</option>
            {RECORRENCIAS.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.rotulo}
              </option>
            ))}
          </select>
          <select aria-label="Forma de pagamento" value={filtros.formaPagamento} onChange={(e) => definirFiltro('formaPagamento', e.target.value as FiltrosDespesas['formaPagamento'])} className={classeFiltro}>
            <option value="">Toda forma de pagamento</option>
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.rotulo}
              </option>
            ))}
          </select>
          <select aria-label="Setor" value={filtros.setor} onChange={(e) => definirFiltro('setor', e.target.value)} className={classeFiltro}>
            <option value="">Todos os setores</option>
            {(DEPARTMENTS as string[]).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select aria-label="Fornecedor" value={filtros.fornecedor} onChange={(e) => definirFiltro('fornecedor', e.target.value)} className={classeFiltro}>
            <option value="">Todos os fornecedores</option>
            {nomesFornecedores.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <select aria-label="Autorizado por" value={filtros.autorizadoPor} onChange={(e) => definirFiltro('autorizadoPor', e.target.value)} className={classeFiltro}>
            <option value="">Qualquer autorizador</option>
            {autorizadores.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={`${VIDRO} rounded-3xl overflow-hidden animate-fade-in-up`} style={{ animationDelay: '0.2s' }}>
        {loading && despesas.length === 0 ? (
          <div className="p-4 space-y-2" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-red-700 dark:text-red-300">
            <p>{error}</p>
            <button type="button" onClick={refetch} className="mt-2 font-medium underline underline-offset-2">
              Tentar novamente
            </button>
          </div>
        ) : despesas.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
              <Receipt className="w-7 h-7 text-violet-600 dark:text-violet-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Nenhuma despesa cadastrada</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {podeGerenciar
                ? 'Cadastre a primeira despesa da TI para começar a acompanhar os gastos.'
                : 'Quando a TI cadastrar despesas, elas aparecem aqui.'}
            </p>
            {podeGerenciar && (
              <button
                type="button"
                onClick={() => setEmEdicao('nova')}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> Cadastrar despesa
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    {cabecalho('descricao', 'Despesa')}
                    {cabecalho('categoria', 'Categoria')}
                    {cabecalho('fornecedor', 'Fornecedor')}
                    <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                      Recorrência
                    </th>
                    {cabecalho('valor', 'Valor', true)}
                    {cabecalho('equivalente', 'Por mês', true)}
                    {cabecalho('proxima', 'Próxima')}
                    <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                      Situação
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                      Autorizado por
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/50">
                  {visiveis.map(({ despesa: d, valorVigente, quantidadeVigente, equivalenteMensal, proxima, situacao }) => {
                    const categoria = categoriaPorId.get(d.categoriaId);
                    return (
                      <tr
                        key={d.id}
                        onClick={() => setSelecionadaId(d.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelecionadaId(d.id);
                          }
                        }}
                        tabIndex={0}
                        aria-label={`Abrir ${d.descricao}`}
                        className="text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-violet-50/60 dark:hover:bg-violet-900/10 focus:outline-none focus:bg-violet-50/60 dark:focus:bg-violet-900/10"
                      >
                        <td className="px-3 py-2.5 max-w-[260px]">
                          <span className="block font-medium text-slate-900 dark:text-slate-100 truncate" title={d.descricao}>
                            {d.descricao}
                          </span>
                          {(quantidadeVigente || d.tipoValor === 'variavel') && (
                            <span className="block text-xs text-slate-400 dark:text-slate-500">
                              {[quantidadeVigente ? `${quantidadeVigente} ${d.unidade ?? ''}`.trim() : null, d.tipoValor === 'variavel' ? 'valor estimado' : null]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: corDoSlot(slots.get(d.categoriaId), theme) }}
                            />
                            {categoria?.nome ?? '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 max-w-[180px] truncate" title={d.fornecedorNome}>
                          {d.fornecedorNome}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {RECORRENCIA_ROTULO[d.recorrencia]}
                          {d.competenciaFim && d.recorrencia !== 'unica' && (
                            <span className="block text-xs text-slate-400 dark:text-slate-500">até {formatarCompetencia(d.competenciaFim)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">{formatCurrency(valorVigente)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                          {equivalenteMensal === null ? <span className="text-slate-400">—</span> : formatCurrency(equivalenteMensal)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {proxima ? (
                            <>
                              <span className="block">{formatarData(proxima.vencimento)}</span>
                              <span className="block text-xs text-slate-400 dark:text-slate-500">{formatarCompetencia(proxima.competencia)}</span>
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${SITUACAO_DESPESA[situacao].classe}`}>
                            {SITUACAO_DESPESA[situacao].rotulo}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 max-w-[160px] truncate" title={d.autorizadoPor}>
                          {d.autorizadoPor}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {visiveis.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Nenhuma despesa com esses filtros.
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-t border-slate-200/70 dark:border-slate-700/50 text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  {visiveis.length} {visiveis.length === 1 ? 'despesa' : 'despesas'}
                  {temFiltro && ` de ${despesas.length}`}
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  Custo recorrente mensal {temFiltro ? 'do recorte' : ''}:{' '}
                  <strong className="text-slate-900 dark:text-white">{formatCurrency(custoRecorrente)}</strong>
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {categoriasAberto && <CategoriasModal categoriasTI={categoriasTI} onClose={fecharCategorias} />}
      {importarAberto && (
        <ImportarDespesasModal
          categorias={categoriasTI.categorias}
          fornecedores={fornecedores}
          despesas={despesas}
          onImportar={importar}
          onFechar={() => setImportarAberto(false)}
        />
      )}
      {linhaSelecionada && (
        <DespesaPainel
          linha={linhaSelecionada}
          categoria={categoriaPorId.get(linhaSelecionada.despesa.categoriaId)}
          corCategoria={corDoSlot(slots.get(linhaSelecionada.despesa.categoriaId), theme)}
          podeGerenciar={podeGerenciar}
          hoje={hoje}
          contextoAuditoria={contextoAuditoria}
          escAtivo={!emEdicao && !acaoPainel}
          onFechar={fecharPainel}
          onEditar={() => setEmEdicao(linhaSelecionada.despesa)}
          onReajustar={() => setAcaoPainel('reajustar')}
          onEncerrar={() => setAcaoPainel('encerrar')}
          onExcluir={() => setAcaoPainel('excluir')}
          onRemoverReajuste={removerReajuste}
          onAdicionarAnexos={(arquivos) => adicionarAnexos(linhaSelecionada.despesa.id, arquivos)}
          onRemoverAnexo={(path) => removerAnexo(linhaSelecionada.despesa.id, path)}
        />
      )}
      {linhaSelecionada && acaoPainel === 'reajustar' && (
        <ReajusteModal
          despesa={linhaSelecionada.despesa}
          onSalvar={(input) => registrarReajuste(linhaSelecionada.despesa.id, input)}
          onFechar={fecharAcao}
        />
      )}
      {linhaSelecionada && acaoPainel === 'encerrar' && (
        <EncerramentoModal
          despesa={linhaSelecionada.despesa}
          onSalvar={(fim) => definirFim(linhaSelecionada.despesa.id, fim)}
          onFechar={fecharAcao}
        />
      )}
      {linhaSelecionada && acaoPainel === 'excluir' && (
        <ExcluirDespesaModal
          despesa={linhaSelecionada.despesa}
          onConfirmar={() => excluirDespesa(linhaSelecionada.despesa.id)}
          onFechar={fecharAcao}
          onExcluida={() => {
            setAcaoPainel(null);
            setSelecionadaId(null);
          }}
        />
      )}
      {emEdicao && (
        <DespesaFormModal
          despesa={emEdicao === 'nova' ? null : emEdicao}
          categoriasTI={categoriasTI}
          fornecedores={fornecedores}
          criarFornecedorRapido={criarFornecedorRapido}
          responsaveis={responsaveis}
          sugestoesAutorizador={autorizadores}
          onSalvar={salvarDespesa}
          onFechar={fecharFormulario}
        />
      )}
    </GastosTIShell>
  );
};

export default DespesasPage;
