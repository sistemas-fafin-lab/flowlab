import { describe, expect, it } from 'vitest';
import { mensagemDoErro } from './mensagemDoErro';

describe('mensagemDoErro', () => {
  it('lê o erro do Supabase, que é um objeto simples, com o código', () => {
    const erro = { code: '42501', details: null, hint: null, message: 'new row violates row-level security policy for table "payment_requests"' };
    expect(mensagemDoErro(erro, 'padrão')).toBe('new row violates row-level security policy for table "payment_requests" (código 42501)');
  });

  it('lê um Error', () => {
    expect(mensagemDoErro(new Error('Essa pessoa não autoriza os pagamentos do departamento RH.'), 'padrão')).toBe(
      'Essa pessoa não autoriza os pagamentos do departamento RH.',
    );
  });

  it('cai no texto padrão quando não há mensagem', () => {
    expect(mensagemDoErro({ code: 'x' }, 'padrão')).toBe('padrão');
    expect(mensagemDoErro('falhou', 'padrão')).toBe('padrão');
    expect(mensagemDoErro(null, 'padrão')).toBe('padrão');
  });
});
