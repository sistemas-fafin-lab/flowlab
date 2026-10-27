// Busca da lista de títulos pelo número de uma NF cancelada
// (.scratch/faturamento-nf-cancelada, issue 03).

import type { NfCanceladaSemTitulo } from '../types';

/** Linha crua de `fat_nfs_canceladas` que casou com a busca. */
export interface LinhaNfCanceladaBusca {
  id: string;
  nota_id: string | null;
  numero_nota: string;
  valor: number | string | null;
  data_emissao: string | null;
  data_cancelamento: string;
  motivo: string;
  operadoras: { nome: string } | null;
}

/** Separa as NFs canceladas que casaram com a busca: as de um título viram, por
 *  título, os números que casaram (a linha do título mostra qual NF casou); as
 *  sem título são resultado próprio da busca. */
export function nfsCanceladasDaBusca(linhas: LinhaNfCanceladaBusca[]): {
  porTitulo: Map<string, string[]>;
  semTitulo: NfCanceladaSemTitulo[];
} {
  const porTitulo = new Map<string, string[]>();
  const semTitulo: NfCanceladaSemTitulo[] = [];
  for (const linha of linhas) {
    if (linha.nota_id) {
      porTitulo.set(linha.nota_id, [...(porTitulo.get(linha.nota_id) ?? []), linha.numero_nota]);
      continue;
    }
    semTitulo.push({
      id: linha.id,
      numeroNota: linha.numero_nota,
      operadoraNome: linha.operadoras?.nome ?? null,
      valor: linha.valor === null ? null : Number(linha.valor),
      dataEmissao: linha.data_emissao,
      dataCancelamento: linha.data_cancelamento,
      motivo: linha.motivo,
    });
  }
  return { porTitulo, semTitulo };
}
