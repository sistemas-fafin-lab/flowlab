#!/usr/bin/env -S npx tsx
// supabase/scripts/importar-nfs-canceladas-planilha.ts
//
// Gera a migration que importa para fat_nfs_canceladas as 11 NFs da aba "NF
// CANCELADAS FORA APLIS" da planilha "CONTROLE DE EMISSÃO DE NOTAS" — issue 04
// de .scratch/faturamento-nf-cancelada — e o relatório do que foi ligado a um
// título e do que não foi. As regras (operadora da planilha, lotes da NF,
// título substituto) estão em api/_lib/faturamento/nfCanceladaPlanilha.ts.
//
// Somente LEITURA: lê a planilha, o Supabase (service role) e o MySQL de backup
// do apLIS e escreve dois arquivos. Não grava em banco nenhum.
//
// Por linha: convênio, número, valor, emissão e motivo vêm da planilha (o
// motivo como está). A operadora sai do convênio da NF no apLIS quando ela está
// lá; senão, do nome. Linha de operadora ambígua não entra (relatório). O
// título é o substituto único (mesma operadora, emitido até 30 dias depois, lote
// em comum ou mesmo valor); sem ele, a NF entra só com a operadora. A planilha
// não tem data de cancelamento: vale a emissão do título substituto e, sem
// título, a da própria NF (decisão de 27/10/2026).
//
// As demais linhas da aba ficam fora (decisão de 27/10/2026): várias ainda são
// o número atual de títulos, o que pede a troca da NF no título, não importação.
//
// Variáveis de ambiente:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (leitura de operadoras e títulos)
//   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME   (leitura do apLIS)
//
// Uso:
//   npx tsx supabase/scripts/importar-nfs-canceladas-planilha.ts <planilha.xlsx> <migration.sql> <relatorio.md>

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import mysql from 'mysql2/promise';
import * as XLSX from 'xlsx';
import { getSupabaseAdminClient } from '../../api/_lib/supabase.js';
import { JANELA_SUBSTITUTO_DIAS, lotesDoTexto, resolverOperadora, tituloSubstituto } from '../../api/_lib/faturamento/nfCanceladaPlanilha.js';
import type { NfNoAplis, OperadoraFlowlab, TituloCandidato } from '../../api/_lib/faturamento/nfCanceladaPlanilha.js';

const [arquivoPlanilha, arquivoSql, arquivoRelatorio] = process.argv.slice(2);
if (!arquivoPlanilha || !arquivoSql || !arquivoRelatorio) {
  console.error('Uso: importar-nfs-canceladas-planilha.ts <planilha.xlsx> <migration.sql> <relatorio.md>');
  process.exit(2);
}

const ABA = 'NF CANCELADAS FORA APLIS';
/** As 11 NFs conferidas no apLIS em 27/10/2026 (spec, Further Notes). */
const NUMEROS = ['7724', '7496', '7495', '7498', '7504', '7831', '7914', '7996', '7787', '7793', '7990'];
const DATA_IMPORTACAO = '27/10/2026';
const RESPONSAVEL = `Importação da planilha (${DATA_IMPORTACAO})`;

interface Linha { convenio: string; numero: string; valor: number | null; emissao: string | null; motivo: string | null }
interface Nota { id_nota: string; numero_nota: string | null; status: string; data_emissao: string | null; valor_total: number; operadora_id: string }
interface RpsAplis extends NfNoAplis { dadosAdicionais: string | null }

/** "R$  6.867,86" ou 6867.86 → 6867.86 */
const valorDaPlanilha = (v: unknown): number | null => {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string' || !/\d/.test(v)) return null;
  return Number(v.replace(/[^\d,]/g, '').replace(',', '.'));
};
// As datas da planilha são meia-noite de Brasília (03:00 UTC).
const dataDaPlanilha = (v: unknown) => (v instanceof Date ? new Date(v.getTime() - 3 * 3_600_000).toISOString().slice(0, 10) : null);

function lerAba(): Linha[] {
  const livro = XLSX.read(readFileSync(arquivoPlanilha), { cellDates: true });
  const aba = livro.Sheets[ABA];
  if (!aba) throw new Error(`A planilha não tem a aba "${ABA}".`);
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: true, defval: null }).slice(1);
  // A aba continua com "NF EMITIDAS FORA DO APLIS", que não é de canceladas.
  const fim = linhas.findIndex((l) => /EMITIDAS FORA DO APLIS/i.test(String(l[0] ?? '')));
  return linhas.slice(0, fim < 0 ? undefined : fim)
    .filter((l) => l[1] !== null)
    .map((l) => ({
      convenio: String(l[0] ?? '').trim(), numero: String(l[1]).trim(), valor: valorDaPlanilha(l[2]),
      emissao: dataDaPlanilha(l[3]), motivo: l[4] === null ? null : String(l[4]),
    }));
}

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

async function lerAplis(numeros: string[]): Promise<Map<string, RpsAplis>> {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 3306), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME ?? 'lab',
  });
  try {
    const [linhas] = await conn.query<mysql.RowDataPacket[]>(
      'SELECT NFeNumero, IdInstituicao, CPFCNPJTomador, DadosAdicionais FROM fatrps WHERE NFeNumero IN (?)', [numeros]);
    return new Map(linhas.map((l) => [String(l.NFeNumero), {
      idInstituicao: l.IdInstituicao === null ? null : Number(l.IdInstituicao),
      cnpjTomador: l.CPFCNPJTomador === null ? null : String(l.CPFCNPJTomador),
      dadosAdicionais: l.DadosAdicionais === null ? null : String(l.DadosAdicionais),
    }]));
  } finally {
    await conn.end();
  }
}

const sqlTexto = (v: string | null) => (v === null ? 'NULL' : `'${v.replace(/'/g, "''")}'`);
const brl = (v: number | null) => (v === null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const br = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—');
const celula = (v: string) => v.replace(/\s+/g, ' ').replace(/\|/g, '\\|');

async function main() {
  const aba = lerAba();
  const linhas = NUMEROS.map((n) => {
    const linha = aba.find((l) => l.numero === n);
    if (!linha) throw new Error(`A NF ${n} não está na aba "${ABA}".`);
    return linha;
  });
  const foraDaImportacao = aba.filter((l) => !NUMEROS.includes(l.numero));

  const operadoras = (await todas<{ id_operadora: string; nome: string; cnpj: string | null; aplis_id: string | null }>(
    'operadoras', 'id_operadora, nome, cnpj, aplis_id, created_at'))
    .map((o): OperadoraFlowlab => ({ id: o.id_operadora, nome: o.nome, cnpj: o.cnpj, aplisId: o.aplis_id }));
  const nomeOperadora = new Map(operadoras.map((o) => [o.id, o.nome]));
  const notas = await todas<Nota>('notas', 'id_nota, numero_nota, status, data_emissao, valor_total, operadora_id, created_at');
  const vinculos = await todas<{ id_nota: string; id_lote: string }>('nota_lote', 'id_nota, id_lote, created_at');
  const aplisDoLote = new Map((await todas<{ id_lote: string; aplis_id: string | null }>('lotes', 'id_lote, aplis_id, created_at'))
    .map((l) => [l.id_lote, Number(l.aplis_id)]));
  const aplis = await lerAplis(NUMEROS);

  const lotesDaNota = new Map<string, number[]>();
  for (const v of vinculos) {
    const id = aplisDoLote.get(v.id_lote);
    if (id) lotesDaNota.set(v.id_nota, [...(lotesDaNota.get(v.id_nota) ?? []), id]);
  }
  // Título cancelado não substitui NF nenhuma.
  const titulos: TituloCandidato[] = notas.filter((n) => n.status !== 'cancelada').map((n) => ({
    id: n.id_nota, operadoraId: n.operadora_id, emissao: n.data_emissao, valor: Number(n.valor_total),
    lotes: lotesDaNota.get(n.id_nota) ?? [],
  }));
  const notaPorId = new Map(notas.map((n) => [n.id_nota, n]));
  const descreverTitulo = (id: string) => {
    const n = notaPorId.get(id)!;
    const lotes = lotesDaNota.get(id) ?? [];
    return `NF ${n.numero_nota ?? 's/ nº'} de ${br(n.data_emissao)}, R$ ${brl(Number(n.valor_total))}${lotes.length ? `, lote(s) ${lotes.join(', ')}` : ''} (\`${id}\`)`;
  };

  const inserts: string[] = [];
  const conferencia: string[] = [];
  const vinculadas: string[] = [];
  const semTitulo: string[] = [];
  const ambiguas: string[] = [];
  const contraONome: string[] = [];
  for (const linha of linhas) {
    const rps = aplis.get(linha.numero) ?? null;
    const operadora = resolverOperadora(linha.convenio, operadoras, rps);
    const cabeca = `NF ${linha.numero} — ${linha.convenio}, R$ ${brl(linha.valor)}, emitida em ${br(linha.emissao)}`;
    if (operadora.tipo === 'ambigua') {
      ambiguas.push(`| ${linha.numero} | ${celula(linha.convenio)} | ${operadora.candidatas.map(celula).join('; ') || 'nenhuma'} |`);
      continue;
    }
    if (!linha.motivo || linha.valor === null || !linha.emissao) throw new Error(`${cabeca}: falta motivo, valor ou emissão na planilha.`);

    const nomeOp = nomeOperadora.get(operadora.operadoraId)!;
    const comoOp = `${nomeOp} (pelo ${operadora.via}${operadora.nomeDiverge ? '; o nome da planilha apontaria outra operadora' : ''})`;
    if (operadora.nomeDiverge) contraONome.push(`- NF ${linha.numero}: "${linha.convenio}" na planilha, ${nomeOp} pelo ${operadora.via}.`);
    const lotes = lotesDoTexto(rps?.dadosAdicionais ?? null);
    const substituto = tituloSubstituto({ operadoraId: operadora.operadoraId, emissao: linha.emissao, valor: linha.valor, lotes }, titulos);
    const notaId = substituto.tipo === 'unico' ? substituto.tituloId : null;
    const dataCancelamento = notaId ? notaPorId.get(notaId)!.data_emissao! : linha.emissao;
    const lotesTexto = rps ? (lotes.length ? `lote(s) ${lotes.join(', ')} no texto da NF` : 'NF no apLIS sem lote no texto') : 'NF fora do apLIS';

    if (substituto.tipo === 'unico') {
      vinculadas.push(`- **${cabeca}** → ${descreverTitulo(substituto.tituloId)}. Operadora: ${comoOp}; ${lotesTexto}.`);
    } else {
      const porque = substituto.tipo === 'nenhum'
        ? `nenhum título de ${nomeOp} emitido até ${JANELA_SUBSTITUTO_DIAS} dias depois com lote em comum ou o mesmo valor`
        : `${substituto.tituloIds.length} candidatos: ${substituto.tituloIds.map(descreverTitulo).join('; ')}`;
      // Pista para o vínculo à mão: títulos com lote da NF que a regra recusou.
      const lotesNf = new Set(lotes);
      const pistas = titulos.filter((t) => t.lotes.some((l) => lotesNf.has(l))).map((t) => {
        const fora = [
          t.operadoraId !== operadora.operadoraId && `de ${nomeOperadora.get(t.operadoraId)}`,
          t.emissao !== null && t.emissao < linha.emissao! && 'emitido antes da NF',
        ].filter(Boolean).join(', ');
        return `  - ${descreverTitulo(t.id)}${fora ? ` — ${fora}` : ''}`;
      });
      semTitulo.push([`- **${cabeca}** — ${porque}. Operadora: ${comoOp}; ${lotesTexto}.`,
        ...(pistas.length ? ['  Títulos com lote da NF, fora da regra:', ...pistas] : [])].join('\n'));
    }

    inserts.push(`-- ${cabeca} → ${notaId ? `título ${notaPorId.get(notaId)!.numero_nota ?? 's/ nº'}` : 'sem título'}
INSERT INTO fat_nfs_canceladas (nota_id, operadora_id, numero_nota, valor, data_emissao, data_cancelamento, motivo, origem, registrado_por_nome)
VALUES (${sqlTexto(notaId)}, ${sqlTexto(operadora.operadoraId)}, ${sqlTexto(linha.numero)}, ${linha.valor.toFixed(2)}, DATE '${linha.emissao}', DATE '${dataCancelamento}', ${sqlTexto(linha.motivo)}, 'planilha', ${sqlTexto(RESPONSAVEL)});`);
    conferencia.push(`(${sqlTexto(operadora.operadoraId)}::uuid, ${sqlTexto(linha.numero)}, ${notaId ? `${sqlTexto(notaId)}::uuid` : 'NULL::uuid'})`);
  }

  const sql = `-- ============================================================================
-- Contas a Receber: NFs canceladas da planilha "CONTROLE DE EMISSÃO DE NOTAS"
--
-- Gerada por supabase/scripts/importar-nfs-canceladas-planilha.ts com a aba
-- "${ABA}", o Supabase de produção e o apLIS (backup MySQL) lidos
-- em ${DATA_IMPORTACAO}. Issue 04 de .scratch/faturamento-nf-cancelada; o relatório
-- (o que foi ligado a um título, o que não foi e por quê) está em
-- .scratch/faturamento-nf-cancelada/relatorio-importacao-planilha.md.
--
-- ${inserts.length} NFs, origem 'planilha', ${vinculadas.length} ligadas ao título que as
-- substituiu e ${semTitulo.length} só à operadora. Motivo, valor e emissão vêm da planilha;
-- a data do cancelamento é a emissão do título substituto ou, sem título, a da NF.
--
-- Precisa de 20261027170000_fat_nf_canceladas.sql. Entra uma vez só: rodar de
-- novo esbarra na chave (operadora, número) e desfaz tudo. Os ids são de
-- produção: no projeto de teste os INSERT falham na FK. Tudo numa transação;
-- qualquer divergência na conferência desfaz tudo.
-- ============================================================================

BEGIN;

${inserts.join('\n\n')}

-- Conferência: as ${NUMEROS.length} NFs entraram, cada uma com a operadora e o título
-- esperados, e nenhum número se repete na mesma operadora.
DO $$
DECLARE
  v_faltando TEXT;
  v_repetidos TEXT;
  v_total INT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM fat_nfs_canceladas
   WHERE origem = 'planilha' AND numero_nota IN (${NUMEROS.map(sqlTexto).join(', ')});
  IF v_total <> ${NUMEROS.length} THEN
    RAISE EXCEPTION 'Importação da planilha: % NFs canceladas da planilha, esperadas ${NUMEROS.length}', v_total;
  END IF;

  SELECT string_agg(e.numero, ', ')
    INTO v_faltando
    FROM (VALUES
      ${conferencia.join(',\n      ')}
    ) AS e(operadora_id, numero, nota_id)
    LEFT JOIN fat_nfs_canceladas c
      ON c.operadora_id = e.operadora_id AND c.numero_nota = e.numero AND c.origem = 'planilha'
   WHERE c.id IS NULL
      OR c.nota_id IS DISTINCT FROM e.nota_id;
  IF v_faltando IS NOT NULL THEN
    RAISE EXCEPTION 'Importação da planilha: NFs canceladas fora do esperado: %', v_faltando;
  END IF;

  SELECT string_agg(numero_nota, ', ')
    INTO v_repetidos
    FROM (SELECT numero_nota FROM fat_nfs_canceladas GROUP BY operadora_id, numero_nota HAVING COUNT(*) > 1) r;
  IF v_repetidos IS NOT NULL THEN
    RAISE EXCEPTION 'Importação da planilha: número de NF cancelada repetido na operadora: %', v_repetidos;
  END IF;
END $$;

COMMIT;
`;

  const relatorio = `# Importação das NFs canceladas da planilha

Gerado por \`supabase/scripts/importar-nfs-canceladas-planilha.ts\` em ${DATA_IMPORTACAO}, com a aba
"${ABA}" da planilha "CONTROLE DE EMISSÃO DE NOTAS", o Supabase de produção e o apLIS.
A migration é \`${arquivoSql.replace(/^.*supabase\/migrations\//, 'supabase/migrations/')}\`.

Regra do vínculo: título da mesma operadora, emitido no mesmo dia ou até ${JANELA_SUBSTITUTO_DIAS} dias depois da
NF cancelada, com lote em comum ou o mesmo valor, e só quando há um candidato. Os lotes da NF
cancelada vêm do texto dela no apLIS (\`fatrps.DadosAdicionais\`), porque o apLIS já não a liga
a lote nenhum. A data do cancelamento é a emissão do título substituto ou, sem título, a da NF.

## Ligadas a um título (${vinculadas.length})

${vinculadas.join('\n') || '_Nenhuma._'}

## Sem título, ligadas só à operadora (${semTitulo.length})

Aparecem na busca por número da lista de títulos. A tabela é append-only e não tem tela de
vínculo: ligar uma delas a um título pede uma migration de dados. Os títulos listados abaixo
de cada NF têm um lote dela, mas a regra os recusou (outra operadora ou emitidos antes da NF:
os títulos importados da planilha levaram a data do lote, não a da NF).

${semTitulo.join('\n') || '_Nenhuma._'}

## Operadora contra o nome da planilha (${contraONome.length})

O convênio da NF no apLIS (ou o CNPJ do tomador) apontou uma operadora diferente da que o nome
da planilha apontaria. Vale o apLIS; conferir.

${contraONome.join('\n') || '_Nenhuma._'}

## Operadora ambígua, não importadas (${ambiguas.length})

${ambiguas.length ? `| NF | Convênio na planilha | Operadoras possíveis |\n|---|---|---|\n${ambiguas.join('\n')}` : '_Nenhuma._'}

## Fora desta importação (${foraDaImportacao.length})

As demais linhas da aba não entram aqui (decisão de 27/10/2026): várias ainda são o número
atual de títulos no flowlab, o que pede a troca da NF no título com "NF anterior cancelada",
não a importação.

| NF | Convênio | Valor | Emissão | Observação |
|---|---|---|---|---|
${foraDaImportacao.map((l) => `| ${celula(l.numero)} | ${celula(l.convenio) || '—'} | ${brl(l.valor)} | ${br(l.emissao)} | ${celula(l.motivo ?? '') || '—'} |`).join('\n')}
`;

  writeFileSync(arquivoRelatorio, relatorio);
  console.log({ importadas: inserts.length, ligadas: vinculadas.length, semTitulo: semTitulo.length, ambiguas: ambiguas.length });
  // A migration tem de levar as 11: com operadora ambígua, resolver antes de gerar.
  if (inserts.length !== NUMEROS.length) {
    console.error(`${NUMEROS.length - inserts.length} NF(s) com operadora ambígua — migration não gerada; ver o relatório.`);
    process.exit(1);
  }
  writeFileSync(arquivoSql, sql);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
