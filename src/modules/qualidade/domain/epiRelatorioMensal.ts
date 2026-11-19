// Domínio do Relatório mensal de EPI (CONTEXT.md, seção Estoque e Qualidade;
// .scratch/epi-relatorio-mensal/spec.md). Regras puras, sem banco e sem tela.

import { formatarIdentificacaoEpi, type CamposEpi, type CopiaIdentificacaoEpi } from '../../../utils/epi.js';

/** O que o domínio precisa de um produto: o id e os campos de EPI do cadastro. */
export type ProdutoComIdentificacaoEpi = { id: string } & CamposEpi;

/**
 * Na finalização de uma solicitação de materiais, cada item cujo produto é EPI recebe a
 * cópia da Identificação do EPI vigente, para que uma troca de CA posterior não altere a
 * entrega. Itens sem produto cadastrado e de produtos que não são EPI ficam intactos.
 */
export function copiarIdentificacaoEpi<T extends { productId: string | null }>(
  itens: T[],
  produtos: ProdutoComIdentificacaoEpi[],
): (T & { identificacaoEpi?: CopiaIdentificacaoEpi })[] {
  const porId = produtosPorId(produtos);
  return itens.map((item) => {
    const produto = produtoEpiDoItem(porId, item.productId);
    if (!produto) return item;
    return {
      ...item,
      identificacaoEpi: {
        tipo: produto.epiTipo || null,
        numero: produto.epiNumero.trim() || null,
        validade: produto.epiValidade || null,
      },
    };
  });
}

// ─── Relatório mensal de EPI por área ────────────────────────────────────────

/** O que o domínio precisa de uma solicitação (SC ou SM) para o relatório. */
export interface SolicitacaoParaEpi {
  id: string;
  type: 'SC' | 'SM';
  status: string;
  /** YYYY-MM-DD: o mês do relatório é o da data da solicitação, não o da entrega. */
  requestDate: string;
  /** Setor gravado na solicitação (a área do relatório), sem normalização. */
  department?: string | null;
  /** Quem criou a solicitação. */
  requestedBy: string;
  items: {
    id: string;
    productId: string | null;
    productName: string;
    quantity: number;
    identificacaoEpi?: CopiaIdentificacaoEpi;
  }[];
}

/** Movimentação de estoque de uma solicitação: a prova de que o item foi baixado. */
export interface MovimentacaoParaEpi {
  requestId?: string | null;
  productId: string;
}

export interface DadosRelatorioEpi {
  solicitacoes: SolicitacaoParaEpi[];
  produtos: ProdutoComIdentificacaoEpi[];
  movimentacoes: MovimentacaoParaEpi[];
}

/** Uma linha do Relatório mensal de EPI: um item de EPI entregue. */
export interface LinhaRelatorioEpi {
  solicitacaoId: string;
  itemId: string;
  /** YYYY-MM-DD, da solicitação. */
  data: string;
  produto: string;
  /** "CA 12345", "ANVISA 80495510226" ou '' (sem identificação). */
  identificacao: string;
  quantidade: number;
  solicitante: string;
}

/** Área de uma solicitação sem setor gravado. */
export const AREA_SEM_SETOR = 'Sem setor';

/** A área é o setor gravado na solicitação, como está: grafias diferentes são áreas diferentes. */
export function areaDaSolicitacao(s: Pick<SolicitacaoParaEpi, 'department'>): string {
  return s.department?.trim() ? s.department : AREA_SEM_SETOR;
}

/** `mes` no formato YYYY-MM. */
const doMes = (s: SolicitacaoParaEpi, mes: string) => s.requestDate.slice(0, 7) === mes;

/** A cópia gravada no item; sem cópia (entrega anterior à funcionalidade), o cadastro atual. */
function identificacaoDoItem(item: SolicitacaoParaEpi['items'][number], produto: CamposEpi): string {
  const copia = item.identificacaoEpi;
  if (!copia) return formatarIdentificacaoEpi(produto);
  return formatarIdentificacaoEpi({ epiTipo: copia.tipo ?? '', epiNumero: copia.numero ?? '' });
}

const compararTexto = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });

type ProdutosPorId = Map<string, ProdutoComIdentificacaoEpi>;

const produtosPorId = (produtos: ProdutoComIdentificacaoEpi[]): ProdutosPorId => new Map(produtos.map((p) => [p.id, p]));

/** O produto do item, se ele for EPI; item sem produto cadastrado ou de produto que não é EPI → undefined. */
const produtoEpiDoItem = (porId: ProdutosPorId, productId: string | null) => {
  const produto = productId ? porId.get(productId) : undefined;
  return produto?.isEpi ? produto : undefined;
};

/** Solicitação de materiais do mês (YYYY-MM) numa das situações pedidas. */
const smDoMes = (s: SolicitacaoParaEpi, mes: string, status: ReadonlySet<string>) =>
  s.type === 'SM' && status.has(s.status) && doMes(s, mes);

const STATUS_ENTREGUE: ReadonlySet<string> = new Set(['completed']);
const STATUS_NAO_ENTREGUE: ReadonlySet<string> = new Set(['pending', 'approved']);

/** Linhas de todas as áreas do mês (YYYY-MM), cada uma com a sua área, já ordenadas. */
function linhasDoMes(
  { solicitacoes, produtos, movimentacoes }: DadosRelatorioEpi,
  mes: string,
): { area: string; linha: LinhaRelatorioEpi }[] {
  const porId = produtosPorId(produtos);
  const baixados = new Set(movimentacoes.map((m) => `${m.requestId}|${m.productId}`));
  const resultado: { area: string; linha: LinhaRelatorioEpi }[] = [];
  for (const s of solicitacoes) {
    if (!smDoMes(s, mes, STATUS_ENTREGUE)) continue;
    for (const item of s.items) {
      const produto = produtoEpiDoItem(porId, item.productId);
      if (!produto || !baixados.has(`${s.id}|${produto.id}`)) continue;
      resultado.push({
        area: areaDaSolicitacao(s),
        linha: {
          solicitacaoId: s.id,
          itemId: item.id,
          data: s.requestDate,
          produto: item.productName,
          identificacao: identificacaoDoItem(item, produto),
          quantidade: item.quantity,
          solicitante: s.requestedBy,
        },
      });
    }
  }
  return resultado.sort(
    (a, b) => a.linha.data.localeCompare(b.linha.data) || compararTexto(a.linha.solicitante, b.linha.solicitante),
  );
}

/**
 * Linhas do Relatório mensal de EPI de uma área e mês (YYYY-MM): itens de EPI de solicitações
 * de materiais concluídas, do mês da data da solicitação e do setor da área, que tiveram
 * movimentação de estoque (o item foi de fato baixado). Ordenadas por data e solicitante.
 */
export function montarLinhasEpi(dados: DadosRelatorioEpi, { area, mes }: { area: string; mes: string }): LinhaRelatorioEpi[] {
  return linhasDoMes(dados, mes)
    .filter((l) => l.area === area)
    .map((l) => l.linha);
}

/** Situação de uma área no mês. Nesta fatia, sem fechamento, toda área está aberta. */
export type SituacaoAreaEpi = 'aberto' | 'fechado' | 'assinado';

export interface AreaEpiDoMes {
  area: string;
  situacao: SituacaoAreaEpi;
  /** Linhas do relatório (itens de EPI entregues). */
  linhas: number;
  /** Solicitações de materiais do mês com EPI ainda não entregues (pendentes ou aprovadas). */
  pendentes: number;
}

/**
 * Áreas do mês (YYYY-MM) com EPI entregue ou com pedido de EPI ainda não entregue, em ordem
 * alfabética. A contagem de pendentes avisa para não fechar o relatório antes da hora.
 */
export function listarAreasEpiDoMes(dados: DadosRelatorioEpi, mes: string): AreaEpiDoMes[] {
  const porArea = new Map<string, AreaEpiDoMes>();
  const daArea = (area: string) => {
    let a = porArea.get(area);
    if (!a) porArea.set(area, (a = { area, situacao: 'aberto', linhas: 0, pendentes: 0 }));
    return a;
  };

  for (const { area } of linhasDoMes(dados, mes)) daArea(area).linhas++;

  const porId = produtosPorId(dados.produtos);
  for (const s of dados.solicitacoes) {
    if (!smDoMes(s, mes, STATUS_NAO_ENTREGUE)) continue;
    if (s.items.some((i) => produtoEpiDoItem(porId, i.productId))) daArea(areaDaSolicitacao(s)).pendentes++;
  }

  return [...porArea.values()].sort((a, b) => compararTexto(a.area, b.area));
}
