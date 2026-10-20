// Grupo da equipe no WhatsApp (issue 18, D29): o fechamento do dia, o resumo de reunião, os
// avisos pedidos por gestor e o teste. O grupo é escolhido em Configurações, a partir da lista
// que o script da VPS lê do WAHA. A Vercel só grava na fila com o destino do grupo
// (chat_id_destino); o script da VPS envia (D9) e segura fechamento, resumo e aviso para o
// horário de cobrança (dia útil, 7h às 20h). O teste sai a qualquer hora.
import type { SupabaseClient } from '@supabase/supabase-js';
import { diaDaSemana, diaDoPrazo, diaSP, diferencaDias, ehDiaUtil, formatarDiaMes, hojeSP, proximoDiaUtil, type Dia } from '../../../src/modules/eva/domain/datas.js';
import { diaVencimento, ordenarAtrasados, type CardTI } from '../../../src/modules/eva/domain/demandas.js';
import { proximaJanelaDeCobranca } from '../../../src/modules/eva/domain/cobranca.js';
import { primeiroNome } from '../../../src/modules/eva/domain/pessoas.js';
import { ehChatDeGrupo } from '../../../src/modules/eva/domain/whatsapp.js';
import type { Usuario } from './autorizacao.js';
import { CAMPOS_CARD, lerCardsAbertos } from './cobranca.js';
import { lerNomes } from './dados.js';

const NOME_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
/** Itens por seção do fechamento; o resto vira "… e mais N". */
export const MAX_POR_SECAO = 6;
const MAX_TITULO = 50;
export const MAX_AVISO = 1000;
const MAX_DECISOES = 900;
/** Reunião mais velha que isto não vai para o grupo (a primeira sincronização traz o histórico). */
export const RESUMO_ATE_DIAS = 3;

const titulo = (c: CardTI) => (c.title.length > MAX_TITULO ? `${c.title.slice(0, MAX_TITULO - 1).trimEnd()}…` : c.title);

// ── Configuração ─────────────────────────────────────────────────────────────

export interface ConfigGrupo {
  whatsappAtivo: boolean;
  grupoId: string | null;
  grupoNome: string | null;
  fechamento: boolean;
  resumoReuniao: boolean;
}

export async function lerConfigGrupo(db: SupabaseClient): Promise<ConfigGrupo> {
  const { data, error } = await db
    .from('ti_agente_config')
    .select('whatsapp_ativo, whatsapp_grupo_id, whatsapp_grupo_nome, fechamento_diario_ativo, resumo_reuniao_grupo_ativo')
    .eq('id', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    whatsappAtivo: data?.whatsapp_ativo === true,
    grupoId: (data?.whatsapp_grupo_id as string | null | undefined) ?? null,
    grupoNome: (data?.whatsapp_grupo_nome as string | null | undefined) ?? null,
    fechamento: data?.fechamento_diario_ativo === true,
    resumoReuniao: data?.resumo_reuniao_grupo_ativo === true,
  };
}

/** Por que não dá para mandar ao grupo agora; null = dá. */
export function motivoSemGrupo(cfg: ConfigGrupo): string | null {
  if (!cfg.whatsappAtivo) return 'O WhatsApp da EVA está desligado (EVA → Configurações).';
  if (!ehChatDeGrupo(cfg.grupoId)) return 'Nenhum grupo da equipe escolhido (EVA → Configurações).';
  return null;
}

// ── Fila ─────────────────────────────────────────────────────────────────────

export interface Enfileirada {
  /** false = já havia uma com a mesma chave (o cron rodou de novo, a reunião foi reanalisada). */
  gravada: boolean;
  id: string | null;
  /** Fora do horário, o instante (ISO) em que ela sai; null = sai já. */
  agendadaPara: string | null;
}

/** Grava a mensagem do grupo na fila. Com `chave`, uma vez só (fechamento:<dia>, reuniao:<id>). */
export async function enfileirarNoGrupo(
  db: SupabaseClient,
  e: { grupoId: string; texto: string; tipo?: 'grupo' | 'teste'; enviadaPor?: string | null; chave?: string | null; cardIds?: string[]; agora?: Date },
): Promise<Enfileirada> {
  const tipo = e.tipo ?? 'grupo';
  const janela = tipo === 'grupo' ? proximaJanelaDeCobranca((e.agora ?? new Date()).getTime()) : null;
  const agendadaPara = janela === null ? null : new Date(janela).toISOString();
  const linha = {
    membro_id: null, chat_id_destino: e.grupoId, direcao: 'saida', tipo, status: 'pendente', texto: e.texto,
    card_ids: e.cardIds ?? [], enviada_por: e.enviadaPor ?? null, chave_dia: e.chave ?? null, proxima_tentativa_em: agendadaPara,
  };
  const consulta = e.chave
    ? db.from('ti_agente_mensagens').upsert(linha, { onConflict: 'chave_dia', ignoreDuplicates: true }).select('id')
    : db.from('ti_agente_mensagens').insert(linha).select('id');
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  const id = ((data ?? [])[0]?.id as string | undefined) ?? null;
  return { gravada: id !== null, id, agendadaPara };
}

// ── Fechamento do dia (18h, dias úteis) ──────────────────────────────────────

export interface EntradaFechamento {
  hoje: Dia;
  /** Concluídos hoje (coluna Concluído, mudados hoje: não há coluna de conclusão). */
  concluidas: CardTI[];
  abertos: CardTI[];
  nomes: Record<string, string>;
  linkInicio: string;
}

/** O texto do fechamento, ou null quando não há nada a dizer (nada concluído, atrasado ou vencendo). */
export function montarFechamento(e: EntradaFechamento): { texto: string; cardIds: string[] } | null {
  const { hoje } = e;
  const atrasadas = ordenarAtrasados(e.abertos, hoje);
  const ja = new Set(atrasadas.map((c) => c.id));
  const limite = proximoDiaUtil(hoje);
  const vencendo = e.abertos
    .filter((c) => {
      const v = diaVencimento(c);
      return !ja.has(c.id) && v !== null && v >= hoje && v <= limite;
    })
    .sort((a, b) => diaVencimento(a)!.localeCompare(diaVencimento(b)!) || a.codigo.localeCompare(b.codigo));
  if (e.concluidas.length + atrasadas.length + vencendo.length === 0) return null;

  const quem = (c: CardTI) => c.assigned_to.map((id) => primeiroNome(e.nomes[id] ?? '')).filter(Boolean).join(', ') || 'sem responsável';
  const secao = (rotulo: string, cards: CardTI[], detalhe?: (c: CardTI) => string) => {
    if (cards.length === 0) return null;
    const itens = cards.slice(0, MAX_POR_SECAO).map((c) => `• ${c.codigo} ${titulo(c)} · ${quem(c)}${detalhe ? `: ${detalhe(c)}` : ''}`);
    const resto = cards.length > MAX_POR_SECAO ? [`… e mais ${cards.length - MAX_POR_SECAO}`] : [];
    return [`${rotulo} (${cards.length})`, ...itens, ...resto].join('\n');
  };
  const quandoVence = (c: CardTI) => {
    const v = diaVencimento(c)!;
    if (v === hoje) return 'vence hoje';
    if (diferencaDias(hoje, v) === 1) return 'vence amanhã';
    return `vence ${NOME_DIA[diaDaSemana(v)]} (${formatarDiaMes(v)})`;
  };
  const rotuloVencendo = diferencaDias(hoje, limite) === 1 ? 'Vencem hoje ou amanhã' : `Vencem até ${NOME_DIA[diaDaSemana(limite)]}`;

  const blocos = [
    secao('✅ Concluídas hoje', e.concluidas),
    secao('⚠️ Atrasadas', atrasadas, (c) => `venceu ${formatarDiaMes(diaDoPrazo(c.due_date!))}`),
    secao(`⏰ ${rotuloVencendo}`, vencendo, quandoVence),
  ].filter(Boolean);
  const texto = [`Fechamento do dia (${formatarDiaMes(hoje)})`, '', blocos.join('\n\n'), '', `Detalhes no Início: ${e.linkInicio}`].join('\n');
  const listados = [...e.concluidas, ...atrasadas, ...vencendo];
  return { texto, cardIds: listados.map((c) => c.id) };
}

async function lerConcluidasHoje(db: SupabaseClient, hoje: Dia): Promise<CardTI[]> {
  const { data, error } = await db
    .from('it_requests')
    .select(CAMPOS_CARD)
    .eq('kanban_hidden', false)
    .eq('kanban_status', 'done')
    .neq('status', 'cancelled')
    .gte('updated_at', new Date(`${hoje}T03:00:00Z`).toISOString())
    .order('codigo')
    .limit(50);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as CardTI[]).map((c) => ({ ...c, assigned_to: c.assigned_to ?? [], kanban_hidden: !!c.kanban_hidden }));
}

export interface ResultadoFechamento {
  hoje: Dia;
  dryRun: boolean;
  /** Motivo de não ter gravado (fim de semana, desligado, sem grupo, nada a dizer). */
  pulado: string | null;
  texto: string | null;
  gravada: boolean;
  agendadaPara: string | null;
}

export async function gerarFechamentoDoDia(
  db: SupabaseClient,
  opcoes: { agora?: Date; dryRun?: boolean; linkInicio: string },
): Promise<ResultadoFechamento> {
  const agora = opcoes.agora ?? new Date();
  const hoje = hojeSP(agora);
  const dryRun = !!opcoes.dryRun;
  const cfg = await lerConfigGrupo(db);
  const pulado = !ehDiaUtil(hoje) ? 'Fim de semana: o fechamento só sai em dia útil.'
    : !cfg.fechamento ? 'O fechamento do dia está desligado.'
      : motivoSemGrupo(cfg);
  const base: ResultadoFechamento = { hoje, dryRun, pulado, texto: null, gravada: false, agendadaPara: null };
  // Como na cobrança da manhã: o dryRun monta o texto mesmo desligado, para conferir antes de ligar.
  if (pulado && !dryRun) return base;

  const [abertos, concluidas] = await Promise.all([lerCardsAbertos(db), lerConcluidasHoje(db, hoje)]);
  const nomes = await lerNomes(db, [...abertos, ...concluidas].flatMap((c) => c.assigned_to));
  const m = montarFechamento({ hoje, abertos, concluidas, nomes, linkInicio: opcoes.linkInicio });
  if (!m) return { ...base, pulado: pulado ?? 'Nada para fechar hoje: nenhum card concluído, atrasado ou vencendo.' };
  if (dryRun) return { ...base, texto: m.texto };

  const r = await enfileirarNoGrupo(db, { grupoId: cfg.grupoId!, texto: m.texto, chave: `fechamento:${hoje}`, cardIds: m.cardIds, agora });
  return { ...base, texto: m.texto, gravada: r.gravada, agendadaPara: r.agendadaPara };
}

// ── Resumo de reunião ────────────────────────────────────────────────────────

export interface ReuniaoParaGrupo { id: string; titulo: string; realizadaEm: string | null; observacoes: string | null; sugestoes: number }

export function montarResumoReuniao(r: ReuniaoParaGrupo, linkInicio: string): string {
  const data = r.realizadaEm ? ` (${formatarDiaMes(diaSP(r.realizadaEm))})` : '';
  const obs = r.observacoes?.trim();
  const decisoes = obs ? (obs.length > MAX_DECISOES ? `${obs.slice(0, MAX_DECISOES - 1).trimEnd()}…` : obs) : null;
  const n = r.sugestoes;
  const sugestoes = n === 0
    ? 'Nenhuma mudança no Kanban foi proposta.'
    : `${n} ${n === 1 ? 'sugestão de mudança no Kanban aguarda' : 'sugestões de mudança no Kanban aguardam'} aprovação de um gestor.`;
  return [
    `📝 Reunião analisada: "${r.titulo}"${data}`,
    ...(decisoes ? ['', `Principais decisões: ${decisoes}`] : []),
    '',
    sugestoes,
    `Início: ${linkInicio}`,
  ].join('\n');
}

/** Depois da análise (analisarReuniao): com o liga/desliga ligado, uma vez por reunião. null = não mandou. */
export async function enviarResumoDaReuniao(db: SupabaseClient, r: ReuniaoParaGrupo, linkInicio: string, agora = new Date()): Promise<Enfileirada | null> {
  const cfg = await lerConfigGrupo(db);
  if (!cfg.resumoReuniao || motivoSemGrupo(cfg)) return null;
  if (r.realizadaEm && agora.getTime() - Date.parse(r.realizadaEm) > RESUMO_ATE_DIAS * 24 * 60 * 60 * 1000) return null;
  return enfileirarNoGrupo(db, { grupoId: cfg.grupoId!, texto: montarResumoReuniao(r, linkInicio), chave: `reuniao:${r.id}`, agora });
}

// ── Aviso de gestor e teste ──────────────────────────────────────────────────

/** "📢 Aviso de Ana: …"; no grupo, para quem não tem WhatsApp (D35), "📢 Aviso de Ana para Bruno: …". */
export const montarAviso = (nomeGestor: string, aviso: string, citado: string | null = null) =>
  `📢 Aviso de ${primeiroNome(nomeGestor) || 'um gestor'}${citado ? ` para ${citado}` : ''}:\n${aviso.trim().slice(0, MAX_AVISO)}`;

export const TEXTO_TESTE_GRUPO =
  'Teste da EVA, a agente de TI do FlowLab: este grupo vai receber o fechamento do dia, os resumos de reunião e os avisos da gestão. Não precisa responder.';

export async function enfileirarTesteGrupo(db: SupabaseClient, usuario: Usuario): Promise<{ ok: true; id: string } | { ok: false; status: 422; erro: string }> {
  const cfg = await lerConfigGrupo(db);
  const motivo = motivoSemGrupo(cfg);
  if (motivo) return { ok: false, status: 422, erro: motivo };
  const r = await enfileirarNoGrupo(db, { grupoId: cfg.grupoId!, texto: TEXTO_TESTE_GRUPO, tipo: 'teste', enviadaPor: usuario.userId });
  return { ok: true, id: r.id! };
}
