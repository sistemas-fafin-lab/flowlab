import { describe, expect, it, vi } from 'vitest';
import { ERRO_VENCIDA, esvaziarFila, WAHA_INACESSIVEL, type ItemFila, type RepositorioFila } from './outbox.js';
import type { ClienteWaha } from './waha.js';

function repo(itens: ItemFila[], ativo = true) {
  const r = {
    situacao: [] as string[],
    enviadas: [] as { id: string; wahaId: string | null }[],
    falhas: [] as { id: string; status: string; tentativas: number; erro: string }[],
    chatIds: [] as [string, string][],
    adiadas: [] as { id: string; para: string }[],
  };
  const repositorio: RepositorioFila = {
    whatsappAtivo: async () => ativo,
    gravarSituacaoSessao: async (s) => { r.situacao.push(s); },
    pendentes: async () => itens,
    guardarChatId: async (m, c) => { r.chatIds.push([m, c]); },
    marcarEnviada: async (id, wahaId) => { r.enviadas.push({ id, wahaId }); },
    marcarFalha: async (id, d, erro) => { r.falhas.push({ id, status: d.status, tentativas: d.tentativas, erro }); },
    adiar: async (id, para) => { r.adiadas.push({ id, para }); },
  };
  return { r, repositorio };
}

const waha = (over: Partial<ClienteWaha> = {}): ClienteWaha => ({
  sessao: async () => ({ ok: true, status: 'WORKING' }),
  verificarNumero: async () => ({ ok: true, existe: true, chatId: '556199924986@c.us' }),
  enviarTexto: async () => ({ ok: true, id: 'true_556199924986@c.us_ABC' }),
  ...over,
});

const item = (id: string, membro: ItemFila['membro'] = { id: 'm1', whatsapp: '5561999924986', whatsapp_chat_id: null }, tentativas = 0, extra: Partial<ItemFila> = {}): ItemFila =>
  ({ id, tipo: 'cobranca_manual', created_at: '2026-10-13T11:58:00Z', proxima_tentativa_em: null, tentativas, texto: 'Oi', membro, ...extra });

const semEspera = { esperar: async () => undefined, agora: () => Date.UTC(2026, 9, 13, 12, 0) };

describe('esvaziarFila (§11.2)', () => {
  it('grava a sessão mesmo com o envio desligado e não envia nada', async () => {
    const { r, repositorio } = repo([item('a')], false);
    const enviar = vi.fn();
    const res = await esvaziarFila(repositorio, waha({ enviarTexto: enviar }), semEspera);
    expect(res.desligado).toBe(true);
    expect(r.situacao).toEqual(['WORKING']);
    expect(enviar).not.toHaveBeenCalled();
  });

  it('WAHA fora do ar: grava INACESSIVEL e não gasta tentativas', async () => {
    const { r, repositorio } = repo([item('a')]);
    const res = await esvaziarFila(repositorio, waha({ sessao: async () => ({ ok: false, erro: 'x' }) }), semEspera);
    expect(r.situacao).toEqual([WAHA_INACESSIVEL]);
    expect(res.enviadas).toBe(0);
    expect(r.falhas).toEqual([]);
  });

  it('resolve o chatId uma vez, guarda e envia; espera entre envios', async () => {
    const { r, repositorio } = repo([item('a'), item('b', { id: 'm2', whatsapp: '5561988887777', whatsapp_chat_id: '5561988887777@c.us' })]);
    const esperar = vi.fn(async () => undefined);
    const res = await esvaziarFila(repositorio, waha(), { ...semEspera, esperar, aleatorio: () => 0.5 });
    expect(res).toMatchObject({ enviadas: 2, falhas: 0 });
    expect(r.chatIds).toEqual([['m1', '556199924986@c.us']]);
    expect(r.enviadas).toEqual([{ id: 'a', wahaId: 'true_556199924986@c.us_ABC' }, { id: 'b', wahaId: 'true_556199924986@c.us_ABC' }]);
    expect(esperar).toHaveBeenCalledTimes(1);
    expect(esperar).toHaveBeenCalledWith(2000);
  });

  it('número fora do WhatsApp e membro sem número falham de vez', async () => {
    const { r, repositorio } = repo([item('a'), item('b', null)]);
    const res = await esvaziarFila(repositorio, waha({ verificarNumero: async () => ({ ok: true, existe: false, chatId: null }) }), semEspera);
    expect(res.definitivas).toBe(2);
    expect(r.falhas.map((f) => [f.id, f.status, f.erro])).toEqual([
      ['a', 'falhou', 'O número 5561999924986 não está no WhatsApp.'],
      ['b', 'falhou', 'Membro sem WhatsApp cadastrado.'],
    ]);
  });

  it('depois de uma queda longa, a mensagem velha vence e não sai, mesmo com a sessão caída', async () => {
    const ontem = item('a', undefined, 0, { tipo: 'cobranca', created_at: '2026-10-12T11:05:00Z' });
    const velha = item('b', undefined, 0, { tipo: 'confirmacao', created_at: '2026-10-12T20:00:00Z' });
    const nova = item('c');
    const { r, repositorio } = repo([ontem, velha, nova]);
    const enviar = vi.fn(async () => ({ ok: true as const, id: 'x' }));
    const caida = await esvaziarFila(repositorio, waha({ sessao: async () => ({ ok: false, erro: 'x' }), enviarTexto: enviar }), semEspera);
    expect(caida).toMatchObject({ vencidas: 2, enviadas: 0 });
    expect(r.falhas.map((f) => [f.id, f.status, f.erro])).toEqual([
      ['a', 'falhou', ERRO_VENCIDA],
      ['b', 'falhou', ERRO_VENCIDA],
    ]);
    expect(enviar).not.toHaveBeenCalled();
  });

  it('fora do horário de cobrança: cobrança é reagendada para as 7h; teste e confirmação saem', async () => {
    // Sábado 10h em Brasília: a próxima janela é segunda às 7h (10h UTC).
    const sabado = { ...semEspera, agora: () => Date.parse('2026-10-17T10:00:00-03:00') };
    const criada = '2026-10-17T12:59:00Z';
    const itens = [
      item('cob', undefined, 0, { tipo: 'cobranca_manual', created_at: criada }),
      item('teste', { id: 'm2', whatsapp: '5561988887777', whatsapp_chat_id: '5561988887777@c.us' }, 0, { tipo: 'teste', created_at: criada }),
      item('conf', { id: 'm2', whatsapp: '5561988887777', whatsapp_chat_id: '5561988887777@c.us' }, 0, { tipo: 'confirmacao', created_at: criada }),
    ];
    const { r, repositorio } = repo(itens);
    const res = await esvaziarFila(repositorio, waha(), sabado);
    expect(res).toMatchObject({ adiadas: 1, enviadas: 2 });
    expect(r.adiadas).toEqual([{ id: 'cob', para: '2026-10-19T10:00:00.000Z' }]);
    expect(r.enviadas.map((e) => e.id)).toEqual(['teste', 'conf']);
  });

  it('erro no envio volta para a fila com atraso; na 4ª tentativa, falhou', async () => {
    const { r, repositorio } = repo([item('a', undefined, 0), item('b', undefined, 3)]);
    await esvaziarFila(repositorio, waha({ enviarTexto: async () => ({ ok: false, erro: 'WAHA HTTP 500' }) }), semEspera);
    expect(r.falhas.map((f) => [f.id, f.status, f.tentativas])).toEqual([['a', 'pendente', 1], ['b', 'falhou', 4]]);
  });
});
