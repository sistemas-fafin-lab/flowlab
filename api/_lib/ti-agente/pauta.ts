// Pauta da reunião da equipe no servidor (D48, issue 35). As regras e o texto ficam em
// src/modules/eva/domain/pauta.ts.
// - lerPautaReuniao: a pauta na hora ("pauta da reunião", pelo WhatsApp e pelo chat).
// - rodarPauta: no relógio (D44). No dia e 1 h antes da hora marcados em Configurações, a pauta vai
//   para os gestores que recebem o relatório de gestão, uma vez por dia.
import type { SupabaseClient } from '@supabase/supabase-js';
import { hojeSP, somarDias, type Dia } from '../../../src/modules/eva/domain/datas.js';
import type { CardTI } from '../../../src/modules/eva/domain/demandas.js';
import { montarPainelGestao } from '../../../src/modules/eva/domain/gestao.js';
import {
  DIAS_BLOQUEIO, momentoDaPauta, montarPautaReuniao, type BloqueioRecente, type ItemReuniao,
} from '../../../src/modules/eva/domain/pauta.js';
import { CAMPOS_CARD } from './cobranca.js';
import { lerUltimaReuniao } from './dados.js';
import { lerDestinatariosDeGestao, lerEntradaGestao } from './gestao.js';
import { periodoDoRitmo, planejamentoDaEntrada } from './planejamento.js';

const MAX_TITULO = 45;
const curto = (t: string) => (t.length > MAX_TITULO ? `${t.slice(0, MAX_TITULO - 1).trimEnd()}…` : t);
const DIA = /^\d{4}-\d{2}-\d{2}/;

type SugestaoDaReuniao = {
  tipo: string;
  status: string;
  card_id: string | null;
  card_resultante_id: string | null;
  proposta: { titulo?: string; responsaveis?: unknown; prazo?: unknown } | null;
};

/** O que a reunião combinou (cards novos e mudanças), com o card de agora. */
export async function lerItensDaReuniao(db: SupabaseClient, reuniaoId: string): Promise<ItemReuniao[]> {
  const { data, error } = await db
    .from('ti_agente_sugestoes')
    .select('tipo, status, card_id, card_resultante_id, proposta')
    .eq('reuniao_id', reuniaoId)
    .in('tipo', ['criar_card', 'atualizar_card'])
    .neq('status', 'substituida')
    .order('created_at')
    .limit(100);
  if (error) throw new Error(error.message);
  const sugestoes = (data ?? []) as SugestaoDaReuniao[];
  const ids = Array.from(new Set(sugestoes.flatMap((s) => [s.card_resultante_id, s.card_id]).filter((x): x is string => !!x)));
  const porId = new Map<string, CardTI>();
  if (ids.length) {
    const { data: cards, error: eCards } = await db.from('it_requests').select(CAMPOS_CARD).in('id', ids);
    if (eCards) throw new Error(eCards.message);
    for (const c of (cards ?? []) as unknown as CardTI[]) porId.set(c.id, { ...c, assigned_to: c.assigned_to ?? [], kanban_hidden: !!c.kanban_hidden });
  }
  return sugestoes.map((s) => {
    const card = porId.get(s.card_resultante_id ?? '') ?? porId.get(s.card_id ?? '') ?? null;
    const prazo = typeof s.proposta?.prazo === 'string' && DIA.test(s.proposta.prazo) ? s.proposta.prazo.slice(0, 10) : null;
    const descricao = card
      ? `${card.codigo} ${curto(card.title)}`
      : s.tipo === 'criar_card' ? `Card novo "${curto(s.proposta?.titulo ?? 'sem título')}"` : 'Card removido';
    return {
      descricao,
      responsaveis: Array.isArray(s.proposta?.responsaveis) ? (s.proposta!.responsaveis as string[]) : [],
      prazo,
      sugestao: s.status === 'aprovada' ? 'aprovada' : s.status === 'rejeitada' ? 'rejeitada' : 'pendente',
      card,
    };
  });
}

/** Os bloqueios contados no check-in (D46) dos últimos dias. Sem a tabela (migration de D46), nenhum. */
export async function lerBloqueiosRecentes(db: SupabaseClient, hoje: Dia): Promise<BloqueioRecente[]> {
  const { data, error } = await db
    .from('ti_agente_checkins')
    .select('dia, bloqueios, membro:ti_agente_membros(user_id)')
    .gte('dia', somarDias(hoje, -DIAS_BLOQUEIO))
    .eq('status', 'respondido');
  if (error) return [];
  type Linha = { dia: string; bloqueios: { codigo?: string; motivo?: string }[] | null; membro: { user_id: string } | null };
  return ((data ?? []) as unknown as Linha[]).flatMap((l) => (l.bloqueios ?? [])
    .filter((b) => b.codigo)
    .map((b) => ({ codigo: b.codigo!, motivo: (b.motivo ?? '').trim() || 'bloqueado', quem: l.membro?.user_id ?? '', dia: l.dia })));
}

/** "Pauta da reunião": o painel, o planejamento, a última reunião e os bloqueios do check-in. */
export async function lerPautaReuniao(
  db: SupabaseClient,
  formato: 'whatsapp' | 'chat',
  opcoes: { agora?: Date; linkInicio: string; marcada?: { dia: Dia; hora: string } | null },
): Promise<string> {
  const agora = opcoes.agora ?? new Date();
  const hoje = hojeSP(agora);
  const [entrada, reuniao, bloqueios] = await Promise.all([
    lerEntradaGestao(db, agora, periodoDoRitmo(hoje)),
    lerUltimaReuniao(db),
    lerBloqueiosRecentes(db, hoje),
  ]);
  const itens = reuniao?.id ? await lerItensDaReuniao(db, reuniao.id) : [];
  return montarPautaReuniao({
    entrada,
    painel: montarPainelGestao(entrada),
    plano: planejamentoDaEntrada(entrada),
    reuniao: reuniao ? { titulo: reuniao.titulo, realizadaEm: reuniao.realizadaEm, itens } : null,
    bloqueios,
    marcada: opcoes.marcada ?? null,
    linkInicio: opcoes.linkInicio,
    formato,
  });
}

export interface ResultadoPauta { pulado: string | null; enviadas: number }

export async function rodarPauta(db: SupabaseClient, opcoes: { agora?: Date; linkInicio: string }): Promise<ResultadoPauta> {
  const agora = opcoes.agora ?? new Date();
  const { data: cfg, error } = await db
    .from('ti_agente_config')
    .select('whatsapp_ativo, pauta_ativa, reuniao_dia, reuniao_hora')
    .eq('id', true)
    .maybeSingle();
  // Sem as colunas (migration de D48 não aplicada), desligada.
  if (error || !cfg?.pauta_ativa) return { pulado: 'Pauta da reunião desligada em Configurações.', enviadas: 0 };
  if (!cfg.whatsapp_ativo) return { pulado: 'O WhatsApp da EVA está desligado.', enviadas: 0 };
  const hora = (cfg.reuniao_hora as string | null) ?? null;
  const m = momentoDaPauta(agora, { dia: (cfg.reuniao_dia as number | null) ?? null, hora });
  if (!m.enviar || !hora) return { pulado: 'Fora da hora da pauta.', enviadas: 0 };

  const destinos = await lerDestinatariosDeGestao(db, 'recebe_relatorio');
  if (destinos.length === 0) return { pulado: 'Nenhum gestor com o relatório de gestão marcado (EVA → Membros).', enviadas: 0 };
  // Já saiu a de hoje para todos (o relógio roda de 10 em 10 min): nem monta de novo.
  const { count } = await db.from('ti_agente_mensagens').select('id', { count: 'exact', head: true }).like('chave_dia', `pauta:%:${m.hoje}`);
  if ((count ?? 0) >= destinos.length) return { pulado: null, enviadas: 0 };

  const texto = await lerPautaReuniao(db, 'whatsapp', { agora, linkInicio: opcoes.linkInicio, marcada: { dia: m.hoje, hora } });
  let enviadas = 0;
  for (const d of destinos) {
    const { data, error: eMsg } = await db.from('ti_agente_mensagens').upsert(
      { membro_id: d.membroId, direcao: 'saida', tipo: 'pauta', status: 'pendente', texto, card_ids: [], chave_dia: `pauta:${d.membroId}:${m.hoje}` },
      { onConflict: 'chave_dia', ignoreDuplicates: true },
    ).select('id');
    if (eMsg) throw new Error(eMsg.message);
    if ((data ?? []).length) enviadas += 1;
  }
  return { pulado: null, enviadas };
}
