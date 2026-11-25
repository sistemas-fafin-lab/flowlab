import { describe, expect, it } from 'vitest';
import { montarPromptPedidoMedico } from './promptPedidoMedico.js';

describe('montarPromptPedidoMedico', () => {
  const prompt = montarPromptPedidoMedico(['HEMOGRAMA COMPLETO', 'LIPOPROTEÍNA - a']);

  it('só aceita matched para o mesmo exame e proíbe escolher por proximidade', () => {
    expect(prompt).toMatch(/SOMENTE quando o exame do pedido for o MESMO exame/);
    expect(prompt).toMatch(/NUNCA escolha um exame diferente por parecer próximo/);
    expect(prompt).not.toMatch(/mais próximo/i);
  });

  it('pede relacionados e tipo para os exames sem matched', () => {
    expect(prompt).toContain('"relacionados"');
    expect(prompt).toMatch(/"variante"/);
    expect(prompt).toMatch(/"generico"/);
  });

  it('separa linhas com mais de um exame', () => {
    expect(prompt).toMatch(/liste CADA exame separadamente/);
  });

  it('trata material ou analito diferente como outro exame', () => {
    expect(prompt).toMatch(/Material diferente .* ou outro analito é OUTRO exame/);
  });

  it('pede o nome do paciente, e não o do médico, com ou sem lista de exames', () => {
    const semLista = montarPromptPedidoMedico([]);
    for (const texto of [prompt, semLista]) {
      expect(texto).toContain('"paciente"');
    }
    expect(prompt).toMatch(/nome do paciente como está no pedido \(não o nome do médico/);
    // O ramo com lista repete a estrutura do JSON: o campo precisa estar nela também.
    expect(prompt.split('"paciente"').length - 1).toBeGreaterThanOrEqual(3);
  });

  it('inclui a lista de exames', () => {
    expect(prompt).toContain('HEMOGRAMA COMPLETO\nLIPOPROTEÍNA - a');
  });

  it('sem lista, não cita procedimentos disponíveis ao final', () => {
    expect(montarPromptPedidoMedico([])).not.toContain('Lista de procedimentos disponíveis');
  });
});
