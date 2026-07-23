// api/_lib/apoio/catalogo.ts
// Catálogo de exames do apoio (ac_apoio_exames) — port da "tabela Pardini" do
// envio_alvaro. Três papéis: (1) tabela embutida no prompt do Gemini, (2) busca
// fuzzy por nome para corrigir/completar códigos pós-OCR, (3) enriquecimento dos
// exames extraídos com cod_material/preço antes de gerar o XML AOL.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PipelineLog } from './log.js';

export interface CatalogoEntrada {
  cod_exame: string;
  descricao: string;
  desc_material: string;
  cod_material: string;
  valor: string;
  descNorm: string;
}

// Exame extraído da imagem (contrato do JSON pedido ao Gemini + campos que o
// enriquecimento adiciona). snake_case de propósito: é o formato persistido no
// jsonb `exames` de ac_apoio_fila, compatível com os dados migrados do legado.
export interface ExameImagem {
  nome_original?: string;
  nome_normalizado?: string;
  codigo_aol_sugerido?: string | null;
  cod_material?: string | null;
  desc_material?: string | null;
  nome_pardini?: string | null;
  material?: string | null;
  urgente?: boolean;
  certeza?: number;
  valor?: string;
  fonte_codigo?: string;
}

// Normaliza p/ comparação: maiúsculas, sem acentos, só alfanumérico e espaço.
export function normalizar(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove os diacríticos separados pelo NFD
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

// Tokens curtos/genéricos não podem virar match sozinhos.
const TOKENS_GENERICOS = new Set([
  'DE', 'DO', 'DA', 'E', 'A', 'O', 'EM', 'COM', 'PARA', 'OU',
  'TOTAL', 'LIVRE', 'BASAL', 'SORO', 'SANGUE', 'URINA',
]);

const PAGINA = 1000;

export async function carregarCatalogo(supabase: SupabaseClient): Promise<CatalogoEntrada[]> {
  const catalogo: CatalogoEntrada[] = [];
  for (let offset = 0; ; offset += PAGINA) {
    const { data, error } = await supabase
      .from('ac_apoio_exames')
      .select('id,cod_exame,descricao_exame,descricao_material,cod_material,preco')
      .order('id', { ascending: true })
      .range(offset, offset + PAGINA - 1);
    if (error) throw new Error(`Falha ao carregar ac_apoio_exames: ${error.message}`);

    const rows = data ?? [];
    for (const row of rows) {
      const cod = String(row.cod_exame ?? '').trim();
      const desc = String(row.descricao_exame ?? '').trim();
      if (!cod && !desc) continue;
      catalogo.push({
        cod_exame: cod,
        descricao: desc,
        desc_material: String(row.descricao_material ?? '').trim(),
        cod_material: String(row.cod_material ?? '').trim(),
        valor: row.preco === null || row.preco === undefined ? '' : String(row.preco),
        descNorm: normalizar(desc),
      });
    }
    if (rows.length < PAGINA) break;
  }
  return catalogo;
}

/**
 * Busca um exame no catálogo com 4 níveis de match (prioridade decrescente):
 *   1. código exato  2. descrição exata
 *   3. todos os tokens significativos do nome contidos na descrição
 *   4. maior interseção de tokens (mínimo 2)
 */
export function buscarNoCatalogo(
  nomeExame: string,
  catalogo: CatalogoEntrada[],
): CatalogoEntrada | null {
  if (catalogo.length === 0) return null;

  const nomeNorm = normalizar(nomeExame);
  const tokensSig = new Set(nomeNorm.split(' ').filter((t) => t && !TOKENS_GENERICOS.has(t)));

  const porCodigo = catalogo.find(
    (e) => nomeNorm === e.cod_exame.toUpperCase() || nomeExame.toUpperCase().trim() === e.cod_exame.toUpperCase(),
  );
  if (porCodigo) return porCodigo;

  const porDescricao = catalogo.find((e) => nomeNorm === e.descNorm);
  if (porDescricao) return porDescricao;

  let melhorSuperset: CatalogoEntrada | null = null;
  let melhorSupersetLen = 0;
  let melhorIntersecao: CatalogoEntrada | null = null;
  let melhorIntersecaoLen = 0;

  for (const e of catalogo) {
    const descTokens = new Set(e.descNorm.split(' '));
    const intersecao = [...tokensSig].filter((t) => descTokens.has(t)).length;

    if (tokensSig.size > 0 && intersecao === tokensSig.size && tokensSig.size > melhorSupersetLen) {
      melhorSuperset = e;
      melhorSupersetLen = tokensSig.size;
    }
    if (intersecao >= 2 && intersecao > melhorIntersecaoLen) {
      melhorIntersecao = e;
      melhorIntersecaoLen = intersecao;
    }
  }
  return melhorSuperset ?? melhorIntersecao;
}

// Preenche o exame com os dados de uma entrada do catálogo.
function aplicarEntrada(ex: ExameImagem, entrada: CatalogoEntrada, fonte: string): void {
  ex.codigo_aol_sugerido = entrada.cod_exame;
  ex.cod_material = entrada.cod_material;
  ex.desc_material = entrada.desc_material;
  ex.nome_pardini = entrada.descricao;
  ex.valor = entrada.valor;
  ex.fonte_codigo = fonte;
}

/**
 * Etapa pós-OCR: valida e completa os códigos que o Gemini retornou usando o
 * catálogo (mesmos fluxos A/B/C do envio_alvaro):
 *   A) código+material do Gemini → valida no catálogo; se o código não existe,
 *      tenta corrigir pelo nome.
 *   B) só código → completa material/preço pelo catálogo.
 *   C) nada → busca fuzzy pelo nome; sem match, marca 'sem_match'.
 */
export function enriquecerCodigos(
  exames: ExameImagem[],
  catalogo: CatalogoEntrada[],
  log: PipelineLog,
): ExameImagem[] {
  const porCodigo = new Map(catalogo.map((e) => [e.cod_exame.toUpperCase(), e]));
  const comMatch: string[] = [];
  const semMatch: string[] = [];

  const buscarPorNome = (ex: ExameImagem): CatalogoEntrada | null => {
    for (const campo of ['nome_normalizado', 'nome_original'] as const) {
      const valor = String(ex[campo] ?? '').trim();
      if (valor) {
        const entrada = buscarNoCatalogo(valor, catalogo);
        if (entrada) return entrada;
      }
    }
    return null;
  };

  for (const ex of exames) {
    const codGemini = String(ex.codigo_aol_sugerido ?? '').trim();
    const matGemini = String(ex.cod_material ?? '').trim();
    const nome = ex.nome_original ?? ex.nome_normalizado ?? '?';

    // A) Gemini preencheu código E material
    if (codGemini && matGemini) {
      const entrada = porCodigo.get(codGemini.toUpperCase());
      if (entrada) {
        // Código válido — completa faltantes; cod_material do catálogo é mais confiável
        ex.nome_pardini = ex.nome_pardini ?? entrada.descricao;
        ex.desc_material = ex.desc_material ?? entrada.desc_material;
        ex.cod_material = entrada.cod_material;
        ex.valor = entrada.valor;
        ex.fonte_codigo = 'gemini_catalogo';
        comMatch.push(`${nome} -> ${codGemini} [validado] mat=${entrada.cod_material}`);
      } else {
        // Código que o Gemini inventou — tenta corrigir pelo nome
        const corrigida = buscarPorNome(ex);
        if (corrigida) {
          aplicarEntrada(ex, corrigida, 'catalogo_correcao');
          comMatch.push(`${nome} -> ${corrigida.cod_exame} [corrigido de '${codGemini}']`);
        } else {
          ex.fonte_codigo = 'gemini_nao_validado';
          semMatch.push(`${nome} (código '${codGemini}' não está no catálogo)`);
        }
      }
      continue;
    }

    // B) Só o código, sem material
    if (codGemini && !matGemini) {
      const entrada = porCodigo.get(codGemini.toUpperCase());
      if (entrada) {
        ex.cod_material = entrada.cod_material;
        ex.desc_material = entrada.desc_material;
        ex.nome_pardini = ex.nome_pardini ?? entrada.descricao;
        ex.valor = entrada.valor;
        ex.fonte_codigo = 'gemini_catalogo';
        comMatch.push(`${nome} -> ${codGemini} [material completado]`);
        continue;
      }
      // Código inválido: cai no fluxo C
    }

    // C) Busca fuzzy pelo nome
    const entrada = buscarPorNome(ex);
    if (entrada) {
      aplicarEntrada(ex, entrada, 'catalogo');
      comMatch.push(`${nome} -> ${entrada.cod_exame} [fuzzy] mat=${entrada.cod_material}`);
      continue;
    }

    if (!ex.codigo_aol_sugerido) {
      ex.fonte_codigo = 'sem_match';
      semMatch.push(nome);
    }
  }

  if (comMatch.length) log.ok(`Correlação com catálogo: ${comMatch.length} exame(s) resolvido(s)`, comMatch);
  if (semMatch.length) log.warn(`${semMatch.length} exame(s) sem código confirmado no catálogo`, semMatch);
  return exames;
}

// Tabela compacta (uma linha por exame) para embutir no prompt do Gemini.
export function catalogoParaPrompt(catalogo: CatalogoEntrada[]): string {
  if (catalogo.length === 0) {
    return '(Catalogo de exames nao disponivel — use conhecimento geral para sugerir codigos)';
  }
  const ordenado = [...catalogo].sort((a, b) => a.cod_exame.localeCompare(b.cod_exame));
  const linhas = [
    `TABELA DE CATALOGO DE EXAMES (${ordenado.length} registros — use para correlacionar exames da imagem):`,
    'COD_EXAME    | DESCRICAO_EXAME                                         | DESCRICAO_MATERIAL              | COD_MAT | PRECO',
    '-'.repeat(110),
  ];
  for (const e of ordenado) {
    const desc = e.descricao.slice(0, 55).padEnd(55);
    const mat = e.desc_material.slice(0, 30).padEnd(30);
    const preco = (e.valor || '').slice(0, 10).padEnd(10);
    linhas.push(`${e.cod_exame.padEnd(12)} | ${desc} | ${mat} | ${e.cod_material.padEnd(7)} | ${preco}`);
  }
  return linhas.join('\n');
}
