import { describe, expect, it } from 'vitest';
import {
  sanitizarFiltrosGlosas,
  sanitizarFiltrosPainel,
  sanitizarFiltrosTitulos,
} from './viewsSalvas';
import type { DashboardReceberFiltros, TitulosViewFiltros } from '../types';

const PADRAO_PAINEL: DashboardReceberFiltros = {
  desde: '2025-06-01',
  ate: '2025-08-13',
  operadoraIds: [],
  lotes: [],
  notas: [],
};

const BASE_TITULOS: TitulosViewFiltros = {
  desde: '2025-06-01',
  ate: '2025-08-13',
  status: '',
  operadoraId: '',
  busca: '',
  ocultarParceiras: false,
  somentePendentes: true,
};

describe('sanitizarFiltrosPainel', () => {
  it('JSONB que não é objeto cai inteiro no padrão', () => {
    expect(sanitizarFiltrosPainel(null, PADRAO_PAINEL)).toEqual(PADRAO_PAINEL);
    expect(sanitizarFiltrosPainel('lixo', PADRAO_PAINEL)).toEqual(PADRAO_PAINEL);
    expect(sanitizarFiltrosPainel([1, 2], PADRAO_PAINEL)).toEqual(PADRAO_PAINEL);
  });

  it('view em formato antigo sem lotes/notas recebe os arrays vazios do padrão', () => {
    expect(
      sanitizarFiltrosPainel(
        { desde: '2025-07-01', ate: '2025-07-31', operadoraIds: [] },
        PADRAO_PAINEL,
      ),
    ).toEqual({
      desde: '2025-07-01',
      ate: '2025-07-31',
      operadoraIds: [],
      lotes: [],
      notas: [],
    });
  });

  it('campos válidos são preservados e datas vazias caem no padrão', () => {
    expect(
      sanitizarFiltrosPainel(
        {
          desde: '',
          ate: '2025-07-31',
          operadoraIds: ['op1', 42, null],
          lotes: '6423',
          notas: ['123'],
        },
        PADRAO_PAINEL,
      ),
    ).toEqual({
      desde: PADRAO_PAINEL.desde,
      ate: '2025-07-31',
      operadoraIds: ['op1'],
      lotes: [],
      notas: ['123'],
    });
  });
});

describe('sanitizarFiltrosTitulos', () => {
  it('JSONB que não é objeto cai inteiro na base', () => {
    expect(sanitizarFiltrosTitulos(null, BASE_TITULOS)).toEqual(BASE_TITULOS);
  });

  it('view antiga sem busca aplica busca vazia, e o resto cai na base', () => {
    expect(sanitizarFiltrosTitulos({ desde: '2025-07-01' }, BASE_TITULOS)).toEqual({
      ...BASE_TITULOS,
      desde: '2025-07-01',
    });
  });

  it('status fora do union cai no status atual', () => {
    expect(sanitizarFiltrosTitulos({ status: 'paga' }, BASE_TITULOS)).toEqual(BASE_TITULOS);
    // status resolvido desliga somentePendentes (issue 38): os dois não convivem.
    expect(sanitizarFiltrosTitulos({ status: 'cancelada' }, BASE_TITULOS)).toEqual({
      ...BASE_TITULOS,
      status: 'cancelada',
      somentePendentes: false,
    });
  });

  it('view completa válida passa intacta', () => {
    const view: TitulosViewFiltros = {
      desde: '2025-07-01',
      ate: '2025-07-31',
      status: 'recebida',
      operadoraId: 'op1',
      busca: '123',
      ocultarParceiras: true,
      somentePendentes: false,
    };
    expect(sanitizarFiltrosTitulos(view, BASE_TITULOS)).toEqual(view);
  });

  it('view antiga sem ocultarParceiras cai na base (issue 16)', () => {
    expect(sanitizarFiltrosTitulos({ desde: '2025-07-01' }, BASE_TITULOS)).toEqual({
      ...BASE_TITULOS,
      desde: '2025-07-01',
    });
    expect(
      sanitizarFiltrosTitulos({ desde: '2025-07-01' }, { ...BASE_TITULOS, ocultarParceiras: true }),
    ).toEqual({ ...BASE_TITULOS, desde: '2025-07-01', ocultarParceiras: true });
  });

  it('ocultarParceiras fora do tipo boolean cai na base', () => {
    expect(sanitizarFiltrosTitulos({ ocultarParceiras: 'sim' }, BASE_TITULOS)).toEqual(BASE_TITULOS);
  });

  it('view antiga sem somentePendentes cai na base (issue 38)', () => {
    expect(sanitizarFiltrosTitulos({ desde: '2025-07-01' }, BASE_TITULOS)).toEqual({
      ...BASE_TITULOS,
      desde: '2025-07-01',
    });
    expect(
      sanitizarFiltrosTitulos({ desde: '2025-07-01' }, { ...BASE_TITULOS, somentePendentes: false }),
    ).toEqual({ ...BASE_TITULOS, desde: '2025-07-01', somentePendentes: false });
  });

  it('somentePendentes fora do tipo boolean cai na base', () => {
    expect(sanitizarFiltrosTitulos({ somentePendentes: 'sim' }, BASE_TITULOS)).toEqual(BASE_TITULOS);
  });

  it('view antiga com status mas sem somentePendentes não reativa o atalho por cima do status (issue 38)', () => {
    expect(
      sanitizarFiltrosTitulos({ status: 'aberta' }, { ...BASE_TITULOS, somentePendentes: true }),
    ).toEqual({ ...BASE_TITULOS, status: 'aberta', somentePendentes: false });
  });

  it('somentePendentes explícito não sobrevive junto de um status manual', () => {
    expect(
      sanitizarFiltrosTitulos({ status: 'recebida', somentePendentes: true }, BASE_TITULOS),
    ).toEqual({ ...BASE_TITULOS, status: 'recebida', somentePendentes: false });
  });
});

describe('sanitizarFiltrosGlosas', () => {
  it('JSONB que não é objeto vira "todas"', () => {
    expect(sanitizarFiltrosGlosas(null)).toEqual({ status: 'todas' });
    expect(sanitizarFiltrosGlosas(42)).toEqual({ status: 'todas' });
  });

  it('status válido é preservado, status desconhecido vira "todas"', () => {
    expect(sanitizarFiltrosGlosas({ status: 'revertida' })).toEqual({ status: 'revertida' });
    expect(sanitizarFiltrosGlosas({ status: 'todas' })).toEqual({ status: 'todas' });
    expect(sanitizarFiltrosGlosas({ status: 'anulada' })).toEqual({ status: 'todas' });
  });
});
