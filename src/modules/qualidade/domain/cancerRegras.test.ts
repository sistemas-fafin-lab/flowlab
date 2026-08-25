import { describe, expect, it } from 'vitest';
import {
  avaliarCandidaturaCancer,
  calcularFunil,
  combinarCandidaturas,
  elegivelParaExportacao,
  parametrosFixosPendentes,
  sugerirMorfologia,
  sugerirTopografia,
  type ColunasFixasExportacaoCancer,
} from '../../../../api/_lib/qualidade/cancerRegras.js';

describe('calcularFunil', () => {
  it('conta as 5 etapas + retificação pendente separadamente (R8)', () => {
    const casos = [
      { triagem: 'pendente', cidoTopografiaCodigo: null, cidoMorfologiaCodigo: null, exportacaoId: null, revisaoPendente: false },
      { triagem: 'nao_cancer', cidoTopografiaCodigo: null, cidoMorfologiaCodigo: null, exportacaoId: null, revisaoPendente: false },
      {
        triagem: 'cancer_confirmado',
        cidoTopografiaCodigo: 'C50',
        cidoMorfologiaCodigo: '80903',
        exportacaoId: 'exp-1',
        revisaoPendente: true,
      },
    ] as const;
    expect(calcularFunil(casos)).toEqual({
      universo: 3,
      triados: 2,
      confirmados: 1,
      classificados: 1,
      exportados: 1,
      retificacaoPendente: 1,
    });
  });
});

describe('elegivelParaExportacao', () => {
  it('só confirmado + 2 códigos + não exportado', () => {
    expect(
      elegivelParaExportacao({ triagem: 'cancer_confirmado', cidoTopografiaCodigo: 'C50', cidoMorfologiaCodigo: '80903', exportacaoId: null }),
    ).toBe(true);
    expect(
      elegivelParaExportacao({ triagem: 'cancer_confirmado', cidoTopografiaCodigo: null, cidoMorfologiaCodigo: '80903', exportacaoId: null }),
    ).toBe(false);
    expect(
      elegivelParaExportacao({ triagem: 'cancer_confirmado', cidoTopografiaCodigo: 'C50', cidoMorfologiaCodigo: '80903', exportacaoId: 'exp-1' }),
    ).toBe(false);
  });
});

describe('avaliarCandidaturaCancer / combinarCandidaturas', () => {
  const catalogo = [{ codigo: '80903', descricao: 'Carcinoma ductal infiltrante' }];

  it('código CID-O bate exato: candidato de alta confiança', () => {
    const resultado = avaliarCandidaturaCancer({ codInternacionalDiagnostico: 'M-80903', textoLaudo: null }, catalogo);
    expect(resultado.candidato).toBe(true);
    expect(resultado.confianca).toBe('alta');
  });

  it('só o texto do laudo bate por descrição: confiança média', () => {
    const resultado = avaliarCandidaturaCancer(
      { codInternacionalDiagnostico: null, textoLaudo: 'achado compatível com carcinoma ductal infiltrante' },
      catalogo,
    );
    expect(resultado.candidato).toBe(true);
    expect(resultado.confianca).toBe('media');
  });

  it('sem nenhum indício: não é candidato', () => {
    const resultado = avaliarCandidaturaCancer({ codInternacionalDiagnostico: null, textoLaudo: 'tecido normal' }, catalogo);
    expect(resultado.candidato).toBe(false);
    expect(resultado.confianca).toBeNull();
  });

  it('combinarCandidaturas prefere a maior confiança entre várias avaliações', () => {
    const combinado = combinarCandidaturas([
      { candidato: true, confianca: 'media', indicadores: ['a'] },
      { candidato: true, confianca: 'alta', indicadores: ['b'] },
    ]);
    expect(combinado.confianca).toBe('alta');
  });
});

describe('sugerirMorfologia / sugerirTopografia', () => {
  it('sugere morfologia só por correspondência exata de código (nunca "quase bate")', () => {
    const catalogo = [{ codigo: '80903', descricao: 'Carcinoma ductal infiltrante' }];
    expect(sugerirMorfologia({ codInternacionalDiagnostico: 'M-80903' }, catalogo)?.codigo).toBe('80903');
    expect(sugerirMorfologia({ codInternacionalDiagnostico: 'M-99999' }, catalogo)).toBeNull();
  });

  it('sugere topografia por descrição normalizada, sem correspondência clara não sugere nada', () => {
    const catalogo = [{ codigo: 'C50', descricao: 'Mama' }];
    expect(sugerirTopografia({ descricaoTopografiaLis: 'MAMA' }, catalogo)?.codigo).toBe('C50');
    expect(sugerirTopografia({ descricaoTopografiaLis: 'pulmão' }, catalogo)).toBeNull();
  });
});

describe('parametrosFixosPendentes', () => {
  const completos: ColunasFixasExportacaoCancer = {
    cnes: '3744221',
    fonte: 'Laboratório X',
    regiaoAdministrativa: '01',
    municipio: '530010',
    estado: 'DF',
    naturalidadeFixa: '10',
    nacionalidadeFixa: '1',
    corIgnorado: '9',
    enderecoCodigo: '0',
    profissaoCodigo: '0',
    meioDiagnostico: '1',
    extensao: '1',
    casoRaro: '2',
    estadoCivilIgnorado: '9',
    escolaridadeIgnorado: '9',
  };

  it('sem nenhum campo vazio nem placeholder: lista vazia (exportação liberada)', () => {
    expect(parametrosFixosPendentes(completos)).toEqual([]);
  });

  it('campo com valor placeholder (issue 11) entra na lista de pendentes', () => {
    const pendentes = parametrosFixosPendentes({ ...completos, fonte: 'PLACEHOLDER — preencher com o valor real (ver issue 11)' });
    expect(pendentes).toEqual(['fonte']);
  });

  it('campo em branco (\'\') é tratado como pendente, igual a um placeholder', () => {
    const pendentes = parametrosFixosPendentes({ ...completos, estado: '' });
    expect(pendentes).toEqual(['estado']);
  });

  it('lista todas as chaves pendentes, não só a primeira', () => {
    const pendentes = parametrosFixosPendentes({ ...completos, municipio: '', estado: 'PLACEHOLDER — x' });
    expect(pendentes).toEqual(['municipio', 'estado']);
  });
});
