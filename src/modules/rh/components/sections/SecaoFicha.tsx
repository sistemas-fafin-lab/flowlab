import React from 'react';
import { Check, Loader2, Lock, Pencil, X } from 'lucide-react';

interface SecaoFichaProps {
  titulo: string;
  /** Mostra o botão Editar no cabeçalho (canManageColaboradores). */
  podeEditar: boolean;
  editando: boolean;
  /** Outra seção está em edição: Editar fica desabilitado. */
  bloqueada: boolean;
  salvando: boolean;
  erro: string | null;
  sucesso: string | null;
  onEditar: () => void;
  onCancelar: () => void;
  onSalvar: () => void;
  /** Dica do Editar desabilitado (padrão: outra seção em edição). */
  dicaBloqueio?: string;
  /** Texto abaixo do título durante a edição. */
  subtituloEdicao?: string;
  /** Rótulos do botão de salvar (padrão: "Salvar alterações" / "Salvando..."). */
  rotuloSalvar?: string;
  rotuloSalvando?: string;
  salvarDesabilitado?: boolean;
  /** Texto à esquerda do rodapé de edição (ex.: contagem de campos alterados). */
  infoRodape?: React.ReactNode;
  /** Rodapé fixo no fim da área rolável durante a edição. */
  rodapeFixo?: boolean;
  /** Ação ao lado da mensagem de erro (ex.: "Tentar novamente"). */
  acaoErro?: React.ReactNode;
  children: React.ReactNode;
}

/** Casca das seções editáveis da ficha: cabeçalho com Editar / badge "Em edição" e rodapé Cancelar/Salvar. */
const SecaoFicha: React.FC<SecaoFichaProps> = ({
  titulo,
  podeEditar,
  editando,
  bloqueada,
  salvando,
  erro,
  sucesso,
  onEditar,
  onCancelar,
  onSalvar,
  dicaBloqueio = 'Conclua a edição em andamento antes',
  subtituloEdicao,
  rotuloSalvar = 'Salvar alterações',
  rotuloSalvando = 'Salvando...',
  salvarDesabilitado = false,
  infoRodape,
  rodapeFixo = false,
  acaoErro,
  children,
}) => (
  <section className={editando ? 'rounded-2xl ring-2 ring-blue-500/40 p-4 -m-4' : undefined}>
    <div className={`flex items-center justify-between gap-3 ${editando && subtituloEdicao ? 'mb-1' : 'mb-3'}`}>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{titulo}</h3>
        {editando && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            Em edição
          </span>
        )}
      </div>
      {podeEditar && !editando && (
        <button
          type="button"
          onClick={onEditar}
          disabled={bloqueada}
          title={bloqueada ? dicaBloqueio : undefined}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </button>
      )}
    </div>
    {editando && subtituloEdicao && <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">{subtituloEdicao}</p>}

    {children}

    {erro && (
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-red-600 dark:text-red-400">
        <span>{erro}</span>
        {acaoErro}
      </div>
    )}
    {sucesso && !erro && !editando && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{sucesso}</p>}

    {editando && (
      <div
        className={`mt-4 flex items-center justify-end gap-2 ${
          rodapeFixo ? 'sticky bottom-0 -mx-4 -mb-4 px-4 py-3 rounded-b-2xl bg-white/95 dark:bg-gray-800/95 backdrop-blur border-t border-gray-100 dark:border-gray-700' : ''
        }`}
      >
        {infoRodape && <span className="mr-auto text-xs text-gray-500 dark:text-gray-400">{infoRodape}</span>}
        <button
          type="button"
          onClick={onCancelar}
          disabled={salvando}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          <X className="w-4 h-4" />
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSalvar}
          disabled={salvando || salvarDesabilitado}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {salvando ? rotuloSalvando : rotuloSalvar}
        </button>
      </div>
    )}
  </section>
);

export default SecaoFicha;

// ─── Campos ─────────────────────────────────────────────────────────────────────

export const inputClassName =
  'w-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 rounded-xl px-3 py-2';

export const labelClassName = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';

interface CampoLeituraProps {
  rotulo: string;
  valor: React.ReactNode;
  /** Campo que nunca é editável na ficha (nome, CPF, e-mail). */
  bloqueado?: boolean;
  dica?: string;
  /** Conteúdo extra abaixo do valor (ex.: "Em análise: ..."). */
  rodape?: React.ReactNode;
}

/** Valor em modo leitura; vazio vira "—". */
export const CampoLeitura: React.FC<CampoLeituraProps> = ({ rotulo, valor, bloqueado, dica, rodape }) => (
  <div>
    <div className={`${labelClassName} flex items-center gap-1`}>
      {rotulo}
      {bloqueado && <Lock className="w-3 h-3" aria-label="somente leitura" />}
    </div>
    <div
      className={`text-sm font-medium text-gray-800 dark:text-gray-100 break-words ${
        bloqueado ? 'rounded-xl border border-dashed border-gray-200 dark:border-gray-600 px-3 py-2' : 'py-2'
      }`}
    >
      {valor === null || valor === undefined || valor === '' ? <span className="font-normal text-gray-400 dark:text-gray-500">—</span> : valor}
    </div>
    {dica && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{dica}</p>}
    {rodape}
  </div>
);
