// Módulo Análises Clínicas — exports (escopo atual: agendamento + coleta)
export { default as AgendamentosPage } from './components/AgendamentosPage';
export { default as PostosPage } from './components/PostosPage';
export { default as PainelColetasPage } from './components/PainelColetasPage';
export { default as TemperaturaEquipamentosPage } from './components/TemperaturaEquipamentosPage';
export { default as CulturasPage } from './components/CulturasPage';
export { default as IndicadoresPage } from './components/IndicadoresPage';
export { useAgendamentos } from './hooks/useAgendamentos';
export { usePostos } from './hooks/usePostos';
export { useColetas } from './hooks/useColetas';
export { useTemperaturas } from './hooks/useTemperaturas';
export { useCulturas } from './hooks/useCulturas';
export { useAcIndicadores } from './hooks/useAcIndicadores';
export { useDocumentosAgendamento } from './hooks/useDocumentosAgendamento';
export {
  CHECKLIST_RECEPCAO,
  TIPOS_NO_CHECKLIST,
  TIPOS_EQUIPAMENTO,
  STATUS_CULTURA,
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
  TipoDocumento,
  DocumentoCheckin,
} from './types';
