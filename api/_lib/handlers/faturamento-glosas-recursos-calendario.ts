/**
 * API Route: GET /api/faturamento/glosas-recursos-calendario
 *
 * Aba "Calendário de recursos" da tela Glosas e Recursos
 * (.scratch/glosas-recursos-calendario-pendencias/spec.md, issue 03): os lotes
 * de faturamento com glosas ainda não recorridas, no dia do prazo para recorrer,
 * com os painéis Hoje, Amanhã e Atrasados e a lista "Sem prazo cadastrado". As
 * regras estão em faturamento/recursoGlosa.ts (calendarioDeRecursos); aqui só
 * se lê a foto do Supabase (view glosa_recurso_requisicoes_lista) e as regras
 * GLOSA – RECURSO dos convênios, a cada consulta — uma regra alterada vale na
 * próxima leitura.
 *
 * O período do cabeçalho não filtra: as glosadas sem recurso de todos os meses
 * de faturamento entram, e o calendário é navegado pelo próprio mês.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling ou a chave da tela). Lido
 * com o cliente do usuário, para respeitar a RLS.
 *
 * Query params:
 *   mes              YYYY-MM da grade, obrigatório
 *   fontePagadoraId  filtra por convênio (fatinstituicao.IdInstituicao)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { calendarioDeRecursos, competenciaValida, STATUS_GLOSA } from '../faturamento/recursoGlosa.js';
import type {
  ItemCalendarioRecursos,
  ItemSemPrazo,
  LoteCalendarioRecursos,
  RegraPrazo,
  RequisicaoCalendario,
  TipoRegraPrazo,
} from '../faturamento/recursoGlosa.js';
import { getSupabaseUserClient } from '../supabase.js';

/** Limite de linhas por resposta do PostgREST. */
const PAGINA_LEITURA = 1000;

interface LinhaCalendario {
  id_requisicao: number;
  cod_requisicao: string | null;
  num_guia: string | null;
  paciente: string | null;
  competencia: string;
  id_lote_faturamento: number;
  protocolo_lote_faturamento: string | null;
  id_fonte_pagadora: number | null;
  fonte_pagadora_nome: string | null;
  status_aplis: number;
  glosa_fixada: number | string | null;
  valor_inicial_estimado: boolean;
  data_recebimento: string | null;
  procedimentos: string[] | null;
  motivos: string[] | null;
  lote_enviado: boolean;
}

interface LinhaRegraFonte {
  id_fonte_pagadora: number;
  glosa_prazo_regras: { glosa_recurso_tipo: TipoRegraPrazo; glosa_recurso_n: number | null } | null;
}

interface RequisicaoLida extends RequisicaoCalendario {
  idRequisicao: number;
  codRequisicao: string | null;
  numGuia: string | null;
  paciente: string | null;
  competencia: string;
  procedimentos: string[];
  valorInicialEstimado: boolean;
}

function primeiro(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

function inteiroPositivo(bruto: string | undefined): number | null | undefined {
  if (bruto === undefined || bruto.trim() === '') return undefined;
  const n = Number(bruto);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** 'YYYY-MM-DD' de hoje no fuso do laboratório. */
function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

const COLUNAS = [
  'id_requisicao', 'cod_requisicao', 'num_guia', 'paciente', 'competencia', 'id_lote_faturamento',
  'protocolo_lote_faturamento', 'id_fonte_pagadora', 'fonte_pagadora_nome', 'status_aplis', 'glosa_fixada',
  'valor_inicial_estimado', 'data_recebimento', 'procedimentos', 'motivos', 'lote_enviado',
].join(', ');

function daLinha(l: LinhaCalendario): RequisicaoLida {
  return {
    idRequisicao: l.id_requisicao,
    codRequisicao: l.cod_requisicao,
    numGuia: l.num_guia,
    paciente: l.paciente,
    competencia: l.competencia,
    idLoteFaturamento: l.id_lote_faturamento,
    protocoloLoteFaturamento: l.protocolo_lote_faturamento,
    fontePagadora: { id: l.id_fonte_pagadora, nome: l.fonte_pagadora_nome },
    status: l.status_aplis,
    dataRecebimento: l.data_recebimento,
    glosaFixada: l.glosa_fixada === null ? null : Number(l.glosa_fixada),
    motivos: l.motivos ?? [],
    procedimentos: l.procedimentos ?? [],
    valorInicialEstimado: l.valor_inicial_estimado,
    loteRecursoEnviado: l.lote_enviado,
  };
}

/** O lote como a tela o recebe: requisições só com o que a lista mostra. */
function loteDaResposta(item: LoteCalendarioRecursos<RequisicaoLida>) {
  return {
    idLoteFaturamento: item.idLoteFaturamento,
    protocolo: item.protocolo,
    fontePagadora: item.fontePagadora,
    quantidade: item.quantidade,
    valor: item.valor,
    motivos: item.motivos,
    qtdOutrosMotivos: item.qtdOutrosMotivos,
    requisicoes: item.requisicoes.map((r) => ({
      idRequisicao: r.idRequisicao,
      codRequisicao: r.codRequisicao,
      numGuia: r.numGuia,
      paciente: r.paciente,
      competencia: r.competencia,
      dataGlosa: r.dataRecebimento,
      procedimentos: r.procedimentos,
      motivos: r.motivos,
      valorGlosado: r.glosaFixada,
      valorInicialEstimado: r.valorInicialEstimado,
    })),
  };
}

function itemDaResposta(item: ItemCalendarioRecursos<RequisicaoLida>) {
  return {
    ...loteDaResposta(item),
    prazo: item.prazo,
    dataExibicao: item.dataExibicao,
    venceEm: item.venceEm,
    selo: item.selo,
  };
}

function semPrazoDaResposta(item: ItemSemPrazo<RequisicaoLida>) {
  return { ...loteDaResposta(item), motivoSemPrazo: item.motivoSemPrazo };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  try {
    const token = tokenDoHeader(req.headers.authorization);
    const erroAuth = await autorizarFaturamento(token, ['glosas']);
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const q = req.query as Record<string, string | string[] | undefined>;
    const mes = primeiro(q.mes)?.trim() ?? '';
    const fontePagadoraId = inteiroPositivo(primeiro(q.fontePagadoraId));
    const invalidos = [
      !competenciaValida(mes) ? 'mes (YYYY-MM)' : null,
      fontePagadoraId === null ? 'fontePagadoraId' : null,
    ].filter((c): c is string => c !== null);
    if (invalidos.length > 0) {
      res.status(400).json({ success: false, error: `Parâmetro inválido: ${invalidos.join(', ')}.` });
      return;
    }

    const supabase = getSupabaseUserClient(token as string);

    // O resto do universo (motivo, lote de recurso enviado) é da regra pura.
    const linhas: LinhaCalendario[] = [];
    let erroLeitura: string | undefined;
    for (let de = 0; ; de += PAGINA_LEITURA) {
      let consulta = supabase
        .from('glosa_recurso_requisicoes_lista')
        .select(COLUNAS)
        .eq('status_aplis', STATUS_GLOSA.glosadoSemRecurso)
        .gt('glosa_fixada', 0);
      if (fontePagadoraId !== undefined) consulta = consulta.eq('id_fonte_pagadora', fontePagadoraId);
      const { data, error } = await consulta.order('id_requisicao').range(de, de + PAGINA_LEITURA - 1);
      if (error) {
        erroLeitura = error.message;
        break;
      }
      const pagina = (data ?? []) as unknown as LinhaCalendario[];
      linhas.push(...pagina);
      if (pagina.length < PAGINA_LEITURA) break;
    }

    const fontes = [...new Set(linhas.map((l) => l.id_fonte_pagadora).filter((f): f is number => f !== null))];
    const { data: regrasFontes, error: erroRegras } = erroLeitura || fontes.length === 0
      ? { data: [], error: null }
      : await supabase
        .from('glosa_prazo_regra_fontes')
        .select('id_fonte_pagadora, glosa_prazo_regras(glosa_recurso_tipo, glosa_recurso_n)')
        .in('id_fonte_pagadora', fontes);

    erroLeitura ??= erroRegras?.message;
    if (erroLeitura) {
      console.error('[faturamento/glosas-recursos-calendario] Supabase:', erroLeitura);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler o calendário de recursos agora — tente novamente em alguns minutos.',
      });
      return;
    }

    const regraPorFonte = new Map<number, RegraPrazo>();
    for (const f of (regrasFontes ?? []) as unknown as LinhaRegraFonte[]) {
      const r = f.glosa_prazo_regras;
      if (r) regraPorFonte.set(f.id_fonte_pagadora, { tipo: r.glosa_recurso_tipo, n: r.glosa_recurso_n });
    }

    const calendario = calendarioDeRecursos(linhas.map(daLinha), regraPorFonte, mes, hojeEmSaoPaulo());

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      mes,
      hoje: calendario.datas.hoje,
      amanha: calendario.datas.amanha,
      itens: calendario.mes.map(itemDaResposta),
      paineis: {
        hoje: calendario.paineis.hoje.map(itemDaResposta),
        amanha: calendario.paineis.amanha.map(itemDaResposta),
        atrasados: calendario.paineis.atrasados.map(itemDaResposta),
      },
      semPrazo: calendario.semPrazo.map(semPrazoDaResposta),
    });
  } catch (err) {
    console.error('[faturamento/glosas-recursos-calendario] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
