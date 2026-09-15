import React from 'react';
import type { Colaborador } from '../../types';

interface VinculoUsuarioSectionProps {
  colaborador: Colaborador;
  onVincular: (colaboradorId: string, userProfileId: string) => Promise<string | null>;
  onDesvincular: (colaboradorId: string) => Promise<string | null>;
}

// TODO(issue 03): buscar/selecionar user_profile e vincular/desvincular.
const VinculoUsuarioSection: React.FC<VinculoUsuarioSectionProps> = ({ colaborador }) => {
  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Usuário do sistema</h3>
      <p className="text-sm text-gray-400 dark:text-gray-500">
        {colaborador.usuarioVinculado ? colaborador.usuarioVinculado.nome : 'Sem usuário vinculado'}
      </p>
    </section>
  );
};

export default VinculoUsuarioSection;
