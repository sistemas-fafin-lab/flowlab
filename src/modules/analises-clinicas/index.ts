// Módulo Análises Clínicas — exports (escopo atual: agendamento + coleta)
export { default as AgendamentosPage } from './components/AgendamentosPage';
export { default as PostosPage } from './components/PostosPage';
export { default as PainelColetasPage } from './components/PainelColetasPage';
export { default as TemperaturaEquipamentosPage } from './components/TemperaturaEquipamentosPage';
export { default as CulturasPage } from './components/CulturasPage';
export { default as RecoletasPage } from './components/RecoletasPage';
export { default as LaudosPage } from './components/LaudosPage';
export { default as IndicadoresPage } from './components/IndicadoresPage';
export { default as EnvioApoioPage } from './components/EnvioApoioPage';
export { useAgendamentos } from './hooks/useAgendamentos';
export { usePostos } from './hooks/usePostos';
export { useColetas } from './hooks/useColetas';
export { useTemperaturas } from './hooks/useTemperaturas';
export { useCulturas } from './hooks/useCulturas';
export { useRecoletas } from './hooks/useRecoletas';
export { useLaudos } from './hooks/useLaudos';
export { useAcIndicadores } from './hooks/useAcIndicadores';
export { useDocumentosAgendamento } from './hooks/useDocumentosAgendamento';
export { useApoioFila } from './hooks/useApoioFila';
export { useApoioCatalogo } from './hooks/useApoioCatalogo';
export {
  CHECKLIST_RECEPCAO,
  TIPOS_NO_CHECKLIST,
  TIPOS_EQUIPAMENTO,
  STATUS_CULTURA,
  STATUS_RECOLETA,
  STATUS_LAUDO,
  MOTIVOS_RECOLETA,
  STATUS_APOIO_FILA,
} from './types';
export type {
  AcAgendamento,
  AcAgendamentoStatus,
  AcPosto,
  AcDiaExcecao,
  AcCheckin,
  AcColeta,
  AcColetaInsumo,
  CheckinResultado,
  ChecklistItemKey,
  InsumoInput,
  AcEquipamento,
  AcTemperatura,
  EquipamentoTipo,
  AcExame,
  AcAgendamentoExame,
  AcCulturaEtapa,
  CulturaStatus,
  AcCultura,
  RecoletaStatus,
  RecoletaMotivo,
  AcRecoleta,
  LaudoStatus,
  AcLaudo,
  TipoDocumento,
  DocumentoCheckin,
  ApoioFilaStatus,
  ApoioExameCatalogo,
  ApoioExameExtraido,
  ApoioFilaItem,
  ApoioPipelineResult,
  ApoioTransferResultado,
} from './types';
