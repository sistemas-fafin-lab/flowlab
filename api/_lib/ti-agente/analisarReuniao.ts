// Análise de uma reunião (issue 08): contexto → IA (Claude, Gemini de reserva) →
// validação → sugestões pendentes → aviso aos gestores. Nada muda no Kanban aqui (D6).
import type { SupabaseClient } from '@supabase/supabase-js';
import { gerarEstruturado, type Dependencias } from './ia/gerarEstruturado.js';
import {
  INSTRUCOES_EXTRACAO, SchemaSugestoes, montarContexto, montarConteudo, validarSugestoes, type SugestaoValidada,
} from './extracao.js';
import { avisarGestores, lerContexto } from './dados.js';

export interface ResultadoAnalise {
  ok: boolean;
  reuniaoId: string;
  sugestoes: SugestaoValidada[];
  observacoes: string | null;
  provedor: 'claude' | 'gemini' | null;
  motivoReserva: string | null;
  erro: string | null;
}

interface LinhaReuniao {
  id: string;
  titulo: string;
  realizada_em: string | null;
  resumo_markdown: string;
}

/** Quantas análises seguidas pelo Gemini disparam o aviso de que o Claude não está respondendo. */
const SEGUIDAS_PARA_AVISO = 3;

export async function analisarReuniao(
  db: SupabaseClient,
  ia: Dependencias,
  reuniaoId: string,
  opcoes: { dryRun?: boolean } = {},
): Promise<ResultadoAnalise> {
  const vazio = { reuniaoId, sugestoes: [], observacoes: null, provedor: null, motivoReserva: null };
  const { data: reuniao, error } = await db
    .from('ti_agente_reunioes')
    .select('id, titulo, realizada_em, resumo_markdown')
    .eq('id', reuniaoId)
    .single<LinhaReuniao>();
  if (error || !reuniao) return { ...vazio, ok: false, erro: 'Reunião não encontrada.' };

  if (!opcoes.dryRun) await db.from('ti_agente_reunioes').update({ status: 'analisando', erro: null }).eq('id', reuniaoId);

  try {
    const ctx = await lerContexto(db);
    const r = await gerarEstruturado(
      {
        finalidade: 'analise_reuniao',
        instrucoes: INSTRUCOES_EXTRACAO,
        contexto: montarContexto(ctx),
        conteudo: montarConteudo({ titulo: reuniao.titulo, realizadaEm: reuniao.realizada_em, resumo: reuniao.resumo_markdown }),
        schema: SchemaSugestoes,
        esforco: 'medium',
        reuniaoId: opcoes.dryRun ? undefined : reuniaoId,
      },
      ia,
    );

    if ('erros' in r) {
      const erro = r.erros.join(' · ');
      if (!opcoes.dryRun) await db.from('ti_agente_reunioes').update({ status: 'erro', erro }).eq('id', reuniaoId);
      return { ...vazio, ok: false, erro };
    }

    const sugestoes = validarSugestoes(r.dados, ctx);
    const resultado: ResultadoAnalise = {
      ok: true, reuniaoId, sugestoes, observacoes: r.dados.observacoes, provedor: r.provedor, motivoReserva: r.motivoReserva, erro: null,
    };
    if (opcoes.dryRun) return resultado;

    // RN11: reanalisar troca só as sugestões ainda pendentes desta reunião.
    await db.from('ti_agente_sugestoes').update({ status: 'substituida' }).eq('reuniao_id', reuniaoId).eq('status', 'pendente');
    if (sugestoes.length > 0) {
      const { error: eIns } = await db.from('ti_agente_sugestoes').insert(
        sugestoes.map((s) => ({
          reuniao_id: reuniaoId, origem: 'reuniao', tipo: s.tipo, card_id: s.card_id, proposta: s.proposta,
          trecho: s.trecho, confianca: s.confianca, avisos: s.avisos,
        })),
      );
      if (eIns) throw new Error(eIns.message);
    }
    await db.from('ti_agente_reunioes').update({
      status: 'analisada', analisada_em: new Date().toISOString(), provedor: r.provedor, motivo_reserva: r.motivoReserva,
      observacoes: r.dados.observacoes, erro: null,
    }).eq('id', reuniaoId);

    if (sugestoes.length > 0) {
      await avisarGestores(db, {
        titulo: 'Sugestões novas da EVA',
        conteudo: `${sugestoes.length} ${sugestoes.length === 1 ? 'sugestão' : 'sugestões'} da reunião "${reuniao.titulo}" aguardando aprovação.`,
        link: '/it/eva',
      });
    }
    if (r.provedor === 'gemini') await avisarSeReservaSeguida(db, r.motivoReserva);
    return resultado;
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    if (!opcoes.dryRun) await db.from('ti_agente_reunioes').update({ status: 'erro', erro }).eq('id', reuniaoId);
    return { ...vazio, ok: false, erro };
  }
}

/** Avisa os gestores quando o Gemini acabou de assumir a 3ª análise seguida (uma vez só). */
async function avisarSeReservaSeguida(db: SupabaseClient, motivo: string | null) {
  const { data } = await db
    .from('ti_agente_reunioes')
    .select('provedor')
    .eq('status', 'analisada')
    .order('analisada_em', { ascending: false })
    .limit(SEGUIDAS_PARA_AVISO + 1);
  const provedores = (data ?? []).map((l) => l.provedor as string | null);
  const seguidas = provedores.slice(0, SEGUIDAS_PARA_AVISO).every((p) => p === 'gemini') && provedores.length >= SEGUIDAS_PARA_AVISO;
  const primeiraVez = provedores.length === SEGUIDAS_PARA_AVISO || provedores[SEGUIDAS_PARA_AVISO] !== 'gemini';
  if (seguidas && primeiraVez) {
    await avisarGestores(db, {
      titulo: 'O Claude não está respondendo',
      conteudo: `O Gemini assumiu as últimas ${SEGUIDAS_PARA_AVISO} análises de reunião. Último erro: ${motivo ?? 'desconhecido'}`,
      link: '/it/eva/configuracoes',
      tipo: 'warning',
    });
  }
}
