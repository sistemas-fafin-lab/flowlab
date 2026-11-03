// api/_lib/atendimento/leituraPedidoMedico.ts
// Leitura da resposta da IA sobre o pedido médico e casamento com a lista de preços
// do Gerador de Orçamento. Port das regras puras de lib/alvaro-orcamento/analyze.ts
// da Tabela-Particular (parseAiResponseText / matchAiResponse), sem a aproximação por
// palavras de lá: um exame só casa com o item cujo nome é igual (sem acento nem
// maiúsculas) ao `matched` que a IA apontou ou ao nome lido no pedido. Aproximar
// trocava exames ("Lipo B" virava LIPOPROTEÍNA - a), e na dúvida o atendente busca à mão.

/** Como a IA classifica um exame que não está na lista (ver promptPedidoMedico.ts). */
export type TipoNaoEncontrado = 'variante' | 'generico';

/** Formato declarado no prompt (promptPedidoMedico.ts), nunca garantido em runtime. */
type ExameDaIa = { name: string; matched: string | null; relacionados: unknown[]; tipo: unknown };

/**
 * Um exame lido no pedido e o item da lista que corresponde a ele (ou nenhum). Sem
 * item, `relacionados` traz os nomes da lista que a IA citou como da mesma família,
 * só para informar o atendente.
 */
export interface ExameLido<T> {
  nomeNoPedido: string;
  item: T | null;
  relacionados: string[];
  tipo: TipoNaoEncontrado | null;
}

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

function paraExameDaIa(valor: unknown): ExameDaIa | null {
  if (typeof valor === 'string') return { name: valor, matched: null, relacionados: [], tipo: null };
  if (isRecord(valor) && typeof valor.name === 'string') {
    return {
      name: valor.name,
      matched: typeof valor.matched === 'string' ? valor.matched : null,
      relacionados: Array.isArray(valor.relacionados) ? valor.relacionados : [],
      tipo: valor.tipo,
    };
  }
  return null;
}

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const paraTipo = (valor: unknown): TipoNaoEncontrado | null =>
  valor === 'variante' || valor === 'generico' ? valor : null;

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

  const porNome = new Map<string, T>();
  for (const item of lista) {
    const nome = normalizar(item.nome);
    if (!porNome.has(nome)) porNome.set(nome, item);
  }
  const naLista = (nome: string) => porNome.get(normalizar(nome));

  return resposta.exams
    .map(paraExameDaIa)
    .filter((exame): exame is ExameDaIa => exame !== null)
    .map(({ name, matched, relacionados, tipo }) => {
      const item = (matched ? naLista(matched) : undefined) ?? naLista(name);
      if (item) return { nomeNoPedido: name, item, relacionados: [], tipo: null };

      // Só nomes que existem na lista, sem repetir: a IA não pode citar exame que o
      // laboratório não faz.
      const nomes = new Set<string>();
      for (const r of relacionados) {
        const achado = typeof r === 'string' ? naLista(r) : undefined;
        if (achado) nomes.add(achado.nome);
      }
      return { nomeNoPedido: name, item: null, relacionados: [...nomes], tipo: paraTipo(tipo) };
    });
}
