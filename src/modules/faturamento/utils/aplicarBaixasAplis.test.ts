import { describe, expect, it, vi } from 'vitest';
import type { BaixaInput, TituloPreviaBaixasAplis } from '../types';
import {
  aplicarTitulo,
  descricaoResultado,
  resumoAplicacao,
  selecaoPadrao,
  separarPrevia,
  titulosComBaixaRepetida,
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
    ...parcial,
  };
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

  it('título sem baixa sugerida é pulado — sem data de recebimento no apLIS', () => {
    const { aplicaveis, pulados } = separarPrevia([titulo({ idNota: 'a', baixas: [] })]);
    expect(aplicaveis).toEqual([]);
    expect(pulados).toEqual([{
      titulo: expect.objectContaining({ idNota: 'a' }),
      motivo: 'sem data de recebimento no apLIS',
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
    }),
    titulo({ idNota: 'b', baixas: [{ data: '2026-09-03', valor: 50, observacoes: '' }] }),
    titulo({ idNota: 'c', baixas: [{ data: '2026-09-04', valor: 1000, observacoes: '' }] }),
  ];

  it('soma só as baixas dos títulos marcados, em centavos', () => {
    expect(totalALancar(titulos, new Set(['a', 'b']))).toEqual({ titulos: 2, baixas: { qtd: 3, valor: 50.3 } });
  });

  it('nada marcado = zero', () => {
    expect(totalALancar(titulos, new Set())).toEqual({ titulos: 0, baixas: { qtd: 0, valor: 0 } });
  });
});

function resultado(parcial: Partial<ResultadoTitulo> = {}): ResultadoTitulo {
  return { estado: 'lancado', baixasLancadas: 0, ...parcial };
}

describe('aplicarTitulo', () => {
  function deps(falhas: { baixa?: number } = {}) {
    let chamadaBaixa = 0;
    return {
      registrarBaixa: vi.fn<(baixa: BaixaInput) => Promise<void>>(async () => {
        chamadaBaixa += 1;
        if (chamadaBaixa === falhas.baixa) throw new Error('Título cancelado não aceita baixa.');
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
  });

  it('lança as baixas em ordem, sem glosa junto', async () => {
    const d = deps();
    const r = await aplicarTitulo(comBaixas, d);
    expect(d.registrarBaixa.mock.calls.map(([b]) => [b.dataRecebimento, b.valorRecebido, b.glosas])).toEqual([
      ['2026-09-01', 10, []],
      ['2026-09-02', 20, []],
    ]);
    expect(d.onProgresso).toHaveBeenCalledTimes(2);
    expect(r).toEqual(resultado({ baixasLancadas: 2 }));
  });

  it('a primeira baixa falhou: falhou, sem tentar a seguinte', async () => {
    const d = deps({ baixa: 1 });
    const r = await aplicarTitulo(comBaixas, d);
    expect(d.registrarBaixa).toHaveBeenCalledTimes(1);
    expect(r).toEqual(resultado({ estado: 'falhou', mensagem: 'Título cancelado não aceita baixa.' }));
  });

  it('a segunda baixa falhou: parcial, com a mensagem', async () => {
    const r = await aplicarTitulo(comBaixas, deps({ baixa: 2 }));
    expect(r).toEqual(resultado({ estado: 'parcial', baixasLancadas: 1, mensagem: 'Título cancelado não aceita baixa.' }));
  });

  it('interrompido (modal fechado): não começa a próxima baixa', async () => {
    const d = { ...deps(), continuar: vi.fn().mockReturnValueOnce(true).mockReturnValue(false) };
    const r = await aplicarTitulo(comBaixas, d);
    expect(d.registrarBaixa).toHaveBeenCalledTimes(1);
    expect(r.baixasLancadas).toBe(1);
  });
});

describe('descricaoResultado', () => {
  it.each([
    [resultado({ baixasLancadas: 2 }), 'lançado: 2 baixas'],
    [resultado({ baixasLancadas: 1 }), 'lançado: 1 baixa'],
    [resultado(), 'nada lançado'],
    [resultado({ estado: 'falhou', mensagem: 'boom' }), 'falhou: boom'],
    [resultado({ estado: 'parcial', baixasLancadas: 2, mensagem: 'boom' }), '2 baixas lançadas, depois falhou: boom'],
  ])('%o → %s', (r, texto) => {
    expect(descricaoResultado(r)).toBe(texto);
  });
});

describe('resumoAplicacao', () => {
  it('conta títulos lançados, parciais e com erro', () => {
    expect(resumoAplicacao([
      resultado(),
      resultado(),
      resultado({ estado: 'parcial' }),
      resultado({ estado: 'falhou' }),
      resultado({ estado: 'falhou' }),
    ])).toEqual({
      lancados: 2,
      parciais: 1,
      falharam: 2,
      texto: '2 títulos lançados, 1 lançado em parte, 2 falharam',
    });
  });

  it('singular e sem as partes zeradas', () => {
    expect(resumoAplicacao([resultado()]).texto).toBe('1 título lançado');
    expect(resumoAplicacao([resultado({ estado: 'falhou' })]).texto).toBe('0 títulos lançados, 1 falhou');
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
  it('marca as baixas aplicáveis, menos as que repetem baixa de outro título', () => {
    const repetida = { data: '2026-09-22', valor: 100, observacoes: 'lote 1' };
    const titulos = [
      titulo({ idNota: 'a', baixas: [repetida] }),
      titulo({ idNota: 'b', baixas: [repetida] }),
      titulo({ idNota: 'c' }),
      titulo({ idNota: 'd', baixas: [] }),
      titulo({ idNota: 'e', numeroNota: null, baixas: [{ data: '2026-09-30', valor: 50, observacoes: 'lote 6400' }] }),
    ];
    expect(selecaoPadrao(titulos)).toEqual(new Set(['c', 'e']));
  });
});
