import { describe, expect, it } from 'vitest';
import { quemAparece, resumoPapeis, travaDaChave, travaDoVoltar } from './permissoes';
import { SEM_PAPEIS } from './papeis';

const TUDO = { configura: true, gestor: true, aprova: true };
const pessoa = (id: string, o: Partial<Parameters<typeof travaDaChave>[0]> = {}) => ({
  id, origem: 'cargo' as const, papeis: SEM_PAPEIS, doCargo: SEM_PAPEIS, ...o,
});

describe('aba Permissões (D33)', () => {
  it('lista quem tem permissão, quem está definido aqui e o admin; os recém-escolhidos primeiro', () => {
    const pessoas = [
      pessoa('admin', { origem: 'admin', papeis: TUDO }),
      pessoa('pelo-cargo', { papeis: { ...SEM_PAPEIS, aprova: true }, doCargo: { ...SEM_PAPEIS, aprova: true } }),
      pessoa('definida-sem-nada', { origem: 'definido' }),
      pessoa('ninguem'),
      pessoa('escolhida-1'),
      pessoa('escolhida-2'),
    ];
    expect(quemAparece(pessoas, []).map((p) => p.id)).toEqual(['admin', 'pelo-cargo', 'definida-sem-nada']);
    expect(quemAparece(pessoas, ['escolhida-1', 'escolhida-2', 'some']).map((p) => p.id))
      .toEqual(['escolhida-2', 'escolhida-1', 'admin', 'pelo-cargo', 'definida-sem-nada']);
  });

  it('admin não se mexe; ninguém tira a própria permissão de configurar', () => {
    expect(travaDaChave(pessoa('a', { origem: 'admin', papeis: TUDO }), 'aprova', 'eu')).toMatch(/administrador/);
    expect(travaDaChave(pessoa('eu', { origem: 'definido', papeis: TUDO }), 'configura', 'eu')).toMatch(/própria/);
    expect(travaDaChave(pessoa('eu', { origem: 'definido', papeis: TUDO }), 'gestor', 'eu')).toBeNull();
    expect(travaDaChave(pessoa('outra', { papeis: TUDO }), 'configura', 'eu')).toBeNull();
  });

  it('voltar ao cargo: só para quem está definido aqui, e não para se trancar fora', () => {
    expect(travaDoVoltar(pessoa('x'), 'eu')).toMatch(/segue o cargo/);
    expect(travaDoVoltar(pessoa('eu', { origem: 'definido', papeis: TUDO }), 'eu')).toMatch(/seu acesso/);
    expect(travaDoVoltar(pessoa('eu', { origem: 'definido', papeis: TUDO, doCargo: { ...SEM_PAPEIS, configura: true } }), 'eu')).toBeNull();
    expect(travaDoVoltar(pessoa('outra', { origem: 'definido' }), 'eu')).toBeNull();
  });

  it('resumo em palavras', () => {
    expect(resumoPapeis(TUDO)).toBe('Configura, Gestor, Aprova');
    expect(resumoPapeis(SEM_PAPEIS)).toBe('nenhuma');
  });
});
