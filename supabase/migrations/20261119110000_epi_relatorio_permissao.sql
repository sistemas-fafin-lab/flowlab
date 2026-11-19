/*
  # Qualidade — permissão "Ver relatórios de EPI"

  Spec: .scratch/epi-relatorio-mensal/spec.md (issue 04). Termos no CONTEXT.md, seção
  Estoque e Qualidade.

  `canViewEpiReport` ("Ver relatórios de EPI", grupo Qualidade em src/utils/permissions.ts)
  abre a aba EPIs da Qualidade e gera o Relatório mensal de EPI de cada área. O relatório é
  calculado na hora a partir de requests, products e stock_movements, que já são legíveis
  por qualquer usuário logado: nenhuma tabela nem política nova nesta fatia.

  Só o cargo Administrador recebe por padrão; os demais (Qualidade, Estoque) recebem na tela
  de Cargos e Permissões.
*/

UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canViewEpiReport"]'::jsonb,
       updated_at = now()
 WHERE (cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canViewEpiReport';
