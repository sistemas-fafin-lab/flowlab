import React from 'react';
import { UserX } from 'lucide-react';
import { useMeusHolerites } from '../../hooks/useMeusHolerites';
import RecibosPagamentoLista from '../recibos/RecibosPagamentoLista';

const MeusHoleritesSection: React.FC = () => {
  const { loading, error, temColaboradorVinculado, holerites, baixar } = useMeusHolerites();

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center text-sm text-gray-400 dark:text-gray-500">
        Carregando seus holerites...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm">
        {error}
      </div>
    );
  }

  if (!temColaboradorVinculado) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center text-gray-400 dark:text-gray-500">
        <UserX className="w-8 h-8 mx-auto mb-2 opacity-50" />
        Sua conta ainda não está vinculada a um colaborador. Fale com o RH para vincular seu cadastro e acessar seus holerites.
      </div>
    );
  }

  return (
    <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Meus holerites</h2>
      </div>
      <div className="p-4">
        <RecibosPagamentoLista recibos={holerites} visao="colaborador" gerarLink={baixar} />
      </div>
    </section>
  );
};

export default MeusHoleritesSection;
