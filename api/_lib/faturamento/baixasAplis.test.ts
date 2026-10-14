import { describe, expect, it } from 'vitest';
import { baixasSugeridas } from './baixasAplis.js';

describe('baixasSugeridas', () => {
  describe('so-no-aplis', () => {
    it('uma data → uma baixa com o valor daquela data', () => {
      expect(baixasSugeridas({
        tipo: 'so-no-aplis',
        recebidoSistema: 0,
        recebidoAplis: 2034.81,
        recebidoAplisPorData: [{ data: '2026-09-22', valor: 2034.81, lotes: [6329] }],
        baixasSistema: [],
      })).toEqual([
        { data: '2026-09-22', valor: 2034.81, observacoes: 'Baixa do apLIS — lote(s) 6329 (recebido em 22/09/2026)' },
      ]);
    });

    it('três datas → três baixas, em ordem de data', () => {
      const baixas = baixasSugeridas({
        tipo: 'so-no-aplis',
        recebidoSistema: 0,
        recebidoAplis: 1000,
        recebidoAplisPorData: [
          { data: '2026-10-01', valor: 100, lotes: [5002] },
          { data: '2026-08-15', valor: 700, lotes: [5001, 5002] },
          { data: '2026-09-10', valor: 200, lotes: [5001] },
        ],
        baixasSistema: [],
      });
      expect(baixas.map((b) => [b.data, b.valor])).toEqual([
        ['2026-08-15', 700],
        ['2026-09-10', 200],
        ['2026-10-01', 100],
      ]);
      expect(baixas[0].observacoes).toBe('Baixa do apLIS — lote(s) 5001, 5002 (recebido em 15/08/2026)');
    });

    it('data com valor abaixo de R$ 0,01 fica fora', () => {
      const baixas = baixasSugeridas({
        tipo: 'so-no-aplis',
        recebidoSistema: 0,
        recebidoAplis: 500,
        recebidoAplisPorData: [
          { data: '2026-09-01', valor: 500, lotes: [1] },
          { data: '2026-09-02', valor: 0.004, lotes: [1] },
        ],
        baixasSistema: [],
      });
      expect(baixas.map((b) => b.data)).toEqual(['2026-09-01']);
    });

    it('datas que passam do total (estorno no apLIS) → uma baixa só, com o recebido', () => {
      // Total 700 = 1.000 recebidos em 15/08 − 300 de estorno; as datas positivas somam 1.000.
      const baixas = baixasSugeridas({
        tipo: 'so-no-aplis',
        recebidoSistema: 0,
        recebidoAplis: 700,
        recebidoAplisPorData: [{ data: '2026-08-15', valor: 1000, lotes: [5001] }],
        baixasSistema: [],
      });
      expect(baixas).toEqual([
        { data: '2026-08-15', valor: 700, observacoes: 'Baixa do apLIS — lote(s) 5001 (recebido em 15/08/2026)' },
      ]);
    });
  });

  describe('aplis-maior', () => {
    it('datas novas que batem com a diferença → uma baixa por data nova', () => {
      const baixas = baixasSugeridas({
        tipo: 'aplis-maior',
        recebidoSistema: 800,
        recebidoAplis: 1000,
        recebidoAplisPorData: [
          { data: '2026-08-15', valor: 800, lotes: [5001] },
          { data: '2026-10-01', valor: 150, lotes: [5001] },
          { data: '2026-10-05', valor: 50, lotes: [5002] },
        ],
        baixasSistema: [{ data: '2026-08-15', valor: 800 }],
      });
      expect(baixas.map((b) => [b.data, b.valor])).toEqual([
        ['2026-10-01', 150],
        ['2026-10-05', 50],
      ]);
    });

    it('datas que não batem → uma baixa só, com a diferença, na data do último recebimento', () => {
      // O operador lançou 800 em 20/08, mas o apLIS diz 600 em 15/08 e 400 em 01/10.
      const baixas = baixasSugeridas({
        tipo: 'aplis-maior',
        recebidoSistema: 800,
        recebidoAplis: 1000,
        recebidoAplisPorData: [
          { data: '2026-08-15', valor: 600, lotes: [5001] },
          { data: '2026-10-01', valor: 400, lotes: [5002] },
        ],
        baixasSistema: [{ data: '2026-08-20', valor: 800 }],
      });
      expect(baixas).toEqual([
        { data: '2026-10-01', valor: 200, observacoes: 'Baixa do apLIS — lote(s) 5001, 5002 (recebido em 01/10/2026)' },
      ]);
    });

    it('data já lançada no sistema é descartada mesmo com valor diferente', () => {
      const baixas = baixasSugeridas({
        tipo: 'aplis-maior',
        recebidoSistema: 500,
        recebidoAplis: 900,
        recebidoAplisPorData: [
          { data: '2026-09-22', valor: 600, lotes: [6329] },
          { data: '2026-10-02', valor: 300, lotes: [6329] },
        ],
        baixasSistema: [{ data: '2026-09-22', valor: 500 }],
      });
      // Resta 300 em 02/10 contra uma diferença de 400: não bate → baixa única de 400.
      expect(baixas).toEqual([
        { data: '2026-10-02', valor: 400, observacoes: 'Baixa do apLIS — lote(s) 6329 (recebido em 02/10/2026)' },
      ]);
    });

    it('soma das datas restantes dentro de R$ 1,00 da diferença conta como batida', () => {
      const baixas = baixasSugeridas({
        tipo: 'aplis-maior',
        recebidoSistema: 800.5,
        recebidoAplis: 1000,
        recebidoAplisPorData: [
          { data: '2026-08-15', valor: 800, lotes: [5001] },
          { data: '2026-10-01', valor: 120, lotes: [5001] },
          { data: '2026-10-02', valor: 80, lotes: [5001] },
        ],
        baixasSistema: [{ data: '2026-08-15', valor: 800.5 }],
      });
      // Diferença 199,50; restante 200,00 → bate (0,50 < 1,00): valores do apLIS.
      expect(baixas.map((b) => [b.data, b.valor])).toEqual([
        ['2026-10-01', 120],
        ['2026-10-02', 80],
      ]);
    });

    it('diferença de exatamente R$ 1,00 entre restante e diferença não bate', () => {
      const baixas = baixasSugeridas({
        tipo: 'aplis-maior',
        recebidoSistema: 100,
        recebidoAplis: 300,
        recebidoAplisPorData: [
          { data: '2026-08-15', valor: 100, lotes: [1] },
          { data: '2026-10-01', valor: 201, lotes: [1] },
        ],
        baixasSistema: [{ data: '2026-08-15', valor: 100 }],
      });
      expect(baixas).toEqual([
        { data: '2026-10-01', valor: 200, observacoes: 'Baixa do apLIS — lote(s) 1 (recebido em 01/10/2026)' },
      ]);
    });

    it('sem data restante → baixa única com a diferença na última data', () => {
      const baixas = baixasSugeridas({
        tipo: 'aplis-maior',
        recebidoSistema: 500,
        recebidoAplis: 800,
        recebidoAplisPorData: [{ data: '2026-09-22', valor: 800, lotes: [6329] }],
        baixasSistema: [{ data: '2026-09-22', valor: 500 }],
      });
      expect(baixas.map((b) => [b.data, b.valor])).toEqual([['2026-09-22', 300]]);
    });

    it('valores em centavos, sem resíduo de ponto flutuante', () => {
      const baixas = baixasSugeridas({
        tipo: 'aplis-maior',
        recebidoSistema: 100.1,
        recebidoAplis: 201.3,
        recebidoAplisPorData: [{ data: '2026-09-22', valor: 201.3, lotes: [1] }],
        baixasSistema: [{ data: '2026-09-01', valor: 100.1 }],
      });
      expect(baixas[0].valor).toBe(101.2);
    });
  });

  it('sem recebimento por data no apLIS → nenhuma baixa', () => {
    expect(baixasSugeridas({
      tipo: 'aplis-maior',
      recebidoSistema: 100,
      recebidoAplis: 300,
      recebidoAplisPorData: [],
      baixasSistema: [{ data: '2026-08-15', valor: 100 }],
    })).toEqual([]);
  });
});
