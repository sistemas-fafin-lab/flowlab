import { describe, expect, it } from 'vitest';
import { fotoAte, seriePorDia, seriePorSemana, type FotoDia, type Resolvido } from './tendencias';

// Sexta, 13/11. Dados fictícios.
const HOJE = '2026-11-13';
const HORA = 3600_000;

const foto = (dia: string, f: Partial<FotoDia> = {}): FotoDia => ({
  dia, abertos: 10, atrasados: 3, vencemHoje: 1, parados: 0, criticosAtrasados: 0, entregas: 2, naFila: 4, foraDoPrazo: 0,
  emAndamento: 1, chamadosAbertos: 2, chamadosResolvidos: 1, tempoMedioMs: 5 * HORA, pessoas: {}, ...f,
});

describe('fotos diárias (D42)', () => {
  const FOTOS = [foto('2026-11-12', { atrasados: 5 }), foto(HOJE, { atrasados: 2, naFila: 1 })];

  it('fotoAte: a mais recente até o dia; no sábado vale a de sexta', () => {
    expect(fotoAte(FOTOS, '2026-11-14')?.dia).toBe(HOJE);
    expect(fotoAte(FOTOS, '2026-11-12')?.dia).toBe('2026-11-12');
    expect(fotoAte(FOTOS, '2026-11-11')).toBeNull();
  });

  it('seriePorDia: só os dias úteis, da mais antiga para hoje, vazio onde não houve foto', () => {
    expect(seriePorDia(FOTOS, HOJE, 7)).toEqual([
      { dia: '2026-11-09', rotulo: '09/11', atrasados: null, abertos: null, naFila: null },
      { dia: '2026-11-10', rotulo: '10/11', atrasados: null, abertos: null, naFila: null },
      { dia: '2026-11-11', rotulo: '11/11', atrasados: null, abertos: null, naFila: null },
      { dia: '2026-11-12', rotulo: '12/11', atrasados: 5, abertos: 10, naFila: 4 },
      { dia: HOJE, rotulo: '13/11', atrasados: 2, abertos: 10, naFila: 1 },
    ]);
  });
});

describe('seriePorSemana (D42): pelas datas de resolução', () => {
  const r = (resolved_at: string, created_at: string, e: Partial<Resolvido> = {}): Resolvido => ({
    resolved_at, created_at, is_internal: true, kanban_hidden: false, ...e,
  });
  const RESOLVIDOS = [
    // Card do Kanban, desta semana.
    r('2026-11-10T15:00:00Z', '2026-11-02T12:00:00Z'),
    // Card resolvido domingo, 08/11, às 23h de Brasília (segunda em UTC): é da semana de 02/11.
    r('2026-11-09T02:00:00Z', '2026-11-02T12:00:00Z'),
    // Chamado de usuário só da fila (fora do Kanban): conta no tempo, não na entrega. 24 h.
    r('2026-11-04T12:00:00Z', '2026-11-03T12:00:00Z', { is_internal: false, kanban_hidden: true }),
    // Chamado que virou card: conta nos dois. 48 h.
    r('2026-11-04T12:00:00Z', '2026-11-02T12:00:00Z', { is_internal: false }),
    // Antes da janela: fica de fora.
    r('2026-10-20T12:00:00Z', '2026-10-19T12:00:00Z'),
  ];

  it('entregas (Kanban), chamados resolvidos e tempo médio de cada semana; a atual vai até hoje', () => {
    expect(seriePorSemana(RESOLVIDOS, HOJE, 3)).toEqual([
      { semana: '2026-10-26', rotulo: '26/10', entregas: 0, resolvidos: 0, tempoMedioMs: null, atual: false },
      { semana: '2026-11-02', rotulo: '02/11', entregas: 2, resolvidos: 2, tempoMedioMs: 36 * HORA, atual: false },
      { semana: '2026-11-09', rotulo: '09/11', entregas: 1, resolvidos: 0, tempoMedioMs: null, atual: true },
    ]);
  });

  it('sem nada resolvido, as semanas vêm zeradas (o cartão mostra o vazio)', () => {
    const vazias = seriePorSemana([], HOJE);
    expect(vazias).toHaveLength(8);
    expect(vazias.every((p) => p.entregas === 0 && p.tempoMedioMs === null)).toBe(true);
    expect(vazias[0].semana).toBe('2026-09-21');
  });
});
