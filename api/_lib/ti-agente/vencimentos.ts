// Vencimentos do Gastos de TI no servidor (D49, issue 36). As regras e os textos ficam em
// src/modules/eva/domain/vencimentos.ts.
// - verificarVencimentos: no relógio (D44), no horário da EVA. Na antecedência de cada despesa e a
//   7 dias do fim, o alerta vai para os gestores que recebem alertas e para o responsável da
//   despesa, desde que vejam o Gastos de TI (canViewGastosTI ou canManageGastosTI).
// - lerBlocoVencimentos: o bloco do contexto da IA, para "o que vence de licença?".
import type { SupabaseClient } from '@supabase/supabase-js';
import { hojeSP } from '../../../src/modules/eva/domain/datas.js';
import { presentes, proximaJanelaDeCobranca } from '../../../src/modules/eva/domain/cobranca.js';
import {
  chaveDoVencimento, marcoDoAviso, montarBlocoVencimentos, textoDoVencimento, vencimentosAte, type DespesaVencimento,
} from '../../../src/modules/eva/domain/vencimentos.js';
import { tem, type Usuario } from './autorizacao.js';
import { lerConfigCobranca, lerMembrosCobranca } from './cobranca.js';
import { lerQuemTem } from './dados.js';
import { lerDestinatariosDeGestao } from './gestao.js';

/** Quem vê o Gastos de TI vê os vencimentos (as chaves próprias do módulo, como na tela). */
export const CHAVES_GASTOS = ['canViewGastosTI', 'canManageGastosTI'] as const;
export const veGastos = (u: Pick<Usuario, 'permissoes'> | null) => !!u && CHAVES_GASTOS.some((c) => tem(u as Usuario, c));

const CAMPOS = 'id, descricao, fornecedor_nome, recorrencia, competencia_fim, renovacao_automatica, aviso_renovacao_dias, responsavel_id';

/** As despesas com fim marcado (as sem fim não vencem). */
export async function lerDespesasComFim(db: SupabaseClient): Promise<DespesaVencimento[]> {
  const { data, error } = await db.from('ti_despesas').select(CAMPOS).not('competencia_fim', 'is', null).neq('recorrencia', 'unica').limit(2000);
  if (error) throw new Error(error.message);
  return (data ?? []) as DespesaVencimento[];
}

/** "O que vence de licença?": só entra no contexto de quem vê o Gastos de TI. */
export async function lerBlocoVencimentos(db: SupabaseClient, agora = new Date()): Promise<string> {
  return montarBlocoVencimentos(vencimentosAte(await lerDespesasComFim(db), hojeSP(agora)));
}

export interface ResultadoVencimentos { pulado: string | null; avisos: number; gravados: number }

export async function verificarVencimentos(db: SupabaseClient, opcoes: { agora?: Date; link: string }): Promise<ResultadoVencimentos> {
  const agora = opcoes.agora ?? new Date();
  const base: ResultadoVencimentos = { pulado: null, avisos: 0, gravados: 0 };
  // Como os alertas de gestão: só no horário da EVA, para o aviso não esperar a noite na fila.
  if (proximaJanelaDeCobranca(agora.getTime()) !== null) return { ...base, pulado: 'Fora do horário da EVA.' };
  const cfg = await lerConfigCobranca(db);
  if (!cfg.whatsapp_ativo) return { ...base, pulado: 'O WhatsApp da EVA está desligado.' };

  const hoje = hojeSP(agora);
  const avisos = vencimentosAte(await lerDespesasComFim(db), hoje)
    .map((v) => ({ v, marco: marcoDoAviso(v) }))
    .filter((x): x is { v: typeof x.v; marco: number } => x.marco !== null);
  if (avisos.length === 0) return base;

  const [gestores, membros, chave1, chave2] = await Promise.all([
    lerDestinatariosDeGestao(db, 'recebe_alertas'), lerMembrosCobranca(db), ...CHAVES_GASTOS.map((c) => lerQuemTem(db, c)),
  ]);
  const podeVer = new Set([...chave1, ...chave2]);
  const aqui = presentes(membros, hoje).filter((m) => m.ativo && !!m.whatsapp);
  const r = { ...base, avisos: avisos.length };
  for (const { v, marco } of avisos) {
    const destinos = new Set(gestores.filter((g) => podeVer.has(g.userId)).map((g) => g.membroId));
    const responsavel = v.despesa.responsavel_id ? aqui.find((m) => m.user_id === v.despesa.responsavel_id) : undefined;
    if (responsavel && podeVer.has(responsavel.user_id)) destinos.add(responsavel.id);
    const texto = textoDoVencimento(v, opcoes.link);
    for (const membroId of destinos) {
      const { data, error } = await db.from('ti_agente_mensagens').upsert(
        { membro_id: membroId, direcao: 'saida', tipo: 'alerta', status: 'pendente', texto, card_ids: [], chave_dia: chaveDoVencimento(membroId, v, marco) },
        { onConflict: 'chave_dia', ignoreDuplicates: true },
      ).select('id');
      if (error) throw new Error(error.message);
      if ((data ?? []).length) r.gravados += 1;
    }
  }
  return r;
}
