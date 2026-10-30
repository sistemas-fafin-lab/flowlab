import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FileSignature, Plus } from 'lucide-react';
import ConfirmDialog from '../../../../components/ConfirmDialog';
import Notification from '../../../../components/Notification';
import { useDialog } from '../../../../hooks/useDialog';
import { useNotification } from '../../../../hooks/useNotification';
import DocumentoModalShell from './DocumentoModalShell';
import DocumentosAssinadosLista from './DocumentosAssinadosLista';
import EnviarDocumentoModal from './EnviarDocumentoModal';
import { useDocumentosColaborador, type EnviarDocumentoInput } from '../../hooks/useDocumentosColaborador';
import { nomeDocumento } from '../../utils/rotulosDocumentos';
import type { DocumentoAssinado } from '../../types';

interface DocumentosAssinadosCardProps {
  colaboradorId: string;
  colaboradorNome: string;
  /** Textos de estado vazio: ficha do RH ou Meu perfil. */
  visao: 'rh' | 'colaborador';
  /** canManageColaboradores: mostra Enviar e Excluir. */
  podeGerenciar?: boolean;
  className?: string;
}

const DOCUMENTOS_NO_RESUMO = 4;

const VAZIO = {
  rh: 'Contratos, termos e aditivos assinados pelo colaborador aparecerão aqui.',
  colaborador: 'Contratos, termos e aditivos que você assinar aparecerão aqui.',
} as const;

/** Card "Documentos assinados" (rh-documentos-assinados): 4 mais recentes + lista completa em modal. */
const DocumentosAssinadosCard: React.FC<DocumentosAssinadosCardProps> = ({
  colaboradorId,
  colaboradorNome,
  visao,
  podeGerenciar = false,
  className = '',
}) => {
  const { documentos, loading, error, refetch, enviar, excluir, gerarLink } = useDocumentosColaborador(colaboradorId);
  const [enviarAberto, setEnviarAberto] = useState(false);
  const [verTodos, setVerTodos] = useState(false);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const { confirmDialog, showConfirmDialog, hideConfirmDialog, handleConfirmDialogConfirm } = useDialog();
  const { notification, hideNotification, showSuccess, showError } = useNotification();
  const recentes = documentos.slice(0, DOCUMENTOS_NO_RESUMO);

  const handleEnviar = async (dados: EnviarDocumentoInput): Promise<string | null> => {
    const erro = await enviar(dados);
    if (!erro) {
      setEnviarAberto(false);
      showSuccess('Documento enviado com sucesso!');
    }
    return erro;
  };

  const handleExcluir = (documento: DocumentoAssinado) => {
    showConfirmDialog(
      'Excluir documento',
      `Excluir "${nomeDocumento(documento)}" de ${colaboradorNome}? O arquivo será removido e essa ação não pode ser desfeita.`,
      async () => {
        setExcluindoId(documento.id);
        const erro = await excluir(documento);
        setExcluindoId(null);
        if (erro) showError('Erro ao excluir documento', erro);
        else showSuccess('Documento excluído.');
      },
      { type: 'danger', confirmText: 'Excluir' },
    );
  };

  const onExcluir = podeGerenciar ? handleExcluir : undefined;

  return (
    <section className={className}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Documentos assinados</h3>
        {podeGerenciar && (
          <button
            type="button"
            onClick={() => setEnviarAberto(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Enviar documento
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Carregando documentos...</p>
      ) : error ? (
        <div className="text-sm text-red-600 dark:text-red-400 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => refetch()} className="shrink-0 font-medium hover:underline">Tentar novamente</button>
        </div>
      ) : documentos.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
          <FileSignature className="w-8 h-8 mx-auto mb-2 opacity-50" />
          {VAZIO[visao]}
        </div>
      ) : (
        <>
          <DocumentosAssinadosLista documentos={recentes} gerarLink={gerarLink} onExcluir={onExcluir} excluindoId={excluindoId} />
          {documentos.length > DOCUMENTOS_NO_RESUMO && (
            <button
              type="button"
              onClick={() => setVerTodos(true)}
              className="mt-3 w-full px-4 py-2 rounded-xl text-sm font-medium text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              Ver todos os documentos ({documentos.length})
            </button>
          )}
        </>
      )}

      {verTodos && (
        <DocumentoModalShell
          tituloId="todos-documentos-titulo"
          sobretitulo={visao === 'rh' ? colaboradorNome : 'Meus documentos'}
          titulo="Documentos assinados"
          onClose={() => setVerTodos(false)}
        >
          <DocumentosAssinadosLista documentos={documentos} gerarLink={gerarLink} onExcluir={onExcluir} excluindoId={excluindoId} />
        </DocumentoModalShell>
      )}

      {enviarAberto && (
        <EnviarDocumentoModal colaboradorNome={colaboradorNome} onClose={() => setEnviarAberto(false)} onEnviar={handleEnviar} />
      )}

      {/* Portal: a ficha tem transform (animação), que prenderia o fixed do diálogo. */}
      {createPortal(
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          cancelText={confirmDialog.cancelText}
          type={confirmDialog.type}
          onConfirm={handleConfirmDialogConfirm}
          onCancel={hideConfirmDialog}
        />,
        document.body,
      )}
      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />
    </section>
  );
};

export default DocumentosAssinadosCard;
