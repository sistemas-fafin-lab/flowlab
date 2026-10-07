import { ProposalStatus } from '../types';

/**
 * Status de domínio de uma linha de `quotation_proposals`: a vencedora
 * (`is_winner`) vale como "selecionada"; fora isso só "rejeitada" importa.
 */
export const proposalStatusFromRow = (row: { is_winner: boolean | null; status: string | null }): ProposalStatus =>
  row.is_winner ? 'selected' : row.status === 'rejected' ? 'rejected' : 'submitted';
