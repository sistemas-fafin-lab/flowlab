// Módulo Análises Clínicas — exports (escopo atual: agendamento + coleta)
export { default as AgendamentosPage } from './components/AgendamentosPage';
export { default as PostosPage } from './components/PostosPage';
export { default as PainelColetasPage } from './components/PainelColetasPage';
export { default as TemperaturaEquipamentosPage } from './components/TemperaturaEquipamentosPage';
export { useAgendamentos } from './hooks/useAgendamentos';
export { usePostos } from './hooks/usePostos';
export { useColetas } from './hooks/useColetas';
export { useTemperaturas } from './hooks/useTemperaturas';
export {
  CHECKLIST_RECEPCAO,
  TIPOS_EQUIPAMENTO,
} from './types';
export type {
  AcAgendamento,
  AcAgendamentoStatus,
  AcPosto,
  AcHorarioItem,
  AcHorarioPadrao,
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
} from './types';
