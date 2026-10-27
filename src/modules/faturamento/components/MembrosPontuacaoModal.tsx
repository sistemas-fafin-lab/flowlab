import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Plus, Search, UserMinus, UserPlus, X } from 'lucide-react';
import {
  buscarUsuariosAplis,
  desativarMembroPontuacao,
  incluirMembroPontuacao,
  listarMembrosPontuacao,
} from '../hooks/usePontuacaoSetor';
import type { FrentePontuacao, MembroPontuacao, UsuarioAplisPontuacao } from '../types';

// Modal "Membros" da Pontuação do setor (.scratch/faturamento-pontuacao/,
// issue 07): a lista das duas Frentes, com o nome e o id do usuário do apLIS.
// Incluir busca o usuário ativo do apLIS pelo nome; desativar não apaga, e quem
// foi desativado pode ser reativado. Mesmo esqueleto de LancamentoPontuacaoModal;
// gate canManageBilling no pai, que recarrega a prévia a cada mudança.

interface Props {
  frentes: { frente: FrentePontuacao; rotulo: string }[];
  onFechar: () => void;
  /** Depois de incluir ou desativar: o pai recarrega a pontuação. */
  onAlterado: () => void;
}

const BUSCA_MINIMA = 2;
const ESPERA_BUSCA_MS = 300;

const BuscaUsuario: React.FC<{
  idsNaFrente: Set<number>;
  ocupado: boolean;
  onEscolher: (usuario: UsuarioAplisPontuacao) => void;
}> = ({ idsNaFrente, ocupado, onEscolher }) => {
  const [termo, setTermo] = useState('');
  const [usuarios, setUsuarios] = useState<UsuarioAplisPontuacao[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const busca = termo.trim();
    if (busca.length < BUSCA_MINIMA) {
      setUsuarios([]);
      setErro(null);
      return;
    }
    let cancelado = false;
    const espera = window.setTimeout(async () => {
      setBuscando(true);
      try {
        const achados = await buscarUsuariosAplis(busca);
        if (!cancelado) {
          setUsuarios(achados);
          setErro(null);
        }
      } catch (err) {
        if (!cancelado) setErro(err instanceof Error ? err.message : 'Não foi possível buscar os usuários do apLIS.');
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, ESPERA_BUSCA_MS);
    return () => {
      cancelado = true;
      window.clearTimeout(espera);
    };
  }, [termo]);

  const busca = termo.trim();
  return (
    <div className="mt-2">
      <label className="relative block">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <input
          type="text"
          autoFocus
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Nome do usuário do apLIS"
          className="w-full pl-8 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
        />
        {buscando && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-gray-400" />}
      </label>
      {erro && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{erro}</p>}
      {busca.length >= BUSCA_MINIMA && !buscando && !erro && usuarios.length === 0 && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Nenhum usuário ativo do apLIS com esse nome.</p>
      )}
      {usuarios.length > 0 && (
        <ul className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {usuarios.map((u) => {
            const jaMembro = idsNaFrente.has(u.idUsuarioAplis);
            return (
              <li key={u.idUsuarioAplis}>
                <button
                  type="button"
                  disabled={jaMembro || ocupado}
                  onClick={() => onEscolher(u)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>
                    {u.nome} <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">#{u.idUsuarioAplis}</span>
                  </span>
                  {jaMembro ? (
                    <span className="text-xs text-gray-500 dark:text-gray-400">Já é membro</span>
                  ) : (
                    <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const MembrosPontuacaoModal: React.FC<Props> = ({ frentes, onFechar, onAlterado }) => {
  const [membros, setMembros] = useState<MembroPontuacao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [incluindoEm, setIncluindoEm] = useState<FrentePontuacao | null>(null);

  const carregar = useCallback(async () => {
    try {
      setMembros(await listarMembrosPontuacao());
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível carregar os membros das Frentes.');
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  useEffect(() => {
    const fecharNoEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !ocupado) onFechar(); };
    window.addEventListener('keydown', fecharNoEsc);
    return () => window.removeEventListener('keydown', fecharNoEsc);
  }, [onFechar, ocupado]);

  const alterar = async (acao: () => Promise<void>) => {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
      await carregar();
      onAlterado();
      return true;
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível alterar os membros.');
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const incluir = async (frente: FrentePontuacao, idUsuarioAplis: number) => {
    if (await alterar(() => incluirMembroPontuacao(frente, idUsuarioAplis))) setIncluindoEm(null);
  };

  const desativar = (rotuloFrente: string, membro: MembroPontuacao) => {
    if (!window.confirm(`Desativar ${membro.nome} da Frente ${rotuloFrente}? As tarefas dela deixam de contar na prévia.`)) return;
    void alterar(() => desativarMembroPontuacao(membro.frente, membro.idUsuarioAplis));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Membros das Frentes</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              As tarefas pendentes são contadas pelo usuário do apLIS. Meses fechados guardam os membros daquele mês.
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5 overflow-y-auto">
          {erro && (
            <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {membros === null && !erro && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando membros…
            </div>
          )}

          {membros !== null && frentes.map(({ frente, rotulo }) => {
            const daFrente = membros.filter((m) => m.frente === frente);
            const ativos = daFrente.filter((m) => m.ativo);
            const desativados = daFrente.filter((m) => !m.ativo);
            return (
              <section key={frente}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Frente {rotulo}</h3>
                  {incluindoEm !== frente && (
                    <button
                      type="button"
                      onClick={() => setIncluindoEm(frente)}
                      disabled={ocupado}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Incluir
                    </button>
                  )}
                </div>

                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 dark:text-gray-400">
                      <th className="pb-1 text-left font-medium">Nome</th>
                      <th className="pb-1 px-2 text-right font-medium">Usuário apLIS</th>
                      <th className="pb-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {ativos.map((m) => (
                      <tr key={m.idUsuarioAplis} className="border-t border-gray-100 dark:border-gray-700/60">
                        <td className="py-1.5 text-gray-900 dark:text-gray-100">{m.nome}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{m.idUsuarioAplis}</td>
                        <td className="py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => desativar(rotulo, m)}
                            disabled={ocupado}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
                          >
                            <UserMinus className="h-3.5 w-3.5" /> Desativar
                          </button>
                        </td>
                      </tr>
                    ))}
                    {desativados.map((m) => (
                      <tr key={m.idUsuarioAplis} className="border-t border-gray-100 dark:border-gray-700/60 text-gray-400 dark:text-gray-500">
                        <td className="py-1.5">
                          {m.nome} <span className="text-xs italic">(desativado)</span>
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{m.idUsuarioAplis}</td>
                        <td className="py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => void incluir(frente, m.idUsuarioAplis)}
                            disabled={ocupado}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50"
                          >
                            <UserPlus className="h-3.5 w-3.5" /> Reativar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {daFrente.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Nenhum membro nesta Frente.</p>
                )}

                {incluindoEm === frente && (
                  <div className="mt-2 rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Incluir na Frente {rotulo}</p>
                      <button
                        type="button"
                        onClick={() => setIncluindoEm(null)}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                      >
                        Cancelar
                      </button>
                    </div>
                    <BuscaUsuario
                      idsNaFrente={new Set(ativos.map((m) => m.idUsuarioAplis))}
                      ocupado={ocupado}
                      onEscolher={(u) => void incluir(frente, u.idUsuarioAplis)}
                    />
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="flex justify-end px-6 py-3 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default MembrosPontuacaoModal;
