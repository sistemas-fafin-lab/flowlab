import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Despesa } from '../../types';
import ModalFormulario from '../ui/ModalFormulario';

interface ExcluirDespesaModalProps {
  despesa: Despesa;
  onConfirmar: () => Promise<string | null>;
  onFechar: () => void;
  /** Chamado depois de excluir, para fechar também o painel da despesa. */
  onExcluida: () => void;
}

/** Excluir é só para despesa cadastrada por engano; com histórico, o banco recusa e o caminho é encerrar (RF04). */
const ExcluirDespesaModal: React.FC<ExcluirDespesaModalProps> = ({ despesa, onConfirmar, onFechar, onExcluida }) => {
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExcluindo(true);
    setErro(null);
    const resultado = await onConfirmar();
    setExcluindo(false);
    if (resultado) setErro(resultado);
    else onExcluida();
  };

  return (
    <ModalFormulario
      titulo="Excluir despesa"
      subtitulo={despesa.descricao}
      icone={Trash2}
      onFechar={onFechar}
      onSubmit={handleSubmit}
      ocupado={excluindo}
      rotuloSalvar="Excluir despesa"
      erro={erro}
      largura="md"
      variante="perigo"
    >
      <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <p>
          Excluir <strong className="text-slate-900 dark:text-white">{despesa.descricao}</strong>? Os reajustes dela
          também são excluídos, e a ação não pode ser desfeita. A exclusão fica registrada na auditoria do módulo.
        </p>
        <p className="text-slate-500 dark:text-slate-400">
          Use só para uma despesa cadastrada por engano. Se ela já teve pagamentos registrados, a exclusão é recusada:
          nesse caso, encerre a despesa informando a última cobrança.
        </p>
      </div>
    </ModalFormulario>
  );
};

export default ExcluirDespesaModal;
