# Contas a Receber: corrigir lançamentos (baixas e glosas) pelo "Editar título"

Status: done

## Problem Statement

Baixas e glosas são digitadas à mão e erros de digitação acontecem (valor,
data, glosa esquecida, lançamento em dobro). Hoje o "Editar título" só corrige
o número da nota: um valor recebido ou glosado errado não tem conserto pela
tela — o recebido, o glosado, o saldo e o status do título ficam errados.

O valor total **não** entra: ele é o snapshot dos lotes do apLIS congelado na
criação do título (`fat_criar_titulo`), nunca digitado.

## Decisões (grilling de 14/10/2026)

1. Corrigir tudo o que é digitado à mão; o total do título fica de fora.
2. Glosado é corrigido **na glosa** (o `notas.valor_glosado` continua derivado
   por `fat_recalcular_nota`), nunca num campo do título.
3. Baixa editável: valor recebido, data, forma, banco/conta, observações.
4. Glosa editável: valor, motivo, guia/lote vinculado. Status continua só na
   tela de Glosas & Recursos.
5. Excluir baixa (as glosas dela vão junto, com aviso) e excluir glosa.
6. Acrescentar glosa a uma baixa existente (ou ao grupo de glosas sem baixa).
7. Tudo no modal "Editar título": número da nota + baixas com suas glosas +
   glosas sem baixa (lançadas por "Lançar glosa" ou pelo backfill).
8. Permissão: `canManageBilling` (a mesma da baixa).
9. Bloqueio: só título cancelado. Glosa em recurso/definitiva também é editável.
10. Sem janela de tempo (não existe fechamento de mês).
11. Um salvamento = uma baixa (ou o grupo de glosas sem baixa) com suas glosas,
    com **um motivo obrigatório** para o salvamento.
12. Auditoria: valor antigo → novo, quem, quando, motivo, por campo. Exclusão
    apaga de verdade e guarda cópia completa do registro na auditoria.
13. Seção "Alterações" na linha expandida do título.

Validações iguais às do lançamento: valor recebido não negativo; glosa com
motivo e valor > 0; guia/lote da glosa pertence ao título; glosas (aberta, em
recurso, definitiva) somadas não passam do total do título. Baixa que ficaria
sem valor e sem glosas é recusada (a mensagem manda excluir).

## Implementação

- Migration: tabela `notas_lancamentos_audit_logs` (append-only, só SELECT por
  RLS) + RPCs `fat_corrigir_lancamento(p jsonb)` e
  `fat_excluir_baixa(p_recebimento_id, p_motivo)`, SECURITY DEFINER, com
  `fat_exigir_permissao_gestao()`. Chamadas direto do cliente
  (`supabase.rpc`), como `fat_registrar_baixa`.
- `glosas.recebimento_id` é `ON DELETE SET NULL`: excluir a baixa apaga as
  glosas dela explicitamente antes.
- `recebimentos.valor_previsto` acompanha o valor recebido (invariante de
  `fat_registrar_baixa`).
- Regra pura de diff/validação do formulário em
  `src/modules/faturamento/utils/correcaoLancamento.ts` (testada em vitest).
