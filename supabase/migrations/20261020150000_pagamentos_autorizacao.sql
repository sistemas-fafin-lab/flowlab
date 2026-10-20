-- ═══════════════════════════════════════════════════════════════════════════════
-- Pagamentos: o autorizador autoriza no FlowLab, avisado por e-mail
-- Migration: 20261020150000_pagamentos_autorizacao.sql
--
-- Pedido do usuário (20/Out): "quando um usuário selecionar um autorizador, o autorizador
-- deverá ser notificado por e-mail para que ele entre e autorize a solicitação de pagamento".
-- Decisões dele: o Financeiro continua aprovando depois da autorização, e também recebem
-- e-mail o solicitante (na decisão do autorizador) e o Financeiro (quando autorizado).
--
-- Até aqui "Autorizado por" era só uma declaração: o pedido já nascia pendente para o
-- Financeiro. Agora:
--
--   aguardando autorização ──(autorizador autoriza)──▶ pendente ──(Financeiro)──▶ aprovado ──▶ pago
--            │                                            │
--            └──(autorizador ou Financeiro rejeita)──▶ rejeitado ◀──(Financeiro rejeita)
--
--   1. Status novo 'awaiting_authorization'. O pedido nasce nele; se quem pede é o próprio
--      autorizador (tem a permissão e se escolheu), nasce já autorizado, em 'pending'.
--   2. Colunas autorizado_em (quando foi autorizado) e rejeitado_por (quem rejeitou).
--   3. Trava de status: ninguém tira o pedido de 'awaiting_authorization' para frente a não
--      ser o autorizador escolhido; rejeitar pode o autorizador ou quem aprova pagamentos.
--   4. payment_request_decidir_autorizacao(id, autorizar, motivo): a decisão do autorizador
--      (ele não tem a policy de UPDATE, que é de quem aprova pagamentos).
--   5. Leitura: o autorizador passa a ver os pedidos em que foi escolhido.
--   6. Quatro modelos de e-mail (notification_templates).
--
-- Pedidos já existentes não mudam: os pendentes continuam pendentes para o Financeiro.
-- Aplique junto com o front: o front antigo não sabe mostrar o status novo.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. STATUS E COLUNAS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.payment_requests DROP CONSTRAINT IF EXISTS payment_requests_status_check;
ALTER TABLE public.payment_requests
  ADD CONSTRAINT payment_requests_status_check
  CHECK (status IN ('awaiting_authorization', 'pending', 'approved', 'rejected', 'paid', 'cancelled'));

ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS autorizado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejeitado_por TEXT;

COMMENT ON COLUMN public.payment_requests.status IS 'awaiting_authorization (espera o autorizador), pending (espera o Financeiro), approved, rejected, paid, cancelled';
COMMENT ON COLUMN public.payment_requests.autorizado_em IS 'Quando o autorizador autorizou. Pedido em que quem pede é o próprio autorizador: a hora da criação. NULL em pedidos anteriores a 2026-10-20.';
COMMENT ON COLUMN public.payment_requests.rejeitado_por IS 'Nome de quem rejeitou (o autorizador ou alguém do Financeiro).';

CREATE INDEX IF NOT EXISTS idx_payment_requests_autorizado_por_id ON public.payment_requests(autorizado_por_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. CRIAÇÃO: O PEDIDO ESPERA O AUTORIZADOR
-- ═══════════════════════════════════════════════════════════════════════════════

-- Mesmo corpo de 20261020120000; só o fim muda: o status do pedido novo.
CREATE OR REPLACE FUNCTION public.payment_request_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome TEXT;
BEGIN
  -- Sem usuário logado (SQL Editor, chave de serviço): é a saída de emergência.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.solicitante_id := auth.uid();
  ELSE
    IF NEW.solicitante_id IS DISTINCT FROM OLD.solicitante_id THEN
      RAISE EXCEPTION 'O solicitante de um pedido de pagamento não muda.' USING ERRCODE = '42501';
    END IF;
    IF NEW.autorizado_por_id IS NOT DISTINCT FROM OLD.autorizado_por_id
       AND NEW.autorizado_por IS NOT DISTINCT FROM OLD.autorizado_por THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.autorizado_por_id IS NULL THEN
    RAISE EXCEPTION 'Escolha quem autorizou o pagamento.' USING ERRCODE = '22023';
  END IF;

  IF NOT public.user_has_permission(NEW.autorizado_por_id, 'canAuthorizePayments') THEN
    RAISE EXCEPTION 'Essa pessoa não pode autorizar pagamentos: o cargo dela não tem a permissão Ser autorizador de pagamentos.' USING ERRCODE = '42501';
  END IF;

  SELECT name INTO v_nome FROM user_profiles WHERE id = NEW.autorizado_por_id;
  NEW.autorizado_por := v_nome;

  -- Pedido novo espera o autorizador, a não ser que quem pede seja o próprio autorizador
  -- (a permissão foi conferida acima): aí já nasce autorizado, na fila do Financeiro.
  IF TG_OP = 'INSERT' THEN
    IF NEW.autorizado_por_id = auth.uid() THEN
      NEW.status := 'pending';
      NEW.autorizado_em := now();
    ELSE
      NEW.status := 'awaiting_authorization';
      NEW.autorizado_em := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.payment_request_guard() IS 'Pedido de pagamento: com usuário logado, solicitante_id é quem está logado e não muda; o autorizador precisa ter canAuthorizePayments e o nome vem do perfil dele; o pedido novo nasce em awaiting_authorization (ou em pending, autorizado, se quem pede é o autorizador). Sem usuário (SQL), sem checagem.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. TRAVA DE STATUS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.payment_request_guard_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'awaiting_authorization' THEN
    RAISE EXCEPTION 'Um pedido de pagamento não volta para "aguardando autorização".' USING ERRCODE = '42501';
  END IF;

  IF OLD.status = 'awaiting_authorization' THEN
    IF NEW.status = 'pending' AND auth.uid() IS DISTINCT FROM OLD.autorizado_por_id THEN
      RAISE EXCEPTION 'Só o autorizador escolhido no pedido (%) pode autorizá-lo.', COALESCE(OLD.autorizado_por, 'sem nome')
        USING ERRCODE = '42501';
    END IF;
    IF NEW.status = 'rejected'
       AND auth.uid() IS DISTINCT FROM OLD.autorizado_por_id
       AND NOT public.current_user_has_permission('canApprovePayments') THEN
      RAISE EXCEPTION 'Só o autorizador ou quem aprova pagamentos rejeita um pedido que espera autorização.' USING ERRCODE = '42501';
    END IF;
    IF NEW.status NOT IN ('pending', 'rejected') THEN
      RAISE EXCEPTION 'O pedido ainda espera a autorização de %.', COALESCE(OLD.autorizado_por, 'quem foi escolhido')
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.payment_request_guard_status() IS 'Status do pedido de pagamento, com usuário logado: de awaiting_authorization só sai para pending (o autorizador escolhido) ou rejected (o autorizador ou canApprovePayments); nada volta para awaiting_authorization. Sem usuário (SQL), sem checagem.';

DROP TRIGGER IF EXISTS trigger_payment_request_guard_status ON public.payment_requests;
CREATE TRIGGER trigger_payment_request_guard_status
  BEFORE UPDATE OF status ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.payment_request_guard_status();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. A DECISÃO DO AUTORIZADOR
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.payment_request_decidir_autorizacao(
  p_id UUID,
  p_autorizar BOOLEAN,
  p_motivo TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido payment_requests%ROWTYPE;
  v_nome   TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;
  IF p_autorizar IS NULL THEN
    RAISE EXCEPTION 'Informe se autoriza ou rejeita.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_pedido FROM payment_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido de pagamento não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_pedido.autorizado_por_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Só quem foi escolhido como autorizador decide este pedido.' USING ERRCODE = '42501';
  END IF;
  IF v_pedido.status <> 'awaiting_authorization' THEN
    RAISE EXCEPTION 'Este pedido não está mais aguardando autorização.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'canAuthorizePayments') THEN
    RAISE EXCEPTION 'Seu cargo não tem mais a permissão Ser autorizador de pagamentos.' USING ERRCODE = '42501';
  END IF;

  IF p_autorizar THEN
    UPDATE payment_requests
       SET status = 'pending', autorizado_em = now()
     WHERE id = p_id;
    RETURN 'pending';
  END IF;

  IF NULLIF(btrim(COALESCE(p_motivo, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da rejeição.' USING ERRCODE = '22023';
  END IF;
  SELECT name INTO v_nome FROM user_profiles WHERE id = auth.uid();
  UPDATE payment_requests
     SET status = 'rejected', rejection_reason = btrim(p_motivo), rejeitado_por = v_nome
   WHERE id = p_id;
  RETURN 'rejected';
END;
$$;

COMMENT ON FUNCTION public.payment_request_decidir_autorizacao(uuid, boolean, text) IS 'O autorizador escolhido no pedido (com canAuthorizePayments) autoriza (→ pending, para o Financeiro) ou rejeita com motivo (→ rejected). Só em awaiting_authorization. Devolve o status novo.';

REVOKE ALL ON FUNCTION public.payment_request_decidir_autorizacao(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payment_request_decidir_autorizacao(uuid, boolean, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

-- O autorizador vê os pedidos em que foi escolhido, de qualquer setor.
DROP POLICY IF EXISTS "Users can view payment requests" ON public.payment_requests;
CREATE POLICY "Users can view payment requests" ON public.payment_requests
  FOR SELECT TO authenticated
  USING (
    solicitante_id = (SELECT auth.uid())
    OR autorizado_por_id = (SELECT auth.uid())
    OR department = (SELECT p.department FROM public.user_profiles p WHERE p.id = (SELECT auth.uid()))
    OR (SELECT public.current_user_has_permission('canApprovePayments'))
    OR (SELECT public.current_user_has_permission('canViewAllPayments'))
  );

-- O status do pedido novo vem do trigger (awaiting_authorization ou, autorizado, pending).
DROP POLICY IF EXISTS "Users can insert payment requests" ON public.payment_requests;
CREATE POLICY "Users can insert payment requests" ON public.payment_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    status IN ('awaiting_authorization', 'pending')
    AND approved_by IS NULL
    AND approval_date IS NULL
    AND rejection_reason IS NULL
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. MODELOS DE E-MAIL
-- ═══════════════════════════════════════════════════════════════════════════════
-- Enviados por api/_lib/handlers/notifications-payment-request.ts. Variáveis (montadas e
-- escapadas em api/_lib/paymentRequestEmail.ts): {{codigo}}, {{fornecedor}}, {{valor}},
-- {{tipo}}, {{forma}}, {{data_pagamento}}, {{solicitante}}, {{setor}}, {{autorizador}},
-- {{descricao}}, {{motivo}}, {{action_url}}.

-- payment_awaiting_authorization: para o autorizador escolhido no pedido (payment_requests.autorizado_por_id), quando o pedido é criado.
INSERT INTO public.notification_templates (slug, name, subject_template, body_html)
VALUES (
  'payment_awaiting_authorization',
  'Pedido de pagamento aguardando autorização',
  '[FlowLAB] Pedido de pagamento {{codigo}} aguardando sua autorização',
  '<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Pedido de pagamento aguardando sua autorização</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:''Segoe UI'',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f7;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);border-collapse:collapse;">

          <!-- CABEÇALHO -->
          <tr>
            <td align="center" style="background-color:#059669;padding:32px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="background-color:rgba(255,255,255,0.15);border-radius:8px;padding:8px 12px;vertical-align:middle;">
                    <span style="font-size:22px;line-height:1;color:#ffffff;">&#128176;</span>
                  </td>
                  <td style="padding-left:14px;vertical-align:middle;">
                    <span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Flow LAB</span>
                    <br />
                    <span style="font-size:12px;color:rgba(255,255,255,0.85);font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">Pagamentos</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CORPO -->
          <tr>
            <td style="padding:40px 40px 32px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
                <tr>
                  <td style="background-color:#ecfdf5;border-radius:6px;padding:6px 14px;">
                    <span style="font-size:12px;font-weight:600;color:#047857;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.5px;">Pedido de pagamento &bull; {{codigo}}</span>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.3;">
                Um pedido de pagamento espera a sua autorização
              </p>
              <p style="margin:0 0 28px 0;font-size:15px;color:#6b7280;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.6;">
                <strong>{{solicitante}}</strong> indicou você como autorizador deste pedido. Entre no Flow LAB para autorizar ou rejeitar: só depois disso ele segue para a aprovação do Financeiro.
              </p>
              <!-- DETALHES DO PEDIDO -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:28px;border-top:1px solid #f0f0f0;border-bottom:1px solid #f0f0f0;">
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Valor</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:18px;font-weight:700;color:#047857;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{valor}}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Fornecedor</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{fornecedor}}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Tipo</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{tipo}} &bull; {{forma}}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Pagamento em</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{data_pagamento}}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Solicitante</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{solicitante}} ({{setor}})</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Descrição</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;"><span style="white-space:pre-line;">{{descricao}}</span></td>
                </tr>
              </table>
              <!-- BOTÃO -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td align="center" style="border-radius:8px;background-color:#059669;">
                    <a href="{{action_url}}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#059669;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.3px;">
                      Autorizar ou rejeitar &#8594;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0 0;font-size:12px;color:#9ca3af;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br />
                <a href="{{action_url}}" style="color:#047857;text-decoration:none;word-break:break-all;">{{action_url}}</a>
              </p>
            </td>
          </tr>

          <!-- RODAPÉ -->
          <tr>
            <td style="padding:24px 40px 32px 40px;background-color:#fafafa;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 4px 0;font-size:13px;font-weight:600;color:#374151;font-family:''Segoe UI'',Arial,sans-serif;">Flow LAB</p>
              <p style="margin:0 0 12px 0;font-size:12px;color:#9ca3af;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">
                Este é um e-mail automático. Por favor, não responda diretamente a esta mensagem.<br />
                Para decidir, acesse Solicitações &gt; Pagamentos no portal Flow LAB.
              </p>
              <p style="margin:0;font-size:11px;color:#d1d5db;font-family:''Segoe UI'',Arial,sans-serif;">
                &copy; 2026 Flow LAB &bull; Todos os direitos reservados
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
SET name = EXCLUDED.name,
    subject_template = EXCLUDED.subject_template,
    body_html = EXCLUDED.body_html;

-- payment_authorized: para o solicitante, quando o autorizador autoriza.
INSERT INTO public.notification_templates (slug, name, subject_template, body_html)
VALUES (
  'payment_authorized',
  'Pedido de pagamento autorizado (para o solicitante)',
  '[FlowLAB] Pedido de pagamento {{codigo}} autorizado',
  '<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Pedido de pagamento autorizado</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:''Segoe UI'',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f7;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);border-collapse:collapse;">

          <!-- CABEÇALHO -->
          <tr>
            <td align="center" style="background-color:#059669;padding:32px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="background-color:rgba(255,255,255,0.15);border-radius:8px;padding:8px 12px;vertical-align:middle;">
                    <span style="font-size:22px;line-height:1;color:#ffffff;">&#128176;</span>
                  </td>
                  <td style="padding-left:14px;vertical-align:middle;">
                    <span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Flow LAB</span>
                    <br />
                    <span style="font-size:12px;color:rgba(255,255,255,0.85);font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">Pagamentos</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CORPO -->
          <tr>
            <td style="padding:40px 40px 32px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
                <tr>
                  <td style="background-color:#ecfdf5;border-radius:6px;padding:6px 14px;">
                    <span style="font-size:12px;font-weight:600;color:#047857;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.5px;">Pedido de pagamento &bull; {{codigo}}</span>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.3;">
                Seu pedido foi autorizado
              </p>
              <p style="margin:0 0 28px 0;font-size:15px;color:#6b7280;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.6;">
                <strong>{{autorizador}}</strong> autorizou o seu pedido de pagamento. Agora ele segue para a aprovação do Financeiro.
              </p>
              <!-- DETALHES DO PEDIDO -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:28px;border-top:1px solid #f0f0f0;border-bottom:1px solid #f0f0f0;">
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Valor</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:18px;font-weight:700;color:#047857;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{valor}}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Fornecedor</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{fornecedor}}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Tipo</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{tipo}} &bull; {{forma}}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Pagamento em</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{data_pagamento}}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Solicitante</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{solicitante}} ({{setor}})</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Descrição</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;"><span style="white-space:pre-line;">{{descricao}}</span></td>
                </tr>
              </table>
              <!-- BOTÃO -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td align="center" style="border-radius:8px;background-color:#059669;">
                    <a href="{{action_url}}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#059669;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.3px;">
                      Ver o pedido &#8594;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0 0;font-size:12px;color:#9ca3af;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br />
                <a href="{{action_url}}" style="color:#047857;text-decoration:none;word-break:break-all;">{{action_url}}</a>
              </p>
            </td>
          </tr>

          <!-- RODAPÉ -->
          <tr>
            <td style="padding:24px 40px 32px 40px;background-color:#fafafa;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 4px 0;font-size:13px;font-weight:600;color:#374151;font-family:''Segoe UI'',Arial,sans-serif;">Flow LAB</p>
              <p style="margin:0 0 12px 0;font-size:12px;color:#9ca3af;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">
                Este é um e-mail automático. Por favor, não responda diretamente a esta mensagem.<br />
                Acompanhe o pedido em Solicitações &gt; Pagamentos no portal Flow LAB.
              </p>
              <p style="margin:0;font-size:11px;color:#d1d5db;font-family:''Segoe UI'',Arial,sans-serif;">
                &copy; 2026 Flow LAB &bull; Todos os direitos reservados
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
SET name = EXCLUDED.name,
    subject_template = EXCLUDED.subject_template,
    body_html = EXCLUDED.body_html;

-- payment_authorization_rejected: para o solicitante, quando o autorizador rejeita.
INSERT INTO public.notification_templates (slug, name, subject_template, body_html)
VALUES (
  'payment_authorization_rejected',
  'Pedido de pagamento rejeitado pelo autorizador (para o solicitante)',
  '[FlowLAB] Pedido de pagamento {{codigo}} rejeitado pelo autorizador',
  '<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Pedido de pagamento rejeitado pelo autorizador</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:''Segoe UI'',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f7;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);border-collapse:collapse;">

          <!-- CABEÇALHO -->
          <tr>
            <td align="center" style="background-color:#059669;padding:32px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="background-color:rgba(255,255,255,0.15);border-radius:8px;padding:8px 12px;vertical-align:middle;">
                    <span style="font-size:22px;line-height:1;color:#ffffff;">&#128176;</span>
                  </td>
                  <td style="padding-left:14px;vertical-align:middle;">
                    <span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Flow LAB</span>
                    <br />
                    <span style="font-size:12px;color:rgba(255,255,255,0.85);font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">Pagamentos</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CORPO -->
          <tr>
            <td style="padding:40px 40px 32px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
                <tr>
                  <td style="background-color:#ecfdf5;border-radius:6px;padding:6px 14px;">
                    <span style="font-size:12px;font-weight:600;color:#047857;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.5px;">Pedido de pagamento &bull; {{codigo}}</span>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.3;">
                Seu pedido foi rejeitado
              </p>
              <p style="margin:0 0 28px 0;font-size:15px;color:#6b7280;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.6;">
                <strong>{{autorizador}}</strong> rejeitou o seu pedido de pagamento. Se for o caso, faça um novo pedido com os ajustes.
              </p>
              <!-- MOTIVO -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:28px;">
                <tr>
                  <td style="background-color:#fef2f2;border-left:4px solid #dc2626;border-radius:0 8px 8px 0;padding:20px 24px;">
                    <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;color:#b91c1c;letter-spacing:1px;text-transform:uppercase;font-family:''Segoe UI'',Arial,sans-serif;">Motivo da rejeição</p>
                    <p style="margin:0;font-size:15px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.6;white-space:pre-line;">{{motivo}}</p>
                  </td>
                </tr>
              </table>
              <!-- DETALHES DO PEDIDO -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:28px;border-top:1px solid #f0f0f0;border-bottom:1px solid #f0f0f0;">
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Valor</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:18px;font-weight:700;color:#047857;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{valor}}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Fornecedor</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{fornecedor}}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Tipo</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{tipo}} &bull; {{forma}}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Pagamento em</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{data_pagamento}}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Solicitante</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{solicitante}} ({{setor}})</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Descrição</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;"><span style="white-space:pre-line;">{{descricao}}</span></td>
                </tr>
              </table>
              <!-- BOTÃO -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td align="center" style="border-radius:8px;background-color:#059669;">
                    <a href="{{action_url}}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#059669;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.3px;">
                      Ver o pedido &#8594;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0 0;font-size:12px;color:#9ca3af;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br />
                <a href="{{action_url}}" style="color:#047857;text-decoration:none;word-break:break-all;">{{action_url}}</a>
              </p>
            </td>
          </tr>

          <!-- RODAPÉ -->
          <tr>
            <td style="padding:24px 40px 32px 40px;background-color:#fafafa;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 4px 0;font-size:13px;font-weight:600;color:#374151;font-family:''Segoe UI'',Arial,sans-serif;">Flow LAB</p>
              <p style="margin:0 0 12px 0;font-size:12px;color:#9ca3af;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">
                Este é um e-mail automático. Por favor, não responda diretamente a esta mensagem.<br />
                Acompanhe os seus pedidos em Solicitações &gt; Pagamentos no portal Flow LAB.
              </p>
              <p style="margin:0;font-size:11px;color:#d1d5db;font-family:''Segoe UI'',Arial,sans-serif;">
                &copy; 2026 Flow LAB &bull; Todos os direitos reservados
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
SET name = EXCLUDED.name,
    subject_template = EXCLUDED.subject_template,
    body_html = EXCLUDED.body_html;

-- payment_ready_for_approval: para quem tem canApprovePayments, quando o pedido é autorizado (ou nasce autorizado).
INSERT INTO public.notification_templates (slug, name, subject_template, body_html)
VALUES (
  'payment_ready_for_approval',
  'Pedido de pagamento autorizado, aguardando o Financeiro',
  '[FlowLAB] Pedido de pagamento {{codigo}} autorizado, aguardando aprovação',
  '<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Pedido de pagamento aguardando aprovação</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:''Segoe UI'',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f7;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);border-collapse:collapse;">

          <!-- CABEÇALHO -->
          <tr>
            <td align="center" style="background-color:#059669;padding:32px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="background-color:rgba(255,255,255,0.15);border-radius:8px;padding:8px 12px;vertical-align:middle;">
                    <span style="font-size:22px;line-height:1;color:#ffffff;">&#128176;</span>
                  </td>
                  <td style="padding-left:14px;vertical-align:middle;">
                    <span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Flow LAB</span>
                    <br />
                    <span style="font-size:12px;color:rgba(255,255,255,0.85);font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">Pagamentos</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CORPO -->
          <tr>
            <td style="padding:40px 40px 32px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
                <tr>
                  <td style="background-color:#ecfdf5;border-radius:6px;padding:6px 14px;">
                    <span style="font-size:12px;font-weight:600;color:#047857;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.5px;">Pedido de pagamento &bull; {{codigo}}</span>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.3;">
                Pedido autorizado, aguardando a aprovação do Financeiro
              </p>
              <p style="margin:0 0 28px 0;font-size:15px;color:#6b7280;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.6;">
                O pedido de <strong>{{solicitante}}</strong> foi autorizado por <strong>{{autorizador}}</strong> e entrou na fila de aprovação.
              </p>
              <!-- DETALHES DO PEDIDO -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:28px;border-top:1px solid #f0f0f0;border-bottom:1px solid #f0f0f0;">
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Valor</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:18px;font-weight:700;color:#047857;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{valor}}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Fornecedor</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{fornecedor}}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Tipo</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{tipo}} &bull; {{forma}}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Pagamento em</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{data_pagamento}}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Solicitante</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{solicitante}} ({{setor}})</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Descrição</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;"><span style="white-space:pre-line;">{{descricao}}</span></td>
                </tr>
              </table>
              <!-- BOTÃO -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td align="center" style="border-radius:8px;background-color:#059669;">
                    <a href="{{action_url}}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#059669;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.3px;">
                      Aprovar ou rejeitar &#8594;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0 0;font-size:12px;color:#9ca3af;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br />
                <a href="{{action_url}}" style="color:#047857;text-decoration:none;word-break:break-all;">{{action_url}}</a>
              </p>
            </td>
          </tr>

          <!-- RODAPÉ -->
          <tr>
            <td style="padding:24px 40px 32px 40px;background-color:#fafafa;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 4px 0;font-size:13px;font-weight:600;color:#374151;font-family:''Segoe UI'',Arial,sans-serif;">Flow LAB</p>
              <p style="margin:0 0 12px 0;font-size:12px;color:#9ca3af;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">
                Este é um e-mail automático. Por favor, não responda diretamente a esta mensagem.<br />
                Para decidir, acesse Solicitações &gt; Pagamentos no portal Flow LAB.
              </p>
              <p style="margin:0;font-size:11px;color:#d1d5db;font-family:''Segoe UI'',Arial,sans-serif;">
                &copy; 2026 Flow LAB &bull; Todos os direitos reservados
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
SET name = EXCLUDED.name,
    subject_template = EXCLUDED.subject_template,
    body_html = EXCLUDED.body_html;

COMMIT;
