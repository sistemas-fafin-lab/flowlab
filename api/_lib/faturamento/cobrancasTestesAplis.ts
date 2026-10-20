// api/_lib/faturamento/cobrancasTestesAplis.ts
// Cobranças do apLIS (`fatexametipo`) com os testes (`patteste`) de cada uma, para
// o vínculo do catálogo de exames do Controle de Custos com o apLIS
// (.scratch/controle-custos-vinculo-aplis-tuss/spec.md).
//
// Mesma regra que a Admissão usa no modal de testes ao escolher a cobrança
// (projeto-admissao, backend/src/utils/testesPorCobrancas.ts): testes ativos dos
// exames ligados à cobrança em `fatexameexametipo` (via `pattesteexame`), mais a
// exceção 19 → 22. Se as duas divergirem, a tela ligaria um teste que a
// Admissão nunca manda — ou deixaria de oferecer um que ela manda.

/** Linha de `fatexametipo`. */
export interface LinhaCobranca {
  IdExameTipo: number;
  NomExameTipo: string;
  Inativo: number | null;
}

/** Linha de `fatexameexametipo`: a cobrança ligada a um exame do apLIS. */
export interface VinculoCobrancaExame {
  IdExameTipo: number;
  CodExame: number;
}

/** Linha de `pattesteexame` × `patteste`: um teste disponível para um exame. */
export interface LinhaTesteExame {
  IdExame: number;
  IdTeste: number;
  NomTeste: string;
  Inativo: number | null;
}

export interface TesteAplis {
  id: number;
  nome: string;
}

export interface CobrancaAplis {
  id: number;
  nome: string;
  inativa: boolean;
  testes: TesteAplis[];
}

/**
 * Exames cujos testes a cobrança mostra além dos vínculos de `fatexameexametipo`.
 *
 * 19 (CAPTURA HIBRIDA) → exame 22: no banco a cobrança 19 liga aos exames 29 e 32, que
 * não têm testes, mas a Captura Híbrida é admitida como exame 22 + cobrança 19, com os
 * testes do 22 (Genotipagem 28, PCR Alto/Baixo Risco, Painel IST I…).
 */
const EXAMES_EXTRAS_POR_COBRANCA: Record<number, number[]> = {
  19: [22],
};

/**
 * Cada cobrança com seus testes ativos (por nome): os dos exames ligados a ela em
 * `fatexameexametipo`, mais a exceção 19 → 22. Cobranças inativas também voltam,
 * marcadas: um exame do catálogo pode ter sido ligado a uma antes de ela sair de uso.
 */
export function cobrancasComTestes(
  cobrancas: LinhaCobranca[],
  vinculos: VinculoCobrancaExame[],
  testes: LinhaTesteExame[],
): CobrancaAplis[] {
  return cobrancas.map((cobranca) => {
    const exames = new Set([
      ...(EXAMES_EXTRAS_POR_COBRANCA[cobranca.IdExameTipo] ?? []),
      ...vinculos.filter((v) => v.IdExameTipo === cobranca.IdExameTipo).map((v) => v.CodExame),
    ]);
    const porId = new Map<number, TesteAplis>();
    for (const linha of testes) {
      if (exames.has(linha.IdExame) && !linha.Inativo) {
        porId.set(linha.IdTeste, { id: linha.IdTeste, nome: linha.NomTeste });
      }
    }
    return {
      id: cobranca.IdExameTipo,
      nome: cobranca.NomExameTipo,
      inativa: Boolean(cobranca.Inativo),
      testes: [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome)),
    };
  });
}
