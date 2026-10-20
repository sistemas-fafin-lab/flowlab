/*
  # Gerador de Orçamento (área Atendimento) — permissão `canUseGeradorOrcamento` + cargo "atendente"

  Spec: .scratch/gerador-orcamento/spec.md (issue 02). A key `canUseGeradorOrcamento`
  é registrada no app em `src/utils/permissions.ts` (ALL_PERMISSION_KEYS, grupo
  "Atendimento") e exigida pela rota /atendimento/gerador-orcamento e pelo endpoint
  GET /api/atendimento/gerador-orcamento-precos.

  1. Seed do cargo de sistema "atendente" (custom role, is_system = true)
     - só canUseGeradorOrcamento; NÃO recebe a permissão de custos (issue 05).
     - Se um cargo "atendente" já existir, ele não é recriado, mas recebe a chave
       (merge com dedup).

  2. Merge da chave no cargo "Administrador" (pelo id fixo e pelo nome).

  3. Menu: "Atendimento" entra na categoria OPERAÇÕES de module_categories
     (aditivo, mesmo padrão de RH em 20260914150000).

  Idempotente: ON CONFLICT (name) DO NOTHING no seed; os merges usam dedup, e o
  menu só acrescenta quando o item ainda não está lá.
*/

-- 1. Cargo de sistema "atendente"
INSERT INTO custom_roles (id, name, description, permissions, is_system) VALUES
(
  'a0000000-0000-0000-0000-000000000005',
  'atendente',
  'Atendimento ao cliente: Gerador de Orçamento (busca de exames, carrinho e Orçamento do cliente). Sem acesso a custos.',
  '["canUseGeradorOrcamento"]'::jsonb,
  true
)
ON CONFLICT (name) DO NOTHING;

-- 2. canUseGeradorOrcamento no "atendente" (caso já existisse) e no "Administrador".
-- O Administrador vai pelo id fixo e pelo nome: ele tem todas as chaves do catálogo
-- (src/utils/permissions.test.ts). O NOT ? impede duplicar a chave ao reaplicar.
UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canUseGeradorOrcamento"]'::jsonb,
       updated_at = now()
 WHERE (cr.name = 'atendente'
        OR cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canUseGeradorOrcamento';

-- 3. Menu — "Atendimento" na categoria OPERAÇÕES
UPDATE module_categories
SET items = items || '["Atendimento"]'::jsonb
WHERE id = 'operacoes'
  AND NOT (items @> '["Atendimento"]'::jsonb);
