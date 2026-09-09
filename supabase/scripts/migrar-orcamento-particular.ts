#!/usr/bin/env -S npx tsx
// supabase/scripts/migrar-orcamento-particular.ts
//
// Migração one-shot da aba "Orcamento Particular" da planilha
// "Tabela Comparativo de Valores A C.xlsx" para public.custo_fontes_pagadoras,
// como fonte pagadora "Particular" — pedido do usuário via chat, sem ticket
// associado em .scratch/.
//
// Reaproveita a validação de TUSS e o upsert de src/components/CostControl/
// domain/importacaoFontesPagadoras.ts (mesmo helper usado pela tela de
// importação e pela migração da planilha legada em
// migrar-planilha-legada-fontes-pagadoras.ts): TUSS não cadastrado em
// custo_exames é pulado, e o casamento fonte_pagadora+tabela_associada+TUSS
// decide inserir vs. atualizar — então roda de novo sem duplicar.
//
// Cabeçalho da aba fica na linha 4 (3 linhas de link/branco antes). Colunas
// usadas: "Código TUSS" -> tuss, "Descrição Exame" -> nome (só informativo,
// não entra no casamento), "Preço de Venda" -> valor cobrado do particular
// (a coluna "Custo alvaro" é custo interno, não o que é cobrado do paciente).
// Não há coluna "Atendido" nesta aba — todas as linhas entram como atendido.
//
// Variáveis de ambiente necessárias:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Uso:
//   npx tsx supabase/scripts/migrar-orcamento-particular.ts "<planilha.xlsx>" [--dry-run]
//
//   --dry-run: lê a planilha e consulta o banco normalmente (só leitura), mas
//   não grava nada. Roda primeiro assim pra conferir o relatório.

import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { getSupabaseAdminClient } from '../../api/_lib/supabase.js';
import {
  separarUpsertFontePagadora,
  validarLinhasImportacaoFontePagadora,
  type LinhaBrutaImportacao,
} from '../../src/components/CostControl/domain/importacaoFontesPagadoras';

const [, , caminhoArquivo, ...flags] = process.argv;
const dryRun = flags.includes('--dry-run');

if (!caminhoArquivo) {
  console.error('Uso: npx tsx supabase/scripts/migrar-orcamento-particular.ts <planilha.xlsx> [--dry-run]');
  process.exit(1);
}

const FONTE_PAGADORA = 'Particular';
const TABELA_ASSOCIADA = 'Particular';
const NOME_ABA = 'Orcamento Particular';
const PAGE_SIZE = 1000;
const CHUNK_INSERT = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function buscarTodasPaginado<T = Record<string, unknown>>(tabela: string, colunas: string): Promise<T[]> {
  const supabase = getSupabaseAdminClient();
  const linhas: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(tabela)
      .select(colunas)
      .range(from, from + PAGE_SIZE - 1)
      .returns<T[]>();
    if (error) throw new Error(`Falha ao ler ${tabela}: ${error.message}`);
    linhas.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return linhas;
}

async function main() {
  console.log(`Lendo ${caminhoArquivo}, aba "${NOME_ABA}"...`);
  const workbook = XLSX.read(readFileSync(caminhoArquivo));
  const sheet = workbook.Sheets[NOME_ABA];
  if (!sheet) {
    throw new Error(`Aba "${NOME_ABA}" não encontrada. Abas disponíveis: ${workbook.SheetNames.join(', ')}`);
  }

  const linhas = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
  const headerRow = linhas[3] ?? [];
  const colTuss = headerRow.findIndex(c => c === 'Código TUSS');
  const colNome = headerRow.findIndex(c => c === 'Descrição Exame');
  const colValor = headerRow.findIndex(c => c === 'Preço de Venda');
  if (colTuss === -1 || colNome === -1 || colValor === -1) {
    throw new Error(
      `Cabeçalho inesperado na linha 4. Esperava "Código TUSS", "Descrição Exame" e "Preço de Venda", achei: ${JSON.stringify(headerRow)}`
    );
  }

  const brutas: LinhaBrutaImportacao[] = linhas
    .slice(4)
    .filter(row => row?.[colTuss] !== null && row?.[colTuss] !== undefined && String(row[colTuss]).trim() !== '')
    .map(row => ({
      tuss: row[colTuss],
      nomeExame: row[colNome],
      valor: row[colValor],
      atendido: null, // sem coluna "Atendido" nesta aba -> default "Sim"
    }));

  console.log(`${brutas.length} linhas com TUSS preenchido na planilha.`);

  console.log('Carregando TUSS válidos (custo_exames) e registros existentes (custo_fontes_pagadoras)...');
  const [examesRows, existentesRows] = await Promise.all([
    buscarTodasPaginado<{ tuss: string | null }>('custo_exames', 'tuss'),
    buscarTodasPaginado<{ id: string; fonte_pagadora: string; tabela_associada: string; tuss: string | null }>(
      'custo_fontes_pagadoras',
      'id,fonte_pagadora,tabela_associada,tuss'
    ),
  ]);

  const tussValidos = new Set(examesRows.map(r => String(r.tuss ?? '').trim()).filter(Boolean));

  const existentesPorTuss = new Map<string, string>();
  for (const row of existentesRows) {
    if (row.fonte_pagadora === FONTE_PAGADORA && row.tabela_associada === TABELA_ASSOCIADA) {
      existentesPorTuss.set(String(row.tuss ?? ''), row.id);
    }
  }

  const validadas = validarLinhasImportacaoFontePagadora(brutas, tussValidos);
  const validas = validadas.flatMap(l => (l.data ? [l.data] : []));
  const invalidas = validadas.filter(l => !l.data);

  const { toInsert, toUpdate } = separarUpsertFontePagadora(validas, existentesPorTuss);

  console.log(`\nFonte pagadora: "${FONTE_PAGADORA}" / Tabela associada: "${TABELA_ASSOCIADA}"`);
  console.log(`  A criar: ${toInsert.length}`);
  console.log(`  A atualizar: ${toUpdate.length}`);
  console.log(`  Puladas (TUSS não cadastrado em Exames): ${invalidas.length}`);
  if (invalidas.length > 0) {
    console.log('  Exemplos de TUSS pulados:');
    invalidas.slice(0, 15).forEach(l => console.log(`    linha ${l.row}: ${l.error}`));
    if (invalidas.length > 15) console.log(`    ...e mais ${invalidas.length - 15}`);
  }

  if (dryRun) {
    console.log('\n(--dry-run: nenhuma escrita foi feita no banco)');
    return;
  }

  const supabase = getSupabaseAdminClient();

  for (const grupo of chunk(toInsert, CHUNK_INSERT)) {
    const { error } = await supabase.from('custo_fontes_pagadoras').insert(
      grupo.map(r => ({
        fonte_pagadora: FONTE_PAGADORA,
        tabela_associada: TABELA_ASSOCIADA,
        tuss: r.tuss,
        valor: r.valor,
        atendido: r.atendido,
      }))
    );
    if (error) throw new Error(`Falha ao inserir: ${error.message}`);
  }

  for (const u of toUpdate) {
    const { error } = await supabase
      .from('custo_fontes_pagadoras')
      .update({ valor: u.valor, atendido: u.atendido })
      .eq('id', u.id);
    if (error) throw new Error(`Falha ao atualizar id=${u.id}: ${error.message}`);
  }

  console.log(`\n✓ Concluído: ${toInsert.length} criadas, ${toUpdate.length} atualizadas.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
