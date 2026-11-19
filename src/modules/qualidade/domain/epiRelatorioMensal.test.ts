import { describe, expect, it } from 'vitest';
import {
  copiarIdentificacaoEpi,
  historicoFechamentoEpi,
  linhasDoRelatorioEpi,
  listarAreasEpiDoMes,
  montarLinhasEpi,
  transicaoFechamentoEpi,
  type FechamentoEpi,
  type LinhaRelatorioEpi,
  type MovimentacaoParaEpi,
  type ProdutoComIdentificacaoEpi,
  type SolicitacaoParaEpi,
} from './epiRelatorioMensal.js';

const luva: ProdutoComIdentificacaoEpi = {
  id: 'p-luva',
  isEpi: true,
  epiTipo: 'CA',
  epiNumero: '12345',
  epiValidade: '2027-03-31',
};

describe('copiarIdentificacaoEpi', () => {
  it('item de produto EPI recebe a cópia da identificação vigente', () => {
    const itens = [{ id: 'i1', productId: 'p-luva', productName: 'Luva', quantity: 2, category: 'general' }];

    expect(copiarIdentificacaoEpi(itens, [luva])).toEqual([
      {
        id: 'i1',
        productId: 'p-luva',
        productName: 'Luva',
        quantity: 2,
        category: 'general',
        identificacaoEpi: { tipo: 'CA', numero: '12345', validade: '2027-03-31' },
      },
    ]);
  });

  it('EPI sem identificação no cadastro recebe cópia vazia, sem erro', () => {
    const mascara: ProdutoComIdentificacaoEpi = { id: 'p-mascara', isEpi: true, epiTipo: '', epiNumero: '', epiValidade: '' };
    const itens = [{ id: 'i1', productId: 'p-mascara', productName: 'Máscara', quantity: 1, category: 'general' }];

    expect(copiarIdentificacaoEpi(itens, [mascara])[0].identificacaoEpi).toEqual({
      tipo: null,
      numero: null,
      validade: null,
    });
  });

  it('item de produto que não é EPI fica intacto', () => {
    const papel: ProdutoComIdentificacaoEpi = { id: 'p-papel', isEpi: false, epiTipo: '', epiNumero: '', epiValidade: '' };
    const item = { id: 'i1', productId: 'p-papel', productName: 'Papel A4', quantity: 5, category: 'general' };

    const [resultado] = copiarIdentificacaoEpi([item], [papel]);

    expect(resultado).toEqual(item);
    expect(resultado).not.toHaveProperty('identificacaoEpi');
  });

  it('item digitado à mão, sem produto cadastrado, não recebe cópia', () => {
    const item = { id: 'i1', productId: null, productName: 'Luva', quantity: 1, category: 'general' };

    const [resultado] = copiarIdentificacaoEpi([item], [luva]);

    expect(resultado).not.toHaveProperty('identificacaoEpi');
  });

  it('numa solicitação mista, só os itens EPI recebem a cópia, na mesma ordem', () => {
    const papel: ProdutoComIdentificacaoEpi = { id: 'p-papel', isEpi: false, epiTipo: '', epiNumero: '', epiValidade: '' };
    const itens = [
      { id: 'i1', productId: 'p-papel', productName: 'Papel A4', quantity: 5, category: 'general' },
      { id: 'i2', productId: 'p-luva', productName: 'Luva', quantity: 2, category: 'general' },
      { id: 'i3', productId: null, productName: 'Caneta', quantity: 1, category: 'general' },
    ];

    const resultado = copiarIdentificacaoEpi(itens, [papel, luva]);

    expect(resultado.map((i) => i.id)).toEqual(['i1', 'i2', 'i3']);
    expect(resultado.map((i) => 'identificacaoEpi' in i)).toEqual([false, true, false]);
  });
});

// ─── Relatório mensal de EPI por área ────────────────────────────────────────

const papel: ProdutoComIdentificacaoEpi = { id: 'p-papel', isEpi: false, epiTipo: '', epiNumero: '', epiValidade: '' };
const produtos = [luva, papel];

const sm = (sobre: Partial<SolicitacaoParaEpi> = {}): SolicitacaoParaEpi => ({
  id: 'sm-1',
  type: 'SM',
  status: 'completed',
  requestDate: '2026-10-05',
  department: 'Recepção',
  requestedBy: 'Ana',
  items: [{ id: 'i1', productId: 'p-luva', productName: 'Luva nitrílica', quantity: 2 }],
  ...sobre,
});

/** Movimentação de estoque de cada item de produto das solicitações (o item foi baixado). */
const baixas = (solicitacoes: SolicitacaoParaEpi[]): MovimentacaoParaEpi[] =>
  solicitacoes.flatMap((s) => s.items.filter((i) => i.productId).map((i) => ({ requestId: s.id, productId: i.productId! })));

const linhas = (solicitacoes: SolicitacaoParaEpi[], area = 'Recepção', mes = '2026-10', movimentacoes = baixas(solicitacoes)) =>
  montarLinhasEpi({ solicitacoes, produtos, movimentacoes }, { area, mes });

describe('montarLinhasEpi', () => {
  it('item de EPI de uma solicitação de materiais concluída vira uma linha', () => {
    expect(linhas([sm()])).toEqual([
      {
        solicitacaoId: 'sm-1',
        itemId: 'i1',
        data: '2026-10-05',
        produto: 'Luva nitrílica',
        identificacao: 'CA 12345',
        quantidade: 2,
        solicitante: 'Ana',
      },
    ]);
  });

  it('solicitação de compra fica fora', () => {
    expect(linhas([sm({ type: 'SC' })])).toEqual([]);
  });

  it.each(['pending', 'approved', 'rejected'])('solicitação %s (não concluída) fica fora', (status) => {
    expect(linhas([sm({ status })])).toEqual([]);
  });

  it('item digitado à mão, sem produto cadastrado, fica fora', () => {
    expect(linhas([sm({ items: [{ id: 'i1', productId: null, productName: 'Luva', quantity: 1 }] })])).toEqual([]);
  });

  it('item de produto que não é EPI fica fora', () => {
    expect(linhas([sm({ items: [{ id: 'i1', productId: 'p-papel', productName: 'Papel A4', quantity: 5 }] })])).toEqual([]);
  });

  it('item sem movimentação de estoque (pulado na entrega por falta de estoque) fica fora', () => {
    const s = sm();
    expect(linhas([s], 'Recepção', '2026-10', [])).toEqual([]);
    // A movimentação precisa ser da mesma solicitação e do mesmo produto.
    expect(linhas([s], 'Recepção', '2026-10', [{ requestId: 'outra-sm', productId: 'p-luva' }, { requestId: 'sm-1', productId: 'p-papel' }])).toEqual([]);
  });

  it('solicitação de um mês entregue no mês seguinte entra no mês da solicitação', () => {
    // Concluída em novembro, mas pedida em 31/10: o relatório usa a data da solicitação.
    const s = sm({ requestDate: '2026-10-31' });
    expect(linhas([s], 'Recepção', '2026-10')).toHaveLength(1);
    expect(linhas([s], 'Recepção', '2026-11')).toEqual([]);
    expect(linhas([sm({ requestDate: '2025-10-05' })], 'Recepção', '2026-10')).toEqual([]);
  });

  it('só entram as solicitações do setor da área, com a grafia gravada', () => {
    const solicitacoes = [
      sm({ id: 'sm-rec', department: 'Recepção' }),
      sm({ id: 'sm-lab', department: 'Laboratório' }),
      sm({ id: 'sm-rec2', department: 'Recepcao' }),
    ];
    expect(linhas(solicitacoes, 'Recepção').map((l) => l.solicitacaoId)).toEqual(['sm-rec']);
    expect(linhas(solicitacoes, 'Laboratório').map((l) => l.solicitacaoId)).toEqual(['sm-lab']);
  });

  describe('identificação', () => {
    const comItem = (identificacaoEpi?: SolicitacaoParaEpi['items'][number]['identificacaoEpi']) =>
      sm({ items: [{ id: 'i1', productId: 'p-luva', productName: 'Luva nitrílica', quantity: 2, identificacaoEpi }] });

    it('vem da cópia gravada no item, mesmo que o cadastro tenha mudado depois', () => {
      const [linha] = linhas([comItem({ tipo: 'ANVISA', numero: '80495510226', validade: null })]);
      expect(linha.identificacao).toBe('ANVISA 80495510226');
    });

    it('sem cópia (entrega anterior à funcionalidade), vem do cadastro atual do produto', () => {
      const [linha] = linhas([comItem(undefined)]);
      expect(linha.identificacao).toBe('CA 12345');
    });

    it('com cópia vazia, fica vazia (foi entregue sem identificação), sem cair no cadastro atual', () => {
      const [linha] = linhas([comItem({ tipo: null, numero: null, validade: null })]);
      expect(linha.identificacao).toBe('');
    });

    it('sem cópia e sem identificação no cadastro, fica vazia', () => {
      const semNumero: ProdutoComIdentificacaoEpi = { ...luva, epiTipo: '', epiNumero: '' };
      const s = comItem(undefined);
      const [linha] = montarLinhasEpi({ solicitacoes: [s], produtos: [semNumero], movimentacoes: baixas([s]) }, { area: 'Recepção', mes: '2026-10' });
      expect(linha.identificacao).toBe('');
    });
  });

  it('ordena por data e depois por solicitante', () => {
    const solicitacoes = [
      sm({ id: 'a', requestDate: '2026-10-20', requestedBy: 'Bruno' }),
      sm({ id: 'b', requestDate: '2026-10-03', requestedBy: 'Carla' }),
      sm({ id: 'c', requestDate: '2026-10-20', requestedBy: 'Ana' }),
      sm({ id: 'd', requestDate: '2026-10-03', requestedBy: 'Álvaro' }),
    ];
    expect(linhas(solicitacoes).map((l) => l.solicitacaoId)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('uma linha por item de EPI entregue, numa solicitação mista', () => {
    const s = sm({
      items: [
        { id: 'i1', productId: 'p-luva', productName: 'Luva nitrílica', quantity: 2 },
        { id: 'i2', productId: 'p-papel', productName: 'Papel A4', quantity: 5 },
        { id: 'i3', productId: 'p-luva', productName: 'Luva nitrílica', quantity: 1 },
      ],
    });
    expect(linhas([s]).map((l) => [l.itemId, l.quantidade])).toEqual([['i1', 2], ['i3', 1]]);
  });
});

/** Linha congelada num fechamento, diferente de qualquer linha calculada na hora. */
const congelada: LinhaRelatorioEpi = {
  solicitacaoId: 'sm-antiga',
  itemId: 'i1',
  data: '2026-10-01',
  produto: 'Luva nitrílica',
  identificacao: 'CA 999',
  quantidade: 1,
  solicitante: 'Caio',
};

describe('listarAreasEpiDoMes', () => {
  const areas = (solicitacoes: SolicitacaoParaEpi[], mes = '2026-10', movimentacoes = baixas(solicitacoes)) =>
    listarAreasEpiDoMes({ solicitacoes, produtos, movimentacoes }, mes);

  it('lista as áreas com EPI entregue no mês, em ordem alfabética, todas abertas', () => {
    const solicitacoes = [
      sm({ id: 'r1', department: 'Recepção' }),
      sm({ id: 'r2', department: 'Recepção', requestedBy: 'Bia' }),
      sm({ id: 'l1', department: 'Laboratório' }),
      sm({ id: 'x1', department: 'Expedição', requestDate: '2026-09-30' }),
      sm({ id: 'c1', department: 'Copa', items: [{ id: 'i1', productId: 'p-papel', productName: 'Papel A4', quantity: 1 }] }),
    ];

    expect(areas(solicitacoes)).toEqual([
      { area: 'Laboratório', situacao: 'aberto', linhas: 1, pendentes: 0 },
      { area: 'Recepção', situacao: 'aberto', linhas: 2, pendentes: 0 },
    ]);
  });

  it('conta os pedidos de EPI do mês ainda não entregues (pendentes ou aprovados) de cada área', () => {
    const solicitacoes = [
      sm({ id: 'r1' }),
      sm({ id: 'r2', status: 'pending' }),
      sm({ id: 'r3', status: 'approved' }),
      // Não contam: rejeitada, compra, sem EPI, de outro mês.
      sm({ id: 'r4', status: 'rejected' }),
      sm({ id: 'r5', status: 'pending', type: 'SC' }),
      sm({ id: 'r6', status: 'pending', items: [{ id: 'i1', productId: 'p-papel', productName: 'Papel A4', quantity: 1 }] }),
      sm({ id: 'r7', status: 'pending', requestDate: '2026-11-02' }),
    ];

    expect(areas(solicitacoes)).toEqual([{ area: 'Recepção', situacao: 'aberto', linhas: 1, pendentes: 2 }]);
  });

  it('área só com pedidos de EPI ainda não entregues aparece, sem linhas, para não passar despercebida', () => {
    expect(areas([sm({ status: 'approved' })])).toEqual([{ area: 'Recepção', situacao: 'aberto', linhas: 0, pendentes: 1 }]);
  });

  it('solicitação sem setor gravado vai para a área "Sem setor"', () => {
    expect(areas([sm({ department: '' })]).map((a) => a.area)).toEqual(['Sem setor']);
  });

  it('mês sem nenhum EPI não tem área', () => {
    expect(areas([sm()], '2026-12')).toEqual([]);
  });

  describe('com fechamento', () => {
    const comFechamentos = (solicitacoes: SolicitacaoParaEpi[], fechamentos: FechamentoEpi[]) =>
      listarAreasEpiDoMes({ solicitacoes, produtos, movimentacoes: baixas(solicitacoes) }, '2026-10', fechamentos);

    it('área fechada mostra a situação e conta as linhas congeladas, não as atuais', () => {
      const solicitacoes = [sm({ id: 'r1' }), sm({ id: 'r2' }), sm({ id: 'l1', department: 'Laboratório' })];

      expect(
        comFechamentos(solicitacoes, [{ area: 'Recepção', situacao: 'fechado', linhas: [congelada] }]),
      ).toEqual([
        { area: 'Laboratório', situacao: 'aberto', linhas: 1, pendentes: 0 },
        { area: 'Recepção', situacao: 'fechado', linhas: 1, pendentes: 0 },
      ]);
    });

    it('área assinada mostra a situação assinado', () => {
      const [area] = comFechamentos([sm()], [{ area: 'Recepção', situacao: 'assinado', linhas: [congelada] }]);
      expect(area.situacao).toBe('assinado');
    });

    it('área fechada aparece mesmo que as solicitações tenham mudado e não haja mais linha atual', () => {
      expect(comFechamentos([], [{ area: 'Copa', situacao: 'fechado', linhas: [congelada] }])).toEqual([
        { area: 'Copa', situacao: 'fechado', linhas: 1, pendentes: 0 },
      ]);
    });

    it('área reaberta sem nenhuma linha atual continua na lista, para o histórico ficar acessível', () => {
      expect(comFechamentos([], [{ area: 'Copa', situacao: 'aberto', linhas: [congelada] }])).toEqual([
        { area: 'Copa', situacao: 'aberto', linhas: 0, pendentes: 0 },
      ]);
    });

    it('área reaberta volta a contar as linhas calculadas na hora', () => {
      const solicitacoes = [sm({ id: 'r1' }), sm({ id: 'r2' })];

      expect(comFechamentos(solicitacoes, [{ area: 'Recepção', situacao: 'aberto', linhas: [congelada] }])).toEqual([
        { area: 'Recepção', situacao: 'aberto', linhas: 2, pendentes: 0 },
      ]);
    });
  });
});

describe('transicaoFechamentoEpi', () => {
  it('fechar: de aberto para fechado', () => {
    expect(transicaoFechamentoEpi('aberto', { tipo: 'fechar' })).toEqual({ ok: true, situacao: 'fechado' });
  });

  it.each(['fechado', 'assinado'] as const)('fechar com a área %s é recusado', (situacao) => {
    expect(transicaoFechamentoEpi(situacao, { tipo: 'fechar' })).toEqual({
      ok: false,
      erro: 'A área já está fechada.',
    });
  });

  it.each(['fechado', 'assinado'] as const)('reabrir: de %s para aberto, com motivo', (situacao) => {
    expect(transicaoFechamentoEpi(situacao, { tipo: 'reabrir', motivo: 'Faltou a luva da Bia' })).toEqual({
      ok: true,
      situacao: 'aberto',
    });
  });

  it.each(['', '   '])('reabrir sem motivo é recusado (motivo %j)', (motivo) => {
    expect(transicaoFechamentoEpi('fechado', { tipo: 'reabrir', motivo })).toEqual({
      ok: false,
      erro: 'Informe o motivo da reabertura.',
    });
  });

  it('reabrir uma área aberta é recusado', () => {
    expect(transicaoFechamentoEpi('aberto', { tipo: 'reabrir', motivo: 'Correção' })).toEqual({
      ok: false,
      erro: 'A área já está aberta.',
    });
  });
});

describe('linhasDoRelatorioEpi', () => {
  const doRelatorio = (solicitacoes: SolicitacaoParaEpi[], fechamento?: FechamentoEpi) =>
    linhasDoRelatorioEpi(
      { solicitacoes, produtos, movimentacoes: baixas(solicitacoes) },
      { area: 'Recepção', mes: '2026-10' },
      fechamento,
    );

  it('sem fechamento, calcula na hora', () => {
    expect(doRelatorio([sm()]).map((l) => l.solicitacaoId)).toEqual(['sm-1']);
  });

  it.each(['fechado', 'assinado'] as const)(
    'área %s sai das linhas congeladas, mesmo que as solicitações tenham mudado',
    (situacao) => {
      const fechamento: FechamentoEpi = { area: 'Recepção', situacao, linhas: [congelada] };
      expect(doRelatorio([sm(), sm({ id: 'sm-2' })], fechamento)).toEqual([congelada]);
    },
  );

  it('área reaberta volta a calcular na hora', () => {
    expect(
      doRelatorio([sm()], { area: 'Recepção', situacao: 'aberto', linhas: [congelada] }).map((l) => l.solicitacaoId),
    ).toEqual(['sm-1']);
  });
});

describe('historicoFechamentoEpi', () => {
  const reabertura = {
    motivo: 'Faltou a luva da Bia',
    fechadoPor: 'Qualidade 1',
    fechadoEm: '2026-11-03T10:00:00Z',
    reabertoPor: 'Qualidade 2',
    reabertoEm: '2026-11-04T09:00:00Z',
  };

  it('nunca fechada: sem histórico', () => {
    expect(historicoFechamentoEpi(undefined, [])).toEqual([]);
  });

  it('fechada, reaberta e fechada de novo: cada fechamento e a reabertura com o motivo, em ordem', () => {
    expect(
      historicoFechamentoEpi({ situacao: 'fechado', fechadoPor: 'Qualidade 2', fechadoEm: '2026-11-05T08:00:00Z' }, [
        reabertura,
      ]),
    ).toEqual([
      { tipo: 'fechou', por: 'Qualidade 1', em: '2026-11-03T10:00:00Z' },
      { tipo: 'reabriu', por: 'Qualidade 2', em: '2026-11-04T09:00:00Z', motivo: 'Faltou a luva da Bia' },
      { tipo: 'fechou', por: 'Qualidade 2', em: '2026-11-05T08:00:00Z' },
    ]);
  });

  it('reaberta e ainda aberta: o fechamento desfeito não aparece duas vezes', () => {
    expect(
      historicoFechamentoEpi({ situacao: 'aberto', fechadoPor: 'Qualidade 1', fechadoEm: '2026-11-03T10:00:00Z' }, [
        reabertura,
      ]),
    ).toEqual([
      { tipo: 'fechou', por: 'Qualidade 1', em: '2026-11-03T10:00:00Z' },
      { tipo: 'reabriu', por: 'Qualidade 2', em: '2026-11-04T09:00:00Z', motivo: 'Faltou a luva da Bia' },
    ]);
  });
});
