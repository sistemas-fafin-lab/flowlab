-- ═══════════════════════════════════════════════════════════════════════════════
-- RH — Holerites: upload consolidado (auto-split) e autoatendimento (issue 05)
-- Migration: 20260916100000_rh_holerites.sql
--
-- Ver .scratch/rh-colaboradores/issues/05-holerites-autoatendimento.md.
-- Cria `colaborador_holerites` (um PDF individual por colaborador+competência,
-- fatiado do PDF consolidado que a contabilidade envia), o bucket PRIVADO onde
-- esses PDFs vivem (dado financeiro pessoal — nunca o bucket público
-- `request-attachments`), e o template de e-mail de notificação.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. TABELA
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.colaborador_holerites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id  uuid NOT NULL REFERENCES public.colaboradores(id),
  -- Sempre dia 1 do mês/ano (ex. "Agosto/2026" -> 2026-08-01) — granularidade é o mês, não o dia.
  competencia     date NOT NULL,
  -- Path no bucket privado colaborador-holerites, nunca URL pública — acesso só via signed URL de curta duração.
  arquivo_path    text NOT NULL,
  uploaded_by     uuid NOT NULL REFERENCES public.user_profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Reenvio da mesma competência substitui o arquivo anterior (upsert via ON CONFLICT no handler), não duplica.
  CONSTRAINT colaborador_holerites_colaborador_competencia_key UNIQUE (colaborador_id, competencia)
);

COMMENT ON TABLE public.colaborador_holerites IS 'Holerites individuais (um PDF por colaborador+competência), fatiados do PDF consolidado que a contabilidade envia mensalmente (issue 05). arquivo_path aponta para o bucket privado colaborador-holerites.';
COMMENT ON COLUMN public.colaborador_holerites.competencia IS 'Sempre dia 1 do mês/ano — granularidade mensal, não diária.';
COMMENT ON COLUMN public.colaborador_holerites.arquivo_path IS 'Path no bucket privado colaborador-holerites (ex. "<colaborador_id>/2026-08.pdf") — nunca URL pública; download só via signed URL de curta duração.';

CREATE INDEX IF NOT EXISTS colaborador_holerites_colaborador_id_idx ON public.colaborador_holerites(colaborador_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. RLS — quem tem canManageHolerites tem acesso total (gravação passa pelo
-- handler server-side com service role, mas a policy documenta e garante o
-- invariante mesmo para uma futura escrita direta). Colaborador autenticado só
-- enxerga linhas do próprio colaborador (join por user_profile_id = auth.uid()).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.colaborador_holerites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS colaborador_holerites_manage ON public.colaborador_holerites;
CREATE POLICY colaborador_holerites_manage ON public.colaborador_holerites
  FOR ALL TO authenticated
  USING (public.current_user_has_permission('canManageHolerites'))
  WITH CHECK (public.current_user_has_permission('canManageHolerites'));

DROP POLICY IF EXISTS colaborador_holerites_select_own ON public.colaborador_holerites;
CREATE POLICY colaborador_holerites_select_own ON public.colaborador_holerites
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.colaboradores c
      WHERE c.id = colaborador_holerites.colaborador_id
        AND c.user_profile_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. STORAGE — bucket privado, path "<colaborador_id>/<competencia AAAA-MM>.pdf".
-- RLS de storage.objects espelha a da tabela: canManageHolerites tem acesso
-- total (upload/leitura/remoção — usado pelo handler de confirmação e pelo
-- upload do PDF consolidado temporário em "_tmp/"); colaborador autenticado só
-- lê (signed URL) objetos cuja primeira pasta do path é o SEU colaborador_id.
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('colaborador-holerites', 'colaborador-holerites', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "colaborador_holerites_storage_manage" ON storage.objects;
CREATE POLICY "colaborador_holerites_storage_manage"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'colaborador-holerites' AND public.current_user_has_permission('canManageHolerites'))
WITH CHECK (bucket_id = 'colaborador-holerites' AND public.current_user_has_permission('canManageHolerites'));

DROP POLICY IF EXISTS "colaborador_holerites_storage_select_own" ON storage.objects;
CREATE POLICY "colaborador_holerites_storage_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'colaborador-holerites'
  AND EXISTS (
    SELECT 1 FROM public.colaboradores c
    WHERE c.user_profile_id = auth.uid()
      AND (storage.foldername(name))[1] = c.id::text
  )
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. RLS adicional em `colaboradores` — a SELECT de 20260914150000 só aceita
-- canViewColaboradores, mas o fluxo de holerites precisa de dois acessos que
-- essa policy não cobre:
--   a) autoatendimento: o colaborador logado precisa achar a PRÓPRIA linha
--      (pra saber se tem vínculo, e pro join de nome na listagem) mesmo sem
--      canViewColaboradores — só enxerga a si mesmo, via user_profile_id.
--   b) RH com canManageHolerites mas SEM canViewColaboradores (permissions
--      independentes de propósito — ver spec): a listagem "Holerites
--      enviados" faz um embed `colaboradores(nome)` que, sem esta policy,
--      voltaria null em toda linha (RLS nega a tabela referenciada).
-- Políticas SELECT permissivas se somam com OR à já existente — nenhuma
-- restringe a anterior.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS colaboradores_select_own ON public.colaboradores;
CREATE POLICY colaboradores_select_own ON public.colaboradores
  FOR SELECT TO authenticated
  USING (user_profile_id = auth.uid());

DROP POLICY IF EXISTS colaboradores_select_holerites_manage ON public.colaboradores;
CREATE POLICY colaboradores_select_holerites_manage ON public.colaboradores
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canManageHolerites'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. TEMPLATE DE E-MAIL — "novo holerite disponível", disparado pelo handler de
-- confirmação (api/_lib/handlers/rh-holerites-confirmar.ts) só para colaboradores
-- casados com user_profile_id vinculado. Variáveis: {{user_name}}, {{competencia}}, {{action_url}}.
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.notification_templates (slug, name, subject_template, body_html)
VALUES (
  'holerite_disponivel',
  'Novo Holerite Disponível',
  'Seu holerite de {{competencia}} já está disponível',
  '<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Holerite {{competencia}} disponível</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:''Segoe UI'',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f7;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);border-collapse:collapse;">
          <tr>
            <td align="center" style="background-color:#2563eb;padding:32px 40px;">
              <span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Flow LAB</span>
              <br />
              <span style="font-size:12px;color:rgba(255,255,255,0.85);font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">Recursos Humanos</span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
                <tr>
                  <td style="background-color:#eff6ff;border-radius:6px;padding:6px 14px;">
                    <span style="font-size:12px;font-weight:600;color:#2563eb;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.5px;">HOLERITE &bull; {{competencia}}</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.3;">
                Olá, {{user_name}}!
              </p>
              <p style="margin:0 0 28px 0;font-size:15px;color:#6b7280;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.6;">
                Seu holerite de <strong style="color:#2563eb;">{{competencia}}</strong> já está disponível no Flow LAB. Acesse a aba Holerites para visualizar e baixar.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td align="center" style="border-radius:8px;background-color:#2563eb;">
                    <a href="{{action_url}}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#2563eb;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.3px;">
                      Ver Holerite &#8594;
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0 0;font-size:12px;color:#9ca3af;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br />
                <a href="{{action_url}}" style="color:#2563eb;text-decoration:none;word-break:break-all;">{{action_url}}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 32px 40px;background-color:#fafafa;border-radius:0 0 12px 12px;">
              <p style="margin:0 0 4px 0;font-size:13px;font-weight:600;color:#374151;font-family:''Segoe UI'',Arial,sans-serif;">Flow LAB</p>
              <p style="margin:0;font-size:12px;color:#9ca3af;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">
                Este é um e-mail automático. Por favor, não responda diretamente a esta mensagem.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>'
)
ON CONFLICT (slug) DO UPDATE
  SET
    name             = EXCLUDED.name,
    subject_template = EXCLUDED.subject_template,
    body_html        = EXCLUDED.body_html;
