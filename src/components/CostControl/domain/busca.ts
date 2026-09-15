// Busca de exames e fontes pagadoras em Controle de Custos, extraída da lógica
// hoje embutida em PayorsScreen.tsx para poder ser testada sem montar
// componente React — ver busca.test.ts. Base pro ticket 02 (tela de busca de
// exame → fontes pagadoras daquele exame).

import type { Exam, Payor } from '../../../hooks/useCostControl';

function normalizar(valor: string): string {
  return removerAcentos(valor.trim().toLowerCase());
}

function removerAcentos(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Compara `texto` com `termo` ignorando acentos e maiúsculas/minúsculas —
 *  `termo` precisa aparecer em `texto` como substring contígua (não é fuzzy:
 *  "bsd" NÃO casa com "Bradesco Saúde", só "brad" ou "saude" casariam).
 *  Termo vazio nunca casa — quem quiser tratar termo vazio como "casa com
 *  tudo" decide isso antes de chamar. */
export function casaTermo(texto: string, termo: string): boolean {
  const termoNormalizado = normalizar(termo);
  if (!termoNormalizado) return false;

  return normalizar(texto).includes(termoNormalizado);
}

/** Exames cujo nome OU código TUSS casam com `termo` — ignora acentos e
 *  maiúsculas/minúsculas; `termo` precisa aparecer como substring contígua.
 *  Termo vazio (ou só espaços) devolve lista vazia, não a lista inteira. */
export function buscarExamesPorTermo(exams: Exam[], termo: string): Exam[] {
  if (!normalizar(termo)) return [];

  return exams.filter(
    (exame) => casaTermo(exame.name, termo) || casaTermo(exame.tuss, termo),
  );
}

/** Fontes pagadoras do código TUSS exato de um exame, ordenadas por valor
 *  cobrado crescente (mais barato primeiro). */
export function fontesPagadorasPorTuss(payors: Payor[], tuss: string): Payor[] {
  const tussNormalizado = normalizar(tuss);
  if (!tussNormalizado) return [];

  return payors
    .filter((fonte) => normalizar(fonte.tus) === tussNormalizado)
    .sort((a, b) => a.price - b.price);
}

/** Nomes de fonte pagadora (deduplicados) cujo nome casa com `termo` —
 *  ignora acentos e maiúsculas/minúsculas; `termo` precisa aparecer como
 *  substring contígua. Termo vazio (ou só espaços) devolve lista vazia, não
 *  a lista inteira. */
export function buscarFontesPagadorasPorTermo(payors: Payor[], termo: string): string[] {
  if (!normalizar(termo)) return [];

  const nomes = payors
    .map((fonte) => fonte.payor)
    .filter((nome) => casaTermo(nome, termo));

  return Array.from(new Set(nomes));
}

/** Nomes de tabela associada (deduplicados) cujo nome casa com `termo` —
 *  ignora acentos e maiúsculas/minúsculas; `termo` precisa aparecer como
 *  substring contígua. Termo vazio (ou só espaços) devolve lista vazia, não
 *  a lista inteira. */
export function buscarTabelasAssociadasPorTermo(payors: Payor[], termo: string): string[] {
  if (!normalizar(termo)) return [];

  const tabelas = payors
    .map((fonte) => fonte.table)
    .filter((tabela) => casaTermo(tabela, termo));

  return Array.from(new Set(tabelas));
}

/** Um exame coberto por uma fonte pagadora, com os campos exibidos na
 *  tabela de exames por fonte pagadora.
 *
 *  custo vem do "Custo Total" (direct + indirect) cadastrado pro TUSS na
 *  aba Exames; dif é valorCobrado - custo; percentualCsp é custo / valorCobrado
 *  (em %) — quanto do valor cobrado é consumido pelo custo. atendido reflete
 *  se aquele exame é atendido pelo plano de saúde da fonte pagadora ou só
 *  como particular (Payor.atendido, editável na tela). */
export interface ExameDaFontePagadora {
  payorId: string;
  // Id do Exam cujo nome está em `exame` — necessário porque um mesmo TUSS
  // pode render múltiplas linhas (ver examesPorFontePagadora); é o que
  // permite editar/selecionar o exame certo em vez do primeiro que bater.
  exameId: string;
  exame: string;
  tuss: string;
  tabelaAssociada: string;
  // Valor efetivo desta linha: valor personalizado do exame (ver
  // valoresPersonalizados) quando existir, senão o valor padrão do TUSS
  // (Payor.price) — ver valorPadraoTuss/temValorPersonalizado.
  valorCobrado: number;
  // Valor padrão da linha de custo_fontes_pagadoras (Payor.price),
  // compartilhado por todos os irmãos do mesmo TUSS — independe de
  // `valorCobrado` ter sido personalizado ou não. Usado pra oferecer
  // "restaurar valor padrão" na tela.
  valorPadraoTuss: number;
  // true quando `valorCobrado` veio de custo_fontes_pagadoras_valores_exame
  // (um valor só pra este exame, diferente dos irmãos), não do padrão do TUSS.
  temValorPersonalizado: boolean;
  custo: number;
  dif: number;
  percentualCsp: number;
  atendido: boolean;
  // Só tem sentido pra fonte pagadora "Particular" — reflete
  // Payor.elegivelDescontoParticular, editável na tela via PayorsScreen.
  elegivelDescontoParticular: boolean;
}

/** Chave de `excluidos`/`valoresPersonalizados` em `examesPorFontePagadora` —
 *  identifica um par (linha de preço, exame), usada tanto por
 *  custo_fontes_pagadoras_exclusoes quanto por
 *  custo_fontes_pagadoras_valores_exame (mesma forma de chave, tabelas
 *  diferentes). */
export const chaveExclusaoExame = (payorId: string, exameId: string): string => `${payorId}:${exameId}`;

/** Exames cobertos por uma fonte pagadora — join pelo TUSS
 *  (`Payor.tus` ↔ `Exam.tuss`), ordenados por valor cobrado crescente (e,
 *  entre linhas de mesmo valor, por nome do exame).
 *
 *  Um TUSS pode ser compartilhado por exames com nomes diferentes (sem
 *  examId confiável vindo do APLIS) — nesse caso, `custo_fontes_pagadoras`
 *  só tem UMA linha de preço pro TUSS, mas ela vira uma linha de resultado
 *  POR NOME DISTINTO de exame que compartilha aquele TUSS (mesmo payorId/
 *  valorCobrado/atendido/elegibilidade nas duas, só o exame/custo mudam) —
 *  em vez de esconder todos os nomes menos um. Duas linhas de `custo_exames`
 *  com o mesmo TUSS *e* o mesmo nome (duplicata literal) geram só uma linha
 *  de resultado.
 *
 *  `excluidos` (chaveExclusaoExame(payorId, exameId)) tira da lista um nome
 *  específico marcado como "não oferecido por esta fonte pagadora" — sem
 *  afetar o preço nem os demais nomes que compartilham o mesmo TUSS. Ver
 *  custo_fontes_pagadoras_exclusoes (migration 20260914120000).
 *
 *  `valoresPersonalizados` (mesma chave chaveExclusaoExame(payorId, exameId))
 *  sobrescreve `valorCobrado` só pra aquele par — permite que exames irmãos
 *  do mesmo TUSS cobrem valores diferentes pra mesma fonte pagadora, sem
 *  mexer no valor padrão da linha (que continua valendo pros irmãos sem
 *  override). Ver custo_fontes_pagadoras_valores_exame (migration
 *  20260914130000). */
export function examesPorFontePagadora(
  exams: Exam[],
  payors: Payor[],
  nomeFontePagadora: string,
  excluidos: Set<string> = new Set(),
  valoresPersonalizados: Map<string, number> = new Map(),
): ExameDaFontePagadora[] {
  const nomeNormalizado = normalizar(nomeFontePagadora);
  if (!nomeNormalizado) return [];

  // Só agrupa por TUSS quando ele existe de verdade — TUSS vazio NÃO é um
  // código compartilhado, é "esse exame não tem código". Sem essa distinção,
  // toda linha de fonte pagadora sem TUSS casaria com TODOS os exames sem
  // TUSS do catálogo inteiro (bug real encontrado em produção: uma linha
  // "Particular" sem TUSS estava exibindo os 20 exames sem código, todos
  // pelo mesmo preço). Ver migration 20260916100000_custo_fontes_pagadoras_exame_id.
  const examesPorTuss = new Map<string, Exam[]>();
  const examesPorId = new Map<string, Exam>();
  for (const exame of exams) {
    examesPorId.set(exame.id, exame);
    if (!exame.tuss) continue;
    const grupo = examesPorTuss.get(exame.tuss);
    if (!grupo) {
      examesPorTuss.set(exame.tuss, [exame]);
      continue;
    }
    // Duplicata literal (mesmo tuss E mesmo nome): a entrada mais recente
    // vence, mesma semântica de "último vence" já usada antes desta função
    // passar a agrupar por tuss em vez de escolher só um exame.
    const indice = grupo.findIndex((e) => e.name === exame.name);
    if (indice === -1) grupo.push(exame);
    else grupo[indice] = exame;
  }

  return payors
    .filter((fonte) => normalizar(fonte.payor) === nomeNormalizado)
    .flatMap((fonte) => {
      // TUSS preenchido: casamento por texto, compartilhável entre exames
      // (comportamento de sempre). TUSS vazio: só casa com o exame
      // explicitamente vinculado via exameId — nunca com "todo exame sem
      // TUSS". Sem exameId (dado legado ainda não migrado), a linha não
      // aparece em lugar nenhum em vez de aparecer errada.
      const grupo = fonte.tus
        ? examesPorTuss.get(fonte.tus)
        : fonte.exameId
          ? (() => {
              const exame = examesPorId.get(fonte.exameId!);
              return exame ? [exame] : undefined;
            })()
          : undefined;
      if (!grupo) return [];
      return grupo
        .filter((exame) => !excluidos.has(chaveExclusaoExame(fonte.id, exame.id)))
        .map((exame) => {
          const custo = exame.direct + exame.indirect;
          const valorPersonalizado = valoresPersonalizados.get(chaveExclusaoExame(fonte.id, exame.id));
          const valorCobrado = valorPersonalizado ?? fonte.price;
          return {
            payorId: fonte.id,
            exameId: exame.id,
            exame: exame.name,
            tuss: exame.tuss,
            tabelaAssociada: fonte.table,
            valorCobrado,
            valorPadraoTuss: fonte.price,
            temValorPersonalizado: valorPersonalizado !== undefined,
            custo,
            dif: valorCobrado - custo,
            percentualCsp: valorCobrado > 0 ? (custo / valorCobrado) * 100 : 0,
            atendido: fonte.atendido,
            elegivelDescontoParticular: fonte.elegivelDescontoParticular,
          };
        });
    })
    .sort((a, b) => a.valorCobrado - b.valorCobrado || a.exame.localeCompare(b.exame));
}
