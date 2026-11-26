// Saúde das integrações no servidor (D39, issue 28): confere o que está quebrado (domain/saude.ts)
// e avisa quem configura a EVA (canConfigureAgenteTI) — no sino sempre, e no WhatsApp quando o
// problema não é o próprio WhatsApp. Um aviso quando o problema aparece, de novo a cada 24 h
// enquanto ele continuar, e outro quando ele se resolve (ti_agente_saude).
// Roda nos crons do dia (8h, 9h e 18h): é a Vercel que vê a VPS parar.
import type { SupabaseClient } from '@supabase/supabase-js';
import { CHAVE_CONFIGURAR } from '../../../src/modules/eva/domain/papeis.js';
import { IA_JANELA_MS, TEXTO_RESOLVIDO, diagnosticarSaude, type ChaveSaude, type ProblemaSaude } from '../../../src/modules/eva/domain/saude.js';
import { avisarQuemTem, lerQuemTem } from './dados.js';

/** Enquanto o problema continuar, o aviso se repete uma vez por dia. */
export const REPETIR_AVISO_MS = 24 * 60 * 60 * 1000;

export interface ResultadoSaude {
  /** As chaves dos problemas de agora. */
  problemas: ChaveSaude[];
  /** Os que geraram aviso nesta execução (novos ou repetidos depois de 24 h). */
  avisados: ChaveSaude[];
  resolvidos: ChaveSaude[];
}

type Aberto = { chave: ChaveSaude; avisado_em: string | null };

export async function verificarSaude(db: SupabaseClient, opcoes: { agora?: Date } = {}): Promise<ResultadoSaude> {
  const agora = opcoes.agora ?? new Date();
  const [cfg, ia, abertos] = await Promise.all([
    db.from('ti_agente_config')
      .select('whatsapp_ativo, granola_folder_id, granola_verificado_em, granola_ultimo_erro, waha_status, waha_verificado_em')
      .eq('id', true)
      .maybeSingle(),
    db.from('ti_agente_chamadas_ia')
      .select('provedor, resultado, erro, created_at')
      .gte('created_at', new Date(agora.getTime() - IA_JANELA_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(200),
    db.from('ti_agente_saude').select('chave, avisado_em').eq('ativo', true),
  ]);
  for (const r of [cfg, ia, abertos]) if (r.error) throw new Error(r.error.message);
  const c = (cfg.data ?? {}) as Record<string, unknown>;
  const chamadas = (ia.data ?? []) as { provedor: string; resultado: string; erro: string | null }[];

  const problemas = diagnosticarSaude({
    agora: agora.getTime(),
    config: {
      whatsapp_ativo: c.whatsapp_ativo === true,
      granola_folder_id: (c.granola_folder_id as string | null) ?? null,
      granola_verificado_em: (c.granola_verificado_em as string | null) ?? null,
      granola_ultimo_erro: (c.granola_ultimo_erro as string | null) ?? null,
      waha_status: (c.waha_status as string | null) ?? null,
      waha_verificado_em: (c.waha_verificado_em as string | null) ?? null,
    },
    // O Gemini só entra depois que o Claude falhou: a tentativa dele que falha é a falha de vez.
    ia: {
      ok: chamadas.filter((x) => x.resultado === 'ok').length,
      falhas: chamadas.filter((x) => x.provedor === 'gemini' && x.resultado !== 'ok').length,
      ultimoErro: chamadas.find((x) => x.resultado !== 'ok')?.erro ?? null,
    },
  });

  const jaAbertos = new Map(((abertos.data ?? []) as Aberto[]).map((a) => [a.chave, a]));
  const agoraIso = agora.toISOString();
  const resultado: ResultadoSaude = { problemas: problemas.map((p) => p.chave), avisados: [], resolvidos: [] };
  const avisos: { p: ProblemaSaude; titulo: string; texto: string }[] = [];

  for (const p of problemas) {
    const aberto = jaAbertos.get(p.chave);
    const repetir = aberto && (!aberto.avisado_em || agora.getTime() - Date.parse(aberto.avisado_em) >= REPETIR_AVISO_MS);
    if (!aberto) {
      const { error } = await db.from('ti_agente_saude')
        .upsert({ chave: p.chave, ativo: true, texto: p.texto, desde: agoraIso, avisado_em: agoraIso, resolvido_em: null }, { onConflict: 'chave' });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from('ti_agente_saude').update({ texto: p.texto, ...(repetir ? { avisado_em: agoraIso } : {}) }).eq('chave', p.chave);
      if (error) throw new Error(error.message);
    }
    if (!aberto || repetir) {
      resultado.avisados.push(p.chave);
      avisos.push({ p, titulo: `EVA: ${p.titulo}${aberto ? ' (continua)' : ''}`, texto: p.texto });
    }
  }

  for (const [chave] of jaAbertos) {
    if (problemas.some((p) => p.chave === chave)) continue;
    const { error } = await db.from('ti_agente_saude').update({ ativo: false, resolvido_em: agoraIso }).eq('chave', chave);
    if (error) throw new Error(error.message);
    resultado.resolvidos.push(chave);
  }

  if (avisos.length || resultado.resolvidos.length) {
    await notificar(db, c.whatsapp_ativo === true, avisos, resultado.resolvidos, agora);
  }
  return resultado;
}

/**
 * Para os crons: confere a saúde depois do trabalho principal, sem nunca derrubá-lo. O dryRun não
 * confere (ele não grava nem avisa). Devolve o resultado, o erro ou null (dryRun).
 */
export async function verificarSaudeSemFalhar(db: SupabaseClient, dryRun: boolean, origem: string): Promise<ResultadoSaude | { erro: string } | null> {
  if (dryRun) return null;
  try {
    return await verificarSaude(db);
  } catch (e) {
    console.error(`[${origem}] saúde das integrações`, e);
    return { erro: e instanceof Error ? e.message : 'Erro interno' };
  }
}

/** Sino para quem configura; WhatsApp para quem configura e tem WhatsApp na aba Membros. */
async function notificar(
  db: SupabaseClient, whatsappAtivo: boolean, avisos: { p: ProblemaSaude; titulo: string; texto: string }[], resolvidos: ChaveSaude[], agora: Date,
): Promise<void> {
  for (const a of avisos) await avisarQuemTem(db, CHAVE_CONFIGURAR, { titulo: a.titulo, conteudo: a.texto, link: '/it/eva/configuracoes', tipo: 'warning' });
  for (const r of resolvidos) await avisarQuemTem(db, CHAVE_CONFIGURAR, { titulo: 'EVA: resolvido', conteudo: TEXTO_RESOLVIDO[r], link: '/it/eva/configuracoes', tipo: 'success' });
  if (!whatsappAtivo) return;

  const mensagens = [
    ...avisos.filter((a) => a.p.whatsapp).map((a) => ({ chave: a.p.chave, texto: `⚠️ ${a.titulo.replace(/^EVA: /, '')}\n${a.texto}` })),
    ...resolvidos.map((r) => ({ chave: `${r}-ok`, texto: `✅ ${TEXTO_RESOLVIDO[r]}` })),
  ];
  if (mensagens.length === 0) return;
  const [configuram, { data: membros, error }] = await Promise.all([
    lerQuemTem(db, CHAVE_CONFIGURAR),
    db.from('ti_agente_membros').select('id, user_id').eq('ativo', true).not('whatsapp', 'is', null),
  ]);
  if (error) throw new Error(error.message);
  const quem = new Set(configuram);
  const hora = agora.toISOString().slice(0, 13);
  for (const m of (membros ?? []).filter((x) => quem.has(x.user_id as string))) {
    for (const msg of mensagens) {
      const { error: e } = await db.from('ti_agente_mensagens').upsert(
        { membro_id: m.id, direcao: 'saida', tipo: 'alerta', status: 'pendente', texto: msg.texto, card_ids: [], chave_dia: `saude:${m.id}:${msg.chave}:${hora}` },
        { onConflict: 'chave_dia', ignoreDuplicates: true },
      );
      if (e) throw new Error(e.message);
    }
  }
}
