import { describe, expect, it } from 'vitest';
import { HISTORICO_ENVIADO, historicoParaEnvio, mensagemInicial } from './chatReplies';

describe('abertura do chat (issue 16)', () => {
  const manha = new Date('2026-10-13T12:00:00Z'); // 09:00 em Brasília

  it('com reunião analisada, diz a data dela', () => {
    expect(mensagemInicial('Ana', '2026-10-10T20:00:00Z', manha)).toMatch(/^Bom dia, Ana\. Li o board e a última reunião \(10\/10\)\./);
  });

  it('sem reunião, só o board; nunca promete agir sozinha', () => {
    const t = mensagemInicial('', null, manha);
    expect(t).toMatch(/^Bom dia\. Li o board\./);
    expect(t).toContain('nada muda sem aprovação');
  });
});

describe('historicoParaEnvio', () => {
  it('manda só as últimas mensagens, sem as falhas, no formato da ação', () => {
    const msgs = [
      ...Array.from({ length: 8 }, (_, i) => ({ from: (i % 2 ? 'eva' : 'me') as 'eva' | 'me', text: `m${i}` })),
      { from: 'eva' as const, text: 'limite', falhou: true },
    ];
    const h = historicoParaEnvio(msgs);
    expect(h).toHaveLength(HISTORICO_ENVIADO);
    expect(h[0]).toEqual({ de: 'eu', texto: 'm2' });
    expect(h.some((m) => m.texto === 'limite')).toBe(false);
  });
});
