#!/usr/bin/env -S npx tsx
// supabase/scripts/acerto-lotes-cadastro-pelo-aplis.ts
//
// Gera a migration que alinha ao apLIS o cadastro dos lotes e dos títulos
// (levantamento de 20/10/2026, .scratch/faturamento-acerto-titulos-aplis/inconsistencias-20-10.md):
//   - lotes: status_aplis/status, NF (nfe_numero, numero_rps), protocolo e
//     quantidade de requisições, só onde difere. NF e protocolo vazios no apLIS
//     não apagam os do sistema;
//   - títulos com a NF reemitida no apLIS: numero_nota = NF atual do lote.
//     Título com mais de uma NF ("8035, 8034") fica de fora — o lote pode ter
//     sido faturado em duas notas;
//   - valor do título e do lote que mudou no apLIS depois da criação, só em
//     título sem glosa digitada à mão (as do apLIS e as da planilha já foram
//     acertadas em 20261020120100).
//
// Somente LEITURA: lê o Supabase (service role) e o MySQL de backup do apLIS e
// escreve a migration. Mesmas variáveis de ambiente de
// acerto-titulos-planilha-pelo-aplis.ts.
//
// Uso:
//   npx tsx supabase/scripts/acerto-lotes-cadastro-pelo-aplis.ts <migration.sql>

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import mysql from 'mysql2/promise';
import { getSupabaseAdminClient } from '../../api/_lib/supabase.js';
import { STLOT_LABELS } from '../../api/_lib/faturamento/bdLab.js';
import { centavos } from '../../api/_lib/faturamento/conferenciaAplis.js';

const [arquivoSql] = process.argv.slice(2);
if (!arquivoSql) {
  console.error('Uso: acerto-lotes-cadastro-pelo-aplis.ts <migration.sql>');
  process.exit(2);
}

interface Lote {
  id_lote: string; aplis_id: string | null; status: string; status_aplis: number | null; protocolo: string | null;
  nfe_numero: string | null; numero_rps: number | null; qtd_requisicoes: number | null; valor_total: number;
}
interface Nota { id_nota: string; numero_nota: string | null; status: string; valor_total: number }
interface Glosa { nota_id: string; origem: string | null }

const sb = getSupabaseAdminClient();

async function todas<T>(tabela: string, colunas: string): Promise<T[]> {
  const linhas: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.from(tabela).select(colunas).order('created_at').range(offset, offset + 999);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    linhas.push(...(data as T[]));
    if (data.length < 1000) return linhas;
  }
}

interface LoteAplis { status: number; protocolo: string | null; nfe: string | null; rps: string | null; reqs: number; liquido: number }

async function lotesDoAplis(ids: number[]): Promise<Map<number, LoteAplis>> {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 3306), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME ?? 'lab',
  });
  try {
    const [linhas] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT l.IdLote, l.Status, NULLIF(TRIM(l.Protocolo), '') AS Protocolo,
              NULLIF(TRIM(rps.NFeNumero), '') AS NFe, rps.NumeroRPS,
              (SELECT COUNT(*) FROM requisicao r WHERE r.Lote = l.IdLote) AS Reqs,
              (SELECT SUM(p.ValorLiquido) FROM requisicao r
                 JOIN fatrequisicaoprocedimento p ON p.IdRequisicao = r.IdRequisicao
                WHERE r.Lote = l.IdLote) AS Liquido
         FROM fatlote l LEFT JOIN fatrps rps ON rps.IdRPS = l.IdRPS
        WHERE l.IdLote IN (?)`, [ids]);
    return new Map(linhas.map((l) => [Number(l.IdLote), {
      status: Number(l.Status), protocolo: l.Protocolo, nfe: l.NFe,
      rps: l.NumeroRPS === null ? null : String(l.NumeroRPS), reqs: Number(l.Reqs), liquido: Number(l.Liquido ?? 0),
    }]));
  } finally {
    await conn.end();
  }
}

const sqlTexto = (v: string | null) => (v === null ? 'NULL' : `'${v.replace(/'/g, "''")}'`);

async function main() {
  const lotes = await todas<Lote>('lotes', 'id_lote, aplis_id, status, status_aplis, protocolo, nfe_numero, numero_rps, qtd_requisicoes, valor_total, created_at');
  const notas = new Map((await todas<Nota>('notas', 'id_nota, numero_nota, status, valor_total, created_at')).map((n) => [n.id_nota, n]));
  const vinculos = await todas<{ id_nota: string; id_lote: string }>('nota_lote', 'id_nota, id_lote, created_at');
  const glosas = await todas<Glosa>('glosas', 'nota_id, origem, created_at');
  const comGlosaManual = new Set(glosas.filter((g) => g.origem === null).map((g) => g.nota_id));

  const doAplis = lotes.filter((l) => Number(l.aplis_id) > 0);
  const aplis = await lotesDoAplis(doAplis.map((l) => Number(l.aplis_id)));

  const linhasLote: string[] = [];
  const linhasNota: string[] = [];
  const valores: string[] = [];
  const conta = { status: 0, nfe: 0, rps: 0, protocolo: 0, reqs: 0, notaNumero: 0, valor: 0 };
  const foraNumero: string[] = [];

  for (const l of doAplis) {
    const a = aplis.get(Number(l.aplis_id));
    if (!a) continue;
    const label = STLOT_LABELS[a.status] ?? `Status ${a.status}`;
    const novo = {
      status_aplis: l.status_aplis === a.status ? null : a.status,
      status: l.status === label ? null : label,
      nfe: a.nfe && a.nfe !== l.nfe_numero ? a.nfe : null,
      rps: a.rps && a.rps !== String(l.numero_rps ?? '') ? a.rps : null,
      protocolo: a.protocolo && a.protocolo !== l.protocolo ? a.protocolo : null,
      reqs: l.qtd_requisicoes !== null && Number(l.qtd_requisicoes) !== a.reqs ? a.reqs : null,
    };
    if (novo.status_aplis !== null || novo.status !== null) conta.status++;
    if (novo.nfe) conta.nfe++;
    if (novo.rps) conta.rps++;
    if (novo.protocolo) conta.protocolo++;
    if (novo.reqs !== null) conta.reqs++;
    if (Object.values(novo).some((v) => v !== null)) {
      linhasLote.push(`  /* ${l.aplis_id} */ (${sqlTexto(l.id_lote)}::uuid, ${novo.status_aplis ?? 'NULL'}, ${sqlTexto(novo.status)}, ${sqlTexto(novo.nfe)}, `
        + `${novo.rps ?? 'NULL'}, ${sqlTexto(novo.protocolo)}, ${novo.reqs ?? 'NULL'})`);
    }

    const ativas = vinculos.filter((v) => v.id_lote === l.id_lote).map((v) => notas.get(v.id_nota)!)
      .filter((n) => n && n.status !== 'cancelada');
    if (ativas.length !== 1) continue;
    const nota = ativas[0];
    const lotesDaNota = vinculos.filter((v) => v.id_nota === nota.id_nota);

    if (a.nfe && nota.numero_nota !== a.nfe) {
      if (nota.numero_nota?.includes(',')) {
        foraNumero.push(`-- lote ${l.aplis_id}: título "${nota.numero_nota}" × NF ${a.nfe} no apLIS`);
      } else {
        conta.notaNumero++;
        linhasNota.push(`UPDATE notas SET numero_nota = ${sqlTexto(a.nfe)} WHERE id_nota = ${sqlTexto(nota.id_nota)}`
          + ` AND numero_nota IS NOT DISTINCT FROM ${sqlTexto(nota.numero_nota)}; -- lote ${l.aplis_id}`);
      }
    }
    // Valor: só título de um lote só e sem glosa digitada à mão.
    const novoValor = centavos(a.liquido);
    if (lotesDaNota.length === 1 && !comGlosaManual.has(nota.id_nota)
      && Math.abs(novoValor - centavos(Number(nota.valor_total))) >= 1) {
      conta.valor++;
      const v = (novoValor / 100).toFixed(2);
      linhasNota.push(`UPDATE lotes SET valor_total = ${v} WHERE id_lote = ${sqlTexto(l.id_lote)}; -- lote ${l.aplis_id}`,
        `UPDATE notas SET valor_total = ${v} WHERE id_nota = ${sqlTexto(nota.id_nota)};`,
        `SELECT fat_recalcular_nota(${sqlTexto(nota.id_nota)});`);
      valores.push(`(${sqlTexto(nota.id_nota)}::uuid, ${v})`);
    }
  }

  const sql = `-- ============================================================================
-- Contas a Receber: cadastro dos lotes e dos títulos alinhado ao apLIS (20/10/2026)
--
-- Gerada por supabase/scripts/acerto-lotes-cadastro-pelo-aplis.ts com o Supabase
-- de produção e o apLIS (backup MySQL) lidos em 20/10/2026, depois do acerto
-- 20261020120100. Levantamento em
-- .scratch/faturamento-acerto-titulos-aplis/inconsistencias-20-10.md.
--
-- 1) Lotes, só onde difere (NF e protocolo vazios no apLIS não apagam):
--    status ${conta.status}, NF ${conta.nfe}, RPS ${conta.rps}, protocolo ${conta.protocolo}, requisições ${conta.reqs}.
-- 2) Títulos com a NF reemitida no apLIS: ${conta.notaNumero} (numero_nota = NF atual).
--    Títulos com mais de uma NF ficam de fora:
${foraNumero.join('\n') || '--    (nenhum)'}
-- 3) Valor do título/lote que mudou no apLIS depois da criação: ${conta.valor}.
--
-- Ids de produção. Tudo numa transação.
-- ============================================================================

BEGIN;

${linhasLote.length ? `-- Valores do apLIS por lote; coluna nula = não muda. Sem tabela temporária: o
-- SQL Editor do Supabase não mantém uma tabela ON COMMIT DROP entre comandos.
UPDATE lotes l
   SET status_aplis    = COALESCE(a.status_aplis::smallint, l.status_aplis),
       status          = COALESCE(a.status::text, l.status),
       nfe_numero      = COALESCE(a.nfe_numero::text, l.nfe_numero),
       numero_rps      = COALESCE(a.numero_rps::integer, l.numero_rps),
       protocolo       = COALESCE(a.protocolo::text, l.protocolo),
       qtd_requisicoes = COALESCE(a.qtd_requisicoes::integer, l.qtd_requisicoes)
  FROM (VALUES
${linhasLote.join(',\n')}
  ) AS a(id_lote, status_aplis, status, nfe_numero, numero_rps, protocolo, qtd_requisicoes)
 WHERE a.id_lote = l.id_lote;
` : '-- Nenhum lote a alinhar.\n'}
${linhasNota.join('\n')}
${valores.length ? `
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM (VALUES ${valores.join(', ')}) AS e(id, valor)
              JOIN notas n ON n.id_nota = e.id WHERE n.valor_total <> e.valor) THEN
    RAISE EXCEPTION 'Acerto do cadastro: valor do título fora do esperado.';
  END IF;
END $$;
` : ''}
COMMIT;
`;
  writeFileSync(arquivoSql, sql);
  console.log({ lotes: linhasLote.length, ...conta, foraNumero: foraNumero.length });
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
