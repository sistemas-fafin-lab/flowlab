#!/usr/bin/env -S npx tsx
// supabase/scripts/pre-vinculo-aplis-assefaz.ts
//
// Gera a migration que pré-preenche o vínculo do catálogo de exames com a
// cobrança do apLIS, pela tabela de preço da ASSEFAZ (IdTabelaPreco = 1) —
// issue 02 de .scratch/controle-custos-vinculo-aplis-tuss. A escolha (que
// cobrança liga a que exame, e por que as outras ficam de fora) é
// escolherVinculosAssefaz, em api/_lib/faturamento/preVinculoAssefaz.ts.
//
// Somente LEITURA: lê o Supabase (service role) e o MySQL de backup do apLIS e
// escreve a migration. Não grava em banco nenhum. Cada UPDATE da migration só
// liga o exame se ele e a cobrança ainda estiverem sem vínculo na hora de
// aplicar: vínculo feito à mão na tela, depois desta leitura, não é sobrescrito.
//
// Lê o catálogo com select('*') para rodar também antes de
// 20261020210000_custo_exames_vinculo_aplis estar aplicada (colunas ausentes =
// sem vínculo); a migration gerada precisa dela aplicada antes.
//
// Variáveis de ambiente:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (leitura do catálogo)
//   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME   (leitura do apLIS)
//
// Uso:
//   npx tsx supabase/scripts/pre-vinculo-aplis-assefaz.ts <migration.sql>

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import mysql from 'mysql2/promise';
import { getSupabaseAdminClient } from '../../api/_lib/supabase.js';
import { escolherVinculosAssefaz } from '../../api/_lib/faturamento/preVinculoAssefaz.js';
import type { ExameCatalogo, LinhaTabelaPreco } from '../../api/_lib/faturamento/preVinculoAssefaz.js';

const [arquivoSql] = process.argv.slice(2);
if (!arquivoSql) {
  console.error('Uso: pre-vinculo-aplis-assefaz.ts <migration.sql>');
  process.exit(2);
}

/** Tabela de preço da ASSEFAZ no apLIS. */
const TABELA_ASSEFAZ = 1;

async function lerCatalogo(): Promise<ExameCatalogo[]> {
  const sb = getSupabaseAdminClient();
  const exames: ExameCatalogo[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.from('custo_exames').select('*').order('created_at').range(offset, offset + 999);
    if (error) throw new Error(`custo_exames: ${error.message}`);
    exames.push(...data.map((e) => ({
      id: e.id, nome: e.nome, tuss: e.tuss,
      aplis_id_exame_tipo: e.aplis_id_exame_tipo ?? null, aplis_id_teste: e.aplis_id_teste ?? null,
    })));
    if (data.length < 1000) return exames;
  }
}

async function lerTabelaAssefaz(): Promise<{ linhas: LinhaTabelaPreco[]; nomes: Map<number, string> }> {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 3306), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME ?? 'lab',
  });
  try {
    const [linhas] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT tp.IdExameTipo, tp.Codigo, et.NomExameTipo
         FROM fattabelaprocedimento tp
         LEFT JOIN fatexametipo et ON et.IdExameTipo = tp.IdExameTipo
        WHERE tp.IdTabelaPreco = ? AND tp.Inativo = 0`, [TABELA_ASSEFAZ]);
    return {
      linhas: linhas.map((l) => ({ IdExameTipo: l.IdExameTipo === null ? null : Number(l.IdExameTipo), Codigo: String(l.Codigo) })),
      nomes: new Map(linhas.filter((l) => l.IdExameTipo !== null).map((l) => [Number(l.IdExameTipo), String(l.NomExameTipo ?? '')])),
    };
  } finally {
    await conn.end();
  }
}

const sqlTexto = (v: string) => `'${v.replace(/'/g, "''")}'`;
const comentario = (v: string) => v.replace(/\s+/g, ' ').replace(/\*\//g, '* /');

async function main() {
  const [exames, { linhas, nomes }] = await Promise.all([lerCatalogo(), lerTabelaAssefaz()]);
  const { vinculos, descartes } = escolherVinculosAssefaz(linhas, exames);
  const cobranca = (id: number) => `${id} ${nomes.get(id) ?? ''}`.trim();

  const ligou = vinculos.map((v) => `--   ${cobranca(v.idExameTipo)} → ${v.tuss} ${comentario(v.exameNome)}`);
  const ficou = descartes.map((d) => `--   ${cobranca(d.idExameTipo)}: ${comentario(d.motivo)}`);
  const updates = vinculos.map((v) => `UPDATE public.custo_exames
   SET aplis_id_exame_tipo = ${v.idExameTipo}
 WHERE id = ${sqlTexto(v.exameId)}
   AND aplis_id_exame_tipo IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.custo_exames WHERE aplis_id_exame_tipo = ${v.idExameTipo}); -- ${comentario(v.exameNome)}`);

  const sql = `-- ============================================================================
-- Controle de Custos — pré-preenchimento do vínculo com o apLIS pela ASSEFAZ
--
-- Gerada por supabase/scripts/pre-vinculo-aplis-assefaz.ts com o catálogo
-- (custo_exames) e o apLIS (backup MySQL, fattabelaprocedimento ativos da tabela
-- de preço ${TABELA_ASSEFAZ}) lidos em ${new Date().toISOString().slice(0, 10)}. Issue 02 de
-- .scratch/controle-custos-vinculo-aplis-tuss.
--
-- Liga a cobrança cujos códigos no catálogo se resumem a um TUSS, com um exame
-- só (escolherVinculosAssefaz). Precisa de 20261020210000_custo_exames_vinculo_aplis.
-- Cada UPDATE só vale se o exame e a cobrança ainda estiverem sem vínculo:
-- vínculo feito à mão na tela não é sobrescrito. Ids do catálogo lido: em
-- outro ambiente os UPDATEs não acham o exame e não mudam nada.
--
-- Ligou (${vinculos.length}):
${ligou.join('\n') || '--   (nenhuma)'}
--
-- Ficou de fora (${descartes.length}), para a tela:
${ficou.join('\n') || '--   (nenhuma)'}
-- ============================================================================

BEGIN;

${updates.join('\n\n') || '-- Nenhum vínculo a aplicar.'}

COMMIT;
`;
  writeFileSync(arquivoSql, sql);
  console.log(['Ligou:', ...ligou, '', 'Ficou de fora:', ...ficou].map((l) => l.replace(/^-- {0,3}/, '')).join('\n'));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
