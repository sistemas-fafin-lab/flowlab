import React, { useState } from 'react';
import { Download, FileText, UserX } from 'lucide-react';
import { useMeusHolerites } from '../../hooks/useMeusHolerites';
import { formatCompetenciaExtenso } from '../../utils/holeritesFormato';

const MeusHoleritesSection: React.FC = () => {
  const { loading, error, temColaboradorVinculado, holerites, baixar } = useMeusHolerites();
  const [baixando, setBaixando] = useState<string | null>(null);

  const handleBaixar = async (id: string, path: string) => {
    setBaixando(id);
    const url = await baixar(path);
    setBaixando(null);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

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

      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {holerites.length === 0 && (
          <div className="p-8 text-center text-gray-400 dark:text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            Nenhum holerite disponível ainda.
          </div>
        )}

        {holerites.map((holerite) => (
          <div key={holerite.id} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
              {formatCompetenciaExtenso(holerite.competencia)}
            </div>
            <button
              type="button"
              onClick={() => handleBaixar(holerite.id, holerite.arquivoPath)}
              disabled={baixando === holerite.id}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {baixando === holerite.id ? 'Gerando link...' : 'Baixar'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default MeusHoleritesSection;
