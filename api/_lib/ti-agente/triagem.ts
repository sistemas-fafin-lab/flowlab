// Triagem de todo chamado (D45, issue 33). Antes, só os chamados do LAB-BRAIN viravam sugestão
// de entrada no Kanban (promover_card). Agora o relógio (D44, a cada 10 min) também analisa os
// abertos pela tela de Solicitações de TI: a mesma análise (coluna, prioridade, responsáveis,
// prazo), mais o possível repetido e a solução anterior, na fila de Sugestões, com aviso no sino.
//
// Quem entra: chamado de usuário (is_internal = false), fora do Kanban, pendente ou em andamento,
// aberto depois de ti_agente_config.triagem_desde (a migration grava a hora em que foi aplicada:
// o que já estava na fila não vira uma enxurrada de sugestões) e ainda sem sugestão promover_card.
import type { SupabaseClient } from '@supabase/supabase-js';
import { ORIGEM_SUGESTAO_TRIAGEM, TIPO_PROMOVER_CARD, criarSugestaoDePromocao } from '../labBrainSugestao.js';
import type { Dependencias } from './ia/gerarEstruturado.js';

/** Por volta do relógio: cada análise chama a IA. O resto fica para a volta seguinte. */
export const TRIAGEM_POR_VOLTA = 5;
/** Os do LAB-BRAIN já ganham a sugestão na criação (labBrainChamados.ts). */
const ORIGEM_LAB_BRAIN = 'lab-brain';

export interface ResultadoTriagem { analisados: number; sugeridos: number; pulado: string | null }

export async function triarChamadosNovos(db: SupabaseClient, ia: Dependencias): Promise<ResultadoTriagem> {
  const { data: cfg, error: eCfg } = await db.from('ti_agente_config').select('triagem_desde').eq('id', true).maybeSingle();
  // Sem a coluna (migration de D45 não aplicada) ou sem data: a triagem fica desligada.
  if (eCfg || !cfg?.triagem_desde) return { analisados: 0, sugeridos: 0, pulado: 'Triagem desligada (ti_agente_config.triagem_desde vazio).' };

  const { data: candidatos, error } = await db
    .from('it_requests')
    .select('id, codigo, title, description, priority, request_type, origem')
    .eq('is_internal', false)
    .eq('kanban_hidden', true)
    .in('status', ['pending', 'in_progress'])
    .gte('created_at', cfg.triagem_desde as string)
    .order('created_at')
    .limit(50);
  if (error) throw new Error(error.message);
  const daTela = (candidatos ?? []).filter((c) => c.origem !== ORIGEM_LAB_BRAIN);
  if (daTela.length === 0) return { analisados: 0, sugeridos: 0, pulado: null };

  // Já tem sugestão (pendente, aprovada, rejeitada ou substituída): não sugere de novo.
  const { data: jaTem, error: eSug } = await db
    .from('ti_agente_sugestoes')
    .select('card_id')
    .eq('tipo', TIPO_PROMOVER_CARD)
    .in('card_id', daTela.map((c) => c.id as string));
  if (eSug) throw new Error(eSug.message);
  const com = new Set((jaTem ?? []).map((s) => s.card_id as string));
  const fila = daTela.filter((c) => !com.has(c.id as string)).slice(0, TRIAGEM_POR_VOLTA);

  let sugeridos = 0;
  for (const c of fila) {
    const ok = await criarSugestaoDePromocao(
      db,
      ia,
      {
        id: c.id as string, codigo: c.codigo as string, titulo: (c.title as string) ?? '', descricao: (c.description as string) ?? '',
        prioridade: (c.priority as string) ?? 'medium', tipo: (c.request_type as string) ?? 'suporte', origem: 'tela',
      },
      { origem: ORIGEM_SUGESTAO_TRIAGEM },
    );
    if (ok) sugeridos += 1;
  }
  return { analisados: fila.length, sugeridos, pulado: null };
}
