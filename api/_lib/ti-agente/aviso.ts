// Aviso de gestor para uma pessoa pelo WhatsApp (issue 21, plano D32). O gestor pede pelo chat do
// Início (cartão "Enviar pelo WhatsApp", ação agente-avisar) ou pelo próprio WhatsApp ("avisa o
// Gabriel que…", com SIM, em comandos.ts). Os dois caminhos passam por aqui.
// Vai para quem está ativo na aba Membros com WhatsApp: a adesão "Recebe cobrança" vale só para
// as cobranças (escolha do usuário, 15/Out). Respeita o horário da EVA (dia útil, das 7h às 20h).
import type { SupabaseClient } from '@supabase/supabase-js';
import { proximaJanelaDeCobranca } from '../../../src/modules/eva/domain/cobranca.js';
import { CHAVE_GESTOR } from '../../../src/modules/eva/domain/papeis.js';
import { primeiroNome } from '../../../src/modules/eva/domain/pessoas.js';
import { tem, type Usuario } from './autorizacao.js';
import { lerConfigCobranca } from './cobranca.js';

export const MAX_AVISO_PESSOAL = 1000;

export type FalhaAviso = { ok: false; status: 403 | 422; erro: string };
export interface DestinoAviso { ok: true; membroId: string; userId: string; nome: string }

/** Quem pode receber: gestor pedindo, WhatsApp da EVA ligado e a pessoa ativa na aba Membros com WhatsApp. */
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
  if (!m.whatsapp) return { ok: false, status: 422, erro: `${primeiroNome(nome)} não tem WhatsApp cadastrado na aba Membros.` };
  return { ok: true, membroId: m.id as string, userId: m.user_id as string, nome };
}

export interface AvisoEnviado { ok: true; id: string; para: string; agendadaPara: string | null }

/**
 * Confere de novo e grava na fila. `texto` já vem pronto (montarAviso, com o nome de quem pediu).
 * Fora do horário, a mensagem fica agendada para a próxima janela (`agendadaPara`).
 */
export async function enviarAvisoPessoal(
  db: SupabaseClient, usuario: Usuario, destinoUserId: string, texto: string, agora = new Date(),
): Promise<AvisoEnviado | FalhaAviso> {
  const corpo = texto.trim().slice(0, MAX_AVISO_PESSOAL + 60);
  if (!corpo) return { ok: false, status: 422, erro: 'Escreva o aviso.' };
  const d = await checarAvisoPessoal(db, usuario, destinoUserId);
  if ('erro' in d) return d;
  const janela = proximaJanelaDeCobranca(agora.getTime());
  const agendadaPara = janela === null ? null : new Date(janela).toISOString();
  const { data, error } = await db
    .from('ti_agente_mensagens')
    .insert({
      membro_id: d.membroId, direcao: 'saida', tipo: 'aviso', status: 'pendente', texto: corpo, card_ids: [],
      enviada_por: usuario.userId, proxima_tentativa_em: agendadaPara,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return { ok: true, id: data.id as string, para: d.nome, agendadaPara };
}
