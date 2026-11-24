import { describe, expect, it } from 'vitest';
import {
  VPS_VIVA_MS, anexei, caminhoDaMidia, caminhoNoWaha, codigosNoTexto, ehFigurinha, extensaoDaMidia, mimeBase, nomeDoAnexo, soCodigos,
  tipoDaMidia, vpsBaixaMidia,
} from './midia';

describe('tipo e arquivo da mídia (D43)', () => {
  it('o tipo pelo mimetype, sem os parâmetros', () => {
    expect(mimeBase('audio/ogg; codecs=opus')).toBe('audio/ogg');
    expect(tipoDaMidia('audio/ogg; codecs=opus')).toBe('audio');
    expect(tipoDaMidia('audio/x-m4a')).toBe('audio');
    expect(tipoDaMidia('image/jpeg')).toBe('imagem');
    expect(tipoDaMidia('image/heic')).toBe('outro');
    expect(tipoDaMidia('video/mp4')).toBe('outro');
    expect(tipoDaMidia(null)).toBe('outro');
  });

  it('figurinha: webp sem legenda', () => {
    expect(ehFigurinha('image/webp', '')).toBe(true);
    expect(ehFigurinha('image/webp', 'IT-045')).toBe(false);
    expect(ehFigurinha('image/jpeg', '')).toBe(false);
  });

  it('o caminho no WAHA, qualquer que seja o host', () => {
    expect(caminhoNoWaha('http://localhost:3000/api/files/eva/false_55@c.us_A.oga')).toBe('/api/files/eva/false_55@c.us_A.oga');
    expect(caminhoNoWaha('https://abc.ngrok.app/api/files/eva/x.jpeg')).toBe('/api/files/eva/x.jpeg');
    expect(caminhoNoWaha('/api/files/eva/x.jpeg')).toBe('/api/files/eva/x.jpeg');
    expect(caminhoNoWaha('https://outro.site/x.jpeg')).toBeNull();
    expect(caminhoNoWaha(null)).toBeNull();
  });

  it('extensão, caminho no bucket e nome do anexo (hora de Brasília)', () => {
    expect(extensaoDaMidia('audio/ogg; codecs=opus')).toBe('ogg');
    expect(extensaoDaMidia('image/jpeg')).toBe('jpg');
    expect(extensaoDaMidia('audio/x-m4a')).toBe('bin');
    expect(caminhoDaMidia('m1', 'msg1', 'image/png')).toBe('m1/msg1.png');
    expect(nomeDoAnexo('2026-11-24T17:32:00Z', 'image/jpeg')).toBe('whatsapp-24-11-2026-1432.jpg');
  });
});

describe('códigos de card no texto (D43)', () => {
  it('acha "IT-045", "it 45" e "IT45", no formato do banco, sem repetir', () => {
    expect(codigosNoTexto('IT-045 deu esse erro')).toEqual(['IT-045']);
    expect(codigosNoTexto('é do it 45 e do IT12, e do IT-045 de novo')).toEqual(['IT-045', 'IT-012']);
    expect(codigosNoTexto('IT-1234')).toEqual(['IT-1234']);
    expect(codigosNoTexto('SAIT 45, ITEM 5')).toEqual([]);
    expect(codigosNoTexto(null)).toEqual([]);
  });

  it('só o código (com "é do", "no card", vírgula), sem mais nada para a IA', () => {
    expect(soCodigos('IT-045')).toBe(true);
    expect(soCodigos('é do IT-045')).toBe(true);
    expect(soCodigos('no card it 45.')).toBe(true);
    expect(soCodigos('IT-12 e IT-13')).toBe(true);
    expect(soCodigos('IT-045 deu erro de novo')).toBe(false);
    expect(soCodigos('obrigado')).toBe(false);
  });

  it('o aviso do anexo', () => {
    expect(anexei(['IT-045'])).toBe('📎 Anexei a imagem ao IT-045.');
    expect(anexei(['IT-045', 'IT-046'], 2)).toBe('📎 Anexei as 2 imagens aos IT-045 e IT-046.');
  });
});

describe('vpsBaixaMidia (D43)', () => {
  const agora = Date.parse('2026-11-24T15:00:00Z');
  it('a VPS anunciou o recurso e deu sinal de vida há pouco', () => {
    expect(vpsBaixaMidia({ vps_recursos: ['midia', 'relogio'], waha_verificado_em: '2026-11-24T14:59:00Z' }, agora)).toBe(true);
    expect(vpsBaixaMidia({ vps_recursos: ['relogio'], waha_verificado_em: '2026-11-24T14:59:00Z' }, agora)).toBe(false);
    expect(vpsBaixaMidia({ vps_recursos: ['midia'], waha_verificado_em: new Date(agora - VPS_VIVA_MS - 1000).toISOString() }, agora)).toBe(false);
    expect(vpsBaixaMidia(null, agora)).toBe(false);
  });
});
