/**
 * API Route: POST /api/faturamento/titulo-criar
 *
 * Agrupa lotes do apLIS num título a receber. É a única escrita de contas a
 * receber que passa por rota serverless: ela precisa LER o MySQL do laboratório
 * (que o navegador não alcança) para congelar o snapshot de lotes e guias.
 * Baixas e glosas vão direto do cliente para as RPCs, protegidas por RLS.
 *
 * Autorização: `Authorization: Bearer <access_token>` da sessão, exigindo
 * canManageBilling.
 *
 * A gravação roda como o USUÁRIO (getSupabaseUserClient), não como service_role:
 * `fat_criar_titulo` grava `notas.criado_por = auth.uid()` e revalida a permissão
 * no banco. Com o cliente admin, auth.uid() seria NULL e a RPC recusaria.
 *
 * Body:
 *   idsLote         number[]  obrigatório — IdLote no apLIS
 *   numeroNota      string    obrigatório
 *   dataEmissao     YYYY-MM-DD (default: hoje)
 *   competencia     "YYYY-MM"
 *   dataVencimento  YYYY-MM-DD — quando omitido, é resolvido aqui (ver abaixo)
 *   observacoes     string
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { detalharVariosLotes, listarLotes, MAX_TAMANHO } from '../faturamento/bdLab.js';
import type { LoteFaturamento, RequisicaoLote } from '../faturamento/bdLab.js';
import { getSupabaseAdminClient, getSupabaseUserClient } from '../supabase.js';

const DATA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const COMPETENCIA_RE = /^\d{4}-\d{2}$/;
/** Teto de lotes por título: o snapshot é síncrono e cada lote traz suas guias. */
const MAX_LOTES = 50;

const FORMATO_DATA_LOCAL = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** "Hoje" em America/Sao_Paulo, não no fuso do processo (UTC na Vercel). */
function hojeIsoLocal(): string {
  return FORMATO_DATA_LOCAL.format(new Date());
}

interface CorpoTitulo {
  idsLote?: unknown;
  numeroNota?: unknown;
  dataEmissao?: unknown;
  competencia?: unknown;
  dataVencimento?: unknown;
  observacoes?: unknown;
}

function texto(bruto: unknown): string | undefined {
  return typeof bruto === 'string' && bruto.trim() !== '' ? bruto.trim() : undefined;
}

/**
 * A data que a operadora vê no boleto, quando o lote já virou nota fiscal.
 * Com RPS em datas diferentes, vence a MAIS PRÓXIMA — para cobrança, é a
 * escolha conservadora (a mais tardia deixaria o título entrar em atraso
 * depois do que qualquer um dos RPS realmente vence).
 */
function vencimentoDoRps(lotes: LoteFaturamento[]): string | null {
  const datas = lotes.map((l) => l.dtaVencimento).filter((d): d is string => Boolean(d)).sort();
  return datas.length > 0 ? datas[0] : null;
}

/** Envio mais recente do grupo: é quando a cobrança inteira chegou à operadora. */
function ultimoEnvio(lotes: LoteFaturamento[]): string | null {
  const datas = lotes.map((l) => l.dtaEnvio).filter((d): d is string => Boolean(d)).sort();
  return datas.length > 0 ? datas[datas.length - 1] : null;
}

function montarRequisicoes(requisicoes: RequisicaoLote[]): Record<string, unknown>[] {
  return requisicoes.map((req) => {
    // O primeiro procedimento representa a guia na listagem; o detalhe completo
    // continua no apLIS. `numeroGuia` cai para o código da requisição porque a
    // coluna é NOT NULL e nem toda requisição tem guia de convênio.
    const proc = req.procedimentos[0];
    return {
      aplisId: String(req.idRequisicao),
      numeroGuia: req.numGuiaConvenio ?? proc?.numGuia ?? req.codRequisicao ?? 'sem-guia',
      dataCriacao: req.dtaSolicitacao,
      dataExecucao: req.dtaFinalizacao,
      valor: req.valor,
      pacienteNome: req.paciente,
      procedimentoCodigo: proc?.codigo ?? null,
      procedimentoDescricao:
        req.procedimentos.length > 1
          ? `${req.procedimentos.length} procedimentos`
          : proc?.descricao ?? null,
    };
  });
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

    const corpo = (req.body ?? {}) as CorpoTitulo;

    const idsBrutos = Array.isArray(corpo.idsLote) ? corpo.idsLote : [];
    const idsLote = [...new Set(idsBrutos.map((n) => Number(n)))].filter(
      (n) => Number.isInteger(n) && n > 0,
    );
    const numeroNota = texto(corpo.numeroNota);
    const dataEmissao = texto(corpo.dataEmissao);
    const competencia = texto(corpo.competencia);
    const dataVencimento = texto(corpo.dataVencimento);

    const erros = [
      idsLote.length === 0 ? 'idsLote (ao menos um lote válido)' : null,
      idsLote.length > MAX_LOTES ? `idsLote (máximo ${MAX_LOTES})` : null,
      !numeroNota ? 'numeroNota' : null,
      dataEmissao && !DATA_ISO_RE.test(dataEmissao) ? 'dataEmissao (YYYY-MM-DD)' : null,
      dataVencimento && !DATA_ISO_RE.test(dataVencimento) ? 'dataVencimento (YYYY-MM-DD)' : null,
      competencia && !COMPETENCIA_RE.test(competencia) ? 'competencia (YYYY-MM)' : null,
    ].filter((c): c is string => c !== null);
    if (erros.length > 0) {
      res.status(400).json({ success: false, error: `Parâmetro inválido: ${erros.join(', ')}.` });
      return;
    }

    // ── Snapshot: cabeçalhos e guias, duas consultas ao MySQL ──────────────────
    // ignorarCache: o snapshot do título tem que ser o estado do banco agora — o
    // cache de 3min do bdLab é para a listagem da aba Faturas, não para o que vai
    // virar valor_total e as guardas de "mesma fonte pagadora"/"lote sem valor".
    const resultado = await listarLotes({
      idsLote,
      pagina: 1,
      tamanho: MAX_TAMANHO,
      ignorarCache: true,
    });
    if ('erro' in resultado) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    const encontrados = new Set(resultado.lotes.map((l) => l.idLote));
    const ausentes = idsLote.filter((id) => !encontrados.has(id));
    if (ausentes.length > 0) {
      res.status(404).json({
        success: false,
        error: `Lote(s) não encontrado(s) no apLIS: ${ausentes.join(', ')}.`,
      });
      return;
    }

    // Um lote sem valor não gera cobrança e só sujaria o título com uma linha de
    // R$ 0 — provavelmente o operador selecionou a linha errada.
    const vazios = resultado.lotes.filter((l) => l.valor <= 0).map((l) => l.idLote);
    if (vazios.length > 0) {
      res.status(400).json({
        success: false,
        error: `Lote(s) sem valor a faturar: ${vazios.join(', ')}.`,
      });
      return;
    }

    // Um título é cobrado de UMA operadora: misturar fontes pagadoras produziria
    // uma nota que ninguém consegue cobrar.
    const fontes = new Set(resultado.lotes.map((l) => l.fontePagadora.id ?? 0));
    if (fontes.size > 1) {
      res.status(400).json({
        success: false,
        error: 'Todos os lotes do título precisam ser da mesma fonte pagadora.',
      });
      return;
    }

    const fonte = resultado.lotes[0].fontePagadora;
    const aplisOperadora = fonte.id !== null ? String(fonte.id) : null;
    if (!aplisOperadora) {
      res.status(400).json({
        success: false,
        error: 'Lote sem fonte pagadora no apLIS; não é possível criar o título.',
      });
      return;
    }

    const detalhe = await detalharVariosLotes(idsLote);
    if ('erro' in detalhe) {
      res.status(detalhe.erro.status).json({ success: false, error: detalhe.erro.mensagem });
      return;
    }

    // ── Vencimento ────────────────────────────────────────────────────────────
    // Na ordem que o financeiro usa:
    //   1. o vencimento do RPS, quando o lote virou nota fiscal;
    //   2. senão, o último envio resolvido pela regra contratual da operadora
    //      (fat_prever_vencimento — "dia 20 do mês subsequente", "20º dia útil"
    //      etc.; a conta mora no banco para não haver duas implementações);
    //   3. senão, nada: o título nasce sem vencimento e fica fora do aging até
    //      alguém preencher. Chutar uma data inventaria atraso que não existe.
    let vencimento = dataVencimento ?? vencimentoDoRps(resultado.lotes);
    const envio = vencimento ? null : ultimoEnvio(resultado.lotes);
    if (envio) {
      // Com o cliente admin: a operadora pode não existir ainda (primeiro título
      // dela), e neste ponto ainda não há nada para o RLS ver. A RPC cai no
      // catálogo de regras pelo nome quando não acha a operadora.
      const { data: previsto, error: erroPrevisao } = await getSupabaseAdminClient()
        .rpc('fat_prever_vencimento', {
          p_aplis_id: aplisOperadora,
          p_nome: fonte.nome ?? fonte.razaoSocial ?? null,
          p_base: envio,
        });
      if (erroPrevisao) {
        // Um título sem vencimento é recuperável (o financeiro edita); recusar a
        // criação por causa da previsão não é.
        console.error('[faturamento/titulo-criar] previsão:', erroPrevisao.message);
      }
      vencimento = (previsto as string | null) ?? null;
    }

    // ── Gravação ──────────────────────────────────────────────────────────────
    const payload = {
      operadora: {
        aplisId: aplisOperadora,
        nome: fonte.nome ?? fonte.razaoSocial,
        cnpj: fonte.cpfCnpj,
      },
      numeroNota,
      dataEmissao: dataEmissao ?? hojeIsoLocal(),
      dataVencimento: vencimento,
      competencia: competencia ?? null,
      observacoes: texto(corpo.observacoes) ?? null,
      lotes: resultado.lotes.map((lote) => ({
        aplisId: String(lote.idLote),
        codigoLote: String(lote.idLote),
        statusAplis: lote.status,
        statusLabel: lote.statusLabel,
        dataCriacao: lote.dtaCriacao,
        dataEnvio: lote.dtaEnvio,
        protocolo: lote.protocolo,
        nfeNumero: lote.nfeNumero,
        numeroRps: lote.numeroRPS,
        dataVencimentoRps: lote.dtaVencimento,
        valorTotal: lote.valor,
        qtdRequisicoes: lote.qtdRequisicoes,
        requisicoes: montarRequisicoes(detalhe.porLote[lote.idLote] ?? []),
      })),
    };

    const { data: notaId, error } = await getSupabaseUserClient(token as string)
      .rpc('fat_criar_titulo', { p: payload });

    if (error) {
      // A RPC recusa lote já faturado e permissão insuficiente com mensagens
      // prontas para a tela; repassar como 400 evita transformá-las em 500.
      console.error('[faturamento/titulo-criar] rpc:', error.message);
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    // Arredondado em centavos: soma de float pode sair como 8137.099999999999
    // enquanto o banco (DECIMAL) gravou 8137.10.
    const valorTotal = Math.round(resultado.lotes.reduce((soma, l) => soma + l.valor, 0) * 100) / 100;

    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({
      success: true,
      notaId,
      valorTotal,
      dataVencimento: vencimento,
    });
  } catch (err) {
    console.error('[faturamento/titulo-criar] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
