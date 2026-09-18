import React, { useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/permissions';
import EnviarHoleritesSection from './holerites/EnviarHoleritesSection';
import HoleritesEnviadosList, { type HoleritesEnviadosListRef } from './holerites/HoleritesEnviadosList';
import MeusHoleritesSection from './holerites/MeusHoleritesSection';

const HoleritesPage: React.FC = () => {
  const { userProfile } = useAuth();
  const podeGerenciar = hasPermission(userProfile?.permissions || [], 'canManageHolerites');
  // canViewAllHolerites (todos, sem escopo) e canViewHoleritesEquipe (só quem o
  // usuário gerencia, via gestor_id) são somente-leitura; canManageHolerites já
  // é um superset de ambas. O RLS de colaborador_holerites decide o recorte —
  // aqui só decidimos se a lista aparece e se vem com botão de remover/enviar.
  const temPermissaoVerTodos = hasPermission(userProfile?.permissions || [], 'canViewAllHolerites');
  const temPermissaoVerEquipe = hasPermission(userProfile?.permissions || [], 'canViewHoleritesEquipe');
  const podeVerLista = podeGerenciar || temPermissaoVerTodos || temPermissaoVerEquipe;
  const listaRef = useRef<HoleritesEnviadosListRef>(null);

  if (!podeVerLista) {
    return (
      <div className="space-y-6">
        <div className="animate-fade-in-up">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
            Holerites
          </h2>
          <p className="text-gray-500 dark:text-gray-400">Seus holerites mensais</p>
        </div>
        <MeusHoleritesSection />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-96px)] lg:h-[calc(100vh-24px)]">
      <div className="animate-fade-in-up shrink-0">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
          Holerites
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          {podeGerenciar
            ? 'Envio consolidado mensal e histórico por colaborador'
            : temPermissaoVerTodos
              ? 'Histórico de holerites por colaborador'
              : 'Histórico de holerites da sua equipe'}
        </p>
      </div>

      {podeGerenciar && (
        <div className="shrink-0">
          <EnviarHoleritesSection onConcluido={() => listaRef.current?.refetch()} />
        </div>
      )}
      <HoleritesEnviadosList ref={listaRef} podeRemover={podeGerenciar} />
    </div>
  );
};

export default HoleritesPage;
