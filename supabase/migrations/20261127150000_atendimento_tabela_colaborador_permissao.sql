/*
  # Tabela Colaborador — permissão `canUseTabelaColaborador` no Administrador

  Spec: .scratch/tabela-colaborador/spec.md → "Permissão" (issue 03). A key
  `canUseTabelaColaborador` ("Usar Tabela Colaborador") é registrada no app em
  `src/utils/permissions.ts` (ALL_PERMISSION_KEYS, grupo "Atendimento"). Com ela, o
  Gerador de Orçamento abre no modo Tabela Colaborador e
  GET /api/atendimento/tabela-colaborador-precos devolve a lista com o Valor
  colaborador. É independente de `canUseGeradorOrcamento`.

  Só o cargo "Administrador" recebe a chave (pelo id fixo e pelo nome): ninguém
  ganha acesso sem uma decisão explícita da Gerência.

  Idempotente: o NOT ? impede duplicar a chave ao reaplicar.
*/

UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canUseTabelaColaborador"]'::jsonb,
       updated_at = now()
 WHERE (cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canUseTabelaColaborador';
