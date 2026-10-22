// ═══════════════════════════════════════════════════════════════════════════════
// Unificação das tabelas associadas duplicadas
// (.scratch/controle-custos-tabela-associada, ticket 06).
//
// Só aplica o que o faturamento decidiu no levantamento (ticket 05): o mapa de
// junção (quais tabelas de uma fonte viram qual) e, para cada TUSS/exame com
// preços diferentes entre as tabelas juntadas, de qual tabela vem o preço que
// fica. Nada fora do mapa é tocado, e enquanto houver conflito sem escolha não
// sai operação nenhuma — a migração só é gerada de um plano pronto
// (supabase/scripts/unificar-tabelas-associadas.ts).
// ═══════════════════════════════════════════════════════════════════════════════

/** Linha de custo_fontes_pagadoras como está no banco antes da unificação. */
export interface LinhaUnificacao {
  id: string;
  fontePagadora: string;
  tabelaAssociada: string;
  tuss: string;
  exameId: string | null;
  valor: number;
  atendido: boolean;
  elegivelDescontoParticular: boolean;
}

export interface OperacoesUnificacao {
  criarTabelas: { fontePagadora: string; nome: string }[];
  apontarLinhas: { linhaId: string; fontePagadora: string; destino: string }[];
  removerLinhas: string[];
  remapearExclusoes: { de: string; para: string; exameId: string }[];
  remapearValores: { de: string; para: string; exameId: string; valor: number }[];
  removerTabelas: { fontePagadora: string; nome: string }[];
}

/** Tabelas da fonte que viram uma só: as linhas das `origens` passam para `destino`. */
export interface GrupoJuncao {
  fontePagadora: string;
  destino: string;
  origens: string[];
}

export interface EntradaUnificacao {
  linhas: LinhaUnificacao[];
  exclusoes: { payorId: string; exameId: string }[];
  valoresExame: { payorId: string; exameId: string; valor: number }[];
  mapa: GrupoJuncao[];
  escolhas: EscolhaPreco[];
}

/** Resposta do faturamento a um conflito: de qual tabela de origem vem a linha que fica. */
export interface EscolhaPreco {
  fontePagadora: string;
  destino: string;
  tuss: string;
  exameId: string | null;
  fica: string;
}

/** Um TUSS (linha geral) ou exame (linha de exame) com mais de uma linha nas
 *  tabelas juntadas e preço diferente entre elas. */
export interface ConflitoUnificacao {
  fontePagadora: string;
  destino: string;
  tuss: string;
  exameId: string | null;
  opcoes: ({ tabela: string; linhaId: string } & Pick<
    LinhaUnificacao,
    'valor' | 'atendido' | 'elegivelDescontoParticular'
  >)[];
}

export type PlanoUnificacao =
  | { tipo: 'pronto'; operacoes: OperacoesUnificacao }
  | { tipo: 'bloqueado'; conflitos: ConflitoUnificacao[] };

/** A mesma unicidade da tabela depois da unificação: (tabela, exame) para
 *  linha de exame, (tabela, TUSS) para linha geral do TUSS. */
export const chaveDaLinha = (l: Pick<LinhaUnificacao, 'tuss' | 'exameId'>): string => (l.exameId ? `exame:${l.exameId}` : `tuss:${l.tuss.trim()}`);

const mesmoPreco = (a: LinhaUnificacao, b: LinhaUnificacao): boolean =>
  a.valor === b.valor && a.atendido === b.atendido && a.elegivelDescontoParticular === b.elegivelDescontoParticular;

/** A linha que fica num conflito, pela escolha do faturamento — undefined
 *  sem escolha, ou com escolha de uma tabela que não está entre as opções. */
function linhaEscolhida(
  escolhas: EscolhaPreco[],
  grupo: GrupoJuncao,
  linhas: LinhaUnificacao[]
): LinhaUnificacao | undefined {
  const chave = chaveDaLinha(linhas[0]);
  const escolha = escolhas.find(
    e =>
      e.fontePagadora === grupo.fontePagadora &&
      e.destino === grupo.destino &&
      chaveDaLinha(e) === chave
  );
  return escolha && linhas.find(l => l.tabelaAssociada === escolha.fica);
}

export function planejarUnificacao(entrada: EntradaUnificacao): PlanoUnificacao {
  const operacoes: OperacoesUnificacao = {
    criarTabelas: [],
    apontarLinhas: [],
    removerLinhas: [],
    remapearExclusoes: [],
    remapearValores: [],
    removerTabelas: [],
  };
  const conflitos: ConflitoUnificacao[] = [];

  /** `fica` vai para o destino; as demais linhas da mesma chave saem, e as
   *  exclusões e valores personalizados delas passam para `fica` — menos os
   *  exames em que `fica` já tem o próprio ajuste, que prevalece. */
  const unir = (grupo: GrupoJuncao, linhas: LinhaUnificacao[], fica: LinhaUnificacao) => {
    if (fica.tabelaAssociada !== grupo.destino) {
      operacoes.apontarLinhas.push({ linhaId: fica.id, fontePagadora: grupo.fontePagadora, destino: grupo.destino });
    }
    const excluidosDaQueFica = new Set(entrada.exclusoes.filter(e => e.payorId === fica.id).map(e => e.exameId));
    const valoradosDaQueFica = new Set(entrada.valoresExame.filter(v => v.payorId === fica.id).map(v => v.exameId));
    for (const sai of linhas.filter(l => l !== fica)) {
      operacoes.removerLinhas.push(sai.id);
      entrada.exclusoes
        .filter(e => e.payorId === sai.id && !excluidosDaQueFica.has(e.exameId))
        .forEach(e => {
          excluidosDaQueFica.add(e.exameId);
          operacoes.remapearExclusoes.push({ de: sai.id, para: fica.id, exameId: e.exameId });
        });
      entrada.valoresExame
        .filter(v => v.payorId === sai.id && !valoradosDaQueFica.has(v.exameId))
        .forEach(v => {
          valoradosDaQueFica.add(v.exameId);
          operacoes.remapearValores.push({ de: sai.id, para: fica.id, exameId: v.exameId, valor: v.valor });
        });
    }
  };

  for (const grupo of entrada.mapa) {
    // Só se sabe das tabelas que têm linhas: um destino sem linhas é criado
    // (a migração cria sem falhar se o cadastro vazio já existir).
    if (!entrada.linhas.some(l => l.fontePagadora === grupo.fontePagadora && l.tabelaAssociada === grupo.destino)) {
      operacoes.criarTabelas.push({ fontePagadora: grupo.fontePagadora, nome: grupo.destino });
    }

    // Destino primeiro: com o mesmo preço em todas, fica a linha que já está nele.
    const porChave = new Map<string, LinhaUnificacao[]>();
    for (const tabela of [grupo.destino, ...grupo.origens]) {
      entrada.linhas
        .filter(l => l.fontePagadora === grupo.fontePagadora && l.tabelaAssociada === tabela)
        .forEach(l => porChave.set(chaveDaLinha(l), [...(porChave.get(chaveDaLinha(l)) ?? []), l]));
    }

    for (const linhas of porChave.values()) {
      // A escolha registrada manda mesmo sem diferença de preço; sem escolha e
      // com o mesmo preço em todas, fica a do destino (a primeira).
      const fica =
        linhaEscolhida(entrada.escolhas, grupo, linhas) ??
        (linhas.every(l => mesmoPreco(l, linhas[0])) ? linhas[0] : undefined);
      if (fica) {
        unir(grupo, linhas, fica);
        continue;
      }
      conflitos.push({
        fontePagadora: grupo.fontePagadora,
        destino: grupo.destino,
        tuss: linhas[0].tuss.trim(),
        exameId: linhas[0].exameId,
        opcoes: linhas.map(l => ({
          tabela: l.tabelaAssociada,
          linhaId: l.id,
          valor: l.valor,
          atendido: l.atendido,
          elegivelDescontoParticular: l.elegivelDescontoParticular,
        })),
      });
    }

    grupo.origens.forEach(nome => operacoes.removerTabelas.push({ fontePagadora: grupo.fontePagadora, nome }));
  }

  if (conflitos.length > 0) return { tipo: 'bloqueado', conflitos };
  return { tipo: 'pronto', operacoes };
}
