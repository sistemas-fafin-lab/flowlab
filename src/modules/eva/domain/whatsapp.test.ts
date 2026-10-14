import { describe, expect, it } from 'vitest';
import {
  depoisDaFalha, digitosDoChatId, horarioNaFila, idCurtoWaha, mesmoNumero, quandoFoi, statusPeloAck, ultimoContato,
  type MensagemFila,
} from './whatsapp';

const HOJE = '2026-10-13';
const JANELA = 4 * 60 * 60 * 1000;

describe('números', () => {
  it('com e sem o 9º dígito são o mesmo número', () => {
    expect(mesmoNumero('5561999924986', '556199924986@c.us')).toBe(true);
    expect(mesmoNumero('+55 61 99992-4986', '5561999924986')).toBe(true);
    expect(mesmoNumero('5561999924986', '5561999924987')).toBe(false);
    expect(mesmoNumero(null, '5561999924986')).toBe(false);
  });

  it('grupo, lista e LID não são telefone', () => {
    expect(digitosDoChatId('556199924986@c.us')).toBe('556199924986');
    expect(digitosDoChatId('120363@g.us')).toBeNull();
    expect(digitosDoChatId('status@broadcast')).toBeNull();
    expect(digitosDoChatId('987654321@lid')).toBeNull();
  });

  it('id curto do WAHA', () => {
    expect(idCurtoWaha('true_556199924986@c.us_3EB0ABC')).toBe('3EB0ABC');
    expect(idCurtoWaha('3EB0ABC')).toBe('3EB0ABC');
  });
});

describe('novas tentativas (§11.2)', () => {
  it('1, 5 e 15 min; na 4ª falha, falhou', () => {
    const agora = Date.UTC(2026, 9, 13, 12, 0);
    expect(depoisDaFalha(0, agora)).toEqual({ status: 'pendente', tentativas: 1, proxima_tentativa_em: '2026-10-13T12:01:00.000Z' });
    expect(depoisDaFalha(2, agora)).toEqual({ status: 'pendente', tentativas: 3, proxima_tentativa_em: '2026-10-13T12:15:00.000Z' });
    expect(depoisDaFalha(3, agora)).toEqual({ status: 'falhou', tentativas: 4 });
  });
});

describe('confirmações de entrega (RF26)', () => {
  it('entregue e lida, nunca para trás', () => {
    expect(statusPeloAck(2, 'enviada')).toBe('entregue');
    expect(statusPeloAck(3, 'enviada')).toBe('lida');
    expect(statusPeloAck(3, 'entregue')).toBe('lida');
    expect(statusPeloAck(2, 'lida')).toBeNull();
    expect(statusPeloAck(1, 'enviada')).toBeNull();
    expect(statusPeloAck(3, 'falhou')).toBeNull();
  });
});

describe('quando foi', () => {
  it('hoje, ontem e antes', () => {
    expect(quandoFoi('2026-10-13T13:12:00Z', HOJE)).toBe('às 10:12');
    expect(quandoFoi('2026-10-12T13:12:00Z', HOJE)).toBe('ontem às 10:12');
    expect(quandoFoi('2026-10-09T13:12:00Z', HOJE)).toBe('em 09/10 às 10:12');
    expect(horarioNaFila('2026-10-13T13:12:00Z', HOJE)).toBe('10:12');
    expect(horarioNaFila('2026-10-09T13:12:00Z', HOJE)).toBe('09/10');
  });
});

describe('ultimoContato (D24)', () => {
  const msg = (m: Partial<MensagemFila>): MensagemFila => ({
    id: Math.random().toString(36), membro_id: 'm-bruno', membro_user_id: 'u-bruno', membro_nome: 'Bruno Mendes', direcao: 'saida',
    tipo: 'cobranca_manual', texto: 't', card_ids: ['c1'], status: 'enviada', erro: null,
    created_at: '2026-10-13T13:12:00Z', enviada_em: '2026-10-13T13:12:30Z', ...m,
  });
  const agora = new Date('2026-10-13T15:00:00Z').getTime();

  it('sem cobrança', () => {
    expect(ultimoContato('c1', ['u-bruno'], [], agora, HOJE, JANELA)).toMatchObject({ texto: 'Ainda não cobrada', cobradaNaJanela: false });
  });

  it('cobrada e sem resposta; dentro da janela, o botão fica "Cobrada"', () => {
    const r = ultimoContato('c1', ['u-bruno'], [msg({})], agora, HOJE, JANELA);
    expect(r).toMatchObject({ texto: 'Cobrada às 10:12 · sem resposta', cobradaNaJanela: true, ultimaManualEm: '2026-10-13T13:12:00Z' });
    expect(r.semResposta).toEqual({ desde: '2026-10-13T13:12:30Z', nome: 'Bruno Mendes' });
  });

  it('resposta do responsável depois da cobrança', () => {
    const recebida = msg({ direcao: 'entrada', tipo: 'recebida', status: 'recebida', card_ids: [], created_at: '2026-10-13T13:40:00Z', enviada_em: null });
    expect(ultimoContato('c1', ['u-bruno'], [msg({}), recebida], agora, HOJE, JANELA).texto).toBe('Cobrada às 10:12 · respondeu às 10:40');
  });

  it('na fila, falhou, e a cobrança diária também conta', () => {
    expect(ultimoContato('c1', ['u-bruno'], [msg({ status: 'pendente', enviada_em: null })], agora, HOJE, JANELA).texto).toBe('Cobrança na fila');
    expect(ultimoContato('c1', ['u-bruno'], [msg({ status: 'falhou', enviada_em: null })], agora, HOJE, JANELA).texto).toBe('A cobrança às 10:12 falhou');
    const diaria = msg({ tipo: 'cobranca', created_at: '2026-10-13T11:05:00Z', enviada_em: '2026-10-13T11:05:10Z' });
    expect(ultimoContato('c1', ['u-bruno'], [diaria], agora, HOJE, JANELA)).toMatchObject({ texto: 'Cobrada às 08:05 · sem resposta', cobradaNaJanela: false });
  });
});
