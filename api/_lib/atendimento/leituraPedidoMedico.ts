// api/_lib/atendimento/leituraPedidoMedico.ts
// Leitura da resposta da IA sobre o pedido médico e casamento com a lista de preços
// do Gerador de Orçamento. Port das regras puras de lib/alvaro-orcamento/analyze.ts
// da Tabela-Particular (parseAiResponseText / matchAiResponse), com a mesma regra de
// casamento: primeiro o nome que a IA apontou na lista (`matched`), depois o nome lido
// no pedido — igual sem acento, ou contendo todas as palavras de 3+ letras.

/** Formato declarado no prompt (promptPedidoMedico.ts), nunca garantido em runtime. */
type ExameDaIa = { name: string; matched: string | null };

/** Um exame lido no pedido e o item da lista que corresponde a ele (ou nenhum). */
export interface ExameLido<T> {
  nomeNoPedido: string;
  item: T | null;
}

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

function paraExameDaIa(valor: unknown): ExameDaIa | null {
  if (typeof valor === 'string') return { name: valor, matched: null };
  if (isRecord(valor) && typeof valor.name === 'string') {
    return { name: valor.name, matched: typeof valor.matched === 'string' ? valor.matched : null };
  }
  return null;
}

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** O texto da IA como JSON (tolerando cercas ```json```); null quando não é JSON. */
export function lerRespostaIa(texto: string): unknown {
  try {
    return JSON.parse(texto.replace(/```json/g, '').replace(/```/g, '').trim());
  } catch {
    return null;
  }
}

/**
 * Casa os exames da resposta da IA com a lista de preços, na ordem em que vieram.
 * null quando a resposta não traz a lista `exams` (formato inesperado).
 */
export function casarExamesLidos<T extends { nome: string }>(
  resposta: unknown,
  lista: readonly T[],
): ExameLido<T>[] | null {
  if (!isRecord(resposta) || !Array.isArray(resposta.exams)) return null;

  const listaNormalizada = lista.map((item) => ({ item, nome: normalizar(item.nome) }));

  return resposta.exams
    .map(paraExameDaIa)
    .filter((exame): exame is ExameDaIa => exame !== null)
    .map(({ name, matched }) => {
      const apontado = matched ? normalizar(matched) : null;
      let achado = apontado ? listaNormalizada.find((l) => l.nome === apontado) : undefined;

      if (!achado) {
        const lido = normalizar(name);
        const palavras = lido.split(/\s+/).filter((p) => p.length > 2);
        achado = listaNormalizada.find(
          (l) => l.nome === lido || (palavras.length > 0 && palavras.every((p) => l.nome.includes(p))),
        );
      }

      return { nomeNoPedido: name, item: achado?.item ?? null };
    });
}
