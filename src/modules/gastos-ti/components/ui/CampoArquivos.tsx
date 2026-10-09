import React, { useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { ACCEPT_ANEXOS, formatarTamanho, validarArquivo } from '../../domain/anexos';

interface CampoArquivosProps {
  id: string;
  arquivos: File[];
  onMudar: (arquivos: File[]) => void;
}

/**
 * Arquivos escolhidos no formulário, enviados só depois que o registro é
 * gravado (uma despesa nova ainda não tem id para o caminho no storage).
 * Arquivo inválido é recusado aqui, com a mensagem, e não entra na lista.
 */
const CampoArquivos: React.FC<CampoArquivosProps> = ({ id, arquivos, onMudar }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [erros, setErros] = useState<string[]>([]);

  const escolher = (lista: FileList | null) => {
    if (!lista) return;
    const novos = Array.from(lista);
    const invalidos = novos.map(validarArquivo).filter((m): m is string => m !== null);
    setErros(invalidos);
    onMudar([...arquivos, ...novos.filter((a) => validarArquivo(a) === null)]);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        multiple
        accept={ACCEPT_ANEXOS}
        onChange={(e) => escolher(e.target.files)}
        className="sr-only"
      />
      <label
        htmlFor={id}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-dashed border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 cursor-pointer transition-colors"
      >
        <Paperclip className="w-4 h-4" /> Escolher arquivos
      </label>
      <span className="ml-2 text-xs text-slate-400">PDF, PNG ou JPEG, até 10 MB cada.</span>

      {arquivos.length > 0 && (
        <ul className="mt-2 space-y-1">
          {arquivos.map((a, i) => (
            <li key={`${a.name}-${i}`} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <span className="truncate">{a.name}</span>
              <span className="text-xs text-slate-400 flex-shrink-0">{formatarTamanho(a.size)}</span>
              <button
                type="button"
                onClick={() => onMudar(arquivos.filter((_, j) => j !== i))}
                aria-label={`Tirar ${a.name}`}
                className="p-0.5 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {erros.map((m) => (
        <p key={m} className="mt-1 text-xs text-red-600 dark:text-red-400">
          {m}
        </p>
      ))}
    </div>
  );
};

export default CampoArquivos;
