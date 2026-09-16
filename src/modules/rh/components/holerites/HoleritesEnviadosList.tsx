import React, { useMemo, useState } from 'react';
import { Download, FileText, Search } from 'lucide-react';
import { useHoleritesEnviados } from '../../hooks/useHoleritesEnviados';
import { formatCompetenciaExtenso } from '../../utils/holeritesFormato';

export interface HoleritesEnviadosListRef {
  refetch: () => Promise<void>;
}

const HoleritesEnviadosList = React.forwardRef<HoleritesEnviadosListRef>((_props, ref) => {
  const { holerites, loading, error, refetch, baixar } = useHoleritesEnviados();
  const [busca, setBusca] = useState('');
  const [baixando, setBaixando] = useState<string | null>(null);

  React.useImperativeHandle(ref, () => ({ refetch }), [refetch]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return holerites;
    return holerites.filter((h) => h.colaboradorNome.toLowerCase().includes(termo));
  }, [holerites, busca]);

  const handleBaixar = async (id: string, path: string) => {
    setBaixando(id);
    const url = await baixar(path);
    setBaixando(null);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Holerites enviados</h3>
        <div className="relative w-64 max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar por colaborador..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 text-sm text-red-600 dark:text-red-300">{error}</div>
      )}

      <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto">
        {loading && <div className="p-6 text-sm text-gray-400 dark:text-gray-500 text-center">Carregando...</div>}

        {!loading && filtrados.length === 0 && (
          <div className="p-8 text-center text-gray-400 dark:text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            {holerites.length === 0 ? 'Nenhum holerite enviado ainda.' : 'Nenhum holerite encontrado para esse filtro.'}
          </div>
        )}

        {!loading &&
          filtrados.map((holerite) => (
            <div key={holerite.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{holerite.colaboradorNome}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">{formatCompetenciaExtenso(holerite.competencia)}</div>
              </div>
              <button
                type="button"
                onClick={() => handleBaixar(holerite.id, holerite.arquivoPath)}
                disabled={baixando === holerite.id}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-60 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                {baixando === holerite.id ? 'Gerando link...' : 'Baixar'}
              </button>
            </div>
          ))}
      </div>
    </section>
  );
});

HoleritesEnviadosList.displayName = 'HoleritesEnviadosList';

export default HoleritesEnviadosList;
