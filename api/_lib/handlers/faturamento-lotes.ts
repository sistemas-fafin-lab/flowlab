/**
 * API Route: GET /api/faturamento/lotes
 *
 * Devolve à aba Faturamento → Faturas os lotes de faturamento lidos do MySQL de backup
 * do laboratório (nada é persistido no Supabase). O detalhe de cada lote — requisições
 * e seus procedimentos — sai em GET /api/faturamento/lote-detalhe.
 *
 * A fonte era a API do apLIS (`faturamentoLoteListar`); mudou para o banco porque a API
 * não expõe nenhum identificador de requisição dentro do lote. Ver a nota de
 * equivalência de valores em api/_lib/faturamento/bdLab.ts.
 *
 * Autorização: header `Authorization: Bearer <access_token>` da SESSÃO do operador
 * (exige canViewBilling) — como em api/analises-clinicas/get-documentos.ts.
 *
 * Query params:
 *   periodoIni, periodoFim  YYYY-MM-DD — obrigatórios, salvo quando vem idLote
 *   idLote                  consulta um lote específico
 *   statusLote              código STLOT (1..8)
 *   pagina                  default 1
 *   tamanho                 1..200, default 50
 *
 * Variáveis de ambiente: DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
 *   + SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para validar a sessão.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { listarLotes, MAX_BUSCA, MAX_TAMANHO, TAMANHO_PADRAO } from '../faturamento/bdLab.js';
import type { LoteFaturamento } from '../faturamento/bdLab.js';
import { getSupabaseAdminClient } from '../supabase.js';

const DATA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Lote da resposta, acrescido do título de contas a receber que já o cobra. */
interface LoteComTitulo extends LoteFaturamento {
  tituloId: string | null;
  tituloNumero: string | null;
}

/**
 * Anota em cada lote o título que já o cobra, consultando o Supabase.
 *
 * Roda FORA do bloco cacheado do bdLab de propósito: o cache guarda o retrato do
 * MySQL, que muda uma vez por dia, enquanto o vínculo com o título muda no
 * instante em que alguém cria um. Se o enriquecimento entrasse no cache, um lote
 * recém-faturado continuaria aparecendo como disponível por até 3 minutos — e o
 * operador tentaria faturá-lo de novo.
 *
 * Título cancelado não conta: o lote volta a estar disponível.
 *
 * Falha aqui não derruba a listagem — a aba Faturas funciona sem essa coluna, e
 * a duplicidade real continua barrada pela RPC.
 */
async function anotarTitulos(lotes: LoteFaturamento[]): Promise<LoteComTitulo[]> {
  const semTitulo = (lote: LoteFaturamento): LoteComTitulo =>
    ({ ...lote, tituloId: null, tituloNumero: null });

  if (lotes.length === 0) return [];

  try {
    const supabase = getSupabaseAdminClient();
    const aplisIds = lotes.map((l) => String(l.idLote));

    const { data: linhasLote, error: erroLote } = await supabase
      .from('lotes')
      .select('id_lote, aplis_id')
      .in('aplis_id', aplisIds);
    if (erroLote || !linhasLote || linhasLote.length === 0) return lotes.map(semTitulo);

    const aplisPorId = new Map<string, string>();
    for (const linha of linhasLote) aplisPorId.set(linha.id_lote as string, linha.aplis_id as string);

    const { data: vinculos, error: erroVinculo } = await supabase
      .from('nota_lote')
      .select('id_lote, notas(id_nota, numero_nota, status)')
      .in('id_lote', [...aplisPorId.keys()]);
    if (erroVinculo || !vinculos) return lotes.map(semTitulo);

    const tituloPorAplis = new Map<string, { id: string; numero: string }>();
    for (const vinculo of vinculos) {
      const nota = vinculo.notas as unknown as
        { id_nota: string; numero_nota: string; status: string } | null;
      if (!nota || nota.status === 'cancelada') continue;
      const aplis = aplisPorId.get(vinculo.id_lote as string);
      if (aplis) tituloPorAplis.set(aplis, { id: nota.id_nota, numero: nota.numero_nota });
    }

    return lotes.map((lote) => {
      const titulo = tituloPorAplis.get(String(lote.idLote));
      return titulo
        ? { ...lote, tituloId: titulo.id, tituloNumero: titulo.numero }
        : semTitulo(lote);
    });
  } catch (err) {
    console.error('[faturamento/lotes] enriquecimento de títulos:', describeError(err));
    return lotes.map(semTitulo);
  }
}

function primeiro(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

/** Inteiro dentro de [min, max]; undefined quando ausente, null quando inválido. */
function inteiroNaFaixa(
  bruto: string | undefined,
  min: number,
  max: number,
): number | null | undefined {
  if (bruto === undefined || bruto.trim() === '') return undefined;
  const n = Number(bruto);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  try {
    const erroAuth = await autorizarFaturamento(tokenDoHeader(req.headers.authorization));
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    // Whitelist explícita: nada da query do cliente entra na consulta sem coerção.
    const q = req.query as Record<string, string | string[] | undefined>;
    const periodoIni = primeiro(q.periodoIni)?.trim();
    const periodoFim = primeiro(q.periodoFim)?.trim();

    const idLote = inteiroNaFaixa(primeiro(q.idLote), 1, Number.MAX_SAFE_INTEGER);
    const statusLote = inteiroNaFaixa(primeiro(q.statusLote), 1, 8);
    const pagina = inteiroNaFaixa(primeiro(q.pagina), 1, Number.MAX_SAFE_INTEGER);
    const tamanho = inteiroNaFaixa(primeiro(q.tamanho), 1, MAX_TAMANHO);

    const invalidos = [
      idLote === null ? 'idLote' : null,
      statusLote === null ? 'statusLote' : null,
      pagina === null ? 'pagina' : null,
      tamanho === null ? `tamanho (1..${MAX_TAMANHO})` : null,
    ].filter((c): c is string => c !== null);
    if (invalidos.length > 0) {
      res.status(400).json({
        success: false,
        error: `Parâmetro inválido: ${invalidos.join(', ')}.`,
      });
      return;
    }

    // Sem período a consulta varreria a fatlote inteira (6 mil lotes); idLote sozinho
    // também serve, e é como a tela recarrega um lote específico.
    if (idLote === undefined) {
      const faltando = [
        !periodoIni ? 'periodoIni' : null,
        !periodoFim ? 'periodoFim' : null,
      ].filter((c): c is string => c !== null);
      if (faltando.length > 0) {
        res.status(400).json({
          success: false,
          error: 'Informe idLote ou o período completo.',
          missing: faltando,
        });
        return;
      }
      const malFormatadas = [
        !DATA_ISO_RE.test(periodoIni as string) ? 'periodoIni' : null,
        !DATA_ISO_RE.test(periodoFim as string) ? 'periodoFim' : null,
      ].filter((c): c is string => c !== null);
      if (malFormatadas.length > 0) {
        res.status(400).json({
          success: false,
          error: `Data deve estar no formato YYYY-MM-DD: ${malFormatadas.join(', ')}.`,
        });
        return;
      }
    }

    const resultado = await listarLotes({
      periodoIni,
      periodoFim,
      idLote,
      statusLote,
      pagina,
      tamanho: tamanho ?? TAMANHO_PADRAO,
      // Corta em vez de recusar: o operador colando um texto grande no campo de busca
      // não é erro dele, e o termo vira 7 predicados LIKE lá embaixo.
      busca: primeiro(q.busca)?.trim().slice(0, MAX_BUSCA) || undefined,
      ignorarCache: primeiro(q.semCache) === '1',
    });

    if ('erro' in resultado) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    const anotados = await anotarTitulos(resultado.lotes);
    // Filtro do modal de criação de título. Aplicado DEPOIS da paginação, então
    // recorta a página em vez de reduzir o total: `meta.registros`/`qtdPaginas`
    // continuam descrevendo a consulta ao apLIS (o que a aba Faturas mostra), não
    // o que sobrou aqui. `meta.filtrados` expõe quantos itens desta página caíram
    // no filtro, para o modal não anunciar mais lotes utilizáveis do que existem —
    // filtrar antes de paginar exigiria excluir os aplis_id já faturados dentro da
    // própria consulta ao MySQL, o que colide com o cache de 3min do bdLab.
    const somenteSemTitulo = primeiro(q.somenteSemTitulo) === '1';
    const lotes = somenteSemTitulo
      ? anotados.filter((lote) => lote.tituloId === null)
      : anotados;
    const filtrados = anotados.length - lotes.length;

    // Dado financeiro: não deixa ficar em cache de navegador nem de proxy.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      meta: { ...resultado.meta, filtrados: somenteSemTitulo ? filtrados : 0 },
      lotes,
    });
  } catch (err) {
    console.error('[faturamento/lotes] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
