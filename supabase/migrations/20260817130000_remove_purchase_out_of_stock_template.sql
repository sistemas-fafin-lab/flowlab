-- ============================================================
-- Remove o template purchase_request_out_of_stock
-- (criado em 20260814120000_purchase_request_out_of_stock_template.sql).
-- O alerta de "SC sem estoque" foi substituído pela notificação de alçada
-- (quotation_awaiting_approval, 20260817120000) — ver
-- .scratch/cotacoes/issues/09-remover-alerta-estoque.md.
-- notification_templates não tem coluna is_active; a remoção do registro é
-- suficiente já que nenhum código chama mais esse slug.
-- ============================================================

DELETE FROM public.notification_templates
WHERE slug = 'purchase_request_out_of_stock';
