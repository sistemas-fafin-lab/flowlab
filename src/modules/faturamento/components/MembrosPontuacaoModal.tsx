import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Info, Loader2, Plus, RotateCcw, Search, UserMinus, UserPlus, Users, X } from 'lucide-react';
import {
  buscarUsuariosAplis,
  desativarMembroPontuacao,
  incluirMembroPontuacao,
  listarMembrosPontuacao,
} from '../hooks/usePontuacaoSetor';
import type { FrentePontuacao, MembroPontuacao, UsuarioAplisPontuacao } from '../types';

// Modal "Membros" da Pontuação do setor (.scratch/faturamento-pontuacao/,
// issue 07): um card por Frente, com o nome e o id do usuário do apLIS.
// Incluir busca o usuário ativo do apLIS pelo nome; desativar não apaga, e quem
// foi desativado pode ser reativado. Gate canManageBilling no pai, que
// recarrega a prévia a cada mudança.

interface Props {
  frentes: { frente: FrentePontuacao; rotulo: string }[];
  onFechar: () => void;
  /** Depois de incluir ou desativar: o pai recarrega a pontuação. */
  onAlterado: () => void;
}

const BUSCA_MINIMA = 2;
const ESPERA_BUSCA_MS = 300;

const iniciais = (nome: string): string => {
  const partes = nome.trim().split(/\s+/);
  return `${partes[0]?.[0] ?? ''}${partes.length > 1 ? partes[partes.length - 1][0] : ''}`.toUpperCase();
};

const Avatar: React.FC<{ nome: string; apagado?: boolean }> = ({ nome, apagado }) => (
  <span
    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
      apagado
        ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
    }`}
  >
    {iniciais(nome)}
  </span>
);

const IdAplis: React.FC<{ id: number }> = ({ id }) => (
  <span className="shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-500 dark:text-gray-400">
    apLIS {id}
  </span>
);

const BuscaUsuario: React.FC<{
  idsNaFrente: Set<number>;
  ocupado: boolean;
  onEscolher: (usuario: UsuarioAplisPontuacao) => void;
  onCancelar: () => void;
}> = ({ idsNaFrente, ocupado, onEscolher, onCancelar }) => {
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
    <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-900/10 p-3 animate-fade-in">
      <div className="flex items-center gap-2">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            autoFocus
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancelar(); } }}
            placeholder="Buscar usuário do apLIS pelo nome"
            className="w-full pl-9 pr-9 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 hover:border-slate-300 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
          {buscando && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
        </label>
        <button
          type="button"
          onClick={onCancelar}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-white dark:hover:bg-gray-700 dark:hover:text-gray-200"
          aria-label="Cancelar inclusão"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {busca.length < BUSCA_MINIMA && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Digite ao menos {BUSCA_MINIMA} letras. Só aparecem usuários ativos.</p>
      )}
      {erro && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{erro}</p>}
      {busca.length >= BUSCA_MINIMA && !buscando && !erro && usuarios.length === 0 && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Nenhum usuário ativo do apLIS com esse nome.</p>
      )}
      {usuarios.length > 0 && (
        <ul className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-sm">
          {usuarios.map((u) => {
            const jaMembro = idsNaFrente.has(u.idUsuarioAplis);
            return (
              <li key={u.idUsuarioAplis}>
                <button
                  type="button"
                  disabled={jaMembro || ocupado}
                  onClick={() => onEscolher(u)}
                  className="group w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-gray-700/60 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                >
                  <Avatar nome={u.nome} apagado={jaMembro} />
                  <span className={`flex-1 min-w-0 truncate text-sm ${jaMembro ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                    {u.nome}
                  </span>
                  <IdAplis id={u.idUsuarioAplis} />
                  {jaMembro ? (
                    <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">já é membro</span>
                  ) : (
                    <Plus className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 opacity-60 group-hover:opacity-100" />
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

const CardFrente: React.FC<{
  rotulo: string;
  membros: MembroPontuacao[];
  ocupado: boolean;
  incluindo: boolean;
  onAbrirInclusao: () => void;
  onCancelarInclusao: () => void;
  onIncluir: (idUsuarioAplis: number) => void;
  onDesativar: (membro: MembroPontuacao) => void;
}> = ({ rotulo, membros, ocupado, incluindo, onAbrirInclusao, onCancelarInclusao, onIncluir, onDesativar }) => {
  const [verDesativados, setVerDesativados] = useState(false);
  const ativos = membros.filter((m) => m.ativo);
  const desativados = membros.filter((m) => !m.ativo);
  const Seta = verDesativados ? ChevronDown : ChevronRight;

  return (
    <section className="flex flex-col rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Frente</p>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{rotulo}</h3>
        </div>
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          {ativos.length} {ativos.length === 1 ? 'ativo' : 'ativos'}
        </span>
      </div>

      <div className="flex-1 px-2 py-2">
        {ativos.length === 0 ? (
          <p className="px-2 py-3 text-sm text-gray-500 dark:text-gray-400">Nenhum membro ativo.</p>
        ) : (
          <ul>
            {ativos.map((m) => (
              <li key={m.idUsuarioAplis} className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <Avatar nome={m.nome} />
                <span className="flex-1 min-w-0 truncate text-sm text-gray-900 dark:text-gray-100" title={m.nome}>{m.nome}</span>
                <IdAplis id={m.idUsuarioAplis} />
                <button
                  type="button"
                  onClick={() => onDesativar(m)}
                  disabled={ocupado}
                  title={`Desativar ${m.nome}`}
                  aria-label={`Desativar ${m.nome}`}
                  className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 disabled:opacity-50"
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {desativados.length > 0 && (
          <div className="mt-1 px-2">
            <button
              type="button"
              onClick={() => setVerDesativados((v) => !v)}
              aria-expanded={verDesativados}
              className="inline-flex items-center gap-1 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <Seta className="h-3.5 w-3.5" />
              Desativados ({desativados.length})
            </button>
            {verDesativados && (
              <ul className="mt-1 animate-fade-in">
                {desativados.map((m) => (
                  <li key={m.idUsuarioAplis} className="flex items-center gap-2.5 py-1.5">
                    <Avatar nome={m.nome} apagado />
                    <span className="flex-1 min-w-0 truncate text-sm text-gray-400 dark:text-gray-500 line-through decoration-gray-300" title={m.nome}>
                      {m.nome}
                    </span>
                    <button
                      type="button"
                      onClick={() => onIncluir(m.idUsuarioAplis)}
                      disabled={ocupado}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Reativar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-4 pt-1">
        {incluindo ? (
          <BuscaUsuario
            idsNaFrente={new Set(ativos.map((m) => m.idUsuarioAplis))}
            ocupado={ocupado}
            onEscolher={(u) => onIncluir(u.idUsuarioAplis)}
            onCancelar={onCancelarInclusao}
          />
        ) : (
          <button
            type="button"
            onClick={onAbrirInclusao}
            disabled={ocupado}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 dark:hover:border-blue-500 dark:hover:text-blue-400 dark:hover:bg-blue-900/10 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" /> Incluir membro
          </button>
        )}
      </div>
    </section>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-scale-in">
        <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/25">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Membros das Frentes</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Quem conta no critério "Tarefas pendentes", pelo usuário do apLIS.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-transform duration-200 hover:rotate-90"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto bg-gray-50/60 dark:bg-gray-900/30">
          {erro && (
            <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {membros === null && !erro ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {frentes.map(({ frente }) => (
                <div key={frente} className="h-56 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse" />
              ))}
            </div>
          ) : membros !== null && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {frentes.map(({ frente, rotulo }) => (
                <CardFrente
                  key={frente}
                  rotulo={rotulo}
                  membros={membros.filter((m) => m.frente === frente)}
                  ocupado={ocupado}
                  incluindo={incluindoEm === frente}
                  onAbrirInclusao={() => setIncluindoEm(frente)}
                  onCancelarInclusao={() => setIncluindoEm(null)}
                  onIncluir={(id) => void incluir(frente, id)}
                  onDesativar={(m) => desativar(rotulo, m)}
                />
              ))}
            </div>
          )}

          <p className="flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            A mudança vale na hora para a prévia dos meses abertos. Meses fechados guardam os membros daquele mês.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 rounded-b-2xl">
          {ocupado && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          <button
            type="button"
            onClick={onFechar}
            className="px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 dark:hover:bg-gray-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default MembrosPontuacaoModal;
