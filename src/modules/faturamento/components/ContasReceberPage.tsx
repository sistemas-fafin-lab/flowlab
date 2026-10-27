import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCheck, DownloadCloud, ListChecks, RefreshCw, Scale, Send, Wallet } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/permissions';
import { supabase } from '../../../lib/supabase';
import { useContasReceber } from '../hooks/useContasReceber';
import { useConferenciaAplis } from '../hooks/useConferenciaAplis';
import { periodoEsteMes } from '../utils/formato';
import { idsDivergentesNoPeriodo } from '../utils/conferenciaAplis';
import type { AcaoTituloConferencia } from '../utils/conferenciaAplis';
import type {
  DashboardReceberFiltros, FiltroGlosaTitulo, RefechamentoAplicado, SubAbaPendencias, TituloReceber, TituloStatus,
} from '../types';
import ContasReceberDashboard from './ContasReceberDashboard';
import TitulosList from './TitulosList';
import EnviosPorConvenio from './EnviosPorConvenio';
import PendenciasNaoFaturadas from './PendenciasNaoFaturadas';
import PendenciasParticulares from './PendenciasParticulares';
import PendenciasSemLote from './PendenciasSemLote';
import NovoTituloModal from './NovoTituloModal';
import AtualizarAplisModal from './AtualizarAplisModal';
import ConferenciaAplisModal from './ConferenciaAplisModal';
import RefechamentosAplisAviso from './RefechamentosAplisAviso';
import RefechamentosAplicadosAviso from './RefechamentosAplicadosAviso';
import AplicarBaixasAplisModal from './AplicarBaixasAplisModal';
import BaixaModal from './BaixaModal';
import ClinicasParceirasModal from './ClinicasParceirasModal';
import RegraNfModal from './RegraNfModal';
import ConsideradaMetaModal from './ConsideradaMetaModal';
import EditarTituloModal from './EditarTituloModal';

// ============================================================================
// COMPONENTE: ContasReceberPage
// Aba Faturamento → Contas a Receber. Substitui o RecebimentosList, que era
// montado sobre as tabelas `notas`/`recebimentos` nunca populadas (o worker
// billing-sync jamais saiu do mock) e por isso sempre mostrou vazio.
//
// O modelo agora é manual e explícito: o operador agrupa lotes do apLIS num
// título e registra sobre ele baixas parciais (a glosa vem do apLIS).
// ============================================================================

/** Primeiro dia do mês de N meses atrás, em ISO local. */
function mesesAtras(n: number): string {
  const hoje = new Date();
  const alvo = new Date(hoje.getFullYear(), hoje.getMonth() - n, 1);
  return `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-01`;
}

function fimDoMes(): string {
  const hoje = new Date();
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  return `${ultimo.getFullYear()}-${String(ultimo.getMonth() + 1).padStart(2, '0')}-${String(ultimo.getDate()).padStart(2, '0')}`;
}

/** Estado inicial do painel, e também o alvo do "Limpar" — uma definição só. */
const filtrosPainelPadrao = (): DashboardReceberFiltros => ({
  desde: mesesAtras(3),
  ate: fimDoMes(),
  operadoraIds: [],
  lotes: [],
  notas: [],
});

type Aba = 'dashboard' | 'titulos' | 'envios' | 'pendencias';

const ContasReceberPage: React.FC = () => {
  const { userProfile } = useAuth();
  // Gate de escrita. A leitura já foi barrada pela rota (canViewBilling) e pela
  // RLS; aqui é só a diferença entre ver e poder mexer.
  const podeEditar = hasPermission(userProfile?.permissions || [], 'canManageBilling');

  const [aba, setAba] = useState<Aba>('dashboard');
  const [subAbaPendencias, setSubAbaPendencias] = useState<SubAbaPendencias>('lotes');
  const [filtros, setFiltros] = useState({
    // O período filtra por EMISSÃO (revisão de 2026-09-24 sobre a issue 40).
    // A emissão não fica no futuro, então basta ir até o fim do mês corrente;
    // três meses para trás cobrem o ciclo típico de pagamento sem trazer a
    // base inteira na primeira abertura.
    desde: mesesAtras(3),
    ate: fimDoMes(),
    status: '' as TituloStatus | '',
    operadoraId: '',
    busca: '',
    ocultarParceiras: false,
    // Issue 38: atalho "Somente pendentes" — ligado por padrão, a usuária não
    // precisa selecionar Status manualmente a cada visita pra ver o que falta receber.
    somentePendentes: true,
    glosa: '' as FiltroGlosaTitulo,
    divergenteAplis: false,
    pagina: 1,
    tamanho: 25,
  });

  // O painel tem filtros próprios (lote e nota fiscal não existem na listagem, e
  // status não faz sentido num indicador que já separa recebido de glosado), por
  // isso o estado é separado do da aba Títulos em vez de compartilhado.
  const [filtrosPainel, setFiltrosPainel] = useState<DashboardReceberFiltros>(filtrosPainelPadrao);

  const [novoAberto, setNovoAberto] = useState(false);
  const [atualizarAplisAberto, setAtualizarAplisAberto] = useState(false);
  const [conferenciaAberta, setConferenciaAberta] = useState(false);
  const [aplicarBaixasAberto, setAplicarBaixasAberto] = useState(false);
  // Trocada quando o "Lançar baixa" ou o "Editar título" fecha depois de salvar
  // (e no cancelamento e no "Atualizar" da lista): a conferência com o apLIS — a
  // do modal, se aberto, e a dos selos da aba Títulos — refaz a leitura e o
  // título acertado sai da lista.
  const [versaoConferencia, setVersaoConferencia] = useState(0);
  const tituloSalvoRef = useRef(false);
  const [parceirasAberto, setParceirasAberto] = useState(false);
  const [regraNfAberto, setRegraNfAberto] = useState(false);
  const [consideradaMetaAberto, setConsideradaMetaAberto] = useState(false);
  const [tituloBaixa, setTituloBaixa] = useState<TituloReceber | null>(null);
  const [tituloEditar, setTituloEditar] = useState<TituloReceber | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  // Tipado para o card poder distinguir sucesso de falha — antes os dois caíam
  // no mesmo card azul de informação, e "Falha ao sincronizar operadoras" saía
  // com cara de aviso positivo.
  const [aviso, setAviso] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Selos e filtro "Divergente do apLIS" da aba Títulos: lida a cada entrada na
  // aba, sem segurar a lista (que carrega por conta própria).
  const conferencia = useConferenciaAplis(aba === 'titulos', versaoConferencia);
  const { atualizar: atualizarConferencia } = conferencia;
  // Títulos que o último "Atualizar" levou ao mês do refechamento no apLIS.
  const [refechamentosAplicados, setRefechamentosAplicados] = useState<RefechamentoAplicado[]>([]);

  // undefined = filtro desligado; null = ligado, mas a conferência ainda não
  // chegou ou falhou (a lista fica vazia, ver useContasReceber).
  // Chaveado pelo conteúdo: cada releitura da conferência traz um array novo,
  // e um array novo com os mesmos ids refaria a consulta da lista à toa.
  const chaveIdsDivergentes = useMemo(() => {
    if (!filtros.divergenteAplis) return undefined;
    if (!conferencia.titulos) return null;
    return idsDivergentesNoPeriodo(conferencia.titulos, filtros.desde, filtros.ate).join(',');
  }, [filtros.divergenteAplis, filtros.desde, filtros.ate, conferencia.titulos]);
  const idsDivergentesAplis = useMemo((): string[] | null | undefined => {
    if (typeof chaveIdsDivergentes !== 'string') return chaveIdsDivergentes;
    return chaveIdsDivergentes === '' ? [] : chaveIdsDivergentes.split(',');
  }, [chaveIdsDivergentes]);

  const parametros = useMemo(() => ({
    desde: filtros.desde,
    ate: filtros.ate,
    status: filtros.status,
    operadoraId: filtros.operadoraId,
    busca: filtros.busca,
    ocultarParceiras: filtros.ocultarParceiras,
    somentePendentes: filtros.somentePendentes,
    glosa: filtros.glosa,
    divergenteAplis: filtros.divergenteAplis,
    idsDivergentesAplis,
    pagina: filtros.pagina,
    tamanho: filtros.tamanho,
  }), [filtros, idsDivergentesAplis]);

  const {
    titulos, operadoras, total, totais, loading, error, erroGlosasAplis, refetch, refetchOperadoras, buscarTitulo,
    buscarGuias, buscarEnvioLotes, buscarBaixas, buscarGlosasAplis, buscarLancamentos, buscarAlteracoes, buscarNfsCanceladas, corrigirLancamento, excluirBaixa,
    criarTitulo, registrarBaixa, cancelarTitulo,
    atualizarNumeroNota, desvincularLote, marcarClinicaParceira, alternarNfAposPagamento, marcarConsideradaMeta,
  } = useContasReceber(parametros);

  const aplicarFiltro = useCallback((patch: Partial<typeof filtros>) => {
    setFiltros((atual) => ({ ...atual, ...patch }));
  }, []);

  // O painel devolve o recorte inteiro (o modal de filtros aplica de uma vez),
  // então aqui não há merge: o que veio É o novo estado.
  const aplicarFiltroPainel = useCallback((novos: DashboardReceberFiltros) => {
    setFiltrosPainel(novos);
  }, []);

  const limparFiltroPainel = useCallback(() => setFiltrosPainel(filtrosPainelPadrao()), []);

  // Alvo dos widgets-resumo de pendências do Dashboard: troca de aba E de
  // sub-aba numa só chamada, para o clique cair já na lista certa.
  const navegarParaPendencias = useCallback((subAba: SubAbaPendencias) => {
    setAba('pendencias');
    setSubAbaPendencias(subAba);
  }, []);

  // Widget "Meta mensal" do Dashboard (issue 43) → aba Títulos, com o período
  // de emissão travado no mês/ano calendário da meta (useMetaMensal usa o
  // mesmo "hoje" e a mesma coluna). A lista não aplica a whitelist da meta nem
  // esconde cancelados (issue 37), então pode mostrar títulos a mais que o card.
  const navegarParaTitulosMeta = useCallback(() => {
    setAba('titulos');
    setFiltros((atual) => ({
      ...atual,
      ...periodoEsteMes(),
      status: '',
      somentePendentes: false,
      pagina: 1,
    }));
  }, []);

  // "Atualizar" da aba Títulos: relê a lista e a conferência e, para quem
  // edita, aplica a emissão nova dos títulos com lote refechado no apLIS. Uma
  // falha ao ler o apLIS ou ao aplicar não mexe na lista: só avisa.
  const atualizarTitulos = useCallback(async () => {
    void refetch();
    setRefechamentosAplicados([]);
    try {
      const aplicados = await atualizarConferencia(podeEditar);
      if (aplicados.length === 0) return;
      setRefechamentosAplicados(aplicados);
      // A lista relida acima ainda tinha a emissão antiga.
      void refetch();
    } catch (err) {
      setAviso({
        tipo: 'erro',
        texto: err instanceof Error ? err.message : 'Não foi possível aplicar os refechamentos do apLIS.',
      });
    }
  }, [atualizarConferencia, podeEditar, refetch]);

  // Recalculado só na montagem: as datas do padrão dependem de "hoje", e um
  // literal novo a cada render invalidaria o memo do painel a cada digitação.
  const padraoPainel = useMemo(filtrosPainelPadrao, []);

  // Espelha as fontes pagadoras do apLIS para que o financeiro possa cadastrar o
  // prazo de pagamento antes do primeiro título daquela operadora.
  const sincronizarOperadoras = async () => {
    setSincronizando(true);
    setAviso(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const res = await fetch('/api/faturamento/operadoras-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as {
        success?: boolean; error?: string; sincronizadas?: number;
      };
      if (!res.ok || !body.success) throw new Error(body.error || 'Falha ao sincronizar operadoras.');
      setAviso({ tipo: 'sucesso', texto: `${body.sincronizadas ?? 0} operadora(s) sincronizada(s) do apLIS.` });
      // refetch() só relê os títulos da página atual; o seletor de operadoras vem
      // de uma consulta à parte que só rodava na montagem — sem isto, as fontes
      // pagadoras recém-importadas ficavam de fora do <select> até um F5.
      await Promise.all([refetch(), refetchOperadoras()]);
    } catch (err) {
      setAviso({
        tipo: 'erro',
        texto: err instanceof Error ? err.message : 'Falha ao sincronizar operadoras.',
      });
    } finally {
      setSincronizando(false);
    }
  };

  const abrirBaixa = useCallback((titulo: TituloReceber) => {
    tituloSalvoRef.current = false;
    setTituloBaixa(titulo);
  }, []);

  const abrirEditar = useCallback((titulo: TituloReceber) => {
    tituloSalvoRef.current = false;
    setTituloEditar(titulo);
  }, []);

  // Fecha o "Lançar baixa"/"Editar título"; se algo foi salvo, refaz a conferência.
  const fecharLancamento = useCallback((fechar: () => void) => {
    fechar();
    if (tituloSalvoRef.current) setVersaoConferencia((v) => v + 1);
    tituloSalvoRef.current = false;
  }, []);

  /** Repassa o resultado de uma escrita dos modais de lançamento, anotando o sucesso. */
  const anotarSalvo = useCallback((erro: string | null) => {
    if (erro === null) tituloSalvoRef.current = true;
    return erro;
  }, []);

  // A conferência só tem o id: o título pode estar fora do filtro/página da lista.
  const abrirTituloDaConferencia = useCallback(async (
    idNota: string,
    acao: AcaoTituloConferencia,
  ): Promise<string | null> => {
    try {
      const titulo = await buscarTitulo(idNota);
      if (acao === 'baixa') abrirBaixa(titulo);
      else abrirEditar(titulo);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Não foi possível abrir o título.';
    }
  }, [abrirBaixa, abrirEditar, buscarTitulo]);

  const confirmarCancelamento = async (titulo: TituloReceber) => {
    const ok = window.confirm(
      `Cancelar o título ${titulo.numeroNota || 'sem número de nota'}? Os lotes voltam a ficar disponíveis para um novo título.`,
    );
    if (!ok) return;
    const erro = await cancelarTitulo(titulo.id);
    if (erro) setAviso({ tipo: 'erro', texto: erro });
    // Título cancelado sai da conferência.
    else setVersaoConferencia((v) => v + 1);
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Contas a Receber</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Títulos formados por lotes do apLIS, com as baixas registradas aqui e as glosas do apLIS
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* A réplica do apLIS atrasa ~1 dia: sem o aviso, o lote fechado hoje
              "faltando" (ou a baixa de hoje no apLIS) parece defeito do botão. */}
          <span className="text-[11px] text-gray-400 dark:text-gray-500">dados do apLIS até ontem</span>
          {/* Só leitura: visível a quem vê o Contas a Receber (canViewBilling,
              já exigido pela rota), não só a quem edita. */}
          <button
            type="button"
            onClick={() => setConferenciaAberta(true)}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Scale className="w-4 h-4" />
            Conferir baixas com o apLIS
          </button>
          {podeEditar && (
            <button
              type="button"
              onClick={() => setAplicarBaixasAberto(true)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <CheckCheck className="w-4 h-4" />
              Aplicar baixas do apLIS
            </button>
          )}
          {podeEditar && (
            <button
              type="button"
              onClick={() => setAtualizarAplisAberto(true)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <DownloadCloud className="w-4 h-4" />
              Atualizar do apLIS
            </button>
          )}
          {podeEditar && (
            <button
              type="button"
              onClick={sincronizarOperadoras}
              disabled={sincronizando}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${sincronizando ? 'animate-spin' : ''}`} />
              Sincronizar operadoras
            </button>
          )}
        </div>
      </div>

      {aviso && (
        <div
          className={`p-3 rounded-xl border text-sm flex items-center justify-between gap-2 ${
            aviso.tipo === 'erro'
              ? 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              : 'border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
          }`}
        >
          <span>{aviso.texto}</span>
          <button type="button" onClick={() => setAviso(null)} className="text-xs underline">fechar</button>
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-100 dark:border-gray-700">
        {([
          { id: 'dashboard' as Aba, rotulo: 'Dashboard', icone: BarChart3 },
          { id: 'titulos' as Aba, rotulo: 'Títulos', icone: ListChecks },
          { id: 'envios' as Aba, rotulo: 'Envios', icone: Send },
          { id: 'pendencias' as Aba, rotulo: 'Pendências', icone: AlertTriangle },
        ]).map(({ id, rotulo, icone: Icone }) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 -mb-px ${
              aba === id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Icone className="w-4 h-4" /> {rotulo}
          </button>
        ))}
      </div>

      {aba === 'dashboard' && (
        <ContasReceberDashboard
          filtros={filtrosPainel}
          onFiltrar={aplicarFiltroPainel}
          onLimpar={limparFiltroPainel}
          padrao={padraoPainel}
          operadoras={operadoras}
          podeEditar={podeEditar}
          onNavegarPendencias={navegarParaPendencias}
          onNavegarMeta={navegarParaTitulosMeta}
        />
      )}

      {aba === 'titulos' && conferencia.refechamentos && (
        <RefechamentosAplisAviso refechamentos={conferencia.refechamentos} podeAplicar={podeEditar} />
      )}

      {aba === 'titulos' && (
        <RefechamentosAplicadosAviso
          aplicados={refechamentosAplicados}
          onFechar={() => setRefechamentosAplicados([])}
        />
      )}

      {aba === 'titulos' && (
        <TitulosList
          titulos={titulos}
          operadoras={operadoras}
          total={total}
          totais={totais}
          // Com o filtro "Divergente do apLIS" ligado, a lista depende da
          // conferência: até ela chegar, é "carregando", não "nenhum título".
          loading={loading || (filtros.divergenteAplis && !conferencia.titulos && !conferencia.erro)}
          error={error}
          erroGlosasAplis={erroGlosasAplis}
          divergencias={conferencia.porTitulo}
          erroConferencia={conferencia.erro}
          podeEditar={podeEditar}
          filtros={filtros}
          onFiltrar={aplicarFiltro}
          onAtualizar={() => void atualizarTitulos()}
          onNovoTitulo={() => setNovoAberto(true)}
          onGerenciarParceiras={() => setParceirasAberto(true)}
          onGerenciarRegraNf={() => setRegraNfAberto(true)}
          onGerenciarConsideradaMeta={() => setConsideradaMetaAberto(true)}
          onBaixa={abrirBaixa}
          onCancelar={(titulo) => void confirmarCancelamento(titulo)}
          onEditar={abrirEditar}
          onDesvincularLote={desvincularLote}
          buscarGuias={buscarGuias}
          buscarEnvioLotes={buscarEnvioLotes}
          buscarBaixas={buscarBaixas}
          buscarGlosasAplis={buscarGlosasAplis}
          buscarAlteracoes={buscarAlteracoes}
          buscarNfsCanceladas={buscarNfsCanceladas}
          camadaSobreposta={tituloBaixa !== null || tituloEditar !== null}
        />
      )}

      {aba === 'envios' && <EnviosPorConvenio />}

      {aba === 'pendencias' && (
        <div className="space-y-4">
          <div className="flex gap-1">
            {([
              { id: 'lotes' as SubAbaPendencias, rotulo: 'Sem NF (lotes)' },
              { id: 'particulares' as SubAbaPendencias, rotulo: 'Particulares' },
              { id: 'semLote' as SubAbaPendencias, rotulo: 'Sem lote' },
            ]).map(({ id, rotulo }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSubAbaPendencias(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  subAbaPendencias === id
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>

          {subAbaPendencias === 'lotes' && <PendenciasNaoFaturadas operadoras={operadoras} />}
          {subAbaPendencias === 'particulares' && <PendenciasParticulares podeEditar={podeEditar} />}
          {subAbaPendencias === 'semLote' && <PendenciasSemLote operadoras={operadoras} />}
        </div>
      )}

      <NovoTituloModal
        aberto={novoAberto}
        onFechar={() => setNovoAberto(false)}
        onCriar={criarTitulo}
      />

      <AtualizarAplisModal
        aberto={atualizarAplisAberto}
        onFechar={() => setAtualizarAplisAberto(false)}
        onAlterados={() => {
          void refetch();
          // Títulos novos ou lotes revinculados mudam a conferência.
          setVersaoConferencia((v) => v + 1);
        }}
      />

      <ConferenciaAplisModal
        aberto={conferenciaAberta}
        onFechar={() => setConferenciaAberta(false)}
        versao={versaoConferencia}
        podeAbrirTitulo={podeEditar}
        onAbrirTitulo={abrirTituloDaConferencia}
      />

      <AplicarBaixasAplisModal
        aberto={aplicarBaixasAberto}
        onFechar={() => setAplicarBaixasAberto(false)}
        onAlterados={() => {
          void refetch();
          setVersaoConferencia((v) => v + 1);
        }}
      />

      <BaixaModal
        titulo={tituloBaixa}
        onFechar={() => fecharLancamento(() => setTituloBaixa(null))}
        onRegistrar={async (dados) => anotarSalvo(await registrarBaixa(dados))}
      />

      <ClinicasParceirasModal
        aberto={parceirasAberto}
        onFechar={() => setParceirasAberto(false)}
        operadoras={operadoras}
        onAlternar={marcarClinicaParceira}
      />

      <RegraNfModal
        aberto={regraNfAberto}
        onFechar={() => setRegraNfAberto(false)}
        operadoras={operadoras}
        onAlternar={alternarNfAposPagamento}
      />

      <ConsideradaMetaModal
        aberto={consideradaMetaAberto}
        onFechar={() => setConsideradaMetaAberto(false)}
        operadoras={operadoras}
        onAlternar={marcarConsideradaMeta}
      />

      <EditarTituloModal
        titulo={tituloEditar}
        onFechar={() => fecharLancamento(() => setTituloEditar(null))}
        onSalvar={async (idNota, numeroNota, cancelamento) =>
          anotarSalvo(await atualizarNumeroNota(idNota, numeroNota, cancelamento))}
        buscarLancamentos={buscarLancamentos}
        buscarGuias={buscarGuias}
        onCorrigirLancamento={async (payload) => anotarSalvo(await corrigirLancamento(payload))}
        onExcluirBaixa={async (id, motivo) => anotarSalvo(await excluirBaixa(id, motivo))}
      />
    </div>
  );
};

export default ContasReceberPage;
