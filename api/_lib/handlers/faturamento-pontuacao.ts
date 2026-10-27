/**
 * API Route: GET | POST /api/faturamento/pontuacao
 *
 * Pontuação do setor na página Faturamento → Indicadores
 * (.scratch/faturamento-pontuacao/spec.md): os critérios e o total de cada
 * Frente no mês, em prévia ao vivo: a meta mensal, as guias sem lote do mês
 * anterior, os convênios recebidos sem glosa, as tarefas pendentes dos membros ativos das Frentes
 * e os lançamentos manuais. Os fatos vêm
 * de fatosPontuacao.ts; a regra é de faturamento/pontuacaoSetor.ts.
 *
 * GET — o resumo do mês. Autorização: `Authorization: Bearer <access_token>`
 * (canViewBilling). Query params:
 *   mes       YYYY-MM, obrigatório — a pontuação é sempre mensal
 *
 * POST — lança ou altera um critério manual (issue 05); lançar de novo
 * substitui o anterior. Autorização: canManageBilling. Body:
 *   { mes: 'YYYY-MM', frente, chave, pontos, observacao }
 * Critério que não é manual, pontos inválidos ou observação vazia dão 400.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import {
  gravarLancamento,
  lerFatoGuiasSemLote,
  lerFatoMeta,
  lerFatoTarefas,
  lerFatoZeroGlosa,
  lerLancamentos,
  lerMembros,
} from '../faturamento/fatosPontuacao.js';
import { mesValido } from '../faturamento/indicadoresFaturamento.js';
import { pontuarMes, validarLancamento } from '../faturamento/pontuacaoSetor.js';

/** POST: lança ou altera um critério manual do mês. */
async function lancar(req: VercelRequest, res: VercelResponse): Promise<void> {
  const token = tokenDoHeader(req.headers.authorization);
  const erroAuth = await autorizarFaturamento(token, 'canManageBilling');
  if (erroAuth) {
    // A mensagem padrão de canManageBilling fala de contas a receber.
    const payload = erroAuth.status === 403
      ? { success: false, error: 'Sem permissão para lançar pontos: exige gerenciar Faturamento.' }
      : erroAuth.payload;
    res.status(erroAuth.status).json(payload);
    return;
  }

  const corpo = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const mes = typeof corpo.mes === 'string' ? corpo.mes.trim() : '';
  if (!mesValido(mes)) {
    res.status(400).json({ success: false, error: 'Parâmetro inválido: mes (YYYY-MM).' });
    return;
  }
  const validado = validarLancamento(corpo);
  if ('erro' in validado) {
    res.status(400).json({ success: false, error: validado.erro });
    return;
  }

  const [ano, numeroMes] = mes.split('-').map(Number);
  const falha = await gravarLancamento(token as string, ano, numeroMes, validado.lancamento);
  if (falha) {
    res.status(falha.erro.status).json({ success: false, error: falha.erro.mensagem });
    return;
  }
  res.status(200).json({ success: true });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  try {
    if (req.method === 'POST') {
      await lancar(req, res);
      return;
    }

    const token = tokenDoHeader(req.headers.authorization);
    const erroAuth = await autorizarFaturamento(token);
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const bruto = req.query.mes;
    const mes = (Array.isArray(bruto) ? bruto[0] : bruto)?.trim() ?? '';
    if (!mesValido(mes)) {
      res.status(400).json({ success: false, error: 'Parâmetro inválido: mes (YYYY-MM).' });
      return;
    }

    const [ano, numeroMes] = mes.split('-').map(Number);
    const [meta, membros, lancamentos] = await Promise.all([
      lerFatoMeta(token as string, ano, numeroMes),
      lerMembros(token as string),
      lerLancamentos(token as string, ano, numeroMes),
    ]);
    if ('erro' in meta) {
      res.status(meta.erro.status).json({ success: false, error: meta.erro.mensagem });
      return;
    }
    if ('erro' in membros) {
      res.status(membros.erro.status).json({ success: false, error: membros.erro.mensagem });
      return;
    }
    if ('erro' in lancamentos) {
      res.status(lancamentos.erro.status).json({ success: false, error: lancamentos.erro.mensagem });
      return;
    }
    const [tarefas, guiasSemLote, zeroGlosa] = await Promise.all([
      lerFatoTarefas(membros, ano, numeroMes),
      lerFatoGuiasSemLote(ano, numeroMes),
      lerFatoZeroGlosa(ano, numeroMes),
    ]);
    if ('erro' in tarefas) {
      res.status(tarefas.erro.status).json({ success: false, error: tarefas.erro.mensagem });
      return;
    }
    if ('erro' in guiasSemLote) {
      res.status(guiasSemLote.erro.status).json({ success: false, error: guiasSemLote.erro.mensagem });
      return;
    }
    if ('erro' in zeroGlosa) {
      res.status(zeroGlosa.erro.status).json({ success: false, error: zeroGlosa.erro.mensagem });
      return;
    }

    // Dado financeiro: não deixa ficar em cache de navegador nem de proxy.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      // Prévia ao vivo; `dadoAte` é a tarefa mais recente do backup do apLIS.
      meta: { situacao: 'previa', dadoAte: tarefas.dadoAte },
      pontuacao: pontuarMes({ mes, fatos: { meta, guiasSemLote, zeroGlosa, tarefas: tarefas.tarefas }, lancamentos, membros }),
    });
  } catch (err) {
    console.error('[faturamento/pontuacao] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
