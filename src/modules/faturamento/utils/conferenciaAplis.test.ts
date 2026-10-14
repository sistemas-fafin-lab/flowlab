import { describe, expect, it } from 'vitest';
import type { DivergenciaAplis } from '../types';
import { csvConferencia, diferencaAplis, secoesConferencia } from './conferenciaAplis';

function divergencia(parcial: Partial<DivergenciaAplis> = {}): DivergenciaAplis {
  return {
    idNota: 'n1',
    numeroNota: '9127',
    operadora: 'Unimed',
    status: 'aberta',
    dataEmissao: '2026-08-10',
    valorTotal: 2034.81,
    recebidoSistema: 0,
    glosadoSistema: 0,
    recebidoAplis: 2034.81,
    primeiroRecebimentoAplis: '2026-09-22',
    ultimoRecebimentoAplis: '2026-09-22',
    lotes: [{ aplisId: 6329, statusAplis: 'Recebido', recebidoAplis: 2034.81 }],
    tipo: 'so-no-aplis',
    ...parcial,
  };
}

describe('diferencaAplis', () => {
  it('é o recebido no apLIS menos o do sistema, em centavos exatos', () => {
    expect(diferencaAplis(divergencia({ recebidoSistema: 100.1, recebidoAplis: 101.1 }))).toBe(1);
  });

  it('fica negativa quando o sistema recebeu mais', () => {
    expect(diferencaAplis(divergencia({ recebidoSistema: 500, recebidoAplis: 0, tipo: 'sistema-maior' }))).toBe(-500);
  });

  it('é null no lote ausente (sem valor do apLIS)', () => {
    expect(diferencaAplis(divergencia({ recebidoAplis: null, tipo: 'lote-ausente' }))).toBeNull();
  });
});

describe('secoesConferencia', () => {
  it('agrupa por tipo na ordem fixa, com contagem e total da diferença', () => {
    const secoes = secoesConferencia([
      divergencia({ idNota: 'a', tipo: 'sistema-maior', recebidoSistema: 300, recebidoAplis: 100 }),
      divergencia({ idNota: 'b', tipo: 'so-no-aplis', recebidoAplis: 10.1 }),
      divergencia({ idNota: 'c', tipo: 'so-no-aplis', recebidoAplis: 20.2 }),
      divergencia({ idNota: 'd', tipo: 'lote-ausente', recebidoAplis: null }),
    ]);
    expect(secoes.map((s) => [s.tipo, s.titulos.length, s.totalDiferenca])).toEqual([
      ['so-no-aplis', 2, 30.3],
      ['sistema-maior', 1, -200],
      ['lote-ausente', 1, null],
    ]);
  });

  it('não devolve seção vazia', () => {
    expect(secoesConferencia([])).toEqual([]);
  });

  it('cada seção traz rótulo para a tela', () => {
    const [secao] = secoesConferencia([divergencia({ tipo: 'aplis-maior', recebidoSistema: 10, recebidoAplis: 20 })]);
    expect(secao.rotulo).toBe('Recebido a mais no apLIS');
  });
});

describe('csvConferencia', () => {
  it('começa com BOM, separa por ";" e formata valores e datas em pt-BR', () => {
    const csv = csvConferencia([
      divergencia({
        recebidoSistema: 1000,
        recebidoAplis: 3034.81,
        tipo: 'aplis-maior',
        glosadoSistema: 12.5,
        primeiroRecebimentoAplis: '2026-09-01',
        lotes: [
          { aplisId: 6329, statusAplis: 'Recebido', recebidoAplis: 2034.81 },
          { aplisId: 6330, statusAplis: 'Recebido - parcial', recebidoAplis: 1000 },
        ],
      }),
    ]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const [cabecalho, linha, ...resto] = csv.slice(1).split('\r\n');
    expect(cabecalho).toBe(
      'Tipo;Título;Operadora;Status;Emissão;Lotes;Recebido no sistema;Glosado;Recebido no apLIS;Diferença;'
      + 'Primeiro recebimento no apLIS;Último recebimento no apLIS',
    );
    expect(linha).toBe(
      'Recebido a mais no apLIS;9127;Unimed;aberta;10/08/2026;6329 (Recebido), 6330 (Recebido - parcial);'
      + '1.000,00;12,50;3.034,81;2.034,81;01/09/2026;22/09/2026',
    );
    expect(resto).toEqual([]);
  });

  it('deixa vazio o que não tem valor (lote ausente, título sem número, sem data)', () => {
    const csv = csvConferencia([
      divergencia({
        numeroNota: null,
        tipo: 'lote-ausente',
        recebidoAplis: null,
        primeiroRecebimentoAplis: null,
        ultimoRecebimentoAplis: null,
        lotes: [{ aplisId: 4905, statusAplis: null, recebidoAplis: null }],
      }),
    ]);
    const linha = csv.slice(1).split('\r\n')[1];
    expect(linha).toBe('Lote ausente no apLIS;;Unimed;aberta;10/08/2026;4905 (não encontrado);0,00;0,00;;;;');
  });

  it('põe entre aspas o campo com ";" ou aspas', () => {
    const csv = csvConferencia([divergencia({ operadora: 'Saúde; "Plena"' })]);
    expect(csv).toContain(';"Saúde; ""Plena""";');
  });
});
