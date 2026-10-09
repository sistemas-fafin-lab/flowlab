import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, Pencil, Plus, Tags } from 'lucide-react';
import DetailModal from '../../../../components/DetailModal';
import { useTheme } from '../../../../hooks/useTheme';
import { moverCategoria } from '../../domain/categorias';
import { corDoSlot, MAX_CATEGORIAS_COM_COR, slotsDeCor } from '../../domain/coresCategorias';
import { NATUREZA_ROTULO } from '../../constants';
import { useCanManageGastosTI } from '../../hooks/useCanManageGastosTI';
import type { UseCategoriasTIResult } from '../../hooks/useCategoriasTI';
import type { CategoriaTI } from '../../types';
import CategoriaForm from './CategoriaForm';

interface CategoriasModalProps {
  /** Estado do hook da página: o modal altera a mesma lista que a página usa. */
  categoriasTI: UseCategoriasTIResult;
  onClose: () => void;
}

const botaoIcone =
  'p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors';

const CategoriasModal: React.FC<CategoriasModalProps> = ({ categoriasTI, onClose }) => {
  const { categorias, loading, error, refetch, criarCategoria, atualizarCategoria, definirAtivo, reordenar } =
    categoriasTI;
  const podeGerenciar = useCanManageGastosTI();
  const { theme } = useTheme();
  const [criando, setCriando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Slots sempre sobre a lista completa (inclusive inativas): desativar não repinta as outras.
  const slots = useMemo(() => slotsDeCor(categorias), [categorias]);
  const ids = useMemo(() => categorias.map((c) => c.id), [categorias]);

  const executar = async (acao: () => Promise<string | null>): Promise<void> => {
    setOcupado(true);
    setErroAcao(null);
    setErroAcao(await acao());
    setOcupado(false);
  };

  const handleCriar = async (input: Parameters<typeof criarCategoria>[0]): Promise<string | null> => {
    const resultado = await criarCategoria(input);
    // `=== false` (e não `!resultado.ok`): sem strictNullChecks o TS não estreita a união pela negação.
    if (resultado.ok === false) return resultado.erro;
    setCriando(false);
    return null;
  };

  const handleEditar = async (id: string, input: Parameters<typeof atualizarCategoria>[1]): Promise<string | null> => {
    const erro = await atualizarCategoria(id, input);
    if (!erro) setEditandoId(null);
    return erro;
  };

  const renderLinha = (c: CategoriaTI, i: number) => {
    if (editandoId === c.id) {
      return (
        <li key={c.id}>
          <CategoriaForm
            idBase={`categoria-${c.id}`}
            inicial={{ nome: c.nome, descricao: c.descricao, naturezaPadrao: c.naturezaPadrao }}
            rotuloSalvar="Salvar"
            onSalvar={(input) => handleEditar(c.id, input)}
            onCancelar={() => setEditandoId(null)}
          />
        </li>
      );
    }

    const slot = slots.get(c.id);
    const semCorPropria = slot === null;

    return (
      <li
        key={c.id}
        className={`flex items-start gap-3 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/70 dark:bg-slate-800/40 px-3 py-2.5 ${
          c.ativo ? '' : 'opacity-60'
        }`}
      >
        <span
          aria-hidden="true"
          className={`mt-1.5 w-3 h-3 rounded-full flex-shrink-0 ${semCorPropria ? 'ring-1 ring-offset-1 ring-slate-300 dark:ring-slate-600 dark:ring-offset-slate-900' : ''}`}
          style={{ backgroundColor: corDoSlot(slot, theme) }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{c.nome}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-300">
              {NATUREZA_ROTULO[c.naturezaPadrao]}
            </span>
            {!c.ativo && (
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400">
                Inativa
              </span>
            )}
            {semCorPropria && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500">entra em "Outros" no gráfico empilhado</span>
            )}
          </div>
          {c.descricao && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{c.descricao}</p>}
        </div>
        {podeGerenciar && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              type="button"
              className={botaoIcone}
              onClick={() => executar(() => reordenar(moverCategoria(ids, c.id, 'subir')))}
              disabled={ocupado || i === 0}
              aria-label={`Subir ${c.nome}`}
              title="Subir"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              className={botaoIcone}
              onClick={() => executar(() => reordenar(moverCategoria(ids, c.id, 'descer')))}
              disabled={ocupado || i === categorias.length - 1}
              aria-label={`Descer ${c.nome}`}
              title="Descer"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              type="button"
              className={botaoIcone}
              onClick={() => {
                setCriando(false);
                setEditandoId(c.id);
              }}
              disabled={ocupado}
              aria-label={`Editar ${c.nome}`}
              title="Editar"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              className={botaoIcone}
              onClick={() => executar(() => definirAtivo(c.id, !c.ativo))}
              disabled={ocupado}
              aria-label={c.ativo ? `Desativar ${c.nome}` : `Reativar ${c.nome}`}
              title={c.ativo ? 'Desativar' : 'Reativar'}
            >
              {c.ativo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <DetailModal title="Categorias" icon={<Tags className="w-5 h-5 text-white" />} onClose={onClose} accentColor="purple">
      <div className="w-full sm:w-[640px] max-w-full space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          A ordem define a cor nos gráficos: as {MAX_CATEGORIAS_COM_COR} primeiras têm cor própria e, da{' '}
          {MAX_CATEGORIAS_COM_COR + 1}ª em diante, aparecem somadas em "Outros" no gráfico empilhado. Categoria
          desativada some do cadastro de despesas, mas continua no histórico e nos gráficos.
          {!podeGerenciar && ' Você tem acesso só de leitura.'}
        </p>

        {erroAcao && (
          <p
            role="alert"
            className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 rounded-xl px-3 py-2"
          >
            {erroAcao}
          </p>
        )}

        {podeGerenciar &&
          (criando ? (
            <CategoriaForm
              idBase="categoria-nova"
              rotuloSalvar="Criar categoria"
              onSalvar={handleCriar}
              onCancelar={() => setCriando(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditandoId(null);
                setCriando(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova categoria
            </button>
          ))}

        {loading && categorias.length === 0 ? (
          <ul className="space-y-2" aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
            ))}
          </ul>
        ) : error ? (
          <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 rounded-xl px-3 py-3">
            <p>{error}</p>
            <button type="button" onClick={refetch} className="mt-2 font-medium underline underline-offset-2">
              Tentar novamente
            </button>
          </div>
        ) : categorias.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma categoria cadastrada.</p>
        ) : (
          <ul className="space-y-2">{categorias.map(renderLinha)}</ul>
        )}
      </div>
    </DetailModal>
  );
};

export default CategoriasModal;
