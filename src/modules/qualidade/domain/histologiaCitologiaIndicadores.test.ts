import { describe, expect, it } from 'vitest';
import {
  agregarHistologiaCitologia,
  calcularTatProcessamentoDias,
  contarAmostrasNaoRecebidas,
  contarMaterialDevolvidoNaoConforme,
  contarMicroscopiaAguardando,
  somarBlocosProduzidos,
  somarLaminasProduzidas,
} from './histologiaCitologiaIndicadores.js';

const periodo = { inicio: '2026-01-01', fim: '2026-03-31' };

const linhaBase = {
  dtaAmostraRecebida: null,
  dtaPrimeiraLaminaPronta: null,
  numBlocos: 0,
  numLaminas: 0,
  microscopiaAguardando: false,
  amostraNaoRecebida: false,
  materialDevolvidoNaoConforme: false,
};

describe('agregarHistologiaCitologia', () => {
  it('marca a resposta com a seção histologia_citologia e o total de requisições', () => {
    const resultado = agregarHistologiaCitologia(periodo, [linhaBase, linhaBase]);
    expect(resultado.secao).toBe('histologia_citologia');
    expect(resultado.totalRequisicoes).toBe(2);
  });
});

describe('somarBlocosProduzidos e somarLaminasProduzidas', () => {
  it('somam numBlocos/numLaminas de todas as linhas', () => {
    expect(somarBlocosProduzidos([{ ...linhaBase, numBlocos: 2 }, { ...linhaBase, numBlocos: 3 }])).toBe(5);
    expect(somarLaminasProduzidas([{ ...linhaBase, numLaminas: 4 }, { ...linhaBase, numLaminas: 1 }])).toBe(5);
  });
});

describe('calcularTatProcessamentoDias', () => {
  it('calcula de amostra recebida até a primeira lâmina pronta', () => {
    const resultado = calcularTatProcessamentoDias([
      { ...linhaBase, dtaAmostraRecebida: '2026-08-01', dtaPrimeiraLaminaPronta: '2026-08-04' },
    ]);
    expect(resultado).toBe(3);
  });

  it('nunca vira 0 — retorna null quando falta qualquer uma das duas datas', () => {
    expect(calcularTatProcessamentoDias([{ ...linhaBase, dtaAmostraRecebida: '2026-08-01', dtaPrimeiraLaminaPronta: null }])).toBeNull();
    expect(calcularTatProcessamentoDias([{ ...linhaBase, dtaAmostraRecebida: null, dtaPrimeiraLaminaPronta: '2026-08-01' }])).toBeNull();
    expect(calcularTatProcessamentoDias([])).toBeNull();
  });
});

describe('contadores de pendência/problema', () => {
  it('microscopia aguardando, amostras não recebidas e material devolvido são independentes', () => {
    const linhas = [
      { ...linhaBase, microscopiaAguardando: true },
      { ...linhaBase, amostraNaoRecebida: true },
      { ...linhaBase, materialDevolvidoNaoConforme: true },
    ];
    expect(contarMicroscopiaAguardando(linhas)).toBe(1);
    expect(contarAmostrasNaoRecebidas(linhas)).toBe(1);
    expect(contarMaterialDevolvidoNaoConforme(linhas)).toBe(1);
  });
});
