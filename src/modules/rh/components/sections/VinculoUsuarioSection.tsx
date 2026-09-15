import React, { useMemo, useState } from 'react';
import { Search, UserCheck, UserX, Link2 } from 'lucide-react';
import type { Colaborador } from '../../types';
import { useUserProfilesDisponiveis } from '../../hooks/useUserProfilesDisponiveis';

interface VinculoUsuarioSectionProps {
  colaborador: Colaborador;
  onVincular: (colaboradorId: string, userProfileId: string) => Promise<string | null>;
  onDesvincular: (colaboradorId: string) => Promise<string | null>;
}

const VinculoUsuarioSection: React.FC<VinculoUsuarioSectionProps> = ({ colaborador, onVincular, onDesvincular }) => {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  const { userProfiles, loading, error: erroCarregamento } = useUserProfilesDisponiveis();

  const disponiveisFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return userProfiles;
    return userProfiles.filter(
      (u) => u.name.toLowerCase().includes(termo) || u.email.toLowerCase().includes(termo)
    );
  }, [userProfiles, busca]);

  const selecionado = userProfiles.find((u) => u.id === selecionadoId) ?? null;

  const handleDesvincular = async () => {
    setSalvando(true);
    setErro(null);
    const resultado = await onDesvincular(colaborador.id);
    setSalvando(false);
    if (resultado) {
      setErro(resultado);
    }
  };

  const handleVincular = async () => {
    if (!selecionadoId) return;
    setSalvando(true);
    setErro(null);
    const resultado = await onVincular(colaborador.id, selecionadoId);
    setSalvando(false);
    if (resultado) {
      setErro(resultado);
      // mantém o seletor aberto com a seleção atual para o usuário tentar outra pessoa
      return;
    }
    setBusca('');
    setSelecionadoId(null);
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Usuário do sistema</h3>

      {colaborador.usuarioVinculado ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <UserCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                {colaborador.usuarioVinculado.nome}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                {colaborador.usuarioVinculado.email}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDesvincular}
            disabled={salvando}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <UserX className="w-3.5 h-3.5" />
            {salvando ? 'Desvinculando...' : 'Desvincular'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setSelecionadoId(null);
              }}
              placeholder="Buscar usuário por nome ou e-mail..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {loading && (
            <p className="text-sm text-gray-400 dark:text-gray-500">Carregando usuários...</p>
          )}

          {erroCarregamento && (
            <p className="text-sm text-red-600 dark:text-red-300">{erroCarregamento}</p>
          )}

          {!loading && !erroCarregamento && (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-600 divide-y divide-gray-100 dark:divide-gray-700">
              {disponiveisFiltrados.length === 0 ? (
                <p className="px-3 py-3 text-sm text-gray-400 dark:text-gray-500">
                  {userProfiles.length === 0
                    ? 'Não há usuários disponíveis para vincular.'
                    : 'Nenhum usuário encontrado para essa busca.'}
                </p>
              ) : (
                disponiveisFiltrados.map((user) => {
                  const ativo = user.id === selecionadoId;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelecionadoId(user.id)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        ativo
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                      }`}
                    >
                      <div className="font-medium truncate">{user.name}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{user.email}</div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {erro && <p className="text-sm text-red-600 dark:text-red-300">{erro}</p>}

          <button
            type="button"
            onClick={handleVincular}
            disabled={!selecionado || salvando}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Link2 className="w-4 h-4" />
            {salvando ? 'Vinculando...' : 'Vincular usuário'}
          </button>
        </div>
      )}
    </section>
  );
};

export default VinculoUsuarioSection;
