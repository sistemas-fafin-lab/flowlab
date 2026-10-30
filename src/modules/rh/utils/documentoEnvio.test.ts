import { describe, expect, it } from 'vitest';
import { TAMANHO_MAXIMO_DOCUMENTO, ehPdf, validarArquivoDocumento, validarEnvioDocumento, type EnvioDocumentoForm } from './documentoEnvio';
import { nomeDocumento } from './rotulosDocumentos';

const hoje = '2026-10-30';
const pdf = { name: 'contrato.pdf', type: 'application/pdf', size: 1024 };
const valido: EnvioDocumentoForm = { arquivo: pdf, tipo: 'acordo_compensacao_horas', nomeOutro: '', dataAssinatura: '2025-01-10' };

describe('ehPdf', () => {
  it('aceita pelo MIME', () => expect(ehPdf(pdf)).toBe(true));
  it('aceita pela extensão sem MIME', () => expect(ehPdf({ name: 'X.PDF', type: '' })).toBe(true));
  it('recusa docx', () =>
    expect(ehPdf({ name: 'a.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBe(false));
});

describe('validarArquivoDocumento', () => {
  it('exige arquivo', () => expect(validarArquivoDocumento(null)).toBe('Selecione o arquivo do documento.'));
  it('recusa não PDF', () => expect(validarArquivoDocumento({ name: 'a.docx', type: 'application/msword', size: 10 })).toBe('Envie o documento em PDF.'));
  it('recusa acima de 20 MB', () =>
    expect(validarArquivoDocumento({ ...pdf, size: TAMANHO_MAXIMO_DOCUMENTO + 1 })).toBe('O arquivo deve ter no máximo 20 MB.'));
  it('aceita exatamente 20 MB', () => expect(validarArquivoDocumento({ ...pdf, size: TAMANHO_MAXIMO_DOCUMENTO })).toBeNull());
});

describe('validarEnvioDocumento', () => {
  it('formulário válido', () => expect(validarEnvioDocumento(valido, hoje)).toEqual({}));
  it('exige tipo', () => expect(validarEnvioDocumento({ ...valido, tipo: '' }, hoje).tipo).toBe('Selecione o tipo do documento.'));
  it('Outro sem nome', () =>
    expect(validarEnvioDocumento({ ...valido, tipo: 'outro', nomeOutro: '   ' }, hoje).nomeOutro).toBe('Informe o nome do documento.'));
  it('Outro com nome', () => expect(validarEnvioDocumento({ ...valido, tipo: 'outro', nomeOutro: 'Termo de estágio' }, hoje)).toEqual({}));
  it('exige data', () => expect(validarEnvioDocumento({ ...valido, dataAssinatura: '' }, hoje).dataAssinatura).toBe('Informe a data de assinatura.'));
  it('aceita hoje', () => expect(validarEnvioDocumento({ ...valido, dataAssinatura: hoje }, hoje)).toEqual({}));
  it('recusa data futura', () =>
    expect(validarEnvioDocumento({ ...valido, dataAssinatura: '2026-10-31' }, hoje).dataAssinatura).toBe(
      'Data de assinatura não pode ser uma data futura.',
    ));
});

describe('nomeDocumento', () => {
  it('usa o rótulo do tipo', () => expect(nomeDocumento({ tipo: 'aditivo_contratual', nomeOutro: null })).toBe('Aditivo contratual'));
  it('usa o nome livre em Outro', () => expect(nomeDocumento({ tipo: 'outro', nomeOutro: ' Termo de estágio ' })).toBe('Termo de estágio'));
  it('Outro sem nome cai no rótulo', () => expect(nomeDocumento({ tipo: 'outro', nomeOutro: null })).toBe('Outro'));
});
