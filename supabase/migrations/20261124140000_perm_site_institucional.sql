/*
  # Permissões do Site institucional — `canViewSaudePreventiva` e `canManageSite`

  O /admin do site laboratoriolab.com.br faz login neste projeto (FlowLab) e autoriza
  pelas permissões do cargo, como o WhatsApp em "Sistemas Externos". Até agora ele só
  exigia estar logado, e como o FlowLab tem autocadastro, isso não protegia nada.

  - canViewSaudePreventiva: ver anamneses, lista de espera e pedidos ao patologista no
    /admin do site, e mudar o status deles. Conferida na Edge Function admin-data do
    projeto de dados do site. Médicos entram pelo próprio cargo, sem esta chave.
  - canManageSite: publicar o conteúdo do site pelo Painel do Site (/api/conteudo).

  Nada aqui cria RLS: as chaves são conferidas no servidor do site.

  Backfill apenas do cargo de sistema "Administrador", como nas demais permissões novas.
  Os outros cargos o admin marca em Usuários → Cargos.

  Idempotente: só concede a quem ainda não tem.
*/

UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canViewSaudePreventiva"]'::jsonb,
       updated_at = now()
 WHERE (cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canViewSaudePreventiva';

UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canManageSite"]'::jsonb,
       updated_at = now()
 WHERE (cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canManageSite';
