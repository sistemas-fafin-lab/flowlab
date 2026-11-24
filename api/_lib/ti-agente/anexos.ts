// Imagem do WhatsApp anexada ao card ou chamado (D43, issue 32). A imagem já está no bucket privado
// ti-agente-midias (a VPS subiu); aqui ela é copiada para o it-attachments, o bucket dos anexos da
// conversa dos chamados, e entra num comentário de quem mandou, como se tivesse anexado pela tela.
// Não depende de comandos.ts: o roteador usa anexarAguardando quando chega o código do card.
import type { SupabaseClient } from '@supabase/supabase-js';
import { BUCKET_MIDIAS, IMAGEM_AGUARDA_MS, mimeBase, nomeDoAnexo } from '../../../src/modules/eva/domain/midia.js';
import { CHAVE_APROVAR, CHAVE_GESTOR } from '../../../src/modules/eva/domain/papeis.js';
import { caminhoDoAnexo, type AnexoIT } from '../../../src/utils/itAnexos.js';
import { tem, type Usuario } from './autorizacao.js';
import type { Remetente } from './respostas.js';

const BUCKET_ANEXOS = 'it-attachments';

export interface CardDoAnexo { id: string; codigo: string; assigned_to: string[] | null; requested_by: string | null }

/** Uma imagem recebida, já no bucket privado. */
export interface ImagemRecebida { id: string; midia_path: string; midia_mimetype: string | null; created_at: string }

/**
 * Os cards citados que a pessoa pode anexar: a equipe (gestor, quem aprova, canManageIT) anexa em
 * qualquer um; os demais, nos próprios (responsável ou solicitante), como no "atualizar" do WhatsApp.
 */
export async function cardsParaAnexar(
  db: SupabaseClient,
  usuario: Usuario | null,
  codigos: string[],
): Promise<{ achados: CardDoAnexo[]; faltam: string[] }> {
  if (codigos.length === 0) return { achados: [], faltam: [] };
  const { data, error } = await db.from('it_requests').select('id, codigo, assigned_to, requested_by').in('codigo', codigos);
  if (error) throw new Error(error.message);
  const veTodos = !!usuario && (tem(usuario, CHAVE_GESTOR) || tem(usuario, CHAVE_APROVAR) || tem(usuario, 'canManageIT'));
  const pode = (c: CardDoAnexo) => veTodos || (!!usuario && ((c.assigned_to ?? []).includes(usuario.userId) || c.requested_by === usuario.userId));
  const achados = ((data ?? []) as CardDoAnexo[]).filter(pode).sort((a, b) => codigos.indexOf(a.codigo) - codigos.indexOf(b.codigo));
  return { achados, faltam: codigos.filter((c) => !achados.some((a) => a.codigo === c)) };
}

/**
 * Copia as imagens para o it-attachments e grava um comentário por card, com elas anexadas.
 * Depois apaga as cópias do bucket privado e marca as mensagens como tratadas.
 */
export async function anexarImagens(
  db: SupabaseClient,
  e: { membro: Remetente; cards: CardDoAnexo[]; imagens: ImagemRecebida[]; legenda: string | null },
): Promise<void> {
  const arquivos: { imagem: ImagemRecebida; bytes: Uint8Array }[] = [];
  for (const imagem of e.imagens) {
    const { data, error } = await db.storage.from(BUCKET_MIDIAS).download(imagem.midia_path);
    if (error || !data) throw new Error(`Não consegui ler a imagem recebida: ${error?.message ?? 'arquivo vazio'}`);
    arquivos.push({ imagem, bytes: new Uint8Array(await data.arrayBuffer()) });
  }

  let n = 0;
  for (const card of e.cards) {
    const anexos: AnexoIT[] = [];
    for (const { imagem, bytes } of arquivos) {
      const nome = nomeDoAnexo(imagem.created_at, imagem.midia_mimetype);
      const type = mimeBase(imagem.midia_mimetype) || 'image/jpeg';
      const caminho = caminhoDoAnexo(e.membro.user_id, card.id, nome, Date.now() + n);
      n += 1;
      const { error } = await db.storage.from(BUCKET_ANEXOS).upload(caminho, bytes, { contentType: type, upsert: false, cacheControl: '3600' });
      if (error) throw new Error(`Não consegui anexar a imagem ao ${card.codigo}: ${error.message}`);
      const { data } = db.storage.from(BUCKET_ANEXOS).getPublicUrl(caminho);
      anexos.push({ url: data.publicUrl, name: nome, size: bytes.byteLength, type });
    }
    const legenda = (e.legenda ?? '').trim();
    const { error } = await db.from('it_task_comments').insert({
      task_id: card.id,
      user_id: e.membro.user_id,
      content: `via WhatsApp: ${legenda || (anexos.length > 1 ? `📎 ${anexos.length} imagens` : '📎 imagem')}`,
      attachments: anexos,
    });
    if (error) throw new Error(error.message);
  }

  const ids = e.imagens.map((i) => i.id);
  await db.from('ti_agente_mensagens').update({ midia_status: 'processada', card_ids: e.cards.map((c) => c.id), erro: null }).in('id', ids);
  // Melhor esforço: sobra um arquivo no bucket privado, e a limpeza do relógio não depende disso.
  await db.storage.from(BUCKET_MIDIAS).remove(e.imagens.map((i) => i.midia_path)).catch(() => undefined);
}

/** As imagens do membro que esperam o código do card, das últimas 2 h, da mais antiga à mais nova. */
export async function imagensAguardando(db: SupabaseClient, membroId: string, agora: Date): Promise<ImagemRecebida[]> {
  const { data, error } = await db
    .from('ti_agente_mensagens')
    .select('id, midia_path, midia_mimetype, created_at')
    .eq('membro_id', membroId)
    .eq('direcao', 'entrada')
    .eq('midia_status', 'aguardando_card')
    .gte('created_at', new Date(agora.getTime() - IMAGEM_AGUARDA_MS).toISOString())
    .order('created_at')
    .limit(5);
  if (error) return []; // sem a migration de D43, não há imagem esperando
  return ((data ?? []) as ImagemRecebida[]).filter((i) => !!i.midia_path);
}

/**
 * Chegou uma mensagem com código de card e havia imagem esperando: anexa. Devolve os códigos que
 * receberam a imagem (null quando não havia imagem esperando ou nenhum card serve).
 */
export async function anexarAguardando(
  db: SupabaseClient,
  e: { membro: Remetente; usuario: Usuario | null; codigos: string[]; agora: Date },
): Promise<{ codigos: string[]; imagens: number } | null> {
  const imagens = await imagensAguardando(db, e.membro.id, e.agora);
  if (imagens.length === 0) return null;
  const { achados } = await cardsParaAnexar(db, e.usuario, e.codigos);
  if (achados.length === 0) return null;
  await anexarImagens(db, { membro: e.membro, cards: achados, imagens, legenda: null });
  return { codigos: achados.map((c) => c.codigo), imagens: imagens.length };
}
