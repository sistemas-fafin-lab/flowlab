-- ═══════════════════════════════════════════════════════════════════════════════
-- TI — Resolução obrigatória e anexos na conversa dos chamados
-- Migration: 20261023120000_it_chamados_resolucao_anexos.sql
--
-- 1. Chamado (it_requests com is_internal = false) só vira 'resolved' com um texto
--    de resolução. A trava é um trigger, então vale para qualquer caminho: tela de
--    Solicitações, drawer, Kanban, EVA. Tarefas internas da TI ficam de fora.
-- 2. A resolução também entra na conversa do chamado, como uma mensagem do tipo
--    'resolution', e as mensagens da conversa passam a aceitar anexos.
-- 3. it_resolver_chamado grava as duas coisas numa transação só.
-- 4. O e-mail "chamado concluído" ganha o bloco com o texto da resolução.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Colunas ──────────────────────────────────────────────────────────────
ALTER TABLE public.it_requests
  ADD COLUMN IF NOT EXISTS resolution  text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.it_requests.resolution IS
  'Texto de resolução vigente. Obrigatório para o chamado (is_internal = false) virar resolved; limpo quando o chamado é reaberto (o histórico fica em it_task_comments, kind = resolution).';
COMMENT ON COLUMN public.it_requests.resolved_at IS
  'Quando o chamado virou resolved. Chamados resolvidos antes de 20261023120000 receberam o updated_at como aproximação.';

-- Os já resolvidos não tinham a data: o updated_at é a melhor aproximação que existe
-- (o único UPDATE típico depois da resolução é o last_status_email_at, segundos depois).
UPDATE public.it_requests
   SET resolved_at = updated_at
 WHERE status = 'resolved' AND resolved_at IS NULL;

ALTER TABLE public.it_task_comments
  ADD COLUMN IF NOT EXISTS kind        text  NOT NULL DEFAULT 'comment',
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'it_task_comments_kind_check'
  ) THEN
    ALTER TABLE public.it_task_comments
      ADD CONSTRAINT it_task_comments_kind_check CHECK (kind IN ('comment', 'resolution'));
  END IF;
END
$$;

COMMENT ON COLUMN public.it_task_comments.kind IS
  'comment = mensagem comum; resolution = texto de resolução registrado ao resolver o chamado.';
COMMENT ON COLUMN public.it_task_comments.attachments IS
  'Anexos da mensagem [{url, name, size, type}], no bucket it-attachments.';

-- ─── 2. Trava: chamado só é resolvido com texto de resolução ─────────────────
CREATE OR REPLACE FUNCTION public.it_requests_exigir_resolucao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'resolved' THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'resolved' THEN
      IF NOT COALESCE(NEW.is_internal, false) AND btrim(COALESCE(NEW.resolution, '')) = '' THEN
        RAISE EXCEPTION 'O chamado % precisa de um texto de resolução para ser concluído. Resolva pela tela de Solicitações de TI ou pelo card no Kanban.',
          COALESCE(NEW.codigo, '')
          USING ERRCODE = '23514';
      END IF;
      NEW.resolved_at := now();
      NEW.resolved_by := COALESCE(NEW.resolved_by, auth.uid());
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'resolved' THEN
    -- Reaberto: a próxima resolução pede texto novo. O anterior continua na conversa.
    NEW.resolution  := NULL;
    NEW.resolved_at := NULL;
    NEW.resolved_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_it_requests_exigir_resolucao ON public.it_requests;
CREATE TRIGGER trg_it_requests_exigir_resolucao
  BEFORE INSERT OR UPDATE ON public.it_requests
  FOR EACH ROW EXECUTE FUNCTION public.it_requests_exigir_resolucao();

-- ─── 3. Resolver: status + texto + mensagem na conversa, numa transação ──────
-- SECURITY INVOKER: valem as policies de sempre (UPDATE em it_requests exige
-- canManageIT; a mensagem sai com user_id = auth.uid()).
CREATE OR REPLACE FUNCTION public.it_resolver_chamado(
  p_id            uuid,
  p_resolucao     text,
  p_anexos        jsonb   DEFAULT '[]'::jsonb,
  p_concluir_card boolean DEFAULT false
)
RETURNS public.it_requests
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_texto text := btrim(COALESCE(p_resolucao, ''));
  v_req   public.it_requests;
BEGIN
  IF v_texto = '' THEN
    RAISE EXCEPTION 'Descreva a resolução do chamado.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_anexos, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Anexos inválidos.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.it_requests r
     SET status        = 'resolved',
         resolution    = v_texto,
         kanban_status = CASE WHEN p_concluir_card THEN 'done' ELSE r.kanban_status END
   WHERE r.id = p_id
  RETURNING r.* INTO v_req;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado ou sem permissão para alterá-lo.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.it_task_comments (task_id, user_id, content, kind, attachments)
  VALUES (p_id, auth.uid(), v_texto, 'resolution', COALESCE(p_anexos, '[]'::jsonb));

  RETURN v_req;
END;
$$;

REVOKE ALL ON FUNCTION public.it_resolver_chamado(uuid, text, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.it_resolver_chamado(uuid, text, jsonb, boolean) TO authenticated;

COMMENT ON FUNCTION public.it_resolver_chamado(uuid, text, jsonb, boolean) IS
  'Marca o chamado como resolvido com o texto de resolução e registra a resolução (com anexos) na conversa. p_concluir_card também move o card para done.';

-- ─── 4. E-mail "chamado concluído" com a resolução ──────────────────────────
-- {{resolution_block}} chega pronto (HTML escapado) do front; vazio, não aparece
-- nada. Entra logo antes do botão; idempotente.
UPDATE public.notification_templates
   SET body_html = replace(
         body_html,
         '<!-- CTA Button -->',
         '{{resolution_block}}' || chr(10) || chr(10) || '              <!-- CTA Button -->'
       )
 WHERE slug = 'it_ticket_resolved'
   AND body_html NOT LIKE '%{{resolution_block}}%';
