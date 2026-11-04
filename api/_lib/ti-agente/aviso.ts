// Aviso de gestor pelo WhatsApp: para uma pessoa (issue 21, plano D32) ou para a equipe toda
// (issue 25, D36). O gestor pede pelo chat do Início (cartão do aviso, ação agente-avisar) ou pelo
// próprio WhatsApp ("avisa o Gabriel que…", "avisa todo mundo que…", com SIM, em comandos.ts). Os
// dois caminhos passam por aqui.
// Vai para quem está ativo na aba Membros com WhatsApp: a adesão "Recebe cobrança" vale só para
// as cobranças (escolha do usuário, 15/Out). Quem não tem WhatsApp recebe no grupo da equipe, com
// o nome citado (D35, acordo do usuário com a equipe, 16/Out). Respeita o horário da EVA (dia útil,
// das 7h às 20h).
import type { SupabaseClient } from '@supabase/supabase-js';
import { proximaJanelaDeCobranca } from '../../../src/modules/eva/domain/cobranca.js';
import { CHAVE_GESTOR } from '../../../src/modules/eva/domain/papeis.js';
import { juntarNomes, nomeParaCitar, primeiroNome } from '../../../src/modules/eva/domain/pessoas.js';
import { tem, type Usuario } from './autorizacao.js';
import { lerConfigCobranca, lerMembrosCobranca } from './cobranca.js';
import { montarAviso } from './grupo.js';

export const MAX_AVISO_PESSOAL = 1000;

export type FalhaAviso = { ok: false; status: 403 | 422; erro: string };
export interface DestinoAviso {
  ok: true;
  membroId: string;
  userId: string;
  nome: string;
  /** Sem WhatsApp: o aviso vai para o grupo da equipe, citando a pessoa assim (D35). null = no privado. */
  grupo: { id: string; nome: string | null; citado: string } | null;
}

/**
 * Quem pode receber: gestor pedindo, WhatsApp da EVA ligado e a pessoa ativa na aba Membros. Sem
 * WhatsApp cadastrado, vai pelo grupo da equipe, se houver um escolhido.
 */
export async function checarAvisoPessoal(db: SupabaseClient, usuario: Usuario, destinoUserId: string): Promise<DestinoAviso | FalhaAviso> {
  if (!tem(usuario, CHAVE_GESTOR)) return { ok: false, status: 403, erro: 'Só gestores da EVA mandam avisos pelo WhatsApp.' };
  const cfg = await lerConfigCobranca(db);
  if (!cfg.whatsapp_ativo) return { ok: false, status: 422, erro: 'O WhatsApp da EVA está desligado (EVA → Configurações).' };
  const { data: m, error } = await db
    .from('ti_agente_membros')
    .select('id, user_id, whatsapp, ativo, perfil:user_profiles!ti_agente_membros_user_id_fkey(name, deleted_at, disabled_at)')
    .eq('user_id', destinoUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!m) return { ok: false, status: 422, erro: 'Essa pessoa não está na aba Membros da EVA.' };
  const perfil = m.perfil as unknown as { name: string; deleted_at: string | null; disabled_at: string | null } | null;
  const nome = perfil?.name ?? 'Essa pessoa';
  if (!m.ativo || !perfil || perfil.deleted_at || perfil.disabled_at) return { ok: false, status: 422, erro: `${primeiroNome(nome)} está inativo na aba Membros.` };
  const destino = { ok: true as const, membroId: m.id as string, userId: m.user_id as string, nome };
  if (m.whatsapp) return { ...destino, grupo: null };
  if (!cfg.grupo_id) {
    return {
      ok: false,
      status: 422,
      erro: `${primeiroNome(nome)} não tem WhatsApp cadastrado na aba Membros, e não há grupo da equipe escolhido para o aviso ir por lá (EVA → Configurações).`,
    };
  }
  const equipe = await lerMembrosCobranca(db);
  return { ...destino, grupo: { id: cfg.grupo_id, nome: cfg.grupo_nome, citado: nomeParaCitar(nome, equipe.map((x) => x.nome)) } };
}

export interface AvisoEnviado { ok: true; id: string; para: string; noGrupo: boolean; grupoNome: string | null; agendadaPara: string | null }

/**
 * Confere de novo, monta o texto ("📢 Aviso de <de>: …", com quem pediu) e grava na fila: no
 * privado, ou no grupo citando a pessoa. Fora do horário, a mensagem fica agendada (`agendadaPara`).
 */
export async function enviarAvisoPessoal(
  db: SupabaseClient, usuario: Usuario, destinoUserId: string, pedido: { de: string; aviso: string }, agora = new Date(),
): Promise<AvisoEnviado | FalhaAviso> {
  const aviso = pedido.aviso.trim().slice(0, MAX_AVISO_PESSOAL);
  if (!aviso) return { ok: false, status: 422, erro: 'Escreva o aviso.' };
  const d = await checarAvisoPessoal(db, usuario, destinoUserId);
  if ('erro' in d) return d;
  const janela = proximaJanelaDeCobranca(agora.getTime());
  const agendadaPara = janela === null ? null : new Date(janela).toISOString();
  const destino = d.grupo
    ? { membro_id: null, chat_id_destino: d.grupo.id, texto: montarAviso(pedido.de, aviso, d.grupo.citado) }
    : { membro_id: d.membroId, texto: montarAviso(pedido.de, aviso) };
  const { data, error } = await db
    .from('ti_agente_mensagens')
    .insert({ ...destino, direcao: 'saida', tipo: 'aviso', status: 'pendente', card_ids: [], enviada_por: usuario.userId, proxima_tentativa_em: agendadaPara })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return { ok: true, id: data.id as string, para: d.nome, noGrupo: !!d.grupo, grupoNome: d.grupo?.nome ?? null, agendadaPara };
}

// ── Para a equipe toda (D36) ────────────────────────────────────────────────

export interface PessoaDaEquipe { membroId: string; userId: string; nome: string }

export interface DestinosEquipe {
  ok: true;
  /** Quem tem WhatsApp: uma mensagem no privado de cada um. */
  privado: PessoaDaEquipe[];
  /** Quem não tem WhatsApp, citado numa mensagem só no grupo da equipe (D35). null = ninguém, ou sem grupo. */
  noGrupo: { id: string; nome: string | null; citados: string[] } | null;
  /** Sem WhatsApp e sem grupo escolhido: ficam de fora (a prévia diz quem). */
  semDestino: string[];
}

/**
 * "Avisa todo mundo que…" (D36): todos os ativos da aba Membros, menos quem pede (escolha do
 * usuário, 04/Nov), com ou sem a adesão à cobrança, como no aviso para uma pessoa (D32).
 */
export async function checarAvisoEquipe(db: SupabaseClient, usuario: Usuario): Promise<DestinosEquipe | FalhaAviso> {
  if (!tem(usuario, CHAVE_GESTOR)) return { ok: false, status: 403, erro: 'Só gestores da EVA mandam avisos pelo WhatsApp.' };
  const cfg = await lerConfigCobranca(db);
  if (!cfg.whatsapp_ativo) return { ok: false, status: 422, erro: 'O WhatsApp da EVA está desligado (EVA → Configurações).' };
  const { data, error } = await db
    .from('ti_agente_membros')
    .select('id, user_id, whatsapp, ativo, perfil:user_profiles!ti_agente_membros_user_id_fkey(name, deleted_at, disabled_at)');
  if (error) throw new Error(error.message);
  type Perfil = { name: string; deleted_at: string | null; disabled_at: string | null } | null;
  const linhas = (data ?? []).map((m) => ({ m, p: m.perfil as unknown as Perfil }));
  // Para citar no grupo, o primeiro nome só não basta quando outra pessoa da equipe tem o mesmo (D35).
  const nomesDaEquipe = linhas.filter(({ p }) => p && !p.deleted_at).map(({ p }) => p!.name);
  const equipe = linhas
    .filter(({ m, p }) => m.ativo && p && !p.deleted_at && !p.disabled_at && m.user_id !== usuario.userId)
    .map(({ m, p }) => ({ membroId: m.id as string, userId: m.user_id as string, nome: p!.name, whatsapp: (m.whatsapp as string | null) ?? null }));
  if (equipe.length === 0) return { ok: false, status: 422, erro: 'Não há mais ninguém ativo na aba Membros para avisar.' };

  const pessoa = ({ membroId, userId, nome }: (typeof equipe)[number]): PessoaDaEquipe => ({ membroId, userId, nome });
  const privado = equipe.filter((m) => m.whatsapp).map(pessoa);
  const semWhatsapp = equipe.filter((m) => !m.whatsapp);
  const noGrupo = semWhatsapp.length && cfg.grupo_id
    ? { id: cfg.grupo_id, nome: cfg.grupo_nome, citados: semWhatsapp.map((m) => nomeParaCitar(m.nome, nomesDaEquipe)) }
    : null;
  const semDestino = noGrupo ? [] : semWhatsapp.map((m) => m.nome);
  if (privado.length === 0 && !noGrupo) {
    return {
      ok: false,
      status: 422,
      erro: 'Ninguém da equipe tem WhatsApp cadastrado na aba Membros, e não há grupo da equipe escolhido para o aviso ir por lá (EVA → Configurações).',
    };
  }
  return { ok: true, privado, noGrupo, semDestino };
}

export interface AvisoEquipeEnviado {
  ok: true;
  ids: string[];
  /** Quem recebe no privado. */
  para: string[];
  citadosNoGrupo: string[];
  grupoNome: string | null;
  semDestino: string[];
  agendadaPara: string | null;
}

/**
 * Confere de novo e grava na fila, de uma vez: uma mensagem no privado de cada um ("📢 Aviso de
 * <de>: …") e, para quem não tem WhatsApp, uma no grupo citando os nomes ("📢 Aviso de <de> para
 * Bruno e Carla: …"). Fora do horário, todas ficam agendadas.
 */
export async function enviarAvisoEquipe(
  db: SupabaseClient, usuario: Usuario, pedido: { de: string; aviso: string }, agora = new Date(),
): Promise<AvisoEquipeEnviado | FalhaAviso> {
  const aviso = pedido.aviso.trim().slice(0, MAX_AVISO_PESSOAL);
  if (!aviso) return { ok: false, status: 422, erro: 'Escreva o aviso.' };
  const d = await checarAvisoEquipe(db, usuario);
  if ('erro' in d) return d;
  const janela = proximaJanelaDeCobranca(agora.getTime());
  const agendadaPara = janela === null ? null : new Date(janela).toISOString();
  const base = { direcao: 'saida', tipo: 'aviso', status: 'pendente', card_ids: [], enviada_por: usuario.userId, proxima_tentativa_em: agendadaPara };
  const linhas = [
    ...d.privado.map((p) => ({ ...base, membro_id: p.membroId, texto: montarAviso(pedido.de, aviso) })),
    ...(d.noGrupo ? [{ ...base, membro_id: null, chat_id_destino: d.noGrupo.id, texto: montarAviso(pedido.de, aviso, juntarNomes(d.noGrupo.citados)) }] : []),
  ];
  const { data, error } = await db.from('ti_agente_mensagens').insert(linhas).select('id');
  if (error) throw new Error(error.message);
  return {
    ok: true,
    ids: (data ?? []).map((l) => l.id as string),
    para: d.privado.map((p) => p.nome),
    citadosNoGrupo: d.noGrupo?.citados ?? [],
    grupoNome: d.noGrupo?.nome ?? null,
    semDestino: d.semDestino,
    agendadaPara,
  };
}
