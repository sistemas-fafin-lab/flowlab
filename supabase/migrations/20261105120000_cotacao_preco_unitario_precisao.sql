-- Preço unitário de proposta precisa guardar mais de 2 casas (ex.: 0,02575).
ALTER TABLE quotation_proposal_items
  ALTER COLUMN unit_price TYPE DECIMAL(15, 6);
