import { describe, expect, it } from 'vitest';
import { IT_REQUESTS_PATH, resolveNotificationTarget } from './itRequestLink';

describe('resolveNotificationTarget', () => {
  it('aviso de chamado de TI abre o modal do chamado citado', () => {
    expect(
      resolveNotificationTarget({ module: 'IT', title: 'Chamado atualizado', content: 'IT-089 mudou para Em andamento.', link: '/requests' }),
    ).toEqual({ path: IT_REQUESTS_PATH, state: { itTicketCode: 'IT-089', itTab: 'details' } });
  });

  it('aviso de sugestão da EVA que cita um chamado vai para a fila da EVA', () => {
    expect(
      resolveNotificationTarget({
        module: 'IT',
        title: 'Chamado do LAB-BRAIN para aprovar',
        content: 'IT-224 · Impressora da recepção aguarda a decisão de entrar no Kanban.',
        link: '/it/eva',
      }),
    ).toEqual({ path: '/it/eva' });
  });

  it('aviso do Kanban que cita um chamado continua abrindo o chamado', () => {
    expect(
      resolveNotificationTarget({ module: 'IT', title: 'IT-090 bloqueado', content: 'IT-090: aguardando peça.', link: '/it/kanban' }),
    ).toEqual({ path: IT_REQUESTS_PATH, state: { itTicketCode: 'IT-090', itTab: 'details' } });
  });

  it('link que só começa parecido com o da EVA não conta como EVA', () => {
    expect(
      resolveNotificationTarget({ module: 'IT', title: 'x', content: 'IT-091 mudou.', link: '/it/evaluation' }),
    ).toEqual({ path: IT_REQUESTS_PATH, state: { itTicketCode: 'IT-091', itTab: 'details' } });
  });

  it('fora do módulo IT vale o link gravado', () => {
    expect(resolveNotificationTarget({ module: 'billing', title: 'x', content: 'IT-1', link: '/faturamento' })).toEqual({ path: '/faturamento' });
  });
});
