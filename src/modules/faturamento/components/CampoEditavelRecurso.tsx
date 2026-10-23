import React, { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import CampoMoeda from '../../../components/CostControl/CampoMoeda';
import { formatCurrency, formatData } from '../utils/formato';

// Campo do card "Detalhes do recurso" que o lápis corrige
// (.scratch/glosas-recursos-dashboard/, issue 07): mostra o valor que vale e a
// marca "editado manualmente"; quem gerencia o faturamento vê o lápis, edita
// no lugar e pode remover a edição (volta a valer o apLIS).

type Props = {
  rotulo: string;
  editado: boolean;
  podeEditar: boolean;
  /** Mostrado abaixo do valor (ex.: o que o apLIS diz). */
  dica?: string | null;
} & (
  | { tipo: 'data'; valor: string | null; onSalvar: (valor: string | null) => Promise<void> }
  | { tipo: 'moeda'; valor: number | null; onSalvar: (valor: number | null) => Promise<void> }
);

const BOTAO_ICONE = 'p-1 rounded-md transition-colors disabled:opacity-50';
const CAMPO = 'w-full px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white';

/** Marca "editado manualmente"; `compacta` (listas estreitas) mostra só o lápis. */
export const MarcaEditado: React.FC<{ compacta?: boolean }> = ({ compacta = false }) => (
  compacta ? (
    <span title="Editado manualmente: vale acima do apLIS" aria-label="editado manualmente">
      <Pencil size={10} className="inline ml-1 text-amber-600 dark:text-amber-400" />
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 whitespace-nowrap"
      title="Corrigido pelo lápis: vale acima do apLIS"
    >
      <Pencil size={9} /> editado manualmente
    </span>
  )
);

const CampoEditavelRecurso: React.FC<Props> = (props) => {
  const { rotulo, editado, podeEditar, dica } = props;
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<string | number | null>(null);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const abrir = () => {
    setRascunho(props.valor ?? (props.tipo === 'data' ? '' : 0));
    setErro(null);
    setEditando(true);
  };

  const gravar = async (valor: string | number | null) => {
    setGravando(true);
    setErro(null);
    try {
      if (props.tipo === 'data') await props.onSalvar(valor as string | null);
      else await props.onSalvar(valor as number | null);
      setEditando(false);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível gravar a edição.');
    } finally {
      setGravando(false);
    }
  };

  const exibido = props.tipo === 'data'
    ? formatData(props.valor)
    : props.valor === null ? '—' : formatCurrency(props.valor);
  const rascunhoValido = props.tipo === 'data' ? typeof rascunho === 'string' && rascunho !== '' : true;

  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500 dark:text-gray-400">{rotulo}</dt>
      <dd className="text-sm text-gray-900 dark:text-white">
        {editando ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <div className="flex-1 min-w-0">
                {props.tipo === 'data' ? (
                  <input
                    type="date"
                    value={(rascunho as string) ?? ''}
                    onChange={(e) => setRascunho(e.target.value)}
                    className={CAMPO}
                    autoFocus
                  />
                ) : (
                  <CampoMoeda value={(rascunho as number) ?? 0} onChange={setRascunho} className={CAMPO} autoFocus />
                )}
              </div>
              <button
                onClick={() => void gravar(rascunho)}
                disabled={gravando || !rascunhoValido}
                className={`${BOTAO_ICONE} text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20`}
                aria-label={`Salvar ${rotulo.toLowerCase()}`}
                title="Salvar"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => setEditando(false)}
                disabled={gravando}
                className={`${BOTAO_ICONE} text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700`}
                aria-label="Cancelar edição"
                title="Cancelar"
              >
                <X size={16} />
              </button>
            </div>
            {editado && (
              <button
                onClick={() => void gravar(null)}
                disabled={gravando}
                className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
              >
                Remover edição
              </button>
            )}
            {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            <span>{exibido}</span>
            {podeEditar && (
              <button
                onClick={abrir}
                className={`${BOTAO_ICONE} text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700`}
                aria-label={`Editar ${rotulo.toLowerCase()}`}
                title="Editar"
              >
                <Pencil size={13} />
              </button>
            )}
            {editado && <MarcaEditado />}
          </div>
        )}
        {!editando && dica && <p className="text-xs text-gray-500 dark:text-gray-400">{dica}</p>}
      </dd>
    </div>
  );
};

export default CampoEditavelRecurso;
