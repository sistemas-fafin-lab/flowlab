#!/usr/bin/env -S npx tsx
// supabase/scripts/backfill-requisicoes-contas-receber-q3-2026.ts
//
// Segunda etapa do backfill histórico de Contas a Receber Jul/Ago/Set 2026
// (ver migration supabase/migrations/20260911100000_backfill_contas_receber_q3_2026.sql,
// que precisa ter rodado ANTES deste script).
//
// A planilha do cliente ("Faturamento x Recebimentos - 2026 - 3° Trimestre.xlsx")
// tem 1 linha por lote, sem quebra por guia/paciente/procedimento. Essa
// informação existe de verdade no apLIS (MySQL de backup, somente leitura) e é
// PII (nome de paciente) — por isso não entra na migration SQL versionada:
// este script busca ao vivo no apLIS e grava direto no Supabase, sem nunca
// persistir nome de paciente em nenhum arquivo do repositório.
//
// Reaproveita `detalharVariosLotes` de api/_lib/faturamento/bdLab.ts — a
// mesma função que a tela ao vivo (/faturamento/faturas) usa para o
// drill-down lote → requisições → procedimentos — em vez de duplicar a
// query. Ver bdLab.ts para as armadilhas de schema já documentadas
// (guia por subconsulta, não JOIN; DECIMAL como string; etc).
//
// Idempotente: upsert em `requisicoes` por `aplis_id` (IdRequisicao do
// apLIS) — pode rodar de novo sem duplicar.
//
// Variáveis de ambiente necessárias:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (escrita no Supabase)
//   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME   (leitura no apLIS/MySQL,
//     mesmas usadas por api/_lib/faturamento/bdLab.ts)
//
// Uso:
//   npx tsx supabase/scripts/backfill-requisicoes-contas-receber-q3-2026.ts [--dry-run]
//
//   --lotes=A,B,C: processa só esses lotes (ex.: complemento 20260928120000).
//
//   --dry-run: consulta o apLIS e o Supabase normalmente, mas não grava nada
//   em `requisicoes` nem atualiza `lotes.qtd_requisicoes`. Imprime o relatório
//   (contagens, nunca nome de paciente) pra conferir antes de rodar de verdade.

import 'dotenv/config';
import { getSupabaseAdminClient } from '../../api/_lib/supabase.js';
import { detalharVariosLotes, type RequisicaoLote } from '../../api/_lib/faturamento/bdLab.js';

const dryRun = process.argv.includes('--dry-run');

const CHUNK_APLIS = 150; // mesma ordem de grandeza já validada em produção (detalharVariosLotes/filtroLotes)
const CHUNK_UPSERT = 500;

// Os 445 números de lote do apLIS que compõem o backfill Jul/Ago/Set 2026,
// resolvidos a partir da planilha do cliente (por Lote quando batia, por
// Protocolo quando havia erro de digitação no número do lote — ver relatório
// de importação). Não é PII: são apenas identificadores numéricos internos
// do apLIS (fatlote.IdLote), a mesma chave usada em `lotes.aplis_id`. Já
// exclui os 15 lotes que as tentativas de rodar a migration em produção (e
// a pré-checagem via SELECT que evitou repetir o processo um a um) revelaram
// já terem título real cadastrado no sistema (colisão de aplis_id) — esses
// já têm requisições reais geradas pelo fluxo operacional, não precisam
// (e não devem) passar por este script.
const LOTES_APLIS_BACKFILL: number[] = [
  3930, 3992, 4033, 4421, 4826, 4827, 4828, 4898, 4902, 4905, 4947, 4950, 4951, 4954, 4989, 5135,
  5179, 5258, 5347, 5370, 5371, 5406, 5424, 5429, 5456, 5461, 5746, 5894, 5969, 5971, 6111, 6112,
  6116, 6120, 6124, 6127, 6136, 6156, 6162, 6179, 6180, 6181, 6182, 6183, 6194, 6196, 6198, 6199,
  6200, 6201, 6202, 6204, 6205, 6206, 6207, 6208, 6209, 6210, 6211, 6212, 6215, 6216, 6217, 6219,
  6220, 6221, 6222, 6223, 6224, 6227, 6228, 6230, 6231, 6235, 6236, 6237, 6238, 6239, 6240, 6241,
  6242, 6243, 6244, 6246, 6247, 6250, 6252, 6254, 6255, 6256, 6257, 6258, 6259, 6260, 6262, 6263,
  6264, 6266, 6267, 6271, 6272, 6274, 6276, 6277, 6279, 6280, 6281, 6283, 6284, 6285, 6286, 6287,
  6288, 6289, 6291, 6292, 6293, 6294, 6295, 6296, 6297, 6298, 6299, 6300, 6301, 6302, 6303, 6304,
  6306, 6307, 6308, 6309, 6310, 6312, 6313, 6314, 6315, 6316, 6317, 6318, 6319, 6320, 6321, 6322,
  6323, 6324, 6325, 6327, 6328, 6329, 6332, 6335, 6338, 6339, 6341, 6342, 6343, 6349, 6350, 6351,
  6352, 6353, 6354, 6356, 6358, 6359, 6363, 6364, 6365, 6366, 6367, 6369, 6374, 6375, 6377, 6378,
  6380, 6381, 6382, 6383, 6384, 6385, 6387, 6388, 6389, 6390, 6391, 6392, 6393, 6395, 6397, 6398,
  6399, 6400, 6401, 6402, 6403, 6404, 6405, 6406, 6407, 6410, 6411, 6413, 6414, 6415, 6416, 6417,
  6418, 6419, 6420, 6422, 6423, 6426, 6427, 6429, 6430, 6431, 6432, 6434, 6435, 6436, 6437, 6441,
  6442, 6443, 6444, 6445, 6446, 6447, 6450, 6453, 6454, 6458, 6459, 6460, 6461, 6463, 6464, 6465,
  6466, 6474, 6475, 6476, 6478, 6481, 6482, 6483, 6484, 6485, 6486, 6488, 6489, 6490, 6491, 6492,
  6493, 6494, 6495, 6496, 6497, 6500, 6501, 6503, 6504, 6505, 6506, 6507, 6509, 6511, 6512, 6513,
  6514, 6515, 6516, 6517, 6518, 6519, 6520, 6521, 6522, 6523, 6524, 6525, 6529, 6530, 6531,
  6532, 6533, 6534, 6535, 6538, 6539, 6540, 6542, 6543, 6545, 6546, 6547, 6548, 6553, 6554,
  6556, 6557, 6558, 6562, 6565, 6566, 6567, 6568, 6569, 6570, 6571, 6572, 6573, 6574, 6575, 6576,
  6579, 6580, 6581, 6582, 6583, 6586, 6588, 6589, 6590, 6591, 6592, 6593, 6594, 6595, 6596,
  6597, 6600, 6601, 6603, 6605, 6606, 6607, 6608, 6609, 6612, 6616, 6617, 6618, 6623, 6624, 6625,
  6626, 6627, 6628, 6629, 6630, 6631, 6633, 6634, 6635, 6636, 6638, 6639, 6640, 6641, 6642, 6643,
  6644, 6645, 6646, 6647, 6648, 6649, 6650, 6651, 6652, 6653, 6656, 6658, 6659, 6660, 6661, 6662,
  6663, 6664, 6668, 6670, 6671, 6673, 6674, 6676, 6681, 6682, 6685, 6687, 6688, 6690, 6691, 6692,
  6693, 6697, 6698, 6700, 6701, 6702, 6704, 6710, 6712, 6716, 6717, 6718, 6719, 6720, 6721, 6722,
  6723, 6724, 6725, 6726, 6727, 6728, 6729, 6731, 6732, 6735, 6736, 6737, 6738, 6740, 6742, 6745,
  6752, 6753, 6754, 6755, 6756, 6757, 6758, 6759, 6760, 6761, 6762, 6763, 6764, 6765, 6766, 6767,
];

// --lotes=6683,6684,...: processa só estes lotes em vez da lista acima — usado
// pelo complemento 20260928120000 (6 lotes que a migration original excluiu
// por engano).
const argLotes = process.argv.find(a => a.startsWith('--lotes='));
const LOTES_ALVO: number[] = argLotes
  ? argLotes.slice('--lotes='.length).split(',').map(s => Number(s.trim()))
  : LOTES_APLIS_BACKFILL;
if (LOTES_ALVO.length === 0 || LOTES_ALVO.some(n => !Number.isInteger(n) || n <= 0)) {
  console.error(`--lotes inválido: ${argLotes}`);
  process.exit(1);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Resume os procedimentos de uma requisição em texto curto pra colunas
 *  únicas (`requisicoes.procedimento_codigo`/`procedimento_descricao`),
 *  já que o schema alvo é 1 linha por requisição, não por procedimento. */
function resumirProcedimentos(req: RequisicaoLote): { codigo: string | null; descricao: string | null } {
  const procs = req.procedimentos.filter(p => p.codigo || p.descricao);
  if (procs.length === 0) return { codigo: null, descricao: null };
  const codigo = procs.map(p => p.codigo).filter(Boolean).join(', ') || null;
  const descricaoBase = procs.map(p => p.descricao).filter(Boolean);
  const descricao =
    descricaoBase.length <= 3
      ? descricaoBase.join('; ') || null
      : `${descricaoBase.slice(0, 3).join('; ')} e mais ${descricaoBase.length - 3} procedimento(s)`;
  return { codigo, descricao };
}

async function main() {
  console.log(`Backfill de requisições (guias) para ${LOTES_ALVO.length} lotes do Q3/2026...`);
  const supabase = getSupabaseAdminClient();

  console.log('Buscando id_lote no Supabase para os aplis_id conhecidos...');
  const aplisIdStrings = LOTES_ALVO.map(String);
  const loteIdPorAplisId = new Map<string, string>();
  for (const grupo of chunk(aplisIdStrings, 500)) {
    const { data, error } = await supabase.from('lotes').select('id_lote,aplis_id').in('aplis_id', grupo);
    if (error) throw new Error(`Falha ao ler lotes: ${error.message}`);
    for (const row of data ?? []) {
      if (row.aplis_id) loteIdPorAplisId.set(String(row.aplis_id), row.id_lote as string);
    }
  }
  const faltando = aplisIdStrings.filter(id => !loteIdPorAplisId.has(id));
  if (faltando.length > 0) {
    console.warn(
      `⚠ ${faltando.length} lote(s) não encontrados em \`lotes\` — a migration ` +
        `20260911100000_backfill_contas_receber_q3_2026.sql já rodou neste banco? ` +
        `Prosseguindo só com os ${loteIdPorAplisId.size} encontrados.`
    );
  }
  if (loteIdPorAplisId.size === 0) {
    console.error('Nenhum lote do backfill encontrado em `lotes`. Rode a migration SQL primeiro.');
    process.exit(1);
  }

  let totalRequisicoes = 0;
  let lotesSemRequisicao = 0;
  let totalErros = 0;

  for (const grupoIds of chunk(LOTES_ALVO, CHUNK_APLIS)) {
    console.log(`Consultando apLIS: lotes ${grupoIds[0]}..${grupoIds[grupoIds.length - 1]} (${grupoIds.length})...`);
    const resultado = await detalharVariosLotes(grupoIds);
    if ('erro' in resultado) {
      console.error(`✗ Falha ao consultar apLIS para este grupo: ${resultado.erro.mensagem}`);
      totalErros += grupoIds.length;
      continue;
    }

    const linhasParaInserir: Record<string, unknown>[] = [];
    const qtdPorLoteId = new Map<string, number>();

    for (const idLote of grupoIds) {
      const loteId = loteIdPorAplisId.get(String(idLote));
      if (!loteId) continue; // já avisado acima em `faltando`
      const requisicoes = resultado.porLote[idLote] ?? [];
      if (requisicoes.length === 0) {
        lotesSemRequisicao += 1;
        continue;
      }
      qtdPorLoteId.set(loteId, requisicoes.length);
      for (const req of requisicoes) {
        const { codigo, descricao } = resumirProcedimentos(req);
        // numero_guia é NOT NULL no schema; nem toda requisição tem guia de
        // convênio autorizada (varia por operadora) — cai pro código interno
        // da requisição, que sempre existe, em vez de arriscar null.
        const numeroGuia =
          req.numGuiaConvenio ||
          req.procedimentos.find(p => p.numGuia)?.numGuia ||
          req.codRequisicao ||
          String(req.idRequisicao);
        linhasParaInserir.push({
          lote_id: loteId,
          numero_guia: numeroGuia,
          codigo_requisicao: req.codRequisicao,
          data_criacao: req.dtaSolicitacao,
          data_execucao: req.dtaFinalizacao,
          valor: req.valor,
          status: 'faturada',
          paciente_nome: req.paciente,
          procedimento_codigo: codigo,
          procedimento_descricao: descricao,
          aplis_id: String(req.idRequisicao),
        });
      }
    }

    totalRequisicoes += linhasParaInserir.length;

    if (!dryRun) {
      for (const grupoInsert of chunk(linhasParaInserir, CHUNK_UPSERT)) {
        const { error } = await supabase.from('requisicoes').upsert(grupoInsert, { onConflict: 'aplis_id' });
        if (error) throw new Error(`Falha ao gravar requisições: ${error.message}`);
      }
      for (const [loteId, qtd] of qtdPorLoteId) {
        const { error } = await supabase.from('lotes').update({ qtd_requisicoes: qtd }).eq('id_lote', loteId);
        if (error) throw new Error(`Falha ao atualizar qtd_requisicoes do lote ${loteId}: ${error.message}`);
      }
    }
  }

  console.log('\n=== RELATÓRIO FINAL (sem dados de paciente) ===');
  console.log(`Lotes processados: ${loteIdPorAplisId.size} de ${LOTES_ALVO.length}`);
  console.log(`Requisições encontradas/gravadas: ${totalRequisicoes}`);
  console.log(`Lotes sem nenhuma requisição no apLIS (réplica atrasa ~1 dia; confira se é esperado): ${lotesSemRequisicao}`);
  if (faltando.length > 0) console.log(`Lotes não encontrados em \`lotes\` (migration SQL pendente?): ${faltando.length}`);
  if (totalErros > 0) console.log(`⚠ Grupos com erro de conexão ao apLIS: ${totalErros} lote(s) não processados — rode de novo.`);
  if (dryRun) console.log('\n(--dry-run: nenhuma escrita foi feita no banco)');
}

// exit explícito: o pool MySQL de bdLab.ts segura o event loop aberto.
main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
