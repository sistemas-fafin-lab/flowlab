// Gestão da TI no servidor (D38, issue 27): lê o que o painel do gestor precisa e grava na fila o
// relatório (cron da manhã) e os alertas (script da VPS, a cada 10 min). As regras e os textos
// ficam em src/modules/eva/domain/gestao.ts; aqui só entram leitura, destinatários e gravação.
// Só vai para gestor da EVA (canManageAgenteTI, conferido no envio) com WhatsApp e a adesão
// marcada na aba Membros.
import type { SupabaseClient } from '@supabase/supabase-js';
import { diaDaSemana, ehDiaUtil, hojeSP, inicioDaSemana, somarDias, type Dia } from '../../../src/modules/eva/domain/datas.js';
import { fotografar, type FotoDia } from '../../../src/modules/eva/domain/tendencias.js';
import { estaAtrasado, type CardTI } from '../../../src/modules/eva/domain/demandas.js';
import { JANELA_COBRANCA_MS, proximaJanelaDeCobranca } from '../../../src/modules/eva/domain/cobranca.js';
import {
  detectarAlertas, montarBlocoGestao, montarPainelGestao, montarPautaUmAUm, montarRelatorioDiario, montarRelatorioSemanal, periodoAnterior,
  semanaAnterior, ultimos7Dias, type ChamadoGestao, type EntradaGestao, type PainelGestao, type Periodo,
} from '../../../src/modules/eva/domain/gestao.js';
import { CHAVE_GESTOR } from '../../../src/modules/eva/domain/papeis.js';
import type { ProjetoTI, SprintTI } from '../../../src/modules/eva/domain/projetos.js';
import { ultimoContato, type MensagemFila } from '../../../src/modules/eva/domain/whatsapp.js';
import { CAMPOS_CARD, lerConfigCobranca, ultimosComentarios } from './cobranca.js';
import { lerNomes, lerQuemTem, lerTudo, lerUltimaReuniao } from './dados.js';
import { lerDaReuniaoParaPessoa } from './pessoal.js';

type Pagina<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Alertas por pessoa por dia: o que passar disso fica para o relatório do dia seguinte. */
export const MAX_ALERTAS_DIA = 5;
/** A fila olhada para as cobranças sem resposta: a mesma do Início (DIAS_FILA). */
const DIAS_FILA = 3;

const inicioDoDia = (dia: Dia) => new Date(`${dia}T03:00:00Z`).toISOString();

// ── Leitura ──────────────────────────────────────────────────────────────────

/** Tudo o que o painel precisa, do período pedido e do anterior (a comparação). */
export async function lerEntradaGestao(db: SupabaseClient, agora: Date, periodo: Periodo): Promise<EntradaGestao> {
  const hoje = hojeSP(agora);
  // Concluídos desde o início do período anterior, e pelo menos 4 semanas (as entregas por semana, D42).
  const desdeDia = [periodoAnterior(periodo).de, somarDias(inicioDaSemana(hoje), -21)].sort()[0];
  const desde = inicioDoDia(desdeDia);
  const [cfg, cardsBrutos, projetos, sprints, chamados, membros, sugestoes, fila, fotoAnterior] = await Promise.all([
    lerConfigCobranca(db),
    lerTudo<CardTI>((de, ate) =>
      db.from('it_requests')
        .select(CAMPOS_CARD)
        .eq('kanban_hidden', false)
        .neq('status', 'cancelled')
        .or(`kanban_status.neq.done,updated_at.gte.${desde}`)
        .order('id')
        .range(de, ate) as unknown as Pagina<CardTI>),
    lerTudo<ProjetoTI>((de, ate) => db.from('it_projects').select('id, name, color').order('name').range(de, ate) as unknown as Pagina<ProjetoTI>),
    lerTudo<SprintTI>((de, ate) =>
      db.from('it_sprints').select('id, project_id, name, start_date, end_date, status').in('status', ['active', 'planned']).range(de, ate) as unknown as Pagina<SprintTI>),
    lerTudo<ChamadoGestao>((de, ate) =>
      db.from('it_requests')
        .select('id, codigo, title, priority, status, created_at, resolved_at, kanban_status, kanban_hidden')
        .eq('is_internal', false)
        .or(`status.in.(pending,in_progress),created_at.gte.${desde},resolved_at.gte.${desde}`)
        .order('id')
        .range(de, ate) as unknown as Pagina<ChamadoGestao>),
    db.from('ti_agente_membros')
      .select('user_id, ausente_de, ausente_ate, ausencia_motivo, perfil:user_profiles!ti_agente_membros_user_id_fkey(name, deleted_at)')
      .eq('ativo', true),
    db.from('ti_agente_sugestoes').select('created_at', { count: 'exact' }).eq('status', 'pendente').order('created_at').limit(1),
    lerFilaRecente(db, agora),
    lerFotoAntesDe(db, periodo.de),
  ]);
  if (membros.error) throw new Error(membros.error.message);
  if (sugestoes.error) throw new Error(sugestoes.error.message);

  const cards = cardsBrutos.map((c) => ({ ...c, assigned_to: c.assigned_to ?? [], kanban_hidden: !!c.kanban_hidden }));
  type Perfil = { name: string; deleted_at: string | null } | null;
  const equipe = (membros.data ?? [])
    .map((m) => ({
      id: m.user_id as string,
      perfil: m.perfil as unknown as Perfil,
      ausencia: { ausente_de: (m.ausente_de as string | null) ?? null, ausente_ate: (m.ausente_ate as string | null) ?? null, ausencia_motivo: (m.ausencia_motivo as string | null) ?? null },
    }))
    .filter((m) => m.perfil && !m.perfil.deleted_at);
  const daEquipe = Object.fromEntries(equipe.map((m) => [m.id, m.perfil!.name]));
  const outros = cards.flatMap((c) => c.assigned_to).filter((id) => !daEquipe[id]);
  const pessoas = { ...(await lerNomes(db, outros)), ...daEquipe };
  const comentarios = await ultimosComentarios(db, cards.filter((c) => c.kanban_status !== 'done'));

  // Atrasado cuja última cobrança saiu e ficou sem resposta há mais de 4 h (a regra dos comentários do Início).
  const semResposta = cards.filter((c) => {
    if (!estaAtrasado(c, hoje)) return false;
    const contato = ultimoContato(c.id, c.assigned_to, fila, agora.getTime(), hoje, JANELA_COBRANCA_MS);
    return !!contato.semResposta && agora.getTime() - Date.parse(contato.semResposta.desde) >= JANELA_COBRANCA_MS;
  }).map((c) => c.id);

  return {
    hoje,
    agora: agora.getTime(),
    periodo,
    cards,
    projetos,
    sprints,
    chamados,
    pessoas,
    equipe: equipe.map((m) => m.id),
    diasParado: cfg.dias_parado,
    ultimoComentario: comentarios,
    sugestoesPendentes: sugestoes.count ?? 0,
    sugestaoMaisAntiga: (sugestoes.data?.[0]?.created_at as string | undefined) ?? null,
    cardsSemResposta: semResposta,
    ausencias: Object.fromEntries(equipe.map((m) => [m.id, m.ausencia])),
    fotoAnterior,
  };
}

/**
 * A foto diária mais recente antes do dia (D42). Sem a tabela (migration ainda não aplicada) ou sem
 * foto, null: a comparação só some do relatório.
 */
async function lerFotoAntesDe(db: SupabaseClient, dia: Dia): Promise<FotoDia | null> {
  const { data, error } = await db.from('ti_agente_fotos').select('foto').lt('dia', dia).order('dia', { ascending: false }).limit(1).maybeSingle();
  if (error) return null;
  return (data?.foto as FotoDia | undefined) ?? null;
}

/** A foto do fim do dia (fechamento das 18h): os números do painel de hoje, uma linha por dia. */
export async function gravarFotoDoDia(db: SupabaseClient, agora = new Date()): Promise<FotoDia> {
  const hoje = hojeSP(agora);
  const foto = fotografar(await lerPainelGestao(db, agora, { de: hoje, ate: hoje }));
  const { error } = await db.from('ti_agente_fotos').upsert({ dia: hoje, foto }, { onConflict: 'dia' });
  if (error) throw new Error(error.message);
  return foto;
}

/** As mensagens dos últimos dias, no formato do Início (para ultimoContato). */
async function lerFilaRecente(db: SupabaseClient, agora: Date): Promise<MensagemFila[]> {
  const { data, error } = await db
    .from('ti_agente_mensagens')
    .select('id, membro_id, direcao, tipo, texto, card_ids, status, erro, created_at, enviada_em, proxima_tentativa_em, chat_id_destino, membro:ti_agente_membros(user_id, perfil:user_profiles!ti_agente_membros_user_id_fkey(name))')
    .gte('created_at', new Date(agora.getTime() - DIAS_FILA * 86_400_000).toISOString())
    .in('tipo', ['cobranca', 'cobranca_manual', 'recebida'])
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  type Membro = { user_id: string; perfil: { name: string } | null } | null;
  return (data ?? []).map((m) => {
    const { membro, ...resto } = m as unknown as Omit<MensagemFila, 'membro_user_id' | 'membro_nome'> & { membro: Membro };
    return { ...resto, card_ids: resto.card_ids ?? [], membro_user_id: membro?.user_id ?? null, membro_nome: membro?.perfil?.name ?? null };
  });
}

export async function lerPainelGestao(db: SupabaseClient, agora: Date, periodo = ultimos7Dias(hojeSP(agora))): Promise<PainelGestao> {
  return montarPainelGestao(await lerEntradaGestao(db, agora, periodo));
}

/** O painel no contexto da IA (perguntas de gestão do gestor, no chat e no WhatsApp). */
export async function lerBlocoGestao(db: SupabaseClient, agora = new Date()): Promise<string> {
  return montarBlocoGestao(await lerPainelGestao(db, agora));
}

/** "Prepara minha 1:1 com o Bruno" (D41): a pauta da pessoa, pelo painel dos últimos 7 dias. */
export async function lerPautaUmAUm(db: SupabaseClient, pessoaId: string, formato: 'whatsapp' | 'chat', agora = new Date()): Promise<string> {
  const [entrada, reuniao] = await Promise.all([lerEntradaGestao(db, agora, ultimos7Dias(hojeSP(agora))), lerUltimaReuniao(db)]);
  const itens = reuniao?.id ? await lerDaReuniaoParaPessoa(db, reuniao.id, pessoaId) : [];
  return montarPautaUmAUm(
    entrada, montarPainelGestao(entrada), pessoaId,
    reuniao ? { titulo: reuniao.titulo, realizadaEm: reuniao.realizadaEm, itens } : null,
    formato,
  );
}

export interface DestinoGestao { membroId: string; userId: string; nome: string }

/** Gestores da EVA, ativos na aba Membros, com WhatsApp e a adesão marcada. */
export async function lerDestinatariosDeGestao(db: SupabaseClient, adesao: 'recebe_relatorio' | 'recebe_alertas'): Promise<DestinoGestao[]> {
  const [{ data, error }, gestores] = await Promise.all([
    db.from('ti_agente_membros')
      .select('id, user_id, whatsapp, perfil:user_profiles!ti_agente_membros_user_id_fkey(name, deleted_at, disabled_at)')
      .eq('ativo', true)
      .eq(adesao, true)
      .not('whatsapp', 'is', null),
    lerQuemTem(db, CHAVE_GESTOR),
  ]);
  if (error) throw new Error(error.message);
  const ehGestor = new Set(gestores);
  type Perfil = { name: string; deleted_at: string | null; disabled_at: string | null } | null;
  return (data ?? [])
    .map((m) => ({ m, perfil: m.perfil as unknown as Perfil }))
    .filter(({ m, perfil }) => perfil && !perfil.deleted_at && !perfil.disabled_at && ehGestor.has(m.user_id as string))
    .map(({ m, perfil }) => ({ membroId: m.id as string, userId: m.user_id as string, nome: perfil!.name }));
}

// ── Relatório ────────────────────────────────────────────────────────────────

/** "relatório" pelo WhatsApp: o do dia, ou os últimos 7 dias. */
export async function relatorioAgora(db: SupabaseClient, recorte: 'dia' | 'semana', linkInicio: string, agora = new Date()): Promise<string> {
  const painel = await lerPainelGestao(db, agora);
  return recorte === 'semana' ? montarRelatorioSemanal(painel, linkInicio, '7dias') : montarRelatorioDiario(painel, linkInicio);
}

export interface ResultadoRelatorio {
  hoje: Dia;
  dryRun: boolean;
  /** Motivo de não ter gravado (fim de semana, WhatsApp desligado, ninguém marcado). */
  pulado: string | null;
  /** 'semana' na segunda (a semana anterior); 'dia' nos outros dias úteis. */
  recorte: 'dia' | 'semana';
  texto: string | null;
  destinatarios: string[];
  gravadas: number;
  /** Já havia o relatório de hoje para a pessoa (o cron rodou de novo). */
  repetidas: number;
}

/** O relatório da manhã (cron da cobrança): o do dia, e na segunda o da semana anterior. */
export async function gerarRelatoriosDeGestao(
  db: SupabaseClient,
  opcoes: { agora?: Date; dryRun?: boolean; linkInicio: string },
): Promise<ResultadoRelatorio> {
  const agora = opcoes.agora ?? new Date();
  const hoje = hojeSP(agora);
  const dryRun = !!opcoes.dryRun;
  const recorte = diaDaSemana(hoje) === 1 ? 'semana' : 'dia';
  const base: ResultadoRelatorio = { hoje, dryRun, pulado: null, recorte, texto: null, destinatarios: [], gravadas: 0, repetidas: 0 };
  const cfg = await lerConfigCobranca(db);
  const destinos = await lerDestinatariosDeGestao(db, 'recebe_relatorio');
  const pulado = !ehDiaUtil(hoje) ? 'Fim de semana: o relatório só sai em dia útil.'
    : !cfg.whatsapp_ativo ? 'O WhatsApp da EVA está desligado.'
      : destinos.length === 0 ? 'Nenhum gestor com o relatório de gestão marcado (EVA → Membros).'
        : null;
  // Como a cobrança: o dryRun monta o texto mesmo sem ninguém marcado, para conferir antes.
  if (pulado && !dryRun) return { ...base, pulado };

  const painel = await lerPainelGestao(db, agora, recorte === 'semana' ? semanaAnterior(hoje) : ultimos7Dias(hoje));
  const texto = recorte === 'semana' ? montarRelatorioSemanal(painel, opcoes.linkInicio, 'semana') : montarRelatorioDiario(painel, opcoes.linkInicio);
  const resultado = { ...base, pulado, texto, destinatarios: destinos.map((d) => d.nome) };
  if (dryRun) return resultado;

  const janela = proximaJanelaDeCobranca(agora.getTime());
  const agendadaPara = janela === null ? null : new Date(janela).toISOString();
  for (const d of destinos) {
    const { data, error } = await db
      .from('ti_agente_mensagens')
      .upsert(
        {
          membro_id: d.membroId, direcao: 'saida', tipo: 'relatorio', status: 'pendente', texto, card_ids: [],
          chave_dia: `relatorio:${d.membroId}:${hoje}`, proxima_tentativa_em: agendadaPara,
        },
        { onConflict: 'chave_dia', ignoreDuplicates: true },
      )
      .select('id');
    if (error) throw new Error(error.message);
    if ((data ?? []).length > 0) resultado.gravadas += 1; else resultado.repetidas += 1;
  }
  return resultado;
}

// ── Alertas na hora ──────────────────────────────────────────────────────────

export interface ResultadoAlertas {
  pulado: string | null;
  /** Quantos acontecimentos o painel pede agora (antes de olhar quem já recebeu). */
  detectados: number;
  gravados: number;
  /** Já tinham saído para a pessoa. */
  repetidos: number;
  /** Ficaram de fora pelo limite do dia (MAX_ALERTAS_DIA). */
  noLimite: number;
}

/**
 * Roda no script da VPS, a cada 10 min (a Vercel do plano Hobby só agenda cron uma vez por dia).
 * Só no horário da EVA: o que acontecer à noite ou no fim de semana sai na abertura, se ainda
 * estiver na janela de 3 dias, ou fica só no relatório.
 */
export async function verificarAlertas(db: SupabaseClient, opcoes: { agora?: Date; linkInicio: string }): Promise<ResultadoAlertas> {
  const agora = opcoes.agora ?? new Date();
  const base: ResultadoAlertas = { pulado: null, detectados: 0, gravados: 0, repetidos: 0, noLimite: 0 };
  if (proximaJanelaDeCobranca(agora.getTime()) !== null) return { ...base, pulado: 'Fora do horário da EVA.' };
  const cfg = await lerConfigCobranca(db);
  if (!cfg.whatsapp_ativo) return { ...base, pulado: 'O WhatsApp da EVA está desligado.' };
  const destinos = await lerDestinatariosDeGestao(db, 'recebe_alertas');
  if (destinos.length === 0) return { ...base, pulado: 'Nenhum gestor com os alertas marcados.' };

  const alertas = detectarAlertas(await lerPainelGestao(db, agora), opcoes.linkInicio);
  const r = { ...base, detectados: alertas.length };
  if (alertas.length === 0) return r;

  const hoje = hojeSP(agora);
  for (const d of destinos) {
    const { count, error: eCount } = await db
      .from('ti_agente_mensagens')
      .select('id', { count: 'exact', head: true })
      .eq('membro_id', d.membroId)
      .eq('tipo', 'alerta')
      // Só os de gestão: os avisos de saúde das integrações (D39) também são 'alerta', com chave "saude:…".
      .like('chave_dia', 'alerta:%')
      .gte('created_at', inicioDoDia(hoje));
    if (eCount) throw new Error(eCount.message);
    let vagas = MAX_ALERTAS_DIA - (count ?? 0);
    for (const a of alertas) {
      if (vagas <= 0) { r.noLimite += 1; continue; }
      const { data, error } = await db
        .from('ti_agente_mensagens')
        .upsert(
          { membro_id: d.membroId, direcao: 'saida', tipo: 'alerta', status: 'pendente', texto: a.texto, card_ids: [], chave_dia: `alerta:${d.membroId}:${a.chave}` },
          { onConflict: 'chave_dia', ignoreDuplicates: true },
        )
        .select('id');
      if (error) throw new Error(error.message);
      if ((data ?? []).length > 0) { r.gravados += 1; vagas -= 1; } else r.repetidos += 1;
    }
  }
  return r;
}
