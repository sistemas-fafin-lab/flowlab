#!/usr/bin/env -S npx tsx
// supabase/scripts/migrar-planilha-legada-fontes-pagadoras.ts
//
// Migração one-shot da planilha legada "VALORES ANÁLISES CLÍNICAS" (controle
// de custo por convênio mantido manualmente pela equipe antes da tela de
// Fontes Pagadoras) para public.custo_fontes_pagadoras. Ver
// .scratch/controle-custos-fontes-pagadoras-export-import/issues/03-migrar-planilha-legada-fontes-pagadoras.md.
//
// Reaproveita a lógica de validação de TUSS e de upsert construídas no
// ticket 02 (src/components/CostControl/domain/importacaoFontesPagadoras.ts):
// mesmas regras de "TUSS não cadastrado em custo_exames é pulado" e de
// casamento fonte_pagadora+tabela_associada+TUSS pra decidir inserir vs.
// atualizar. A parte específica desta migração (mapear aba → fonte
// pagadora/tabela associada, achar cabeçalho, extrair linhas brutas) vive em
// src/components/CostControl/domain/migracaoPlanilhaLegada.ts.
//
// Cada aba de convênio da planilha vira uma fonte pagadora, exceto:
//   - Convenios aceitos / Custo Alvaro / TABELA REF / PESQUISAR CUSTOS:
//     referência/rascunho, nunca foram fonte pagadora
//   - GAMA: usa códigos AMB/92/CBHPM em vez de TUSS — fica pra cadastro
//     manual posterior na tela
//   - ASSEFAZ (antiga): descartada em favor de ASSEFAZ REAJUSTE (versão mais
//     nova e mais completa), que migra como fonte pagadora "ASSEFAZ"
//
// Idempotente — casa por fonte_pagadora+tabela_associada+TUSS contra o que
// já existe no banco (upsert), então pode rodar de novo sem duplicar.
//
// Variáveis de ambiente necessárias:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     npx tsx supabase/scripts/migrar-planilha-legada-fontes-pagadoras.ts \
//       "<caminho para a planilha .xlsx>" [--dry-run]
//
//   --dry-run: lê a planilha e consulta o banco normalmente (custo_exames e
//   custo_fontes_pagadoras — só leitura), mas não grava nada. Útil pra
//   conferir o relatório antes de rodar de verdade.

import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { getSupabaseAdminClient } from '../../api/_lib/supabase.js';
import {
  separarUpsertFontePagadora,
  validarLinhasImportacaoFontePagadora,
} from '../../src/components/CostControl/domain/importacaoFontesPagadoras';
import {
  construirMapaParceiros,
  extrairLinhasBrutas,
  identificarTipoAba,
  localizarCabecalho,
  normalizarChave,
  resolverFonteTabela,
} from '../../src/components/CostControl/domain/migracaoPlanilhaLegada';

const [, , caminhoArquivo, ...flags] = process.argv;
const dryRun = flags.includes('--dry-run');

if (!caminhoArquivo) {
  console.error(
    'Uso: npx tsx supabase/scripts/migrar-planilha-legada-fontes-pagadoras.ts <planilha.xlsx> [--dry-run]'
  );
  process.exit(1);
}

const PAGE_SIZE = 1000;
const CHUNK_INSERT = 500;
const CONCORRENCIA_UPDATE = 20;

/** Chave de agrupamento fonte_pagadora+tabela_associada. JSON.stringify de um
 *  array escapa aspas/caracteres especiais de cada parte, então não colide
 *  como uma concatenação com separador literal colidiria (ex.: fonte="A B" +
 *  tabela="C" vs. fonte="A" + tabela="B C" dariam a mesma string concatenada
 *  com espaço; aqui viram '["A B","C"]' e '["A","B C"]', inequívocos). */
function chaveFonteTabela(fontePagadora: string, tabelaAssociada: string): string {
  return JSON.stringify([fontePagadora, tabelaAssociada]);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Concorrência limitada em vez de Promise.all direto (dispararia milhares
 *  de updates simultâneos) e em vez de sequencial puro (uma tabela grande
 *  como PMDF/SAÚDE CAIXA levaria minutos pra atualizar uma linha por vez). */
async function executarComConcorrencia<T>(items: T[], limite: number, fn: (item: T) => Promise<void>): Promise<void> {
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, worker));
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

interface RelatorioLinha {
  aba: string;
  fontePagadora: string;
  tabelaAssociada: string;
  criados: number;
  atualizados: number;
  invalidos: number;
}

async function main() {
  console.log(`Lendo ${caminhoArquivo}...`);
  // XLSX.readFile depende de fs e não existe no build ESM do pacote 'xlsx'
  // usado por `import * as XLSX from 'xlsx'` — lemos o arquivo manualmente.
  const workbook = XLSX.read(readFileSync(caminhoArquivo));

  console.log('Carregando TUSS válidos (custo_exames) e registros existentes (custo_fontes_pagadoras)...');
  const [examesRows, existentesRows] = await Promise.all([
    buscarTodasPaginado<{ tuss: string | null }>('custo_exames', 'tuss'),
    buscarTodasPaginado<{ id: string; fonte_pagadora: string; tabela_associada: string; tuss: string | null }>(
      'custo_fontes_pagadoras',
      'id,fonte_pagadora,tabela_associada,tuss'
    ),
  ]);

  const tussValidos = new Set(examesRows.map(r => String(r.tuss ?? '').trim()).filter(Boolean));

  // Map<chaveFonteTabela(fonte,tabela), Map<tuss, id>> — snapshot do que já
  // existe, atualizado a cada inserção pra abas processadas em seguida não
  // colidirem com o que acabou de ser gravado nesta mesma execução.
  const existentesPorChave = new Map<string, Map<string, string>>();
  for (const row of existentesRows) {
    const chave = chaveFonteTabela(row.fonte_pagadora, row.tabela_associada);
    if (!existentesPorChave.has(chave)) existentesPorChave.set(chave, new Map());
    existentesPorChave.get(chave)!.set(String(row.tuss ?? ''), row.id);
  }

  // Busca tolerante a acento/caixa/espaço (mesma normalização usada em
  // identificarTipoAba) — o nome real da aba de referência não tem garantia
  // de bater caractere-a-caractere com o literal usado aqui.
  const nomeAbaConvenios = workbook.SheetNames.find(n => normalizarChave(n) === 'CONVENIOS ACEITOS');
  const conveniosSheet = nomeAbaConvenios ? workbook.Sheets[nomeAbaConvenios] : undefined;
  const conveniosLinhas = conveniosSheet
    ? (XLSX.utils.sheet_to_json(conveniosSheet, { header: 1, defval: null }) as unknown[][])
    : [];
  const parceiroPorConvenio = construirMapaParceiros(conveniosLinhas);
  if (!conveniosSheet) {
    console.warn('⚠ Aba "Convenios aceitos" não encontrada — Tabela Associada só será resolvida via prefixo da aba.');
  }

  const supabase = getSupabaseAdminClient();
  const relatorio: RelatorioLinha[] = [];
  const abasNaoReconhecidas: string[] = [];
  let gamaIgnorada = false;
  let assefazAntigaDescartada = false;

  for (const nomeAba of workbook.SheetNames) {
    const tipo = identificarTipoAba(nomeAba);
    if (tipo === 'excluida') continue;
    if (tipo === 'gama') {
      gamaIgnorada = true;
      continue;
    }
    if (tipo === 'assefaz-antiga') {
      assefazAntigaDescartada = true;
      continue;
    }

    const sheet = workbook.Sheets[nomeAba];
    const linhas = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
    const colunas = localizarCabecalho(linhas);
    if (!colunas) {
      console.warn(`⚠ Aba "${nomeAba}": cabeçalho não reconhecido (sem coluna de código/TUSS + valor), pulando.`);
      abasNaoReconhecidas.push(nomeAba);
      continue;
    }

    const brutas = extrairLinhasBrutas(linhas, colunas);
    const validadas = validarLinhasImportacaoFontePagadora(brutas, tussValidos);
    const validas = validadas.flatMap(l => (l.data ? [l.data] : []));
    const invalidos = validadas.length - validas.length;

    const { fontePagadora, tabelaAssociada } = resolverFonteTabela(nomeAba, parceiroPorConvenio);
    const chave = chaveFonteTabela(fontePagadora, tabelaAssociada);
    const existentesPorTuss = existentesPorChave.get(chave) ?? new Map<string, string>();

    const { toInsert, toUpdate } = separarUpsertFontePagadora(validas, existentesPorTuss);

    if (!dryRun) {
      for (const grupo of chunk(toInsert, CHUNK_INSERT)) {
        const { data: inseridos, error } = await supabase
          .from('custo_fontes_pagadoras')
          .insert(
            grupo.map(r => ({
              fonte_pagadora: fontePagadora,
              tabela_associada: tabelaAssociada,
              tuss: r.tuss,
              valor: r.valor,
              atendido: r.atendido,
            }))
          )
          .select('id,tuss');
        if (error) {
          throw new Error(`Falha ao inserir em "${nomeAba}" (${fontePagadora}/${tabelaAssociada}): ${error.message}`);
        }
        (inseridos ?? []).forEach(row => existentesPorTuss.set(String(row.tuss ?? ''), row.id));
      }
      existentesPorChave.set(chave, existentesPorTuss);

      await executarComConcorrencia(toUpdate, CONCORRENCIA_UPDATE, async u => {
        const { error } = await supabase
          .from('custo_fontes_pagadoras')
          .update({ valor: u.valor, atendido: u.atendido })
          .eq('id', u.id);
        if (error) throw new Error(`Falha ao atualizar em "${nomeAba}" (id=${u.id}): ${error.message}`);
      });
    }

    relatorio.push({
      aba: nomeAba,
      fontePagadora,
      tabelaAssociada,
      criados: toInsert.length,
      atualizados: toUpdate.length,
      invalidos,
    });

    console.log(
      `✓ ${nomeAba} → fonte "${fontePagadora}" / tabela "${tabelaAssociada}": ` +
        `${toInsert.length} criadas, ${toUpdate.length} atualizadas, ${invalidos} puladas (TUSS inválido)`
    );
  }

  const totalCriados = relatorio.reduce((s, r) => s + r.criados, 0);
  const totalAtualizados = relatorio.reduce((s, r) => s + r.atualizados, 0);
  const totalInvalidos = relatorio.reduce((s, r) => s + r.invalidos, 0);

  console.log('\n=== RELATÓRIO FINAL ===');
  console.log(`Fontes pagadoras processadas: ${relatorio.length}`);
  console.log(`Linhas criadas: ${totalCriados}`);
  console.log(`Linhas atualizadas: ${totalAtualizados}`);
  console.log(`Linhas puladas por TUSS inválido: ${totalInvalidos}`);
  console.log(`GAMA ignorada (códigos AMB/92/CBHPM, cadastro manual posterior): ${gamaIgnorada ? 'sim' : 'NÃO ENCONTRADA NA PLANILHA'}`);
  console.log(
    `Aba "ASSEFAZ" antiga descartada (migrada só via ASSEFAZ REAJUSTE): ${
      assefazAntigaDescartada ? 'sim' : 'NÃO ENCONTRADA NA PLANILHA'
    }`
  );
  if (abasNaoReconhecidas.length > 0) {
    console.log(`⚠ Abas não migradas por cabeçalho não reconhecido (${abasNaoReconhecidas.length}): ${abasNaoReconhecidas.join(', ')}`);
  }
  if (dryRun) console.log('\n(--dry-run: nenhuma escrita foi feita no banco)');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
