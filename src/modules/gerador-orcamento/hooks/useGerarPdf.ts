// Geração dos PDFs do Gerador de Orçamento na tela: carrega o logo, monta o documento com a
// data de emissão, salva como "<prefixo>_dd-mm-aaaa.pdf" e guarda o estado de "gerando" e
// do erro. O que vai no documento fica com quem chama (montadores puros em ../domain).

import { useState } from 'react';
import type jsPDF from 'jspdf';
import { carregarLogoPdf } from '../logoPdf';

type Montar = (emitidoEm: Date, logo: string | null) => jsPDF;

/** `T` nomeia os PDFs da tela (ex.: 'cliente' | 'interno'), para saber qual está sendo gerado. */
export function useGerarPdf<T extends string>() {
  const [gerando, setGerando] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const gerar = async (tipo: T, prefixoArquivo: string, montar: Montar) => {
    setGerando(tipo);
    setErro(null);
    try {
      const emitidoEm = new Date();
      const doc = montar(emitidoEm, await carregarLogoPdf());
      doc.save(`${prefixoArquivo}_${emitidoEm.toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
    } catch (error) {
      console.error(`Falha ao gerar o PDF ${prefixoArquivo}:`, error);
      setErro('Não foi possível gerar o PDF. Tente de novo.');
    } finally {
      setGerando(null);
    }
  };

  return { gerando, erro, gerar };
}
