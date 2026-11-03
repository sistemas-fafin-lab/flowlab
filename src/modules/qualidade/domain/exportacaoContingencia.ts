// Conteúdo da exportação de planos de contingência (PDF e Word, avulso ou em ZIP):
// campos na mesma ordem do drawer de detalhe e nomes de arquivo. Sem jsPDF/docx aqui —
// quem desenha é exportacaoContingencia.ts, na raiz do módulo.

import type { PlanoContingenciaDTO } from '../types';

export type FormatoExportacao = 'pdf' | 'docx';

export interface CampoExportado {
  rotulo: string;
  /** Parágrafos do valor; `['—']` quando o campo está vazio. */
  paragrafos: string[];
}

const CAMPOS: { rotulo: string; valor: (p: PlanoContingenciaDTO) => string | null }[] = [
  { rotulo: 'Evento', valor: (p) => p.evento },
  { rotulo: 'Prazo máximo de interrupção', valor: (p) => p.prazoMaximoInterrupcao },
  { rotulo: 'Cenário', valor: (p) => p.cenario },
  { rotulo: 'Impactos', valor: (p) => p.impactos },
  { rotulo: 'Gatilho de acionamento', valor: (p) => p.gatilhoAcionamento },
  { rotulo: 'Ações imediatas', valor: (p) => p.acoesImediatas },
  { rotulo: 'Responsáveis', valor: (p) => p.responsaveis },
  { rotulo: 'Comunicação', valor: (p) => p.comunicacao },
  { rotulo: 'Materiais', valor: (p) => p.materiais },
  { rotulo: 'Fornecedor alternativo', valor: (p) => p.fornecedorAlternativo },
];

/**
 * Os textos chegam com tópicos na mesma linha ("• A: ... • B: ..." ou "1. A. 2. B.").
 * No documento cada tópico vira um parágrafo; quebras de linha digitadas são mantidas.
 * Item numerado só quebra depois de fim de frase, para não partir "versão 2. x".
 */
export function separarParagrafos(texto: string | null): string[] {
  const paragrafos = (texto ?? '')
    .split(/\r?\n|\s+(?=•\s)|(?<=[.;:!?])\s+(?=\d{1,2}[.)]\s)/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragrafos.length > 0 ? paragrafos : ['—'];
}

export function camposDoPlano(plano: PlanoContingenciaDTO): CampoExportado[] {
  return CAMPOS.map(({ rotulo, valor }) => ({ rotulo, paragrafos: separarParagrafos(valor(plano)) }));
}

const MAX_BASE_NOME = 80;

/** "PC_TI-002 - Ataque de Ransomware.pdf", sem caracteres proibidos no Windows. */
export function nomeArquivoPlano(plano: Pick<PlanoContingenciaDTO, 'codigo' | 'evento'>, formato: FormatoExportacao): string {
  const base = [plano.codigo, plano.evento]
    .map((parte) => parte.replace(/[<>:"/\\|?*]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' - ')
    .slice(0, MAX_BASE_NOME)
    .replace(/[\s.]+$/, '');
  return `${base || 'plano-de-contingencia'}.${formato}`;
}

/** Nomes dentro do ZIP: dois planos com mesmo código e evento ganham " (2)", " (3)"… */
export function nomesUnicos(nomes: readonly string[]): string[] {
  const usados = new Set<string>();
  return nomes.map((nome) => {
    const ponto = nome.lastIndexOf('.');
    const [base, ext] = ponto > 0 ? [nome.slice(0, ponto), nome.slice(ponto)] : [nome, ''];
    let candidato = nome;
    for (let n = 2; usados.has(candidato.toLowerCase()); n++) candidato = `${base} (${n})${ext}`;
    usados.add(candidato.toLowerCase());
    return candidato;
  });
}

/** "planos-de-contingencia-2026-11-03.zip" */
export function nomeArquivoZip(emitidoEm: Date): string {
  const ano = emitidoEm.getFullYear();
  const mes = String(emitidoEm.getMonth() + 1).padStart(2, '0');
  const dia = String(emitidoEm.getDate()).padStart(2, '0');
  return `planos-de-contingencia-${ano}-${mes}-${dia}.zip`;
}
