import { describe, expect, it } from 'vitest';
import { pontuarMes, validarLancamento } from './pontuacaoSetor.js';
import type { EntradaPontuacao, FatosPontuacao } from './pontuacaoSetor.js';

function entrada(fatos: FatosPontuacao = {}, overrides: Partial<EntradaPontuacao> = {}): EntradaPontuacao {
  return { mes: '2026-09', fatos, lancamentos: [], membros: [], ...overrides };
}

function criterio(resumo: ReturnType<typeof pontuarMes>, frente: string, chave: string) {
  const achado = resumo.frentes.find((f) => f.frente === frente)?.criterios.find((c) => c.chave === chave);
  if (!achado) throw new Error(`critério ${frente}/${chave} não apareceu`);
  return achado;
}

describe('pontuarMes — meta mensal e meta superada', () => {
  it('abaixo da meta: 0 nos dois critérios', () => {
    const resumo = pontuarMes(entrada({ meta: { valorMeta: 1_000_000, faturado: 999_999.99 } }));

    expect(criterio(resumo, 'faturamento', 'metaMensal').pontosAtingidos).toBe(0);
    expect(criterio(resumo, 'faturamento', 'metaSuperada').pontosAtingidos).toBe(0);
  });

  it('igual à meta: 5 em "Meta mensal"', () => {
    const resumo = pontuarMes(entrada({ meta: { valorMeta: 1_000_000, faturado: 1_000_000 } }));

    expect(criterio(resumo, 'faturamento', 'metaMensal').pontosAtingidos).toBe(5);
    expect(criterio(resumo, 'faturamento', 'metaSuperada').pontosAtingidos).toBe(0);
  });

  it('entre 100% e 115%: 5 em "Meta mensal"', () => {
    const resumo = pontuarMes(entrada({ meta: { valorMeta: 1_000_000, faturado: 1_149_999.99 } }));

    expect(criterio(resumo, 'faturamento', 'metaMensal').pontosAtingidos).toBe(5);
    expect(criterio(resumo, 'faturamento', 'metaSuperada').pontosAtingidos).toBe(0);
  });

  it('exatamente 115%: 10 em "Meta superada" e 0 em "Meta mensal"', () => {
    const resumo = pontuarMes(entrada({ meta: { valorMeta: 1_000_000, faturado: 1_150_000 } }));

    expect(criterio(resumo, 'faturamento', 'metaMensal').pontosAtingidos).toBe(0);
    expect(criterio(resumo, 'faturamento', 'metaSuperada').pontosAtingidos).toBe(10);
  });

  it('115% exato quando 1,15 × meta não é exato no ponto flutuante (meta 7, faturado 8,05)', () => {
    const resumo = pontuarMes(entrada({ meta: { valorMeta: 7, faturado: 8.05 } }));

    expect(criterio(resumo, 'faturamento', 'metaSuperada').pontosAtingidos).toBe(10);
    expect(criterio(resumo, 'faturamento', 'metaMensal').pontosAtingidos).toBe(0);
  });

  it('sem meta cadastrada: "meta não cadastrada" e 0 nos dois', () => {
    const resumo = pontuarMes(entrada({ meta: { valorMeta: null, faturado: 1_114_775.43 } }));

    for (const chave of ['metaMensal', 'metaSuperada']) {
      expect(criterio(resumo, 'faturamento', chave)).toMatchObject({
        pontosAtingidos: 0,
        observacao: 'Meta não cadastrada',
        detalhe: { meta: null, faturado: 1_114_775.43, percentual: null },
      });
    }
  });

  it('meta zerada (o banco aceita 0) vale como não cadastrada: não dá 10 pontos de graça', () => {
    const resumo = pontuarMes(entrada({ meta: { valorMeta: 0, faturado: 500 } }));

    for (const chave of ['metaMensal', 'metaSuperada']) {
      expect(criterio(resumo, 'faturamento', chave)).toMatchObject({ pontosAtingidos: 0, observacao: 'Meta não cadastrada' });
    }
  });

  it('o detalhe mostra meta, faturado e % atingido com uma casa', () => {
    const resumo = pontuarMes(entrada({ meta: { valorMeta: 1_000_000, faturado: 1_114_775.43 } }));

    expect(criterio(resumo, 'faturamento', 'metaMensal').detalhe).toEqual({
      tipo: 'meta',
      meta: 1_000_000,
      faturado: 1_114_775.43,
      percentual: 111.5,
    });
  });

  it('os dois critérios trazem tipo automático e os pontos base da regra', () => {
    const resumo = pontuarMes(entrada({ meta: { valorMeta: 1, faturado: 0 } }));

    expect(criterio(resumo, 'faturamento', 'metaMensal')).toMatchObject({ tipo: 'automatico', pontosBase: 5, rotulo: 'Meta mensal' });
    expect(criterio(resumo, 'faturamento', 'metaSuperada')).toMatchObject({ tipo: 'automatico', pontosBase: 10, rotulo: 'Meta superada' });
  });
});

describe('pontuarMes — Frentes', () => {
  it('as duas Frentes aparecem, na ordem da tabela; critério automático sem fato fica de fora, o manual não', () => {
    const resumo = pontuarMes(entrada({ meta: { valorMeta: 1_000_000, faturado: 1_000_000 } }));

    expect(resumo.frentes.map((f) => [f.rotulo, f.criterios.map((c) => c.chave)])).toEqual([
      ['Faturamento', ['dominioPops', 'melhoriaSetor', 'metaMensal', 'metaSuperada']],
      ['Recurso de Glosa', ['intrasetorial', 'dominioPops', 'melhoriaSetor', 'refaturamento', 'reversaoGlosa', 'destravarRecursos']],
    ]);
    expect(resumo.frentes[1].total).toBe(0);
  });

  it('total da Frente: soma dos pontos atingidos, com uma casa', () => {
    const resumo = pontuarMes(entrada(
      { meta: { valorMeta: 1_000_000, faturado: 1_200_000 } },
      {
        lancamentos: [
          { frente: 'faturamento', chave: 'dominioPops', pontos: 0.1, observacao: 'leu os POPs' },
          { frente: 'faturamento', chave: 'melhoriaSetor', pontos: 0.2, observacao: 'curso' },
        ],
      },
    ));

    expect(resumo.frentes[0].total).toBe(10.3);
  });
});

const MEMBROS: EntradaPontuacao['membros'] = [
  { frente: 'faturamento', idUsuarioAplis: 235, nome: 'Renata Queiroz Bento' },
  { frente: 'faturamento', idUsuarioAplis: 202, nome: 'Rívia Freire Araujo Barretos Borba' },
  { frente: 'faturamento', idUsuarioAplis: 256, nome: 'Cleber Kendel de Andrade' },
  { frente: 'recursoGlosa', idUsuarioAplis: 224, nome: 'Raquel dos Santos Avelino' },
  { frente: 'recursoGlosa', idUsuarioAplis: 173, nome: 'Maria Eduarda Fonseca Bomfim' },
];

describe('pontuarMes — tarefas pendentes', () => {
  it('todos os membros zerados: 1 ponto em cada Frente', () => {
    const resumo = pontuarMes(entrada(
      { tarefas: { porUsuario: { 235: 0, 202: 0, 256: 0, 224: 0, 173: 0 }, doSetor: 0 } },
      { membros: MEMBROS },
    ));

    expect(criterio(resumo, 'faturamento', 'tarefasPendentes')).toMatchObject({ pontosAtingidos: 1, tipo: 'automatico', pontosBase: 1 });
    expect(criterio(resumo, 'recursoGlosa', 'tarefasPendentes').pontosAtingidos).toBe(1);
  });

  it('um membro com 1 pendência zera a Frente dele, não a outra', () => {
    const resumo = pontuarMes(entrada(
      { tarefas: { porUsuario: { 235: 0, 202: 1, 256: 0, 224: 0, 173: 0 }, doSetor: 0 } },
      { membros: MEMBROS },
    ));

    expect(criterio(resumo, 'faturamento', 'tarefasPendentes')).toMatchObject({
      pontosAtingidos: 0,
      observacao: '1 pendência: Rívia Freire Araujo Barretos Borba',
    });
    expect(criterio(resumo, 'recursoGlosa', 'tarefasPendentes')).toMatchObject({
      pontosAtingidos: 1,
      observacao: 'Nenhuma tarefa pendente',
    });
  });

  it('o detalhe lista as pendências por pessoa; a Raquel conta na Recurso de Glosa como qualquer membro', () => {
    const resumo = pontuarMes(entrada(
      { tarefas: { porUsuario: { 235: 116, 202: 9, 256: 0, 224: 149, 173: 0 }, doSetor: 0 } },
      { membros: MEMBROS },
    ));

    expect(criterio(resumo, 'faturamento', 'tarefasPendentes').detalhe).toEqual({
      tipo: 'tarefas',
      pessoas: [
        { idUsuarioAplis: 235, nome: 'Renata Queiroz Bento', pendencias: 116 },
        { idUsuarioAplis: 202, nome: 'Rívia Freire Araujo Barretos Borba', pendencias: 9 },
        { idUsuarioAplis: 256, nome: 'Cleber Kendel de Andrade', pendencias: 0 },
      ],
      setor: 0,
    });
    expect(criterio(resumo, 'recursoGlosa', 'tarefasPendentes')).toMatchObject({
      pontosAtingidos: 0,
      observacao: '149 pendências: Raquel dos Santos Avelino',
    });
  });

  it('membro sem nenhuma tarefa no apLIS conta como zerado', () => {
    const resumo = pontuarMes(entrada(
      { tarefas: { porUsuario: { 224: 0 }, doSetor: 0 } },
      { membros: MEMBROS },
    ));

    expect(criterio(resumo, 'recursoGlosa', 'tarefasPendentes')).toMatchObject({
      pontosAtingidos: 1,
      detalhe: { pessoas: [{ nome: 'Raquel dos Santos Avelino', pendencias: 0 }, { nome: 'Maria Eduarda Fonseca Bomfim', pendencias: 0 }] },
    });
  });

  it('tarefa aberta do setor GLOSA – FATURAMENTO zera as duas Frentes', () => {
    const resumo = pontuarMes(entrada(
      { tarefas: { porUsuario: {}, doSetor: 2 } },
      { membros: MEMBROS },
    ));

    for (const frente of ['faturamento', 'recursoGlosa'] as const) {
      expect(criterio(resumo, frente, 'tarefasPendentes')).toMatchObject({
        pontosAtingidos: 0,
        observacao: '2 pendências: SETOR',
        detalhe: { setor: 2 },
      });
    }
  });
});

describe('pontuarMes — guias sem lote', () => {
  const zerado = (id: number) => ({ idFontePagadora: id, nome: `Convênio ${id}`, pendentes: 0 });

  it('12 convênios fechados sem pendência dão exatamente 1,2', () => {
    const convenios = Array.from({ length: 12 }, (_, i) => zerado(i + 1));
    const resumo = pontuarMes(entrada({ guiasSemLote: { convenios } }));

    expect(criterio(resumo, 'faturamento', 'guiasSemLote')).toMatchObject({
      pontosAtingidos: 1.2,
      tipo: 'automatico',
      pontosBase: 0.1,
      porConvenio: true,
    });
    expect(resumo.frentes[0].total).toBe(1.2);
  });

  it('convênio com pendência vai para a lista "com pendência" e não pontua', () => {
    const resumo = pontuarMes(entrada({
      guiasSemLote: {
        convenios: [
          { idFontePagadora: 5, nome: 'Bradesco Saúde', pendentes: 0 },
          { idFontePagadora: 7, nome: 'Sul América', pendentes: 3 },
          { idFontePagadora: 9, nome: 'Fascal', pendentes: 0 },
        ],
      },
    }));

    expect(criterio(resumo, 'faturamento', 'guiasSemLote')).toMatchObject({
      pontosAtingidos: 0.2,
      observacao: '2 de 3 convênios fechados sem pendência',
      detalhe: {
        tipo: 'guiasSemLote',
        semPendencia: [
          { idFontePagadora: 5, nome: 'Bradesco Saúde' },
          { idFontePagadora: 9, nome: 'Fascal' },
        ],
        comPendencia: [{ idFontePagadora: 7, nome: 'Sul América', pendentes: 3 }],
      },
    });
  });

  it('mês anterior sem requisições: 0 ponto, sem convênio nas listas', () => {
    const resumo = pontuarMes(entrada({ guiasSemLote: { convenios: [] } }));

    expect(criterio(resumo, 'faturamento', 'guiasSemLote')).toMatchObject({
      pontosAtingidos: 0,
      observacao: 'Nenhuma requisição solicitada no mês anterior',
      detalhe: { tipo: 'guiasSemLote', semPendencia: [], comPendencia: [] },
    });
  });
});

describe('pontuarMes — zero glosa', () => {
  it('dá 0,5 por convênio recebido sem glosa: 6 convênios dão 3', () => {
    const convenios = Array.from({ length: 6 }, (_, i) => ({ idFontePagadora: i + 1, nome: `Convênio ${i + 1}`, recebidas: 10, glosadas: 0 }));
    const resumo = pontuarMes(entrada({ zeroGlosa: { convenios } }));

    expect(criterio(resumo, 'faturamento', 'zeroGlosa')).toMatchObject({
      pontosAtingidos: 3,
      tipo: 'automatico',
      pontosBase: 0.5,
      porConvenio: true,
      observacao: '6 de 6 convênios recebidos sem glosa',
    });
  });

  it('uma única requisição glosada tira o ponto do convênio', () => {
    const resumo = pontuarMes(entrada({
      zeroGlosa: {
        convenios: [
          { idFontePagadora: 5, nome: 'Bradesco Saúde', recebidas: 40, glosadas: 0 },
          { idFontePagadora: 7, nome: 'Sul América', recebidas: 120, glosadas: 1 },
        ],
      },
    }));

    expect(criterio(resumo, 'faturamento', 'zeroGlosa')).toMatchObject({
      pontosAtingidos: 0.5,
      observacao: '1 de 2 convênios recebidos sem glosa',
      detalhe: {
        tipo: 'zeroGlosa',
        semGlosa: [{ idFontePagadora: 5, nome: 'Bradesco Saúde', recebidas: 40 }],
        comGlosa: [{ idFontePagadora: 7, nome: 'Sul América', recebidas: 120, glosadas: 1 }],
      },
    });
  });

  it('convênio sem recebimento no mês não aparece em nenhuma das listas', () => {
    const resumo = pontuarMes(entrada({
      zeroGlosa: {
        convenios: [
          { idFontePagadora: 5, nome: 'Bradesco Saúde', recebidas: 3, glosadas: 0 },
          { idFontePagadora: 8, nome: 'Fusex', recebidas: 0, glosadas: 0 },
          { idFontePagadora: 9, nome: 'E-Vida', recebidas: 0, glosadas: 2 },
        ],
      },
    }));

    expect(criterio(resumo, 'faturamento', 'zeroGlosa')).toMatchObject({
      pontosAtingidos: 0.5,
      observacao: '1 de 1 convênio recebido sem glosa',
      detalhe: {
        tipo: 'zeroGlosa',
        semGlosa: [{ idFontePagadora: 5, nome: 'Bradesco Saúde', recebidas: 3 }],
        comGlosa: [],
      },
    });
  });

  it('mês sem recebimento dá 0', () => {
    const resumo = pontuarMes(entrada({ zeroGlosa: { convenios: [] } }));

    expect(criterio(resumo, 'faturamento', 'zeroGlosa')).toMatchObject({
      pontosAtingidos: 0,
      observacao: 'Nenhum convênio recebido no mês',
      detalhe: { tipo: 'zeroGlosa', semGlosa: [], comGlosa: [] },
    });
  });
});

describe('pontuarMes — lançamentos manuais', () => {
  it('critério manual sem lançamento aparece como "não lançado", com 0', () => {
    const resumo = pontuarMes(entrada());

    for (const [frente, chave] of [
      ['faturamento', 'dominioPops'],
      ['faturamento', 'melhoriaSetor'],
      ['recursoGlosa', 'intrasetorial'],
      ['recursoGlosa', 'dominioPops'],
      ['recursoGlosa', 'melhoriaSetor'],
      ['recursoGlosa', 'refaturamento'],
      ['recursoGlosa', 'reversaoGlosa'],
      ['recursoGlosa', 'destravarRecursos'],
    ]) {
      expect(criterio(resumo, frente, chave)).toMatchObject({ tipo: 'manual', pontosAtingidos: 0, observacao: 'Não lançado', lancamento: null });
    }
  });

  it('o ponto lançado entra no total da Frente, com a observação e quem lançou', () => {
    const resumo = pontuarMes(entrada({}, {
      lancamentos: [
        { frente: 'recursoGlosa', chave: 'refaturamento', pontos: 3, observacao: 'refaturou 1 guia', autoria: { por: 'Raquel dos Santos Avelino', em: '2026-10-05T14:30:00Z' } },
        { frente: 'recursoGlosa', chave: 'reversaoGlosa', pontos: 2, observacao: 'reverteu R$ 4.087,31' },
      ],
    }));

    expect(criterio(resumo, 'recursoGlosa', 'refaturamento')).toMatchObject({
      pontosBase: 5,
      pontosAtingidos: 3,
      observacao: 'refaturou 1 guia',
      lancamento: { por: 'Raquel dos Santos Avelino', em: '2026-10-05T14:30:00Z' },
    });
    expect(resumo.frentes[1].total).toBe(5);
    expect(resumo.frentes[0].total).toBe(0);
  });

  it('pontos com uma casa decimal: 0,1 × 3 lançamentos somam 0,3 exato', () => {
    const resumo = pontuarMes(entrada({}, {
      lancamentos: [
        { frente: 'recursoGlosa', chave: 'intrasetorial', pontos: 0.1, observacao: 'a' },
        { frente: 'recursoGlosa', chave: 'dominioPops', pontos: 0.1, observacao: 'b' },
        { frente: 'recursoGlosa', chave: 'melhoriaSetor', pontos: 0.1, observacao: 'c' },
      ],
    }));

    expect(resumo.frentes[1].total).toBe(0.3);
  });
});

describe('validarLancamento', () => {
  const valido = { frente: 'recursoGlosa', chave: 'refaturamento', pontos: 3, observacao: 'refaturou 1 guia' };

  it('lançamento válido volta pronto para gravar, com a observação aparada', () => {
    expect(validarLancamento({ ...valido, observacao: '  refaturou 1 guia ' })).toEqual({
      lancamento: { frente: 'recursoGlosa', chave: 'refaturamento', pontos: 3, observacao: 'refaturou 1 guia' },
    });
  });

  it('pontos ficam com uma casa decimal', () => {
    expect(validarLancamento({ ...valido, pontos: 2.34 })).toMatchObject({ lancamento: { pontos: 2.3 } });
  });

  it('sem observação é recusado', () => {
    for (const observacao of [undefined, '', '   ']) {
      expect(validarLancamento({ ...valido, observacao })).toEqual({ erro: 'A observação é obrigatória.' });
    }
  });

  it('chave de critério automático, ou de outra Frente, é recusada', () => {
    expect(validarLancamento({ ...valido, frente: 'faturamento', chave: 'metaMensal' })).toHaveProperty('erro');
    expect(validarLancamento({ ...valido, frente: 'faturamento', chave: 'refaturamento' })).toHaveProperty('erro');
    expect(validarLancamento({ ...valido, frente: 'outra' })).toHaveProperty('erro');
  });

  it('pontos negativos, ausentes ou não numéricos são recusados', () => {
    for (const pontos of [-1, undefined, '3', Number.NaN]) {
      expect(validarLancamento({ ...valido, pontos })).toHaveProperty('erro');
    }
  });
});
