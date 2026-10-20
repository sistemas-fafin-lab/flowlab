// api/_lib/faturamento/preVinculoAssefaz.ts
// Escolha do pré-preenchimento do vínculo do catálogo de exames com a cobrança do
// apLIS, pela tabela de preço da ASSEFAZ (IdTabelaPreco = 1) — issue 02 de
// .scratch/controle-custos-vinculo-aplis-tuss. Quem lê os bancos e escreve a
// migration é supabase/scripts/pre-vinculo-aplis-assefaz.ts.
//
// A spec fala em "cobrança com exatamente um Codigo ativo", mas no apLIS quase
// toda cobrança tem códigos extras que não existem no catálogo (3 CITOLOGIA DE
// LÍQUIDO: 40601129 + 40601340/358/366/374; 23: 40601323 + 22890408/797010056) —
// só a 7 sobraria. Por decisão de 20/10/2026, conta só os códigos que estão no
// catálogo: liga quando sobra um, com um exame só. Mais de um TUSS (biópsia,
// peça, 12 PAAF com 40601250/40601129) e TUSS de vários exames ficam para a tela.

/** Linha ativa de `fattabelaprocedimento` da tabela de preço 1. */
export interface LinhaTabelaPreco {
  IdExameTipo: number | null;
  Codigo: string;
}

/** Exame de `custo_exames`, com o vínculo que ele já tiver. */
export interface ExameCatalogo {
  id: string;
  nome: string;
  tuss: string;
  aplis_id_exame_tipo: number | null;
  aplis_id_teste: number | null;
}

export interface VinculoEscolhido {
  idExameTipo: number;
  tuss: string;
  exameId: string;
  exameNome: string;
}

export interface Descarte {
  idExameTipo: number;
  motivo: string;
}

/**
 * Cobranças que a regra ligaria errado e ficam para a tela.
 *
 * 22 (BIOLOGIA MOLECULAR) tem 7 TUSS na ASSEFAZ, mas só 40310140 (cultura para
 * fungos) está no catálogo — o "TUSS único" é falta de catálogo, não do apLIS.
 */
const NAO_PREENCHER: Record<number, string> = {
  22: 'os outros TUSS da cobrança faltam no catálogo; ligar na tela',
};

export function escolherVinculosAssefaz(
  linhas: LinhaTabelaPreco[],
  catalogo: ExameCatalogo[],
): { vinculos: VinculoEscolhido[]; descartes: Descarte[] } {
  const examesPorTuss = new Map<string, ExameCatalogo[]>();
  for (const exame of catalogo) {
    const tuss = exame.tuss.trim();
    if (tuss) examesPorTuss.set(tuss, [...(examesPorTuss.get(tuss) ?? []), exame]);
  }

  const codigosPorCobranca = new Map<number, Set<string>>();
  for (const linha of linhas) {
    if (linha.IdExameTipo === null) continue;
    const codigos = codigosPorCobranca.get(linha.IdExameTipo) ?? new Set<string>();
    codigos.add(linha.Codigo.trim());
    codigosPorCobranca.set(linha.IdExameTipo, codigos);
  }

  const vinculos: VinculoEscolhido[] = [];
  const descartes: Descarte[] = [];
  for (const [idExameTipo, codigos] of [...codigosPorCobranca].sort(([a], [b]) => a - b)) {
    if (NAO_PREENCHER[idExameTipo]) {
      descartes.push({ idExameTipo, motivo: NAO_PREENCHER[idExameTipo] });
      continue;
    }
    // Cobrança já ligada a algum exame, com ou sem teste: alguém já cuidou dela na tela.
    const jaLigado = catalogo.find((e) => e.aplis_id_exame_tipo === idExameTipo);
    if (jaLigado) {
      descartes.push({ idExameTipo, motivo: `a cobrança já está ligada ao exame ${jaLigado.nome}` });
      continue;
    }
    const codigosOrdenados = [...codigos].sort();
    const noCatalogo = codigosOrdenados.filter((codigo) => examesPorTuss.has(codigo));
    if (noCatalogo.length === 0) {
      descartes.push({ idExameTipo, motivo: `nenhum TUSS da cobrança está no catálogo (${codigosOrdenados.join(', ')})` });
      continue;
    }
    if (noCatalogo.length > 1) {
      descartes.push({ idExameTipo, motivo: `mais de um TUSS no catálogo (${noCatalogo.join(', ')})` });
      continue;
    }
    const [tuss] = noCatalogo;
    const exames = examesPorTuss.get(tuss)!;
    if (exames.length > 1) {
      const nomes = exames.map((e) => e.nome).join('; ');
      descartes.push({ idExameTipo, motivo: `${tuss} está em ${exames.length} exames do catálogo (${nomes})` });
      continue;
    }
    const [exame] = exames;
    if (exame.aplis_id_exame_tipo !== null) {
      const teste = exame.aplis_id_teste === null ? '' : ` / teste ${exame.aplis_id_teste}`;
      descartes.push({ idExameTipo, motivo: `${exame.nome} já está ligado à cobrança ${exame.aplis_id_exame_tipo}${teste}` });
      continue;
    }
    vinculos.push({ idExameTipo, tuss, exameId: exame.id, exameNome: exame.nome });
  }
  return { vinculos, descartes };
}
