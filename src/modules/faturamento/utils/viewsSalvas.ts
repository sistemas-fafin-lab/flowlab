// Validação dos filtros salvos numa `ViewSalva`, por tela. Cada tela do módulo
// tinha sua própria defesa contra view em formato antigo/incompleto (merge com
// `padrao` no Dashboard, fallback campo a campo em Títulos, Set de status em
// Glosas — o crash de 3b971eb corrigido em três lugares, de três formas). A
// garantia agora mora no seam: `useViewsSalvas` aplica o sanitizador da tela a
// cada linha antes de devolvê-la, então nenhum consumidor recebe filtro com
// campo faltando ou valor fora do union.

import type {
  DashboardReceberFiltros,
  GlosasViewFiltros,
  TituloStatus,
  TitulosViewFiltros,
} from '../types';

const STATUS_TITULO_VALIDOS: ReadonlySet<TituloStatus | ''> = new Set([
  'aberta',
  'parcialmente_recebida',
  'recebida',
  'liquidada',
  'glosada',
  'cancelada',
  '',
]);

const STATUS_GLOSA_VALIDOS: ReadonlySet<GlosasViewFiltros['status']> = new Set([
  'todas',
  'aberta',
  'em_recurso',
  'revertida',
  'definitiva',
]);

/** JSONB de `fat_views_salvas.filtros` é `unknown`; trata não-objeto como vazio. */
function objetoDe(valor: unknown): Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}

/** Data em YYYY-MM-DD: qualquer string não vazia serve; vazia/inválida cai no fallback. */
function dataOu(valor: unknown, fallback: string): string {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : fallback;
}

/** Qualquer string serve; sem string cai no fallback. */
function textoOu(valor: unknown, fallback: string): string {
  return typeof valor === 'string' ? valor : fallback;
}

/** Lista de termos: só strings sobrevivem; não-array vira lista vazia. */
function listaDeTextos(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === 'string') : [];
}

function statusTituloOu(valor: unknown, fallback: TituloStatus | ''): TituloStatus | '' {
  return typeof valor === 'string' && STATUS_TITULO_VALIDOS.has(valor as TituloStatus | '')
    ? (valor as TituloStatus | '')
    : fallback;
}

function statusGlosaOu(
  valor: unknown,
  fallback: GlosasViewFiltros['status'],
): GlosasViewFiltros['status'] {
  return typeof valor === 'string' &&
    STATUS_GLOSA_VALIDOS.has(valor as GlosasViewFiltros['status'])
    ? (valor as GlosasViewFiltros['status'])
    : fallback;
}

/** Filtros do painel de Contas a Receber. `padrao` é o alvo do "Limpar" da tela. */
export function sanitizarFiltrosPainel(
  raw: unknown,
  padrao: DashboardReceberFiltros,
): DashboardReceberFiltros {
  const obj = objetoDe(raw);
  return {
    desde: dataOu(obj.desde, padrao.desde),
    ate: dataOu(obj.ate, padrao.ate),
    operadoraIds: listaDeTextos(obj.operadoraIds),
    lotes: listaDeTextos(obj.lotes),
    notas: listaDeTextos(obj.notas),
  };
}

/** Filtros da aba Títulos. `base` são os filtros atuais da tela (sem paginação). */
export function sanitizarFiltrosTitulos(
  raw: unknown,
  base: TitulosViewFiltros,
): TitulosViewFiltros {
  const obj = objetoDe(raw);
  return {
    desde: dataOu(obj.desde, base.desde),
    ate: dataOu(obj.ate, base.ate),
    status: statusTituloOu(obj.status, base.status),
    operadoraId: textoOu(obj.operadoraId, base.operadoraId),
    busca: textoOu(obj.busca, ''),
  };
}

/** Filtros da tela de Glosas. Sem base: status inválido vira "todas". */
export function sanitizarFiltrosGlosas(raw: unknown): GlosasViewFiltros {
  const obj = objetoDe(raw);
  return { status: statusGlosaOu(obj.status, 'todas') };
}
