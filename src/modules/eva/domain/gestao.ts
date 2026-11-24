// Gestão da TI (D38, issue 27): o painel do gestor. Dele saem o relatório pelo WhatsApp (o do dia
// e o da semana), o bloco das perguntas de gestão no chat e no WhatsApp, e os alertas na hora.
// Puro: recebe `hoje` e `agora`. Os números saem das regras do Início (demandas, projetos) e do
// painel das Solicitações de TI (itSla, itDashboard); nada aqui é escrito pela IA.
// A api/ (NodeNext) importa este arquivo: os imports levam ".js".
import { diaSP, diferencaDias, ehDiaUtil, formatarDiaMes, inicioDaSemana, pluralDias, somarDias, diaDaSemana, type Dia } from './datas.js';
import {
  diasDeAtraso, diaVencimento, ehDoUsuario, estaAberto, estaConcluido, estaParado, estaVisivel, ordenarAtrasados,
  type CardTI, type ColunaKanban, type Prioridade, type StatusChamado,
} from './demandas.js';
import { projetosEmAndamento, tempoDecorrido, type ProjetoTI, type ResumoProjeto, type SprintTI } from './projetos.js';
import { ausenciaProxima, descreverAusencia, estaAusente, inicioDaAusencia, type Ausencia } from './ausencia.js';
import { nomeParaCitar } from './pessoas.js';
import { getSlaStatus } from '../../../utils/itSla.js';
import { formatarDuracao } from '../../../utils/itDashboard.js';

// ── Entrada ──────────────────────────────────────────────────────────────────

/** Chamado de usuário: it_requests com is_internal = false (o que a tela de Solicitações de TI lista). */
export interface ChamadoGestao {
  id: string;
  codigo: string;
  title: string;
  priority: Prioridade;
  status: StatusChamado;
  created_at: string;
  resolved_at: string | null;
  kanban_status: ColunaKanban | null;
  kanban_hidden: boolean | null;
}

/** De `de` a `ate`, os dois inclusos. */
export interface Periodo { de: Dia; ate: Dia }

/** Os 7 dias até hoje, hoje incluso: o "como foi a semana?" e o painel das perguntas. */
export const ultimos7Dias = (hoje: Dia): Periodo => ({ de: somarDias(hoje, -6), ate: hoje });

/** A semana anterior, de segunda a domingo: o relatório de segunda. */
export function semanaAnterior(hoje: Dia): Periodo {
  const segunda = inicioDaSemana(hoje);
  return { de: somarDias(segunda, -7), ate: somarDias(segunda, -1) };
}

/** O período do mesmo tamanho, logo antes: a comparação. */
export function periodoAnterior(p: Periodo): Periodo {
  const dias = diferencaDias(p.de, p.ate) + 1;
  return { de: somarDias(p.de, -dias), ate: somarDias(p.de, -1) };
}

const noPeriodo = (dia: Dia, p: Periodo) => dia >= p.de && dia <= p.ate;

/** O dia útil antes de hoje: o "novo atraso" é o que venceu desde o último relatório. */
export function diaUtilAnterior(hoje: Dia): Dia {
  let d = somarDias(hoje, -1);
  while (!ehDiaUtil(d)) d = somarDias(d, -1);
  return d;
}

export interface EntradaGestao {
  hoje: Dia;
  agora: number;
  periodo: Periodo;
  /** Cards do Kanban: os abertos e os concluídos desde o início do período anterior, pelo menos. */
  cards: CardTI[];
  projetos: ProjetoTI[];
  sprints: SprintTI[];
  /** Os chamados abertos e os criados ou resolvidos desde o início do período anterior. */
  chamados: ChamadoGestao[];
  /** Nome de quem aparece (membros e responsáveis), para os textos. */
  pessoas: Record<string, string>;
  /** Ids dos membros ativos da aba Membros: as linhas do "por pessoa". */
  equipe: string[];
  /** RN04 (ti_agente_config.dias_parado). */
  diasParado: number;
  /** Último comentário de cada card em andamento ou revisão (RN04: comentário conta como mudança). */
  ultimoComentario?: Record<string, string>;
  sugestoesPendentes: number;
  /** created_at da sugestão pendente mais antiga. */
  sugestaoMaisAntiga: string | null;
  /** Ids dos atrasados cuja última cobrança saiu e ficou sem resposta (a regra dos comentários do Início). */
  cardsSemResposta: string[];
  /** Ausência marcada de cada pessoa (D40), por user id. */
  ausencias?: Record<string, Ausencia>;
}

// ── O painel ─────────────────────────────────────────────────────────────────

export interface PessoaGestao {
  id: string;
  abertos: number;
  atrasados: number;
  parados: number;
  concluidos: number;
  /** "de férias até 05/12", para quem está ausente ou sai nos próximos 7 dias (D40). */
  ausencia: string | null;
  /** Está ausente hoje: fica fora da conta de sobrecarga. */
  ausente: boolean;
}

/** Quem sai (ou já saiu) e deixa card vencendo no período: o gestor decide quem cobre (D40). */
export interface CoberturaAusencia { id: string; ausencia: string; vencem: CardTI[]; sugestao: string | null }
export interface ProjetoGestao extends ResumoProjeto { decorrido: number | null }
export interface ForaDoPrazo { chamado: ChamadoGestao; atrasoMs: number }

export interface PainelGestao {
  hoje: Dia;
  periodo: Periodo;
  anterior: Periodo;
  kanban: {
    abertos: number;
    atrasados: number;
    /** Venceram desde o último dia útil (o que entrou em atraso desde o último relatório). */
    novosAtrasos: number;
    vencemHoje: number;
    parados: number;
    criticosAtrasados: CardTI[];
  };
  /** Cards concluídos, pelo updated_at (não há coluna de conclusão, como no Início). */
  entregas: { periodo: number; anterior: number };
  chamados: {
    naFila: number;
    /** Na fila e fora do prazo para iniciar (SLA), do mais urgente para o menos. */
    foraDoPrazo: ForaDoPrazo[];
    emAndamento: number;
    abertos: number;
    resolvidos: number;
    tempoMedioMs: number | null;
    abertosAnterior: number;
    resolvidosAnterior: number;
    tempoMedioAnteriorMs: number | null;
  };
  pessoas: PessoaGestao[];
  projetos: ProjetoGestao[];
  pendencias: { sugestoes: number; sugestaoHaDias: number | null; cobrancasSemResposta: number };
  /** Ausências com cards vencendo no período, e quem pode cobrir (o presente com menos abertos). */
  coberturas: CoberturaAusencia[];
  /** Como cada pessoa aparece no texto: o primeiro nome, ou o inteiro quando há xará. */
  nomes: Record<string, string>;
}

const PESO: Record<Prioridade, number> = { critical: 4, high: 3, medium: 2, low: 1 };
/** Concluídos dos últimos 14 dias: o mesmo recorte do Início, para o "feito" dos projetos bater com a tela. */
const DIAS_CONCLUIDOS_INICIO = 14;

export function montarPainelGestao(e: EntradaGestao): PainelGestao {
  const { hoje, periodo } = e;
  const anterior = periodoAnterior(periodo);
  const visiveis = e.cards.filter(estaVisivel);
  const abertos = visiveis.filter(estaAberto);
  const atrasados = ordenarAtrasados(visiveis, hoje);
  const desde = diaUtilAnterior(hoje);
  const parado = (c: CardTI) => estaParado(c, hoje, e.diasParado, e.ultimoComentario?.[c.id] ?? null);
  const concluidoEm = (c: CardTI, p: Periodo) => estaConcluido(c) && noPeriodo(diaSP(c.updated_at), p);

  // Chamados: as contas do painel das Solicitações de TI, com o período em dias de Brasília.
  const agora = new Date(e.agora);
  const foraDoPrazo: ForaDoPrazo[] = [];
  let naFila = 0;
  let emAndamento = 0;
  const conta = { abertos: 0, resolvidos: 0, somaMs: 0, abertosAnt: 0, resolvidosAnt: 0, somaAntMs: 0 };
  for (const c of e.chamados) {
    if (c.status === 'pending') {
      naFila += 1;
      const sla = getSlaStatus(c.created_at, c.priority, { status: c.status, kanbanStatus: c.kanban_status, kanbanHidden: c.kanban_hidden, now: agora });
      if (sla.isOverdue) foraDoPrazo.push({ chamado: c, atrasoMs: e.agora - sla.deadline.getTime() });
    }
    if (c.status === 'in_progress') emAndamento += 1;
    const criado = diaSP(c.created_at);
    if (noPeriodo(criado, periodo)) conta.abertos += 1;
    if (noPeriodo(criado, anterior)) conta.abertosAnt += 1;
    if (c.status === 'resolved' && c.resolved_at) {
      const ms = Math.max(0, Date.parse(c.resolved_at) - Date.parse(c.created_at));
      const resolvido = diaSP(c.resolved_at);
      if (noPeriodo(resolvido, periodo)) { conta.resolvidos += 1; conta.somaMs += ms; }
      if (noPeriodo(resolvido, anterior)) { conta.resolvidosAnt += 1; conta.somaAntMs += ms; }
    }
  }
  foraDoPrazo.sort((a, b) => PESO[b.chamado.priority] - PESO[a.chamado.priority] || b.atrasoMs - a.atrasoMs);

  const ausenciaDe = (id: string): Ausencia => e.ausencias?.[id] ?? { ausente_de: null, ausente_ate: null };
  const todasAsPessoas: PessoaGestao[] = e.equipe.map((id) => {
    const dela = visiveis.filter((c) => ehDoUsuario(c, id));
    const abertosDela = dela.filter(estaAberto);
    const a = ausenciaDe(id);
    return {
      id,
      abertos: abertosDela.length,
      atrasados: atrasados.filter((c) => ehDoUsuario(c, id)).length,
      parados: abertosDela.filter(parado).length,
      concluidos: dela.filter((c) => concluidoEm(c, periodo)).length,
      ausencia: ausenciaProxima(a, hoje) ? descreverAusencia(a, hoje) : null,
      ausente: estaAusente(a, hoje),
    };
  });
  const pessoas = todasAsPessoas
    .filter((p) => p.abertos + p.concluidos > 0)
    .sort((a, b) => b.atrasados - a.atrasados || b.abertos - a.abertos || (e.pessoas[a.id] ?? '').localeCompare(e.pessoas[b.id] ?? '', 'pt-BR'));

  // D40: quem está ausente (ou sai nos próximos 7 dias) e tem card vencendo no período; cobre quem
  // está presente e tem menos cards abertos.
  const quemCobre = (fora: string) => todasAsPessoas
    .filter((x) => x.id !== fora && !x.ausente)
    .sort((a, b) => a.abertos - b.abertos || (e.pessoas[a.id] ?? '').localeCompare(e.pessoas[b.id] ?? '', 'pt-BR'))[0]?.id ?? null;
  const coberturas: CoberturaAusencia[] = todasAsPessoas.flatMap((x) => {
    const a = ausenciaDe(x.id);
    if (!x.ausencia || !a.ausente_ate) return [];
    const de = inicioDaAusencia(a, hoje);
    const vencem = abertos.filter((c) => ehDoUsuario(c, x.id) && diaVencimento(c) !== null && diaVencimento(c)! >= de && diaVencimento(c)! <= a.ausente_ate!);
    return vencem.length ? [{ id: x.id, ausencia: x.ausencia, vencem, sugestao: quemCobre(x.id) }] : [];
  });

  const doInicio = visiveis.filter((c) => estaAberto(c) || diaSP(c.updated_at) >= somarDias(hoje, -DIAS_CONCLUIDOS_INICIO));
  const projetos = projetosEmAndamento(e.projetos, doInicio, e.sprints, hoje)
    .map((r) => ({ ...r, decorrido: r.sprint ? tempoDecorrido(r.sprint, hoje) : null }));

  const todosOsNomes = Object.values(e.pessoas);
  const nomes = Object.fromEntries(Object.entries(e.pessoas).map(([id, nome]) => [id, nomeParaCitar(nome, todosOsNomes)]));

  return {
    hoje,
    periodo,
    anterior,
    kanban: {
      abertos: abertos.length,
      atrasados: atrasados.length,
      novosAtrasos: atrasados.filter((c) => diaVencimento(c)! >= desde).length,
      vencemHoje: abertos.filter((c) => diaVencimento(c) === hoje).length,
      parados: abertos.filter(parado).length,
      criticosAtrasados: atrasados.filter((c) => c.priority === 'critical'),
    },
    entregas: { periodo: visiveis.filter((c) => concluidoEm(c, periodo)).length, anterior: visiveis.filter((c) => concluidoEm(c, anterior)).length },
    chamados: {
      naFila,
      foraDoPrazo,
      emAndamento,
      abertos: conta.abertos,
      resolvidos: conta.resolvidos,
      tempoMedioMs: conta.resolvidos ? conta.somaMs / conta.resolvidos : null,
      abertosAnterior: conta.abertosAnt,
      resolvidosAnterior: conta.resolvidosAnt,
      tempoMedioAnteriorMs: conta.resolvidosAnt ? conta.somaAntMs / conta.resolvidosAnt : null,
    },
    pessoas,
    projetos,
    pendencias: {
      sugestoes: e.sugestoesPendentes,
      sugestaoHaDias: e.sugestaoMaisAntiga ? diferencaDias(diaSP(e.sugestaoMaisAntiga), hoje) : null,
      cobrancasSemResposta: e.cardsSemResposta.length,
    },
    coberturas,
    nomes,
  };
}

// ── Textos ───────────────────────────────────────────────────────────────────

const NOME_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const PRIORIDADE: Record<Prioridade, string> = { low: 'baixa', medium: 'média', high: 'alta', critical: 'crítica' };
const SITUACAO: Record<ResumoProjeto['situacao'], string> = { late: 'atrasado', at_risk: 'em risco', on_track: 'no prazo', no_deadline: 'sem prazo' };
const MAX_TITULO = 45;
/** Itens das listas do relatório; o resto vira "… e mais N". */
export const MAX_ATENCAO = 6;
export const MAX_PESSOAS = 8;
export const MAX_PROJETOS = 5;
/** A partir de quantos atrasados a pessoa entra em "Atenção". */
export const ATRASADOS_ATENCAO = 3;

const titulo = (t: string) => (t.length > MAX_TITULO ? `${t.slice(0, MAX_TITULO - 1).trimEnd()}…` : t);
const n = (q: number, um: string, varios: string) => `${q} ${q === 1 ? um : varios}`;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const intervalo = (p: Periodo) => `${formatarDiaMes(p.de)} a ${formatarDiaMes(p.ate)}`;
const quem = (c: CardTI, p: PainelGestao) => c.assigned_to.map((id) => p.nomes[id]).filter(Boolean).join(', ') || 'sem responsável';
const restante = (total: number, mostrados: number) => (total > mostrados ? [`… e mais ${total - mostrados}`] : []);

function sobreProjeto(r: ProjetoGestao): string {
  const tempo = r.decorrido !== null ? `, ${pct(r.decorrido)} do tempo` : '';
  return `${r.nome}${r.sprint ? ` · ${r.sprint.name}` : ''}: ${r.feitos} de ${r.total} feitos${tempo}`;
}

/** O que pede atenção agora, do mais grave para o menos, até `max`. */
export function pontosDeAtencao(p: PainelGestao, max = MAX_ATENCAO): string[] {
  const { hoje } = p;
  const itens = [
    ...p.kanban.criticosAtrasados.slice(0, 3)
      .map((c) => `${c.codigo} ${titulo(c.title)}: crítico, atrasado há ${pluralDias(diasDeAtraso(c, hoje))} · ${quem(c, p)}`),
    ...p.chamados.foraDoPrazo.slice(0, 2)
      .map(({ chamado: c, atrasoMs }) => `Chamado ${c.codigo} ${titulo(c.title)}: ${PRIORIDADE[c.priority]}, fora do prazo para iniciar há ${formatarDuracao(atrasoMs)}`),
    // D40: quem sai e deixa card vencendo, com quem pode cobrir; quem está fora não conta como sobrecarga.
    ...p.coberturas.slice(0, 2).map((x) => `${p.nomes[x.id] ?? 'Alguém'} ${x.ausencia}: ${n(x.vencem.length, 'card vence', 'cards vencem')} nesse período (${
      x.vencem.slice(0, 3).map((c) => c.codigo).join(', ')})${x.sugestao ? ` · pode cobrir: ${p.nomes[x.sugestao] ?? 'alguém'}` : ''}`),
    ...p.pessoas.filter((x) => !x.ausente && x.atrasados >= ATRASADOS_ATENCAO).slice(0, 2)
      .map((x) => `${p.nomes[x.id] ?? 'Alguém'}: ${n(x.atrasados, 'atrasado', 'atrasados')} de ${x.abertos} abertos`),
    ...p.projetos.filter((r) => r.situacao === 'late' || r.situacao === 'at_risk').slice(0, 2)
      .map((r) => `${sobreProjeto(r)} · ${SITUACAO[r.situacao]}`),
    ...(p.pendencias.sugestoes > 0
      ? [`${n(p.pendencias.sugestoes, 'sugestão aguarda', 'sugestões aguardam')} aprovação${
        p.pendencias.sugestaoHaDias ? `, a mais antiga há ${pluralDias(p.pendencias.sugestaoHaDias)}` : ''}`]
      : []),
    ...(p.pendencias.cobrancasSemResposta > 0 ? [`${n(p.pendencias.cobrancasSemResposta, 'cobrança', 'cobranças')} sem resposta há mais de 4 h`] : []),
  ];
  return itens.slice(0, max);
}

const blocoAtencao = (p: PainelGestao) => {
  const itens = pontosDeAtencao(p);
  return itens.length ? ['⚠️ Atenção', ...itens.map((i) => `• ${i}`)] : ['Nada pedindo atenção agora 👌'];
};

function linhaKanban(p: PainelGestao): string {
  const k = p.kanban;
  return [
    n(k.abertos, 'aberto', 'abertos'),
    `${n(k.atrasados, 'atrasado', 'atrasados')}${k.novosAtrasos ? ` (${n(k.novosAtrasos, 'novo', 'novos')})` : ''}`,
    ...(k.vencemHoje ? [n(k.vencemHoje, 'vence hoje', 'vencem hoje')] : []),
    ...(k.parados ? [n(k.parados, 'parado', 'parados')] : []),
  ].join(' · ');
}

const linhaChamados = (p: PainelGestao) => {
  const fora = p.chamados.foraDoPrazo.length;
  return `${p.chamados.naFila} na fila${fora ? ` (${fora} fora do prazo para iniciar)` : ''} · ${p.chamados.emAndamento} em andamento`;
};

/** O relatório do dia útil (por volta das 8h, e o "relatório" pelo WhatsApp). */
export function montarRelatorioDiario(p: PainelGestao, linkInicio: string): string {
  return [
    `📊 Gestão da TI · ${NOME_DIA[diaDaSemana(p.hoje)]}, ${formatarDiaMes(p.hoje)}`,
    '',
    `Kanban: ${linhaKanban(p)}`,
    `Chamados: ${linhaChamados(p)}`,
    '',
    ...blocoAtencao(p),
    '',
    `Detalhes no Início: ${linkInicio}`,
  ].join('\n');
}

/**
 * O relatório da semana: na segunda, a semana anterior (`'semana'`); pelo WhatsApp, os últimos
 * 7 dias (`'7dias'`). Compara com o período do mesmo tamanho logo antes.
 */
export function montarRelatorioSemanal(p: PainelGestao, linkInicio: string, recorte: 'semana' | '7dias'): string {
  const antes = recorte === 'semana' ? 'semana anterior' : '7 dias antes';
  const c = p.chamados;
  const tempo = c.tempoMedioMs === null
    ? 'sem chamados resolvidos'
    : `${formatarDuracao(c.tempoMedioMs)}${c.tempoMedioAnteriorMs !== null ? ` (${antes}: ${formatarDuracao(c.tempoMedioAnteriorMs)})` : ''}`;
  const pessoas = p.pessoas.slice(0, MAX_PESSOAS);
  const projetos = p.projetos.slice(0, MAX_PROJETOS);
  return [
    `📈 ${recorte === 'semana' ? 'Semana' : 'Últimos 7 dias'} da TI · ${intervalo(p.periodo)}`,
    '',
    recorte === 'semana' ? 'Na semana' : 'Nos 7 dias',
    `• Entregas: ${n(p.entregas.periodo, 'card concluído', 'cards concluídos')} (${antes}: ${p.entregas.anterior})`,
    `• Chamados: ${n(c.abertos, 'aberto', 'abertos')} · ${n(c.resolvidos, 'resolvido', 'resolvidos')} (${antes}: ${c.abertosAnterior} e ${c.resolvidosAnterior})`,
    `• Tempo médio de resolução: ${tempo}`,
    '',
    'Agora',
    `• Kanban: ${linhaKanban(p)}`,
    `• Chamados: ${linhaChamados(p)}`,
    ...(pessoas.length
      ? ['', '👥 Por pessoa (concluídos · abertos · atrasados)', ...pessoas.map((x) => `• ${p.nomes[x.id] ?? '—'}: ${x.concluidos} · ${x.abertos} · ${x.atrasados}${x.ausencia ? ` (${x.ausencia})` : ''}`), ...restante(p.pessoas.length, pessoas.length)]
      : []),
    ...(projetos.length ? ['', '📁 Projetos', ...projetos.map((r) => `• ${sobreProjeto(r)} · ${SITUACAO[r.situacao]}`), ...restante(p.projetos.length, projetos.length)] : []),
    '',
    ...blocoAtencao(p),
    '',
    `Detalhes no Início: ${linkInicio}`,
  ].join('\n');
}

/**
 * O painel no contexto da IA, para as perguntas de gestão do gestor (chat e WhatsApp): os números
 * vêm prontos, e a IA lê, não conta.
 */
export function montarBlocoGestao(p: PainelGestao): string {
  const c = p.chamados;
  const nome = (id: string) => p.nomes[id] ?? id;
  const criticos = p.kanban.criticosAtrasados.slice(0, 5)
    .map((x) => `${x.codigo} (${pluralDias(diasDeAtraso(x, p.hoje))}, ${quem(x, p)})`).join('; ');
  const fora = c.foraDoPrazo.slice(0, 5)
    .map(({ chamado: x, atrasoMs }) => `${x.codigo} ${titulo(x.title)} (${PRIORIDADE[x.priority]}, aberto em ${formatarDiaMes(diaSP(x.created_at))}, prazo para iniciar vencido há ${formatarDuracao(atrasoMs)})`).join('; ');
  const tempo = (ms: number | null) => (ms === null ? 'sem resolvidos' : formatarDuracao(ms));
  return [
    'PAINEL DE GESTÃO (números do sistema: use estes, não conte por conta própria)',
    `Período: ${intervalo(p.periodo)}; período anterior, para comparar: ${intervalo(p.anterior)}.`,
    `Kanban agora: ${p.kanban.abertos} abertos, ${p.kanban.atrasados} atrasados (${p.kanban.novosAtrasos} novos desde o último dia útil), ${p.kanban.vencemHoje} vencem hoje, ${p.kanban.parados} parados.`,
    `Cards críticos atrasados: ${criticos || 'nenhum'}.`,
    `Entregas (cards concluídos): ${p.entregas.periodo} no período, ${p.entregas.anterior} no anterior.`,
    `Chamados dos usuários agora: ${c.naFila} na fila, ${c.foraDoPrazo.length} fora do prazo para iniciar${fora ? ` (${fora})` : ''}, ${c.emAndamento} em andamento.`,
    `Chamados no período: ${c.abertos} abertos, ${c.resolvidos} resolvidos, tempo médio de resolução ${tempo(c.tempoMedioMs)}. No anterior: ${c.abertosAnterior} abertos, ${c.resolvidosAnterior} resolvidos, ${tempo(c.tempoMedioAnteriorMs)}.`,
    'Por pessoa (abertos, atrasados, parados, concluídos no período):',
    ...(p.pessoas.length
      ? p.pessoas.map((x) => `- ${nome(x.id)}: ${x.abertos}, ${x.atrasados}, ${x.parados}, ${x.concluidos}${x.ausencia ? ` (${x.ausencia})` : ''}`)
      : ['- (ninguém com cards)']),
    'Projetos em andamento:',
    ...(p.projetos.length ? p.projetos.map((r) => `- ${sobreProjeto(r)}, ${SITUACAO[r.situacao]}`) : ['- (nenhum)']),
    `Pendências: ${p.pendencias.sugestoes} sugestões aguardando aprovação${p.pendencias.sugestaoHaDias ? ` (a mais antiga há ${pluralDias(p.pendencias.sugestaoHaDias)})` : ''}; ${p.pendencias.cobrancasSemResposta} cobranças sem resposta há mais de 4 h.`,
    ...(p.coberturas.length
      ? ['Ausências com cards vencendo no período (D40):', ...p.coberturas.map((x) => `- ${nome(x.id)} ${x.ausencia}: ${x.vencem.map((c) => c.codigo).join(', ')}${x.sugestao ? `; pode cobrir: ${nome(x.sugestao)}` : ''}`)]
      : []),
  ].join('\n');
}

// ── Pauta de 1:1 (D41) ───────────────────────────────────────────────────────

/** O que a última reunião analisada combinou com a pessoa (pessoal.ts, lerDaReuniaoParaPessoa). */
export interface ReuniaoDaPessoa { titulo: string; realizadaEm: string | null; itens: { descricao: string; status: string }[] }

/** Itens por seção da pauta; o resto vira "… e mais N". */
export const MAX_POR_SECAO_1A1 = 5;
/** Atrasado há mais que isto vira "repactuar o prazo" nos pontos para conversar. */
export const ATRASO_PARA_REPACTUAR = 7;

/**
 * "Prepara minha 1:1 com o Bruno": os números e os cards da pessoa, o que a última reunião combinou
 * com ela e pontos para conversar (regras fixas, sem IA). `formato`: WhatsApp (•, emojis) ou chat
 * (negrito e listas "- ", como o TextoEva mostra).
 */
export function montarPautaUmAUm(
  e: EntradaGestao, p: PainelGestao, pessoaId: string, reuniao: ReuniaoDaPessoa | null, formato: 'whatsapp' | 'chat',
): string {
  const { hoje } = p;
  const nome = p.nomes[pessoaId] ?? e.pessoas[pessoaId] ?? 'a pessoa';
  const visiveis = e.cards.filter(estaVisivel);
  const dela = visiveis.filter((c) => ehDoUsuario(c, pessoaId));
  const abertos = dela.filter(estaAberto);
  const ultimaMudanca = (c: CardTI) => [c.updated_at, e.ultimoComentario?.[c.id]].filter(Boolean).map((t) => diaSP(t as string)).sort().pop()!;
  const atrasados = ordenarAtrasados(dela, hoje);
  const parados = abertos.filter((c) => estaParado(c, hoje, e.diasParado, e.ultimoComentario?.[c.id] ?? null));
  const vencem = abertos.filter((c) => { const v = diaVencimento(c); return v !== null && v >= hoje && diferencaDias(hoje, v) <= 7; })
    .sort((a, b) => diaVencimento(a)!.localeCompare(diaVencimento(b)!));
  const semResposta = dela.filter((c) => e.cardsSemResposta.includes(c.id));
  const concluidos = (per: Periodo) => dela.filter((c) => estaConcluido(c) && noPeriodo(diaSP(c.updated_at), per)).length;
  const ausencia = e.ausencias?.[pessoaId];
  const sobreAusencia = ausencia && ausenciaProxima(ausencia, hoje) ? descreverAusencia(ausencia, hoje) : null;

  // A média da equipe presente com cards, para dizer se a carga está acima.
  const presentes = p.pessoas.filter((x) => !x.ausente && x.abertos > 0);
  const media = presentes.length ? presentes.reduce((s, x) => s + x.abertos, 0) / presentes.length : 0;

  const conversar = [
    ...atrasados.filter((c) => diasDeAtraso(c, hoje) > ATRASO_PARA_REPACTUAR).slice(0, 2)
      .map((c) => `Repactuar o prazo do ${c.codigo} (atrasado há ${pluralDias(diasDeAtraso(c, hoje))})`),
    ...parados.slice(0, 2).map((c) => `Destravar o ${c.codigo}: o que está impedindo?`),
    ...(semResposta.length ? [`Combinar o andamento de ${semResposta.slice(0, 3).map((c) => c.codigo).join(', ')}: as cobranças ficaram sem resposta`] : []),
    ...(abertos.length >= 5 && media > 0 && abertos.length >= media * 1.5
      ? [`Carga acima da média da equipe (${abertos.length} abertos; média ${Math.round(media)}): ver o que dá para redistribuir`] : []),
    ...(sobreAusencia && p.coberturas.some((x) => x.id === pessoaId)
      ? [`Antes da ausência: quem fica com ${p.coberturas.find((x) => x.id === pessoaId)!.vencem.map((c) => c.codigo).join(', ')}`] : []),
    ...(concluidos(p.periodo) > 0
      ? [`Reconhecer as entregas da semana (${n(concluidos(p.periodo), 'card concluído', 'cards concluídos')})`]
      : abertos.length > 0 ? ['Nenhuma entrega nos últimos 7 dias: entender o que travou'] : []),
  ];

  const chat = formato === 'chat';
  const item = chat ? '- ' : '• ';
  const secao = (tituloWhats: string, tituloChat: string, linhas: string[], total = linhas.length) => (linhas.length
    ? ['', chat ? `**${tituloChat}**` : tituloWhats, ...linhas.slice(0, MAX_POR_SECAO_1A1).map((l) => `${item}${l}`), ...restante(total, Math.min(total, MAX_POR_SECAO_1A1))]
    : []);
  const linha = (c: CardTI, detalhe: string) => `${c.codigo} ${titulo(c.title)}: ${detalhe}`;

  return [
    chat ? `**1:1 com ${nome}**` : `🗒️ 1:1 com ${nome} · ${formatarDiaMes(hoje)}`,
    '',
    `Nos últimos 7 dias: ${n(concluidos(p.periodo), 'card concluído', 'cards concluídos')} (7 dias antes: ${concluidos(p.anterior)})`,
    `Agora: ${n(abertos.length, 'aberto', 'abertos')} · ${n(atrasados.length, 'atrasado', 'atrasados')} · ${n(parados.length, 'parado', 'parados')}`,
    ...(sobreAusencia ? [`${chat ? '' : '🌴 '}Ausência: ${sobreAusencia}`] : []),
    ...secao('⚠️ Atrasados', 'Atrasados', atrasados.map((c) => linha(c, `venceu ${formatarDiaMes(diaVencimento(c)!)} (há ${pluralDias(diasDeAtraso(c, hoje))})`))),
    ...secao('💤 Parados', 'Parados', parados.map((c) => linha(c, `sem mudança desde ${formatarDiaMes(ultimaMudanca(c))}`))),
    ...secao('⏰ Vencem nos próximos 7 dias', 'Vencem nos próximos 7 dias', vencem.map((c) => linha(c, formatarDiaMes(diaVencimento(c)!)))),
    ...secao('📭 Cobranças sem resposta', 'Cobranças sem resposta', semResposta.map((c) => `${c.codigo} ${titulo(c.title)}`)),
    ...(reuniao
      ? secao(
        `📝 Da última reunião ("${reuniao.titulo}"${reuniao.realizadaEm ? `, ${formatarDiaMes(diaSP(reuniao.realizadaEm))}` : ''})`,
        `Da última reunião (${reuniao.titulo})`,
        reuniao.itens.map((i) => `${i.descricao}: ${i.status}`),
      )
      : []),
    '',
    chat ? '**Para conversar**' : '💬 Para conversar',
    ...(conversar.length ? conversar : ['Sem pendências para destacar: bom momento para falar de prioridades e desenvolvimento.']).map((l) => `${item}${l}`),
  ].join('\n');
}

// ── Alertas na hora ──────────────────────────────────────────────────────────

/** Só o que aconteceu há pouco vira alerta: o que é mais velho já está no relatório. */
export const JANELA_ALERTA_MS = 3 * 24 * 60 * 60 * 1000;
export const JANELA_ALERTA_DIAS = 3;

export interface AlertaGestao {
  /** Identifica o acontecimento: o mesmo alerta não sai duas vezes para a mesma pessoa. */
  chave: string;
  texto: string;
}

/**
 * Os alertas que o painel pede agora:
 * - chamado de prioridade alta ou crítica que passou do prazo para iniciar;
 * - card crítico que atrasou (uma vez por prazo: se o prazo mudar e vencer de novo, alerta de novo);
 * - projeto que entrou em risco ou em atraso (uma vez por sprint e situação).
 */
export function detectarAlertas(p: PainelGestao, linkInicio: string): AlertaGestao[] {
  const rodape = `\n\nDetalhes no Início: ${linkInicio}`;
  const sla = p.chamados.foraDoPrazo
    .filter(({ chamado: c, atrasoMs }) => (c.priority === 'high' || c.priority === 'critical') && atrasoMs <= JANELA_ALERTA_MS)
    .map(({ chamado: c, atrasoMs }) => ({
      chave: `sla:${c.id}`,
      texto: `🚨 Chamado fora do prazo para iniciar: ${c.codigo} ${titulo(c.title)} (${PRIORIDADE[c.priority]}). Aberto em ${formatarDiaMes(diaSP(c.created_at))}; o prazo venceu há ${formatarDuracao(atrasoMs)}.${rodape}`,
    }));
  const atrasos = p.kanban.criticosAtrasados
    .filter((c) => diasDeAtraso(c, p.hoje) <= JANELA_ALERTA_DIAS)
    .map((c) => ({
      chave: `atraso:${c.id}:${diaVencimento(c)}`,
      texto: `🚨 Card crítico atrasado: ${c.codigo} ${titulo(c.title)} venceu em ${formatarDiaMes(diaVencimento(c)!)} · ${quem(c, p)}.${rodape}`,
    }));
  const projetos = p.projetos
    .filter((r) => r.situacao === 'late' || r.situacao === 'at_risk')
    .map((r) => ({
      chave: `projeto:${r.id}:${r.sprint?.id ?? 'sem-sprint'}:${r.situacao}`,
      texto: `${r.situacao === 'late' ? '🚨 Projeto atrasado' : '⚠️ Projeto em risco'}: ${sobreProjeto(r)}.${rodape}`,
    }));
  return [...sla, ...atrasos, ...projetos];
}
