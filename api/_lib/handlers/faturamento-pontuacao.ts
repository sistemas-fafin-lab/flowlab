/**
 * API Route: GET /api/faturamento/pontuacao
 *
 * Pontuação do setor na página Faturamento → Indicadores
 * (.scratch/faturamento-pontuacao/spec.md): os critérios e o total de cada
 * Frente no mês, em prévia ao vivo: a meta mensal, as guias sem lote do mês
 * anterior, os convênios recebidos sem glosa e as tarefas pendentes dos membros ativos das Frentes. Os fatos vêm
 * de fatosPontuacao.ts; a regra é de faturamento/pontuacaoSetor.ts.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling).
 *
 * Query params:
 *   mes       YYYY-MM, obrigatório — a pontuação é sempre mensal
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { lerFatoGuiasSemLote, lerFatoMeta, lerFatoTarefas, lerFatoZeroGlosa, lerMembros } from '../faturamento/fatosPontuacao.js';
import { mesValido } from '../faturamento/indicadoresFaturamento.js';
import { pontuarMes } from '../faturamento/pontuacaoSetor.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  try {
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
    const [meta, membros] = await Promise.all([lerFatoMeta(token as string, ano, numeroMes), lerMembros(token as string)]);
    if ('erro' in meta) {
      res.status(meta.erro.status).json({ success: false, error: meta.erro.mensagem });
      return;
    }
    if ('erro' in membros) {
      res.status(membros.erro.status).json({ success: false, error: membros.erro.mensagem });
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
      pontuacao: pontuarMes({ mes, fatos: { meta, guiasSemLote, zeroGlosa, tarefas: tarefas.tarefas }, lancamentos: [], membros }),
    });
  } catch (err) {
    console.error('[faturamento/pontuacao] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
