import React from 'react';
import type { Colaborador } from '../../types';

interface GestorSectionProps {
  colaborador: Colaborador;
  colaboradores: Colaborador[];
  onDefinirGestor: (colaboradorId: string, gestorId: string | null) => Promise<string | null>;
}

// TODO(issue 04): buscar/selecionar gestor, bloqueando auto-referência e ciclos.
const GestorSection: React.FC<GestorSectionProps> = ({ colaborador }) => {
  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Gestor</h3>
      <p className="text-sm text-gray-400 dark:text-gray-500">{colaborador.gestor ? colaborador.gestor.nome : 'Sem gestor definido'}</p>
    </section>
  );
};

export default GestorSection;
