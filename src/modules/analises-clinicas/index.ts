// Módulo Análises Clínicas — exports (escopo atual: agendamento)
export { default as AgendamentosPage } from './components/AgendamentosPage';
export { default as PostosPage } from './components/PostosPage';
export { useAgendamentos } from './hooks/useAgendamentos';
export { usePostos } from './hooks/usePostos';
export type {
  AcAgendamento,
  AcAgendamentoStatus,
  AcPosto,
  AcHorarioItem,
  AcHorarioPadrao,
  AcDiaExcecao,
} from './types';
