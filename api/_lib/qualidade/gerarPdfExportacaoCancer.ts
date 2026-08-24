// api/_lib/qualidade/gerarPdfExportacaoCancer.ts
// Gera a versão em PDF (relatório humano, não o layout oficial do RHC — esse
// é o CSV) da mesma exportação de gerar-exportacao-cancer.ts. Mesmo motivo do
// CSV: PII completa, então é montado aqui (server-side, service_role), nunca
// no browser com a chave anônima.

import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { ParametrosFixosCancer } from './cancerConsulta.js';

export interface LinhaPdfExportacaoCancer {
  codRequisicao: string;
  nomePaciente: string;
  sexo: string;
  dataNascimento: string;
  dtaDiagnostico: string;
  dtaColeta: string;
  topografiaCodigo: string;
  topografiaDescricao: string;
  morfologiaCodigo: string;
  morfologiaDescricao: string;
}

export interface DadosPdfExportacaoCancer {
  ano: number;
  trimestre: 1 | 2 | 3 | 4;
  registrador: string;
  geradoEm: string;
  parametrosFixos: ParametrosFixosCancer;
  linhas: readonly LinhaPdfExportacaoCancer[];
}

function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
}

/**
 * CPF fica de fora do PDF (diferente do CSV): este relatório costuma
 * circular impresso/por e-mail para conferência, não só para quem já tem
 * acesso ao Storage privado — menos PII exposta em trânsito (P10).
 */
export function gerarPdfExportacaoCancer(dados: DadosPdfExportacaoCancer): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margem = 12;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Exportação RHC — ${dados.trimestre}º trimestre de ${dados.ano}`, margem, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    [
      `Registrador: ${dados.registrador}`,
      `Gerado em: ${formatarDataHora(dados.geradoEm)}`,
      `Total de casos: ${dados.linhas.length}`,
    ].join('   |   '),
    margem,
    22,
  );

  const { cnes, fonte, municipio, estado, regiaoAdministrativa } = dados.parametrosFixos;
  doc.text(
    `CNES: ${cnes}   |   Fonte: ${fonte}   |   Município/UF: ${municipio}/${estado}   |   Região administrativa: ${regiaoAdministrativa}`,
    margem,
    27,
  );

  autoTable(doc, {
    startY: 32,
    margin: { left: margem, right: margem },
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 58, 138] },
    head: [['Cód. Requisição', 'Paciente', 'Sexo', 'Nascimento', 'Dta Diagnóstico', 'Dta Coleta', 'Topografia', 'Morfologia']],
    body: dados.linhas.map((linha) => [
      linha.codRequisicao,
      linha.nomePaciente,
      linha.sexo,
      linha.dataNascimento,
      linha.dtaDiagnostico,
      linha.dtaColeta,
      `${linha.topografiaCodigo} — ${linha.topografiaDescricao}`,
      `${linha.morfologiaCodigo} — ${linha.morfologiaDescricao}`,
    ]),
  });

  return Buffer.from(doc.output('arraybuffer'));
}
