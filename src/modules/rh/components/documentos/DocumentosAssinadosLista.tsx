import React, { useState } from 'react';
import { Download, Eye, FileSignature, Trash2 } from 'lucide-react';
import { formatDataBR } from '../../utils/colaboradorFormato';
import { nomeDocumento } from '../../utils/rotulosDocumentos';
import type { DocumentoAssinado } from '../../types';

interface DocumentosAssinadosListaProps {
  documentos: DocumentoAssinado[];
  gerarLink: (arquivoPath: string, download?: boolean) => Promise<string | null>;
  /** Sem isso o botão Excluir não aparece (canManageColaboradores). */
  onExcluir?: (documento: DocumentoAssinado) => void;
  excluindoId?: string | null;
}

/** Linhas de documentos assinados (nome, data, Visualizar/Baixar/Excluir) — usada no card e na lista completa. */
const DocumentosAssinadosLista: React.FC<DocumentosAssinadosListaProps> = ({ documentos, gerarLink, onExcluir, excluindoId }) => {
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [erroLink, setErroLink] = useState<string | null>(null);

  const abrir = async (documento: DocumentoAssinado, download: boolean) => {
    setAbrindo(`${documento.id}:${download ? 'd' : 'v'}`);
    setErroLink(null);
    const url = await gerarLink(documento.arquivoPath, download);
    setAbrindo(null);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else setErroLink('Não foi possível abrir o arquivo. Tente novamente.');
  };

  return (
    <div className="space-y-2">
      {erroLink && <p className="text-sm text-red-600 dark:text-red-400">{erroLink}</p>}
      <div className="rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
        {documentos.map((documento) => (
          <div key={documento.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <FileSignature className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate" title={nomeDocumento(documento)}>
                  {nomeDocumento(documento)}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">Assinado em {formatDataBR(documento.dataAssinatura)}</div>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => abrir(documento, false)}
                disabled={abrindo !== null}
                title="Visualizar"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Visualizar</span>
              </button>
              <button
                type="button"
                onClick={() => abrir(documento, true)}
                disabled={abrindo !== null}
                title="Baixar"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{abrindo === `${documento.id}:d` ? 'Gerando...' : 'Baixar'}</span>
              </button>
              {onExcluir && (
                <button
                  type="button"
                  onClick={() => onExcluir(documento)}
                  disabled={excluindoId === documento.id}
                  title="Excluir"
                  aria-label="Excluir"
                  className="inline-flex items-center px-2 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentosAssinadosLista;
