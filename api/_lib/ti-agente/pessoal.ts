// A EVA como agente pessoal no WhatsApp (issue 19, plano D30): a conversa recente, o dia da
// pessoa e os lembretes. O roteador (comandos.ts) junta isso ao contexto da IA e executa os
// lembretes; aqui ficam a leitura e as regras.
//
// Lembrete = mensagem `lembrete` na fila de sempre, com proxima_tentativa_em = a hora pedida:
// a VPS só envia o que venceu, então não há cron nem tabela nova. Lembretes seguem o horário
// da EVA (dia útil, das 7h às 20h); um pedido fora dele vai para a próxima janela, e a EVA avisa.
import type { SupabaseClient } from '@supabase/supabase-js';
import { diaDaSemana, diaDoPrazo, diaSP, diferencaDias, formatarDiaMes, pluralDias, proximoDiaUtil, type Dia } from '../../../src/modules/eva/domain/datas.js';
import type { CardTI } from '../../../src/modules/eva/domain/demandas.js';
import { pendenciasDoMembro, proximaJanelaDeCobranca, type PendenciasMembro } from '../../../src/modules/eva/domain/cobranca.js';
import { primeiroNome } from '../../../src/modules/eva/domain/pessoas.js';
import { quandoSera } from '../../../src/modules/eva/domain/whatsapp.js';
import { lerConfigCobranca, ultimosComentarios } from './cobranca.js';
import type { Remetente } from './respostas.js';

const NOME_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const PRIORIDADE: Record<string, string> = { low: 'baixa', medium: 'média', high: 'alta', critical: 'crítica' };
const STATUS_SUGESTAO: Record<string, string> = { pendente: 'aguardando aprovação', aprovada: 'aprovada', rejeitada: 'rejeitada', substituida: 'substituída' };

const curto = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);
const hora = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

// ── Conversa recente ─────────────────────────────────────────────────────────

/** Falas da conversa que entram no contexto, e por quanto tempo para trás. */
export const MAX_FALAS = 12;
export const CONVERSA_ATE_MS = 24 * 60 * 60 * 1000;
const MAX_FALA = 500;

export interface Fala { de: 'pessoa' | 'eva'; em: string; texto: string }

const SAIU = ['enviada', 'entregue', 'lida'];

/**
 * As últimas falas com a pessoa (24 h), em ordem, mais a última cobrança se ela for mais antiga.
 * Cobrança e lembrete agendados ainda não chegaram: não contam. A resposta da EVA conta mesmo na
 * fila (sai em segundos).
 */
export async function lerConversa(db: SupabaseClient, membroId: string, antesDe: string, agora: Date): Promise<{ falas: Fala[]; cobranca: string | null }> {
  const desde = new Date(agora.getTime() - CONVERSA_ATE_MS).toISOString();
  const [recentes, ultimaCobranca] = await Promise.all([
    db.from('ti_agente_mensagens')
      .select('direcao, tipo, status, texto, created_at')
      .eq('membro_id', membroId)
      .in('tipo', ['recebida', 'confirmacao', 'cobranca', 'cobranca_manual', 'lembrete'])
      .in('status', ['recebida', 'pendente', ...SAIU])
      .lt('created_at', antesDe)
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(MAX_FALAS * 2),
    db.from('ti_agente_mensagens')
      .select('texto, created_at')
      .eq('membro_id', membroId)
      .in('tipo', ['cobranca', 'cobranca_manual'])
      .in('status', SAIU)
      .lt('created_at', antesDe)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (recentes.error) throw new Error(recentes.error.message);
  type Linha = { direcao: string; tipo: string; status: string; texto: string; created_at: string };
  const falas = ((recentes.data ?? []) as Linha[])
    .filter((l) => l.direcao === 'entrada' ? l.status === 'recebida' : l.tipo === 'confirmacao' || SAIU.includes(l.status))
    .slice(0, MAX_FALAS)
    .reverse()
    .map((l) => ({ de: l.direcao === 'entrada' ? 'pessoa' as const : 'eva' as const, em: l.created_at, texto: l.texto }));
  const c = ultimaCobranca.data as { texto: string; created_at: string } | null;
  const cobrancaNaConversa = !!c && falas.some((f) => f.de === 'eva' && f.em === c.created_at);
  return { falas, cobranca: c && !cobrancaNaConversa ? c.texto : null };
}

/** O conteúdo da chamada: a conversa e a mensagem, delimitadas (são dados, nunca instrução). */
export function montarConteudoConversa(texto: string, falas: Fala[], cobranca: string | null, maxTexto: number): string {
  const conversa = falas.length
    ? `<conversa_recente>\n${falas.map((f) => `${f.de === 'pessoa' ? 'Pessoa' : 'EVA'} (${hora(f.em)}): ${curto(f.texto.replace(/\s+/g, ' ').trim(), MAX_FALA)}`).join('\n')}\n</conversa_recente>\n\n`
    : '';
  const ultima = cobranca ? `<ultima_cobranca_da_eva>\n${cobranca.slice(0, maxTexto)}\n</ultima_cobranca_da_eva>\n\n` : '';
  return `${conversa}${ultima}<mensagem>\n${texto.slice(0, maxTexto)}\n</mensagem>`;
}

// ── O dia da pessoa ──────────────────────────────────────────────────────────

export interface Lembrete { id: string; texto: string; quando: string }
export interface ItemDaReuniao { descricao: string; status: string }

export interface DiaDaPessoa {
  pendencias: PendenciasMembro;
  diasParado: number;
  ultimoComentario: Record<string, string>;
  /** O que a última reunião analisada combinou para a pessoa (sugestões em que ela é responsável). */
  reuniao: { titulo: string; realizadaEm: string | null; itens: ItemDaReuniao[] } | null;
  lembretes: Lembrete[];
}

export const MAX_LEMBRETES = 20;

export async function lerLembretes(db: SupabaseClient, membroId: string): Promise<Lembrete[]> {
  const { data, error } = await db
    .from('ti_agente_mensagens')
    .select('id, texto, proxima_tentativa_em')
    .eq('membro_id', membroId)
    .eq('tipo', 'lembrete')
    .eq('status', 'pendente')
    .order('proxima_tentativa_em')
    .limit(MAX_LEMBRETES);
  if (error) throw new Error(error.message);
  return (data ?? []).map((l) => ({ id: l.id as string, texto: String(l.texto).replace(/^⏰ Lembrete: /, ''), quando: l.proxima_tentativa_em as string }));
}

type SugestaoReuniao = { tipo: string; status: string; proposta: { titulo?: string; responsaveis?: unknown } | null; card: { codigo: string; title: string; assigned_to: string[] | null } | null };

async function lerDaReuniao(db: SupabaseClient, reuniaoId: string, userId: string): Promise<ItemDaReuniao[]> {
  const { data, error } = await db
    .from('ti_agente_sugestoes')
    .select('tipo, status, proposta, card:it_requests!ti_agente_sugestoes_card_id_fkey(codigo, title, assigned_to)')
    .eq('reuniao_id', reuniaoId)
    .neq('status', 'substituida')
    .limit(100);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as SugestaoReuniao[])
    .filter((s) => {
      const resp = Array.isArray(s.proposta?.responsaveis) ? (s.proposta!.responsaveis as string[]) : [];
      return resp.includes(userId) || (s.card?.assigned_to ?? []).includes(userId);
    })
    .slice(0, 10)
    .map((s) => ({
      descricao: s.tipo === 'criar_card' ? `card novo "${curto(s.proposta?.titulo ?? 'sem título', 60)}"` : s.card ? `${s.card.codigo} ${curto(s.card.title, 50)}` : 'card removido',
      status: STATUS_SUGESTAO[s.status] ?? s.status,
    }));
}

export async function lerDiaDaPessoa(
  db: SupabaseClient,
  e: { userId: string; membroId: string; cards: CardTI[]; hoje: Dia; reuniao: { id?: string; titulo: string; realizadaEm: string | null } | null },
): Promise<DiaDaPessoa> {
  const meus = e.cards.filter((c) => (c.assigned_to ?? []).includes(e.userId));
  const [cfg, ultimoComentario, lembretes, itens] = await Promise.all([
    lerConfigCobranca(db),
    ultimosComentarios(db, meus),
    lerLembretes(db, e.membroId),
    e.reuniao?.id ? lerDaReuniao(db, e.reuniao.id, e.userId) : Promise.resolve([]),
  ]);
  return {
    pendencias: pendenciasDoMembro(meus, e.userId, e.hoje, cfg.dias_parado, ultimoComentario),
    diasParado: cfg.dias_parado,
    ultimoComentario,
    reuniao: e.reuniao ? { titulo: e.reuniao.titulo, realizadaEm: e.reuniao.realizadaEm, itens } : null,
    lembretes,
  };
}

/** A seção "O DIA DE …" do contexto, com os lembretes marcados (o id é para cancelar). */
export function montarBlocoDia(nome: string, hoje: Dia, d: DiaDaPessoa): string {
  const n = (primeiroNome(nome) || 'a pessoa').toUpperCase();
  const prioridade = (c: CardTI) => PRIORIDADE[c.priority] ?? c.priority;
  const limite = proximoDiaUtil(hoje);
  const rotuloVencendo = diferencaDias(hoje, limite) === 1 ? 'Vencem hoje ou amanhã' : `Vencem até ${NOME_DIA[diaDaSemana(limite)]} (${formatarDiaMes(limite)})`;
  const ultimaMudanca = (c: CardTI) => [c.updated_at, d.ultimoComentario[c.id]].filter(Boolean).map((t) => diaSP(t as string)).sort().pop()!;
  const secoes = [
    ['Atrasadas', d.pendencias.atrasadas.map((c) => `- ${c.codigo} | ${c.title} | venceu ${formatarDiaMes(diaDoPrazo(c.due_date!))} | prioridade ${prioridade(c)}`)],
    [rotuloVencendo, d.pendencias.vencendo.map((c) => `- ${c.codigo} | ${c.title} | vence ${formatarDiaMes(diaDoPrazo(c.due_date!))} | prioridade ${prioridade(c)}`)],
    [`Paradas há ${pluralDias(d.diasParado)} ou mais`, d.pendencias.paradas.map((c) => `- ${c.codigo} | ${c.title} | sem mudança desde ${formatarDiaMes(ultimaMudanca(c))}`)],
  ] as const;
  const pendencias = secoes.filter(([, l]) => l.length).map(([t, l]) => `${t}:\n${l.join('\n')}`).join('\n');
  const reuniao = d.reuniao
    ? `\nDa última reunião ("${d.reuniao.titulo}"${d.reuniao.realizadaEm ? `, ${formatarDiaMes(diaSP(d.reuniao.realizadaEm))}` : ''}), para a pessoa:\n${
      d.reuniao.itens.map((i) => `- ${i.descricao} | ${i.status}`).join('\n') || '(nada específico para a pessoa)'}`
    : '';
  const lembretes = d.lembretes.map((l) => `- id=${l.id} | ${hora(l.quando)} | ${l.texto}`).join('\n') || '(nenhum)';
  return `O DIA DE ${n} (hoje, ${formatarDiaMes(hoje)})\n${pendencias || 'Nada atrasado, vencendo ou parado.'}${reuniao}\n\nLEMBRETES MARCADOS\n${lembretes}`;
}

// ── Lembretes ────────────────────────────────────────────────────────────────

export const LEMBRETE_ATE_DIAS = 60;
const MAX_TEXTO_LEMBRETE = 300;

/** "2026-10-15T09:00" no horário de Brasília (UTC−3) → instante; null se não for desse formato. */
export function lerQuando(v: string | null | undefined): Date | null {
  const m = (v ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type PlanoLembrete = { ok: true; envio: Date; ajustado: boolean } | { ok: false; motivo: string };

/** Hora futura, até 60 dias; fora do horário da EVA, a próxima janela (e a EVA avisa). */
export function planejarLembrete(quando: Date | null, agora: Date): PlanoLembrete {
  if (!quando) return { ok: false, motivo: 'Para quando? (ex.: "me lembra amanhã às 9h de ligar para o fornecedor")' };
  if (quando.getTime() <= agora.getTime() + 60_000) return { ok: false, motivo: 'Esse horário já passou. Para quando eu marco?' };
  if (quando.getTime() > agora.getTime() + LEMBRETE_ATE_DIAS * 86_400_000) return { ok: false, motivo: `Consigo lembrar até ${LEMBRETE_ATE_DIAS} dias à frente.` };
  const janela = proximaJanelaDeCobranca(quando.getTime());
  return { ok: true, envio: janela === null ? quando : new Date(janela), ajustado: janela !== null };
}

export const textoDoLembrete = (t: string) => `⏰ Lembrete: ${t}`;

export async function criarLembrete(
  db: SupabaseClient, membro: Remetente, texto: string, quando: Date | null, agora: Date, hoje: Dia,
): Promise<string> {
  const oQue = texto.trim().replace(/\.$/, '').slice(0, MAX_TEXTO_LEMBRETE);
  if (!oQue) return 'Do que eu te lembro? (ex.: "me lembra amanhã às 9h de ligar para o fornecedor")';
  const plano = planejarLembrete(quando, agora);
  if ('motivo' in plano) return plano.motivo;
  const { count, error: eCount } = await db.from('ti_agente_mensagens').select('id', { count: 'exact', head: true })
    .eq('membro_id', membro.id).eq('tipo', 'lembrete').eq('status', 'pendente');
  if (eCount) throw new Error(eCount.message);
  if ((count ?? 0) >= MAX_LEMBRETES) return `Você já tem ${MAX_LEMBRETES} lembretes marcados. Cancela algum antes? (ex.: "cancela o lembrete do fornecedor")`;
  const { error } = await db.from('ti_agente_mensagens').insert({
    membro_id: membro.id, direcao: 'saida', tipo: 'lembrete', status: 'pendente', texto: textoDoLembrete(oQue), card_ids: [],
    enviada_por: membro.user_id, proxima_tentativa_em: plano.envio.toISOString(),
  });
  if (error) throw new Error(error.message);
  const quandoTexto = quandoSera(plano.envio.toISOString(), hoje);
  const n = primeiroNome(membro.nome);
  return plano.ajustado
    ? `Combinado${n ? `, ${n}` : ''}! Esse horário fica fora do meu expediente (dia útil, das 7h às 20h), então te lembro ${quandoTexto}: ${oQue}.`
    : `Combinado${n ? `, ${n}` : ''}! Te lembro ${quandoTexto}: ${oQue}.`;
}

export async function cancelarLembrete(db: SupabaseClient, membro: Remetente, id: string | null, hoje: Dia): Promise<string> {
  const lembretes = await lerLembretes(db, membro.id);
  const alvo = id ? lembretes.find((l) => l.id === id) : undefined;
  if (!alvo) {
    if (lembretes.length === 0) return 'Você não tem lembretes marcados.';
    return ['Não achei qual. Seus lembretes:', ...lembretes.map((l) => `• ${quandoSera(l.quando, hoje)}: ${l.texto}`)].join('\n');
  }
  // Só o próprio dono, e só se ainda não saiu.
  const { data, error } = await db.from('ti_agente_mensagens').update({ status: 'cancelada' })
    .eq('id', alvo.id).eq('membro_id', membro.id).eq('tipo', 'lembrete').eq('status', 'pendente').select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return 'Esse lembrete já saiu.';
  return `Pronto, cancelei o lembrete de ${quandoSera(alvo.quando, hoje)}: ${alvo.texto}.`;
}
