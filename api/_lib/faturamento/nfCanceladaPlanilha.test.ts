import { describe, expect, it } from 'vitest';
import { tituloSubstituto } from './nfCanceladaPlanilha.js';
import type { TituloCandidato } from './nfCanceladaPlanilha.js';

const titulo = (id: string, dados: Partial<TituloCandidato> = {}): TituloCandidato => ({
  id, operadoraId: 'sis', emissao: '2026-03-10', valor: 1000, lotes: [], ...dados,
});

const nf = { operadoraId: 'sis', emissao: '2026-03-05', valor: 6941.85, lotes: [5124] };

describe('tituloSubstituto', () => {
  it('liga ao único título da mesma operadora, emitido depois, com lote em comum', () => {
    const resultado = tituloSubstituto(nf, [
      titulo('certo', { lotes: [5124, 5200] }),
      titulo('outro-lote', { lotes: [4967] }),
    ]);

    expect(resultado).toEqual({ tipo: 'unico', tituloId: 'certo' });
  });

  it('sem lote, liga pelo mesmo valor; emitido no mesmo dia ou no 30º dia ainda conta', () => {
    expect(tituloSubstituto(nf, [titulo('mesmo-dia', { emissao: '2026-03-05', valor: 6941.85 })]))
      .toEqual({ tipo: 'unico', tituloId: 'mesmo-dia' });
    expect(tituloSubstituto(nf, [titulo('dia-30', { emissao: '2026-04-04', valor: 6941.85 })]))
      .toEqual({ tipo: 'unico', tituloId: 'dia-30' });
  });

  it('nenhum candidato: outra operadora, antes da NF, depois de 30 dias, sem emissão ou sem lote nem valor em comum', () => {
    const resultado = tituloSubstituto(nf, [
      titulo('outra-operadora', { operadoraId: 'fascal', lotes: [5124] }),
      titulo('antes', { emissao: '2026-03-04', lotes: [5124] }),
      titulo('dia-31', { emissao: '2026-04-05', lotes: [5124] }),
      titulo('sem-emissao', { emissao: null, lotes: [5124] }),
      titulo('valor-quase-igual', { valor: 6941.84 }),
    ]);

    expect(resultado).toEqual({ tipo: 'nenhum' });
  });

  it('mais de um candidato: a NF fica sem título e os candidatos vão para o relatório', () => {
    const resultado = tituloSubstituto(nf, [
      titulo('pelo-lote', { lotes: [5124] }),
      titulo('pelo-valor', { emissao: '2026-03-20', valor: 6941.85 }),
    ]);

    expect(resultado).toEqual({ tipo: 'varios', tituloIds: ['pelo-lote', 'pelo-valor'] });
  });
});
