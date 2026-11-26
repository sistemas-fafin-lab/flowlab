// Áudio e imagem pelo WhatsApp, do lado da Vercel (D43, issue 32). A VPS baixou o arquivo do WAHA
// local e subiu para o bucket privado ti-agente-midias; aqui:
// - o áudio vira texto (Gemini) e segue como uma mensagem escrita (processarRecebida);
// - a imagem vai para o card ou chamado citado na legenda, ou espera a pessoa dizer o código.
// Cada mensagem é tratada uma vez só: quem trata primeiro troca a situação para "processando".
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  AUDIO_NAO_ENTENDI, BUCKET_MIDIAS, CARD_NAO_ACHADO, IMAGEM_AGUARDA_MS, MIDIA_GRANDE, MIDIA_NAO_BAIXOU, PEDIR_CARD_DA_IMAGEM,
  anexei, codigosNoTexto, mimeBase, soCodigos,
} from '../../../src/modules/eva/domain/midia.js';
import { usuarioPorId } from './autorizacao.js';
import { anexarImagens, cardsParaAnexar } from './anexos.js';
import { processarRecebida, responder } from './comandos.js';
import { gerarEstruturado, type Dependencias } from './ia/gerarEstruturado.js';
import type { Remetente } from './respostas.js';

// A ordem dos campos importa: o modelo decide primeiro se há fala, e só depois escreve. No teste
// com um áudio só de silêncio, sem esse primeiro campo, o Gemini inventou "Boa tarde, tudo bem?".
export const SchemaTranscricao = z.object({
  /** Há voz humana falando palavras no áudio (não só silêncio, chiado, música ou barulho)? */
  tem_fala: z.boolean(),
  /** O que a pessoa disse, fiel, sem resumir. Vazio quando não há fala. */
  transcricao: z.string(),
  /** A transcrição é confiável (fala clara o bastante para agir em cima dela)? */
  entendeu: z.boolean(),
});

export const INSTRUCOES_TRANSCRICAO = `Você é um transcritor de áudio. Sua única tarefa é escrever as palavras que uma voz humana realmente pronunciou no áudio.

Passo 1. Ouça o áudio inteiro e decida se há voz humana pronunciando palavras.
- Silêncio, áudio mudo, chiado, respiração, música ou barulho de fundo NÃO são fala.
- Sem fala: tem_fala = false, transcricao = "" e entendeu = false. Não escreva nada.
- Nunca invente, complete ou imagine frases. Um áudio sem voz não tem transcrição.

Passo 2 (só se houver fala). Escreva, em português do Brasil, exatamente o que foi dito, sem resumir, sem responder e sem comentar.
Formatação, aplicada somente a palavras que foram de fato ditas:
- código de card dito como "IT quarenta e cinco" ou "IT zero quarenta e cinco" se escreve IT-045;
- datas e horas ditas por extenso viram números ("dia vinte e cinco" → "dia 25"; "às três da tarde" → "às 15h").

entendeu = false quando a fala está tão cortada ou baixa que não dá para confiar no que foi dito.`;

/** O áudio transcrito vira o texto da mensagem; o limite é o mesmo do webhook. */
const MAX_TEXTO_MENSAGEM = 4000;

interface LinhaMidia {
  id: string;
  membro_id: string | null;
  texto: string | null;
  created_at: string;
  midia_tipo: 'audio' | 'imagem' | null;
  midia_mimetype: string | null;
  midia_status: string | null;
  midia_path: string | null;
  erro: string | null;
}

const CAMPOS = 'id, membro_id, texto, created_at, midia_tipo, midia_mimetype, midia_status, midia_path, erro';

export type ResultadoMidia =
  | { acao: 'ja_tratada' }
  | { acao: 'nao_baixou' | 'nao_entendeu' | 'erro'; erro: string | null }
  | { acao: 'transcrita'; resposta: string | null }
  | { acao: 'anexada'; codigos: string[]; resposta: string | null }
  | { acao: 'aguardando_card'; resposta: string | null };

/** A legenda da imagem; "(imagem)" é o que o webhook grava quando não há legenda. */
const legendaDe = (texto: string | null) => (texto && texto !== '(imagem)' ? texto.trim() : '');

async function lerRemetente(db: SupabaseClient, membroId: string): Promise<Remetente | null> {
  const { data } = await db
    .from('ti_agente_membros')
    .select('id, user_id, perfil:user_profiles!ti_agente_membros_user_id_fkey(name)')
    .eq('id', membroId)
    .maybeSingle();
  if (!data) return null;
  const perfil = data.perfil as unknown as { name: string } | null;
  return { id: data.id as string, user_id: data.user_id as string, nome: perfil?.name ?? '' };
}

async function apagarArquivo(db: SupabaseClient, caminho: string | null) {
  if (!caminho) return;
  await db.storage.from(BUCKET_MIDIAS).remove([caminho]).catch(() => undefined);
}

/**
 * Trata a mídia de uma mensagem recebida. Chamado pela VPS logo depois de subir o arquivo
 * (/api/ti/agente-midia) e pelo relógio, para o que ficou para trás.
 */
export async function processarMidia(db: SupabaseClient, ia: Dependencias, mensagemId: string, agora = new Date()): Promise<ResultadoMidia> {
  // Quem trocar a situação primeiro trata; a outra chamada (VPS e relógio juntos) para aqui.
  const { data: linhas, error } = await db
    .from('ti_agente_mensagens')
    .update({ midia_status: 'processando' })
    .eq('id', mensagemId)
    .in('midia_status', ['baixada', 'nao_baixou'])
    .select(CAMPOS);
  if (error) throw new Error(error.message);
  const msg = (linhas ?? [])[0] as LinhaMidia | undefined;
  if (!msg) return { acao: 'ja_tratada' };

  const marcar = (campos: Record<string, unknown>) => db.from('ti_agente_mensagens').update(campos).eq('id', msg.id);
  const membro = msg.membro_id ? await lerRemetente(db, msg.membro_id) : null;
  if (!membro) {
    await marcar({ midia_status: 'erro', erro: 'Mensagem sem membro.' });
    await apagarArquivo(db, msg.midia_path);
    return { acao: 'erro', erro: 'Mensagem sem membro.' };
  }

  // A VPS não conseguiu baixar (o WAHA apagou o arquivo, ou passou de 10 MB): não há arquivo no
  // bucket. (A linha devolvida pelo update já vem como "processando": é o caminho que diz.)
  if (!msg.midia_path) {
    const grande = /10 MB/.test(msg.erro ?? '');
    await responder(db, membro.id, grande ? MIDIA_GRANDE : MIDIA_NAO_BAIXOU);
    await marcar({ midia_status: 'erro' });
    return { acao: 'nao_baixou', erro: msg.erro };
  }

  try {
    if (msg.midia_tipo === 'audio') return await tratarAudio(db, ia, msg, membro, agora);
    return await tratarImagem(db, ia, msg, membro, agora);
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    console.error('[EVA/midia] Mídia não tratada:', e);
    await marcar({ midia_status: 'erro', erro: `Falha ao tratar a mídia: ${erro}`.slice(0, 500) });
    await responder(db, membro.id, MIDIA_NAO_BAIXOU).catch(() => undefined);
    return { acao: 'erro', erro };
  }
}

async function tratarAudio(db: SupabaseClient, ia: Dependencias, msg: LinhaMidia, membro: Remetente, agora: Date): Promise<ResultadoMidia> {
  const { data: arquivo, error } = await db.storage.from(BUCKET_MIDIAS).download(msg.midia_path!);
  if (error || !arquivo) throw new Error(`Não consegui ler o áudio: ${error?.message ?? 'arquivo vazio'}`);
  const base64 = Buffer.from(await arquivo.arrayBuffer()).toString('base64');

  const r = await gerarEstruturado(
    {
      finalidade: 'transcricao_audio',
      instrucoes: INSTRUCOES_TRANSCRICAO,
      conteudo: 'Transcreva o áudio acima.',
      schema: SchemaTranscricao,
      esforco: 'low',
      anexos: [{ mimetype: mimeBase(msg.midia_mimetype) || 'audio/ogg', base64 }],
      // Só o Gemini ouve áudio: o Claude nem é tentado (e não vira "falha" no registro).
      provedores: ['gemini'],
      temperatura: 0,
      mensagemId: msg.id,
      userId: membro.user_id,
    },
    ia,
  );
  // O áudio não fica guardado: depois da transcrição (ou da tentativa), sai do bucket.
  await apagarArquivo(db, msg.midia_path);

  const transcricao = 'dados' in r ? r.dados.transcricao.trim() : '';
  if (!('dados' in r) || !r.dados.tem_fala || !r.dados.entendeu || !transcricao) {
    const erro = 'erros' in r ? `Sem transcrição: ${r.erros.join(' · ')}` : 'O áudio não tinha fala compreensível.';
    await db.from('ti_agente_mensagens').update({ midia_status: 'erro', midia_path: null, erro: erro.slice(0, 500) }).eq('id', msg.id);
    await responder(db, membro.id, AUDIO_NAO_ENTENDI);
    return { acao: 'nao_entendeu', erro };
  }

  await db.from('ti_agente_mensagens')
    .update({ texto: transcricao.slice(0, MAX_TEXTO_MENSAGEM), midia_status: 'processada', midia_path: null, erro: null })
    .eq('id', msg.id);
  // Daqui em diante, é uma mensagem escrita: o mesmo roteador, a mesma IA, as mesmas regras.
  // A resposta começa com o que a EVA ouviu: um erro de transcrição aparece na hora para quem
  // mandou. No teste com áudio mudo (silêncio digital), o Gemini às vezes inventou uma frase.
  const resultado = await processarRecebida(db, ia, msg.id, agora, { prefixo: ouvi(transcricao) });
  return { acao: 'transcrita', resposta: resultado.resposta };
}

const MAX_ECO = 300;
/** O eco da transcrição, no começo da resposta ao áudio. */
export const ouvi = (transcricao: string) => `🎤 Entendi: "${transcricao.length > MAX_ECO ? `${transcricao.slice(0, MAX_ECO - 1)}…` : transcricao}"`;

async function tratarImagem(db: SupabaseClient, ia: Dependencias, msg: LinhaMidia, membro: Remetente, agora: Date): Promise<ResultadoMidia> {
  const legenda = legendaDe(msg.texto);
  const codigos = codigosNoTexto(legenda);
  const imagem = { id: msg.id, midia_path: msg.midia_path!, midia_mimetype: msg.midia_mimetype, created_at: msg.created_at };
  const esperar = () => db.from('ti_agente_mensagens').update({ midia_status: 'aguardando_card' }).eq('id', msg.id);

  if (codigos.length > 0) {
    const usuario = await usuarioPorId(db, membro.user_id);
    const { achados, faltam } = await cardsParaAnexar(db, usuario, codigos);
    if (achados.length === 0) {
      // Código errado ou de card que não é dela: a imagem espera o código certo.
      await esperar();
      const resposta = `${CARD_NAO_ACHADO(codigos)} A imagem fica guardada por 2 h.`;
      await responder(db, membro.id, resposta);
      return { acao: 'aguardando_card', resposta };
    }
    await anexarImagens(db, { membro, cards: achados, imagens: [imagem], legenda });
    const aviso = [anexei(achados.map((c) => c.codigo)), faltam.length ? CARD_NAO_ACHADO(faltam) : ''].filter(Boolean).join(' ');
    if (soCodigos(legenda)) {
      await responder(db, membro.id, aviso, achados.map((c) => c.id));
      return { acao: 'anexada', codigos: achados.map((c) => c.codigo), resposta: aviso };
    }
    // A legenda diz mais ("IT-045 deu esse erro de novo"): segue como mensagem escrita, sem repetir o comentário.
    const r = await processarRecebida(db, ia, msg.id, agora, { prefixo: aviso, semComentarioEm: achados.map((c) => c.id) });
    return { acao: 'anexada', codigos: achados.map((c) => c.codigo), resposta: r.resposta };
  }

  // Sem código: a imagem espera; a legenda, se houver, segue como mensagem escrita.
  await esperar();
  if (!legenda) {
    await responder(db, membro.id, PEDIR_CARD_DA_IMAGEM);
    return { acao: 'aguardando_card', resposta: PEDIR_CARD_DA_IMAGEM };
  }
  const r = await processarRecebida(db, ia, msg.id, agora, { sufixo: PEDIR_CARD_DA_IMAGEM });
  return { acao: 'aguardando_card', resposta: r.resposta };
}

// ── O que o relógio faz com as mídias (a cada 10 min) ─────────────────────────

/** A VPS avisa a Vercel na hora; o relógio pega o que ficou para trás depois deste tempo. */
export const RETOMAR_DEPOIS_MS = 60 * 1000;
/** Pendente há mais que isso: a VPS não vai baixar (parou, ou o WAHA apagou o arquivo). */
export const PENDENTE_DESISTE_MS = 10 * 60 * 1000;
/** "processando" há mais que isso: a função caiu no meio. Fica como erro, sem resposta repetida. */
export const PROCESSANDO_DESISTE_MS = 15 * 60 * 1000;
const POR_RODADA = 5;

export interface ResultadoRetomada { retomadas: number; desistidas: number; travadas: number; expiradas: number }

export async function retomarMidias(db: SupabaseClient, ia: Dependencias, agora = new Date()): Promise<ResultadoRetomada> {
  const antes = (ms: number) => new Date(agora.getTime() - ms).toISOString();
  const r: ResultadoRetomada = { retomadas: 0, desistidas: 0, travadas: 0, expiradas: 0 };

  // 1. A VPS não baixou a tempo: vira "não baixou", e a EVA pede para mandar de novo.
  const { data: paradas } = await db.from('ti_agente_mensagens').update({ midia_status: 'nao_baixou', erro: 'A VPS não baixou o arquivo a tempo.' })
    .eq('direcao', 'entrada').eq('midia_status', 'pendente').lt('created_at', antes(PENDENTE_DESISTE_MS)).select('id');
  r.desistidas = (paradas ?? []).length;

  // 2. Baixadas (ou não baixadas) que a Vercel não tratou: a chamada da VPS falhou ou não chegou.
  const { data: fila, error } = await db.from('ti_agente_mensagens').select('id')
    .eq('direcao', 'entrada').in('midia_status', ['baixada', 'nao_baixou']).lt('created_at', antes(RETOMAR_DEPOIS_MS))
    .order('created_at').limit(POR_RODADA);
  if (error) throw new Error(error.message);
  for (const { id } of fila ?? []) {
    const x = await processarMidia(db, ia, id as string, agora);
    if (x.acao !== 'ja_tratada') r.retomadas += 1;
  }

  // 3. Travadas no meio do tratamento.
  const { data: travadas } = await db.from('ti_agente_mensagens').update({ midia_status: 'erro', erro: 'O tratamento da mídia parou no meio.' })
    .eq('direcao', 'entrada').eq('midia_status', 'processando').lt('created_at', antes(PROCESSANDO_DESISTE_MS)).select('id, midia_path');
  r.travadas = (travadas ?? []).length;

  // 4. Imagem que esperou o código do card por 2 h: expira. O caminho é lido antes de ser apagado.
  const { data: vencidas } = await db.from('ti_agente_mensagens').select('id, midia_path')
    .eq('direcao', 'entrada').eq('midia_status', 'aguardando_card').lt('created_at', antes(IMAGEM_AGUARDA_MS)).limit(50);
  const idsVencidas = (vencidas ?? []).map((x) => x.id as string);
  if (idsVencidas.length) {
    await db.from('ti_agente_mensagens').update({ midia_status: 'expirada', midia_path: null }).in('id', idsVencidas).eq('midia_status', 'aguardando_card');
  }
  r.expiradas = idsVencidas.length;

  // Os arquivos das travadas e das expiradas saem do bucket privado.
  const caminhos = [...(travadas ?? []), ...(vencidas ?? [])].map((t) => t.midia_path as string | null).filter((c): c is string => !!c);
  if (caminhos.length) await db.storage.from(BUCKET_MIDIAS).remove(caminhos).catch(() => undefined);
  return r;
}
