/**
 * Rota: GET /api/requisicoes
 *
 * Combina requisicaoListar + requisicaoResultado do apLIS:
 * para cada item da listagem, busca o resultado completo e retorna mesclado.
 */

const config = require('../../config');

const PARAMS_LISTAR = [
  'tipoData', 'periodoIni', 'periodoFim',
  'codRequisicao', 'numGuia', 'idPaciente', 'nomPaciente',
  'idMedico', 'idUnidade', 'idLaboratorio', 'idFontePagadora',
  'idLocalOrigem', 'idConvenio', 'idExame', 'idEvento',
  'idResponsavel', 'ordenar', 'pagina', 'tamanho'
];

const PARAMS_NUMERICOS = [
  'idPaciente', 'idMedico', 'idUnidade', 'idLaboratorio',
  'idFontePagadora', 'idLocalOrigem', 'idConvenio', 'idExame',
  'idEvento', 'idResponsavel', 'pagina', 'tamanho', 'tipoData'
];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executa fn para cada item com no máximo `concurrency` chamadas simultâneas.
 * Retorna array no mesmo formato do Promise.allSettled.
 */
async function withConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: 'fulfilled', value: await fn(items[i]) };
      } catch (err) {
        results[i] = { status: 'rejected', reason: err };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

module.exports = function (aplisClient) {
  const { Router } = require('express');
  const router = Router();

  router.get('/requisicoes', async (req, res, next) => {
    try {
      // Validação dos params obrigatórios
      const missing = ['tipoData', 'periodoIni', 'periodoFim'].filter(p => !req.query[p]);
      if (missing.length > 0) {
        return res.status(400).json({
          error: 'Parâmetros obrigatórios ausentes',
          requiredParams: ['tipoData', 'periodoIni', 'periodoFim'],
          missing
        });
      }

      // Montar dat apenas com params da whitelist
      const dat = {};
      for (const param of PARAMS_LISTAR) {
        if (req.query[param] !== undefined) {
          dat[param] = PARAMS_NUMERICOS.includes(param)
            ? parseInt(req.query[param], 10)
            : req.query[param];
        }
      }

      const incluirResultado = req.query.incluirResultado !== 'false';
      const paginaEspecifica = dat.pagina !== undefined;

      // 1. Chamar requisicaoListar (primeira página ou página específica)
      const primeiraResp = await aplisClient.requisicaoListar({ ...dat, pagina: dat.pagina ?? 1 });
      const qtdPaginas = primeiraResp?.qtdPaginas ?? 1;
      const registros = primeiraResp?.registros ?? 0;
      let lista = primeiraResp?.lista ?? [];

      // 2. Se não foi pedida página específica, buscar as demais páginas
      if (!paginaEspecifica && qtdPaginas > 1) {
        const paginas = Array.from({ length: qtdPaginas - 1 }, (_, i) => i + 2);
        for (const pagina of paginas) {
          await delay(config.sync.requestDelay);
          const resp = await aplisClient.requisicaoListar({ ...dat, pagina });
          lista = lista.concat(resp?.lista ?? []);
        }
      }

      const meta = {
        qtdPaginas: paginaEspecifica ? qtdPaginas : 1,
        registros,
        pagina: paginaEspecifica ? dat.pagina : 1,
        tamanho: lista.length,
        periodoIni: dat.periodoIni,
        periodoFim: dat.periodoFim,
        tipoData: dat.tipoData
      };

      // 3. Retornar só a lista se incluirResultado=false
      if (!incluirResultado) {
        return res.json({ meta, data: lista });
      }

      // 3. Buscar resultado completo com pool de concorrência limitada
      console.log(`[API] Buscando resultados de ${lista.length} requisições (concorrência: ${config.aplis.concurrency})...`);

      const resultados = await withConcurrency(
        lista,
        config.aplis.concurrency,
        item => aplisClient.requisicaoResultado(item.CodRequisicao)
      );

      const enriched = lista.map((item, i) => {
        const resultado = resultados[i];
        if (resultado.status === 'fulfilled') {
          return { ...item, resultado: resultado.value };
        }
        return { ...item, resultado: null, _resultadoError: resultado.reason?.message ?? 'Erro desconhecido' };
      });

      return res.json({ meta, data: enriched });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
