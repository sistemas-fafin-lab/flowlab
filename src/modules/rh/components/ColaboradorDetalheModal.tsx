import React from 'react';
import { User } from 'lucide-react';
import DetailModal from '../../../components/DetailModal';
import EditarCadastroSection from './sections/EditarCadastroSection';
import VinculoUsuarioSection from './sections/VinculoUsuarioSection';
import GestorSection from './sections/GestorSection';
import type { AtualizarCadastroInput, Colaborador } from '../types';

interface ColaboradorDetalheModalProps {
  colaborador: Colaborador;
  colaboradores: Colaborador[];
  onClose: () => void;
  atualizarCadastro: (id: string, dados: AtualizarCadastroInput) => Promise<string | null>;
  vincularUsuario: (colaboradorId: string, userProfileId: string) => Promise<string | null>;
  desvincularUsuario: (colaboradorId: string) => Promise<string | null>;
  definirGestor: (colaboradorId: string, gestorId: string | null) => Promise<string | null>;
}

const ColaboradorDetalheModal: React.FC<ColaboradorDetalheModalProps> = ({
  colaborador,
  colaboradores,
  onClose,
  atualizarCadastro,
  vincularUsuario,
  desvincularUsuario,
  definirGestor,
}) => {
  return (
    <DetailModal title={colaborador.nome} icon={<User className="w-5 h-5 text-white" />} onClose={onClose}>
      <div className="space-y-6">
        <EditarCadastroSection colaborador={colaborador} onSalvar={atualizarCadastro} />
        <VinculoUsuarioSection
          colaborador={colaborador}
          onVincular={vincularUsuario}
          onDesvincular={desvincularUsuario}
        />
        <GestorSection colaborador={colaborador} colaboradores={colaboradores} onDefinirGestor={definirGestor} />
      </div>
    </DetailModal>
  );
};

export default ColaboradorDetalheModal;
