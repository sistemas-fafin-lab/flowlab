import { describe, expect, it } from 'vitest';
import {
  distribuicaoPorTipo,
  formatarDuracao,
  inicioDoPeriodo,
  resumirChamados,
  serieAbertosResolvidos,
  type ChamadoMetrica,
} from './itDashboard';

// Quinta, 22/10/2026, 15h (horário local).
const AGORA = new Date(2026, 9, 22, 15, 0, 0);
const diasAtras = (dias: number, hora = 10) => new Date(2026, 9, 22 - dias, hora, 0, 0).toISOString();

const chamado = (c: Partial<ChamadoMetrica>): ChamadoMetrica => ({
  status: 'pending',
  priority: 'medium',
  request_type: 'suporte',
  created_at: diasAtras(1),
  kanban_status: 'backlog',
  kanban_hidden: true,
  ...c,
});

describe('inicioDoPeriodo', () => {
  it('conta hoje como o último dia do período', () => {
    expect(inicioDoPeriodo(7, AGORA)).toEqual(new Date(2026, 9, 16));
  });
});

describe('resumirChamados', () => {
  const lista = [
    chamado({ status: 'pending', created_at: diasAtras(1) }),
    // média: 1 semana de prazo para iniciar; aberto há 10 dias e ainda na fila
    chamado({ status: 'pending', created_at: diasAtras(10) }),
    chamado({ status: 'in_progress', created_at: diasAtras(2) }),
    chamado({ status: 'resolved', created_at: diasAtras(3, 10), resolved_at: diasAtras(2, 10) }),
    chamado({ status: 'resolved', created_at: diasAtras(40), resolved_at: diasAtras(35) }),
    chamado({ status: 'cancelled', created_at: diasAtras(5) }),
  ];

  it('separa fila, andamento e o que caiu no período', () => {
    const r = resumirChamados(lista, 7, AGORA);
    expect(r.naFila).toBe(2);
    expect(r.emAndamento).toBe(1);
    expect(r.abertosNoPeriodo).toBe(4);
    expect(r.resolvidosNoPeriodo).toBe(1);
    expect(r.tempoMedioResolucaoMs).toBe(24 * 60 * 60 * 1000);
    expect(r.inicioAtrasado).toBe(1);
  });

  it('sem resolvidos no período, sem tempo médio', () => {
    expect(resumirChamados([chamado({})], 30, AGORA).tempoMedioResolucaoMs).toBeNull();
  });

  it('reaberto (sem resolved_at) não conta como resolvido', () => {
    const r = resumirChamados([chamado({ status: 'in_progress', resolved_at: null })], 30, AGORA);
    expect(r.resolvidosNoPeriodo).toBe(0);
  });
});

describe('serieAbertosResolvidos', () => {
  it('em 7 dias, um ponto por dia terminando hoje', () => {
    const serie = serieAbertosResolvidos(
      [
        chamado({ created_at: diasAtras(0, 9) }),
        chamado({ created_at: diasAtras(6, 0) }),
        chamado({ created_at: diasAtras(7, 23) }),
        chamado({ status: 'resolved', created_at: diasAtras(3), resolved_at: diasAtras(1) }),
      ],
      7,
      AGORA,
    );
    expect(serie).toHaveLength(7);
    expect(serie[0].rotulo).toBe('16/10');
    expect(serie[6].rotulo).toBe('22/10');
    expect(serie.map((p) => p.abertos)).toEqual([1, 0, 0, 1, 0, 0, 1]);
    expect(serie[5].resolvidos).toBe(1);
  });

  it('em 90 dias, 13 semanas', () => {
    const serie = serieAbertosResolvidos([chamado({ created_at: diasAtras(0) }), chamado({ created_at: diasAtras(90) })], 90, AGORA);
    expect(serie).toHaveLength(13);
    expect(serie[12].abertos).toBe(1);
    expect(serie[0].abertos).toBe(1);
  });
});

describe('distribuicaoPorTipo', () => {
  it('conta os abertos no período por tipo, do maior para o menor', () => {
    const fatias = distribuicaoPorTipo(
      [
        chamado({ request_type: 'desenvolvimento' }),
        chamado({ request_type: 'suporte', status: 'resolved' }),
        chamado({ request_type: 'suporte' }),
        chamado({ request_type: 'consultoria', created_at: diasAtras(60) }),
      ],
      30,
      AGORA,
    );
    expect(fatias).toEqual([
      { tipo: 'suporte', total: 2, emAberto: 1 },
      { tipo: 'desenvolvimento', total: 1, emAberto: 1 },
    ]);
  });
});

describe('formatarDuracao', () => {
  it('escolhe a unidade pelo tamanho', () => {
    expect(formatarDuracao(40 * 60000)).toBe('40min');
    expect(formatarDuracao(5 * 3600000)).toBe('5h');
    expect(formatarDuracao(51 * 3600000)).toBe('2d 3h');
    expect(formatarDuracao(48 * 3600000)).toBe('2d');
  });
});
