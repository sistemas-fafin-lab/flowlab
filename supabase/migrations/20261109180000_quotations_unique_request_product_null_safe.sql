-- Migration: índice único de cotação por solicitação + produto, seguro para produto nulo
-- Description: quotations_unique_request_product (request_id, product_id) não barrava
-- duplicatas quando product_id é NULL (NULLs nunca são iguais num índice único), o que
-- acontece em solicitações com item sem produto do catálogo. Um clique duplo em
-- "Iniciar Cotação" criou duas cotações da REQ873 (09/11/2026). O índice passa a usar o
-- nome do produto quando não há product_id.
-- Conferido em produção em 09/11/2026: nenhuma duplicata ativa que impeça a criação.
-- Date: 2026-11-09

DROP INDEX IF EXISTS quotations_unique_request_product;

CREATE UNIQUE INDEX quotations_unique_request_product
  ON quotations (request_id, (COALESCE(product_id::text, product_name)))
  WHERE status NOT IN ('cancelled', 'rejected');
