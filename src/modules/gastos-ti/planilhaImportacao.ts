// Leitura e escrita dos arquivos .xlsx da importação (issue 09). Fica fora de
// domain/ porque depende da biblioteca xlsx, mas não da tela — é o que o
// modal chama e o que o teste de ida e volta exercita.

import * as XLSX from 'xlsx';
import { DEPARTMENTS } from '../../utils/permissions';
import { mapearCabecalhos, type CampoImportacao } from './domain/importacao';
import { chaveTexto } from './domain/listaDespesas';
import { ABA_DESPESAS, CABECALHOS_MODELO, abaInstrucoes, abaListas } from './domain/modeloImportacao';

export type LeituraPlanilha =
  | { ok: true; linhas: Record<string, unknown>[]; mapa: Map<CampoImportacao, string> }
  | { ok: false; erro: string };

const cabecalhosDa = (aba: XLSX.WorkSheet): string[] => {
  const [linha = []] = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, defval: '' });
  return (linha as unknown[]).map((c) => String(c));
};

/**
 * Lê as despesas de um .xlsx/.xls/.csv. A aba usada é, nesta ordem: a que se
 * chama Despesas; a primeira cujo cabeçalho tem todas as colunas obrigatórias
 * (aba renomeada); a primeira do arquivo (só para a mensagem de erro).
 * `raw: true` mantém número como número — datas digitadas no Excel chegam como
 * serial e são convertidas pelo importador.
 */
export function lerPlanilhaDespesas(conteudo: ArrayBuffer | Uint8Array): LeituraPlanilha {
  let livro: XLSX.WorkBook;
  try {
    livro = XLSX.read(conteudo, { type: 'array' });
  } catch {
    return { ok: false, erro: 'Não foi possível ler o arquivo. Confira se é um .xlsx, .xls ou .csv válido.' };
  }
  const nomeAba =
    livro.SheetNames.find((n) => chaveTexto(n) === chaveTexto(ABA_DESPESAS)) ??
    livro.SheetNames.find((n) => mapearCabecalhos(cabecalhosDa(livro.Sheets[n])).faltando.length === 0) ??
    livro.SheetNames[0];
  const aba = nomeAba ? livro.Sheets[nomeAba] : undefined;
  if (!aba) return { ok: false, erro: 'O arquivo não tem nenhuma aba.' };

  const { mapa, faltando } = mapearCabecalhos(cabecalhosDa(aba));
  if (faltando.length > 0) {
    return { ok: false, erro: `Colunas obrigatórias ausentes: ${faltando.join(', ')}. Baixe o modelo para conferir o formato.` };
  }
  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(aba, { defval: '', raw: true });
  if (linhas.length === 0) {
    return { ok: false, erro: 'A aba Despesas está vazia: preencha uma linha por despesa abaixo do cabeçalho.' };
  }
  return { ok: true, linhas, mapa };
}

/** O modelo com as abas Despesas (só cabeçalho), Instruções e Listas. */
export function livroModelo(categoriasAtivas: readonly string[]): XLSX.WorkBook {
  const livro = XLSX.utils.book_new();
  const despesas = XLSX.utils.aoa_to_sheet([CABECALHOS_MODELO]);
  despesas['!cols'] = CABECALHOS_MODELO.map((c) => ({ wch: Math.max(14, c.length + 4) }));
  XLSX.utils.book_append_sheet(livro, despesas, ABA_DESPESAS);
  const instrucoes = XLSX.utils.aoa_to_sheet(abaInstrucoes());
  instrucoes['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 60 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(livro, instrucoes, 'Instruções');
  const listas = XLSX.utils.aoa_to_sheet(abaListas(categoriasAtivas, DEPARTMENTS as string[]));
  listas['!cols'] = Array.from({ length: 7 }, () => ({ wch: 26 }));
  XLSX.utils.book_append_sheet(livro, listas, 'Listas');
  return livro;
}
