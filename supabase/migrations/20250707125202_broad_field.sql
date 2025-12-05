/*
  # Criar tabela para histórico de alterações de produtos

  1. Nova Tabela
    - `product_change_logs`
      - `id` (uuid, primary key)
      - `product_id` (uuid, referência ao produto)
      - `product_name` (text, nome do produto)
      - `changed_by` (text, usuário que fez a alteração)
      - `change_reason` (text, motivo da alteração)
      - `field_changes` (jsonb, array com as alterações)
      - `change_date` (date, data da alteração)
      - `change_time` (text, hora da alteração)
      - `created_at` (timestamp)

  2. Segurança
    - Habilitar RLS
    - Políticas para usuários autenticados lerem e criarem logs

  3. Índices
    - Índices para product_id, change_date e created_at
*/

-- Criar tabela product_change_logs
CREATE TABLE IF NOT EXISTS product_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  changed_by text NOT NULL,
  change_reason text NOT NULL,
  field_changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  change_date date NOT NULL,
  change_time text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_product_change_logs_product_id ON product_change_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_product_change_logs_change_date ON product_change_logs(change_date);
CREATE INDEX IF NOT EXISTS idx_product_change_logs_created_at ON product_change_logs(created_at);

-- Habilitar RLS
ALTER TABLE product_change_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Allow authenticated users to read change logs"
  ON product_change_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert change logs"
  ON product_change_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);