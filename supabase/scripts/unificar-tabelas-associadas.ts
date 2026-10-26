#!/usr/bin/env -S npx tsx
// supabase/scripts/unificar-tabelas-associadas.ts
//
// Gera a migração que unifica as tabelas associadas duplicadas
// (.scratch/controle-custos-tabela-associada/issues/06-unificacao-tabelas-duplicadas.md),
// a partir do mapa de junção e das escolhas de preço decididos pelo
// faturamento no levantamento (ticket 05). O plano vem de planejarUnificacao
// (src/components/CostControl/domain/unificacaoTabelas.ts): com conflito sem
// escolha, o script lista os conflitos e não gera nada.
//
// A migração gerada:
//   1. confere que as linhas (e exclusões/valores personalizados delas) das
//      tabelas do mapa ainda são as que o plano leu — se mudaram, aborta e é
//      preciso gerar de novo;
//   2. desliga trigger_custo_tabelas_associadas_regras (a Tabela Particular
//      protegida pode ser uma das juntadas) e a sincronia das linhas (o
//      destino pode estar inativo) — id e texto são gravados juntos aqui;
//   3. cria destinos novos, passa os ajustes por exame das linhas que saem
//      para a que fica, remove as que saem, aponta as que ficam para o
//      destino e remove os cadastros das origens;
//   4. religa os triggers e confere: nenhum (tabela, TUSS) ou (tabela, exame)
//      duplicado, texto igual ao cadastro, e cada escolha com o preço escolhido.
//
// Precisa rodar numa transação só (como o Supabase aplica as migrações): as
// tabelas temporárias do passo 1 são ON COMMIT DROP e o passo 4 as lê.
//
// Arquivo do mapa (JSON):
//   {
//     "mapa": [{ "fontePagadora": "Particular", "destino": "Particular", "origens": ["PARTICULAR"] }],
//     "escolhas": [{ "fontePagadora": "Particular", "destino": "Particular",
//                    "tuss": "40306712", "exameId": null, "fica": "PARTICULAR" }]
//   }
//
// Uso (lê do banco — só leitura):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     npx tsx supabase/scripts/unificar-tabelas-associadas.ts <mapa.json> [<saida.sql>]
// ou de um backup (pasta com custo_fontes_pagadoras.json,
// custo_fontes_pagadoras_exclusoes.json e custo_fontes_pagadoras_valores_exame.json):
//   npx tsx supabase/scripts/unificar-tabelas-associadas.ts <mapa.json> [<saida.sql>] --backup <pasta>
//
// Sem <saida.sql>, imprime a migração.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  chaveDaLinha,
  planejarUnificacao,
  type EntradaUnificacao,
  type EscolhaPreco,
  type GrupoJuncao,
  type LinhaUnificacao,
  type OperacoesUnificacao,
} from '../../src/components/CostControl/domain/unificacaoTabelas';

const args = process.argv.slice(2);
const iBackup = args.indexOf('--backup');
const pastaBackup = iBackup >= 0 ? args[iBackup + 1] : null;
const [caminhoMapa, caminhoSaida] = iBackup >= 0 ? args.filter((_, i) => i !== iBackup && i !== iBackup + 1) : args;

if (!caminhoMapa || (iBackup >= 0 && !pastaBackup)) {
  console.error(
    'Uso: npx tsx supabase/scripts/unificar-tabelas-associadas.ts <mapa.json> [<saida.sql>] [--backup <pasta>]'
  );
  process.exit(1);
}

interface LinhaBanco {
  id: string;
  fonte_pagadora: string;
  tabela_associada: string;
  tuss: string;
  exame_id: string | null;
  valor: number | string;
  atendido: boolean;
  elegivel_desconto_particular: boolean;
}
interface ExclusaoBanco {
  payor_id: string;
  exame_id: string;
}
interface ValorExameBanco extends ExclusaoBanco {
  valor: number | string;
}

async function lerDados(): Promise<[LinhaBanco[], ExclusaoBanco[], ValorExameBanco[]]> {
  if (pastaBackup) {
    const ler = <T>(arquivo: string): T[] => JSON.parse(readFileSync(join(pastaBackup, arquivo), 'utf8'));
    return [
      ler('custo_fontes_pagadoras.json'),
      ler('custo_fontes_pagadoras_exclusoes.json'),
      ler('custo_fontes_pagadoras_valores_exame.json'),
    ];
  }
  // Paginação sem ordem estável pode pular ou repetir linha — a conferência
  // inicial da migração pega isso (o snapshot não bate com o banco).
  const { getSupabaseAdminClient } = await import('../../api/_lib/supabase.js');
  const { buscarTodasPaginado } = await import('../../api/_lib/supabasePaginado.js');
  const supabase = getSupabaseAdminClient();
  return Promise.all([
    buscarTodasPaginado<LinhaBanco>(
      supabase,
      'custo_fontes_pagadoras',
      'id, fonte_pagadora, tabela_associada, tuss, exame_id, valor, atendido, elegivel_desconto_particular'
    ),
    buscarTodasPaginado<ExclusaoBanco>(supabase, 'custo_fontes_pagadoras_exclusoes', 'payor_id, exame_id'),
    buscarTodasPaginado<ValorExameBanco>(supabase, 'custo_fontes_pagadoras_valores_exame', 'payor_id, exame_id, valor'),
  ]);
}

/** Erros de digitação no mapa viram junções erradas — melhor parar. */
/** Mesmo critério de custo_tabela_associada_eh_particular (20261021190000):
 *  a tabela que o Gerador de Orçamento lê. Com as regras do cadastro
 *  desligadas na junção, só o mapa impede que ela seja juntada em outra. */
const ehTabelaParticular = (fonte: string, nome: string): boolean =>
  fonte === 'Particular' && nome.trim().toLowerCase() === 'particular';

function validarMapa(mapa: GrupoJuncao[], escolhas: EscolhaPreco[]): string[] {
  const erros: string[] = [];
  const usadas = new Map<string, string>();
  const marcar = (fonte: string, nome: string, papel: string) => {
    const chave = JSON.stringify([fonte, nome]);
    const anterior = usadas.get(chave);
    if (anterior) erros.push(`"${nome}" (${fonte}) aparece no mapa como ${anterior} e como ${papel}.`);
    usadas.set(chave, papel);
  };
  for (const g of mapa) {
    if (g.origens.length === 0) erros.push(`Grupo de "${g.destino}" (${g.fontePagadora}) sem origens.`);
    marcar(g.fontePagadora, g.destino, `destino`);
    g.origens.forEach(o => marcar(g.fontePagadora, o, `origem de "${g.destino}"`));
    g.origens
      .filter(o => ehTabelaParticular(g.fontePagadora, o) && !ehTabelaParticular(g.fontePagadora, g.destino))
      .forEach(o => erros.push(`"${o}" (Particular) é a Tabela Particular do orçamento e não pode ser juntada em "${g.destino}".`));
  }
  for (const e of escolhas) {
    const grupo = mapa.find(g => g.fontePagadora === e.fontePagadora && g.destino === e.destino);
    if (!grupo) erros.push(`Escolha do TUSS "${e.tuss}" aponta para "${e.destino}" (${e.fontePagadora}), que não é destino no mapa.`);
    else if (![grupo.destino, ...grupo.origens].includes(e.fica))
      erros.push(`Escolha do TUSS "${e.tuss}" fica com "${e.fica}", que não está no grupo de "${e.destino}".`);
  }
  return erros;
}

const sqlTexto = (s: string | null): string => (s === null ? 'NULL' : `'${s.replace(/'/g, "''")}'`);
const sqlUuid = (s: string | null): string => (s === null ? 'NULL::uuid' : `${sqlTexto(s)}::uuid`);
const sqlNumero = (n: number): string => {
  if (!Number.isFinite(n)) throw new Error(`Valor inválido: ${n}`);
  return `${n}::numeric`;
};
const linhasValues = (linhas: string[]): string => linhas.map(l => `  (${l})`).join(',\n');
const listaUuid = (ids: string[]): string => ids.map(sqlUuid).join(', ');

/** Conferência de que o banco ainda tem exatamente as linhas que o plano leu. */
function sqlSnapshot(entrada: EntradaUnificacao): string {
  const linhaIds = new Set(entrada.linhas.map(l => l.id));
  const exclusoes = entrada.exclusoes.filter(e => linhaIds.has(e.payorId));
  const valoresExame = entrada.valoresExame.filter(v => linhaIds.has(v.payorId));
  const tabelas = entrada.mapa.flatMap(g => [g.destino, ...g.origens].map(n => `${sqlTexto(g.fontePagadora)}, ${sqlTexto(n)}`));

  return `CREATE TEMP TABLE _unif_tabelas (fonte_pagadora TEXT, nome TEXT) ON COMMIT DROP;
INSERT INTO _unif_tabelas VALUES
${linhasValues(tabelas)};

CREATE TEMP TABLE _unif_linhas (
  id UUID, fonte_pagadora TEXT, tabela_associada TEXT, tuss TEXT, exame_id UUID,
  valor NUMERIC, atendido BOOLEAN, elegivel_desconto_particular BOOLEAN
) ON COMMIT DROP;
${
  entrada.linhas.length
    ? `INSERT INTO _unif_linhas VALUES\n${linhasValues(
        entrada.linhas.map(l =>
          [
            sqlUuid(l.id),
            sqlTexto(l.fontePagadora),
            sqlTexto(l.tabelaAssociada),
            sqlTexto(l.tuss),
            sqlUuid(l.exameId),
            sqlNumero(l.valor),
            l.atendido,
            l.elegivelDescontoParticular,
          ].join(', ')
        )
      )};`
    : ''
}

CREATE TEMP TABLE _unif_exclusoes (payor_id UUID, exame_id UUID) ON COMMIT DROP;
${exclusoes.length ? `INSERT INTO _unif_exclusoes VALUES\n${linhasValues(exclusoes.map(e => `${sqlUuid(e.payorId)}, ${sqlUuid(e.exameId)}`))};` : ''}

CREATE TEMP TABLE _unif_valores (payor_id UUID, exame_id UUID, valor NUMERIC) ON COMMIT DROP;
${
  valoresExame.length
    ? `INSERT INTO _unif_valores VALUES\n${linhasValues(
        valoresExame.map(v => `${sqlUuid(v.payorId)}, ${sqlUuid(v.exameId)}, ${sqlNumero(v.valor)}`)
      )};`
    : ''
}

DO $unif$
DECLARE
  diferencas INTEGER;
BEGIN
  WITH atuais AS (
    SELECT f.id, f.fonte_pagadora, f.tabela_associada, f.tuss, f.exame_id,
           f.valor::numeric, f.atendido, f.elegivel_desconto_particular
    FROM public.custo_fontes_pagadoras f
    JOIN _unif_tabelas t ON t.fonte_pagadora = f.fonte_pagadora AND t.nome = f.tabela_associada
  )
  SELECT count(*) INTO diferencas FROM (
    (SELECT * FROM atuais EXCEPT SELECT * FROM _unif_linhas)
    UNION ALL
    (SELECT * FROM _unif_linhas EXCEPT SELECT * FROM atuais)
  ) d;
  IF diferencas > 0 THEN
    RAISE EXCEPTION 'Unificação: % linha(s) das tabelas do mapa mudaram desde o levantamento. Gere a migração de novo (supabase/scripts/unificar-tabelas-associadas.ts).', diferencas;
  END IF;

  SELECT count(*) INTO diferencas FROM (
    ((SELECT payor_id, exame_id FROM public.custo_fontes_pagadoras_exclusoes WHERE payor_id IN (SELECT id FROM _unif_linhas))
      EXCEPT SELECT * FROM _unif_exclusoes)
    UNION ALL
    (SELECT * FROM _unif_exclusoes
      EXCEPT SELECT payor_id, exame_id FROM public.custo_fontes_pagadoras_exclusoes)
  ) d;
  IF diferencas > 0 THEN
    RAISE EXCEPTION 'Unificação: % exclusão(ões) de exame das linhas do mapa mudaram desde o levantamento. Gere a migração de novo.', diferencas;
  END IF;

  SELECT count(*) INTO diferencas FROM (
    ((SELECT payor_id, exame_id, valor::numeric FROM public.custo_fontes_pagadoras_valores_exame WHERE payor_id IN (SELECT id FROM _unif_linhas))
      EXCEPT SELECT * FROM _unif_valores)
    UNION ALL
    (SELECT * FROM _unif_valores
      EXCEPT SELECT payor_id, exame_id, valor::numeric FROM public.custo_fontes_pagadoras_valores_exame)
  ) d;
  IF diferencas > 0 THEN
    RAISE EXCEPTION 'Unificação: % valor(es) personalizado(s) das linhas do mapa mudaram desde o levantamento. Gere a migração de novo.', diferencas;
  END IF;
END $unif$;`;
}

function sqlOperacoes(op: OperacoesUnificacao): string {
  const partes: string[] = [];

  if (op.criarTabelas.length) {
    partes.push(`INSERT INTO public.custo_tabelas_associadas (fonte_pagadora, nome) VALUES
${linhasValues(op.criarTabelas.map(t => `${sqlTexto(t.fontePagadora)}, ${sqlTexto(t.nome)}`))}
ON CONFLICT (fonte_pagadora, nome) DO NOTHING;`);
  }
  if (op.remapearExclusoes.length) {
    partes.push(`INSERT INTO public.custo_fontes_pagadoras_exclusoes (payor_id, exame_id) VALUES
${linhasValues(op.remapearExclusoes.map(e => `${sqlUuid(e.para)}, ${sqlUuid(e.exameId)}`))}
ON CONFLICT (payor_id, exame_id) DO NOTHING;`);
  }
  if (op.remapearValores.length) {
    partes.push(`INSERT INTO public.custo_fontes_pagadoras_valores_exame (payor_id, exame_id, valor) VALUES
${linhasValues(op.remapearValores.map(v => `${sqlUuid(v.para)}, ${sqlUuid(v.exameId)}, ${sqlNumero(v.valor)}`))}
ON CONFLICT (payor_id, exame_id) DO NOTHING;`);
  }
  // Antes de apontar: a linha que fica e a que sai têm o mesmo TUSS/exame.
  if (op.removerLinhas.length) {
    partes.push(`DELETE FROM public.custo_fontes_pagadoras WHERE id IN (${listaUuid(op.removerLinhas)});`);
  }

  const porDestino = new Map<string, string[]>();
  op.apontarLinhas.forEach(a => {
    const chave = JSON.stringify([a.fontePagadora, a.destino]);
    porDestino.set(chave, [...(porDestino.get(chave) ?? []), a.linhaId]);
  });
  for (const [chave, ids] of porDestino) {
    const [fonte, destino] = JSON.parse(chave) as [string, string];
    partes.push(`UPDATE public.custo_fontes_pagadoras f
SET tabela_associada_id = t.id, tabela_associada = t.nome
FROM public.custo_tabelas_associadas t
WHERE t.fonte_pagadora = ${sqlTexto(fonte)} AND t.nome = ${sqlTexto(destino)}
  AND f.id IN (${listaUuid(ids)});`);
  }

  op.removerTabelas.forEach(t =>
    partes.push(
      `DELETE FROM public.custo_tabelas_associadas WHERE fonte_pagadora = ${sqlTexto(t.fontePagadora)} AND nome = ${sqlTexto(t.nome)};`
    )
  );
  return partes.join('\n\n');
}

/** Depois de aplicar: unicidade, texto = cadastro e o preço de cada escolha. */
function sqlConferencia(entrada: EntradaUnificacao): string {
  const escolhidas = entrada.escolhas.map(e => {
    const linha = entrada.linhas.find(
      l => l.fontePagadora === e.fontePagadora && l.tabelaAssociada === e.fica && chaveDaLinha(l) === chaveDaLinha(e)
    );
    if (!linha) {
      throw new Error(`Escolha sem linha: "${e.fica}" (${e.fontePagadora}) não tem ${e.exameId ? `o exame ${e.exameId}` : `o TUSS ${e.tuss}`}.`);
    }
    return `${sqlUuid(linha.id)}, ${sqlTexto(e.fontePagadora)}, ${sqlTexto(e.destino)}, ${sqlNumero(linha.valor)}, ${linha.atendido}, ${linha.elegivelDescontoParticular}`;
  });

  // Só os destinos: nada fora do mapa é responsabilidade desta migração.
  const destinos = entrada.mapa.map(g => `(${sqlTexto(g.fontePagadora)}, ${sqlTexto(g.destino)})`).join(', ');

  return `DO $unif$
DECLARE
  problemas INTEGER;
BEGIN
  SELECT count(*) INTO problemas FROM (
    SELECT f.tabela_associada_id, CASE WHEN f.exame_id IS NULL THEN 'tuss:' || btrim(f.tuss) ELSE 'exame:' || f.exame_id END
    FROM public.custo_fontes_pagadoras f
    JOIN public.custo_tabelas_associadas t ON t.id = f.tabela_associada_id
    WHERE (t.fonte_pagadora, t.nome) IN (${destinos})
    GROUP BY 1, 2 HAVING count(*) > 1
  ) d;
  IF problemas > 0 THEN
    RAISE EXCEPTION 'Unificação: % par(es) (tabela, TUSS) ou (tabela, exame) duplicado(s) nas tabelas de destino.', problemas;
  END IF;

  SELECT count(*) INTO problemas
  FROM public.custo_fontes_pagadoras f
  JOIN public.custo_tabelas_associadas t ON t.id = f.tabela_associada_id
  WHERE t.nome <> f.tabela_associada OR t.fonte_pagadora <> f.fonte_pagadora;
  IF problemas > 0 THEN
    RAISE EXCEPTION 'Unificação: % linha(s) com texto da tabela diferente do cadastro.', problemas;
  END IF;

  SELECT count(*) INTO problemas
  FROM public.custo_tabelas_associadas t
  JOIN _unif_tabelas u ON u.fonte_pagadora = t.fonte_pagadora AND u.nome = t.nome
  WHERE (u.fonte_pagadora, u.nome) NOT IN (${destinos});
  IF problemas > 0 THEN
    RAISE EXCEPTION 'Unificação: % cadastro(s) de origem não foram removidos.', problemas;
  END IF;
${
  escolhidas.length
    ? `
  SELECT count(*) INTO problemas
  FROM (VALUES
${escolhidas.map(e => `    (${e})`).join(',\n')}
  ) AS e(linha_id, fonte_pagadora, destino, valor, atendido, elegivel)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.custo_fontes_pagadoras f
    JOIN public.custo_tabelas_associadas t ON t.id = f.tabela_associada_id
    WHERE f.id = e.linha_id AND t.fonte_pagadora = e.fonte_pagadora AND t.nome = e.destino
      AND f.valor::numeric = e.valor AND f.atendido = e.atendido
      AND f.elegivel_desconto_particular = e.elegivel
  );
  IF problemas > 0 THEN
    RAISE EXCEPTION 'Unificação: % escolha(s) de preço não ficaram na tabela de destino.', problemas;
  END IF;
`
    : ''
}END $unif$;`;
}

function gerarMigracao(entrada: EntradaUnificacao, op: OperacoesUnificacao, nomeArquivo: string): string {
  const resumo = entrada.mapa
    // JSON.stringify: nome com quebra de linha não escapa do comentário.
    .map(g => `--   ${JSON.stringify(g.fontePagadora)}: ${g.origens.map(o => JSON.stringify(o)).join(', ')} → ${JSON.stringify(g.destino)}`)
    .join('\n');
  return `-- ═══════════════════════════════════════════════════════════════════════════════
-- Controle de Custos — unificação das tabelas associadas duplicadas
-- Migration: ${nomeArquivo}
--
-- Spec: .scratch/controle-custos-tabela-associada/spec.md (ticket 06).
-- GERADA por supabase/scripts/unificar-tabelas-associadas.ts a partir do mapa
-- e das escolhas de preço do faturamento (ticket 05) — não editar à mão;
-- se as linhas mudarem, a conferência inicial aborta e é preciso gerar de novo.
--
-- Mapa de junção:
${resumo}
--
-- ${op.apontarLinhas.length} linha(s) apontadas para o destino, ${op.removerLinhas.length} removida(s),
-- ${op.remapearExclusoes.length} exclusão(ões) e ${op.remapearValores.length} valor(es) personalizado(s) passados
-- para a linha que fica, ${entrada.escolhas.length} escolha(s) de preço.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. O banco ainda tem o que o plano leu
${sqlSnapshot(entrada)}

-- 2. Regras do cadastro e sincronia das linhas desligadas durante a junção:
--    a Tabela Particular protegida pode ser uma das juntadas, e o destino pode
--    estar inativo. Id e texto da linha são gravados juntos abaixo.
ALTER TABLE public.custo_tabelas_associadas DISABLE TRIGGER trigger_custo_tabelas_associadas_regras;
ALTER TABLE public.custo_fontes_pagadoras DISABLE TRIGGER trigger_custo_fontes_pagadoras_sincroniza_tabela_associada;

-- 3. Junção
${sqlOperacoes(op)}

ALTER TABLE public.custo_fontes_pagadoras ENABLE TRIGGER trigger_custo_fontes_pagadoras_sincroniza_tabela_associada;
ALTER TABLE public.custo_tabelas_associadas ENABLE TRIGGER trigger_custo_tabelas_associadas_regras;

-- 4. Conferência
${sqlConferencia(entrada)}
`;
}

async function main() {
  const { mapa, escolhas } = JSON.parse(readFileSync(caminhoMapa, 'utf8')) as {
    mapa: GrupoJuncao[];
    escolhas: EscolhaPreco[];
  };
  const errosMapa = validarMapa(mapa, escolhas);
  if (errosMapa.length) {
    errosMapa.forEach(e => console.error(e));
    process.exit(1);
  }

  const [linhasBanco, exclusoes, valoresExame] = await lerDados();
  const doMapa = new Set(mapa.flatMap(g => [g.destino, ...g.origens].map(n => JSON.stringify([g.fontePagadora, n]))));
  const linhas: LinhaUnificacao[] = linhasBanco
    .filter(l => doMapa.has(JSON.stringify([l.fonte_pagadora, l.tabela_associada])))
    .map(l => ({
      id: l.id,
      fontePagadora: l.fonte_pagadora,
      tabelaAssociada: l.tabela_associada,
      tuss: l.tuss,
      exameId: l.exame_id,
      valor: Number(l.valor),
      atendido: l.atendido,
      elegivelDescontoParticular: l.elegivel_desconto_particular,
    }));
  const entrada: EntradaUnificacao = {
    linhas,
    exclusoes: exclusoes.map(e => ({ payorId: e.payor_id, exameId: e.exame_id })),
    valoresExame: valoresExame.map(v => ({ payorId: v.payor_id, exameId: v.exame_id, valor: Number(v.valor) })),
    mapa,
    escolhas,
  };

  const plano = planejarUnificacao(entrada);
  if (plano.tipo === 'bloqueado') {
    console.error(`${plano.conflitos.length} conflito(s) sem escolha — a migração não foi gerada:\n`);
    for (const c of plano.conflitos) {
      console.error(`${c.fontePagadora} → "${c.destino}" · ${c.exameId ? `exame ${c.exameId}` : `TUSS ${c.tuss}`}`);
      c.opcoes.forEach(o =>
        console.error(
          `    "${o.tabela}": R$ ${o.valor} · atendido ${o.atendido ? 'sim' : 'não'} · desconto particular ${o.elegivelDescontoParticular ? 'sim' : 'não'}`
        )
      );
    }
    process.exit(2);
  }

  const nomeArquivo = caminhoSaida?.split('/').pop() ?? '<sem arquivo>';
  const sql = gerarMigracao(entrada, plano.operacoes, nomeArquivo);
  if (caminhoSaida) {
    writeFileSync(caminhoSaida, sql);
    console.log(`Migração gravada em ${caminhoSaida}`);
  } else {
    console.log(sql);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
