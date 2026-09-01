import { describe, expect, it } from 'vitest';
import {
  agregarIhqParceiro,
  calcularTatInternoDias,
  calcularTatParceiroHoras,
  contarEnviadosParceiro,
  contarLaudosForaDoPrazo,
  contarLaudosLiberados,
  contarPendenciaAguardandoLaudo,
  contarPendenciaAguardandoParceiro,
  contarRecebidosVoltaTotal,
  filtrarPorCodExame,
} from './ihqParceiroIndicadores.js';

const periodo = { inicio: '2026-01-01', fim: '2026-03-31' };

const linhaBase = {
  codExame: null,
  dtaPrevista: null,
  dtaLiberacao: null,
  dtaEnvioParceiro: null,
  dtaRetornoLaudoFotos: null,
  dtaRetornoAmostraDevolvida: null,
};

describe('filtrarPorCodExame', () => {
  it('separa cada tipo, nunca mistura', () => {
    const linhas = [
      { ...linhaBase, codExame: 6 },
      { ...linhaBase, codExame: 12 },
    ];
    expect(filtrarPorCodExame(linhas, 6)).toHaveLength(1);
    expect(filtrarPorCodExame(linhas, 12)).toHaveLength(1);
    expect(filtrarPorCodExame(linhas, 13)).toHaveLength(0);
  });
});

describe('contarLaudosLiberados/contarLaudosForaDoPrazo', () => {
  it('liberados conta por presença de dtaLiberacao', () => {
    expect(contarLaudosLiberados([{ ...linhaBase, dtaLiberacao: '2026-01-05' }, linhaBase])).toBe(1);
  });

  it('fora do prazo só conta quando há prevista e liberação depois dela', () => {
    const total = contarLaudosForaDoPrazo([
      { ...linhaBase, dtaPrevista: '2026-01-10', dtaLiberacao: '2026-01-05' }, // dentro do prazo
      { ...linhaBase, dtaPrevista: '2026-01-10', dtaLiberacao: '2026-01-15' }, // atrasado
      { ...linhaBase, dtaPrevista: null, dtaLiberacao: '2026-01-20' }, // sem prevista
    ]);
    expect(total).toBe(1);
  });
});

describe('contadores de envio/retorno', () => {
  it('contarEnviadosParceiro conta por presença de dtaEnvioParceiro', () => {
    expect(contarEnviadosParceiro([{ ...linhaBase, dtaEnvioParceiro: '2026-08-01T10:00:00' }, linhaBase])).toBe(1);
  });

  it('contarRecebidosVoltaTotal conta uma vez só, mesmo com os dois sinais presentes', () => {
    const linhas = [
      { ...linhaBase, dtaRetornoLaudoFotos: '2026-08-05T10:00:00', dtaRetornoAmostraDevolvida: '2026-08-06T10:00:00' },
    ];
    expect(contarRecebidosVoltaTotal(linhas)).toBe(1);
  });
});

describe('TAT parceiro/interno', () => {
  it('TAT do parceiro usa o PRIMEIRO dos dois sinais de retorno', () => {
    const linhas = [
      {
        ...linhaBase,
        dtaEnvioParceiro: '2026-08-01T10:00:00',
        dtaRetornoAmostraDevolvida: '2026-08-03T10:00:00', // 48h
        dtaRetornoLaudoFotos: '2026-08-05T10:00:00', // 96h — não deve ser usado
      },
    ];
    expect(calcularTatParceiroHoras(linhas)).toBe(48);
  });

  it('TAT interno vai do primeiro retorno até a liberação, em DIAS (dta_liberacao não tem hora)', () => {
    const linhas = [{ ...linhaBase, dtaRetornoAmostraDevolvida: '2026-08-03T10:00:00', dtaLiberacao: '2026-08-04' }];
    expect(calcularTatInternoDias(linhas)).toBe(1);
  });

  it('TAT interno não descarta liberação no MESMO dia do retorno (achado de code review: contar em horas descartava por "fim < início" por causa da meia-noite)', () => {
    const linhas = [{ ...linhaBase, dtaRetornoAmostraDevolvida: '2026-08-03T18:00:00', dtaLiberacao: '2026-08-03' }];
    expect(calcularTatInternoDias(linhas)).toBe(0);
  });

  it('nunca vira 0 por falta de dado — retorna null quando falta qualquer uma das duas pontas', () => {
    expect(calcularTatParceiroHoras([linhaBase])).toBeNull();
    expect(calcularTatParceiroHoras([{ ...linhaBase, dtaEnvioParceiro: '2026-08-01T10:00:00' }])).toBeNull();
    expect(calcularTatInternoDias([linhaBase])).toBeNull();
  });
});

describe('pendências', () => {
  it('aguardando parceiro: enviado, sem nenhum sinal de retorno', () => {
    const linhas = [
      { ...linhaBase, dtaEnvioParceiro: '2026-08-01T10:00:00' },
      { ...linhaBase, dtaEnvioParceiro: '2026-08-01T10:00:00', dtaRetornoLaudoFotos: '2026-08-02T10:00:00' },
    ];
    expect(contarPendenciaAguardandoParceiro(linhas)).toBe(1);
  });

  it('aguardando laudo: sem dtaLiberacao, independente do retorno', () => {
    const linhas = [{ ...linhaBase, dtaLiberacao: null }, { ...linhaBase, dtaLiberacao: '2026-08-10' }];
    expect(contarPendenciaAguardandoLaudo(linhas)).toBe(1);
  });
});

describe('agregarIhqParceiro', () => {
  it('retorna os 3 tipos SEMPRE separados, nunca somados, mesmo com um deles zerado', () => {
    const resultado = agregarIhqParceiro(periodo, [
      { ...linhaBase, codExame: 6, dtaLiberacao: '2026-08-05' },
      { ...linhaBase, codExame: 12, dtaEnvioParceiro: '2026-08-01T00:00:00' },
    ]);
    expect(resultado.secao).toBe('ihq_parceiro');
    expect(resultado.porTipo).toHaveLength(3);

    const interna = resultado.porTipo.find((t) => t.codExame === 6);
    const externaBloco = resultado.porTipo.find((t) => t.codExame === 12);
    const externaBlocoLamina = resultado.porTipo.find((t) => t.codExame === 13);

    expect(interna?.laudosLiberados).toBe(1);
    expect(interna?.enviadosParceiro).toBe(0);
    expect(externaBloco?.enviadosParceiro).toBe(1);
    expect(externaBloco?.laudosLiberados).toBe(0);
    // Tipo sem nenhuma requisição no período ainda aparece, zerado.
    expect(externaBlocoLamina?.laudosLiberados).toBe(0);
    expect(externaBlocoLamina?.enviadosParceiro).toBe(0);
  });
});
