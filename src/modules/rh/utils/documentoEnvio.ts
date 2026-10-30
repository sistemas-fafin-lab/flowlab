import type { TipoDocumento } from '../types';
import { dataDeHojeISO, validarDataNaoFutura } from './colaboradorFormato';

/** Mesmo limite do bucket colaborador-documentos (file_size_limit). */
export const TAMANHO_MAXIMO_DOCUMENTO = 20 * 1024 * 1024;

export interface EnvioDocumentoForm {
  arquivo: Pick<File, 'name' | 'type' | 'size'> | null;
  tipo: TipoDocumento | '';
  nomeOutro: string;
  /** "YYYY-MM-DD" */
  dataAssinatura: string;
}

export type ErrosEnvioDocumento = Partial<Record<'arquivo' | 'tipo' | 'nomeOutro' | 'dataAssinatura', string>>;

/** PDF pelo MIME ou, quando o navegador não informa o tipo, pela extensão. */
export const ehPdf = (arquivo: Pick<File, 'name' | 'type'>): boolean =>
  arquivo.type === 'application/pdf' || (!arquivo.type && /\.pdf$/i.test(arquivo.name));

/** Só a checagem do arquivo — usada ao selecionar, antes de validar o resto do formulário. */
export const validarArquivoDocumento = (arquivo: EnvioDocumentoForm['arquivo']): string | null => {
  if (!arquivo) return 'Selecione o arquivo do documento.';
  if (!ehPdf(arquivo)) return 'Envie o documento em PDF.';
  if (arquivo.size > TAMANHO_MAXIMO_DOCUMENTO) return 'O arquivo deve ter no máximo 20 MB.';
  return null;
};

/** Erros por campo do formulário de envio; objeto vazio quando está tudo certo. */
export const validarEnvioDocumento = (form: EnvioDocumentoForm, hoje: string = dataDeHojeISO()): ErrosEnvioDocumento => {
  const erros: ErrosEnvioDocumento = {};
  const erroArquivo = validarArquivoDocumento(form.arquivo);
  if (erroArquivo) erros.arquivo = erroArquivo;
  if (!form.tipo) erros.tipo = 'Selecione o tipo do documento.';
  if (form.tipo === 'outro' && !form.nomeOutro.trim()) erros.nomeOutro = 'Informe o nome do documento.';
  if (!form.dataAssinatura) erros.dataAssinatura = 'Informe a data de assinatura.';
  else {
    const erroData = validarDataNaoFutura(form.dataAssinatura, 'Data de assinatura', hoje);
    if (erroData) erros.dataAssinatura = erroData;
  }
  return erros;
};
