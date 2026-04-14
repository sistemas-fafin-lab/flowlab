/*
  # Module Categories — Categorias customizáveis do menu lateral

  1. Nova Tabela
    - `module_categories`: Armazena as categorias de agrupamento dos módulos no sidebar
      - `id` (TEXT, primary key — slug like 'gerencial')
      - `name` (VARCHAR, nome exibido em uppercase no menu)
      - `sort_order` (INTEGER, ordena as categorias no menu)
      - `items` (JSONB, array de nomes dos módulos nesta categoria)
      - `created_at` (TIMESTAMPTZ)
      - `updated_at` (TIMESTAMPTZ)

  2. Segurança
    - RLS habilitado
    - Leitura para usuários autenticados
    - Escrita apenas para admins (canManageUsers)
*/

-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  1. CRIAR TABELA module_categories                                          ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS module_categories (
  id TEXT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_categories_sort ON module_categories(sort_order);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_module_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_module_categories_updated_at
  BEFORE UPDATE ON module_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_module_categories_updated_at();

-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  2. SEED — Categorias padrão                                                ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

INSERT INTO module_categories (id, name, sort_order, items) VALUES
  ('gerencial',     'GERENCIAL',      0, '["Dashboard"]'::jsonb),
  ('operacoes',     'OPERAÇÕES',      1, '["Produtos","Movimentações","Solicitações","Fornecedores","Cotações","Faturamento"]'::jsonb),
  ('administracao', 'ADMINISTRAÇÃO',  2, '["Usuários","Sistema"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  3. RLS — Segurança                                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

ALTER TABLE module_categories ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado
CREATE POLICY "module_categories_read"
  ON module_categories
  FOR SELECT
  TO authenticated
  USING (true);

-- Inserção/Update/Delete: apenas admins (com canManageUsers)
CREATE POLICY "module_categories_admin_write"
  ON module_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      LEFT JOIN custom_roles cr ON cr.id = up.custom_role_id
      WHERE up.id = auth.uid()
      AND (
        up.role = 'admin'
        OR cr.permissions @> '["canManageUsers"]'::jsonb
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      LEFT JOIN custom_roles cr ON cr.id = up.custom_role_id
      WHERE up.id = auth.uid()
      AND (
        up.role = 'admin'
        OR cr.permissions @> '["canManageUsers"]'::jsonb
      )
    )
  );
