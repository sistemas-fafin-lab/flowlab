// Blocos visuais e próximos passos das respostas do chat (D34). A IA só escolhe o tipo do bloco
// e a referência (qual projeto, quantos dias); os números, nomes e prazos o front monta com os
// dados do board (respostaVisual.ts), então nada do que o bloco mostra vem escrito pela IA.
// Puro e sem imports: usado pelo front e pela api/.

export const TIPOS_BLOCO = ['numeros', 'distribuicao', 'projeto', 'agenda', 'reuniao'] as const;
export const TIPOS_PASSO = ['perguntar', 'abrir_card', 'cobrar_card'] as const;

export type BlocoChat =
  | { tipo: 'numeros' }
  | { tipo: 'distribuicao'; por: 'pessoas' | 'colunas' }
  | { tipo: 'projeto'; projetoId: string }
  | { tipo: 'agenda'; dias: number }
  | { tipo: 'reuniao' };

export type PassoChat =
  | { tipo: 'perguntar'; texto: string }
  | { tipo: 'abrir_card'; codigo: string }
  | { tipo: 'cobrar_card'; codigo: string };

/** Blocos por resposta: mais que isso vira painel, não conversa. */
export const MAX_BLOCOS = 2;
export const MAX_PASSOS = 3;
export const MAX_TEXTO_PASSO = 80;
export const DIAS_AGENDA_PADRAO = 7;
export const DIAS_AGENDA_MAX = 14;

/** O que a IA devolve (SchemaChat): strings vazias quando não se aplica. */
export interface BlocoBruto { tipo: string; referencia: string }
export interface PassoBruto { tipo: string; texto: string }

/**
 * Só blocos que dá para montar: projeto que existe, reunião analisada. Sem repetir tipo
 * (dois projetos diferentes podem), no máximo MAX_BLOCOS.
 */
export function lerBlocos(brutos: readonly BlocoBruto[] | null | undefined, ctx: { projetos: readonly string[]; temReuniao: boolean }): BlocoChat[] {
  const vistos = new Set<string>();
  const saida: BlocoChat[] = [];
  for (const b of brutos ?? []) {
    const ref = (b.referencia ?? '').trim();
    let bloco: BlocoChat | null = null;
    switch (b.tipo) {
      case 'numeros': bloco = { tipo: 'numeros' }; break;
      case 'distribuicao': bloco = { tipo: 'distribuicao', por: ref === 'colunas' ? 'colunas' : 'pessoas' }; break;
      case 'projeto': bloco = ctx.projetos.includes(ref) ? { tipo: 'projeto', projetoId: ref } : null; break;
      case 'agenda': {
        const n = Number.parseInt(ref, 10);
        bloco = { tipo: 'agenda', dias: Number.isFinite(n) && n > 0 ? Math.min(n, DIAS_AGENDA_MAX) : DIAS_AGENDA_PADRAO };
        break;
      }
      case 'reuniao': bloco = ctx.temReuniao ? { tipo: 'reuniao' } : null; break;
    }
    if (!bloco) continue;
    const chave = bloco.tipo === 'projeto' ? `projeto:${bloco.projetoId}` : bloco.tipo;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(bloco);
    if (saida.length >= MAX_BLOCOS) break;
  }
  return saida;
}

/**
 * Só passos que levam a algum lugar: card que existe; cobrança só de card atrasado; pergunta
 * curta e não vazia. Sem repetir, no máximo MAX_PASSOS.
 */
export function lerPassos(brutos: readonly PassoBruto[] | null | undefined, ctx: { codigos: ReadonlySet<string>; atrasados: ReadonlySet<string> }): PassoChat[] {
  const vistos = new Set<string>();
  const saida: PassoChat[] = [];
  for (const p of brutos ?? []) {
    const texto = (p.texto ?? '').trim().replace(/\s+/g, ' ');
    let passo: PassoChat | null = null;
    if (p.tipo === 'perguntar' && texto) passo = { tipo: 'perguntar', texto: texto.slice(0, MAX_TEXTO_PASSO) };
    const codigo = texto.toUpperCase();
    if (p.tipo === 'abrir_card' && ctx.codigos.has(codigo)) passo = { tipo: 'abrir_card', codigo };
    if (p.tipo === 'cobrar_card' && ctx.atrasados.has(codigo)) passo = { tipo: 'cobrar_card', codigo };
    if (!passo) continue;
    const chave = `${passo.tipo}:${passo.tipo === 'perguntar' ? passo.texto.toLowerCase() : passo.codigo}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(passo);
    if (saida.length >= MAX_PASSOS) break;
  }
  return saida;
}
