import { describe, expect, it } from 'vitest';
import { AUDIO_AINDA_NAO, MIDIA_NAO_SUPORTADA } from '../../../src/modules/eva/domain/midia.js';
import { acharMembro, lerEvento, planoDaMidia, tokenValido } from './webhook.js';

const msg = (payload: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({ event: 'message', session: 'ti_agente', payload: { id: 'false_556199924986@c.us_AAA', from: '556199924986@c.us', fromMe: false, body: ' IT-045 concluída ', ...payload }, ...extra });

describe('lerEvento (RN13)', () => {
  it('mensagem direta de uma pessoa', () => {
    expect(lerEvento(msg({}), 'ti_agente')).toEqual({
      tipo: 'mensagem', id: 'false_556199924986@c.us_AAA', remetentes: ['556199924986'], texto: 'IT-045 concluída', temMidia: false, midia: null,
    });
  });

  it('D43: a mídia que o WAHA baixou vem com a URL e o tipo', () => {
    const audio = msg({ body: '', hasMedia: true, media: { url: 'http://localhost:3000/api/files/eva/false_5561@c.us_AAA.oga', mimetype: 'audio/ogg; codecs=opus' } });
    expect(lerEvento(audio, 'ti_agente')).toMatchObject({
      tipo: 'mensagem', texto: '', temMidia: true, midia: { url: 'http://localhost:3000/api/files/eva/false_5561@c.us_AAA.oga', mimetype: 'audio/ogg; codecs=opus' },
    });
    // O WAHA não baixou (WHATSAPP_DOWNLOAD_MEDIA desligado): há mídia, sem os dados dela.
    expect(lerEvento(msg({ hasMedia: true }), 'ti_agente')).toMatchObject({ temMidia: true, midia: null });
  });

  it('ignora grupo, o próprio número, outra sessão e outros eventos', () => {
    expect(lerEvento(msg({ from: '120363@g.us' }), 'ti_agente')).toMatchObject({ tipo: 'ignorar' });
    expect(lerEvento(msg({ from: 'status@broadcast' }), 'ti_agente')).toMatchObject({ tipo: 'ignorar' });
    expect(lerEvento(msg({ fromMe: true }), 'ti_agente')).toMatchObject({ tipo: 'ignorar' });
    expect(lerEvento(msg({}, { session: 'quotations_001' }), 'ti_agente')).toMatchObject({ tipo: 'ignorar', motivo: 'sessão quotations_001' });
    expect(lerEvento({ event: 'session.status', payload: {} }, 'ti_agente')).toMatchObject({ tipo: 'ignorar' });
    expect(lerEvento(null, 'ti_agente')).toMatchObject({ tipo: 'ignorar' });
  });

  it('remetente em LID usa o número de _data.key', () => {
    const e = lerEvento(msg({ from: '123456789@lid', _data: { key: { senderPn: '5561999924986@s.whatsapp.net' } } }), 'ti_agente');
    expect(e).toMatchObject({ tipo: 'mensagem', remetentes: ['5561999924986'] });
  });

  it('GOWS: remetente em LID usa _data.Info.SenderAlt, sem o sufixo de aparelho', () => {
    const e = lerEvento(msg({
      from: '151037608517734@lid',
      _data: { Info: { Sender: '151037608517734@lid', SenderAlt: '556199924986:1@s.whatsapp.net', Chat: '151037608517734@lid' } },
    }), 'ti_agente');
    expect(e).toMatchObject({ tipo: 'mensagem', remetentes: ['556199924986'] });
  });

  it('confirmação de entrega', () => {
    expect(lerEvento({ event: 'message.ack', session: 'ti_agente', payload: { id: 'true_x@c.us_B', ack: 3 } }, 'ti_agente'))
      .toEqual({ tipo: 'ack', id: 'true_x@c.us_B', ack: 3 });
  });
});

describe('planoDaMidia (D43)', () => {
  const URL_WAHA = 'https://abc.ngrok.app/api/files/eva/x.oga';
  const e = (texto: string, mimetype: string | null, url: string | null = URL_WAHA) => ({ texto, temMidia: true, midia: mimetype || url ? { url, mimetype } : null });

  it('sem mídia, segue pelo texto', () => {
    expect(planoDaMidia({ texto: 'oi', temMidia: false, midia: null }, true)).toEqual({ acao: 'texto' });
  });

  it('com a VPS nova, áudio e imagem esperam o download (o host da URL não importa)', () => {
    expect(planoDaMidia(e('', 'audio/ogg; codecs=opus'), true)).toEqual({ acao: 'baixar', tipo: 'audio', mimetype: 'audio/ogg; codecs=opus', url: URL_WAHA });
    expect(planoDaMidia(e('IT-045', 'image/jpeg'), true)).toMatchObject({ acao: 'baixar', tipo: 'imagem' });
  });

  it('sem a VPS nova: áudio tem a resposta de antes, mais clara; imagem segue pela legenda', () => {
    expect(planoDaMidia(e('', 'audio/ogg'), false)).toEqual({ acao: 'responder', resposta: AUDIO_AINDA_NAO });
    expect(planoDaMidia(e('IT-045 deu erro', 'image/jpeg'), false)).toEqual({ acao: 'texto' });
    // URL fora do /api/files do WAHA: não há o que baixar.
    expect(planoDaMidia(e('', 'audio/ogg', 'https://outro.site/x.oga'), true)).toEqual({ acao: 'responder', resposta: AUDIO_AINDA_NAO });
  });

  it('figurinha não responde; vídeo e documento têm a resposta fixa; sem o tipo, vale o texto', () => {
    expect(planoDaMidia(e('', 'image/webp'), true)).toEqual({ acao: 'ignorar', motivo: 'figurinha' });
    expect(planoDaMidia(e('', 'video/mp4'), true)).toEqual({ acao: 'responder', resposta: MIDIA_NAO_SUPORTADA });
    expect(planoDaMidia(e('segue o PDF', 'application/pdf'), true)).toEqual({ acao: 'responder', resposta: MIDIA_NAO_SUPORTADA });
    expect(planoDaMidia({ texto: '', temMidia: true, midia: null }, true)).toEqual({ acao: 'texto' });
  });
});

describe('tokenValido', () => {
  it('só o token certo passa', () => {
    expect(tokenValido('segredo', 'segredo')).toBe(true);
    expect(tokenValido('errado', 'segredo')).toBe(false);
    expect(tokenValido(undefined, 'segredo')).toBe(false);
    expect(tokenValido('segredo', undefined)).toBe(false);
  });
});

describe('acharMembro', () => {
  const membros = [
    { id: 'm1', user_id: 'u1', whatsapp: '5561999924986', whatsapp_chat_id: null, ativo: true },
    { id: 'm2', user_id: 'u2', whatsapp: '5561988887777', whatsapp_chat_id: '556188887777@c.us', ativo: false },
  ];
  it('casa com e sem o 9º dígito; inativo não conta', () => {
    expect(acharMembro(['556199924986'], membros)?.id).toBe('m1');
    expect(acharMembro(['556188887777'], membros)).toBeNull();
    expect(acharMembro(['5511900000000'], membros)).toBeNull();
  });
});
