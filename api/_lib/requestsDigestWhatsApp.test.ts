import { describe, expect, it, vi } from 'vitest';
import {
  sendRequestsDigestWhatsApp,
  type WhatsAppEnv,
} from './requestsDigestWhatsApp.js';
import type { RequestsDigestCounts } from './requestsDailyDigest.js';

const ENV: WhatsAppEnv = {
  WHATSAPP_PHONE_NUMBER_ID: '123456789',
  WHATSAPP_ACCESS_TOKEN: 'token-abc',
  REQUESTS_DIGEST_WHATSAPP_TO: '5511999998888',
};

const COUNTS: RequestsDigestCounts = {
  newCount: 5,
  scCount: 3,
  smCount: 2,
  urgentCount: 1,
  olderPendingCount: 7,
};

const DATE = '28/09/2026';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const okFetch = () =>
  vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
    jsonResponse({ messages: [{ id: 'wamid.XYZ' }] }),
  );

describe('sendRequestsDigestWhatsApp', () => {
  it('sucesso: POST na Graph API com o template e devolve o id da mensagem', async () => {
    const fetchMock = okFetch();

    const result = await sendRequestsDigestWhatsApp({ counts: COUNTS, date: DATE }, { env: ENV, fetch: fetchMock });

    expect(result).toEqual({ success: true, messageId: 'wamid.XYZ' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v25.0/123456789/messages');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token-abc');

    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      messaging_product: 'whatsapp',
      to: '5511999998888',
      type: 'template',
      template: { name: 'resumo_solicitacoes_diario', language: { code: 'pt_BR' } },
    });
  });

  it('parâmetros do corpo na ordem: data, novas, SC, SM, urgentes, pendentes antigas (sem parâmetro de botão)', async () => {
    const fetchMock = okFetch();

    await sendRequestsDigestWhatsApp({ counts: COUNTS, date: DATE }, { env: ENV, fetch: fetchMock });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.template.components).toEqual([
      {
        type: 'body',
        parameters: ['28/09/2026', '5', '3', '2', '1', '7'].map((text) => ({ type: 'text', text })),
      },
    ]);
  });

  it('status ≠ 2xx: falha com código e mensagem do erro da Graph API', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        { error: { message: 'Invalid OAuth access token.', type: 'OAuthException', code: 190, fbtrace_id: 'abc' } },
        401,
      ),
    );

    const result = await sendRequestsDigestWhatsApp({ counts: COUNTS, date: DATE }, { env: ENV, fetch: fetchMock });

    expect(result.success).toBe(false);
    expect(result.error).toContain('HTTP 401');
    expect(result.error).toContain('190');
    expect(result.error).toContain('Invalid OAuth access token.');
  });

  it('status ≠ 2xx com corpo que não é JSON ainda sinaliza falha', async () => {
    const fetchMock = vi.fn(async () => new Response('Bad Gateway', { status: 502 }));

    const result = await sendRequestsDigestWhatsApp({ counts: COUNTS, date: DATE }, { env: ENV, fetch: fetchMock });

    expect(result.success).toBe(false);
    expect(result.error).toContain('HTTP 502');
  });

  it('fetch lança (rede): falha sem propagar a exceção', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });

    const result = await sendRequestsDigestWhatsApp({ counts: COUNTS, date: DATE }, { env: ENV, fetch: fetchMock });

    expect(result.success).toBe(false);
    expect(result.error).toContain('ECONNRESET');
  });

  it.each(['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'REQUESTS_DIGEST_WHATSAPP_TO'] as const)(
    'env %s ausente: falha sem chamar a Graph API',
    async (missing) => {
      const fetchMock = okFetch();

      const result = await sendRequestsDigestWhatsApp(
        { counts: COUNTS, date: DATE },
        { env: { ...ENV, [missing]: '  ' }, fetch: fetchMock },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain(missing);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});
