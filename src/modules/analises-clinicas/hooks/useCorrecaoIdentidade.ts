import { useCallback, useState } from 'react';
import { buscarPacientes, chamarAcClinicasApi } from '../api';
import type { PacienteBuscaItem } from '../api';

/**
 * Correção de CPF / data de nascimento de paciente do LAB-HUB.
 *
 * Lá, os dois campos são imutáveis depois que a pessoa vincula a conta — foi a
 * trava que fechou o caminho pelo qual um paciente reescrevia o próprio CPF e
 * puxava o laudo de outro. Sobra o erro de digitação percebido depois: a
 * recepção digita errado no balcão, a pessoa se cadastra, e alguém nota meses
 * depois. Este é o único caminho de volta, e ele exige a conferência do
 * documento físico virando trilha permanente do outro lado.
 *
 * Tudo passa pelo proxy /api/analises-clinicas/* — a FLOWLAB_API_KEY é
 * server-side, o SPA não fala com o LAB-HUB direto. Quem autoriza é a sessão do
 * operador (permissão canCorrigirIdentidade); `autorizadoPor` é preenchido no
 * servidor a partir do perfil, não daqui.
 */

// Espelha CorrigirIdentidadeResposta de @lab-hub/shared. Contratos sincronizados
// à mão — não há pacote compartilhado entre os repos.
export interface CorrecaoIdentidadeResultado {
  correcaoId: string;
  pacienteId: string;
  cpfAnteriorMascarado: string;
  // Linhas do cache de laudos descartadas: foram buscadas nos LIS com o CPF
  // ANTIGO, então manter exibiria o histórico de outra pessoa. O próximo refresh
  // do paciente repovoa.
  laudosInvalidados: number;
  corrigidoEm: string;
}

export interface CorrecaoIdentidadeInput {
  pacienteId: string;
  cpf: string; // só dígitos
  dataNascimento: string; // YYYY-MM-DD
  motivo: string;
  documentoConferido: string;
}

interface UseCorrecaoIdentidadeResult {
  // Typeahead: mesmos pacientes do agendamento manual (CPF vem mascarado).
  buscarPacientes: (q: string) => Promise<PacienteBuscaItem[]>;
  corrigir: (
    input: CorrecaoIdentidadeInput,
  ) => Promise<{ erro: string } | { resultado: CorrecaoIdentidadeResultado }>;
  salvando: boolean;
}

export function useCorrecaoIdentidade(): UseCorrecaoIdentidadeResult {
  const [salvando, setSalvando] = useState(false);

  const corrigir = useCallback(
    async (input: CorrecaoIdentidadeInput) => {
      setSalvando(true);
      try {
        const body = await chamarAcClinicasApi<
          Partial<CorrecaoIdentidadeResultado> & { error?: string }
        >('corrigir-identidade', input, 'Não foi possível corrigir a identidade.');
        if (!body.correcaoId) {
          return { erro: body.error || 'Não foi possível corrigir a identidade.' };
        }
        return {
          resultado: {
            correcaoId: body.correcaoId,
            pacienteId: body.pacienteId ?? input.pacienteId,
            cpfAnteriorMascarado: body.cpfAnteriorMascarado ?? '—',
            laudosInvalidados: body.laudosInvalidados ?? 0,
            corrigidoEm: body.corrigidoEm ?? new Date().toISOString(),
          },
        };
      } catch (err) {
        if (err instanceof TypeError) {
          return { erro: 'Falha de conexão. Tente novamente.' };
        }
        return { erro: err instanceof Error ? err.message : 'Não foi possível corrigir a identidade.' };
      } finally {
        setSalvando(false);
      }
    },
    [],
  );

  return { buscarPacientes, corrigir, salvando };
}
