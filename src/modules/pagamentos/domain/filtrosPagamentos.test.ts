import { describe, expect, it } from 'vitest';
import {
  agruparPorDataPagamento,
  casaBusca,
  contarPorAba,
  contarRecortes,
  ehMeu,
  estaAtrasado,
  filtrarSemAba,
  filtrosDeParams,
  filtrosPadrao,
  filtrosParaParams,
  formatarDataISO,
  limparFiltros,
  nomesDistintos,
  ordenarPedidos,
  podeVer,
  proximoDiaDePagamento,
  rotuloDiaCurto,
  rotuloDiaLongo,
  semanaDe,
  temFiltroAtivo,
  totalDe,
  type Acesso,
  type FiltrosPagamentos,
} from './filtrosPagamentos';
import type { PaymentRequest } from '../../../types';

// 2026-10-20 é uma terça-feira.
const HOJE = '2026-10-20';

const pedido = (campos: Partial<PaymentRequest>): PaymentRequest => ({
  id: 'x',
  codigo: 'PEDIDO DE PAGAMENTO 20/10 - 01',
  codigoCompacto: '20/10 - 01',
  tipoSolicitacao: 'PAGAMENTO',
  documentoNumero: '',
  fornecedor: 'Fornecedor',
  cpfCnpj: '',
  valorTotal: 100,
  formaPagamento: 'PIX',
  dadosPagamento: 'chave',
  descricaoDetalhada: 'Descrição',
  solicitadoPor: 'Sol Estoque',
  emailUsuario: 'sol@lab.com',
  dataPagamento: '2026-10-22',
  department: 'Estoque',
  status: 'pending',
  createdAt: '2026-10-20T10:00:00Z',
  updatedAt: '2026-10-20T10:00:00Z',
  ...campos,
});

const ESTOQUE: Acesso = { veTodos: false, departamento: 'Estoque', userId: 'u-sol', email: 'sol@lab.com' };
const TODOS: Acesso = { veTodos: true, departamento: 'Financeiro', userId: 'u-fin', email: 'fin@lab.com' };
const PADRAO = filtrosPadrao(true);
const com = (campos: Partial<FiltrosPagamentos>): FiltrosPagamentos => ({ ...PADRAO, ...campos });

describe('quem vê o quê', () => {
  it('sem ver todos: o próprio setor e o próprio pedido, como a policy do banco', () => {
    expect(podeVer(pedido({ department: 'Estoque' }), ESTOQUE)).toBe(true);
    expect(podeVer(pedido({ department: 'RH' }), ESTOQUE)).toBe(false);
    expect(podeVer(pedido({ department: 'RH', solicitanteId: 'u-sol' }), ESTOQUE)).toBe(true);
    expect(podeVer(pedido({ department: 'RH' }), TODOS)).toBe(true);
  });

  it('sem setor no perfil, não vê pedidos sem setor de outras pessoas', () => {
    expect(podeVer(pedido({ department: '' }), { ...ESTOQUE, departamento: null })).toBe(false);
  });

  it('"meus pedidos" usa o solicitante e, nos antigos, o e-mail gravado na criação', () => {
    expect(ehMeu(pedido({ solicitanteId: 'u-sol' }), ESTOQUE)).toBe(true);
    expect(ehMeu(pedido({ solicitanteId: 'outro', emailUsuario: 'sol@lab.com' }), ESTOQUE)).toBe(false);
    expect(ehMeu(pedido({ emailUsuario: 'SOL@lab.com' }), ESTOQUE)).toBe(true);
    expect(ehMeu(pedido({ emailUsuario: 'outra@lab.com' }), ESTOQUE)).toBe(false);
  });
});

describe('busca', () => {
  it('ignora acento e maiúsculas, e cada palavra precisa aparecer', () => {
    const p = pedido({ fornecedor: 'Papelaria Conceição', solicitadoPor: 'Ana Souza', department: 'RH' });
    expect(casaBusca(p, 'conceicao')).toBe(true);
    expect(casaBusca(p, 'ANA rh')).toBe(true);
    expect(casaBusca(p, 'ana ti')).toBe(false);
  });

  it('acha CPF/CNPJ e NF só pelos dígitos', () => {
    const p = pedido({ cpfCnpj: '12.345.678/0001-90', documentoNumero: 'NF-000.123' });
    expect(casaBusca(p, '12345678')).toBe(true);
    expect(casaBusca(p, '000123')).toBe(true);
  });

  it('procura em código, autorizador e descrição', () => {
    const p = pedido({ autorizadoPor: 'Gestora', descricaoDetalhada: 'Conserto da centrífuga' });
    expect(casaBusca(p, '20/10 - 01')).toBe(true);
    expect(casaBusca(p, 'gestora')).toBe(true);
    expect(casaBusca(p, 'centrifuga')).toBe(true);
  });

  it('não quebra com campos nulos de pedidos antigos', () => {
    const antigo = pedido({ documentoNumero: null as unknown as string, cpfCnpj: null as unknown as string });
    expect(casaBusca(antigo, 'qualquer')).toBe(false);
  });
});

describe('datas de pagamento', () => {
  it('próximo dia de pagamento é a terça ou quinta mais próxima, contando hoje', () => {
    expect(proximoDiaDePagamento('2026-10-20')).toBe('2026-10-20'); // terça
    expect(proximoDiaDePagamento('2026-10-21')).toBe('2026-10-22'); // quarta → quinta
    expect(proximoDiaDePagamento('2026-10-23')).toBe('2026-10-27'); // sexta → terça
  });

  it('semana vai de segunda a domingo, inclusive quando hoje é domingo', () => {
    expect(semanaDe('2026-10-20')).toEqual({ de: '2026-10-19', ate: '2026-10-25' });
    expect(semanaDe('2026-10-25')).toEqual({ de: '2026-10-19', ate: '2026-10-25' });
  });

  it('atrasado é o que ainda não foi pago e já passou da data', () => {
    expect(estaAtrasado(pedido({ status: 'approved', dataPagamento: '2026-10-15' }), HOJE)).toBe(true);
    expect(estaAtrasado(pedido({ status: 'pending', dataPagamento: '2026-10-15' }), HOJE)).toBe(true);
    expect(estaAtrasado(pedido({ status: 'paid', dataPagamento: '2026-10-15' }), HOJE)).toBe(false);
    expect(estaAtrasado(pedido({ status: 'approved', dataPagamento: HOJE }), HOJE)).toBe(false);
  });

  it('formata direto do texto, sem voltar um dia pelo fuso', () => {
    expect(formatarDataISO('2026-10-22')).toBe('22/10/2026');
    expect(rotuloDiaCurto('2026-10-22')).toBe('qui, 22/10');
    expect(rotuloDiaLongo('2026-10-20')).toBe('Terça-feira, 20/10');
  });
});

describe('filtrar e contar', () => {
  const pedidos = [
    pedido({ id: 'a', status: 'pending', department: 'Estoque', valorTotal: 100, dataPagamento: '2026-10-20' }),
    pedido({ id: 'b', status: 'approved', department: 'Estoque', valorTotal: 50, dataPagamento: '2026-10-15' }),
    pedido({ id: 'c', status: 'paid', department: 'RH', valorTotal: 30, tipoSolicitacao: 'REEMBOLSO' }),
    pedido({ id: 'd', status: 'rejected', department: 'RH', valorTotal: 10, formaPagamento: 'BOLETO' }),
    pedido({ id: 'e', status: 'cancelled', department: 'TI', valorTotal: 5, solicitadoPor: 'José', autorizadoPor: 'Gestora' }),
  ];
  const ids = (f: FiltrosPagamentos, acesso: Acesso = TODOS) => filtrarSemAba(pedidos, f, acesso, HOJE).map((p) => p.id);

  it('as abas contam quantidade e valor do recorte', () => {
    const c = contarPorAba(pedidos);
    expect(c.aberto).toEqual({ quantidade: 2, valor: 150 });
    expect(c.pendente.quantidade).toBe(1);
    expect(c.aprovado.quantidade).toBe(1);
    expect(c.pago.quantidade).toBe(1);
    expect(c.rejeitado).toEqual({ quantidade: 2, valor: 15 });
    expect(c.todos.quantidade).toBe(5);
    expect(totalDe(pedidos)).toBe(195);
  });

  it('aplica acesso, setor, tipo, forma, nomes e período', () => {
    expect(ids(PADRAO, ESTOQUE)).toEqual(['a', 'b']);
    expect(ids(com({ setores: ['RH', 'TI'] }))).toEqual(['c', 'd', 'e']);
    expect(ids(com({ tipos: ['REEMBOLSO'] }))).toEqual(['c']);
    expect(ids(com({ formas: ['BOLETO'] }))).toEqual(['d']);
    expect(ids(com({ solicitantes: ['jose'] }))).toEqual(['e']);
    expect(ids(com({ autorizadores: ['GESTORA'] }))).toEqual(['e']);
    expect(ids(com({ periodo: 'atrasados' }))).toEqual(['b']);
    expect(ids(com({ periodo: 'proximo' }))).toEqual(['a']);
    expect(ids(com({ periodo: 'periodo', de: '2026-10-16', ate: '' }))).toEqual(['a', 'c', 'd', 'e']);
  });

  it('"só os meus" e a contagem de recortes', () => {
    const meus = filtrarSemAba(
      [pedido({ id: 'm', solicitanteId: 'u-fin' }), pedido({ id: 'n', solicitanteId: 'u-sol' })],
      com({ soMeus: true }),
      TODOS,
      HOJE,
    );
    expect(meus.map((p) => p.id)).toEqual(['m']);
    expect(contarRecortes(com({ setores: ['RH'], tipos: ['PAGAMENTO'], soMeus: true }))).toBe(3);
  });

  it('limpar tira busca, data e recortes, mas mantém a aba e a ordem', () => {
    const sujo = com({ aba: 'pago', ordem: 'valor', busca: 'x', periodo: 'semana', setores: ['RH'] });
    expect(temFiltroAtivo(sujo)).toBe(true);
    const limpo = limparFiltros(sujo, PADRAO);
    expect(limpo).toEqual({ ...PADRAO, aba: 'pago', ordem: 'valor' });
    expect(temFiltroAtivo(limpo)).toBe(false);
  });
});

describe('ordenar e agrupar', () => {
  const pedidos = [
    pedido({ id: 'a', dataPagamento: '2026-10-22', valorTotal: 10, createdAt: '2026-10-01T00:00:00Z' }),
    pedido({ id: 'b', dataPagamento: '2026-10-20', valorTotal: 30, createdAt: '2026-10-03T00:00:00Z' }),
    pedido({ id: 'c', dataPagamento: '2026-10-22', valorTotal: 20, createdAt: '2026-10-02T00:00:00Z' }),
  ];

  it('ordena por data de pagamento, mais recentes ou maior valor', () => {
    expect(ordenarPedidos(pedidos, 'pagamento').map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect(ordenarPedidos(pedidos, 'recentes').map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect(ordenarPedidos(pedidos, 'valor').map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect(pedidos.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('agrupa por dia de pagamento com o subtotal', () => {
    const grupos = agruparPorDataPagamento(ordenarPedidos(pedidos, 'pagamento'));
    expect(grupos.map((g) => [g.data, g.pedidos.length, g.total])).toEqual([
      ['2026-10-20', 1, 30],
      ['2026-10-22', 2, 30],
    ]);
  });

  it('nomes distintos ignoram acento e maiúsculas e mantêm a primeira grafia', () => {
    expect(nomesDistintos(['José', 'jose ', 'Ana', null, ''])).toEqual(['Ana', 'José']);
  });
});

describe('filtros no endereço', () => {
  it('a tela recém-aberta não põe nada na URL', () => {
    expect(filtrosParaParams(PADRAO, PADRAO).toString()).toBe('');
  });

  it('ida e volta preservam o recorte', () => {
    const f = com({
      aba: 'pago',
      busca: 'conceição',
      periodo: 'periodo',
      de: '2026-10-01',
      ate: '2026-10-31',
      setores: ['RH', 'TI'],
      tipos: ['REEMBOLSO'],
      formas: ['PIX'],
      solicitantes: ['Ana Souza'],
      autorizadores: ['Gestora'],
      soMeus: true,
      ordem: 'valor',
    });
    expect(filtrosDeParams(filtrosParaParams(f, PADRAO), PADRAO)).toEqual(f);
  });

  it('valor torto no endereço cai no padrão', () => {
    const f = filtrosDeParams(new URLSearchParams('aba=xyz&ordem=nada&tipo=OUTRO&periodo=semana&de=2026-10-01'), PADRAO);
    expect(f.aba).toBe(PADRAO.aba);
    expect(f.ordem).toBe(PADRAO.ordem);
    expect(f.tipos).toEqual([]);
    expect(f.periodo).toBe('semana');
    expect(f.de).toBe('');
  });
});
