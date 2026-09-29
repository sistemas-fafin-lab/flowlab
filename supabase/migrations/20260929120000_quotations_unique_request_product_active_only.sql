-- Migration: quotations_unique_request_product só vale para cotações ativas
-- Description: O índice único (request_id, product_id) foi criado fora das
-- migrations (ver supabase/scripts/diagnose_quotation_duplicates.sql) e
-- impedia criar uma nova cotação para a mesma solicitação + produto depois
-- que a anterior era cancelada ou rejeitada. Passa a ser um índice parcial
-- que ignora cotações nesses status terminais.
-- Date: 2026-09-29

ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_unique_request_product;
DROP INDEX IF EXISTS quotations_unique_request_product;

CREATE UNIQUE INDEX quotations_unique_request_product
  ON quotations (request_id, product_id)
  WHERE status NOT IN ('cancelled', 'rejected');
