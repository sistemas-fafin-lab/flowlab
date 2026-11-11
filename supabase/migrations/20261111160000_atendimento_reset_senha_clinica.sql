/*
  # Atendimento — Resetar senha clínica (usuário do Laudo Web no apLIS)

  1. Permissão `canResetarSenhaClinica` (src/utils/permissions.ts, grupo "Atendimento"):
     abre a aba e permite gravar a senha nova no cadastro da clínica no site do apLIS.
     Só o cargo "Administrador" recebe por padrão (pelo id fixo e pelo nome); os demais
     recebem por cargo customizado na tela de Cargos e Permissões. Idempotente.

  2. Tabela `atendimento_reset_senha_clinica`: quem resetou a senha de qual usuário de qual
     clínica e o resultado. O log do apLIS registra o usuário de serviço do flowlab
     (APLIS_WEB_USUARIO), não o operador — esta tabela é o rastro de quem foi. A senha
     NUNCA é gravada. `cadastro_intacto = false` quer dizer que a releitura do cadastro
     depois de gravar mostrou outra diferença além da senha (`diferencas` traz só as chaves).
     `login_conferido`: resultado do login de teste feito logo depois de gravar, com o
     usuário e a senha nova ('ok' | 'falhou' | 'nao_conferido'; motivo em `mensagem`).
     Só o servidor (service role) escreve; lê quem tem a permissão.
*/

UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canResetarSenhaClinica"]'::jsonb,
       updated_at = now()
 WHERE (cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canResetarSenhaClinica';

CREATE TABLE IF NOT EXISTS public.atendimento_reset_senha_clinica (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  id_instituicao integer NOT NULL,
  nome_instituicao text,
  id_usuario_web integer NOT NULL,
  usuario_web text,
  sucesso boolean NOT NULL,
  cadastro_intacto boolean,
  diferencas jsonb,
  login_conferido text CHECK (login_conferido IN ('ok', 'falhou', 'nao_conferido')),
  mensagem text
);

CREATE INDEX IF NOT EXISTS atendimento_reset_senha_clinica_created_at_idx
  ON public.atendimento_reset_senha_clinica (created_at DESC);

ALTER TABLE public.atendimento_reset_senha_clinica ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ler resets de senha de clínica" ON public.atendimento_reset_senha_clinica;
CREATE POLICY "Ler resets de senha de clínica"
  ON public.atendimento_reset_senha_clinica
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canResetarSenhaClinica'));
