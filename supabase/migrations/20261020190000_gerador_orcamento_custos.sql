/*
  # Gerador de Orçamento — permissão `canViewGeradorOrcamentoCustos` no Administrador

  Spec: .scratch/gerador-orcamento/spec.md (issue 05). A key
  `canViewGeradorOrcamentoCustos` ("Ver custos e margem no Gerador de Orçamento")
  é registrada no app em `src/utils/permissions.ts` (ALL_PERMISSION_KEYS, grupo
  "Atendimento"). Com ela, GET /api/atendimento/gerador-orcamento-precos consulta e
  devolve o custo dos exames, e a tela mostra o botão "Gerar PDF Interno".

  Só o cargo "Administrador" recebe a chave (pelo id fixo e pelo nome). O cargo de
  sistema "atendente" NÃO recebe; quem mais precisar ver custos recebe por cargo
  customizado.

  Idempotente: o NOT ? impede duplicar a chave ao reaplicar.
*/

UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canViewGeradorOrcamentoCustos"]'::jsonb,
       updated_at = now()
 WHERE (cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canViewGeradorOrcamentoCustos';
