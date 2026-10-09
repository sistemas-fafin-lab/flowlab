// Traduz linhas de ti_auditoria (antes/depois em jsonb) em histórico legível
// para o painel da despesa (RF06, RNF02).

import { formatCurrency } from '../../../utils/paymentUtils';
import {
  FORMA_PAGAMENTO_ROTULO,
  MOTIVO_REAJUSTE_ROTULO,
  NATUREZA_ROTULO,
  RECORRENCIA_ROTULO,
  TIPO_VALOR_ROTULO,
} from '../constants';
import { formatarCompetencia } from './competencia';

type Linha = Record<string, unknown>;

export interface EntradaAuditoria {
  id: number;
  tabela: string;
  acao: 'insert' | 'update' | 'delete';
  antes: Linha | null;
  depois: Linha | null;
  autorNome: string | null;
  createdAt: string;
}

export interface ItemHistorico {
  id: number;
  quando: string;
  autor: string;
  titulo: string;
  detalhes: string[];
}

export interface ContextoAuditoria {
  nomeCategoria: (id: string) => string | undefined;
  nomeUsuario: (id: string) => string | undefined;
}

const ROTULOS_DESPESA: Record<string, string> = {
  descricao: 'Descrição',
  categoria_id: 'Categoria',
  natureza: 'Natureza',
  quantidade: 'Quantidade',
  unidade: 'Unidade',
  fornecedor_nome: 'Fornecedor',
  setor: 'Setor',
  responsavel_id: 'Responsável técnico',
  tipo_valor: 'Tipo de valor',
  valor_base: 'Valor base',
  recorrencia: 'Recorrência',
  competencia_inicio: 'Primeira cobrança',
  competencia_fim: 'Última cobrança',
  dia_vencimento: 'Dia do vencimento',
  forma_pagamento: 'Forma de pagamento',
  meio_pagamento_detalhe: 'Identificação do meio',
  moeda_original: 'Moeda original',
  valor_original: 'Valor original',
  numero_contrato: 'Contrato',
  renovacao_automatica: 'Renovação automática',
  aviso_renovacao_dias: 'Aviso de renovação (dias)',
  autorizado_por: 'Autorizado por',
  autorizado_em: 'Data da autorização',
  observacoes: 'Observações',
  anexos: 'Anexos',
};

const ROTULOS_REAJUSTE: Record<string, string> = {
  vigente_desde: 'A partir de',
  valor: 'Valor',
  motivo: 'Motivo',
  quantidade: 'Quantidade',
  observacao: 'Observação',
};

const formatarData = (iso: string): string => {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
};

const rotuloDe = <T extends string>(mapa: Record<T, string>, valor: unknown): string =>
  mapa[valor as T] ?? String(valor);

function formatarValor(campo: string, valor: unknown, ctx: ContextoAuditoria): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  switch (campo) {
    case 'valor_base':
    case 'valor_original':
    case 'valor':
      return formatCurrency(Number(valor));
    case 'competencia_inicio':
    case 'competencia_fim':
    case 'vigente_desde':
      return formatarCompetencia(String(valor));
    case 'autorizado_em':
      return formatarData(String(valor));
    case 'renovacao_automatica':
      return valor ? 'Sim' : 'Não';
    case 'natureza':
      return rotuloDe(NATUREZA_ROTULO, valor);
    case 'recorrencia':
      return rotuloDe(RECORRENCIA_ROTULO, valor);
    case 'forma_pagamento':
      return rotuloDe(FORMA_PAGAMENTO_ROTULO, valor);
    case 'tipo_valor':
      return rotuloDe(TIPO_VALOR_ROTULO, valor);
    case 'motivo':
      return rotuloDe(MOTIVO_REAJUSTE_ROTULO, valor);
    case 'categoria_id':
      return ctx.nomeCategoria(String(valor)) ?? 'categoria removida';
    case 'responsavel_id':
      return ctx.nomeUsuario(String(valor)) ?? 'outro usuário';
    case 'anexos': {
      const n = Array.isArray(valor) ? valor.length : 0;
      return n === 0 ? 'nenhum' : `${n} ${n === 1 ? 'arquivo' : 'arquivos'}`;
    }
    default:
      return String(valor);
  }
}

/** "Rótulo: antes → depois" para cada campo conhecido que mudou, na ordem dos rótulos. */
export function diferencas(antes: Linha, depois: Linha, rotulos: Record<string, string>, ctx: ContextoAuditoria): string[] {
  return Object.entries(rotulos)
    .filter(([campo]) => JSON.stringify(antes[campo] ?? null) !== JSON.stringify(depois[campo] ?? null))
    .map(([campo, rotulo]) => `${rotulo}: ${formatarValor(campo, antes[campo], ctx)} → ${formatarValor(campo, depois[campo], ctx)}`);
}

export function descreverEntrada(e: EntradaAuditoria, ctx: ContextoAuditoria): ItemHistorico {
  const base = { id: e.id, quando: e.createdAt, autor: e.autorNome ?? 'Sistema' };
  const linha = (e.depois ?? e.antes ?? {}) as Linha;

  if (e.tabela === 'ti_despesa_reajustes') {
    const mes = formatarValor('vigente_desde', linha.vigente_desde, ctx);
    if (e.acao === 'insert') {
      const quantidade = linha.quantidade ? ` · quantidade ${linha.quantidade}` : '';
      return {
        ...base,
        titulo: `Reajuste a partir de ${mes}`,
        detalhes: [`${formatarValor('valor', linha.valor, ctx)} (${formatarValor('motivo', linha.motivo, ctx)})${quantidade}`],
      };
    }
    if (e.acao === 'delete') return { ...base, titulo: `Reajuste de ${mes} removido`, detalhes: [] };
    return { ...base, titulo: `Reajuste de ${mes} alterado`, detalhes: diferencas(e.antes ?? {}, e.depois ?? {}, ROTULOS_REAJUSTE, ctx) };
  }

  if (e.tabela === 'ti_despesas') {
    if (e.acao === 'insert') return { ...base, titulo: 'Despesa cadastrada', detalhes: [] };
    if (e.acao === 'delete') return { ...base, titulo: 'Despesa excluída', detalhes: [] };
    const detalhes = diferencas(e.antes ?? {}, e.depois ?? {}, ROTULOS_DESPESA, ctx);
    // Fornecedor apagado do cadastro geral: só o vínculo some, o nome fica.
    if (detalhes.length === 0 && e.antes?.fornecedor_id && !e.depois?.fornecedor_id) {
      return { ...base, titulo: 'Fornecedor desvinculado', detalhes: ['O fornecedor foi removido do cadastro; a despesa manteve o nome.'] };
    }
    return { ...base, titulo: 'Despesa alterada', detalhes };
  }

  return { ...base, titulo: `Alteração em ${e.tabela}`, detalhes: [] };
}
