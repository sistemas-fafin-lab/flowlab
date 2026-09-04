import React from 'react';

// Painel de confirmação usado pelas 3 modais de exceção de operadora (issue
// 44) quando o usuário desativa uma flag — motivo é obrigatório só nesse
// caminho. `pergunta` já vem com o nome da operadora interpolado pelo
// chamador, porque a frase muda de modal pra modal.

interface Props {
  pergunta: React.ReactNode;
  motivo: string;
  onChangeMotivo: (motivo: string) => void;
  onCancelar: () => void;
  onConfirmar: () => void;
  confirmando: boolean;
}

const MotivoDesativacaoBox: React.FC<Props> = ({
  pergunta,
  motivo,
  onChangeMotivo,
  onCancelar,
  onConfirmar,
  confirmando,
}) => (
  <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 space-y-2">
    <p className="text-sm text-amber-800 dark:text-amber-200">{pergunta}</p>
    <textarea
      value={motivo}
      onChange={(e) => onChangeMotivo(e.target.value)}
      placeholder="Motivo (obrigatório)"
      rows={2}
      autoFocus
      className="w-full px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
    />
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancelar}
        className="px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={onConfirmar}
        disabled={!motivo.trim() || confirmando}
        className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Confirmar
      </button>
    </div>
  </div>
);

export default MotivoDesativacaoBox;
