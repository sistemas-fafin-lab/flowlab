import React from 'react';
import type { AtualizarCadastroInput, Colaborador } from '../../types';

interface EditarCadastroSectionProps {
  colaborador: Colaborador;
  onSalvar: (id: string, dados: AtualizarCadastroInput) => Promise<string | null>;
}

// TODO(issue 02): formulário de edição de cargo/data_admissao/matricula/departamento.
const EditarCadastroSection: React.FC<EditarCadastroSectionProps> = ({ colaborador }) => {
  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Dados cadastrais</h3>
      <p className="text-sm text-gray-400 dark:text-gray-500">Cargo: {colaborador.cargo || '—'}</p>
    </section>
  );
};

export default EditarCadastroSection;
