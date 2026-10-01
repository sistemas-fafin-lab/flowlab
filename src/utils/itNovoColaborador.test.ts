import { describe, expect, it } from 'vitest';
import {
  NOVO_COLABORADOR_VAZIO,
  montarDescricaoNovoColaborador,
  montarTituloNovoColaborador,
  validarNovoColaborador,
  type NovoColaboradorForm,
} from './itNovoColaborador';

const preenchido: NovoColaboradorForm = {
  nomeCompleto: '  Fulano da Silva ',
  cpf: '529.982.247-25',
  emailContato: 'fulano@gmail.com',
  setor: 'FATURAMENTO',
  setorOutro: '',
  cargo: 'Assistente de faturamento',
  atribuicoesAplis: 'Lançar guias\nConferir lotes',
  caixaEmailPropria: false,
};

describe('validarNovoColaborador', () => {
  it('aceita um formulário completo e válido', () => {
    expect(validarNovoColaborador(preenchido)).toEqual({});
  });

  it('exige todos os campos de texto', () => {
    const erros = validarNovoColaborador(NOVO_COLABORADOR_VAZIO);
    expect(Object.keys(erros).sort()).toEqual(
      ['atribuicoesAplis', 'cargo', 'cpf', 'emailContato', 'nomeCompleto', 'setor'].sort(),
    );
  });

  it('recusa CPF com dígito verificador errado', () => {
    expect(validarNovoColaborador({ ...preenchido, cpf: '529.982.247-26' }).cpf).toBeDefined();
  });

  it('recusa e-mail sem formato válido', () => {
    expect(validarNovoColaborador({ ...preenchido, emailContato: 'fulano@' }).emailContato).toBeDefined();
  });

  it('exige o nome do setor quando escolhido "Outro"', () => {
    expect(validarNovoColaborador({ ...preenchido, setor: 'OUTRO', setorOutro: ' ' }).setorOutro).toBeDefined();
    expect(validarNovoColaborador({ ...preenchido, setor: 'OUTRO', setorOutro: 'Logística' })).toEqual({});
  });
});

describe('montarTituloNovoColaborador', () => {
  it('usa o nome completo sem espaços nas pontas', () => {
    expect(montarTituloNovoColaborador(preenchido)).toBe('Novo colaborador — Fulano da Silva');
  });
});

describe('montarDescricaoNovoColaborador', () => {
  it('monta o texto padronizado com CPF mascarado e o rótulo do setor', () => {
    expect(montarDescricaoNovoColaborador({ ...preenchido, cpf: '52998224725' })).toBe(
      [
        '**Novo colaborador**',
        'Nome completo: Fulano da Silva',
        'CPF: 529.982.247-25',
        'E-mail de contato: fulano@gmail.com',
        'Setor: Faturamento',
        'Cargo/função: Assistente de faturamento',
        'Caixa de e-mail própria: Não (alias do setor)',
        '',
        'Atribuições no apLIS:',
        'Lançar guias\nConferir lotes',
      ].join('\n'),
    );
  });

  it('usa o setor digitado quando "Outro" e indica caixa própria', () => {
    const texto = montarDescricaoNovoColaborador({
      ...preenchido,
      setor: 'OUTRO',
      setorOutro: ' Logística ',
      caixaEmailPropria: true,
    });
    expect(texto).toContain('Setor: Logística\n');
    expect(texto).toContain('Caixa de e-mail própria: Sim\n');
  });
});
