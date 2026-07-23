// api/_lib/apoio/bdLab.ts
// Consulta ao banco MySQL do laboratório ("BD Lab" — backup do apLIS, exposto
// via túnel). Fonte extra de conferência: a API apLIS nem sempre traz todos os
// dados que existem no banco. Port de _db_conectar/_db_buscar_exames do legado.
//
// A etapa é opcional e tolerante a falha: sem DB_HOST/DB_USER configurados ela
// é pulada, e erro de conexão/consulta nunca derruba o pipeline (o chamador
// registra o erro em etapas.bd_lab e segue).

import mysql from 'mysql2/promise';
import type { PipelineLog } from './log.js';

export interface ExameBd {
  procedimento: string;
  codigo: string;
  id_requisicao: string;
  _raw?: Record<string, string>;
}

export function bdLabConfigurado(): boolean {
  return Boolean(process.env.DB_HOST?.trim() && process.env.DB_USER?.trim());
}

async function conectar(): Promise<mysql.Connection> {
  const host = (process.env.DB_HOST ?? '').trim();
  const user = (process.env.DB_USER ?? '').trim();
  if (!host || !user) throw new Error('DB_HOST e DB_USER devem estar configurados');
  return mysql.createConnection({
    host,
    port: Number((process.env.DB_PORT ?? '3306').trim()),
    user,
    password: (process.env.DB_PASSWORD ?? '').trim(),
    database: (process.env.DB_NAME ?? 'lab').trim(),
    charset: 'utf8mb4',
    // Túnel pode estar fora do ar — falha rápido para não estourar o maxDuration.
    connectTimeout: 8_000,
  });
}

/**
 * Busca os exames da requisição no banco do lab:
 *   1. requisicao WHERE CodRequisicao = <cod> → IdRequisicao
 *   2. fatrequisicaoautorizacao WHERE IdRequisicao = <id> → CodProcedimento
 *   3. fattabelaprocedimento WHERE Codigo IN (...) → nome do exame
 */
export async function buscarExamesBd(codRequisicao: string, log: PipelineLog): Promise<ExameBd[]> {
  const conn = await conectar();
  try {
    log.info(`BD Lab: buscando CodRequisicao=${codRequisicao} em lab.requisicao`);
    const [reqs] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM requisicao WHERE CodRequisicao = ? LIMIT 1',
      [codRequisicao],
    );
    if (reqs.length === 0) {
      log.warn(`BD Lab: requisição '${codRequisicao}' não encontrada em lab.requisicao`);
      return [];
    }

    const idReq = String(reqs[0].IdRequisicao);
    log.ok(`BD Lab: IdRequisicao=${idReq} para CodRequisicao=${codRequisicao}`);

    const [autorizacoes] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT CodProcedimento FROM fatrequisicaoautorizacao WHERE IdRequisicao = ?',
      [idReq],
    );
    const codigos = autorizacoes
      .map((a) => a.CodProcedimento)
      .filter((c): c is string | number => c != null && c !== '');
    if (codigos.length === 0) {
      log.warn(`BD Lab: nenhum procedimento em fatrequisicaoautorizacao para IdRequisicao=${idReq}`);
      return [];
    }
    log.info(`BD Lab: ${codigos.length} CodProcedimento(s)`);

    // Consulta única com IN (muito mais rápido que N queries individuais)
    const placeholders = codigos.map(() => '?').join(',');
    const [procs] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT * FROM fattabelaprocedimento WHERE Codigo IN (${placeholders})`,
      codigos,
    );
    const procPorCodigo = new Map(procs.map((p) => [String(p.Codigo), p]));

    const resultados: ExameBd[] = codigos.map((cod) => {
      const proc = procPorCodigo.get(String(cod));
      if (!proc) {
        return { procedimento: `(sem descrição — código ${cod})`, codigo: String(cod), id_requisicao: idReq };
      }
      return {
        procedimento: String(proc.Procedimento ?? proc.Descricao ?? ''),
        codigo: String(cod),
        id_requisicao: idReq,
        _raw: Object.fromEntries(Object.entries(proc).map(([k, v]) => [k, String(v)])),
      };
    });

    log.ok(`BD Lab: ${resultados.length} exame(s) encontrados para IdRequisicao=${idReq}`);
    return resultados;
  } finally {
    await conn.end().catch(() => undefined);
  }
}
