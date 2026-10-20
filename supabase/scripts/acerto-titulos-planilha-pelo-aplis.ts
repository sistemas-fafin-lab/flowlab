#!/usr/bin/env -S npx tsx
// supabase/scripts/acerto-titulos-planilha-pelo-aplis.ts
//
// Gera a migration que acerta pelo apLIS os títulos importados da planilha do
// cliente (backfills Jan–Jun e Jul–Set/2026). Esses títulos levaram o "Valor
// Enviado", a baixa e a glosa da planilha, que em ~530 deles não batem com o
// apLIS — e o apLIS é o correto (decisão do usuário em 20/10/2026, ver
// .scratch/faturamento-acerto-titulos-aplis/relatorio.md).
//
// Somente LEITURA: lê o Supabase (service role) e o MySQL de backup do apLIS e
// escreve dois arquivos — a migration (dados fixos, conferida antes de aplicar)
// e o relatório CSV por título. Não grava em banco nenhum.
//
// Por título não cancelado, com todos os lotes no apLIS e criado pela planilha
// (`notas.observacoes` "Backfill planilha…"):
//   - valor do título e dos lotes = Σ ValorLiquido do apLIS;
//   - baixas da planilha (status recebido/parcial) saem; entram as do apLIS, uma
//     por data de recebimento (`baixasSugeridas`, a regra do "Aplicar baixas do
//     apLIS"), descontadas as baixas lançadas no sistema que ficam;
//   - baixa repetida (mesmo valor e data, lançada com menos de 1 min de
//     diferença) sai;
//   - glosas da planilha saem; entram as do apLIS (`glosasSugeridas`, a regra do
//     "Aplicar baixas e glosas do apLIS"), com origem = 'aplis'.
// Título que, depois disso, ainda teria recebido a mais que o apLIS ou glosa
// pulada não muda em nada: vai para o relatório como "manual".
//
// Variáveis de ambiente:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (leitura dos títulos)
//   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME   (leitura do apLIS)
//
// Uso:
//   npx tsx supabase/scripts/acerto-titulos-planilha-pelo-aplis.ts <migration.sql> <relatorio.csv>

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import mysql from 'mysql2/promise';
import { getSupabaseAdminClient } from '../../api/_lib/supabase.js';
import { diferencasDosLotes, recebidosDosLotes, recebidosPorDataDosLotes } from '../../api/_lib/faturamento/bdLab.js';
import { baixasSugeridas } from '../../api/_lib/faturamento/baixasAplis.js';
import type { BaixaSugerida, RecebidoAplisNaData } from '../../api/_lib/faturamento/baixasAplis.js';
import { centavos, classificarDivergencia, somaCentavos } from '../../api/_lib/faturamento/conferenciaAplis.js';
import { glosasSugeridas } from '../../api/_lib/faturamento/glosasAplis.js';
import type { GlosaSistema, GlosaSugerida } from '../../api/_lib/faturamento/glosasAplis.js';

const [arquivoSql, arquivoCsv] = process.argv.slice(2);
if (!arquivoSql || !arquivoCsv) {
  console.error('Uso: acerto-titulos-planilha-pelo-aplis.ts <migration.sql> <relatorio.csv>');
  process.exit(2);
}

const DATA_ACERTO = '20/10/2026';
const RESPONSAVEL = `Acerto pelo apLIS (${DATA_ACERTO})`;
const TOLERANCIA = 100; // centavos
const DUPLICADA_MS = 60_000;

const planilhaNota = (obs: string | null) => /Backfill planilha/i.test(obs ?? '');
const planilhaBaixa = (obs: string | null) => /^Backfill planilha/i.test(obs ?? '');
const planilhaGlosa = (g: Glosa) => g.origem === null && /backfill planilha/i.test(g.motivo ?? '');

interface Nota {
  id_nota: string; numero_nota: string | null; status: string; data_emissao: string | null; data_vencimento: string | null;
  valor_total: number; valor_recebido: number; valor_glosado: number; observacoes: string | null;
  operadoras: { nome: string } | null;
}
interface Receb { id_receb: string; nota_id: string; data_receb: string | null; valor_recebido: number; status: string; observacoes: string | null; created_at: string }
interface Glosa { id_glosa: string; nota_id: string; lote_id: string | null; valor: number; motivo: string | null; codigo_glosa: string | null; status: GlosaSistema['status']; origem: string | null }
interface Lote { id_lote: string; aplis_id: string | null; valor_total: number }

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

/** Σ ValorLiquido por lote — o valor do lote no apLIS (o mesmo `VlrLote` da tela de lotes). */
async function liquidoDosLotes(ids: number[]): Promise<Map<number, number>> {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 3306), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME ?? 'lab',
  });
  try {
    const [linhas] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT r.Lote AS IdLote, SUM(p.ValorLiquido) AS Liquido
         FROM requisicao r JOIN fatrequisicaoprocedimento p ON p.IdRequisicao = r.IdRequisicao
        WHERE r.Lote IN (?) GROUP BY r.Lote`, [ids]);
    return new Map(linhas.map((l) => [Number(l.IdLote), Number(l.Liquido)]));
  } finally {
    await conn.end();
  }
}

const sqlTexto = (v: string | null) => (v === null ? 'NULL' : `'${v.replace(/'/g, "''")}'`);
const sqlValor = (c: number) => (c / 100).toFixed(2);
const brl = (c: number) => (c / 100).toFixed(2).replace('.', ',');

async function main() {
  const num = (v: unknown) => Number(v ?? 0);
  const notas = (await todas<Nota>('notas', 'id_nota, numero_nota, status, data_emissao, data_vencimento, valor_total, valor_recebido, valor_glosado, observacoes, created_at, operadoras(nome)'))
    .filter((n) => n.status !== 'cancelada' && planilhaNota(n.observacoes));
  const vinculos = await todas<{ id_nota: string; id_lote: string }>('nota_lote', 'id_nota, id_lote, created_at');
  const lotes = new Map((await todas<Lote>('lotes', 'id_lote, aplis_id, valor_total, created_at')).map((l) => [l.id_lote, l]));
  const recebs = await todas<Receb>('recebimentos', 'id_receb, nota_id, data_receb, valor_recebido, status, observacoes, created_at');
  const glosas = await todas<Glosa>('glosas', 'id_glosa, nota_id, lote_id, valor, motivo, codigo_glosa, status, origem, created_at');

  const lotesDaNota = new Map<string, Lote[]>();
  for (const v of vinculos) lotesDaNota.set(v.id_nota, [...(lotesDaNota.get(v.id_nota) ?? []), lotes.get(v.id_lote)!]);
  const porNota = <T extends { nota_id: string }>(lista: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of lista) m.set(x.nota_id, [...(m.get(x.nota_id) ?? []), x]);
    return m;
  };
  const recebsDaNota = porNota(recebs);
  const glosasDaNota = porNota(glosas);

  const candidatas = notas.filter((n) => {
    const ls = lotesDaNota.get(n.id_nota) ?? [];
    return ls.length > 0 && ls.every((l) => Number(l.aplis_id) > 0);
  });
  const ids = [...new Set(candidatas.flatMap((n) => lotesDaNota.get(n.id_nota)!.map((l) => Number(l.aplis_id))))];

  const recebidos = await recebidosDosLotes(ids);
  const porData = await recebidosPorDataDosLotes(ids);
  const diferencas = await diferencasDosLotes(ids);
  if ('erro' in recebidos || 'erro' in porData || 'erro' in diferencas) throw new Error('Falha ao ler o apLIS.');
  const liquido = await liquidoDosLotes(ids);

  const sql: string[] = [];
  const conferencia: string[] = [];
  const csv: string[][] = [['id_nota', 'numero_nota', 'operadora', 'emissao', 'lotes', 'resultado', 'motivo',
    'valor_antes', 'valor_depois', 'recebido_antes', 'recebido_depois', 'recebido_aplis', 'glosa_antes', 'glosa_depois',
    'baixas_removidas', 'baixas_novas', 'glosas_removidas', 'glosas_novas']];
  const resumo = { acertados: 0, manuais: 0, semMudanca: 0, valor: 0, recebido: 0, glosa: 0 };

  for (const nota of candidatas) {
    const ls = lotesDaNota.get(nota.id_nota)!;
    const idsLote = ls.map((l) => Number(l.aplis_id));
    if (idsLote.some((id) => !recebidos.porLote[id] || !liquido.has(id))) continue;
    const loteUuid = Object.fromEntries(ls.map((l) => [Number(l.aplis_id), l.id_lote]));

    const conta = (r: Receb) => r.status === 'recebido' || r.status === 'parcial';
    const baixas = (recebsDaNota.get(nota.id_nota) ?? []).filter(conta);
    // Baixa repetida: mesma data e valor, gravada menos de 1 min depois da outra.
    const repetidas = baixas.filter((b, i) => baixas.slice(0, i).some((a) => a.data_receb === b.data_receb
      && centavos(num(a.valor_recebido)) === centavos(num(b.valor_recebido))
      && Math.abs(Date.parse(b.created_at) - Date.parse(a.created_at)) < DUPLICADA_MS));
    const saemBaixas = baixas.filter((b) => planilhaBaixa(b.observacoes) || repetidas.includes(b));
    const ficamBaixas = baixas.filter((b) => !saemBaixas.includes(b));
    const glosasNota = glosasDaNota.get(nota.id_nota) ?? [];
    const saemGlosas = glosasNota.filter(planilhaGlosa);
    const ficamGlosas = glosasNota.filter((g) => !saemGlosas.includes(g));

    const valorAplis = idsLote.reduce((s, id) => s + centavos(liquido.get(id)!), 0);
    const recebidoAplis = idsLote.reduce((s, id) => s + centavos(recebidos.porLote[id].recebido), 0);
    const recebidoFica = somaCentavos(ficamBaixas.map((b) => ({ valor: num(b.valor_recebido) })));
    const tipo = classificarDivergencia(recebidoFica / 100, recebidoAplis / 100);

    let novasBaixas: BaixaSugerida[] = [];
    if (tipo === 'so-no-aplis' || tipo === 'aplis-maior') {
      const datas = new Map<string, RecebidoAplisNaData>();
      for (const id of idsLote) {
        for (const { data, valor } of porData.porLote[id] ?? []) {
          const d = datas.get(data) ?? { data, valor: 0, lotes: [] };
          d.valor = (centavos(d.valor) + centavos(valor)) / 100;
          d.lotes.push(id);
          datas.set(data, d);
        }
      }
      novasBaixas = baixasSugeridas({
        tipo, recebidoSistema: recebidoFica / 100, recebidoAplis: recebidoAplis / 100,
        recebidoAplisPorData: [...datas.values()],
        baixasSistema: ficamBaixas.filter((b) => b.data_receb).map((b) => ({ data: b.data_receb!, valor: num(b.valor_recebido) })),
      });
      // Recebido no apLIS sem `DtaRecebido`: a regra do botão pula; aqui a baixa
      // da planilha sai, então a diferença entra na data dela.
      const dataPlanilha = saemBaixas.map((b) => b.data_receb).filter(Boolean).sort().pop();
      if (novasBaixas.length === 0 && dataPlanilha) {
        novasBaixas = [{
          data: dataPlanilha,
          valor: (recebidoAplis - recebidoFica) / 100,
          observacoes: `Baixa do apLIS — lote(s) ${idsLote.join(', ')} (sem data de recebimento no apLIS; data da planilha)`,
        }];
      }
    }
    const recebidoDepois = recebidoFica + somaCentavos(novasBaixas);
    const tipoDepois = classificarDivergencia(recebidoDepois / 100, recebidoAplis / 100);
    const glosadoFica = somaCentavos(ficamGlosas.filter((g) => g.status !== 'revertida').map((g) => ({ valor: num(g.valor) })));
    const { glosas: glosasDoAplis, puladoGlosa } = glosasSugeridas({
      tipo: tipoDepois,
      saldo: (valorAplis - recebidoDepois - glosadoFica) / 100,
      glosasSistema: ficamGlosas.map((g) => ({
        origem: g.origem === 'aplis' ? 'aplis' : null,
        idLote: Number(ls.find((l) => l.id_lote === g.lote_id)?.aplis_id ?? NaN) || null,
        codigo: g.codigo_glosa, motivo: g.motivo ?? '', status: g.status, valor: num(g.valor),
      })),
      diferencas: idsLote.flatMap((id) => diferencas.porLote[id] ?? []),
    });
    // Glosas que passam do saldo (o apLIS recebeu a mais em outros procedimentos
    // do lote): o título leva valor e baixas do apLIS, e a glosa fica para o operador.
    const novasGlosas = puladoGlosa === 'passa-do-saldo' ? [] : glosasDoAplis;
    const glosaDepois = glosadoFica + somaCentavos(novasGlosas);
    const glosaAntes = centavos(num(nota.valor_glosado));

    const linha = (resultado: string, motivo: string) => csv.push([nota.id_nota, nota.numero_nota ?? '', nota.operadoras?.nome ?? '',
      nota.data_emissao ?? '', idsLote.join('+'), resultado, motivo,
      brl(centavos(num(nota.valor_total))), brl(valorAplis), brl(centavos(num(nota.valor_recebido))), brl(recebidoDepois),
      brl(recebidoAplis), brl(glosaAntes), brl(glosaDepois),
      saemBaixas.map((b) => `${b.data_receb} ${brl(centavos(num(b.valor_recebido)))}`).join(' | '),
      novasBaixas.map((b) => `${b.data} ${brl(centavos(b.valor))}`).join(' | '),
      saemGlosas.map((g) => `${g.status} ${brl(centavos(num(g.valor)))}`).join(' | '),
      novasGlosas.map((g) => `${g.status} ${g.codigo ?? ''} ${brl(centavos(g.valor))}`).join(' | ')]);

    const mudaValor = Math.abs(valorAplis - centavos(num(nota.valor_total))) >= TOLERANCIA
      || ls.some((l) => centavos(num(l.valor_total)) !== centavos(liquido.get(Number(l.aplis_id))!));
    const mudaRecebido = Math.abs(recebidoAplis - centavos(num(nota.valor_recebido))) >= TOLERANCIA;
    const mudaGlosa = saemGlosas.length > 0 || novasGlosas.length > 0;
    if (!mudaValor && !mudaRecebido && !mudaGlosa && repetidas.length === 0) {
      resumo.semMudanca++;
      continue;
    }
    // Sobra recebido a mais que o apLIS em baixa lançada no sistema: só o operador sabe qual está errada.
    if (tipoDepois === 'sistema-maior') {
      resumo.manuais++;
      linha('manual', 'baixa lançada no sistema passa do recebido no apLIS');
      continue;
    }
    if (puladoGlosa === 'glosa-manual') {
      resumo.manuais++;
      linha('manual', 'tem glosa digitada à mão');
      continue;
    }

    resumo.acertados++;
    resumo.valor += valorAplis - centavos(num(nota.valor_total));
    resumo.recebido += recebidoDepois - centavos(num(nota.valor_recebido));
    resumo.glosa += glosaDepois - glosaAntes;
    linha('acertado', puladoGlosa === 'sem-motivo' ? 'diferença sem motivo no apLIS fica em aberto'
      : puladoGlosa === 'passa-do-saldo' ? 'glosas do apLIS passam do saldo: glosa fica para conferir' : '');

    const id = sqlTexto(nota.id_nota);
    sql.push(`-- ${nota.numero_nota ? `NF ${nota.numero_nota}` : 'sem número'} | ${nota.operadoras?.nome ?? ''} | lote(s) ${idsLote.join(', ')}`);
    if (saemGlosas.length) sql.push(`DELETE FROM glosas WHERE id_glosa IN (${saemGlosas.map((g) => sqlTexto(g.id_glosa)).join(', ')});`);
    if (saemBaixas.length) sql.push(`DELETE FROM recebimentos WHERE id_receb IN (${saemBaixas.map((b) => sqlTexto(b.id_receb)).join(', ')});`);
    for (const l of ls) {
      const v = centavos(liquido.get(Number(l.aplis_id))!);
      if (centavos(num(l.valor_total)) !== v) sql.push(`UPDATE lotes SET valor_total = ${sqlValor(v)} WHERE id_lote = ${sqlTexto(l.id_lote)};`);
    }
    if (centavos(num(nota.valor_total)) !== valorAplis) sql.push(`UPDATE notas SET valor_total = ${sqlValor(valorAplis)} WHERE id_nota = ${id};`);
    for (const b of novasBaixas) {
      sql.push('INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status)'
        + ` VALUES (${id}, ${nota.data_vencimento ? `DATE '${nota.data_vencimento}'` : `DATE '${b.data}'`}, DATE '${b.data}', ${sqlValor(centavos(b.valor))}, ${sqlValor(centavos(b.valor))}, 'recebido', ${sqlTexto(b.observacoes)}, ${sqlTexto(RESPONSAVEL)}, 'pendente');`);
    }
    for (const g of novasGlosas as GlosaSugerida[]) {
      sql.push('INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem)'
        + ` VALUES (${id}, ${sqlTexto(loteUuid[g.idLote])}, ${sqlValor(centavos(g.valor))}, ${sqlTexto(g.motivo)}, ${sqlTexto(g.codigo)}, '${g.status}', ${sqlTexto(RESPONSAVEL)}, 'aplis');`);
    }
    sql.push(`SELECT fat_recalcular_nota(${id});`, '');
    conferencia.push(`(${id}::uuid, ${sqlValor(valorAplis)}, ${sqlValor(recebidoDepois)}, ${sqlValor(glosaDepois)})`);
  }

  const cabecalho = `-- ============================================================================
-- Contas a Receber: títulos da planilha acertados pelo apLIS (${DATA_ACERTO})
--
-- Gerada por supabase/scripts/acerto-titulos-planilha-pelo-aplis.ts com o
-- Supabase de produção e o apLIS (backup MySQL) lidos em ${DATA_ACERTO}. Os
-- backfills Jan–Jun e Jul–Set/2026 gravaram o valor, a baixa e a glosa da
-- planilha do cliente; nos títulos abaixo eles não batem com o apLIS, que é o
-- correto (.scratch/faturamento-acerto-titulos-aplis/relatorio.md).
--
-- Por título: valor do título/lote = apLIS; baixas e glosas da planilha saem;
-- baixa repetida sai; entram as baixas (uma por data de recebimento) e as
-- glosas (origem 'aplis') do apLIS. Títulos com baixa ou glosa digitada que
-- não fecha com o apLIS ficaram de fora (relatório, "manual").
--
-- ${resumo.acertados} títulos. Diferenças: valor ${brl(resumo.valor)}, recebido ${brl(resumo.recebido)}, glosa ${brl(resumo.glosa)}.
--
-- Os ids são de produção: no projeto de teste os DELETE/UPDATE não acham nada e
-- a conferência do fim aborta. Tudo numa transação; qualquer divergência na
-- conferência desfaz tudo.
-- ============================================================================

BEGIN;
`;
  const rodape = `
-- Conferência: cada título tem de terminar com o valor, o recebido e a glosa do apLIS.
DO $$
DECLARE
  v_errados TEXT;
BEGIN
  SELECT string_agg(e.id::text, ', ')
    INTO v_errados
    FROM (VALUES
      ${conferencia.join(',\n      ')}
    ) AS e(id, valor, recebido, glosado)
    LEFT JOIN notas n ON n.id_nota = e.id
   WHERE n.id_nota IS NULL
      OR n.valor_total <> e.valor
      OR n.valor_recebido <> e.recebido
      OR n.valor_glosado <> e.glosado;
  IF v_errados IS NOT NULL THEN
    RAISE EXCEPTION 'Acerto pelo apLIS: títulos fora do esperado (os dados mudaram desde a geração?): %', v_errados;
  END IF;
END $$;

COMMIT;
`;
  writeFileSync(arquivoSql, cabecalho + '\n' + sql.join('\n') + rodape);
  writeFileSync(arquivoCsv, '﻿' + csv.map((l) => l.map((x) => (/[;"\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(';')).join('\n'));
  console.log({ ...resumo, valor: brl(resumo.valor), recebido: brl(resumo.recebido), glosa: brl(resumo.glosa) });
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
