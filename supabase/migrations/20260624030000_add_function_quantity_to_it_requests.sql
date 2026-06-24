ALTER TABLE it_requests
  ADD COLUMN IF NOT EXISTS function_quantity DECIMAL(5,1) NULL;
