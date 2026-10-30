import React, { useRef, useState } from 'react';
import { FileUp, FileText } from 'lucide-react';
import DocumentoModalShell from './DocumentoModalShell';
import { inputClassName, labelClassName } from '../sections/SecaoFicha';
import { TIPOS_DOCUMENTO, TIPO_DOCUMENTO_LABEL } from '../../utils/rotulosDocumentos';
import { validarArquivoDocumento, validarEnvioDocumento, type ErrosEnvioDocumento } from '../../utils/documentoEnvio';
import { dataDeHojeISO } from '../../utils/colaboradorFormato';
import type { EnviarDocumentoInput } from '../../hooks/useDocumentosColaborador';
import type { TipoDocumento } from '../../types';

interface EnviarDocumentoModalProps {
  colaboradorNome: string;
  onClose: () => void;
  /** Devolve a mensagem de erro ou null; com erro o modal fica aberto com os dados preenchidos. */
  onEnviar: (dados: EnviarDocumentoInput) => Promise<string | null>;
}

const formatTamanho = (bytes: number): string =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;

const Erro: React.FC<{ texto?: string }> = ({ texto }) =>
  texto ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{texto}</p> : null;

const EnviarDocumentoModal: React.FC<EnviarDocumentoModalProps> = ({ colaboradorNome, onClose, onEnviar }) => {
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [tipo, setTipo] = useState<TipoDocumento | ''>('');
  const [nomeOutro, setNomeOutro] = useState('');
  const [dataAssinatura, setDataAssinatura] = useState('');
  const [erros, setErros] = useState<ErrosEnvioDocumento>({});
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const hoje = dataDeHojeISO();

  /** O erro de um campo some assim que ele é alterado; os demais esperam o próximo envio. */
  const limparErro = (campo: keyof ErrosEnvioDocumento) =>
    setErros((atuais) => (atuais[campo] ? { ...atuais, [campo]: undefined } : atuais));

  const selecionarArquivo = (selecionado: File | null) => {
    if (!selecionado) return;
    const erro = validarArquivoDocumento(selecionado);
    setErros((atuais) => ({ ...atuais, arquivo: erro ?? undefined }));
    setArquivo(erro ? null : selecionado);
  };

  const enviar = async () => {
    const novosErros = validarEnvioDocumento({ arquivo, tipo, nomeOutro, dataAssinatura }, hoje);
    setErros(novosErros);
    setErroEnvio(null);
    if (Object.keys(novosErros).length > 0 || !arquivo || !tipo) return;

    setEnviando(true);
    const erro = await onEnviar({ arquivo, tipo, nomeOutro: tipo === 'outro' ? nomeOutro : null, dataAssinatura });
    setEnviando(false);
    if (erro) setErroEnvio(erro);
  };

  return (
    <DocumentoModalShell
      tituloId="enviar-documento-titulo"
      sobretitulo="Documentos assinados"
      titulo="Enviar documento"
      onClose={onClose}
      bloqueado={enviando}
      larguraClassName="sm:max-w-[560px]"
      rodape={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={enviando}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {enviando ? 'Enviando...' : 'Enviar documento'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-sm text-blue-800 dark:text-blue-200">
          Colaborador: <strong>{colaboradorNome}</strong>
        </div>

        <div>
          <span className={labelClassName}>Arquivo (PDF, até 20 MB)</span>
          <input
            ref={inputArquivoRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              selecionarArquivo(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => inputArquivoRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              selecionarArquivo(e.dataTransfer.files?.[0] ?? null);
            }}
            disabled={enviando}
            className={`w-full rounded-xl border-2 border-dashed px-4 py-5 text-sm flex items-center justify-center gap-3 transition-colors disabled:opacity-50 ${
              erros.arquivo
                ? 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400'
                : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-300 hover:bg-blue-50/40 dark:hover:bg-blue-900/10'
            }`}
          >
            {arquivo ? (
              <>
                <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                <span className="min-w-0 text-left">
                  <span className="block font-medium text-gray-800 dark:text-gray-100 truncate">{arquivo.name}</span>
                  <span className="block text-xs">{formatTamanho(arquivo.size)} · clique para trocar</span>
                </span>
              </>
            ) : (
              <>
                <FileUp className="w-5 h-5 shrink-0" />
                Clique ou arraste o PDF assinado
              </>
            )}
          </button>
          <Erro texto={erros.arquivo} />
        </div>

        <div>
          <label htmlFor="documento-tipo" className={labelClassName}>Tipo de documento</label>
          <select
            id="documento-tipo"
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as TipoDocumento | '');
              limparErro('tipo');
            }}
            disabled={enviando}
            className={inputClassName}
          >
            <option value="">Selecione...</option>
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t} value={t}>{TIPO_DOCUMENTO_LABEL[t]}</option>
            ))}
          </select>
          <Erro texto={erros.tipo} />
        </div>

        {tipo === 'outro' && (
          <div>
            <label htmlFor="documento-nome-outro" className={labelClassName}>Nome do documento</label>
            <input
              id="documento-nome-outro"
              type="text"
              value={nomeOutro}
              onChange={(e) => {
                setNomeOutro(e.target.value);
                limparErro('nomeOutro');
              }}
              disabled={enviando}
              maxLength={120}
              placeholder="Ex.: Termo de estágio"
              className={inputClassName}
            />
            <Erro texto={erros.nomeOutro} />
          </div>
        )}

        <div>
          <label htmlFor="documento-data" className={labelClassName}>Data de assinatura</label>
          <input
            id="documento-data"
            type="date"
            value={dataAssinatura}
            max={hoje}
            onChange={(e) => {
              setDataAssinatura(e.target.value);
              limparErro('dataAssinatura');
            }}
            disabled={enviando}
            className={inputClassName}
          />
          <Erro texto={erros.dataAssinatura} />
        </div>

        {erroEnvio && (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {erroEnvio}
          </div>
        )}
      </div>
    </DocumentoModalShell>
  );
};

export default EnviarDocumentoModal;
