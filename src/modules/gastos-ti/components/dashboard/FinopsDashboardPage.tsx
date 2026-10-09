import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BellRing,
  Building2,
  Calculator,
  CalendarCheck,
  CalendarClock,
  Download,
  Grid,
  Layers,
  LayoutDashboard,
  ListTree,
  PieChart,
  PiggyBank,
  Repeat,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useTheme } from '../../../../hooks/useTheme';
import { formatCurrency } from '../../../../utils/paymentUtils';
import { dayKey } from '../../../../utils/datas';
import { calcularAlertas, ordenarAlertas, renovacoesProximas } from '../../domain/alertas';
import { competenciaDaData, formatarCompetencia, partesCompetencia, somarMeses } from '../../domain/competencia';
import { COR_OUTROS, PALETA_CATEGORIAS, corDoSlot, slotsDeCor } from '../../domain/coresCategorias';
import { custoUnitario, economiasDeRenegociacao, maioresDesvios, mapaDeCalor } from '../../domain/detalhamento';
import { linhasExportacaoMes } from '../../domain/exportacao';
import {
  CHAVE_OUTROS,
  FILTROS_FINOPS_VAZIOS,
  aPagar,
  agruparGasto,
  competenciasEntre,
  custoAnualizado,
  custoRecorrenteMensal,
  filtrarDespesasFinops,
  intervaloDeCarga,
  janelaEvolucao,
  medidaDoPeriodo,
  ocorrenciasNoPeriodo,
  periodoAnterior,
  periodoDoPreset,
  proporcoes,
  serieMensal,
  topComOutros,
  totaisDoPeriodo,
  variacaoPercentual,
  type FiltrosFinops,
  type GrupoGasto,
  type PeriodoFinops,
  type PresetPeriodo,
} from '../../domain/finops';
import { chaveTexto, nomesDistintos } from '../../domain/listaDespesas';
import { alertasDeOrcamento, consumoDoAno, orcadoPorMes, orcadoRealizadoPorCategoria, realizadoPorCategoria } from '../../domain/orcamento';
import { MESES_DO_CICLO, situacaoDespesa } from '../../domain/recorrencia';
import { cobrancasNaVisao, ocorrenciasNaVisao, resumoDoItem, type VisaoGasto } from '../../domain/visao';
import { useCanManageGastosTI } from '../../hooks/useCanManageGastosTI';
import { useCategoriasTI } from '../../hooks/useCategoriasTI';
import { useDespesasTI } from '../../hooks/useDespesasTI';
import { useLancamentosIntervaloTI } from '../../hooks/useLancamentosIntervaloTI';
import { useOrcamentosTI } from '../../hooks/useOrcamentosTI';
import GastosTIShell from '../GastosTIShell';
import MedidorConsumo from '../ui/MedidorConsumo';
import NumeroAnimado from '../ui/NumeroAnimado';
import Sparkline from '../ui/Sparkline';
import Vazio from '../ui/Vazio';
import Widget, { VIDRO } from '../ui/Widget';
import { ANEL_FOCO, BOTAO_VIDRO, CURVA_SAIDA, LINK_ACAO } from '../ui/estilos';
import AlertasCard from './AlertasCard';
import BarrasRanking, { TabelaRanking } from './BarrasRanking';
import CustoUnitarioTabela from './CustoUnitarioTabela';
import DesviosDivergentes, { TabelaDesvios } from './DesviosDivergentes';
import DetalhamentoTabela from './DetalhamentoTabela';
import EconomiasCard from './EconomiasCard';
import EvolucaoMensal, { TabelaEvolucao, type SerieCategoria } from './EvolucaoMensal';
import FiltrosFinopsBarra from './FiltrosFinops';
import KpiTile from './KpiTile';
import MapaCalor, { TabelaMapaCalor } from './MapaCalor';
import OrcadoRealizado, { TabelaOrcado } from './OrcadoRealizado';
import Par from './Proporcoes';
import RenovacoesCard from './RenovacoesCard';
import ResumoDrillDown, { type TipoDrill } from './ResumoDrillDown';

/** Qual filtro global cada tipo de barra aplica no drill-down (RF26). */
const CAMPO_DO_DRILL: Record<TipoDrill, 'categoriaId' | 'fornecedor' | 'setor'> = { categoria: 'categoriaId', fornecedor: 'fornecedor', setor: 'setor' };

const ROTULO_VISAO: Record<VisaoGasto, string> = { cobranca: 'cobrança', caixa: 'caixa', diluida: 'diluída' };

const pct = (v: number, casas = 0) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`;

const FinopsDashboardPage: React.FC = () => {
  const { theme } = useTheme();
  const hoje = dayKey(new Date());
  const atual = competenciaDaData(hoje) as string;
  const [preset, setPreset] = useState<PresetPeriodo>('12meses');
  const [personalizado, setPersonalizado] = useState<PeriodoFinops>(() => ({ desde: somarMeses(atual, -5), ate: atual }));
  const [filtros, setFiltros] = useState<FiltrosFinops>(FILTROS_FINOPS_VAZIOS);
  const [visao, setVisao] = useState<VisaoGasto>('cobranca');
  const [drill, setDrill] = useState<{ tipo: TipoDrill; valor: string; nome: string } | null>(null);

  const anoAtual = partesCompetencia(atual).ano;
  const periodo = useMemo(() => periodoDoPreset(preset, hoje, personalizado), [preset, hoje, personalizado]);
  // Além do período, o consumo do orçamento precisa do ano corrente inteiro (pode haver baixa adiantada de dezembro).
  const carga = useMemo(() => {
    const intervalo = intervaloDeCarga(periodo, hoje);
    const fimDoAno = `${anoAtual}-12-01`;
    return { desde: intervalo.desde, ate: intervalo.ate > fimDoAno ? intervalo.ate : fimDoAno };
  }, [periodo, hoje, anoAtual]);
  const janela = useMemo(() => janelaEvolucao(periodo, hoje), [periodo, hoje]);
  const podeGerenciar = useCanManageGastosTI();
  const { categorias } = useCategoriasTI();
  const { despesas, loading: carregandoDespesas, error: erroDespesas } = useDespesasTI();
  const { lancamentos, loading: carregandoLancamentos, error: erroLancamentos } = useLancamentosIntervaloTI(carga.desde, carga.ate);
  const { orcamentos, error: erroOrcamentos } = useOrcamentosTI();

  const slots = useMemo(() => slotsDeCor(categorias), [categorias]);
  const nomeCategoria = useMemo(() => {
    const nomes = new Map(categorias.map((c) => [c.id, c.nome]));
    return (id: string) => nomes.get(id) ?? 'Categoria removida';
  }, [categorias]);
  const fornecedores = useMemo(() => nomesDistintos(despesas.map((d) => d.fornecedorNome)), [despesas]);

  const filtradas = useMemo(() => filtrarDespesasFinops(despesas, filtros), [despesas, filtros]);
  const meses = useMemo(() => competenciasEntre(periodo.desde, periodo.ate), [periodo]);
  const anterior = useMemo(() => periodoAnterior(periodo), [periodo]);

  const indicadores = useMemo(() => {
    // Período, comparação e evolução seguem a visão escolhida (RF24) — tudo daqui
    // para baixo soma as ocorrências do mesmo jeito, só o mês de cada uma muda.
    const doPeriodo = ocorrenciasNaVisao(visao, filtradas, lancamentos, meses, hoje);
    const doAnterior = ocorrenciasNaVisao(visao, filtradas, lancamentos, competenciasEntre(anterior.desde, anterior.ate), hoje);
    const daJanela = ocorrenciasNaVisao(visao, filtradas, lancamentos, janela, hoje);
    // Alertas, a pagar, recorrente e renovações não dependem da visão: base cobrança.
    // "Agora": últimos 12 meses até o mês atual + o próximo (a pagar em 30 dias, alertas).
    const recentes = ocorrenciasNoPeriodo(filtradas, lancamentos, competenciasEntre(somarMeses(atual, -11), somarMeses(atual, 1)), hoje);

    const totais = totaisDoPeriodo(doPeriodo);
    const totaisAnterior = totaisDoPeriodo(doAnterior);
    const medida = medidaDoPeriodo(totais);
    const chaveDaCategoria = (id: string) => (slots.get(id) === null || slots.get(id) === undefined ? CHAVE_OUTROS : id);
    const serie = serieMensal(daJanela, janela, hoje, chaveDaCategoria);
    const recorrente = custoRecorrenteMensal(filtradas, lancamentos, hoje);

    return {
      doPeriodo,
      // Detalhamento e exportação listam cobranças inteiras, nunca fatias da visão diluída.
      cobrancasDoPeriodo: cobrancasNaVisao(visao, filtradas, lancamentos, meses, hoje),
      totais,
      variacao: variacaoPercentual(totais.realizado, totaisAnterior.realizado),
      medida,
      serie,
      sparkline: serie.filter((p) => !p.projecao).map((p) => p.total),
      recorrente,
      recorrentesAtivas: filtradas.filter((d) => MESES_DO_CICLO[d.recorrencia] > 0 && situacaoDespesa(d, atual) === 'ativa').length,
      anualizado: custoAnualizado(filtradas, recorrente, anoAtual),
      aPagar: aPagar(recentes.filter((o) => o.competencia <= somarMeses(atual, 1)), hoje),
      porCategoria: agruparGasto(doPeriodo, (o) => ({ chave: o.despesa.categoriaId, nome: nomeCategoria(o.despesa.categoriaId) }), medida),
      porFornecedor: agruparGasto(doPeriodo, (o) => ({ chave: o.despesa.fornecedorNome.toLowerCase(), nome: o.despesa.fornecedorNome }), medida),
      porSetor: agruparGasto(doPeriodo, (o) => ({ chave: o.despesa.setor ?? '—', nome: o.despesa.setor ?? 'Toda a empresa / sem setor' }), medida),
      proporcoes: proporcoes(doPeriodo, medida),
      alertas: calcularAlertas(
        recentes.filter((o) => o.competencia <= atual),
        filtradas,
        hoje,
      ),
      renovacoes: renovacoesProximas(filtradas, hoje),
      // Detalhamento avançado (issue 15). O mapa usa a janela da evolução, só os meses já vividos (é pago, não previsto).
      mapaCalor: mapaDeCalor(
        daJanela,
        janela.filter((c) => c <= atual),
        nomeCategoria,
      ),
      desvios: maioresDesvios(doPeriodo),
      custoUnitario: custoUnitario(filtradas, hoje),
      economias: economiasDeRenegociacao(filtradas, periodo.desde, periodo.ate),
    };
  }, [visao, filtradas, lancamentos, meses, anterior, janela, periodo, hoje, atual, anoAtual, slots, nomeCategoria]);

  // Drill-down (RF26): clicar numa barra aplica o filtro no painel inteiro (a barra
  // de filtros mostra) e abre o resumo. Se o filtro mudar por fora, o resumo fecha.
  const selecionar = (tipo: TipoDrill, g: GrupoGasto) => {
    // Fornecedor: usa a grafia da lista do filtro, para o select mostrar a opção certa.
    const valor = tipo === 'fornecedor' ? fornecedores.find((f) => chaveTexto(f) === chaveTexto(g.nome)) ?? g.nome : g.chave;
    setFiltros({ ...filtros, [CAMPO_DO_DRILL[tipo]]: valor });
    setDrill({ tipo, valor, nome: g.nome });
  };
  const drillAtivo = drill && filtros[CAMPO_DO_DRILL[drill.tipo]] === drill.valor ? drill : null;
  const resumoDrill = useMemo(() => (drillAtivo ? resumoDoItem(filtradas, lancamentos, hoje) : null), [drillAtivo, filtradas, lancamentos, hoje]);
  const removerFiltroDoDrill = () => {
    if (drillAtivo) setFiltros({ ...filtros, [CAMPO_DO_DRILL[drillAtivo.tipo]]: '' });
    setDrill(null);
  };

  // Orçamento (issue 14): é por categoria, então só o filtro de categoria se aplica a ele.
  // Com outro filtro ligado (fornecedor, setor…), o KPI avisa e a linha do gráfico some —
  // comparar o gasto de um fornecedor com o orçamento da categoria inteira enganaria.
  const filtroForaDoOrcamento = Boolean(filtros.fornecedor || filtros.setor || filtros.natureza || filtros.formaPagamento);
  const orcamento = useMemo(() => {
    const categoriasDoFiltro = filtros.categoriaId ? new Set([filtros.categoriaId]) : null;
    const realizadoAno = realizadoPorCategoria(lancamentos, despesas, anoAtual);
    const consumos = orcadoRealizadoPorCategoria(orcamentos, realizadoAno, anoAtual, nomeCategoria).filter(
      (c) => !categoriasDoFiltro || categoriasDoFiltro.has(c.categoriaId),
    );
    return {
      consumo: consumoDoAno(orcamentos, realizadoAno, anoAtual, hoje, categoriasDoFiltro),
      consumos,
      porMes: orcadoPorMes(orcamentos, janela, categoriasDoFiltro),
      alertas: alertasDeOrcamento(consumos, anoAtual),
    };
  }, [orcamentos, lancamentos, despesas, anoAtual, hoje, janela, filtros.categoriaId, nomeCategoria]);
  const alertas = useMemo(() => ordenarAlertas([...indicadores.alertas, ...orcamento.alertas]), [indicadores.alertas, orcamento.alertas]);
  const orcamentoDoGrafico = filtroForaDoOrcamento ? undefined : orcamento.porMes;

  // Séries da evolução: categorias com cor própria na ordem da paleta (a cor segue a
  // categoria), só as que aparecem na janela, e "Outros" em cinza no fim.
  const series = useMemo((): SerieCategoria[] => {
    const comValor = new Set(indicadores.serie.flatMap((p) => Object.keys(p.valores)));
    const lista: SerieCategoria[] = categorias
      .filter((c) => slots.get(c.id) !== null && slots.get(c.id) !== undefined && comValor.has(c.id))
      .map((c) => ({ chave: c.id, nome: c.nome, cor: corDoSlot(slots.get(c.id), theme) }));
    if (comValor.has(CHAVE_OUTROS)) lista.push({ chave: CHAVE_OUTROS, nome: 'Outros', cor: COR_OUTROS });
    return lista;
  }, [indicadores.serie, categorias, slots, theme]);

  const corUnica = PALETA_CATEGORIAS[theme][0];
  const corCategoria = (chave: string) => corDoSlot(slots.get(chave), theme);
  const fornecedoresTop = topComOutros(indicadores.porFornecedor, 10);
  const top3 = indicadores.porFornecedor[Math.min(2, indicadores.porFornecedor.length - 1)];
  const rotuloPeriodo =
    periodo.desde === periodo.ate ? formatarCompetencia(periodo.desde) : `${formatarCompetencia(periodo.desde)} a ${formatarCompetencia(periodo.ate)}`;
  const rotuloMedida = indicadores.medida === 'realizado' ? 'Pago' : 'Previsto (o período ainda não tem pagamentos)';
  const erro = erroDespesas ?? erroLancamentos;

  const exportar = () => {
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet(linhasExportacaoMes(indicadores.cobrancasDoPeriodo, nomeCategoria)), 'Cobranças');
    const sufixoVisao = visao === 'caixa' ? '_caixa' : '';
    XLSX.writeFile(livro, `gastos_ti_${periodo.desde.slice(0, 7)}_a_${periodo.ate.slice(0, 7)}${sufixoVisao}.xlsx`);
  };

  if (carregandoDespesas && despesas.length === 0) {
    // Esqueleto com a forma do painel (filtros, 6 tiles, gráfico), em brilho
    // corrido (.skeleton tem variante escura) — nada de bloco piscando.
    return (
      <GastosTIShell subtitulo="Visão FinOps do que a TI gasta">
        <div className="space-y-6" aria-busy="true" aria-label="Carregando o dashboard">
          <div className="skeleton !rounded-3xl h-32" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton !rounded-3xl h-40" style={{ animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
          <div className="skeleton !rounded-3xl h-96" />
        </div>
      </GastosTIShell>
    );
  }

  if (!carregandoDespesas && despesas.length === 0 && !erro) {
    return (
      <GastosTIShell subtitulo="Visão FinOps do que a TI gasta">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: CURVA_SAIDA }}
          className={`${VIDRO} rounded-3xl p-12 text-center`}
        >
          <div className="relative w-16 h-16 mx-auto mb-5">
            <div className="absolute inset-0 bg-violet-500 rounded-3xl blur-xl opacity-30" />
            <div className="relative w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-violet-500/30">
              <LayoutDashboard className="w-8 h-8 text-white" />
            </div>
          </div>
          <h3 className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100">Ainda não há despesas</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">O dashboard aparece quando houver despesas cadastradas.</p>
          <Link
            to="/it/gastos/despesas"
            className={`mt-5 inline-flex items-center gap-2 px-5 h-10 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-500/25 ${ANEL_FOCO}`}
          >
            Ir para Despesas
          </Link>
        </motion.div>
      </GastosTIShell>
    );
  }

  const variacao = indicadores.variacao;

  return (
    <GastosTIShell
      subtitulo="Visão FinOps do que a TI gasta"
      acoes={
        <button type="button" onClick={exportar} disabled={indicadores.cobrancasDoPeriodo.length === 0} className={BOTAO_VIDRO}>
          <Download className="w-4 h-4" />
          Exportar
        </button>
      }
    >
      <FiltrosFinopsBarra
        preset={preset}
        onPreset={setPreset}
        personalizado={personalizado}
        onPersonalizado={setPersonalizado}
        filtros={filtros}
        onFiltros={setFiltros}
        categorias={categorias}
        fornecedores={fornecedores}
        visao={visao}
        onVisao={setVisao}
        carregando={carregandoLancamentos}
      />

      {erro && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-red-200/80 dark:border-red-800/50 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-md px-4 py-3 text-sm text-red-800 dark:text-red-200"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" aria-hidden="true" />
          {erro}
        </div>
      )}

      {/* Ao trocar de período, o conteúdo esmaece em vez de piscar (dataviz: refetch mantém o quadro). */}
      <div className={`space-y-6 transition-opacity duration-300 ${carregandoLancamentos ? 'opacity-60' : ''}`} aria-busy={carregandoLancamentos}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <KpiTile
            rotulo="Realizado"
            valor={<NumeroAnimado valor={indicadores.totais.realizado} formatar={formatCurrency} />}
            icone={Wallet}
            tom="violeta"
            indice={0}
            canto={<Sparkline valores={indicadores.sparkline} corDestaque={corUnica} rotulo="Realizado dos últimos meses" />}
            sub={
              variacao === null ? (
                <span>{rotuloPeriodo}</span>
              ) : (
                <span className="inline-flex items-center gap-0.5">
                  {variacao >= 0 ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  )}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {variacao >= 0 ? '+' : '−'}
                    {pct(Math.abs(variacao))}
                  </span>{' '}
                  vs período anterior
                </span>
              )
            }
          />
          <KpiTile
            rotulo="Previsto"
            valor={<NumeroAnimado valor={indicadores.totais.previsto} formatar={formatCurrency} />}
            icone={CalendarClock}
            tom="azul"
            indice={1}
            sub={indicadores.totais.previsto > 0 ? `${pct((indicadores.totais.realizado / indicadores.totais.previsto) * 100)} já pago · ${rotuloPeriodo}` : rotuloPeriodo}
          />
          <KpiTile
            rotulo="Custo recorrente"
            valor={<NumeroAnimado valor={indicadores.recorrente} formatar={formatCurrency} />}
            sufixo="/mês"
            icone={Repeat}
            tom="indigo"
            indice={2}
            sub={`${indicadores.recorrentesAtivas} ${indicadores.recorrentesAtivas === 1 ? 'despesa recorrente ativa' : 'despesas recorrentes ativas'}`}
          />
          <KpiTile
            rotulo="Anualizado"
            valor={<NumeroAnimado valor={indicadores.anualizado} formatar={formatCurrency} />}
            sufixo="/ano"
            icone={TrendingUp}
            tom="ceu"
            indice={3}
            sub={`recorrente × 12 + únicas de ${anoAtual}`}
          />
          {orcamento.consumo.orcado === null || orcamento.consumo.percentual === null || orcamento.consumo.status === 'sem_orcamento' ? (
            <KpiTile
              rotulo={`Orçamento ${anoAtual}`}
              valor="—"
              icone={Target}
              tom="ardosia"
              indice={4}
              sub={erroOrcamentos ? 'Orçamento indisponível' : filtros.categoriaId ? 'Categoria sem orçamento' : 'Sem orçamento cadastrado'}
              extra={
                podeGerenciar &&
                !erroOrcamentos && (
                  <Link to="/it/gastos/orcamento" className={LINK_ACAO}>
                    Cadastrar orçamento <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                )
              }
            />
          ) : (
            <KpiTile
              rotulo={`Orçamento ${anoAtual}`}
              valor={Number.isFinite(orcamento.consumo.percentual) ? <NumeroAnimado valor={orcamento.consumo.percentual} formatar={(v) => pct(v)} /> : 'sem limite'}
              sufixo={Number.isFinite(orcamento.consumo.percentual) ? ' usado' : undefined}
              icone={Target}
              tom="ambar"
              indice={4}
              sub={
                filtroForaDoOrcamento
                  ? 'Só o filtro de categoria vale aqui'
                  : `${formatCurrency(orcamento.consumo.realizado)} de ${formatCurrency(orcamento.consumo.orcado)}`
              }
              extra={
                <MedidorConsumo
                  percentual={orcamento.consumo.percentual}
                  status={orcamento.consumo.status}
                  ritmo={orcamento.consumo.ritmo}
                  mostrarPercentual={false}
                />
              }
            />
          )}
          <KpiTile
            rotulo="A pagar em 30 dias"
            valor={<NumeroAnimado valor={indicadores.aPagar.total} formatar={formatCurrency} />}
            icone={CalendarCheck}
            tom="esmeralda"
            indice={5}
            sub={`${indicadores.aPagar.quantidade} ${indicadores.aPagar.quantidade === 1 ? 'cobrança' : 'cobranças'}`}
            extra={
              indicadores.aPagar.vencidasQuantidade > 0 && (
                <Link
                  to="/it/gastos/mes-a-mes"
                  className={`inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-500/15 border border-red-200/80 dark:border-red-500/30 hover:bg-red-100 dark:hover:bg-red-500/25 ${ANEL_FOCO}`}
                >
                  <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  {indicadores.aPagar.vencidasQuantidade} vencida{indicadores.aPagar.vencidasQuantidade > 1 ? 's' : ''} ·{' '}
                  {formatCurrency(indicadores.aPagar.vencidasTotal)}
                </Link>
              )
            }
          />
        </div>

        <Widget
          titulo="Evolução mensal por categoria"
          sub={`Visão ${ROTULO_VISAO[visao]}. Pago por mês até ${formatarCompetencia(atual)}; meses seguintes mostram o previsto. 12 meses até o fim do período.`}
          icone={BarChart3}
          tabela={<TabelaEvolucao pontos={indicadores.serie} series={series} orcamento={orcamentoDoGrafico} />}
          atraso={0}
        >
          {indicadores.serie.every((p) => p.total === 0) ? (
            <Vazio>Sem pagamentos nem previsão na janela.</Vazio>
          ) : (
            <EvolucaoMensal pontos={indicadores.serie} series={series} orcamento={orcamentoDoGrafico} tema={theme} />
          )}
        </Widget>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Widget
            titulo="Por categoria"
            sub={`${rotuloMedida} · ${rotuloPeriodo} · clique para filtrar`}
            icone={Layers}
            tabela={<TabelaRanking grupos={indicadores.porCategoria} rotulo="Categoria" />}
            atraso={0}
          >
            <BarrasRanking grupos={indicadores.porCategoria} corDe={corCategoria} vazio="Sem gasto no período." onSelecionar={(g) => selecionar('categoria', g)} />
          </Widget>
          <Widget
            titulo="Orçado × realizado por categoria"
            sub={`Pago em ${anoAtual} contra o orçamento do ano · independe do período`}
            icone={Target}
            tabela={orcamento.consumos.length > 0 ? <TabelaOrcado consumos={orcamento.consumos} /> : undefined}
            atraso={1}
          >
            <OrcadoRealizado consumos={orcamento.consumos} ano={anoAtual} corDe={corCategoria} podeGerenciar={podeGerenciar} />
          </Widget>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <Widget
            titulo="Fornecedores"
            sub={
              top3 && indicadores.porFornecedor.length >= 3
                ? `Os 3 maiores somam ${pct(top3.acumulado)} do gasto · ${rotuloPeriodo}`
                : `${rotuloMedida} · ${rotuloPeriodo}`
            }
            icone={Building2}
            tabela={<TabelaRanking grupos={fornecedoresTop} rotulo="Fornecedor" />}
            atraso={0}
          >
            <BarrasRanking
              grupos={fornecedoresTop}
              corDe={() => corUnica}
              mostrarAcumulado
              vazio="Sem gasto no período."
              onSelecionar={(g) => selecionar('fornecedor', g)}
              podeSelecionar={(g) => g.chave !== CHAVE_OUTROS}
            />
          </Widget>
          <Widget
            titulo="Por setor beneficiado"
            sub={`${rotuloMedida} · ${rotuloPeriodo}`}
            icone={Users}
            tabela={<TabelaRanking grupos={indicadores.porSetor} rotulo="Setor" />}
            atraso={1}
          >
            <BarrasRanking
              grupos={indicadores.porSetor}
              corDe={() => corUnica}
              vazio="Sem gasto no período."
              onSelecionar={(g) => selecionar('setor', g)}
              podeSelecionar={(g) => g.chave !== '—'}
            />
          </Widget>
          <Widget titulo="Composição do gasto" sub={`${rotuloMedida} · ${rotuloPeriodo}`} icone={PieChart} className="lg:col-span-2 xl:col-span-1" atraso={2}>
            <div className="space-y-5 pt-1">
              <Par
                titulo="Recorrente × pontual"
                a={{ rotulo: 'Recorrente', valor: indicadores.proporcoes.recorrente, cor: PALETA_CATEGORIAS[theme][0] }}
                b={{ rotulo: 'Pontual', valor: indicadores.proporcoes.pontual, cor: PALETA_CATEGORIAS[theme][1] }}
              />
              <Par
                titulo="OPEX × CAPEX"
                a={{ rotulo: 'OPEX', valor: indicadores.proporcoes.opex, cor: PALETA_CATEGORIAS[theme][0] }}
                b={{ rotulo: 'CAPEX', valor: indicadores.proporcoes.capex, cor: PALETA_CATEGORIAS[theme][1] }}
              />
            </div>
          </Widget>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Widget titulo="Alertas" sub="Últimos 12 meses até hoje e orçamento do ano, com os filtros aplicados" icone={BellRing} atraso={0}>
            <AlertasCard alertas={alertas} />
          </Widget>
          <Widget titulo="Renovações nos próximos 90 dias" sub="Contratos com fim definido" icone={CalendarClock} atraso={1}>
            <RenovacoesCard renovacoes={indicadores.renovacoes} />
          </Widget>
        </div>

        <Widget
          titulo="Mapa de calor: categoria × mês"
          sub="Pago por mês, na mesma janela da evolução (sem os meses de projeção)"
          icone={Grid}
          tabela={indicadores.mapaCalor.linhas.length > 0 ? <TabelaMapaCalor mapa={indicadores.mapaCalor} /> : undefined}
          atraso={0}
        >
          <MapaCalor mapa={indicadores.mapaCalor} tema={theme} />
        </Widget>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Widget
            titulo="Maiores desvios"
            sub={`Pago × previsto original (sem os ajustes do mês) · ${rotuloPeriodo}`}
            icone={ArrowLeftRight}
            tabela={indicadores.desvios.length > 0 ? <TabelaDesvios desvios={indicadores.desvios} /> : undefined}
            atraso={0}
          >
            <DesviosDivergentes desvios={indicadores.desvios} tema={theme} />
          </Widget>
          <Widget
            titulo="Economias em renegociações"
            sub={`Reajustes "Renegociação" que baixaram o valor, anualizados · ${rotuloPeriodo}`}
            icone={PiggyBank}
            atraso={1}
          >
            <EconomiasCard economias={indicadores.economias} />
          </Widget>
        </div>

        <Widget
          titulo="Custo unitário"
          sub="Despesas recorrentes ativas com quantidade: quanto custa cada licença ou usuário por mês hoje"
          icone={Calculator}
          atraso={0}
        >
          <CustoUnitarioTabela linhas={indicadores.custoUnitario} ano={anoAtual} />
        </Widget>

        <Widget
          titulo="Detalhamento"
          sub={
            visao === 'caixa'
              ? `Cobranças pagas (ou a vencer) em ${rotuloPeriodo}, cada uma no mês a que se refere`
              : visao === 'diluida'
                ? `Cobranças de ${rotuloPeriodo}, inteiras (a visão diluída só muda os gráficos e totais)`
                : `Todas as cobranças de ${rotuloPeriodo}`
          }
          icone={ListTree}
          atraso={0}
        >
          <DetalhamentoTabela ocorrencias={indicadores.cobrancasDoPeriodo} nomeCategoria={nomeCategoria} />
        </Widget>
      </div>

      {/* AnimatePresence: o resumo sai deslizando em vez de sumir. */}
      <AnimatePresence>
        {drillAtivo && resumoDrill && (
          <ResumoDrillDown
            key={`${drillAtivo.tipo}:${drillAtivo.valor}`}
            tipo={drillAtivo.tipo}
            nome={drillAtivo.nome}
            resumo={resumoDrill}
            atual={atual}
            cor={drillAtivo.tipo === 'categoria' ? corCategoria(drillAtivo.valor) : corUnica}
            nomeCategoria={nomeCategoria}
            onFechar={() => setDrill(null)}
            onRemoverFiltro={removerFiltroDoDrill}
          />
        )}
      </AnimatePresence>
    </GastosTIShell>
  );
};

export default FinopsDashboardPage;
