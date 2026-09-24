// Paleta — classes literais (o Tailwind só gera o que aparece escrito no código).
const COR = {
  amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
  orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
  sky: 'bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300',
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300',
  cyan: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300',
  teal: 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300',
  violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300',
  emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
  green: 'bg-green-200 dark:bg-green-900/50 text-green-900 dark:text-green-200',
  lime: 'bg-lime-100 dark:bg-lime-900/30 text-lime-800 dark:text-lime-300',
  rose: 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300',
  red: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
  redForte: 'bg-red-600 dark:bg-red-700 text-white',
  pink: 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300',
  fuchsia: 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-800 dark:text-fuchsia-300',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
  stone: 'bg-stone-200 dark:bg-stone-700/50 text-stone-700 dark:text-stone-300',
  slate: 'bg-slate-100 dark:bg-slate-700/40 text-slate-600 dark:text-slate-300',
} as const;

// "Status Faturamento" (eventofatur, por requisição — ver StatusFaturamentoResumo
// em types/index.ts). Cor por CodEvento (chave estável da tabela no apLIS), com
// tons próximos para significados próximos: amarelo = aguardando/em andamento,
// azul = faturado/cobrado, verde = recebido, vermelho = glosa/perda,
// roxo = recurso, laranja = tratativa. Códigos conferidos na tabela em 2026-09-24.
const COR_POR_CODIGO: Record<number, string> = {
  1: COR.amber,     // AGUARDANDO FATURAMENTO
  2: COR.yellow,    // FATURAMENTO EM PROGRESSO
  11: COR.orange,   // CONCILIAÇÃO - AGUARDANDO
  3: COR.sky,       // AGUARDANDO RE-FATURAMENTO
  44: COR.sky,      // REFATURAMENTO
  28: COR.blue,     // FATURADO - COBRANÇA ENVIADA
  37: COR.indigo,   // FATURADO EM 2026
  41: COR.indigo,   // FATURADO NO 2º TRIMESTRE
  42: COR.indigo,   // FATURADO NO 3º TRIMESTRE
  38: COR.cyan,     // COBRADO CONVÊNIO
  36: COR.teal,     // COBRADO PAGAMENTO
  40: COR.violet,   // NFe EMITIDA - AGUARDANDO PAGAMENTO
  39: COR.violet,   // AGUARDANDO PAGAMENTO
  35: COR.teal,     // PAGAMENTO PREVISTO
  5: COR.green,     // RECEBIDO
  18: COR.lime,     // RECEBIDO a MENOR - Acatado
  34: COR.emerald,  // GLOSA RECEBIDA
  6: COR.rose,      // GLOSADO ainda SEM RECURSO
  27: COR.red,      // GLOSA TOTAL
  8: COR.red,       // GLOSA DEFINITIVA - ACATADA DIRETORIA
  23: COR.red,      // GLOSA MANTIDA - 1006
  31: COR.redForte, // PREJUIZO
  7: COR.fuchsia,   // RECURSO DE GLOSA - 1º RECURSO
  16: COR.purple,   // RECURSO DE GLOSA - 2º RECURSO
  15: COR.pink,     // RECURSO NÃO ACATADO
  33: COR.orange,   // EM TRATATIVAS COM CONVÊNIO
  43: COR.amber,    // EM AUDITORIA
  26: COR.orange,   // DEVOLVIDO
  29: COR.stone,    // EXCLUSO DO PLANO
  25: COR.stone,    // NÃO REALIZADO
  24: COR.stone,    // LOTE NÃO FATURADO
  30: COR.slate,    // INATIVO - COBRANÇA PARTICULAR
};

/** Cor do chip de um Status Faturamento. Status criado depois no apLIS (sem
 *  código no mapa) cai numa cor pelo texto; sem pista, cinza. */
export function corStatusFaturamento(codigo: number | null, label: string): string {
  if (codigo !== null && COR_POR_CODIGO[codigo]) return COR_POR_CODIGO[codigo];
  const l = label.toUpperCase();
  if (l.includes('RECURSO')) return COR.fuchsia;
  if (l.includes('GLOSA') || l.includes('PREJU')) return COR.red;
  if (l.includes('RECEBIDO')) return COR.green;
  if (l.includes('FATURADO') || l.includes('COBRADO')) return COR.blue;
  if (l.includes('AGUARDANDO')) return COR.amber;
  return COR.slate;
}
