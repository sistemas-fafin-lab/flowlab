import { describe, expect, it } from 'vitest';
import {
  agregarPatologiaAp,
  contarBlocosRefeitos,
  contarCasosAtrasados,
  contarConsensoPendente,
  contarRecorteColoracao,
} from './patologiaIndicadores.js';

const periodo = { inicio: '2026-01-01', fim: '2026-03-31' };

const linhaBase = {
  dtaPrevistaSetor: null,
  dtaLiberacao: null,
  recorteColoracao: false,
  consensoPendente: false,
  blocoDanificado: false,
};

describe('agregarPatologiaAp', () => {
  it('marca a resposta com a seção patologia_ap e o total de requisições', () => {
    const resultado = agregarPatologiaAp(periodo, [linhaBase, linhaBase]);
    expect(resultado.secao).toBe('patologia_ap');
    expect(resultado.totalRequisicoes).toBe(2);
  });
});

describe('contarCasosAtrasados', () => {
  it('só conta quando há prevista do setor e liberação depois dela', () => {
    const total = contarCasosAtrasados([
      { ...linhaBase, dtaPrevistaSetor: '2026-01-10', dtaLiberacao: '2026-01-05' }, // dentro do prazo
      { ...linhaBase, dtaPrevistaSetor: '2026-01-10', dtaLiberacao: '2026-01-15' }, // atrasado
      { ...linhaBase, dtaPrevistaSetor: null, dtaLiberacao: '2026-01-20' }, // sem prevista do setor
    ]);
    expect(total).toBe(1);
  });

  it('ignora requisições sem liberação (nunca depende de "agora")', () => {
    const total = contarCasosAtrasados([{ ...linhaBase, dtaPrevistaSetor: '2026-01-01', dtaLiberacao: null }]);
    expect(total).toBe(0);
  });
});

describe('contarRecorteColoracao', () => {
  it('conta só as linhas marcadas', () => {
    const total = contarRecorteColoracao([
      { ...linhaBase, recorteColoracao: true },
      { ...linhaBase, recorteColoracao: false },
    ]);
    expect(total).toBe(1);
  });
});

describe('contarConsensoPendente', () => {
  it('conta só as linhas marcadas', () => {
    const total = contarConsensoPendente([
      { ...linhaBase, consensoPendente: true },
      { ...linhaBase, consensoPendente: true },
      { ...linhaBase, consensoPendente: false },
    ]);
    expect(total).toBe(2);
  });
});

describe('contarBlocosRefeitos', () => {
  it('conta só as linhas marcadas (esperado quase sempre 0 neste LIS)', () => {
    expect(contarBlocosRefeitos([linhaBase, linhaBase])).toBe(0);
    expect(contarBlocosRefeitos([{ ...linhaBase, blocoDanificado: true }])).toBe(1);
  });
});
