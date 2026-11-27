// Escolha dos arquivos do pedido médico e o envio à IA, comum às janelas de leitura dos
// modos particular e colaborador. A validação é a de domain/pedidoMedico.

import { useState } from 'react';
import { problemaNosArquivosDoPedido } from '../domain/pedidoMedico';

/** Estado da escolha dos arquivos e do envio à IA. */
export interface ArquivosDoPedido {
  arquivos: File[];
  /** Por que os arquivos escolhidos não podem ir à análise (null quando podem). */
  problema: string | null;
  erro: string | null;
  analisando: boolean;
  incluir: (novos: File[]) => void;
  remover: (indice: number) => void;
  /** Valida e envia; a falha vira `erro`, com a mensagem pronta para a tela. */
  analisar: () => Promise<void>;
  /** Volta ao começo, sem arquivos nem erro ("Ler outro pedido"). */
  limpar: () => void;
}

/** Arquivos escolhidos e o envio à IA; `enviar` recebe os arquivos já validados. */
export function useArquivosDoPedido(enviar: (arquivos: File[]) => Promise<void>): ArquivosDoPedido {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  return {
    arquivos,
    problema: arquivos.length > 0 ? problemaNosArquivosDoPedido(arquivos) : null,
    erro,
    analisando,
    incluir: (novos) => {
      setErro(null);
      setArquivos((atuais) => [
        ...atuais,
        ...novos.filter((n) => !atuais.some((a) => a.name === n.name && a.size === n.size)),
      ]);
    },
    remover: (indice) => {
      setErro(null);
      setArquivos((atuais) => atuais.filter((_, j) => j !== indice));
    },
    analisar: async () => {
      const motivo = problemaNosArquivosDoPedido(arquivos);
      if (motivo) {
        setErro(motivo);
        return;
      }
      setAnalisando(true);
      setErro(null);
      try {
        await enviar(arquivos);
      } catch (err) {
        setErro(err instanceof Error && err.message ? err.message : 'Não foi possível analisar o pedido médico.');
      } finally {
        setAnalisando(false);
      }
    },
    limpar: () => {
      setArquivos([]);
      setErro(null);
    },
  };
}
