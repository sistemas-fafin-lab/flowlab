/**
 * API Route: POST /api/faturamento/glosas-recursos-editar
 *
 * Lápis do card "Detalhes do recurso" na tela Glosas e Recursos
 * (.scratch/glosas-recursos-dashboard/spec.md, issue 07). Corrige um campo
 * que o apLIS não guarda ou não reflete:
 *
 *   lote de recurso  dataEnvio, dataRetornoReal, dataPagamentoReal ('YYYY-MM-DD')
 *   requisição       valorRecursado, valorRecebidoGlosa (reais, ≥ 0),
 *                    instancia (1, 2 ou 3: a instância do recurso; issue 08 de
 *                    .scratch/glosas-recursos-calendario-pendencias/)
 *
 * Grava só no FlowLab, nas colunas de edição da foto (migrations
 * 20261023180000 e, a instância, 20261127100000), com quem editou e quando; o valor editado vale acima do
 * apLIS e a sincronização não o sobrescreve. `valor: null` remove a edição e
 * volta a valer o apLIS. Cada edição vira evento 'edicao_manual' no histórico,
 * com o valor que valia antes e o que passa a valer
 * (recursoGlosa.eventoEdicaoManual). A edição e o evento vão juntos, numa
 * transação, pela RPC glosa_recurso_gravar_edicao — que também põe o usuário
 * (auth.uid()).
 *
 * Autorização: `Authorization: Bearer <access_token>` (canManageBilling).
 * Grava com o cliente do usuário: a RPC e a RLS das fotos e do histórico
 * também exigem canManageBilling.
 *
 * Body: { idLoteRecurso | idRequisicao, campo, valor }
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { eventoEdicaoManual, valorRecebidoGlosa } from '../faturamento/recursoGlosa.js';
import type {
  CampoEdicaoLote,
  CampoEdicaoRequisicao,
  EventoHistorico,
  InstanciaRecurso,
} from '../faturamento/recursoGlosa.js';
import { getSupabaseUserClient } from '../supabase.js';

/** Coluna do valor editado; `<coluna>_por` e `<coluna>_em` guardam quem e quando. */
const COLUNA_LOTE: Record<CampoEdicaoLote, string> = {
  dataEnvio: 'data_envio_editada',
  dataRetornoReal: 'data_retorno_real',
  dataPagamentoReal: 'data_pagamento_real',
};

const COLUNA_REQUISICAO: Record<CampoEdicaoRequisicao, string> = {
  valorRecursado: 'valor_recursado_editado',
  valorRecebidoGlosa: 'valor_recebido_glosa_editado',
  instancia: 'instancia_editada',
};

const INSTANCIAS: readonly unknown[] = [1, 2, 3];

/** DECIMAL(15, 2). */
const VALOR_MAXIMO = 1e13;

interface CorpoEditar {
  idLoteRecurso?: unknown;
  idRequisicao?: unknown;
  campo?: unknown;
  valor?: unknown;
}

interface LinhaLote {
  id_lote_recurso: number;
  data_envio_aplis: string | null;
  data_envio_editada: string | null;
  data_retorno_real: string | null;
  data_pagamento_real: string | null;
}

interface LinhaRequisicao {
  id_requisicao: number;
  id_lote_recurso: number | null;
  status_aplis: number | null;
  liquido: number | string;
  recebido: number | string;
  recebido_fixacao: number | string | null;
  valor_recursado: number | string | null;
  valor_recursado_editado: number | string | null;
  valor_recebido_glosa_editado: number | string | null;
  instancia_observada: number | null;
  instancia_editada: number | null;
}

/** O que a edição muda: o valor gravado e o evento do histórico. */
interface Edicao {
  tabela: 'glosa_recurso_lotes' | 'glosa_recurso_requisicoes';
  chave: 'id_lote_recurso' | 'id_requisicao';
  id: number;
  coluna: string;
  valor: string | number | null;
  idRequisicao: number | null;
  idLoteRecurso: number | null;
  /** null: nada muda (já vale isso), sem gravar. */
  evento: EventoHistorico | null;
}

class Recusa extends Error {
  constructor(readonly status: number, mensagem: string) {
    super(mensagem);
  }
}

function idPositivo(valor: unknown): number | null | undefined {
  if (valor === undefined || valor === null) return undefined;
  return typeof valor === 'number' && Number.isInteger(valor) && valor > 0 ? valor : null;
}

/** 'YYYY-MM-DD' que existe no calendário. */
function dataValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function numeroOuNulo(valor: number | string | null): number | null {
  return valor === null ? null : Number(valor);
}

function centavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

async function edicaoDoLote(
  supabase: SupabaseClient,
  id: number,
  campo: CampoEdicaoLote,
  valor: unknown,
): Promise<Edicao> {
  if (valor !== null && !dataValida(valor)) throw new Recusa(400, 'Informe a data no formato YYYY-MM-DD.');
  const { data, error } = await supabase
    .from('glosa_recurso_lotes')
    .select('id_lote_recurso, data_envio_aplis, data_envio_editada, data_retorno_real, data_pagamento_real')
    .eq('id_lote_recurso', id)
    .maybeSingle();
  if (error) throw new Error(`foto do lote: ${error.message}`);
  if (!data) throw new Recusa(404, 'Lote de recurso não encontrado na foto de glosas e recursos.');
  const lote = data as LinhaLote;

  const coluna = COLUNA_LOTE[campo];
  const editado = (lote as unknown as Record<string, string | null>)[coluna];
  // Só a data de envio tem valor do apLIS por baixo; retorno e pagamento real só existem editados.
  const doAplis = campo === 'dataEnvio' ? lote.data_envio_aplis : null;
  const anterior = editado ?? doAplis;
  const novo = (valor as string | null) ?? doAplis;
  const semMudanca = valor === editado;
  return {
    tabela: 'glosa_recurso_lotes',
    chave: 'id_lote_recurso',
    id,
    coluna,
    valor: valor as string | null,
    idRequisicao: null,
    idLoteRecurso: id,
    evento: semMudanca ? null : eventoEdicaoManual(campo, anterior, novo, { removida: valor === null }),
  };
}

async function requisicaoDaFoto(supabase: SupabaseClient, id: number): Promise<LinhaRequisicao> {
  const { data, error } = await supabase
    .from('glosa_recurso_requisicoes')
    .select('id_requisicao, id_lote_recurso, status_aplis, liquido, recebido, recebido_fixacao, valor_recursado, valor_recursado_editado, valor_recebido_glosa_editado, instancia_observada, instancia_editada')
    .eq('id_requisicao', id)
    .maybeSingle();
  if (error) throw new Error(`foto da requisição: ${error.message}`);
  if (!data) throw new Recusa(404, 'Requisição não encontrada na foto de glosas e recursos.');
  return data as LinhaRequisicao;
}

/**
 * Instância do recurso marcada à mão. O que valia antes é a editada ou, sem
 * edição, a observada no apLIS; removida, volta a valer a observada.
 */
async function edicaoDaInstancia(supabase: SupabaseClient, id: number, valor: unknown): Promise<Edicao> {
  if (valor !== null && !INSTANCIAS.includes(valor)) throw new Recusa(400, 'Informe a instância do recurso: 1, 2 ou 3.');
  const r = await requisicaoDaFoto(supabase, id);
  const editada = r.instancia_editada as InstanciaRecurso | null;
  const observada = r.instancia_observada as InstanciaRecurso | null;
  const nova = valor as InstanciaRecurso | null;
  return {
    tabela: 'glosa_recurso_requisicoes',
    chave: 'id_requisicao',
    id: r.id_requisicao,
    coluna: COLUNA_REQUISICAO.instancia,
    valor: nova,
    idRequisicao: r.id_requisicao,
    idLoteRecurso: r.id_lote_recurso,
    evento: nova === editada
      ? null
      : eventoEdicaoManual('instancia', editada ?? observada, nova ?? observada, { removida: nova === null }),
  };
}

async function edicaoDaRequisicao(
  supabase: SupabaseClient,
  id: number,
  campo: Exclude<CampoEdicaoRequisicao, 'instancia'>,
  valor: unknown,
): Promise<Edicao> {
  if (valor !== null && !(typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 && valor < VALOR_MAXIMO)) {
    throw new Recusa(400, 'Informe um valor em reais maior ou igual a zero.');
  }
  const r = await requisicaoDaFoto(supabase, id);

  const coluna = COLUNA_REQUISICAO[campo];
  const editado = numeroOuNulo(campo === 'valorRecursado' ? r.valor_recursado_editado : r.valor_recebido_glosa_editado);
  const doAplis = campo === 'valorRecursado'
    ? numeroOuNulo(r.valor_recursado)
    : valorRecebidoGlosa({
      status: r.status_aplis,
      liquido: Number(r.liquido),
      recebido: Number(r.recebido),
      recebidoFixacao: numeroOuNulo(r.recebido_fixacao),
      valorRecursado: numeroOuNulo(r.valor_recursado),
      emLoteRecurso: r.id_lote_recurso !== null,
      loteEnviado: false,
    });
  const novoValor = valor === null ? null : centavos(valor as number);
  return {
    tabela: 'glosa_recurso_requisicoes',
    chave: 'id_requisicao',
    id,
    coluna,
    valor: novoValor,
    idRequisicao: id,
    idLoteRecurso: r.id_lote_recurso,
    evento: novoValor === editado
      ? null
      : eventoEdicaoManual(campo, editado ?? doAplis, novoValor ?? doAplis, { removida: novoValor === null }),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  try {
    const token = tokenDoHeader(req.headers.authorization);
    const erroAuth = await autorizarFaturamento(token, 'canManageBilling');
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const corpo = (req.body ?? {}) as CorpoEditar;
    const idLoteRecurso = idPositivo(corpo.idLoteRecurso);
    const idRequisicao = idPositivo(corpo.idRequisicao);
    if (idLoteRecurso === null || idRequisicao === null || (idLoteRecurso === undefined) === (idRequisicao === undefined)) {
      res.status(400).json({ success: false, error: 'Informe idLoteRecurso ou idRequisicao (inteiro positivo).' });
      return;
    }
    const campo = typeof corpo.campo === 'string' ? corpo.campo : '';
    const camposValidos = idLoteRecurso !== undefined ? COLUNA_LOTE : COLUNA_REQUISICAO;
    if (!(campo in camposValidos)) {
      res.status(400).json({ success: false, error: `Campo inválido: use ${Object.keys(camposValidos).join(', ')}.` });
      return;
    }
    if (corpo.valor === undefined) {
      res.status(400).json({ success: false, error: 'Informe o valor (null remove a edição).' });
      return;
    }

    const supabase = getSupabaseUserClient(token as string);

    let edicao: Edicao;
    try {
      edicao = idLoteRecurso !== undefined
        ? await edicaoDoLote(supabase, idLoteRecurso, campo as CampoEdicaoLote, corpo.valor)
        : campo === 'instancia'
          ? await edicaoDaInstancia(supabase, idRequisicao as number, corpo.valor)
          : await edicaoDaRequisicao(supabase, idRequisicao as number, campo as Exclude<CampoEdicaoRequisicao, 'instancia'>, corpo.valor);
    } catch (err) {
      if (!(err instanceof Recusa)) throw err;
      res.status(err.status).json({ success: false, error: err.message });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    if (!edicao.evento) {
      res.status(200).json({ success: true, alterado: false });
      return;
    }

    const { error } = await supabase.rpc('glosa_recurso_gravar_edicao', {
      p_tabela: edicao.tabela,
      p_id: edicao.id,
      p_coluna: edicao.coluna,
      p_valor: edicao.valor === null ? null : String(edicao.valor),
      p_id_requisicao: edicao.idRequisicao,
      p_id_lote_recurso: edicao.idLoteRecurso,
      p_valor_anterior: edicao.evento.valorAnterior,
      p_valor_novo: edicao.evento.valorNovo,
      p_descricao: edicao.evento.descricao,
    });
    if (error) {
      console.error('[faturamento/glosas-recursos-editar] rpc:', error.code, error.message);
      // 42501: sem permissão; P0002: o registro sumiu da foto entre a leitura e a gravação.
      const status = error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 502;
      res.status(status).json({
        success: false,
        error: status === 502 ? 'Não foi possível gravar a edição agora — tente novamente.' : error.message,
      });
      return;
    }

    res.status(200).json({ success: true, alterado: true });
  } catch (err) {
    console.error('[faturamento/glosas-recursos-editar] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
