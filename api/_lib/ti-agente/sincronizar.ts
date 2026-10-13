// Sincronização com o Granola (issue 10): busca as notas novas da pasta, guarda cada uma
// como reunião e analisa as pendentes enquanto houver tempo na function (RNF03).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClienteGranola } from './granola.js';
import type { Dependencias } from './ia/gerarEstruturado.js';
import { analisarReuniao, type ResultadoAnalise } from './analisarReuniao.js';

/** Pior caso de uma análise com reserva: Claude 2×90 s + Gemini 90 s (plano RNF03). */
const ORCAMENTO_ANALISE_MS = 270_000;
/** maxDuration da function api/ti/[action].ts. */
const DURACAO_MAXIMA_MS = 300_000;

export interface ResultadoSync {
  ok: boolean;
  erro: string | null;
  novas: number;
  atualizadas: number;
  analisadas: ResultadoAnalise[];
  pendentesRestantes: number;
  dryRun: boolean;
  notasVistas?: { id: string; titulo: string | null; updated_at: string }[];
}

export async function sincronizarGranola(
  db: SupabaseClient,
  granola: ClienteGranola,
  ia: Dependencias,
  opcoes: { dryRun?: boolean; inicio?: number; agora?: () => number } = {},
): Promise<ResultadoSync> {
  const agora = opcoes.agora ?? Date.now;
  const inicio = opcoes.inicio ?? agora();
  const dryRun = !!opcoes.dryRun;
  const base: ResultadoSync = { ok: false, erro: null, novas: 0, atualizadas: 0, analisadas: [], pendentesRestantes: 0, dryRun };

  /** Situação para o chip do Início e para Configurações (D25). O dryRun não deixa rastro. */
  const falhou = async (erro: string, parcial: Partial<ResultadoSync> = {}): Promise<ResultadoSync> => {
    if (!dryRun) await db.from('ti_agente_config').update({ granola_ultimo_erro: erro.slice(0, 500) }).eq('id', true);
    return { ...base, ...parcial, erro };
  };

  const { data: config } = await db.from('ti_agente_config').select('granola_folder_id, granola_ultima_sync_em').eq('id', true).single();
  const pastaId = config?.granola_folder_id as string | null;
  if (!pastaId) return falhou('Pasta do Granola não configurada (Configurações da EVA).');

  const lista = await granola.listarNotas({ pastaId, atualizadasDepois: (config?.granola_ultima_sync_em as string | null) ?? null });
  if ('erro' in lista) return falhou(lista.erro);
  const notas = lista.dados.filter((n) => !n.deleted_at);

  if (dryRun) {
    return { ...base, ok: true, notasVistas: notas.map((n) => ({ id: n.id, titulo: n.title, updated_at: n.updated_at })) };
  }

  let novas = 0;
  let atualizadas = 0;
  let maiorAtualizacao = (config?.granola_ultima_sync_em as string | null) ?? null;

  for (const resumo of notas) {
    if (!maiorAtualizacao || resumo.updated_at > maiorAtualizacao) maiorAtualizacao = resumo.updated_at;
    const { data: existente } = await db.from('ti_agente_reunioes').select('id').eq('granola_note_id', resumo.id).maybeSingle();
    if (existente) {
      // D14: nota já guardada não é reanalisada sozinha; só acende o selo na tela.
      await db.from('ti_agente_reunioes').update({ fonte_atualizada_em: resumo.updated_at }).eq('id', existente.id);
      atualizadas += 1;
      continue;
    }
    const nota = await granola.buscarNota(resumo.id);
    if ('erro' in nota) return falhou(nota.erro, { novas, atualizadas });
    const texto = nota.dados.summary_markdown || nota.dados.summary_text;
    if (!texto?.trim()) continue; // nota ainda sem resumo: entra numa próxima sincronização
    const { error } = await db.from('ti_agente_reunioes').insert({
      origem: 'granola',
      granola_note_id: nota.dados.id,
      titulo: nota.dados.title?.trim() || 'Reunião sem título',
      realizada_em: nota.dados.calendar_event?.scheduled_start_time ?? nota.dados.created_at,
      resumo_markdown: texto,
      web_url: nota.dados.web_url,
      fonte_atualizada_em: nota.dados.updated_at,
      status: 'pendente',
    });
    if (error && !error.message.includes('duplicate')) return falhou(error.message, { novas, atualizadas });
    novas += 1;
  }

  // O cursor só avança quando a listagem e a gravação terminaram sem erro.
  await db
    .from('ti_agente_config')
    .update({ ...(maiorAtualizacao ? { granola_ultima_sync_em: maiorAtualizacao } : {}), granola_verificado_em: new Date(agora()).toISOString(), granola_ultimo_erro: null })
    .eq('id', true);

  // Analisa as pendentes enquanto ainda couber uma análise inteira no tempo da function.
  const analisadas: ResultadoAnalise[] = [];
  // "analisando" há mais de 10 min é uma análise que morreu no meio (function encerrada): volta para a fila.
  const travadaAntes = new Date(agora() - 10 * 60_000).toISOString();
  const { data: pendentes } = await db
    .from('ti_agente_reunioes')
    .select('id')
    .or(`status.eq.pendente,and(status.eq.analisando,created_at.lt.${travadaAntes})`)
    .order('created_at');
  const fila = (pendentes ?? []).map((p) => p.id as string);
  while (fila.length > 0 && DURACAO_MAXIMA_MS - (agora() - inicio) >= ORCAMENTO_ANALISE_MS) {
    analisadas.push(await analisarReuniao(db, ia, fila.shift()!));
  }

  return { ...base, ok: true, novas, atualizadas, analisadas, pendentesRestantes: fila.length };
}
