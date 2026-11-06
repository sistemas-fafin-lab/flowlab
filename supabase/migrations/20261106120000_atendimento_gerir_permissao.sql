/*
  # Atendimento — permissão `canGerirAtendimento` no Administrador

  A key `canGerirAtendimento` ("Supervisionar atendimento (Central WhatsApp)") é
  registrada no app em `src/utils/permissions.ts` (ALL_PERMISSION_KEYS, grupo
  "Atendimento"): criar, editar e excluir etiquetas e respostas rápidas; transferir
  e assumir conversas.

  Só o cargo "Administrador" recebe a chave (pelo id fixo e pelo nome). Supervisores
  de atendimento recebem por cargo customizado na tela de Cargos e Permissões.

  Idempotente: o NOT ? impede duplicar a chave ao reaplicar.
*/

UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canGerirAtendimento"]'::jsonb,
       updated_at = now()
 WHERE (cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canGerirAtendimento';
