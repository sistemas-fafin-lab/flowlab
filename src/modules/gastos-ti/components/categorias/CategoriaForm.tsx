import React, { useState } from 'react';
import { NATUREZAS } from '../../constants';
import type { CategoriaTIInput, NaturezaGasto } from '../../types';

interface CategoriaFormProps {
  /** Prefixo dos ids dos campos — o formulário pode aparecer mais de uma vez na tela. */
  idBase: string;
  inicial?: CategoriaTIInput;
  rotuloSalvar: string;
  /** Devolve a mensagem de erro, ou null quando salvou. */
  onSalvar: (input: CategoriaTIInput) => Promise<string | null>;
  onCancelar: () => void;
}

const inputClassName =
  'w-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30 rounded-xl px-3 py-2';

const labelClassName = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';

/**
 * Criar/editar categoria. Usado no modal de categorias e direto no formulário
 * da despesa. A raiz é um `div`, não um `form`: dentro do formulário da
 * despesa, um `form` aninhado seria HTML inválido e o "salvar" daqui
 * enviaria a despesa inteira. Enter no nome salva a categoria.
 */
const CategoriaForm: React.FC<CategoriaFormProps> = ({ idBase, inicial, rotuloSalvar, onSalvar, onCancelar }) => {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '');
  const [natureza, setNatureza] = useState<NaturezaGasto>(inicial?.naturezaPadrao ?? 'opex');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async (): Promise<void> => {
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    const resultado = await onSalvar({ nome, descricao: descricao || null, naturezaPadrao: natureza });
    setSalvando(false);
    if (resultado) setErro(resultado);
  };

  return (
    <div
      role="group"
      aria-label={rotuloSalvar}
      className="rounded-2xl border border-violet-200/70 dark:border-violet-800/60 bg-violet-50/40 dark:bg-violet-950/20 p-4 space-y-3"
    >
      <div>
        <label className={labelClassName} htmlFor={`${idBase}-nome`}>
          Nome
        </label>
        <input
          id={`${idBase}-nome`}
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              salvar();
            }
          }}
          maxLength={60}
          placeholder="Ex.: Segurança da Informação"
          className={inputClassName}
          autoFocus
          required
        />
      </div>

      <div>
        <label className={labelClassName} htmlFor={`${idBase}-descricao`}>
          O que entra nesta categoria <span className="font-normal">(opcional)</span>
        </label>
        <textarea
          id={`${idBase}-descricao`}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
          placeholder="Aparece como dica para quem cadastra uma despesa"
          className={`${inputClassName} resize-none`}
        />
      </div>

      <div>
        <span className={labelClassName} id={`${idBase}-natureza`}>
          Natureza sugerida
        </span>
        <div role="radiogroup" aria-labelledby={`${idBase}-natureza`} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {NATUREZAS.map((n) => {
            const ativo = natureza === n.valor;
            return (
              <button
                key={n.valor}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => setNatureza(n.valor)}
                className={`text-left rounded-xl border px-3 py-2 transition-colors ${
                  ativo
                    ? 'border-violet-400 dark:border-violet-500 bg-white dark:bg-slate-800 ring-2 ring-violet-500/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700'
                }`}
              >
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{n.rotulo}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{n.dica}</span>
              </button>
            );
          })}
        </div>
      </div>

      {erro && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancelar}
          className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {salvando ? 'Salvando...' : rotuloSalvar}
        </button>
      </div>
    </div>
  );
};

export default CategoriaForm;
