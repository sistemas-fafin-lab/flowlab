import type { DocumentoAssinado, TipoDocumento } from '../types';

/** Rótulos dos tipos de documento assinado, na ordem do select de envio ("Outro" por último). */
export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumento, string> = {
  contrato_trabalho: 'Contrato individual de trabalho',
  termo_confidencialidade_lgpd: 'Termo de confidencialidade e proteção de dados (LGPD)',
  acordo_compensacao_horas: 'Acordo de compensação de horas',
  termo_responsabilidade_equipamentos: 'Termo de responsabilidade por equipamentos',
  adesao_plano_odontologico: 'Adesão ao plano odontológico',
  autorizacao_uso_imagem: 'Autorização de uso de imagem',
  aditivo_contratual: 'Aditivo contratual',
  termo_rescisao: 'Termo de rescisão do contrato de trabalho',
  outro: 'Outro',
};

export const TIPOS_DOCUMENTO = Object.keys(TIPO_DOCUMENTO_LABEL) as TipoDocumento[];

/** Nome exibido do documento: o nome livre quando "Outro", senão o rótulo do tipo. */
export const nomeDocumento = (doc: Pick<DocumentoAssinado, 'tipo' | 'nomeOutro'>): string =>
  doc.tipo === 'outro' && doc.nomeOutro?.trim() ? doc.nomeOutro.trim() : TIPO_DOCUMENTO_LABEL[doc.tipo];
