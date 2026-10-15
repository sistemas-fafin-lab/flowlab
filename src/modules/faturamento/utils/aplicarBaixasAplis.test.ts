import { describe, expect, it, vi } from 'vitest';
import type { BaixaInput, GlosaSugeridaAplis, TituloPreviaBaixasAplis } from '../types';
import {
  aplicarTitulo,
  descricaoResultado,
  motivoPuladoGlosa,
  resumoAplicacao,
  selecaoPadrao,
  separarPrevia,
  titulosComBaixaRepetida,
  titulosComGlosaRepetida,
  totalALancar,
} from './aplicarBaixasAplis';
import type { ResultadoTitulo } from './aplicarBaixasAplis';

function titulo(parcial: Partial<TituloPreviaBaixasAplis> & { idNota: string }): TituloPreviaBaixasAplis {
  return {
    numeroNota: '123',
    operadora: 'Unimed',
    tipo: 'so-no-aplis',
    recebidoSistema: 0,
    recebidoAplis: 100,
    baixas: [{ data: '2026-09-22', valor: 100, observacoes: 'Baixa do apLIS' }],
    saldo: 0,
    glosas: [],
    puladoGlosa: null,
    ...parcial,
  };
}

function glosa(parcial: Partial<GlosaSugeridaAplis> = {}): GlosaSugeridaAplis {
  return { idLote: 6228, loteId: 'uuid-6228', codigo: '2902', motivo: 'GLOSA MANTIDA', status: 'aberta', valor: 867.86, procedimentos: 475, demonstrativo: null, ...parcial };
}

describe('separarPrevia', () => {
  it('título com baixas e com número vai para os aplicáveis', () => {
    const { aplicaveis, pulados } = separarPrevia([titulo({ idNota: 'a' })]);
    expect(aplicaveis.map((t) => t.idNota)).toEqual(['a']);
    expect(pulados).toEqual([]);
  });

  it('título sem número da nota com baixas vai para os aplicáveis', () => {
    const { aplicaveis, pulados } = separarPrevia([titulo({ idNota: 'a', numeroNota: null })]);
    expect(aplicaveis.map((t) => t.idNota)).toEqual(['a']);
    expect(pulados).toEqual([]);
  });

  it('título com número mas sem baixa sugerida é pulado — sem data de recebimento no apLIS', () => {
    const { aplicaveis, pulados } = separarPrevia([titulo({ idNota: 'a', baixas: [] })]);
    expect(aplicaveis).toEqual([]);
    expect(pulados[0].motivo).toBe('sem data de recebimento no apLIS');
  });

  it('título só com glosa a lançar (recebido batendo) vai para os aplicáveis, sem baixa marcável', () => {
    const titulos = [titulo({ idNota: 'a', tipo: null, baixas: [], glosas: [glosa()] })];
    expect(separarPrevia(titulos).aplicaveis.map((t) => t.idNota)).toEqual(['a']);
    expect(selecaoPadrao(titulos)).toEqual({ baixas: new Set(), glosas: new Set(['a']) });
  });

  it('título sem data de recebimento mas com glosa vai para os aplicáveis pela glosa', () => {
    const { aplicaveis, pulados } = separarPrevia([titulo({ idNota: 'a', baixas: [], glosas: [glosa()] })]);
    expect(aplicaveis.map((t) => t.idNota)).toEqual(['a']);
    expect(pulados).toEqual([]);
  });

  it('título sem baixa e com a glosa pulada vai para os pulados com o motivo da glosa', () => {
    const { aplicaveis, pulados } = separarPrevia([
      titulo({ idNota: 'a', tipo: null, baixas: [], puladoGlosa: 'glosa-manual' }),
    ]);
    expect(aplicaveis).toEqual([]);
    expect(pulados).toEqual([{
      titulo: expect.objectContaining({ idNota: 'a' }),
      motivo: null,
      motivoGlosa: 'título já tem glosa lançada',
    }]);
  });

  it('mantém a ordem da rota', () => {
    const { aplicaveis } = separarPrevia([titulo({ idNota: 'b' }), titulo({ idNota: 'a' })]);
    expect(aplicaveis.map((t) => t.idNota)).toEqual(['b', 'a']);
  });
});

describe('totalALancar', () => {
  const titulos = [
    titulo({
      idNota: 'a',
      baixas: [
        { data: '2026-09-01', valor: 0.1, observacoes: '' },
        { data: '2026-09-02', valor: 0.2, observacoes: '' },
      ],
      glosas: [glosa({ valor: 0.1 }), glosa({ valor: 0.2 })],
    }),
    titulo({ idNota: 'b', baixas: [{ data: '2026-09-03', valor: 50, observacoes: '' }], glosas: [glosa({ valor: 7 })] }),
    titulo({ idNota: 'c', baixas: [], glosas: [glosa({ valor: 1000 })] }),
  ];

  it('soma baixas e glosas separadas, só do que está marcado em cada checkbox, em centavos', () => {
    expect(totalALancar(titulos, { baixas: new Set(['a', 'b']), glosas: new Set(['a', 'c']) })).toEqual({
      titulos: 3,
      baixas: { qtd: 3, valor: 50.3 },
      glosas: { qtd: 3, valor: 1000.3 },
    });
  });

  it('título com só as glosas marcadas conta as glosas, não as baixas', () => {
    expect(totalALancar(titulos, { baixas: new Set(), glosas: new Set(['b']) })).toEqual({
      titulos: 1,
      baixas: { qtd: 0, valor: 0 },
      glosas: { qtd: 1, valor: 7 },
    });
  });

  it('nada marcado = zero', () => {
    expect(totalALancar(titulos, { baixas: new Set(), glosas: new Set() })).toEqual({
      titulos: 0,
      baixas: { qtd: 0, valor: 0 },
      glosas: { qtd: 0, valor: 0 },
    });
  });
});

describe('motivoPuladoGlosa', () => {
  it.each([
    ['sem-motivo', null, 'diferença sem motivo no apLIS'],
    ['glosa-manual', null, 'título já tem glosa lançada'],
    ['passa-do-saldo', null, 'glosa passa do saldo do título'],
    ['tipo', 'sistema-maior', 'recebido aqui maior que no apLIS'],
    ['tipo', 'lote-ausente', 'lote não encontrado no apLIS'],
  ] as const)('%s (%s) → %s', (puladoGlosa, tipo, texto) => {
    expect(motivoPuladoGlosa(titulo({ idNota: 'a', tipo, puladoGlosa }))).toBe(texto);
  });

  it('sem pulado → null', () => {
    expect(motivoPuladoGlosa(titulo({ idNota: 'a' }))).toBeNull();
  });
});

function resultado(parcial: Partial<ResultadoTitulo> = {}): ResultadoTitulo {
  return { estado: 'lancado', baixasLancadas: 0, glosasLancadas: 0, glosasNaoLancadas: false, ...parcial };
}

describe('aplicarTitulo', () => {
  function deps(falhas: { baixa?: number; glosas?: boolean } = {}) {
    let chamadaBaixa = 0;
    return {
      registrarBaixa: vi.fn<(baixa: BaixaInput) => Promise<void>>(async () => {
        chamadaBaixa += 1;
        if (chamadaBaixa === falhas.baixa) throw new Error('Título cancelado não aceita baixa.');
      }),
      lancarGlosas: vi.fn<(notaId: string, glosas: GlosaSugeridaAplis[]) => Promise<void>>(async () => {
        if (falhas.glosas) throw new Error('Glosa(s) somam mais que o valor do título.');
      }),
      continuar: () => true,
      onProgresso: vi.fn(),
    };
  }
  const comBaixas = titulo({
    idNota: 'a',
    baixas: [
      { data: '2026-09-01', valor: 10, observacoes: 'x' },
      { data: '2026-09-02', valor: 20, observacoes: 'y' },
    ],
    glosas: [glosa({ valor: 5 }), glosa({ idLote: 6229, loteId: 'uuid-6229', valor: 3 })],
  });

  it('lança as baixas em ordem e depois as glosas do título numa chamada só', async () => {
    const d = deps();
    const r = await aplicarTitulo({ titulo: comBaixas, baixas: true, glosas: true }, d);
    expect(d.registrarBaixa.mock.calls.map(([b]) => b.dataRecebimento)).toEqual(['2026-09-01', '2026-09-02']);
    expect(d.lancarGlosas).toHaveBeenCalledTimes(1);
    expect(d.lancarGlosas).toHaveBeenCalledWith('a', comBaixas.glosas);
    expect(r).toEqual(resultado({ baixasLancadas: 2, glosasLancadas: 2 }));
  });

  it('baixa falhou: as glosas não são lançadas', async () => {
    const d = deps({ baixa: 2 });
    const r = await aplicarTitulo({ titulo: comBaixas, baixas: true, glosas: true }, d);
    expect(d.lancarGlosas).not.toHaveBeenCalled();
    expect(r).toEqual(resultado({
      estado: 'parcial',
      baixasLancadas: 1,
      glosasNaoLancadas: true,
      mensagem: 'Título cancelado não aceita baixa.',
    }));
  });

  it('só as baixas marcadas: não lança glosa', async () => {
    const d = deps();
    const r = await aplicarTitulo({ titulo: comBaixas, baixas: true, glosas: false }, d);
    expect(d.lancarGlosas).not.toHaveBeenCalled();
    expect(r).toEqual(resultado({ baixasLancadas: 2 }));
  });

  it('só as glosas marcadas: lança as glosas sem as baixas', async () => {
    const d = deps();
    const r = await aplicarTitulo({ titulo: comBaixas, baixas: false, glosas: true }, d);
    expect(d.registrarBaixa).not.toHaveBeenCalled();
    expect(r).toEqual(resultado({ glosasLancadas: 2 }));
  });

  it('glosas recusadas depois das baixas: parcial, com a mensagem', async () => {
    const r = await aplicarTitulo({ titulo: comBaixas, baixas: true, glosas: true }, deps({ glosas: true }));
    expect(r).toEqual(resultado({
      estado: 'parcial',
      baixasLancadas: 2,
      mensagem: 'Glosa(s) somam mais que o valor do título.',
    }));
  });

  it('só glosas, recusadas: falhou', async () => {
    const r = await aplicarTitulo({ titulo: comBaixas, baixas: false, glosas: true }, deps({ glosas: true }));
    expect(r.estado).toBe('falhou');
  });

  it('interrompido (modal fechado): não começa a próxima baixa nem as glosas', async () => {
    const d = { ...deps(), continuar: vi.fn().mockReturnValueOnce(true).mockReturnValue(false) };
    const r = await aplicarTitulo({ titulo: comBaixas, baixas: true, glosas: true }, d);
    expect(d.registrarBaixa).toHaveBeenCalledTimes(1);
    expect(d.lancarGlosas).not.toHaveBeenCalled();
    expect(r.baixasLancadas).toBe(1);
  });
});

describe('descricaoResultado', () => {
  it.each([
    [resultado({ baixasLancadas: 2, glosasLancadas: 1 }), 'lançado: 2 baixas e 1 glosa'],
    [resultado({ glosasLancadas: 3 }), 'lançado: 3 glosas'],
    [resultado({ baixasLancadas: 1 }), 'lançado: 1 baixa'],
    [
      resultado({ estado: 'falhou', glosasNaoLancadas: true, mensagem: 'boom' }),
      'baixa falhou, glosas não lançadas: boom',
    ],
    [
      resultado({ estado: 'parcial', baixasLancadas: 1, glosasNaoLancadas: true, mensagem: 'boom' }),
      '1 baixa lançada, depois a baixa falhou, glosas não lançadas: boom',
    ],
    [resultado({ estado: 'falhou', mensagem: 'boom' }), 'falhou: boom'],
    [resultado({ estado: 'parcial', baixasLancadas: 2, mensagem: 'boom' }), '2 baixas lançadas, glosas falharam: boom'],
  ])('%o → %s', (r, texto) => {
    expect(descricaoResultado(r)).toBe(texto);
  });
});

describe('resumoAplicacao', () => {
  it('conta títulos lançados, parciais, com erro e os de glosas não lançadas', () => {
    expect(resumoAplicacao([
      resultado(),
      resultado(),
      resultado({ estado: 'parcial', glosasNaoLancadas: true }),
      resultado({ estado: 'falhou' }),
      resultado({ estado: 'falhou', glosasNaoLancadas: true }),
    ])).toEqual({
      lancados: 2,
      parciais: 1,
      falharam: 2,
      glosasNaoLancadas: 2,
      texto: '2 títulos lançados, 1 lançado em parte, 2 falharam (2 com as glosas não lançadas porque a baixa falhou)',
    });
  });

  it('singular e sem as partes zeradas', () => {
    expect(resumoAplicacao([resultado()]).texto).toBe('1 título lançado');
    expect(resumoAplicacao([resultado({ estado: 'falhou', glosasNaoLancadas: true })]).texto)
      .toBe('0 títulos lançados, 1 falhou (1 com as glosas não lançadas porque a baixa falhou)');
  });

  it('nenhum lançado', () => {
    expect(resumoAplicacao([resultado({ estado: 'falhou' }), resultado({ estado: 'falhou' })]).texto)
      .toBe('0 títulos lançados, 2 falharam');
  });
});

describe('titulosComBaixaRepetida', () => {
  const baixa = { data: '2026-09-22', valor: 100, observacoes: 'Baixa do apLIS — lote(s) 6329 (recebido em 22/09/2026)' };

  it('aponta os títulos que repetem a mesma baixa (lote vinculado aos dois)', () => {
    const titulos = [
      titulo({ idNota: 'a', baixas: [baixa] }),
      titulo({ idNota: 'b', baixas: [{ ...baixa, data: '2026-09-23', observacoes: 'outro lote' }, baixa] }),
      titulo({ idNota: 'c', baixas: [{ ...baixa, observacoes: 'Baixa do apLIS — lote(s) 7000 (recebido em 22/09/2026)' }] }),
    ];
    expect(titulosComBaixaRepetida(titulos)).toEqual(new Set(['a', 'b']));
  });

  it('nenhum repetido = conjunto vazio', () => {
    expect(titulosComBaixaRepetida([titulo({ idNota: 'a' })]).size).toBe(0);
  });
});

describe('selecaoPadrao', () => {
  it('marca as baixas aplicáveis, menos as que repetem baixa de outro título, e as glosas', () => {
    const repetida = { data: '2026-09-22', valor: 100, observacoes: 'lote 1' };
    const titulos = [
      titulo({ idNota: 'a', baixas: [repetida], glosas: [glosa()] }),
      titulo({ idNota: 'b', baixas: [repetida] }),
      titulo({ idNota: 'c' }),
      titulo({ idNota: 'd', tipo: null, baixas: [], glosas: [glosa({ idLote: 6300 })] }),
      titulo({
        idNota: 'e',
        numeroNota: null,
        baixas: [{ data: '2026-09-30', valor: 50, observacoes: 'lote 6400' }],
        glosas: [glosa({ idLote: 6400 })],
      }),
    ];
    expect(selecaoPadrao(titulos)).toEqual({ baixas: new Set(['c', 'e']), glosas: new Set(['a', 'd', 'e']) });
  });

  it('não marca as glosas de um lote sugeridas em mais de um título (lote vinculado aos dois)', () => {
    const titulos = [
      titulo({ idNota: 'a', baixas: [], glosas: [glosa({ idLote: 6228 })] }),
      titulo({ idNota: 'b', baixas: [], glosas: [glosa({ idLote: 6300 }), glosa({ idLote: 6228, codigo: '1801' })] }),
      titulo({ idNota: 'c', baixas: [], glosas: [glosa({ idLote: 6400 })] }),
    ];
    expect(titulosComGlosaRepetida(titulos)).toEqual(new Set(['a', 'b']));
    expect(selecaoPadrao(titulos).glosas).toEqual(new Set(['c']));
  });

  it('o selo do demonstrativo não muda a seleção: a glosa que difere também vem marcada', () => {
    const titulos = [
      titulo({ idNota: 'a', baixas: [], glosas: [glosa({ idLote: 6228, demonstrativo: 'confere' })] }),
      titulo({ idNota: 'b', baixas: [], glosas: [glosa({ idLote: 6300, demonstrativo: 'difere' })] }),
      titulo({ idNota: 'c', baixas: [], glosas: [glosa({ idLote: 6400, demonstrativo: null })] }),
    ];
    expect(selecaoPadrao(titulos).glosas).toEqual(new Set(['a', 'b', 'c']));
  });
});
