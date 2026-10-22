// Semelhança entre o nome de um exame na tabela do convênio e os nomes da
// aba Exames — ver .scratch/controle-custos-importacao-por-exame/spec.md.
// Cada tabela de contrato escreve o exame do seu jeito ("Hemograma" ×
// "HEMOGRAMA COMPLETO"), então o casamento é por palavras em comum, e só
// entre os exames do mesmo TUSS: poucos candidatos, risco baixo de errar.

import type { Exam } from '../../../hooks/useCostControl';

// Palavras que não distinguem exame nenhum. "Dosagem", "pesquisa" e "ou"
// fecham quase todo nome da tabela TUSS ("Ácido Úrico, Dosagem",
// "Pesquisa E/ou Dosagem") e contavam contra o vínculo.
const PALAVRAS_VAZIAS = new Set([
  'a', 'o', 'as', 'os', 'e', 'ou', 'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'com', 'por', 'para', 'p', 'c',
  'dosagem', 'pesquisa',
]);

// Abaixo disso não vincula: menos da metade das palavras do nome mais curto
// aparece no outro.
export const SEMELHANCA_MINIMA = 0.5;

/** Palavras de um nome sem acento, maiúsculas, pontuação nem palavras vazias. */
export function palavrasDoNome(nome: string): string[] {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(p => p && !PALAVRAS_VAZIAS.has(p));
}

/** Chave de "mesmo nome no convênio" — a reimportação casa a linha por ela. */
export const chaveNomeConvenio = (nome: string): string => palavrasDoNome(nome).join(' ');

// Começo comum que já identifica a palavra numa grafia diferente
// ("triglicerideos" × "triglicerides").
const COMECO_COMUM_MINIMO = 7;

const comecoComum = (a: string, b: string): number => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
};

// Igual, abreviação de 4+ letras ("fung" × "fungos") ou o mesmo começo
// longo ("triglicerideos" × "triglicerides").
const mesmaPalavra = (a: string, b: string): boolean =>
  a === b ||
  (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a))) ||
  comecoComum(a, b) >= COMECO_COMUM_MINIMO;

// Palavras em comum / palavras do nome mais curto: 1 quando um nome está
// contido no outro ("Hemograma" em "HEMOGRAMA COMPLETO").
export function semelhancaNomes(a: string, b: string): number {
  const pa = palavrasDoNome(a);
  const pb = palavrasDoNome(b);
  if (pa.length === 0 || pb.length === 0) return 0;

  // Cada palavra de b casa com uma de a só uma vez.
  const livres = [...pb];
  let comuns = 0;
  for (const p of pa) {
    const i = livres.findIndex(q => mesmaPalavra(p, q));
    if (i === -1) continue;
    comuns++;
    livres.splice(i, 1);
  }
  return comuns / Math.min(pa.length, pb.length);
}

/** Exames de `candidatos` (os do mesmo TUSS) mais parecidos com
 *  `nomeConvenio`: todos os que empatam na maior semelhança, se ela chegar a
 *  SEMELHANCA_MINIMA. Mesmo TUSS e nome igualmente parecido = o convênio
 *  paga o mesmo por eles ("Creatinina, Dosagem" → CREATININA - S, - U e
 *  - U-24); um menos parecido fica de fora ("Ige, Total" → IGE TOTAL, sem o
 *  IgE Painel Alimentos). Vazio = nenhum parecido o bastante. */
export function examesMaisParecidos(nomeConvenio: string, candidatos: Exam[]): Exam[] {
  const comNota = candidatos.map(exame => ({ exame, nota: semelhancaNomes(nomeConvenio, exame.name) }));
  const melhor = Math.max(0, ...comNota.map(c => c.nota));
  if (melhor < SEMELHANCA_MINIMA) return [];
  return comNota.filter(c => c.nota === melhor).map(c => c.exame);
}
