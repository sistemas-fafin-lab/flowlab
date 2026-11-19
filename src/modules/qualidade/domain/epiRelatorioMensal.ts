// Domínio do Relatório mensal de EPI (CONTEXT.md, seção Estoque e Qualidade;
// .scratch/epi-relatorio-mensal/spec.md). Regras puras, sem banco e sem tela.

import { formatarIdentificacaoEpi, type CamposEpi, type CopiaIdentificacaoEpi } from '../../../utils/epi.js';

/** O que o domínio precisa de um produto: o id, o nome atual (para os totais do consolidado) e os campos de EPI do cadastro. */
export type ProdutoComIdentificacaoEpi = { id: string; nome?: string } & CamposEpi;

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

/** Uma linha do mês com a sua área e o produto EPI do cadastro. */
type LinhaDoMes = { area: string; produto: ProdutoComIdentificacaoEpi; linha: LinhaRelatorioEpi };

/** Linhas de todas as áreas do mês (YYYY-MM), cada uma com a sua área e o produto, já ordenadas. */
function linhasDoMes(
  { solicitacoes, produtos, movimentacoes }: DadosRelatorioEpi,
  mes: string,
): LinhaDoMes[] {
  const porId = produtosPorId(produtos);
  const baixados = new Set(movimentacoes.map((m) => `${m.requestId}|${m.productId}`));
  const resultado: LinhaDoMes[] = [];
  for (const s of solicitacoes) {
    if (!smDoMes(s, mes, STATUS_ENTREGUE)) continue;
    for (const item of s.items) {
      const produto = produtoEpiDoItem(porId, item.productId);
      if (!produto || !baixados.has(`${s.id}|${produto.id}`)) continue;
      resultado.push({
        area: areaDaSolicitacao(s),
        produto,
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

// ─── Consolidado do mês ──────────────────────────────────────────────────────

/** Uma linha do consolidado: a linha do relatório por área, com a área. */
export interface LinhaConsolidadoEpi extends LinhaRelatorioEpi {
  area: string;
}

export interface ConsolidadoEpi {
  /** Todas as áreas, ordenadas por área, data e solicitante. */
  linhas: LinhaConsolidadoEpi[];
  /**
   * Soma das quantidades por produto (pelo id, para que um produto renomeado não se divida), com
   * o nome atual do cadastro, em ordem alfabética.
   */
  totaisPorProduto: { produto: string; quantidade: number }[];
  /** Soma das quantidades por área, em ordem alfabética. */
  totaisPorArea: { area: string; quantidade: number }[];
  totalGeral: number;
}

/**
 * Soma `quantidade` agrupando pela chave, com o nome de cada grupo, em ordem alfabética do nome.
 * Num grupo, vale o nome da última linha (as linhas vêm em ordem de data).
 */
function somarPor<L extends { quantidade: number }>(
  linhas: L[],
  chave: (l: L) => string,
  nome: (l: L) => string,
): { nome: string; quantidade: number }[] {
  const somas = new Map<string, { nome: string; quantidade: number }>();
  for (const l of linhas) {
    const k = chave(l);
    somas.set(k, { nome: nome(l), quantidade: (somas.get(k)?.quantidade ?? 0) + l.quantidade });
  }
  return [...somas.values()].sort((a, b) => compararTexto(a.nome, b.nome));
}

/**
 * Consolidado do mês (YYYY-MM): as linhas de todas as áreas, pelas mesmas regras de inclusão do
 * relatório por área, e os totais por produto e por área. Sem fechamento: sempre calculado dos
 * dados atuais, mesmo com áreas fechadas.
 */
export function montarConsolidadoEpi(dados: DadosRelatorioEpi, mes: string): ConsolidadoEpi {
  const doMes = linhasDoMes(dados, mes);
  const porProduto = somarPor(
    doMes.map(({ produto, linha }) => ({ produto, quantidade: linha.quantidade, nomeNoItem: linha.produto })),
    (l) => l.produto.id,
    // O nome atual do cadastro; sem ele, o gravado na entrega mais recente.
    (l) => l.produto.nome?.trim() || l.nomeNoItem,
  );
  const linhas = doMes
    .map(({ area, linha }) => ({ area, ...linha }))
    // Estável: dentro da área, mantém a ordem por data e solicitante.
    .sort((a, b) => compararTexto(a.area, b.area));
  return {
    linhas,
    totaisPorProduto: porProduto.map(({ nome, quantidade }) => ({ produto: nome, quantidade })),
    totaisPorArea: somarPor(linhas, (l) => l.area, (l) => l.area).map(({ nome, quantidade }) => ({ area: nome, quantidade })),
    totalGeral: linhas.reduce((soma, l) => soma + l.quantidade, 0),
  };
}

/**
 * Situação de uma área no mês: aberto (nunca fechada ou reaberta, calculada na hora), fechado
 * (linhas congeladas) ou assinado (com PDF assinado anexado ao fechamento atual).
 */
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
 * O fechamento de uma área no mês, como está gravado: a situação atual e as linhas congeladas
 * no último fechamento (ignoradas quando a área foi reaberta).
 */
export interface FechamentoEpi {
  area: string;
  situacao: SituacaoAreaEpi;
  linhas: LinhaRelatorioEpi[];
}

/** Área fechada ou assinada: o conteúdo é o congelado. Aberta (ou sem fechamento): calculado na hora. */
const congelado = (f: FechamentoEpi | undefined): f is FechamentoEpi => Boolean(f && f.situacao !== 'aberto');

/**
 * Áreas do mês (YYYY-MM) com EPI entregue, com pedido de EPI ainda não entregue ou com
 * fechamento, em ordem alfabética. Área fechada conta as linhas congeladas. A contagem de
 * pendentes avisa para não fechar o relatório antes da hora.
 */
export function listarAreasEpiDoMes(
  dados: DadosRelatorioEpi,
  mes: string,
  fechamentos: FechamentoEpi[] = [],
): AreaEpiDoMes[] {
  const porArea = new Map<string, AreaEpiDoMes>();
  const daArea = (area: string) => {
    let a = porArea.get(area);
    if (!a) porArea.set(area, (a = { area, situacao: 'aberto', linhas: 0, pendentes: 0 }));
    return a;
  };

  const fechamentoPorArea = new Map(fechamentos.map((f) => [f.area, f]));
  for (const { area } of linhasDoMes(dados, mes)) {
    if (!congelado(fechamentoPorArea.get(area))) daArea(area).linhas++;
  }
  for (const f of fechamentos) {
    const a = daArea(f.area);
    a.situacao = f.situacao;
    if (congelado(f)) a.linhas = f.linhas.length;
  }

  const porId = produtosPorId(dados.produtos);
  for (const s of dados.solicitacoes) {
    if (!smDoMes(s, mes, STATUS_NAO_ENTREGUE)) continue;
    if (s.items.some((i) => produtoEpiDoItem(porId, i.productId))) daArea(areaDaSolicitacao(s)).pendentes++;
  }

  return [...porArea.values()].sort((a, b) => compararTexto(a.area, b.area));
}

// ─── Fechamento do relatório de EPI ──────────────────────────────────────────
/**
 * As linhas que vão para o PDF da área: as congeladas, se a área está fechada ou assinada;
 * senão (sem fechamento ou reaberta), calculadas na hora por `montarLinhasEpi`.
 */
export function linhasDoRelatorioEpi(
  dados: DadosRelatorioEpi,
  filtro: { area: string; mes: string },
  fechamento?: FechamentoEpi,
): LinhaRelatorioEpi[] {
  return congelado(fechamento) ? fechamento.linhas : montarLinhasEpi(dados, filtro);
}

export type AcaoFechamentoEpi = { tipo: 'fechar' } | { tipo: 'reabrir'; motivo: string } | { tipo: 'anexar' };

export type ResultadoTransicaoEpi = { ok: true; situacao: SituacaoAreaEpi } | { ok: false; erro: string };

/**
 * Regras de fechamento: fechar vai de aberto para fechado; reabrir vai de fechado ou assinado
 * para aberto e exige motivo; anexar o PDF assinado vai de fechado ou assinado para assinado,
 * para que o documento assinado corresponda ao conteúdo congelado. Qualquer outra transição é
 * recusada com a mensagem para a tela.
 */
export function transicaoFechamentoEpi(situacao: SituacaoAreaEpi, acao: AcaoFechamentoEpi): ResultadoTransicaoEpi {
  if (acao.tipo === 'fechar') {
    return situacao === 'aberto' ? { ok: true, situacao: 'fechado' } : { ok: false, erro: 'A área já está fechada.' };
  }
  if (acao.tipo === 'anexar') {
    return situacao === 'aberto'
      ? { ok: false, erro: 'Feche a área antes de anexar o PDF assinado.' }
      : { ok: true, situacao: 'assinado' };
  }
  if (situacao === 'aberto') return { ok: false, erro: 'A área já está aberta.' };
  if (!acao.motivo.trim()) return { ok: false, erro: 'Informe o motivo da reabertura.' };
  return { ok: true, situacao: 'aberto' };
}

/** A situação atual de uma área e quem a fechou por último (vale também depois de reaberta). */
export interface UltimoFechamentoEpi {
  situacao: SituacaoAreaEpi;
  fechadoPor: string;
  fechadoEm: string;
}

/** Uma reabertura gravada: o motivo, quem reabriu e quando, e o fechamento que ela desfez. */
export interface ReaberturaEpi {
  motivo: string;
  fechadoPor: string;
  fechadoEm: string;
  reabertoPor: string;
  reabertoEm: string;
}

/** Um PDF assinado e digitalizado anexado ao fechamento. Anexos nunca são apagados. */
export interface AnexoAssinadoEpi {
  /** Caminho no armazenamento privado dos PDFs assinados. */
  caminho: string;
  nomeArquivo: string;
  enviadoPor: string;
  enviadoEm: string;
}

export type EventoFechamentoEpi =
  | { tipo: 'fechou'; por: string; em: string }
  | { tipo: 'reabriu'; por: string; em: string; motivo: string }
  | { tipo: 'anexou'; por: string; em: string; caminho: string; nomeArquivo: string };

/**
 * Histórico de uma área no mês, do mais antigo ao mais recente: cada fechamento desfeito e a
 * reabertura que o desfez (com o motivo), cada PDF assinado anexado (mesmo os de fechamentos
 * já desfeitos) e, se a área está fechada ou assinada, o fechamento atual.
 */
export function historicoFechamentoEpi(
  atual: UltimoFechamentoEpi | undefined,
  reaberturas: ReaberturaEpi[],
  anexos: AnexoAssinadoEpi[] = [],
): EventoFechamentoEpi[] {
  const eventos: EventoFechamentoEpi[] = reaberturas.flatMap((r): EventoFechamentoEpi[] => [
    { tipo: 'fechou', por: r.fechadoPor, em: r.fechadoEm },
    { tipo: 'reabriu', por: r.reabertoPor, em: r.reabertoEm, motivo: r.motivo },
  ]);
  if (atual && atual.situacao !== 'aberto') {
    eventos.push({ tipo: 'fechou', por: atual.fechadoPor, em: atual.fechadoEm });
  }
  for (const a of anexos) {
    eventos.push({ tipo: 'anexou', por: a.enviadoPor, em: a.enviadoEm, caminho: a.caminho, nomeArquivo: a.nomeArquivo });
  }
  return eventos.sort((a, b) => a.em.localeCompare(b.em));
}

/** O PDF assinado enviado por último (o que "Ver assinado" abre), ou undefined sem anexo. */
export function anexoMaisRecenteEpi(anexos: AnexoAssinadoEpi[]): AnexoAssinadoEpi | undefined {
  return anexos.reduce<AnexoAssinadoEpi | undefined>(
    (maisRecente, a) => (!maisRecente || a.enviadoEm > maisRecente.enviadoEm ? a : maisRecente),
    undefined,
  );
}

/** Limite do PDF assinado (o mesmo do armazenamento, migration 20261119140000). */
export const TAMANHO_MAXIMO_PDF_ASSINADO_EPI = 20 * 1024 * 1024;

/**
 * O PDF assinado e digitalizado: só PDF (pelo tipo ou, sem tipo, pela extensão), não vazio, até 20 MB. O armazenamento recusa o resto
 * também; validar aqui só evita subir o arquivo para ouvir "não" no fim.
 */
export function validarPdfAssinadoEpi(arquivo: { name: string; type: string; size: number }): string | null {
  // Alguns navegadores e sistemas não informam o tipo: vale a extensão (o envio declara application/pdf).
  const ehPdf = arquivo.type === 'application/pdf' || (!arquivo.type && /\.pdf$/i.test(arquivo.name));
  if (!ehPdf) return `"${arquivo.name}": só PDF.`;
  if (arquivo.size === 0) return `"${arquivo.name}" está vazio.`;
  if (arquivo.size > TAMANHO_MAXIMO_PDF_ASSINADO_EPI) return `"${arquivo.name}" passa do limite de 20 MB.`;
  return null;
}
