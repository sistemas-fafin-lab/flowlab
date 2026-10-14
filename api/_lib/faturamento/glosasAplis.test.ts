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
    ...overrides,
  };
}

function glosaSistema(overrides: Partial<GlosaSistema> = {}): GlosaSistema {
  return {
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
    temNota: true,
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
      { idLote: 6228, codigo: '1801', motivo: 'PROCEDIMENTO INVÁLIDO', status: 'aberta', valor: 20, procedimentos: 1 },
      { idLote: 6228, codigo: '2902', motivo: 'GLOSA MANTIDA', status: 'aberta', valor: 0.92, procedimentos: 5 },
      { idLote: 6229, codigo: '2902', motivo: 'GLOSA MANTIDA', status: 'aberta', valor: 50, procedimentos: 1 },
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
      expect(resultado).toEqual({ glosas: [], puladoGlosa: 'sem-motivo' });
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
      expect(glosasSugeridas(entrada({ diferencas: [] }))).toEqual({ glosas: [], puladoGlosa: null });
      expect(glosasSugeridas(entrada({
        diferencas: [], tipo: 'sistema-maior', temNota: false, glosasSistema: [glosaSistema({ origem: null })],
      })))
        .toEqual({ glosas: [], puladoGlosa: null });
    });

    it.each(['sistema-maior', 'lote-ausente'] as const)('título %s → tipo', (tipo) => {
      expect(glosasSugeridas(entrada({ tipo }))).toEqual({ glosas: [], puladoGlosa: 'tipo' });
    });

    it.each(['so-no-aplis', 'aplis-maior'] as const)('título %s (com baixa) recebe glosa', (tipo) => {
      expect(glosasSugeridas(entrada({ tipo })).glosas).toHaveLength(1);
    });

    it('tipo e sem-nota vêm antes de sem-motivo: o motivo mais forte aparece', () => {
      const semMotivo = [diferenca({ motivoCodigo: null, motivoDescricao: null, desMotivoGlosa: null })];
      expect(glosasSugeridas(entrada({ tipo: 'sistema-maior', diferencas: semMotivo })).puladoGlosa).toBe('tipo');
      expect(glosasSugeridas(entrada({ temNota: false, diferencas: semMotivo })).puladoGlosa).toBe('sem-nota');
    });

    it('título sem número da nota → sem-nota', () => {
      expect(glosasSugeridas(entrada({ temNota: false }))).toEqual({ glosas: [], puladoGlosa: 'sem-nota' });
    });

    it('título com glosa digitada à mão (sem origem) → glosa-manual', () => {
      expect(glosasSugeridas(entrada({ glosasSistema: [glosaSistema({ origem: null, idLote: null, codigo: null })] })))
        .toEqual({ glosas: [], puladoGlosa: 'glosa-manual' });
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
        .toEqual({ glosas: [], puladoGlosa: 'passa-do-saldo' });
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
      expect(resultado).toEqual({ glosas: [], puladoGlosa: 'passa-do-saldo' });
    });
  });

  describe('glosas do apLIS já lançadas', () => {
    it('lançada inteira: não sugere de novo, nem como pulado', () => {
      expect(glosasSugeridas(entrada({ glosasSistema: [glosaSistema({ valor: 100 })] })))
        .toEqual({ glosas: [], puladoGlosa: null });
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
      expect(resultado).toEqual({ glosas: [], puladoGlosa: null });
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
});
