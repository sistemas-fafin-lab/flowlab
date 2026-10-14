// Cobrança no servidor (issue 14, plano §10): o cron da manhã, o botão Cobrar/Lembrar e o
// "Enviar teste" (issue 12). As regras são as do Início (src/modules/eva/domain); aqui só
// entram leitura, gravação na fila e permissão. Quem envia é o script da VPS (D9).
import type { SupabaseClient } from '@supabase/supabase-js';
import { ehDiaUtil, hojeSP, type Dia } from '../../../src/modules/eva/domain/datas.js';
import type { CardTI } from '../../../src/modules/eva/domain/demandas.js';
import {
  chaveDia, destinatarios, montarCobrancaManual, montarMensagemDiaria, pendenciasDoMembro, podeCobrar, podeReceber,
  proximaJanelaDeCobranca, totalPendencias, type MembroCobranca, type ModoCobranca,
} from '../../../src/modules/eva/domain/cobranca.js';
import { tem, type Usuario } from './autorizacao.js';
import { lerTudo } from './dados.js';

export const CAMPOS_CARD ='id, codigo, title, priority, status, kanban_status, assigned_to, due_date, kanban_hidden, project_id, sprint_id, updated_at, created_at';

type Pagina<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export interface ConfigCobranca { whatsapp_ativo: boolean; cobranca_ativa: boolean; dias_parado: number }

export async function lerConfigCobranca(db: SupabaseClient): Promise<ConfigCobranca> {
  const { data, error } = await db.from('ti_agente_config').select('whatsapp_ativo, cobranca_ativa, dias_parado').eq('id', true).maybeSingle();
  if (error) throw new Error(error.message);
  return { whatsapp_ativo: data?.whatsapp_ativo === true, cobranca_ativa: data?.cobranca_ativa === true, dias_parado: data?.dias_parado ?? 5 };
}

/** Membros da EVA com o nome do perfil; quem foi desativado no FlowLab sai. */
export async function lerMembrosCobranca(db: SupabaseClient): Promise<MembroCobranca[]> {
  const { data, error } = await db
    .from('ti_agente_membros')
    .select('id, user_id, whatsapp, recebe_cobranca, ativo, perfil:user_profiles!ti_agente_membros_user_id_fkey(name, deleted_at)');
  if (error) throw new Error(error.message);
  type Perfil = { name: string; deleted_at: string | null } | null;
  return (data ?? [])
    .filter((m) => { const p = m.perfil as unknown as Perfil; return p && !p.deleted_at; })
    .map((m) => ({
      id: m.id as string,
      user_id: m.user_id as string,
      nome: (m.perfil as unknown as { name: string }).name,
      ativo: m.ativo as boolean,
      recebe_cobranca: m.recebe_cobranca as boolean,
      whatsapp: m.whatsapp as string | null,
    }));
}

export async function lerCardsAbertos(db: SupabaseClient): Promise<CardTI[]> {
  const cards = await lerTudo<CardTI>((de, ate) =>
    db.from('it_requests')
      .select(CAMPOS_CARD)
      .eq('kanban_hidden', false)
      .neq('kanban_status', 'done')
      .not('status', 'in', '(resolved,cancelled)')
      .order('codigo')
      .range(de, ate) as unknown as Pagina<CardTI>);
  return cards.map((c) => ({ ...c, assigned_to: c.assigned_to ?? [], kanban_hidden: !!c.kanban_hidden }));
}

/** Último comentário de cada card em andamento ou revisão (RN04: comentário conta como mudança). */
export async function ultimosComentarios(db: SupabaseClient, cards: CardTI[]): Promise<Record<string, string>> {
  const ids = cards.filter((c) => c.kanban_status === 'in_progress' || c.kanban_status === 'review').map((c) => c.id);
  const ultimo: Record<string, string> = {};
  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200);
    const linhas = await lerTudo<{ task_id: string; created_at: string }>((de, ate) =>
      db.from('it_task_comments').select('task_id, created_at').in('task_id', lote).range(de, ate) as unknown as Pagina<{ task_id: string; created_at: string }>);
    for (const l of linhas) if (!ultimo[l.task_id] || l.created_at > ultimo[l.task_id]) ultimo[l.task_id] = l.created_at;
  }
  return ultimo;
}

// ── Cron da manhã (RF18, RN12) ───────────────────────────────────────────────

export interface CobrancaMontada { membro: string; itens: number; gravada: boolean; texto?: string }

export interface ResultadoCobrancaDiaria {
  hoje: Dia;
  dryRun: boolean;
  /** Motivo de não ter gravado nada (fim de semana, desligado). */
  pulado: string | null;
  mensagens: CobrancaMontada[];
  gravadas: number;
  /** Já havia cobrança de hoje para a pessoa (o cron rodou de novo). */
  repetidas: number;
}

export async function gerarCobrancasDoDia(
  db: SupabaseClient,
  opcoes: { agora?: Date; dryRun?: boolean; linkInicio: string },
): Promise<ResultadoCobrancaDiaria> {
  const hoje = hojeSP(opcoes.agora ?? new Date());
  const dryRun = !!opcoes.dryRun;
  const cfg = await lerConfigCobranca(db);
  const pulado = !ehDiaUtil(hoje) ? 'Fim de semana: a cobrança só sai em dia útil.'
    : !cfg.whatsapp_ativo ? 'O WhatsApp da EVA está desligado.'
      : !cfg.cobranca_ativa ? 'A cobrança diária está desligada.'
        : null;
  const base: ResultadoCobrancaDiaria = { hoje, dryRun, pulado, mensagens: [], gravadas: 0, repetidas: 0 };
  // O dryRun monta mesmo com tudo desligado: é como se confere o texto antes de ligar.
  if (pulado && !dryRun) return base;

  const [membros, cards] = await Promise.all([lerMembrosCobranca(db), lerCardsAbertos(db)]);
  const comentarios = await ultimosComentarios(db, cards);

  for (const m of membros.filter(podeReceber)) {
    const pendencias = pendenciasDoMembro(cards, m.user_id, hoje, cfg.dias_parado, comentarios);
    const texto = montarMensagemDiaria({ nome: m.nome, hoje, pendencias, diasParado: cfg.dias_parado, ultimoComentario: comentarios, linkInicio: opcoes.linkInicio });
    if (!texto) continue;
    const itens = totalPendencias(pendencias);
    if (dryRun) {
      base.mensagens.push({ membro: m.nome, itens, gravada: false, texto });
      continue;
    }
    const cardIds = [...pendencias.atrasadas, ...pendencias.vencendo, ...pendencias.paradas].map((c) => c.id);
    const { data, error } = await db
      .from('ti_agente_mensagens')
      .upsert(
        { membro_id: m.id, direcao: 'saida', tipo: 'cobranca', texto, card_ids: cardIds, status: 'pendente', chave_dia: chaveDia(m.id, hoje) },
        { onConflict: 'chave_dia', ignoreDuplicates: true },
      )
      .select('id');
    if (error) throw new Error(error.message);
    const gravada = (data ?? []).length > 0;
    if (gravada) base.gravadas += 1; else base.repetidas += 1;
    base.mensagens.push({ membro: m.nome, itens, gravada });
  }
  return base;
}

// ── Cobrar / Lembrar (D22, RN16) ─────────────────────────────────────────────

export type ResultadoCobrar =
  /** `agendadaPara`: fora do horário de cobrança, o instante (ISO) em que ela sai; null = sai já. */
  | { ok: true; modo: ModoCobranca; destinatarios: string[]; agendadaPara: string | null }
  | { ok: false; status: 403 | 404 | 409 | 422; erro: string };

export type ChecagemCobranca =
  | { ok: true; card: CardTI; modo: ModoCobranca; alvos: MembroCobranca[] }
  | { ok: false; status: 403 | 404 | 409 | 422; erro: string };

/**
 * Tudo o que o Cobrar confere, sem gravar: permissão, WhatsApp ligado, card atrasado, janela de
 * 4 h e quem recebe. Os comandos pelo WhatsApp (D29) usam para mostrar o que vai sair antes do SIM.
 */
export async function checarCobranca(
  db: SupabaseClient,
  usuario: Usuario,
  cardId: string,
  agora = new Date(),
  membros?: MembroCobranca[],
): Promise<ChecagemCobranca> {
  const { data: card, error } = await db.from('it_requests').select(CAMPOS_CARD).eq('id', cardId).maybeSingle<CardTI>();
  if (error) throw new Error(error.message);
  if (!card || card.kanban_hidden) return { ok: false, status: 404, erro: 'Card não encontrado.' };
  const c: CardTI = { ...card, assigned_to: card.assigned_to ?? [] };

  const [cfg, { data: ultima }] = await Promise.all([
    lerConfigCobranca(db),
    db.from('ti_agente_mensagens')
      .select('created_at')
      .eq('tipo', 'cobranca_manual')
      .neq('status', 'falhou')
      .contains('card_ids', [c.id])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const hoje = hojeSP(agora);
  const r = podeCobrar({
    card: c,
    usuarioId: usuario.userId,
    ehGestor: tem(usuario, 'canApproveAgenteTI'),
    podeGerenciar: tem(usuario, 'canManageIT'),
    whatsappAtivo: cfg.whatsapp_ativo,
    ultimaManualEm: (ultima?.created_at as string | undefined) ?? null,
    agora: agora.getTime(),
    hoje,
  });
  if ('motivo' in r) return { ok: false, status: r.status, erro: r.motivo };

  const alvos = destinatarios(c, r.modo, usuario.userId, membros ?? (await lerMembrosCobranca(db)));
  if (alvos.length === 0) {
    return {
      ok: false,
      status: 422,
      erro: r.modo === 'lembrar'
        ? 'Você não tem WhatsApp cadastrado com adesão à cobrança (EVA → Membros).'
        : 'Nenhum responsável do card tem WhatsApp cadastrado com adesão à cobrança (EVA → Membros).',
    };
  }
  return { ok: true, card: c, modo: r.modo, alvos };
}

export async function cobrarCard(db: SupabaseClient, usuario: Usuario, cardId: string, agora = new Date()): Promise<ResultadoCobrar> {
  const ch = await checarCobranca(db, usuario, cardId, agora);
  if ('erro' in ch) return ch;
  const { card: c, modo, alvos } = ch;
  const hoje = hojeSP(agora);
  // Fora do horário de cobrança (dia útil, 7h às 20h), a cobrança fica agendada para a próxima janela.
  const janela = proximaJanelaDeCobranca(agora.getTime());
  const agendadaPara = janela === null ? null : new Date(janela).toISOString();
  const { error: eIns } = await db.from('ti_agente_mensagens').insert(
    alvos.map((m) => ({
      membro_id: m.id, direcao: 'saida', tipo: 'cobranca_manual', status: 'pendente', card_ids: [c.id], enviada_por: usuario.userId,
      texto: montarCobrancaManual({ nome: m.nome, card: c, hoje, modo }), proxima_tentativa_em: agendadaPara,
    })),
  );
  if (eIns) throw new Error(eIns.message);
  return { ok: true, modo, destinatarios: alvos.map((m) => m.nome), agendadaPara };
}

// ── Enviar teste (RF19) ──────────────────────────────────────────────────────

export const TEXTO_TESTE = 'Teste da EVA, a agente de TI do FlowLab: se esta mensagem chegou, o WhatsApp está funcionando. Não precisa responder.';

export async function enfileirarTeste(db: SupabaseClient, usuario: Usuario, membroId: string): Promise<{ ok: true; id: string } | { ok: false; status: 404 | 422; erro: string }> {
  const cfg = await lerConfigCobranca(db);
  if (!cfg.whatsapp_ativo) return { ok: false, status: 422, erro: 'Ligue o WhatsApp em EVA → Configurações antes do teste.' };
  const { data: m, error } = await db.from('ti_agente_membros').select('id, whatsapp, ativo').eq('id', membroId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!m) return { ok: false, status: 404, erro: 'Membro não encontrado.' };
  if (!m.whatsapp) return { ok: false, status: 422, erro: 'Cadastre o WhatsApp do membro antes do teste.' };
  const { data, error: eIns } = await db
    .from('ti_agente_mensagens')
    .insert({ membro_id: m.id, direcao: 'saida', tipo: 'teste', status: 'pendente', texto: TEXTO_TESTE, enviada_por: usuario.userId })
    .select('id')
    .single();
  if (eIns) throw new Error(eIns.message);
  return { ok: true, id: data.id as string };
}
