import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  DollarSign,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Undo2,
  Wallet,
} from 'lucide-react';
import type {
  AlteracaoLancamento,
  DivergenciaAplis,
  FiltroGlosaTitulo,
  GlosaAplisTitulo,
  OperadoraResumo,
  TituloBaixa,
  TituloGuia,
  TituloReceber,
  TituloStatus,
  TitulosViewFiltros,
} from '../types';
import {
  faixaSaldo,
  formatCompetencia,
  formatCurrency,
  formatData,
  formatDataHora,
  formatSaldoComSinal,
  periodoEsteMes,
  periodoEsteTrimestre,
  periodoMesPassado,
  protocolosDoTitulo,
  responsaveisDoTitulo,
} from '../utils/formato';
import type { TotaisTitulos } from '../hooks/useContasReceber';
import { sanitizarFiltrosTitulos } from '../utils/viewsSalvas';
import { STATUS_CORES, STATUS_ROTULOS } from '../utils/tituloStatus';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import { ViewsSalvasMenu } from './ViewsSalvasMenu';
import Select from '../../../components/Select';
import DatePicker from '../../../components/DatePicker';
import { Atraso, SeloAplis } from './TituloSelos';
import TituloPainelLateral from './TituloPainelLateral';

// Lista de títulos a receber. O olho de cada linha abre os detalhes (baixas,
// glosas, alterações, lotes → guias) no painel lateral, TituloPainelLateral.

const STATUS_OPCOES = [
  { value: '', label: 'Todos' },
  ...(Object.keys(STATUS_ROTULOS) as TituloStatus[]).map((status) => ({
    value: status,
    label: STATUS_ROTULOS[status],
  })),
];

// Filtro "Glosa": "Com glosa" pega também quem já teve e foi revertida —
// o pedido do setor é achar os títulos que tiveram alguma glosa, não só as vivas.
const GLOSA_OPCOES: { value: FiltroGlosaTitulo; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'com', label: 'Com glosa (tem ou teve)' },
  { value: 'aberta', label: 'Glosa em aberto/recurso' },
  { value: 'sem', label: 'Sem glosa' },
];

const CAMPO = 'mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100';

// Issue 40: atalhos que preenchem o range de emissão — não substituem os
// DatePickers de range livre, só evitam abrir o calendário pro caso comum.
const ATALHOS_PERIODO = [
  { rotulo: 'Este mês', calcular: periodoEsteMes },
  { rotulo: 'Mês passado', calcular: periodoMesPassado },
  { rotulo: 'Este trimestre', calcular: periodoEsteTrimestre },
] as const;

interface Props {
  titulos: TituloReceber[];
  operadoras: OperadoraResumo[];
  total: number;
  /** Somas de recebido, glosas e saldo de todos os títulos do recorte, não só da página. */
  totais: TotaisTitulos;
  loading: boolean;
  error: string | null;
  /** Falha ao ler as glosas do apLIS: aviso discreto, as três colunas em "—". */
  erroGlosasAplis: string | null;
  /** Conferência com o apLIS por `idNota` (só os divergentes); null enquanto
   *  não chegou ou se falhou — aí a linha sai sem selo. */
  divergencias: Map<string, DivergenciaAplis> | null;
  /** Falha da conferência: aviso discreto, a lista segue normal. */
  erroConferencia: string | null;
  podeEditar: boolean;
  filtros: {
    desde: string;
    ate: string;
    status: TituloStatus | '';
    operadoraId: string;
    busca: string;
    /** Issue 16: some da lista os títulos de operadoras marcadas como clínica parceira. */
    ocultarParceiras: boolean;
    /** Issue 38: atalho "Somente pendentes" — preset de Status (aberta + parcialmente
     *  recebida), só surte efeito quando `status` manual está vazio (ver conflito abaixo). */
    somentePendentes: boolean;
    /** Recorte por glosa lançada no título — ver FiltroGlosaTitulo. */
    glosa: FiltroGlosaTitulo;
    /** Só os títulos que divergem do apLIS (ids da conferência). */
    divergenteAplis: boolean;
    pagina: number;
    tamanho: number;
  };
  onFiltrar: (patch: Partial<Props['filtros']>) => void;
  onAtualizar: () => void;
  onNovoTitulo: () => void;
  /** Issue 16: abre o modal de gerenciamento das clínicas parceiras. */
  onGerenciarParceiras: () => void;
  /** Issue 31: abre o modal de gerenciamento da regra "NF só após pagamento". */
  onGerenciarRegraNf: () => void;
  /** Abre o modal de gerenciamento da whitelist "fontes consideradas na meta". */
  onGerenciarConsideradaMeta: () => void;
  onBaixa: (titulo: TituloReceber) => void;
  onCancelar: (titulo: TituloReceber) => void;
  /** Issue 33: abre o modal de edição do número da nota. */
  onEditar: (titulo: TituloReceber) => void;
  /** Issue 46: remove o vínculo de um lote a um título já existente. `motivo`
   *  é sempre obrigatório (a UI já valida antes de chamar). */
  onDesvincularLote: (notaId: string, loteId: string, motivo: string) => Promise<string | null>;
  buscarGuias: (loteId: string) => Promise<TituloGuia[]>;
  /** `DtaEnvio` ao vivo dos lotes (issue 15) — chave = aplisId. Ver utils/envioAoVivo.ts. */
  buscarEnvioLotes: (idsAplis: string[]) => Promise<Record<string, string | null>>;
  /** Issue 39: histórico de baixas do título, buscado ao expandir a linha. */
  buscarBaixas: (notaId: string) => Promise<TituloBaixa[]>;
  /** Glosas do apLIS dos lotes do título, buscadas ao expandir a linha. */
  buscarGlosasAplis: (lotesAplis: number[]) => Promise<GlosaAplisTitulo[]>;
  /** Correções de baixas/glosas do título (.scratch/titulos-edicao-lancamentos),
   *  buscadas junto com as baixas ao expandir a linha. */
  buscarAlteracoes: (notaId: string) => Promise<AlteracaoLancamento[]>;
  /** Editar/Baixa aberto por cima do painel de detalhes: o Esc fecha só o modal. */
  camadaSobreposta: boolean;
}


// Neutro só enquanto carrega — sem saldo ainda, não há sinal para colorir.
const COR_FAIXA_SALDO: Record<ReturnType<typeof faixaSaldo> | 'neutro', { icone: string; valor: string }> = {
  positivo: {
    icone: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    valor: 'text-emerald-600 dark:text-emerald-400',
  },
  zerado: {
    icone: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    valor: 'text-blue-600 dark:text-blue-400',
  },
  negativo: {
    icone: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    valor: 'text-red-600 dark:text-red-400',
  },
  neutro: {
    icone: 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300',
    valor: 'text-gray-900 dark:text-gray-100',
  },
};

/** Card de total do recorte, acima da tabela. */
const CardTotal: React.FC<{
  icone: React.ReactNode;
  corIcone: string;
  rotulo: string;
  valor: string;
  /** Cor do valor; sem ela, o texto padrão. */
  corValor?: string;
}> = ({
  icone, corIcone, rotulo, valor, corValor = 'text-gray-900 dark:text-gray-100',
}) => (
  <div className="inline-flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/40 px-4 py-2.5">
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${corIcone}`}>{icone}</div>
    <div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">{rotulo}</p>
      <p className={`text-base font-semibold tabular-nums ${corValor}`}>{valor}</p>
    </div>
  </div>
);

const TitulosList: React.FC<Props> = ({
  titulos,
  operadoras,
  total,
  totais,
  loading,
  error,
  erroGlosasAplis,
  divergencias,
  erroConferencia,
  podeEditar,
  filtros,
  onFiltrar,
  onAtualizar,
  onNovoTitulo,
  onGerenciarParceiras,
  onGerenciarRegraNf,
  onGerenciarConsideradaMeta,
  onBaixa,
  onCancelar,
  onEditar,
  onDesvincularLote,
  buscarGuias,
  buscarEnvioLotes,
  buscarBaixas,
  buscarGlosasAplis,
  buscarAlteracoes,
  camadaSobreposta,
}) => {
  // Título com o painel lateral de detalhes aberto (.scratch/titulos-painel-lateral).
  const [idAberto, setIdAberto] = useState<string | null>(null);
  const [busca, setBusca] = useState(filtros.busca);

  // Issue 31: pra mostrar a regra de NF na própria linha do título, sem
  // precisar abrir o lote — a operadora do título já é o dado, só falta o mapa.
  const nfAposPagamentoPorOperadora = useMemo(
    () => new Map(operadoras.map((o) => [o.id, o.nfAposPagamento])),
    [operadoras],
  );

  // Sempre da lista atual: baixa, edição e cancelamento chegam ao painel pelo refetch.
  const tituloAberto = idAberto ? titulos.find((t) => t.id === idAberto) ?? null : null;

  // Painel fecha quando o recorte muda (filtro, página, busca)...
  useEffect(() => {
    setIdAberto(null);
  }, [
    filtros.desde, filtros.ate, filtros.status, filtros.operadoraId, filtros.busca, filtros.ocultarParceiras,
    filtros.somentePendentes, filtros.glosa, filtros.divergenteAplis, filtros.pagina, filtros.tamanho,
  ]);

  // ...ou quando o título sai da lista depois de um refetch.
  useEffect(() => {
    if (idAberto && !loading && !titulos.some((t) => t.id === idAberto)) setIdAberto(null);
  }, [idAberto, loading, titulos]);

  const fecharPainel = useCallback(() => setIdAberto(null), []);

  // Debounce: cada tecla dispararia uma consulta paginada ao Supabase.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (busca.trim() !== filtros.busca) onFiltrar({ busca: busca.trim(), pagina: 1 });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const faixaSaldoRecorte = loading ? 'neutro' : faixaSaldo(totais.saldo);

  const qtdPaginas = useMemo(
    () => (filtros.tamanho > 0 ? Math.max(1, Math.ceil(total / filtros.tamanho)) : 1),
    [total, filtros.tamanho],
  );

  // Paginação não é um recorte a salvar numa view — só o que define QUAIS
  // títulos aparecem, não EM QUE PÁGINA. Aplicar uma view sempre volta pra 1.
  //
  // `busca` (estado local) e não `filtros.busca`: o segundo só chega depois do
  // debounce, então salvar uma view logo após digitar guardaria o texto de
  // busca anterior.
  const filtrosSalvaveis = useMemo<TitulosViewFiltros>(
    () => ({
      desde: filtros.desde,
      ate: filtros.ate,
      status: filtros.status,
      operadoraId: filtros.operadoraId,
      busca,
      ocultarParceiras: filtros.ocultarParceiras,
      somentePendentes: filtros.somentePendentes,
      glosa: filtros.glosa,
      divergenteAplis: filtros.divergenteAplis,
    }),
    [
      filtros.desde, filtros.ate, filtros.status, filtros.operadoraId, busca,
      filtros.ocultarParceiras, filtros.somentePendentes, filtros.glosa, filtros.divergenteAplis,
    ],
  );

  // A garantia de formato mora no sanitizador (utils/viewsSalvas.ts): a view
  // chega completa, com `busca` sempre string — sem os fallbacks campo a campo
  // que uma view em formato antigo exigia aqui.
  const aplicarView = (view: TitulosViewFiltros) => {
    setBusca(view.busca);
    onFiltrar({ ...view, pagina: 1 });
  };

  return (
    <div className="space-y-4">
      {/* ── Filtros ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-4 space-y-3">
        {/* Linha 1: período, status/operadora, checkboxes e views/atualizar. */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Emissão de
              <DatePicker
                value={filtros.desde}
                onChange={(v) => onFiltrar({ desde: v, pagina: 1 })}
                controlClass={CAMPO}
              />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              até
              <DatePicker
                value={filtros.ate}
                onChange={(v) => onFiltrar({ ate: v, pagina: 1 })}
                controlClass={CAMPO}
              />
            </label>
            {/* Os três atalhos em bloco 2×2 (o terceiro ocupa a linha toda) em vez de
                uma tira horizontal — cabe ao lado dos dois DatePickers sem esticar a
                barra. */}
            <div className="inline-grid grid-cols-2 gap-1">
              {ATALHOS_PERIODO.map(({ rotulo, calcular }, indice) => (
                <button
                  key={rotulo}
                  type="button"
                  onClick={() => onFiltrar({ ...calcular(), pagina: 1 })}
                  className={`px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 whitespace-nowrap ${
                    indice === ATALHOS_PERIODO.length - 1 ? 'col-span-2' : ''
                  }`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden lg:block w-px self-stretch bg-gray-100 dark:bg-gray-700" />

          <label className="text-xs text-gray-500 dark:text-gray-400">
            Status
            <Select
              value={filtros.status}
              // Selecionar um status manualmente é um recorte explícito — desliga o
              // atalho "Somente pendentes" pra não conflitarem (issue 38).
              onChange={(v) => onFiltrar({ status: v as TituloStatus | '', somentePendentes: false, pagina: 1 })}
              options={STATUS_OPCOES}
              controlClass={CAMPO}
            />
          </label>
          <label className="text-xs text-gray-500 dark:text-gray-400">
            Operadora
            <Select
              value={filtros.operadoraId}
              onChange={(v) => onFiltrar({ operadoraId: v, pagina: 1 })}
              options={[
                { value: '', label: 'Todas' },
                ...operadoras.map((operadora) => ({ value: operadora.id, label: operadora.nome })),
              ]}
              controlClass={CAMPO}
              wrapperClass="max-w-[220px]"
            />
          </label>
          <label className="text-xs text-gray-500 dark:text-gray-400">
            Glosa
            <Select
              value={filtros.glosa}
              onChange={(v) => onFiltrar({ glosa: v as FiltroGlosaTitulo, pagina: 1 })}
              options={GLOSA_OPCOES}
              controlClass={CAMPO}
            />
          </label>

          <div className="hidden lg:block w-px self-stretch bg-gray-100 dark:bg-gray-700" />

          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <input
                type="checkbox"
                checked={filtros.somentePendentes}
                onChange={(e) => onFiltrar({
                  somentePendentes: e.target.checked,
                  // Ligar o atalho sobrescreve uma seleção manual de Status anterior — os
                  // dois não fazem sentido juntos (issue 38).
                  status: e.target.checked ? '' : filtros.status,
                  pagina: 1,
                })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              Somente pendentes
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <input
                type="checkbox"
                checked={filtros.ocultarParceiras}
                onChange={(e) => onFiltrar({ ocultarParceiras: e.target.checked, pagina: 1 })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              Ocultar clínicas parceiras
            </label>
            <label
              className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
              title="Títulos cujo recebido aqui difere do recebido no apLIS (dados do apLIS até ontem)"
            >
              <input
                type="checkbox"
                checked={filtros.divergenteAplis}
                onChange={(e) => onFiltrar({ divergenteAplis: e.target.checked, pagina: 1 })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              Divergente do apLIS
            </label>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <ViewsSalvasMenu
              tela="titulos"
              filtros={filtrosSalvaveis}
              sanitizar={(cru) => sanitizarFiltrosTitulos(cru, filtrosSalvaveis)}
              onAplicar={aplicarView}
            />
            <button
              type="button"
              onClick={onAtualizar}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
          </div>
        </div>

        {/* Linha 2: busca livre + ações de gerenciamento + criação de título. */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nota, lote, protocolo, operadora, competência, observações…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          {podeEditar && (
            <>
              <button
                type="button"
                onClick={onGerenciarParceiras}
                title="Gerenciar clínicas parceiras"
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <Settings className="w-4 h-4" /> Clínicas parceiras
              </button>
              <button
                type="button"
                onClick={onGerenciarRegraNf}
                title="Gerenciar regra de NF por operadora"
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <Settings className="w-4 h-4" /> Regra de NF
              </button>
              <button
                type="button"
                onClick={onGerenciarConsideradaMeta}
                title="Gerenciar fontes consideradas na meta"
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <Settings className="w-4 h-4" /> Fontes na meta
              </button>
              <button
                type="button"
                onClick={onNovoTitulo}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Novo título
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Sem a conferência a lista segue normal, só sem selos — mas o operador
          precisa saber que "nenhum selo" não quer dizer "nada divergente". */}
      {erroConferencia && (
        <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Conferência com o apLIS indisponível ({erroConferencia}): os títulos divergentes não estão marcados
            {filtros.divergenteAplis && ' e o filtro "Divergente do apLIS" não pôde ser aplicado'}.
          </span>
        </div>
      )}

      {erroGlosasAplis && (
        <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Glosas do apLIS indisponíveis ({erroGlosasAplis}): Glosado, Glosa recebida e Glosa acatada aparecem como "—".
          </span>
        </div>
      )}

      {/* Totais do recorte: acompanham todos os filtros acima, somando todas as
          páginas (as somas vêm do hook, não de `titulos`). Recebido e as glosas
          seguem as cores das colunas; o Saldo muda de cor pelo sinal. As glosas
          vêm da foto de Glosas e Recursos (apLIS). */}
      <div className="flex flex-wrap gap-3">
        <CardTotal
          icone={<DollarSign className="w-4 h-4" />}
          corIcone="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
          rotulo="Total recebido"
          valor={loading ? '—' : formatCurrency(totais.recebido)}
        />
        <CardTotal
          icone={<AlertTriangle className="w-4 h-4" />}
          corIcone="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
          rotulo="Total glosado"
          valor={loading || !totais.glosas ? '—' : formatCurrency(totais.glosas.glosado)}
        />
        <CardTotal
          icone={<Undo2 className="w-4 h-4" />}
          corIcone="bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400"
          rotulo="Glosa recebida"
          valor={loading || !totais.glosas ? '—' : formatCurrency(totais.glosas.glosaRecebida)}
        />
        <CardTotal
          icone={<Ban className="w-4 h-4" />}
          corIcone="bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400"
          rotulo="Glosa acatada"
          valor={loading || !totais.glosas ? '—' : formatCurrency(totais.glosas.glosaAcatada)}
        />
        <CardTotal
          icone={<Wallet className="w-4 h-4" />}
          corIcone={COR_FAIXA_SALDO[faixaSaldoRecorte].icone}
          corValor={COR_FAIXA_SALDO[faixaSaldoRecorte].valor}
          rotulo="Saldo"
          valor={loading ? '—' : formatSaldoComSinal(totais.saldo)}
        />
      </div>

      {/* ── Tabela ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : titulos.length === 0 && filtros.divergenteAplis && erroConferencia ? (
        // Vazia por falta da conferência, não por falta de título: ampliar o
        // período (a dica de baixo) não resolveria.
        <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
          Sem a conferência com o apLIS não dá para saber quais títulos divergem.
          Desligue "Divergente do apLIS" para ver a lista ou tente "Atualizar".
        </div>
      ) : titulos.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
          Nenhum título de {formatData(filtros.desde)} até {formatData(filtros.ate)}
          {filtros.status
            ? ` com status "${STATUS_ROTULOS[filtros.status]}"`
            : filtros.somentePendentes && ' com o atalho "Somente pendentes" ativado'}
          {filtros.divergenteAplis && ' divergente do apLIS'}.
          {' '}Amplie o período de emissão acima — trocar o Status não muda
          a lista se o período já não cobrir nenhum título.
          {podeEditar && ' Use "Novo título" para agrupar lotes do apLIS numa cobrança.'}
        </div>
      ) : (
        <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/40">
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2 w-8" />
                  <th className="px-3 py-2">Nota</th>
                  <th className="px-3 py-2">Lote</th>
                  <th className="px-3 py-2">Protocolo</th>
                  <th className="px-3 py-2">Operadora</th>
                  <th className="px-3 py-2" title="Quem fechou a fatura (lote) no apLIS">Responsável</th>
                  <th className="px-3 py-2">Competência</th>
                  <th className="px-3 py-2">Vencimento</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Recebido</th>
                  <th className="px-3 py-2 text-right" title="Glosa fixada das requisições em &quot;GLOSADO ainda SEM RECURSO&quot; dos lotes do título (apLIS)">Glosado</th>
                  <th className="px-3 py-2 text-right" title="Valor deferido dos recursos das requisições do título (apLIS)">Glosa recebida</th>
                  <th className="px-3 py-2 text-right" title="Saldo negativo das requisições em &quot;Recebido a menor – acatado&quot; e &quot;Glosa definitiva – acatada diretoria&quot; (apLIS)">Glosa acatada</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                  <th className="px-3 py-2">Status</th>
                  {podeEditar && <th className="px-3 py-2 w-40" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {titulos.map((titulo) => {
                  const aberto = idAberto === titulo.id;
                  const encerrado = titulo.status === 'cancelada' || titulo.valorSaldo <= 0;
                  const responsaveis = responsaveisDoTitulo(titulo.lotes);
                  const protocolos = protocolosDoTitulo(titulo.lotes);
                  const divergencia = divergencias?.get(titulo.id);
                  return (
                      <tr
                        key={titulo.id}
                        className={`transition-colors ${
                          aberto ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                        }`}
                      >
                        <td className="pl-3 pr-0 py-2">
                          <button
                            type="button"
                            onClick={() => setIdAberto(aberto ? null : titulo.id)}
                            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            aria-label={`Ver detalhes do título ${titulo.numeroNota || 'sem número de nota'}`}
                            title="Ver detalhes do título"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                          {titulo.numeroNota || (
                            // Sem número e sem o badge "Aguardando nota" abaixo (caso
                            // NF pós-pagamento, ver comentário adiante): mostra o "—"
                            // de ausência. Quando o badge aparece, ele já diz que não
                            // tem nota — o "—" ao lado seria redundante.
                            nfAposPagamentoPorOperadora.get(titulo.operadoraId) && (
                              <span
                                className="font-normal text-gray-400 dark:text-gray-500"
                                title="Número da nota ainda não informado"
                              >
                                —
                              </span>
                            )
                          )}
                          {/* Issue 35: só é alerta quando a ausência do número NÃO é o
                              fluxo esperado — operadoras com NF pós-pagamento já mostram
                              seu próprio badge âmbar na coluna Operadora. */}
                          {/* Sem ml-2: diferente do badge "NF após pagamento" (que sempre
                              vem depois do nome da operadora), este é o único conteúdo da
                              célula quando aparece — não há nada antes dele pra espaçar. */}
                          {!titulo.numeroNota && !nfAposPagamentoPorOperadora.get(titulo.operadoraId) && (
                            <span
                              title="Título sem número da nota — pendência a resolver"
                              className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                            >
                              Aguardando nota
                            </span>
                          )}
                        </td>
                        {/* Código do lote já na linha, sem precisar abrir os detalhes. */}
                        <td
                          className="px-3 py-2 text-gray-500 dark:text-gray-400 tabular-nums truncate max-w-[140px]"
                          title={titulo.lotes.map((lote) => lote.codigoLote).join(', ') || undefined}
                        >
                          {titulo.lotes.length === 0
                            ? '—'
                            : titulo.lotes.map((lote) => lote.codigoLote).join(', ')}
                        </td>
                        <td
                          className="px-3 py-2 text-gray-500 dark:text-gray-400 tabular-nums truncate max-w-[160px]"
                          title={protocolos.completo ?? undefined}
                        >
                          {protocolos.curto}
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300 truncate max-w-[200px]">
                          {titulo.operadoraNome ?? '—'}
                          {nfAposPagamentoPorOperadora.get(titulo.operadoraId) && (
                            <span
                              title="Esta operadora só permite emitir a NF depois do pagamento"
                              className="ml-2 inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                            >
                              NF após pagamento
                            </span>
                          )}
                        </td>
                        <td
                          className="px-3 py-2 text-gray-600 dark:text-gray-300 truncate max-w-[160px]"
                          title={responsaveis.completo ?? undefined}
                        >
                          {responsaveis.curto}
                        </td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400 tabular-nums">
                          {formatCompetencia(titulo.competencia)}
                        </td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
                          <div>{formatData(titulo.dataVencimento)}</div>
                          <Atraso titulo={titulo} />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">
                          {formatCurrency(titulo.valorTotal)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(titulo.valorRecebido)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-amber-600 dark:text-amber-400">
                          {titulo.glosasAplis ? formatCurrency(titulo.glosasAplis.glosado) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-sky-600 dark:text-sky-400">
                          {titulo.glosasAplis ? formatCurrency(titulo.glosasAplis.glosaRecebida) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                          {titulo.glosasAplis ? formatCurrency(titulo.glosasAplis.glosaAcatada) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">
                          {formatCurrency(titulo.valorSaldo)}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_CORES[titulo.status]}`}>
                            {STATUS_ROTULOS[titulo.status]}
                          </span>
                          {divergencia && <SeloAplis divergencia={divergencia} />}
                          {/* Mesmos poucos títulos revisitados em dias diferentes mudam de
                              status (Aberta → Parcial → Recebida) conforme as baixas chegam —
                              sem isto, a mudança parece uma NF "semelhante" duplicada. */}
                          <div className="mt-1 text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                            atualizado em {formatDataHora(titulo.statusAtualizadoEm)}
                          </div>
                        </td>
                        {podeEditar && (
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onEditar(titulo)}
                                disabled={titulo.status === 'cancelada'}
                                title="Editar título (número da nota, baixas e glosas)"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onBaixa(titulo)}
                                disabled={titulo.status === 'cancelada'}
                                title="Registrar baixa"
                                className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <DollarSign className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onCancelar(titulo)}
                                disabled={encerrado}
                                title="Cancelar título"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Paginação ────────────────────────────────────────────────────── */}
      {total > filtros.tamanho && (
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{total} título{total === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={filtros.pagina <= 1}
              onClick={() => onFiltrar({ pagina: filtros.pagina - 1 })}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="tabular-nums">{filtros.pagina} / {qtdPaginas}</span>
            <button
              type="button"
              disabled={filtros.pagina >= qtdPaginas}
              onClick={() => onFiltrar({ pagina: filtros.pagina + 1 })}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {tituloAberto && (
        <TituloPainelLateral
          key={tituloAberto.id}
          titulo={tituloAberto}
          divergencia={divergencias?.get(tituloAberto.id)}
          nfAposPagamento={Boolean(nfAposPagamentoPorOperadora.get(tituloAberto.operadoraId))}
          podeEditar={podeEditar}
          camadaSobreposta={camadaSobreposta}
          onFechar={fecharPainel}
          onBaixa={onBaixa}
          onCancelar={onCancelar}
          onEditar={onEditar}
          onDesvincularLote={onDesvincularLote}
          buscarGuias={buscarGuias}
          buscarEnvioLotes={buscarEnvioLotes}
          buscarBaixas={buscarBaixas}
          buscarGlosasAplis={buscarGlosasAplis}
          buscarAlteracoes={buscarAlteracoes}
        />
      )}
    </div>
  );
};

export default TitulosList;
