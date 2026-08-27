import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  avaliarRespostaAol,
  dataParaIso,
  extrairDadosXmlEnvio,
  extrairIdAlvaro,
  injetarCredenciais,
} from './xmlAol.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

// String que o fast-xml-parser não consegue parsear (atributo sem aspas de fechamento) —
// usada para exercitar de fato os branches de `catch` de avaliarRespostaAol/extrairDadosXmlEnvio.
const XML_NAO_PARSEAVEL = '<a attr="unterminated>texto</a>';

describe('dataParaIso', () => {
  it('converte DD/MM/AAAA para AAAA-MM-DD', () => {
    expect(dataParaIso('05/03/2024')).toBe('2024-03-05');
  });

  it('mantém AAAA-MM-DD já no formato certo', () => {
    expect(dataParaIso('2024-03-05')).toBe('2024-03-05');
  });

  it('ignora a parte de hora e converte só a data', () => {
    expect(dataParaIso('05/03/2024 14:30:00')).toBe('2024-03-05');
  });

  it('devolve null para entrada irreconhecível', () => {
    expect(dataParaIso('não é uma data')).toBeNull();
    expect(dataParaIso('')).toBeNull();
    expect(dataParaIso(null)).toBeNull();
    expect(dataParaIso(undefined)).toBeNull();
  });
});

describe('injetarCredenciais', () => {
  it('com AOL_SENHA setada, substitui senha=, idagente= e chave=', () => {
    vi.stubEnv('AOL_SENHA', 'segredo123');
    vi.stubEnv('AOL_IDAGENTE', 'AGENTE9');
    vi.stubEnv('AOL_CHAVE', 'CHAVE9');

    const xml =
      '<solicitacoes idagente="__ENV__" senha="__ENV__"><entidade chave="__ENV__"/></solicitacoes>';
    const resultado = injetarCredenciais(xml);

    expect(resultado).toContain('senha="segredo123"');
    expect(resultado).toContain('idagente="AGENTE9"');
    expect(resultado).toContain('chave="CHAVE9"');
    expect(resultado).not.toContain('__ENV__');
  });

  it('sem AOL_SENHA configurada, devolve o XML inalterado (caso perigoso: placeholder vaza pro envio real)', () => {
    vi.stubEnv('AOL_SENHA', '');
    vi.stubEnv('AOL_IDAGENTE', 'AGENTE9');
    vi.stubEnv('AOL_CHAVE', 'CHAVE9');

    const xml = '<solicitacoes idagente="__ENV__" senha="__ENV__"/>';
    expect(injetarCredenciais(xml)).toBe(xml);
  });
});

describe('avaliarRespostaAol', () => {
  it('HTTP fora de 2xx retorna ok:false', () => {
    expect(avaliarRespostaAol('qualquer coisa', 404)).toEqual({ ok: false, erro: 'HTTP 404' });
    expect(avaliarRespostaAol('qualquer coisa', 500)).toEqual({ ok: false, erro: 'HTTP 500' });
  });

  it('corpo vazio retorna ok:false', () => {
    expect(avaliarRespostaAol('', 200)).toEqual({ ok: false, erro: 'Resposta vazia do webservice' });
    expect(avaliarRespostaAol('   ', 200)).toEqual({ ok: false, erro: 'Resposta vazia do webservice' });
  });

  it('XML inválido sem incluido="false" no texto é tratado como sucesso silencioso (comportamento surpreendente)', () => {
    expect(avaliarRespostaAol(XML_NAO_PARSEAVEL, 200)).toEqual({ ok: true, erro: '' });
  });

  it('XML inválido mas com incluido="false" solto no texto ainda é detectado via regex no catch', () => {
    const naoParseavel = '<solicitacoes incluido="false"';
    expect(avaliarRespostaAol(naoParseavel, 200)).toEqual({
      ok: false,
      erro: 'Webservice retornou incluido=false',
    });
  });

  it('incluido="false" (XML válido) retorna erro com idLis', () => {
    const xml = '<solicitacoes><solicitacao idLis="REQ-42" incluido="false" informacao="motivo x"/></solicitacoes>';
    expect(avaliarRespostaAol(xml, 200)).toEqual({
      ok: false,
      erro: 'Solicitacao REQ-42: motivo x',
    });
  });

  it('amostra com informacao preenchida gera erro por amostra mesmo com solicitacao incluida', () => {
    const xml = `<solicitacoes><solicitacao idLis="REQ-1" incluido="true">
      <amostra idAmostra="AM-1" informacao="material insuficiente"/>
    </solicitacao></solicitacoes>`;
    expect(avaliarRespostaAol(xml, 200)).toEqual({
      ok: false,
      erro: 'Amostra AM-1: material insuficiente',
    });
  });

  it('múltiplas falhas trunca em 3 e adiciona sufixo (+N detalhe(s))', () => {
    const xml = `<solicitacoes>
      <solicitacao idLis="A" incluido="true"><amostra idAmostra="1" informacao="erro1"/></solicitacao>
      <solicitacao idLis="B" incluido="true"><amostra idAmostra="2" informacao="erro2"/></solicitacao>
      <solicitacao idLis="C" incluido="true"><amostra idAmostra="3" informacao="erro3"/></solicitacao>
      <solicitacao idLis="D" incluido="true"><amostra idAmostra="4" informacao="erro4"/></solicitacao>
    </solicitacoes>`;
    const resultado = avaliarRespostaAol(xml, 200);
    expect(resultado.ok).toBe(false);
    expect(resultado.erro).toBe('Amostra 1: erro1; Amostra 2: erro2; Amostra 3: erro3 (+1 detalhe(s))');
  });

  it('sem nó solicitacao no XML válido, considera sucesso', () => {
    expect(avaliarRespostaAol('<outraCoisa><x/></outraCoisa>', 200)).toEqual({ ok: true, erro: '' });
  });
});

describe('extrairIdAlvaro', () => {
  it('extrai idAlvaro de XML válido', () => {
    const xml = '<solicitacoes><solicitacao idAlvaro="OS-777"/></solicitacoes>';
    expect(extrairIdAlvaro(xml)).toBe('OS-777');
  });

  it('XML inválido mas com idAlvaro="..." solto no texto usa o fallback regex', () => {
    const naoParseavel = '<a attr="unterminated>lixo idAlvaro="OS-999" mais lixo</a>';
    expect(extrairIdAlvaro(naoParseavel)).toBe('OS-999'); // não usa XML_NAO_PARSEAVEL: precisa do idAlvaro embutido
  });

  it('resposta vazia devolve string vazia', () => {
    expect(extrairIdAlvaro('')).toBe('');
    expect(extrairIdAlvaro('   ')).toBe('');
  });

  it('XML válido sem o atributo idAlvaro devolve string vazia', () => {
    const xml = '<solicitacoes><solicitacao idLis="REQ-1"/></solicitacoes>';
    expect(extrairIdAlvaro(xml)).toBe('');
  });
});

describe('extrairDadosXmlEnvio', () => {
  it('lê paciente e solicitacao de um XML completo', () => {
    const xml = `<solicitacoes>
      <paciente nome="JOAO DA SILVA" datanasc="1990-01-01"/>
      <solicitacao codigolis="SOL-42" dataColeta="2026-08-27T00:00:00.000-03:00"/>
    </solicitacoes>`;
    expect(extrairDadosXmlEnvio(xml)).toEqual({
      codigo_lis: 'SOL-42',
      nome: 'JOAO DA SILVA',
      datanasc: '1990-01-01',
      data_coleta: '2026-08-27T00:00:00.000-03:00',
    });
  });

  it('XML vazio devolve objeto com campos vazios', () => {
    expect(extrairDadosXmlEnvio('')).toEqual({
      codigo_lis: '',
      nome: '',
      datanasc: '',
      data_coleta: '',
    });
  });

  it('XML inválido (não parseável) devolve objeto com campos vazios', () => {
    expect(extrairDadosXmlEnvio(XML_NAO_PARSEAVEL)).toEqual({
      codigo_lis: '',
      nome: '',
      datanasc: '',
      data_coleta: '',
    });
  });
});
