import { describe, expect, it } from 'vitest';
import { glosasSugeridas } from './glosasAplis.js';
import type { DiferencaAplis, EntradaGlosasSugeridas, GlosaSistema } from './glosasAplis.js';

function diferenca(overrides: Partial<DiferencaAplis> = {}): DiferencaAplis {
  return {
    idLote: 6228,
    motivoCodigo: 2902,
    motivoDescricao: 'GLOSA MANTIDA',
    desMotivoGlosa: '2902',
    codEventoFatur: 6,
    emRecurso: false,
    valor: 100,
    procedimentos: 1,
    demonstrativoValor: null,
    ...overrides,
  };
}

function glosaSistema(overrides: Partial<GlosaSistema> = {}): GlosaSistema {
  return {
    id: 'glosa-1',
    origem: 'aplis',
    idLote: 6228,
    codigo: '2902',
    motivo: 'GLOSA MANTIDA',
    status: 'aberta',
    valor: 100,
    ...overrides,
  };
}

function entrada(overrides: Partial<EntradaGlosasSugeridas> = {}): EntradaGlosasSugeridas {
  return {
    tipo: null,
    saldo: 10_000,
    glosasSistema: [],
    diferencas: [diferenca()],
    ...overrides,
  };
}

describe('glosasSugeridas', () => {
  it('uma glosa por lote + código + status, com o valor somado e o número de procedimentos', () => {
    const resultado = glosasSugeridas(entrada({
      diferencas: [
        diferenca({ valor: 0.82, procedimentos: 3 }),
        diferenca({ valor: 0.1, procedimentos: 2, codEventoFatur: 6 }),
        diferenca({ idLote: 6229, valor: 50, procedimentos: 1 }),
        diferenca({ motivoCodigo: 1801, motivoDescricao: 'PROCEDIMENTO INVÁLIDO', valor: 20 }),
      ],
    }));
    expect(resultado.puladoGlosa).toBeNull();
    expect(resultado.glosas).toEqual([
      { idLote: 6228, codigo: '1801', motivo: 'PROCEDIMENTO INVÁLIDO', status: 'aberta', valor: 20, procedimentos: 1, demonstrativo: null },
      { idLote: 6228, codigo: '2902', motivo: 'GLOSA MANTIDA', status: 'aberta', valor: 0.92, procedimentos: 5, demonstrativo: null },
      { idLote: 6229, codigo: '2902', motivo: 'GLOSA MANTIDA', status: 'aberta', valor: 50, procedimentos: 1, demonstrativo: null },
    ]);
  });

  describe('status pela situação da requisição no apLIS', () => {
    const statusDe = (d: Partial<DiferencaAplis>) =>
      glosasSugeridas(entrada({ diferencas: [diferenca(d)] })).glosas.map((g) => g.status);

    it('6 (glosado ainda sem recurso) → aberta', () => {
      expect(statusDe({ codEventoFatur: 6 })).toEqual(['aberta']);
    });

    it('situação sem regra (ou nula) → aberta', () => {
      expect(statusDe({ codEventoFatur: 5 })).toEqual(['aberta']);
      expect(statusDe({ codEventoFatur: null })).toEqual(['aberta']);
    });

    it.each([7, 16])('%i (recurso de glosa) → em recurso', (codEventoFatur) => {
      expect(statusDe({ codEventoFatur })).toEqual(['em_recurso']);
    });

    it.each([18, 27, 23, 8, 15])('%i (glosa decidida) → definitiva', (codEventoFatur) => {
      expect(statusDe({ codEventoFatur })).toEqual(['definitiva']);
    });

    it('procedimento em lote de recurso → em recurso, mesmo em 6 ou em situação definitiva', () => {
      expect(statusDe({ codEventoFatur: 6, emRecurso: true })).toEqual(['em_recurso']);
      expect(statusDe({ codEventoFatur: 18, emRecurso: true })).toEqual(['em_recurso']);
    });

    it('o mesmo lote e código com situações diferentes vira uma glosa por status', () => {
      const resultado = glosasSugeridas(entrada({
        diferencas: [diferenca({ codEventoFatur: 6, valor: 10 }), diferenca({ codEventoFatur: 18, valor: 30 })],
      }));
      expect(resultado.glosas.map((g) => [g.status, g.valor])).toEqual([['aberta', 10], ['definitiva', 30]]);
    });
  });

  describe('código e motivo', () => {
    it('catálogo vazio e código em texto livre → esse código, com o motivo "Código N (do apLIS)"', () => {
      const resultado = glosasSugeridas(entrada({
        diferencas: [diferenca({ motivoCodigo: null, motivoDescricao: null, desMotivoGlosa: '3292' })],
      }));
      expect(resultado.glosas).toEqual([expect.objectContaining({ codigo: '3292', motivo: 'Código 3292 (do apLIS)' })]);
    });

    it('catálogo vazio e motivo em texto livre → sem código, com o texto como motivo', () => {
      const resultado = glosasSugeridas(entrada({
        diferencas: [diferenca({ motivoCodigo: null, motivoDescricao: null, desMotivoGlosa: 'Guia vencida' })],
      }));
      expect(resultado.glosas).toEqual([expect.objectContaining({ codigo: null, motivo: 'Guia vencida' })]);
    });

    it('código do catálogo sem descrição → "Código N (do apLIS)"', () => {
      const resultado = glosasSugeridas(entrada({ diferencas: [diferenca({ motivoDescricao: null })] }));
      expect(resultado.glosas).toEqual([expect.objectContaining({ codigo: '2902', motivo: 'Código 2902 (do apLIS)' })]);
    });
  });

  it('glosa total sem data de recebimento entra (a diferença vem pronta da réplica)', () => {
    const resultado = glosasSugeridas(entrada({ diferencas: [diferenca({ codEventoFatur: 27, valor: 507.15 })] }));
    expect(resultado.glosas).toEqual([expect.objectContaining({ status: 'definitiva', valor: 507.15 })]);
  });

  it('grupo com diferença abaixo de R$ 0,01 fica fora', () => {
    const resultado = glosasSugeridas(entrada({
      diferencas: [diferenca({ valor: 0.004 }), diferenca({ idLote: 6229, valor: 10 })],
    }));
    expect(resultado.glosas.map((g) => g.idLote)).toEqual([6229]);
  });

  describe('pulados', () => {
    it('só diferença sem motivo no apLIS → sem-motivo', () => {
      const resultado = glosasSugeridas(entrada({
        diferencas: [diferenca({ motivoCodigo: null, motivoDescricao: null, desMotivoGlosa: null })],
      }));
      expect(resultado).toEqual({ glosas: [], substituir: [], puladoGlosa: 'sem-motivo' });
    });

    it('diferença sem motivo junto de uma com motivo: lança a com motivo', () => {
      const resultado = glosasSugeridas(entrada({
        diferencas: [
          diferenca({ motivoCodigo: null, motivoDescricao: null, desMotivoGlosa: null, valor: 40 }),
          diferenca({ valor: 10 }),
        ],
      }));
      expect(resultado.puladoGlosa).toBeNull();
      expect(resultado.glosas.map((g) => g.valor)).toEqual([10]);
    });

    it('sem diferença no apLIS → nada, sem pulado', () => {
      expect(glosasSugeridas(entrada({ diferencas: [] }))).toEqual({ glosas: [], substituir: [], puladoGlosa: null });
      expect(glosasSugeridas(entrada({
        diferencas: [], tipo: 'sistema-maior', glosasSistema: [glosaSistema({ origem: null })],
      })))
        .toEqual({ glosas: [], substituir: [], puladoGlosa: null });
    });

    it.each(['sistema-maior', 'lote-ausente'] as const)('título %s → tipo', (tipo) => {
      expect(glosasSugeridas(entrada({ tipo }))).toEqual({ glosas: [], substituir: [], puladoGlosa: 'tipo' });
    });

    it.each(['so-no-aplis', 'aplis-maior'] as const)('título %s (com baixa) recebe glosa', (tipo) => {
      expect(glosasSugeridas(entrada({ tipo })).glosas).toHaveLength(1);
    });

    it('tipo vem antes de sem-motivo: o motivo mais forte aparece', () => {
      const semMotivo = [diferenca({ motivoCodigo: null, motivoDescricao: null, desMotivoGlosa: null })];
      expect(glosasSugeridas(entrada({ tipo: 'sistema-maior', diferencas: semMotivo })).puladoGlosa).toBe('tipo');
    });

    it('glosa digitada à mão e diferença sem motivo no apLIS → glosa-manual', () => {
      expect(glosasSugeridas(entrada({
        glosasSistema: [glosaSistema({ origem: null, idLote: null, codigo: null })],
        diferencas: [diferenca(), diferenca({ motivoCodigo: null, motivoDescricao: null, desMotivoGlosa: null })],
      }))).toEqual({ glosas: [], substituir: [], puladoGlosa: 'glosa-manual' });
    });

    it('glosa já lançada do apLIS não conta como manual', () => {
      const resultado = glosasSugeridas(entrada({
        glosasSistema: [glosaSistema({ idLote: 6229, valor: 30 })],
      }));
      expect(resultado.puladoGlosa).toBeNull();
      expect(resultado.glosas).toHaveLength(1);
    });

    it('glosa que passa do saldo por mais de R$ 1,00 → passa-do-saldo', () => {
      expect(glosasSugeridas(entrada({ saldo: 98.99, diferencas: [diferenca({ valor: 100 })] })))
        .toEqual({ glosas: [], substituir: [], puladoGlosa: 'passa-do-saldo' });
    });

    it('glosa que passa do saldo até R$ 1,00 (arredondamento) entra', () => {
      expect(glosasSugeridas(entrada({ saldo: 99, diferencas: [diferenca({ valor: 100 })] })).glosas)
        .toHaveLength(1);
    });

    it('o saldo vale para a soma das glosas do título, não para cada uma', () => {
      const resultado = glosasSugeridas(entrada({
        saldo: 150,
        diferencas: [diferenca({ valor: 100 }), diferenca({ idLote: 6229, valor: 100 })],
      }));
      expect(resultado).toEqual({ glosas: [], substituir: [], puladoGlosa: 'passa-do-saldo' });
    });
  });

  describe('glosas do apLIS já lançadas', () => {
    it('lançada inteira: não sugere de novo, nem como pulado', () => {
      expect(glosasSugeridas(entrada({ glosasSistema: [glosaSistema({ valor: 100 })] })))
        .toEqual({ glosas: [], substituir: [], puladoGlosa: null });
    });

    it('o apLIS aumentou a glosa do lote: sugere só a diferença', () => {
      const resultado = glosasSugeridas(entrada({
        diferencas: [diferenca({ valor: 150, procedimentos: 3 })],
        glosasSistema: [glosaSistema({ valor: 100 })],
      }));
      expect(resultado.glosas).toEqual([expect.objectContaining({ idLote: 6228, codigo: '2902', valor: 50 })]);
    });

    it('desconta por título + lote + código: outro lote ou outro código não desconta', () => {
      const resultado = glosasSugeridas(entrada({
        diferencas: [diferenca({ valor: 100 }), diferenca({ idLote: 6229, valor: 40 })],
        glosasSistema: [glosaSistema({ idLote: 6229, codigo: '1801', valor: 40 })],
      }));
      expect(resultado.glosas.map((g) => [g.idLote, g.valor])).toEqual([[6228, 100], [6229, 40]]);
    });

    it('a lançada desconta mesmo que o status no apLIS tenha mudado depois', () => {
      // Lançada aberta; a requisição passou a 18 (definitiva) — atualizar o status fica fora do escopo.
      const resultado = glosasSugeridas(entrada({
        diferencas: [diferenca({ codEventoFatur: 18, valor: 100 })],
        glosasSistema: [glosaSistema({ status: 'aberta', valor: 100 })],
      }));
      expect(resultado).toEqual({ glosas: [], substituir: [], puladoGlosa: null });
    });

    it('com mais de um status no lote + código, desconta primeiro do mesmo status', () => {
      const resultado = glosasSugeridas(entrada({
        diferencas: [diferenca({ codEventoFatur: 6, valor: 30 }), diferenca({ codEventoFatur: 18, valor: 70 })],
        glosasSistema: [glosaSistema({ status: 'definitiva', valor: 70 })],
      }));
      expect(resultado.glosas.map((g) => [g.status, g.valor])).toEqual([['aberta', 30]]);
    });

    it('a revertida não desconta', () => {
      const resultado = glosasSugeridas(entrada({ glosasSistema: [glosaSistema({ status: 'revertida', valor: 100 })] }));
      expect(resultado.glosas).toEqual([expect.objectContaining({ valor: 100 })]);
    });

    it('sem código: desconta pelo motivo em texto livre', () => {
      const texto = { motivoCodigo: null, motivoDescricao: null, desMotivoGlosa: 'Guia vencida' };
      const resultado = glosasSugeridas(entrada({
        diferencas: [diferenca({ ...texto, valor: 100 })],
        glosasSistema: [glosaSistema({ codigo: null, motivo: 'Guia vencida', valor: 60 })],
      }));
      expect(resultado.glosas).toEqual([expect.objectContaining({ codigo: null, valor: 40 })]);
    });
  });

  describe('conferência com o demonstrativo importado no apLIS', () => {
    const demonstrativoDe = (diferencas: DiferencaAplis[], glosasSistema: GlosaSistema[] = []) =>
      glosasSugeridas(entrada({ diferencas, glosasSistema })).glosas.map((g) => g.demonstrativo);

    it('glosa do grupo igual à do demonstrativo → confere', () => {
      expect(demonstrativoDe([diferenca({ valor: 254.44, procedimentos: 2, demonstrativoValor: 254.44 })]))
        .toEqual(['confere']);
    });

    it('confere com diferença de até R$ 0,01 (arredondamento)', () => {
      expect(demonstrativoDe([diferenca({ valor: 100, demonstrativoValor: 100.01 })])).toEqual(['confere']);
    });

    it('glosa do grupo diferente da do demonstrativo → difere', () => {
      expect(demonstrativoDe([diferenca({ valor: 100, demonstrativoValor: 100.02 })])).toEqual(['difere']);
      expect(demonstrativoDe([diferenca({ valor: 100, demonstrativoValor: 0 })])).toEqual(['difere']);
    });

    it('sem demonstrativo para nenhum procedimento do grupo → nada', () => {
      expect(demonstrativoDe([diferenca({ valor: 507.15, demonstrativoValor: null })])).toEqual([null]);
    });

    it('compara o grupo inteiro: parte sem demonstrativo conta como diferença', () => {
      expect(demonstrativoDe([
        diferenca({ valor: 60, demonstrativoValor: 60 }),
        diferenca({ valor: 40, codEventoFatur: 5, demonstrativoValor: null }),
      ])).toEqual(['difere']);
      expect(demonstrativoDe([
        diferenca({ valor: 60, demonstrativoValor: 60 }),
        diferenca({ valor: 40, codEventoFatur: 5, demonstrativoValor: 40 }),
      ])).toEqual(['confere']);
    });

    it('cada grupo (lote + código + status) é conferido à parte', () => {
      expect(demonstrativoDe([
        diferenca({ valor: 73.44, codEventoFatur: 18, demonstrativoValor: 73.44 }),
        diferenca({ valor: 254.44, codEventoFatur: 6, demonstrativoValor: 200 }),
      ])).toEqual(['difere', 'confere']); // aberta, depois definitiva
    });

    it('confere o glosado do apLIS, não o que sobra depois de descontar o já lançado', () => {
      expect(demonstrativoDe(
        [diferenca({ valor: 150, demonstrativoValor: 150 })],
        [glosaSistema({ valor: 100 })],
      )).toEqual(['confere']);
    });
  });
  describe('glosa total sem motivo (situação 27)', () => {
    const semMotivo = { motivoCodigo: null, motivoDescricao: null, desMotivoGlosa: null };

    it('vira "Glosa total (apLIS)", sem código e aberta', () => {
      const resultado = glosasSugeridas(entrada({ diferencas: [diferenca({ ...semMotivo, codEventoFatur: 27, valor: 662.04, procedimentos: 8 })] }));
      expect(resultado).toEqual({
        glosas: [{
          idLote: 6228, codigo: null, motivo: 'Glosa total (apLIS)', status: 'aberta', valor: 662.04, procedimentos: 8, demonstrativo: null,
        }],
        substituir: [],
        puladoGlosa: null,
      });
    });

    it('em lote de recurso continua em recurso', () => {
      const resultado = glosasSugeridas(entrada({ diferencas: [diferenca({ ...semMotivo, codEventoFatur: 27, emRecurso: true })] }));
      expect(resultado.glosas.map((g) => g.status)).toEqual(['em_recurso']);
    });

    it('fora da situação 27 continua sem motivo', () => {
      expect(glosasSugeridas(entrada({ diferencas: [diferenca({ ...semMotivo, codEventoFatur: 6 })] })).puladoGlosa)
        .toBe('sem-motivo');
    });
  });

  describe('substituição das glosas digitadas à mão', () => {
    const manual = (overrides: Partial<GlosaSistema> = {}) =>
      glosaSistema({ id: 'manual-1', origem: null, idLote: null, codigo: null, motivo: 'Glosa digitada', ...overrides });

    it('lote 5774: as do apLIS entram e as duas digitadas saem, com o saldo contando com elas', () => {
      // Título de 750,16: 88,12 já lançados do apLIS + 750,16 e 662,04 à mão → saldo -750,16.
      const resultado = glosasSugeridas(entrada({
        saldo: -750.16,
        glosasSistema: [
          glosaSistema({ idLote: 5774, codigo: '1319', motivo: 'M1319', status: 'definitiva', valor: 44.06 }),
          glosaSistema({ idLote: 5774, codigo: '1831', motivo: 'M1831', status: 'definitiva', valor: 44.06 }),
          manual({ id: 'manual-1', valor: 750.16 }),
          manual({ id: 'manual-2', valor: 662.04 }),
        ],
        diferencas: [
          diferenca({ idLote: 5774, motivoCodigo: 1319, motivoDescricao: 'M1319', codEventoFatur: 27, valor: 44.06 }),
          diferenca({ idLote: 5774, motivoCodigo: 1831, motivoDescricao: 'M1831', codEventoFatur: 27, valor: 44.06 }),
          diferenca({
            idLote: 5774, motivoCodigo: null, motivoDescricao: null, desMotivoGlosa: null, codEventoFatur: 27,
            valor: 662.04, procedimentos: 8,
          }),
        ],
      }));
      expect(resultado.puladoGlosa).toBeNull();
      expect(resultado.glosas.map((g) => [g.motivo, g.status, g.valor])).toEqual([['Glosa total (apLIS)', 'aberta', 662.04]]);
      expect(resultado.substituir).toEqual([
        { id: 'manual-1', motivo: 'Glosa digitada', status: 'aberta', valor: 750.16 },
        { id: 'manual-2', motivo: 'Glosa digitada', status: 'aberta', valor: 662.04 },
      ]);
    });

    it('o já lançado do apLIS cobre tudo: só tira as digitadas', () => {
      const resultado = glosasSugeridas(entrada({
        saldo: -100,
        glosasSistema: [glosaSistema({ valor: 100 }), manual({ valor: 100 })],
      }));
      expect(resultado).toEqual({
        glosas: [],
        substituir: [{ id: 'manual-1', motivo: 'Glosa digitada', status: 'aberta', valor: 100 }],
        puladoGlosa: null,
      });
    });

    it('a digitada já soma o que o apLIS glosou: fica como está', () => {
      expect(glosasSugeridas(entrada({ saldo: 0, glosasSistema: [manual({ valor: 100 })] })))
        .toEqual({ glosas: [], substituir: [], puladoGlosa: null });
    });

    it('a revertida não é substituída nem conta', () => {
      const resultado = glosasSugeridas(entrada({ glosasSistema: [manual({ status: 'revertida' })] }));
      expect(resultado.substituir).toEqual([]);
      expect(resultado.glosas.map((g) => g.valor)).toEqual([100]);
    });

    it('sem glosa no apLIS a digitada fica', () => {
      expect(glosasSugeridas(entrada({ diferencas: [], glosasSistema: [manual()] })))
        .toEqual({ glosas: [], substituir: [], puladoGlosa: null });
    });

    it('passa do saldo mesmo contando com a digitada → passa-do-saldo, sem substituir', () => {
      expect(glosasSugeridas(entrada({ saldo: 0, glosasSistema: [manual({ valor: 50 })], diferencas: [diferenca({ valor: 200 })] })))
        .toEqual({ glosas: [], substituir: [], puladoGlosa: 'passa-do-saldo' });
    });
  });
});
