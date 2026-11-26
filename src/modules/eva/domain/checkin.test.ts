import { describe, expect, it } from 'vitest';
import { confirmacaoDoCheckin, montarResumoCheckin, momentoDoCheckin, perguntaDoCheckin } from './checkin';
import { respeitaHorario } from './cobranca';
import { venceuNaFila } from './whatsapp';

// Dados fictícios. Quinta, 26/11; 9h em Brasília = 12h UTC.
const em = (hhmm: string, dia = '2026-11-26') => new Date(`${dia}T${hhmm}:00-03:00`);
const LINK = 'https://app/it/inicio';

describe('check-in: quando (D46)', () => {
  it('pergunta das 9h às 12h e resume das 10h às 13h, só em dia útil', () => {
    expect(momentoDoCheckin(em('08:59'))).toEqual({ hoje: '2026-11-26', perguntar: false, resumir: false });
    expect(momentoDoCheckin(em('09:00'))).toMatchObject({ perguntar: true, resumir: false });
    expect(momentoDoCheckin(em('10:10'))).toMatchObject({ perguntar: true, resumir: true });
    expect(momentoDoCheckin(em('12:00'))).toMatchObject({ perguntar: false, resumir: true });
    expect(momentoDoCheckin(em('13:00'))).toMatchObject({ perguntar: false, resumir: false });
    // Sábado.
    expect(momentoDoCheckin(em('09:30', '2026-11-28'))).toMatchObject({ perguntar: false, resumir: false });
  });

  it('na fila: respeita o horário e só vale no próprio dia', () => {
    expect(respeitaHorario('checkin')).toBe(true);
    expect(respeitaHorario('checkin_resumo')).toBe(true);
    expect(venceuNaFila('checkin', '2026-11-26T12:00:00Z', Date.parse('2026-11-26T20:00:00Z'))).toBe(false);
    expect(venceuNaFila('checkin', '2026-11-26T12:00:00Z', Date.parse('2026-11-27T12:00:00Z'))).toBe(true);
  });
});

describe('check-in: textos (D46)', () => {
  it('a pergunta, com o radar dos cards atrasados ou vencendo', () => {
    const t = perguntaDoCheckin('Ana Souza', ['IT-045', 'IT-050']);
    expect(t).toMatch(/^Bom dia, Ana! ☀️ Check-in de hoje: o que entra no seu dia\? Tem algum bloqueio\?/);
    expect(t).toContain('No radar: IT-045, IT-050 (atrasados ou vencendo hoje).');
    expect(perguntaDoCheckin('Bruno', [])).not.toContain('No radar');
  });

  it('o resumo: bloqueios primeiro, depois quem respondeu, sem resposta e ausentes', () => {
    const t = montarResumoCheckin('2026-11-26', [
      { nome: 'Carla Dias', situacao: 'sem_resposta', planejados: [], bloqueios: [], resumo: null },
      { nome: 'Bruno Mendes', situacao: 'respondido', planejados: [], bloqueios: [], resumo: 'fechando o relatório do RH' },
      { nome: 'Davi Lima', situacao: 'ausente', planejados: [], bloqueios: [], resumo: null, ausencia: 'de férias até 05/12' },
      { nome: 'Ana Souza', situacao: 'respondido', planejados: ['IT-045', 'IT-050'], bloqueios: [{ codigo: 'IT-060', motivo: 'esperando o fornecedor' }], resumo: null },
    ], LINK);
    expect(t).toBe([
      '☀️ Check-in da equipe · 26/11',
      '',
      '• Ana: IT-045, IT-050\n  ⛔ IT-060: esperando o fornecedor',
      '• Bruno: "fechando o relatório do RH"',
      '• Carla: sem resposta',
      '• Davi: de férias até 05/12',
      '',
      '1 bloqueio · 1 sem resposta',
      `Detalhes no Início: ${LINK}`,
    ].join('\n'));
  });

  it('a confirmação para quem respondeu é montada pelo sistema', () => {
    expect(confirmacaoDoCheckin('Ana Souza', ['IT-045', 'IT-050'], [{ codigo: 'IT-060', motivo: 'x' }]))
      .toBe('Anotado, Ana! ☀️ Hoje: IT-045 e IT-050. Avisei os gestores do bloqueio no IT-060 e anotei no card.');
    expect(confirmacaoDoCheckin('Bruno', [], [])).toBe('Anotado, Bruno! ☀️ Bom trabalho hoje 💪');
  });
});
