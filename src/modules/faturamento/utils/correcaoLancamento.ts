// Regra pura da correção de lançamentos pelo "Editar título"
// (.scratch/titulos-edicao-lancamentos/spec.md): compara o lançamento como
// estava com o que o operador editou, valida como o lançamento original
// valida, e monta o corpo de `fat_corrigir_lancamento` só com o que mudou.
// O banco repete as validações — esta camada existe para a mensagem sair
// antes da ida ao servidor e para o "nenhuma alteração" não gerar auditoria.

import type {
  AlteracaoLancamento,
  BaixaCampos,
  CorrecaoLancamentoPayload,
  GlosaCampos,
  GlosaLancada,
  GlosaStatus,
} from '../types';
import { formatCurrency, formatData } from './formato';

/** Glosa na tela de edição: `id` null = incluída agora. `status` só é
 *  escolhido para a nova; a existente mantém o dela. */
export interface GlosaEmEdicao extends GlosaCampos {
  id: string | null;
  status: GlosaStatus;
}

export interface EntradaCorrecao {
  notaId: string;
  /** null = grupo das glosas sem baixa. */
  recebimentoId: string | null;
  motivo: string;
  original: { baixa: BaixaCampos | null; glosas: GlosaLancada[] };
  /** Glosa removida da lista = excluída. */
  editado: { baixa: BaixaCampos | null; glosas: GlosaEmEdicao[] };
}

export type ResultadoCorrecao =
  | { erro: string }
  | { payload: CorrecaoLancamentoPayload; camposAlterados: string[] };

const ROTULOS_BAIXA: Record<keyof BaixaCampos, string> = {
  valorRecebido: 'Valor recebido',
  dataReceb: 'Data',
  formaRecebimento: 'Forma',
  bancoNome: 'Banco',
  bancoConta: 'Conta',
  observacoes: 'Observações',
};

const ROTULOS_GLOSA: Record<keyof GlosaCampos, string> = {
  valor: 'valor',
  motivo: 'motivo',
  requisicaoId: 'guia',
  loteId: 'lote',
};

const centavos = (valor: number): number => Math.round((Number(valor) || 0) * 100);

const textoOuNulo = (valor: string | null): string | null => {
  const limpo = valor?.trim() ?? '';
  return limpo === '' ? null : limpo;
};

function normalizarBaixa(baixa: BaixaCampos): BaixaCampos {
  return {
    valorRecebido: centavos(baixa.valorRecebido) / 100,
    dataReceb: textoOuNulo(baixa.dataReceb),
    formaRecebimento: textoOuNulo(baixa.formaRecebimento),
    bancoNome: textoOuNulo(baixa.bancoNome),
    bancoConta: textoOuNulo(baixa.bancoConta),
    observacoes: textoOuNulo(baixa.observacoes),
  };
}

function normalizarGlosa(glosa: GlosaCampos): GlosaCampos {
  return {
    valor: centavos(glosa.valor) / 100,
    motivo: glosa.motivo.trim(),
    requisicaoId: glosa.requisicaoId || null,
    loteId: glosa.loteId || null,
  };
}

function camposDiferentes<T extends object>(antes: T, depois: T): (keyof T)[] {
  return (Object.keys(antes) as (keyof T)[]).filter((campo) => antes[campo] !== depois[campo]);
}

export function montarCorrecao(entrada: EntradaCorrecao): ResultadoCorrecao {
  const motivo = entrada.motivo.trim();
  if (!motivo) return { erro: 'Informe o motivo da correção.' };

  const glosasEditadas = entrada.editado.glosas.map((g) => ({ ...g, ...normalizarGlosa(g) }));
  if (glosasEditadas.some((g) => !g.motivo)) return { erro: 'Toda glosa precisa de um motivo.' };
  if (glosasEditadas.some((g) => !(g.valor > 0))) {
    return { erro: 'Toda glosa precisa de um valor maior que zero.' };
  }

  const camposAlterados: string[] = [];
  let baixa: BaixaCampos | undefined;
  if (entrada.recebimentoId !== null && entrada.original.baixa && entrada.editado.baixa) {
    // Antes de normalizar: `centavos` transformaria o campo apagado (NaN) em 0.
    if (!Number.isFinite(entrada.editado.baixa.valorRecebido)) return { erro: 'Informe o valor recebido.' };
    const antes = normalizarBaixa(entrada.original.baixa);
    const depois = normalizarBaixa(entrada.editado.baixa);
    if (depois.valorRecebido < 0) return { erro: 'Valor recebido não pode ser negativo.' };
    if (!depois.dataReceb) return { erro: 'Informe a data do recebimento.' };
    if (depois.valorRecebido === 0 && glosasEditadas.length === 0) {
      return { erro: 'A baixa ficaria sem valor e sem glosas — use "Excluir baixa" em vez disso.' };
    }
    const diferentes = camposDiferentes(antes, depois);
    if (diferentes.length > 0) {
      baixa = depois;
      camposAlterados.push(...diferentes.map((campo) => ROTULOS_BAIXA[campo]));
    }
  }

  const originaisPorId = new Map(entrada.original.glosas.map((g) => [g.id, g]));
  const glosasAlteradas: CorrecaoLancamentoPayload['glosasAlteradas'] = [];
  const glosasNovas: CorrecaoLancamentoPayload['glosasNovas'] = [];
  for (const glosa of glosasEditadas) {
    const campos = normalizarGlosa(glosa);
    const original = glosa.id ? originaisPorId.get(glosa.id) : undefined;
    if (!glosa.id || !original) {
      glosasNovas.push({ ...campos, status: glosa.status });
      camposAlterados.push('Glosa incluída');
      continue;
    }
    const diferentes = camposDiferentes(normalizarGlosa(original), campos);
    if (diferentes.length > 0) {
      glosasAlteradas.push({ id: glosa.id, ...campos });
      camposAlterados.push(...diferentes.map((campo) => `Glosa: ${ROTULOS_GLOSA[campo]}`));
    }
  }

  const mantidas = new Set(glosasEditadas.map((g) => g.id).filter(Boolean));
  const glosasExcluidas = entrada.original.glosas.filter((g) => !mantidas.has(g.id)).map((g) => g.id);
  camposAlterados.push(...glosasExcluidas.map(() => 'Glosa excluída'));

  if (camposAlterados.length === 0) return { erro: 'Nenhuma alteração para salvar.' };

  return {
    payload: {
      notaId: entrada.notaId,
      recebimentoId: entrada.recebimentoId,
      motivo,
      ...(baixa ? { baixa } : {}),
      glosasAlteradas,
      glosasNovas,
      glosasExcluidas,
    },
    camposAlterados,
  };
}

// ─── Histórico ──────────────────────────────────────────────────────────────

const ENTIDADE_ROTULO: Record<AlteracaoLancamento['entidade'], string> = { baixa: 'Baixa', glosa: 'Glosa' };

/** Colunas gravadas em `notas_lancamentos_audit_logs.campo` (nomes do banco). */
const CAMPO_ROTULO: Record<string, string> = {
  valor_recebido: 'valor recebido',
  data_receb: 'data',
  forma_recebimento: 'forma',
  banco_nome: 'banco',
  banco_conta: 'conta',
  observacoes: 'observações',
  valor: 'valor',
  motivo: 'motivo',
  requisicao_id: 'guia',
  lote_id: 'lote',
};

const CAMPOS_MOEDA = new Set(['valor_recebido', 'valor']);

/** Uma linha da seção "Alterações": o que mudou e os valores já formatados.
 *  Inclusão/exclusão não têm campo — o valor envolvido vai em de/para. */
export function descreverAlteracao(alteracao: AlteracaoLancamento): { oQue: string; de: string; para: string } {
  const entidade = ENTIDADE_ROTULO[alteracao.entidade];
  const moeda = alteracao.acao !== 'alteracao' || CAMPOS_MOEDA.has(alteracao.campo ?? '');
  const formatar = (valor: string | null): string => {
    if (valor === null || valor === '') return '—';
    if (moeda) return formatCurrency(Number(valor));
    if (alteracao.campo === 'data_receb') return formatData(valor);
    return valor;
  };

  const oQue = alteracao.acao === 'inclusao'
    ? `${entidade} incluída`
    : alteracao.acao === 'exclusao'
      ? `${entidade} excluída`
      : `${entidade} · ${CAMPO_ROTULO[alteracao.campo ?? ''] ?? alteracao.campo ?? ''}`;

  return { oQue, de: formatar(alteracao.valorAnterior), para: formatar(alteracao.valorNovo) };
}
