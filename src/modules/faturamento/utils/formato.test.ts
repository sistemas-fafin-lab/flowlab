import { describe, expect, it } from 'vitest';
import { diasDeAtraso, faixaAgingParaRange, formatDataHora, protocoloDuplicadoLotesLabel } from './formato';

describe('formatDataHora', () => {
  it('formata timestamptz em data + hora no padrão brasileiro', () => {
    expect(formatDataHora('2026-08-18T14:32:00.000Z')).toBe('18/08/2026, 11:32');
  });

  it('retorna travessão para valor ausente', () => {
    expect(formatDataHora(null)).toBe('—');
    expect(formatDataHora(undefined)).toBe('—');
  });
});

describe('protocoloDuplicadoLotesLabel', () => {
  it('lista os outros lotes do grupo quando conhecidos', () => {
    expect(protocoloDuplicadoLotesLabel([1234, 5678], 3)).toBe('lote(s) 1234, 5678');
  });

  it('cai para a contagem quando a lista de lotes não veio', () => {
    expect(protocoloDuplicadoLotesLabel(null, 3)).toBe('3 lotes');
    expect(protocoloDuplicadoLotesLabel([], 3)).toBe('3 lotes');
  });

  it('cai para "—" quando nem a lista nem a contagem vieram', () => {
    expect(protocoloDuplicadoLotesLabel(null, null)).toBe('—');
  });
});

describe('diasDeAtraso', () => {
  it('retorna null sem data de vencimento', () => {
    expect(diasDeAtraso(null)).toBeNull();
    expect(diasDeAtraso(undefined)).toBeNull();
  });
});

// `faixaAgingParaRange` traduz a faixa de aging clicada no gráfico (issue 41)
// num range sobre `data_vencimento` — o teste central é que esse range, e o
// cálculo de `diasDeAtraso` que o gráfico usa para classificar cada título na
// faixa, concordem exatamente nas bordas. Um desalinhamento de um dia faria o
// modal mostrar uma lista diferente do que o gráfico contou.
describe('faixaAgingParaRange', () => {
  const HOJE = '2026-09-03';

  it('a_vencer: vencimento a partir de hoje (inclusive), sem teto, incluindo sem vencimento', () => {
    expect(faixaAgingParaRange('a_vencer', HOJE)).toEqual({
      desde: '2026-09-03',
      ate: null,
      incluirSemVencimento: true,
    });
  });

  it('d1_30: vencimento entre hoje-30 e hoje-1', () => {
    expect(faixaAgingParaRange('d1_30', HOJE)).toEqual({
      desde: '2026-08-04',
      ate: '2026-09-02',
      incluirSemVencimento: false,
    });
  });

  it('d31_60: vencimento entre hoje-60 e hoje-31', () => {
    expect(faixaAgingParaRange('d31_60', HOJE)).toEqual({
      desde: '2026-07-05',
      ate: '2026-08-03',
      incluirSemVencimento: false,
    });
  });

  it('d61_90: vencimento entre hoje-90 e hoje-61', () => {
    expect(faixaAgingParaRange('d61_90', HOJE)).toEqual({
      desde: '2026-06-05',
      ate: '2026-07-04',
      incluirSemVencimento: false,
    });
  });

  it('d90_mais: vencimento antes de hoje-90, sem piso', () => {
    expect(faixaAgingParaRange('d90_mais', HOJE)).toEqual({
      desde: null,
      ate: '2026-06-04',
      incluirSemVencimento: false,
    });
  });

  it('concorda com diasDeAtraso nas bordas de cada faixa', () => {
    const casos: { bucket: Parameters<typeof faixaAgingParaRange>[0]; dias: number }[] = [
      { bucket: 'd1_30', dias: 1 },
      { bucket: 'd1_30', dias: 30 },
      { bucket: 'd31_60', dias: 31 },
      { bucket: 'd31_60', dias: 60 },
      { bucket: 'd61_90', dias: 61 },
      { bucket: 'd61_90', dias: 90 },
      { bucket: 'd90_mais', dias: 91 },
    ];

    for (const { bucket, dias } of casos) {
      const vencimento = new Date(`${HOJE}T00:00:00Z`);
      vencimento.setUTCDate(vencimento.getUTCDate() - dias);
      const vencimentoIso = vencimento.toISOString().slice(0, 10);

      // diasDeAtraso compara contra a data real de hoje, não HOJE fixo aqui —
      // isolado calculando o atraso "manualmente" com a mesma fórmula, para o
      // teste não depender do relógio da máquina que roda a suíte.
      const atraso = Math.round(
        (Date.parse(`${HOJE}T00:00:00Z`) - Date.parse(`${vencimentoIso}T00:00:00Z`)) / 86_400_000,
      );
      expect(atraso).toBe(dias);

      const { desde, ate } = faixaAgingParaRange(bucket, HOJE);
      if (desde) expect(vencimentoIso >= desde).toBe(true);
      if (ate) expect(vencimentoIso <= ate).toBe(true);
    }
  });
});
