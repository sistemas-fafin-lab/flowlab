import { describe, expect, it } from 'vitest';
import { descreverEntrada, type EntradaAuditoria } from './auditoria';

const ctx = {
  nomeCategoria: (id: string) => ({ 'cat-ia': 'Inteligência Artificial', 'cat-saas': 'SaaS e Assinaturas' })[id],
  nomeUsuario: (id: string) => ({ u1: 'Ana Souza' })[id],
};

const entrada = (campos: Partial<EntradaAuditoria>): EntradaAuditoria => ({
  id: 1,
  tabela: 'ti_despesas',
  acao: 'update',
  antes: null,
  depois: null,
  autorNome: 'Fulano',
  createdAt: '2026-10-01T12:00:00Z',
  ...campos,
});

// Intl formata "R$ 2.480,00" com espaço não separável (U+00A0).
const legivel = (detalhes: string[]) => detalhes.map((d) => d.replace(/\u00a0/g, ' '));

const despesaBase = {
  id: 'd1',
  descricao: 'M365',
  categoria_id: 'cat-saas',
  valor_base: 2480,
  competencia_fim: null,
  renovacao_automatica: false,
  forma_pagamento: 'boleto',
  responsavel_id: null,
  anexos: [],
  updated_at: '2026-10-01T10:00:00Z',
};

describe('descreverEntrada — despesa', () => {
  it('cadastro e exclusão', () => {
    expect(descreverEntrada(entrada({ acao: 'insert', depois: despesaBase }), ctx).titulo).toBe('Despesa cadastrada');
    expect(descreverEntrada(entrada({ acao: 'delete', antes: despesaBase }), ctx).titulo).toBe('Despesa excluída');
  });

  it('lista só os campos que mudaram, formatados', () => {
    const item = descreverEntrada(
      entrada({
        antes: despesaBase,
        depois: {
          ...despesaBase,
          valor_base: '2600.00',
          categoria_id: 'cat-ia',
          competencia_fim: '2027-06-01',
          renovacao_automatica: true,
          forma_pagamento: 'cartao_corporativo',
          responsavel_id: 'u1',
          anexos: [{ path: 'a.pdf', name: 'contrato.pdf' }],
          updated_at: '2026-10-02T10:00:00Z',
        },
      }),
      ctx,
    );
    expect(item.titulo).toBe('Despesa alterada');
    expect(legivel(item.detalhes)).toEqual([
      'Categoria: SaaS e Assinaturas → Inteligência Artificial',
      'Responsável técnico: — → Ana Souza',
      'Valor base: R$ 2.480,00 → R$ 2.600,00',
      'Última cobrança: — → jun/2027',
      'Forma de pagamento: Boleto → Cartão corporativo',
      'Renovação automática: Não → Sim',
      'Anexos: nenhum → 1 arquivo',
    ]);
  });

  it('ignora carimbos (updated_at): sem mudança de conteúdo, sem detalhes', () => {
    const item = descreverEntrada(entrada({ antes: despesaBase, depois: { ...despesaBase, updated_at: 'outro' } }), ctx);
    expect(item.detalhes).toEqual([]);
  });

  it('fornecedor removido do cadastro geral vira "Fornecedor desvinculado"', () => {
    const item = descreverEntrada(
      entrada({ antes: { ...despesaBase, fornecedor_id: 'f1' }, depois: { ...despesaBase, fornecedor_id: null }, autorNome: null }),
      ctx,
    );
    expect(item.titulo).toBe('Fornecedor desvinculado');
    expect(item.autor).toBe('Sistema');
  });
});

describe('descreverEntrada — reajuste', () => {
  const reajuste = { id: 'r1', despesa_id: 'd1', vigente_desde: '2027-01-01', valor: 2600, motivo: 'renegociacao', quantidade: 45 };

  it('novo reajuste mostra mês, valor, motivo e quantidade', () => {
    const item = descreverEntrada(entrada({ tabela: 'ti_despesa_reajustes', acao: 'insert', depois: reajuste }), ctx);
    expect(item.titulo).toBe('Reajuste a partir de jan/2027');
    expect(legivel(item.detalhes)).toEqual(['R$ 2.600,00 (Renegociação) · quantidade 45']);
  });

  it('remoção e alteração', () => {
    expect(descreverEntrada(entrada({ tabela: 'ti_despesa_reajustes', acao: 'delete', antes: reajuste }), ctx).titulo).toBe(
      'Reajuste de jan/2027 removido',
    );
    const alterado = descreverEntrada(
      entrada({ tabela: 'ti_despesa_reajustes', antes: reajuste, depois: { ...reajuste, valor: 2650 } }),
      ctx,
    );
    expect(alterado.titulo).toBe('Reajuste de jan/2027 alterado');
    expect(legivel(alterado.detalhes)).toEqual(['Valor: R$ 2.600,00 → R$ 2.650,00']);
  });
});
