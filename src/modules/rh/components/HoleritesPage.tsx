import React, { useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/permissions';
import EnviarHoleritesSection from './holerites/EnviarHoleritesSection';
import HoleritesEnviadosList, { type HoleritesEnviadosListRef } from './holerites/HoleritesEnviadosList';
import MeusHoleritesSection from './holerites/MeusHoleritesSection';

const HoleritesPage: React.FC = () => {
  const { userProfile } = useAuth();
  const podeGerenciar = hasPermission(userProfile?.permissions || [], 'canManageHolerites');
  const listaRef = useRef<HoleritesEnviadosListRef>(null);

  if (!podeGerenciar) {
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
        <p className="text-gray-500 dark:text-gray-400">Envio consolidado mensal e histórico por colaborador</p>
      </div>

      <div className="shrink-0">
        <EnviarHoleritesSection onConcluido={() => listaRef.current?.refetch()} />
      </div>
      <HoleritesEnviadosList ref={listaRef} />
    </div>
  );
};

export default HoleritesPage;
