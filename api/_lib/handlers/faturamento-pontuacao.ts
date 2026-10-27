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
 * Mês fechado (issue 06) devolve o resumo congelado, sem consultar o apLIS.
 *
 * POST — ações de quem gerencia Faturamento (canManageBilling). Body com `acao`:
 *   'lancar': { mes: 'YYYY-MM', frente, chave, pontos, observacao } —
 *     lança ou altera um critério manual (issue 05); lançar de novo substitui o
 *     anterior. Critério que não é manual, pontos inválidos ou observação vazia
 *     dão 400; mês fechado dá 409 (o banco recusa).
 *   'fechar': { mes } — recalcula a prévia no servidor e congela esse resultado.
 *     409 quando o "dados até" do apLIS não chegou ao último dia do mês ou o mês
 *     já está fechado.
 *   'reabrir': { mes } — tira o fechamento de vigor; 409 se o mês não está fechado.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import {
  gravarFechamento,
  gravarLancamento,
  lerFatoGuiasSemLote,
  lerFatoMeta,
  lerFatoTarefas,
  lerFatoZeroGlosa,
  lerFechamento,
  lerLancamentos,
  lerMembros,
  reabrirFechamento,
} from '../faturamento/fatosPontuacao.js';
import type { FalhaFato, ResumoCongelado } from '../faturamento/fatosPontuacao.js';
import { mesValido } from '../faturamento/indicadoresFaturamento.js';
import { motivoParaNaoFechar, pontuarMes, validarLancamento } from '../faturamento/pontuacaoSetor.js';

/** 'YYYY-MM' já validado → [ano, mês]. */
const anoMes = (mes: string): [number, number] => {
  const [ano, numeroMes] = mes.split('-').map(Number);
  return [ano, numeroMes];
};

const responderFalha = (res: VercelResponse, { erro }: FalhaFato): void => {
  res.status(erro.status).json({ success: false, error: erro.mensagem });
};

/**
 * Prévia ao vivo do mês: lê os fatos do apLIS e do Supabase e pontua. É o que o
 * GET de mês aberto mostra e o que o "fechar" congela.
 */
async function calcularPrevia(
  token: string,
  mes: string,
): Promise<{ resumo: ResumoCongelado; dadoAte: string | null } | FalhaFato> {
  const [ano, numeroMes] = anoMes(mes);
  const [meta, membros, lancamentos] = await Promise.all([
    lerFatoMeta(token, ano, numeroMes),
    lerMembros(token),
    lerLancamentos(token, ano, numeroMes),
  ]);
  if ('erro' in meta) return meta;
  if ('erro' in membros) return membros;
  if ('erro' in lancamentos) return lancamentos;
  const [tarefas, guiasSemLote, zeroGlosa] = await Promise.all([
    lerFatoTarefas(membros, ano, numeroMes),
    lerFatoGuiasSemLote(ano, numeroMes),
    lerFatoZeroGlosa(ano, numeroMes),
  ]);
  if ('erro' in tarefas) return tarefas;
  if ('erro' in guiasSemLote) return guiasSemLote;
  if ('erro' in zeroGlosa) return zeroGlosa;

  const fatos = { meta, guiasSemLote, zeroGlosa, tarefas: tarefas.tarefas };
  return {
    resumo: { pontuacao: pontuarMes({ mes, fatos, lancamentos, membros }), fatos, membros, lancamentos },
    // `dadoAte` é a tarefa mais recente do backup do apLIS.
    dadoAte: tarefas.dadoAte,
  };
}

/** POST: lança ou altera um critério manual do mês. */
async function lancar(token: string, mes: string, corpo: Record<string, unknown>, res: VercelResponse): Promise<void> {
  const validado = validarLancamento(corpo);
  if ('erro' in validado) {
    res.status(400).json({ success: false, error: validado.erro });
    return;
  }

  const [ano, numeroMes] = anoMes(mes);
  const falha = await gravarLancamento(token, ano, numeroMes, validado.lancamento);
  if (falha) {
    responderFalha(res, falha);
    return;
  }
  res.status(200).json({ success: true });
}

/**
 * POST: congela a prévia recalculada agora, não o que a tela mostrava.
 * Um lançamento gravado entre o cálculo e o insert fica fora do congelado; com
 * a coordenação como única que lança e fecha, a janela foi aceita.
 */
async function fechar(token: string, mes: string, res: VercelResponse): Promise<void> {
  const [ano, numeroMes] = anoMes(mes);
  const fechamento = await lerFechamento(token, ano, numeroMes);
  if (fechamento && 'erro' in fechamento) {
    responderFalha(res, fechamento);
    return;
  }
  if (fechamento !== null) {
    res.status(409).json({ success: false, error: 'A pontuação deste mês já está fechada.' });
    return;
  }

  const previa = await calcularPrevia(token, mes);
  if ('erro' in previa) {
    responderFalha(res, previa);
    return;
  }
  const motivo = motivoParaNaoFechar(mes, previa.dadoAte);
  // Sem `dadoAte` sempre há motivo; o `!previa.dadoAte` é só para o TS estreitar o tipo.
  if (motivo || !previa.dadoAte) {
    res.status(409).json({ success: false, error: motivo });
    return;
  }

  const falha = await gravarFechamento(token, ano, numeroMes, previa.resumo, previa.dadoAte);
  if (falha) {
    responderFalha(res, falha);
    return;
  }
  res.status(200).json({ success: true });
}

/** POST: tira o fechamento de vigor; os lançamentos continuam. */
async function reabrir(token: string, mes: string, res: VercelResponse): Promise<void> {
  const [ano, numeroMes] = anoMes(mes);
  const falha = await reabrirFechamento(token, ano, numeroMes);
  if (falha) {
    responderFalha(res, falha);
    return;
  }
  res.status(200).json({ success: true });
}

/** POST: as ações de quem gerencia Faturamento. */
async function acaoDeGestao(req: VercelRequest, res: VercelResponse): Promise<void> {
  const token = tokenDoHeader(req.headers.authorization);
  const erroAuth = await autorizarFaturamento(token, 'canManageBilling');
  if (erroAuth) {
    // A mensagem padrão de canManageBilling fala de contas a receber.
    const payload = erroAuth.status === 403
      ? { success: false, error: 'Sem permissão para lançar, fechar ou reabrir a pontuação: exige gerenciar Faturamento.' }
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

  if (corpo.acao === 'lancar') {
    await lancar(token as string, mes, corpo, res);
  } else if (corpo.acao === 'fechar') {
    await fechar(token as string, mes, res);
  } else if (corpo.acao === 'reabrir') {
    await reabrir(token as string, mes, res);
  } else {
    res.status(400).json({ success: false, error: 'Ação inválida: use lancar, fechar ou reabrir.' });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  try {
    if (req.method === 'POST') {
      await acaoDeGestao(req, res);
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

    // Dado financeiro: não deixa ficar em cache de navegador nem de proxy.
    res.setHeader('Cache-Control', 'no-store');

    // Mês fechado: os números congelados, sem ir ao apLIS.
    const [ano, numeroMes] = anoMes(mes);
    const fechamento = await lerFechamento(token as string, ano, numeroMes);
    if (fechamento !== null) {
      if ('erro' in fechamento) {
        responderFalha(res, fechamento);
        return;
      }
      res.status(200).json({
        success: true,
        meta: {
          situacao: 'fechado',
          dadoAte: fechamento.dadoAte,
          fechadoPor: fechamento.fechadoPor,
          fechadoEm: fechamento.fechadoEm,
        },
        pontuacao: fechamento.resumo.pontuacao,
      });
      return;
    }

    const previa = await calcularPrevia(token as string, mes);
    if ('erro' in previa) {
      responderFalha(res, previa);
      return;
    }
    res.status(200).json({
      success: true,
      meta: { situacao: 'previa', dadoAte: previa.dadoAte },
      pontuacao: previa.resumo.pontuacao,
    });
  } catch (err) {
    console.error('[faturamento/pontuacao] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
