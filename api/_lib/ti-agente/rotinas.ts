// Rotinas que viram card sozinhas, no servidor (D50, issue 36). As regras ficam em
// src/modules/eva/domain/rotinas.ts; o cadastro, na aba Rotinas da EVA (RLS: gestor e quem configura).
// No relógio (D44): a rotina ativa cujo dia de criar chegou ganha o card no Kanban, com o prazo, os
// responsáveis e a prioridade dela, e anda para a próxima data.
// A data anda antes do card: o relógio roda de 10 em 10 min, e só quem trocou a data cria o card.
// Se o card falhar, o erro fica na rotina (a tela mostra) e a data não volta, para não tentar de
// novo a cada volta.
import type { SupabaseClient } from '@supabase/supabase-js';
import { hojeSP } from '../../../src/modules/eva/domain/datas.js';
import { descricaoDoCard, planoDaRotina, type Rotina } from '../../../src/modules/eva/domain/rotinas.js';

const CAMPOS = 'id, titulo, descricao, frequencia, dia_ancora, proxima_em, antecedencia_dias, responsaveis, prioridade, projeto_id, ativa, created_by';

export interface ResultadoRotinas { pulado: string | null; criados: string[]; erros: string[] }

type RotinaLida = Rotina & { created_by: string };

export async function criarCardsDeRotina(db: SupabaseClient, opcoes: { agora?: Date } = {}): Promise<ResultadoRotinas> {
  const agora = opcoes.agora ?? new Date();
  const hoje = hojeSP(agora);
  const r: ResultadoRotinas = { pulado: null, criados: [], erros: [] };
  const { data, error } = await db.from('ti_agente_rotinas').select(CAMPOS).eq('ativa', true).limit(500);
  // Sem a tabela (migration de D50 não aplicada), nada a fazer.
  if (error) return { ...r, pulado: 'Sem a tabela de rotinas.' };

  for (const rotina of (data ?? []) as RotinaLida[]) {
    const plano = planoDaRotina({ ...rotina, responsaveis: rotina.responsaveis ?? [] }, hoje);
    if (!plano.criarPara && plano.proxima === rotina.proxima_em) continue;
    // A trava: só segue quem trocou a data que leu.
    const { data: pego, error: ePego } = await db.from('ti_agente_rotinas')
      .update({ proxima_em: plano.proxima, updated_at: agora.toISOString() })
      .eq('id', rotina.id)
      .eq('proxima_em', rotina.proxima_em)
      .select('id');
    if (ePego) throw new Error(ePego.message);
    if (!pego || pego.length === 0 || !plano.criarPara) continue;

    const { data: card, error: eCard } = await db.from('it_requests').insert({
      title: rotina.titulo,
      description: descricaoDoCard({ ...rotina, proxima_em: plano.criarPara }),
      request_type: 'suporte',
      priority: rotina.prioridade,
      status: 'pending',
      kanban_status: 'todo',
      requested_by: rotina.created_by,
      assigned_to: rotina.responsaveis ?? [],
      // A convenção do Board: o dia do prazo à meia-noite UTC (ti_agente_prazo_para_due_date).
      due_date: `${plano.criarPara}T00:00:00.000Z`,
      project_id: rotina.projeto_id,
      is_internal: true,
      tags: ['agente-ti', 'rotina'],
    }).select('id, codigo').single();
    if (eCard || !card) {
      const erro = `Não consegui criar o card de ${plano.criarPara}: ${eCard?.message ?? 'sem retorno'}`;
      r.erros.push(`${rotina.titulo}: ${erro}`);
      await db.from('ti_agente_rotinas').update({ ultimo_erro: erro.slice(0, 500) }).eq('id', rotina.id);
      continue;
    }
    await db.from('ti_agente_rotinas')
      .update({ ultimo_card_id: card.id, ultima_criacao_em: agora.toISOString(), ultimo_erro: null })
      .eq('id', rotina.id);
    r.criados.push(card.codigo as string);
  }
  return r;
}
