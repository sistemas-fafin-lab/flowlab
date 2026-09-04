Status: done
Type: task
Blocked by: 32

# Contas a Receber: adicionar/corrigir número da nota depois da criação

## Onde

- `src/modules/faturamento/components/TitulosList.tsx` (ações por linha, hoje só Baixa/Glosa/Cancelar, linhas ~444-472)
- `src/modules/faturamento/components/ContasReceberPage.tsx` (onde os modais de ação são montados, ex. `RegraNfModal`)
- Nova RPC no Supabase (não existe hoje nenhuma RPC de update de `notas` fora de `fat_registrar_baixa`/glosa/cancelamento)
- `notas.status` (valores: `aberta`, `parcialmente_recebida`, `recebida`, `glosada`, `cancelada` — `supabase/migrations/20260320_billing_module.sql:82`)

## Problema

Hoje não existe nenhuma forma de editar um título depois de criado. Com a issue 32, um título pode nascer sem número da nota — precisa de um jeito de preencher esse número depois (e de corrigir, se alguém digitar errado).

## O que fazer

1. Nova RPC (ex. `fat_atualizar_numero_nota(p_id_nota uuid, p_numero_nota text)`):
   - Rejeita se o título estiver com `status = 'cancelada'`.
   - Rejeita se `p_numero_nota` vier vazio/nulo (não permite apagar um número já salvo — só substituir por outro valor não vazio).
   - Em qualquer outro status, faz o `UPDATE notas SET numero_nota = p_numero_nota, updated_at = now() WHERE id_nota = p_id_nota`, sobrescrevendo o valor atual (vazio ou já preenchido).
2. Handler de API (ex. `POST /api/faturamento/titulo-atualizar-numero-nota`) chamando a RPC, seguindo o padrão dos handlers existentes em `api/_lib/handlers/`.
3. Ação "Editar Título" em `TitulosList.tsx`, visível apenas para quem tem `canManageBilling` (mesma flag usada em `RegraNfModal`), em qualquer título com status diferente de `cancelada`. Modal simples com um único campo (número da nota), preenchido com o valor atual se já existir.
4. Não expandir o modal pra outros campos do título nesta issue (só número da nota) — decisão explícita do grilling, pra não abrir uma superfície de edição maior sem necessidade.

## Critérios de aceite

- Usuário com `canManageBilling` vê a ação "Editar Título" em qualquer título não cancelado.
- Usuário sem `canManageBilling` não vê/não consegue acionar essa ação.
- Preencher o número da nota em um título que estava sem número funciona e reflete na listagem.
- Trocar um número da nota já preenchido por outro valor funciona.
- Tentar salvar em branco por cima de um número já preenchido é bloqueado, com mensagem clara.
- Tentar editar um título com status `cancelada` é bloqueado (ação nem aparece, ou é rejeitada no back-end se forçada).

## Referência

Sessão de grilling em 2026-08-31 (mesma sessão da issue 32) — decisões: escopo restrito a esse único campo (opção B da rodada 1, Q2), correção permitida mas sem apagar pra vazio (Q3/Q8), permissão reaproveitando `canManageBilling` (Q5), liberado em qualquer status exceto `cancelada` (Q6).

## Comments

**Bookkeeping (2026-09-03)**: implementada e commitada (`f05bbad feat(faturamento): permite editar número da nota após criação (issue 33)`, `EditarTituloModal.tsx` e `api/_lib/handlers/faturamento-titulo-atualizar-numero-nota.ts` existem no código) — o `Status` deste arquivo estava desatualizado (`ready-for-agent`), corrigido para `done`. Achado ao investigar a issue 45 (esta feature é exatamente a necessidade real por trás de "anexar NF" relatada na transcrição — ver comentário na issue 45).
