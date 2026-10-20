// Lista de pedidos de pagamento: quem vê o quê, filtros, contagem por aba, ordenação,
// agrupamento por data de pagamento e os filtros no endereço da página. Puro, para testar
// sem tela. Datas são sempre texto ISO (AAAA-MM-DD), como vêm da coluna DATE.

import { normalizarBusca } from '../../../components/selectBusca';
import type { PaymentMethod, PaymentRequest, PaymentRequestStatus, PaymentRequestType } from '../../../types';

// ─── Abas de status ───────────────────────────────────────────────────────────

export type AbaStatus = 'aberto' | 'autorizacao' | 'pendente' | 'aprovado' | 'pago' | 'rejeitado' | 'todos';

/**
 * "Em aberto" é a fila de trabalho: o que ainda espera o autorizador, o Financeiro ou o
 * pagamento. "Pendentes" é a fila do Financeiro (já autorizados).
 */
export const ABAS: readonly { aba: AbaStatus; rotulo: string; status: readonly PaymentRequestStatus[] | null }[] = [
  { aba: 'aberto', rotulo: 'Em aberto', status: ['awaiting_authorization', 'pending', 'approved'] },
  { aba: 'autorizacao', rotulo: 'A autorizar', status: ['awaiting_authorization'] },
  { aba: 'pendente', rotulo: 'Pendentes', status: ['pending'] },
  { aba: 'aprovado', rotulo: 'A pagar', status: ['approved'] },
  { aba: 'pago', rotulo: 'Pagos', status: ['paid'] },
  { aba: 'rejeitado', rotulo: 'Rejeitados', status: ['rejected', 'cancelled'] },
  { aba: 'todos', rotulo: 'Todos', status: null },
];

export function estaNaAba(p: PaymentRequest, aba: AbaStatus): boolean {
  const status = ABAS.find((a) => a.aba === aba)?.status;
  return !status || status.includes(p.status);
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

export type PeriodoPagamento = 'todas' | 'proximo' | 'semana' | 'atrasados' | 'periodo';
export type OrdemPedidos = 'pagamento' | 'recentes' | 'valor';

export interface FiltrosPagamentos {
  aba: AbaStatus;
  busca: string;
  periodo: PeriodoPagamento;
  /** Só em periodo = 'periodo'; vazio = sem limite daquele lado. */
  de: string;
  ate: string;
  setores: string[];
  tipos: PaymentRequestType[];
  formas: PaymentMethod[];
  /** Nomes como gravados em solicitado_por / autorizado_por (pedidos antigos não têm o id). */
  solicitantes: string[];
  autorizadores: string[];
  soMeus: boolean;
  ordem: OrdemPedidos;
}

export const PERIODOS: readonly PeriodoPagamento[] = ['todas', 'proximo', 'semana', 'atrasados', 'periodo'];
export const ORDENS: readonly OrdemPedidos[] = ['pagamento', 'recentes', 'valor'];
export const TIPOS: readonly PaymentRequestType[] = ['PAGAMENTO', 'REEMBOLSO', 'ADIANTAMENTO'];
export const FORMAS: readonly PaymentMethod[] = ['PIX', 'DINHEIRO', 'BOLETO', 'CAJU', 'SOLIDES'];

/**
 * Como a tela abre: a fila em aberto. Quem aprova trabalha pela data de pagamento;
 * quem só pede quer ver primeiro o que acabou de pedir.
 */
export function filtrosPadrao(aprova: boolean): FiltrosPagamentos {
  return {
    aba: 'aberto',
    busca: '',
    periodo: 'todas',
    de: '',
    ate: '',
    setores: [],
    tipos: [],
    formas: [],
    solicitantes: [],
    autorizadores: [],
    soMeus: false,
    ordem: aprova ? 'pagamento' : 'recentes',
  };
}

/** Quantos recortes do painel "Filtros" estão ligados (a busca e a data ficam na barra). */
export function contarRecortes(f: FiltrosPagamentos): number {
  return f.setores.length + f.tipos.length + f.formas.length + f.solicitantes.length + f.autorizadores.length + (f.soMeus ? 1 : 0);
}

/** Há algo além da aba e da ordem escondendo pedidos. */
export function temFiltroAtivo(f: FiltrosPagamentos): boolean {
  return f.busca.trim() !== '' || f.periodo !== 'todas' || contarRecortes(f) > 0;
}

/** "Limpar tudo": tira busca, data e recortes; aba e ordem são o jeito de ver, não filtros. */
export function limparFiltros(f: FiltrosPagamentos, padrao: FiltrosPagamentos): FiltrosPagamentos {
  return { ...padrao, aba: f.aba, ordem: f.ordem };
}

// ─── Quem vê o quê ────────────────────────────────────────────────────────────

export interface Acesso {
  /** canApprovePayments ou canViewAllPayments. */
  veTodos: boolean;
  departamento: string | null | undefined;
  userId: string | null | undefined;
  email?: string | null;
}

/**
 * A mesma regra da policy de leitura de payment_requests
 * (20261020150000_pagamentos_autorizacao): todos os setores, o próprio setor, o próprio
 * pedido ou um pedido em que a pessoa foi escolhida como autorizadora.
 */
export function podeVer(p: PaymentRequest, acesso: Acesso): boolean {
  if (acesso.veTodos) return true;
  if (acesso.departamento && p.department === acesso.departamento) return true;
  return !!acesso.userId && (p.solicitanteId === acesso.userId || p.autorizadoPorId === acesso.userId);
}

/**
 * Pedido feito por quem está logado. Pedidos anteriores a 2026-10-20 não têm solicitante_id;
 * para eles vale o e-mail gravado na criação.
 */
export function ehMeu(p: PaymentRequest, acesso: Acesso): boolean {
  if (p.solicitanteId) return p.solicitanteId === acesso.userId;
  return !!acesso.email && normalizarBusca(p.emailUsuario ?? '') === normalizarBusca(acesso.email);
}

// ─── Busca ────────────────────────────────────────────────────────────────────

const soDigitos = (texto: string | null | undefined): string => (texto ?? '').replace(/\D/g, '');

/** Tudo que a busca olha, sem acento e em minúsculas. CPF/CNPJ e NF entram também só com os dígitos. */
export function textoBuscavel(p: PaymentRequest): string {
  return normalizarBusca(
    [
      p.codigo,
      p.codigoCompacto,
      p.fornecedor,
      p.documentoNumero,
      soDigitos(p.documentoNumero),
      p.cpfCnpj,
      soDigitos(p.cpfCnpj),
      p.solicitadoPor,
      p.autorizadoPor,
      p.descricaoDetalhada,
      p.department,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

/** Cada palavra digitada precisa aparecer em algum campo: "ana rh" acha a Ana do RH. */
export function casaBusca(p: PaymentRequest, busca: string): boolean {
  const termos = normalizarBusca(busca).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return true;
  const texto = textoBuscavel(p);
  return termos.every((t) => texto.includes(t));
}

// ─── Datas ────────────────────────────────────────────────────────────────────

const doISO = (iso: string): Date => {
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  return new Date(ano, mes - 1, dia);
};

/** Data local em AAAA-MM-DD (sem passar por UTC, que em Brasília volta um dia). */
export function paraISO(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function somarDias(iso: string, dias: number): string {
  const data = doISO(iso);
  data.setDate(data.getDate() + dias);
  return paraISO(data);
}

/** Terça ou quinta mais próxima, contando hoje: os dias em que o Financeiro paga. */
export function proximoDiaDePagamento(hoje: string): string {
  let dia = hoje;
  while (![2, 4].includes(doISO(dia).getDay())) dia = somarDias(dia, 1);
  return dia;
}

/** Segunda a domingo da semana de `hoje`. */
export function semanaDe(hoje: string): { de: string; ate: string } {
  const diaDaSemana = doISO(hoje).getDay();
  const de = somarDias(hoje, diaDaSemana === 0 ? -6 : 1 - diaDaSemana);
  return { de, ate: somarDias(de, 6) };
}

/** Ainda não pago e a data de pagamento já passou. */
export function estaAtrasado(p: PaymentRequest, hoje: string): boolean {
  return (
    (p.status === 'awaiting_authorization' || p.status === 'pending' || p.status === 'approved') &&
    !!p.dataPagamento &&
    p.dataPagamento.slice(0, 10) < hoje
  );
}

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DIAS_LONGOS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

/** "22/10/2026", direto do texto ISO. */
export function formatarDataISO(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

/** "ter, 22/10" */
export function rotuloDiaCurto(iso: string): string {
  return `${DIAS_CURTOS[doISO(iso).getDay()]}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** "Terça-feira, 22/10" */
export function rotuloDiaLongo(iso: string): string {
  return `${DIAS_LONGOS[doISO(iso).getDay()]}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function casaPeriodo(p: PaymentRequest, f: FiltrosPagamentos, hoje: string): boolean {
  const data = (p.dataPagamento ?? '').slice(0, 10);
  switch (f.periodo) {
    case 'todas':
      return true;
    case 'proximo':
      return data === proximoDiaDePagamento(hoje);
    case 'semana': {
      const { de, ate } = semanaDe(hoje);
      return data >= de && data <= ate;
    }
    case 'atrasados':
      return estaAtrasado(p, hoje);
    case 'periodo':
      return (!f.de || data >= f.de) && (!f.ate || data <= f.ate);
  }
}

// ─── Filtrar, contar, ordenar, agrupar ────────────────────────────────────────

const mesmoNome = (a: string | null | undefined, b: string): boolean => normalizarBusca(a ?? '') === normalizarBusca(b);

/** Tudo menos a aba de status: é sobre este recorte que as abas contam. */
export function filtrarSemAba(
  pedidos: readonly PaymentRequest[],
  f: FiltrosPagamentos,
  acesso: Acesso,
  hoje: string,
): PaymentRequest[] {
  return pedidos.filter(
    (p) =>
      podeVer(p, acesso) &&
      casaBusca(p, f.busca) &&
      casaPeriodo(p, f, hoje) &&
      (f.setores.length === 0 || f.setores.includes(p.department ?? '')) &&
      (f.tipos.length === 0 || f.tipos.includes(p.tipoSolicitacao)) &&
      (f.formas.length === 0 || f.formas.includes(p.formaPagamento)) &&
      (f.solicitantes.length === 0 || f.solicitantes.some((n) => mesmoNome(p.solicitadoPor, n))) &&
      (f.autorizadores.length === 0 || f.autorizadores.some((n) => mesmoNome(p.autorizadoPor, n))) &&
      (!f.soMeus || ehMeu(p, acesso)),
  );
}

export function contarPorAba(pedidos: readonly PaymentRequest[]): Record<AbaStatus, { quantidade: number; valor: number }> {
  const contagem = Object.fromEntries(ABAS.map((a) => [a.aba, { quantidade: 0, valor: 0 }])) as Record<
    AbaStatus,
    { quantidade: number; valor: number }
  >;
  for (const p of pedidos) {
    for (const { aba } of ABAS) {
      if (estaNaAba(p, aba)) {
        contagem[aba].quantidade += 1;
        contagem[aba].valor += Number(p.valorTotal) || 0;
      }
    }
  }
  return contagem;
}

export function totalDe(pedidos: readonly PaymentRequest[]): number {
  return pedidos.reduce((soma, p) => soma + (Number(p.valorTotal) || 0), 0);
}

/** Ordena sem mexer no array recebido; empate cai no mais recente primeiro. */
export function ordenarPedidos(pedidos: readonly PaymentRequest[], ordem: OrdemPedidos): PaymentRequest[] {
  const recentes = (a: PaymentRequest, b: PaymentRequest) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  return [...pedidos].sort((a, b) => {
    switch (ordem) {
      case 'pagamento':
        return (a.dataPagamento ?? '').localeCompare(b.dataPagamento ?? '') || recentes(a, b);
      case 'valor':
        return (Number(b.valorTotal) || 0) - (Number(a.valorTotal) || 0) || recentes(a, b);
      case 'recentes':
        return recentes(a, b);
    }
  });
}

export interface GrupoPorData {
  data: string;
  pedidos: PaymentRequest[];
  total: number;
}

/** Pedidos já ordenados por data de pagamento, em blocos de um dia com o subtotal. */
export function agruparPorDataPagamento(pedidos: readonly PaymentRequest[]): GrupoPorData[] {
  const grupos: GrupoPorData[] = [];
  for (const p of pedidos) {
    const data = (p.dataPagamento ?? '').slice(0, 10);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.data === data) {
      ultimo.pedidos.push(p);
      ultimo.total += Number(p.valorTotal) || 0;
    } else {
      grupos.push({ data, pedidos: [p], total: Number(p.valorTotal) || 0 });
    }
  }
  return grupos;
}

/** Nomes distintos ignorando maiúsculas, acentos e espaços; mantém a primeira grafia vista. */
export function nomesDistintos(nomes: readonly (string | null | undefined)[]): string[] {
  const vistos = new Map<string, string>();
  for (const nome of nomes) {
    const limpo = (nome ?? '').trim().replace(/\s+/g, ' ');
    if (limpo && !vistos.has(normalizarBusca(limpo))) vistos.set(normalizarBusca(limpo), limpo);
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
}

export interface OpcoesRecortes {
  setores: { setor: string; quantidade: number }[];
  solicitantes: string[];
  autorizadores: string[];
}

/** As opções do painel "Filtros", tiradas dos pedidos que a pessoa vê. */
export function opcoesDosRecortes(pedidos: readonly PaymentRequest[]): OpcoesRecortes {
  const porSetor = new Map<string, number>();
  for (const p of pedidos) {
    if (p.department) porSetor.set(p.department, (porSetor.get(p.department) ?? 0) + 1);
  }
  return {
    setores: [...porSetor.entries()]
      .map(([setor, quantidade]) => ({ setor, quantidade }))
      .sort((a, b) => a.setor.localeCompare(b.setor, 'pt-BR')),
    solicitantes: nomesDistintos(pedidos.map((p) => p.solicitadoPor)),
    autorizadores: nomesDistintos(pedidos.map((p) => p.autorizadoPor)),
  };
}

// ─── Filtros no endereço da página ────────────────────────────────────────────
// Só o que difere do padrão vai para a URL: a tela recém-aberta fica com o endereço limpo,
// e um link como ?aba=pago&setor=RH abre direto no recorte.

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function filtrosParaParams(f: FiltrosPagamentos, padrao: FiltrosPagamentos): URLSearchParams {
  const params = new URLSearchParams();
  if (f.aba !== padrao.aba) params.set('aba', f.aba);
  if (f.busca.trim()) params.set('q', f.busca);
  if (f.periodo !== 'todas') params.set('periodo', f.periodo);
  if (f.periodo === 'periodo') {
    if (f.de) params.set('de', f.de);
    if (f.ate) params.set('ate', f.ate);
  }
  f.setores.forEach((v) => params.append('setor', v));
  f.tipos.forEach((v) => params.append('tipo', v));
  f.formas.forEach((v) => params.append('forma', v));
  f.solicitantes.forEach((v) => params.append('solicitante', v));
  f.autorizadores.forEach((v) => params.append('autorizador', v));
  if (f.soMeus) params.set('meus', '1');
  if (f.ordem !== padrao.ordem) params.set('ordem', f.ordem);
  return params;
}

/** O que vier torto no endereço (aba inexistente, data inválida) cai no padrão. */
export function filtrosDeParams(params: URLSearchParams, padrao: FiltrosPagamentos): FiltrosPagamentos {
  const umDe = <T extends string>(valor: string | null, validos: readonly T[], seNao: T): T =>
    valor !== null && (validos as readonly string[]).includes(valor) ? (valor as T) : seNao;
  const varios = <T extends string>(nome: string, validos?: readonly T[]): T[] =>
    [...new Set(params.getAll(nome).filter((v) => v.trim() !== ''))].filter(
      (v) => !validos || (validos as readonly string[]).includes(v),
    ) as T[];
  const periodo = umDe(params.get('periodo'), PERIODOS, padrao.periodo);
  const data = (nome: string) => {
    const valor = params.get(nome) ?? '';
    return periodo === 'periodo' && ISO.test(valor) ? valor : '';
  };

  return {
    aba: umDe(params.get('aba'), ABAS.map((a) => a.aba), padrao.aba),
    busca: params.get('q') ?? '',
    periodo,
    de: data('de'),
    ate: data('ate'),
    setores: varios('setor'),
    tipos: varios('tipo', TIPOS),
    formas: varios('forma', FORMAS),
    solicitantes: varios('solicitante'),
    autorizadores: varios('autorizador'),
    soMeus: params.get('meus') === '1',
    ordem: umDe(params.get('ordem'), ORDENS, padrao.ordem),
  };
}
