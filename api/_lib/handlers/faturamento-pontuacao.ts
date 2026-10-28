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
 * (canViewBilling ou a chave da tela). Query params:
 *   mes       YYYY-MM, obrigatório — a pontuação é sempre mensal
 * Mês fechado (issue 06) devolve o resumo congelado, sem consultar o apLIS.
 *
 * GET com `consulta` — as telas "Membros" (issue 07) e "Pontos base", só para canManageBilling:
 *   consulta=membros                       os membros das Frentes, com os desativados
 *   consulta=usuariosAplis&busca=<nome>    usuários ativos do apLIS pelo nome (≥ 2 letras)
 *   consulta=pontosBase                    todos os critérios, com o padrão e o valor em vigor
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
 *   'incluirMembro': { frente, idUsuarioAplis } — inclui (ou reativa) o usuário
 *     ativo do apLIS na Frente, com o nome lido do apLIS. 404 se o usuário não
 *     existe ou está inativo; 409 se já é membro ativo da Frente.
 *   'desativarMembro': { frente, idUsuarioAplis } — desativa sem apagar; 409 se
 *     não é membro ativo. A prévia do mês aberto já reflete a mudança; meses
 *     fechados guardam os membros daquele mês.
 *   'alterarPontosBase': { pontosBase: [{ frente, chave, pontosBase }] } —
 *     grava os pontos base dos critérios listados. Vale para a prévia de todo
 *     mês aberto; meses fechados guardam o que valia ao fechar. 400 com critério
 *     inválido ou valor fora de 0 a 9999,9 (uma casa).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { buscarUsuariosAplisAtivos, usuarioAplisAtivo } from '../faturamento/bdLab.js';
import {
  desativarMembro,
  gravarFechamento,
  gravarLancamento,
  gravarPontosBase,
  incluirMembro,
  lerFatoGuiasSemLote,
  lerFatoMeta,
  lerFatoTarefas,
  lerFatoZeroGlosa,
  lerFechamento,
  lerLancamentos,
  lerMembros,
  lerPontosBase,
  lerTodosMembros,
  reabrirFechamento,
} from '../faturamento/fatosPontuacao.js';
import type { FalhaFato, ResumoCongelado } from '../faturamento/fatosPontuacao.js';
import { mesValido } from '../faturamento/indicadoresFaturamento.js';
import {
  CRITERIOS,
  motivoParaNaoFechar,
  pontuarMes,
  validarLancamento,
  validarMembro,
  validarPontosBase,
} from '../faturamento/pontuacaoSetor.js';

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
  const [meta, membros, lancamentos, ajustes] = await Promise.all([
    lerFatoMeta(token, ano, numeroMes),
    lerMembros(token),
    lerLancamentos(token, ano, numeroMes),
    lerPontosBase(token),
  ]);
  if ('erro' in meta) return meta;
  if ('erro' in membros) return membros;
  if ('erro' in lancamentos) return lancamentos;
  if ('erro' in ajustes) return ajustes;
  const pontosBase = ajustes.map(({ frente, chave, pontosBase: valor }) => ({ frente, chave, pontosBase: valor }));
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
    resumo: { pontuacao: pontuarMes({ mes, fatos, lancamentos, membros, pontosBase }), fatos, membros, lancamentos, pontosBase },
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

/** POST: inclui o usuário do apLIS na Frente, com o nome lido do apLIS, nunca do corpo. */
async function incluir(token: string, corpo: Record<string, unknown>, res: VercelResponse): Promise<void> {
  const validado = validarMembro(corpo);
  if ('erro' in validado) {
    res.status(400).json({ success: false, error: validado.erro });
    return;
  }
  const doAplis = await usuarioAplisAtivo(validado.membro.idUsuarioAplis);
  if ('erro' in doAplis) {
    responderFalha(res, doAplis);
    return;
  }
  const { usuario } = doAplis;
  if (!usuario) {
    res.status(404).json({ success: false, error: 'Usuário do apLIS não encontrado entre os ativos.' });
    return;
  }

  const falha = await incluirMembro(token, { ...validado.membro, nome: usuario.nome });
  if (falha) {
    responderFalha(res, falha);
    return;
  }
  res.status(200).json({ success: true });
}

/** POST: desativa o membro da Frente; a linha fica para o histórico. */
async function desativar(token: string, corpo: Record<string, unknown>, res: VercelResponse): Promise<void> {
  const validado = validarMembro(corpo);
  if ('erro' in validado) {
    res.status(400).json({ success: false, error: validado.erro });
    return;
  }
  const falha = await desativarMembro(token, validado.membro);
  if (falha) {
    responderFalha(res, falha);
    return;
  }
  res.status(200).json({ success: true });
}

/** POST: grava os pontos base; a prévia dos meses abertos já usa os valores novos. */
async function alterarPontosBase(token: string, corpo: Record<string, unknown>, res: VercelResponse): Promise<void> {
  const validado = validarPontosBase(corpo);
  if ('erro' in validado) {
    res.status(400).json({ success: false, error: validado.erro });
    return;
  }
  const falha = await gravarPontosBase(token, validado.pontosBase);
  if (falha) {
    responderFalha(res, falha);
    return;
  }
  res.status(200).json({ success: true });
}

/** Autoriza canManageBilling; devolve o token, ou null quando já respondeu a falha. */
async function autorizarGestao(req: VercelRequest, res: VercelResponse): Promise<string | null> {
  const token = tokenDoHeader(req.headers.authorization);
  const erroAuth = await autorizarFaturamento(token, 'canManageBilling');
  if (erroAuth) {
    // A mensagem padrão de canManageBilling fala de contas a receber.
    const payload = erroAuth.status === 403
      ? { success: false, error: 'Sem permissão para gerenciar a pontuação: exige gerenciar Faturamento.' }
      : erroAuth.payload;
    res.status(erroAuth.status).json(payload);
    return null;
  }
  return token as string;
}

/** GET com `consulta`: os dados das telas "Membros" e "Pontos base". */
async function consultaDeMembros(req: VercelRequest, res: VercelResponse, consulta: string): Promise<void> {
  const token = await autorizarGestao(req, res);
  if (!token) return;
  res.setHeader('Cache-Control', 'no-store');

  if (consulta === 'membros') {
    const membros = await lerTodosMembros(token);
    if ('erro' in membros) {
      responderFalha(res, membros);
      return;
    }
    res.status(200).json({ success: true, membros });
    return;
  }

  if (consulta === 'pontosBase') {
    const ajustes = await lerPontosBase(token);
    if ('erro' in ajustes) {
      responderFalha(res, ajustes);
      return;
    }
    const pontosBase = CRITERIOS.map(({ frente, chave, rotulo, tipo, pontosBase: padrao, porConvenio }) => {
      const ajuste = ajustes.find((a) => a.frente === frente && a.chave === chave);
      return {
        frente,
        chave,
        rotulo,
        tipo,
        ...(porConvenio ? { porConvenio } : {}),
        padrao,
        pontosBase: ajuste?.pontosBase ?? padrao,
        alteradoPor: ajuste?.alteradoPor ?? null,
        alteradoEm: ajuste?.alteradoEm ?? null,
      };
    });
    res.status(200).json({ success: true, pontosBase });
    return;
  }

  if (consulta === 'usuariosAplis') {
    const bruto = req.query.busca;
    const busca = (Array.isArray(bruto) ? bruto[0] : bruto)?.trim() ?? '';
    if (busca.length < 2) {
      res.status(400).json({ success: false, error: 'Digite ao menos 2 letras do nome.' });
      return;
    }
    const resultado = await buscarUsuariosAplisAtivos(busca);
    if ('erro' in resultado) {
      responderFalha(res, resultado);
      return;
    }
    res.status(200).json({ success: true, usuarios: resultado.usuarios });
    return;
  }

  res.status(400).json({ success: false, error: 'Consulta inválida: use membros, usuariosAplis ou pontosBase.' });
}

/** POST: as ações de quem gerencia Faturamento. */
async function acaoDeGestao(req: VercelRequest, res: VercelResponse): Promise<void> {
  const token = await autorizarGestao(req, res);
  if (!token) return;

  const corpo = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  // Os membros não são do mês: a lista vale para a prévia de todo mês aberto.
  if (corpo.acao === 'incluirMembro') {
    await incluir(token, corpo, res);
    return;
  }
  if (corpo.acao === 'desativarMembro') {
    await desativar(token, corpo, res);
    return;
  }
  // Os pontos base também não são do mês: valem para todo mês aberto.
  if (corpo.acao === 'alterarPontosBase') {
    await alterarPontosBase(token, corpo, res);
    return;
  }

  const mes = typeof corpo.mes === 'string' ? corpo.mes.trim() : '';
  if (!mesValido(mes)) {
    res.status(400).json({ success: false, error: 'Parâmetro inválido: mes (YYYY-MM).' });
    return;
  }

  if (corpo.acao === 'lancar') {
    await lancar(token, mes, corpo, res);
  } else if (corpo.acao === 'fechar') {
    await fechar(token, mes, res);
  } else if (corpo.acao === 'reabrir') {
    await reabrir(token, mes, res);
  } else {
    res.status(400).json({ success: false, error: 'Ação inválida: use lancar, fechar, reabrir, incluirMembro, desativarMembro ou alterarPontosBase.' });
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

    const consulta = req.query.consulta;
    if (consulta !== undefined) {
      await consultaDeMembros(req, res, (Array.isArray(consulta) ? consulta[0] : consulta) ?? '');
      return;
    }

    const token = tokenDoHeader(req.headers.authorization);
    const erroAuth = await autorizarFaturamento(token, ['indicadores']);
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
