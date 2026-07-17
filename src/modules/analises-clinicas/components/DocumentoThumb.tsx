import React, { useState } from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { isImagem, type DocumentoCheckin } from '../types';

const fmtTamanho = (bytes: number): string =>
  bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/**
 * Miniatura de um documento enviado pelo paciente.
 *
 * Imagem → botão que abre o lightbox (o operador confere sem sair da conferência).
 * PDF → link em nova aba: renderizar PDF inline exigiria um viewer, e o do navegador
 * já resolve.
 */
export const DocumentoThumb: React.FC<{
  doc: DocumentoCheckin;
  onAbrir?: () => void;
}> = ({ doc, onAbrir }) => {
  // Signed URL vencida, arquivo corrompido, rede: cai no card de arquivo em vez de
  // deixar o ícone quebrado de imagem na tela.
  const [falhou, setFalhou] = useState(false);

  const legenda = `${doc.nomeArquivo} · ${fmtTamanho(doc.tamanhoBytes)}`;

  if (isImagem(doc.mimeType) && !falhou) {
    return (
      <button
        type="button"
        onClick={onAbrir}
        title={legenda}
        className="group relative w-14 h-14 rounded-lg overflow-hidden ring-1 ring-gray-200 dark:ring-gray-600 hover:ring-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors shrink-0"
      >
        <img
          src={doc.url}
          alt={doc.nomeArquivo}
          loading="lazy"
          onError={() => setFalhou(true)}
          className="w-full h-full object-cover"
        />
        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      </button>
    );
  }

  return (
    <a
      href={doc.url}
      target="_blank"
      rel="noopener noreferrer"
      title={legenda}
      className="inline-flex items-center gap-2 h-14 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/15 transition-colors shrink-0 max-w-[13rem]"
    >
      <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
          {doc.nomeArquivo}
        </span>
        <span className="block text-[10px] text-gray-500 dark:text-gray-400">
          {fmtTamanho(doc.tamanhoBytes)}
        </span>
      </span>
      <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
    </a>
  );
};
