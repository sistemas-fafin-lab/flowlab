/*
  # Sistema de Roles Dinâmicas - Flow LAB
  
  1. Nova Tabela
    - `custom_roles`: Armazena as roles personalizáveis do sistema
      - `id` (UUID, primary key)
      - `name` (VARCHAR, nome da role ex: "Analista Financeiro")
      - `description` (TEXT, descrição da role)
      - `permissions` (JSONB, array de strings com as chaves de permissão)
      - `is_system` (BOOLEAN, protege roles originais de exclusão)
      - `created_at` (TIMESTAMPTZ)
      - `updated_at` (TIMESTAMPTZ)
  
  2. Alterações
    - Adiciona coluna `custom_role_id` na tabela `user_profiles`
    - Migra usuários existentes para as roles correspondentes
  
  3. Segurança
    - RLS habilitado
    - Políticas para leitura e gerenciamento por admins
*/

-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  1. CRIAR TABELA custom_roles                                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_custom_roles_name ON custom_roles(name);
CREATE INDEX IF NOT EXISTS idx_custom_roles_is_system ON custom_roles(is_system);
CREATE INDEX IF NOT EXISTS idx_custom_roles_permissions ON custom_roles USING GIN(permissions);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_custom_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_custom_roles_updated_at
  BEFORE UPDATE ON custom_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_roles_updated_at();

-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  2. INSERIR ROLES PADRÃO DO SISTEMA                                          ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

INSERT INTO custom_roles (id, name, description, permissions, is_system) VALUES
-- Role: Administrador (acesso completo)
(
  'a0000000-0000-0000-0000-000000000001',
  'Administrador',
  'Acesso completo a todos os módulos do sistema. Pode gerenciar usuários, configurar alçadas e acessar todas as funcionalidades.',
  '["canViewDashboard", "canManageProducts", "canViewProducts", "canAddProducts", "canEditProducts", "canDeleteProducts", "canViewMovements", "canAddMovements", "canViewRequests", "canAddRequests", "canApproveRequests", "canViewExpiration", "canViewChangelog", "canManageUsers", "canManageSuppliers", "canManageQuotations", "canConfigureRequestPeriods", "canViewBilling", "canManageRoles"]'::jsonb,
  true
),

-- Role: Operador (acesso operacional sem dashboard e usuários)
(
  'a0000000-0000-0000-0000-000000000002',
  'Operador',
  'Acesso a produtos, movimentações, solicitações, fornecedores e cotações. Não tem acesso ao dashboard e gerenciamento de usuários.',
  '["canManageProducts", "canViewProducts", "canAddProducts", "canEditProducts", "canDeleteProducts", "canViewMovements", "canAddMovements", "canViewRequests", "canAddRequests", "canApproveRequests", "canViewExpiration", "canViewChangelog", "canManageSuppliers", "canManageQuotations", "canConfigureRequestPeriods", "canViewBilling"]'::jsonb,
  true
),

-- Role: Solicitante (acesso apenas a solicitações)
(
  'a0000000-0000-0000-0000-000000000003',
  'Solicitante',
  'Acesso restrito para criar e visualizar solicitações do seu departamento.',
  '["canViewRequests", "canAddRequests"]'::jsonb,
  true
)

ON CONFLICT (name) DO NOTHING;

-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  3. ALTERAR TABELA user_profiles (antes das policies que referenciam a col.) ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- Adicionar coluna custom_role_id antes de criar as políticas RLS que a referenciam
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES custom_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_custom_role_id ON user_profiles(custom_role_id);

-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  4. HABILITAR RLS E CRIAR POLÍTICAS                                          ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;

-- Política: Todos usuários autenticados podem ler as roles
CREATE POLICY "custom_roles_select_authenticated"
  ON custom_roles
  FOR SELECT
  TO authenticated
  USING (true);

-- Política: Apenas admins podem inserir novas roles
CREATE POLICY "custom_roles_insert_admin"
  ON custom_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND (
        role = 'admin' 
        OR custom_role_id IN (
          SELECT cr.id FROM custom_roles cr 
          WHERE cr.permissions ? 'canManageRoles'
        )
      )
    )
  );

-- Política: Apenas admins podem atualizar roles (exceto roles do sistema)
CREATE POLICY "custom_roles_update_admin"
  ON custom_roles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND (
        role = 'admin' 
        OR custom_role_id IN (
          SELECT cr.id FROM custom_roles cr 
          WHERE cr.permissions ? 'canManageRoles'
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND (
        role = 'admin' 
        OR custom_role_id IN (
          SELECT cr.id FROM custom_roles cr 
          WHERE cr.permissions ? 'canManageRoles'
        )
      )
    )
  );

-- Política: Apenas admins podem deletar roles (exceto roles do sistema)
CREATE POLICY "custom_roles_delete_admin"
  ON custom_roles
  FOR DELETE
  TO authenticated
  USING (
    is_system = false
    AND EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND (
        role = 'admin' 
        OR custom_role_id IN (
          SELECT cr.id FROM custom_roles cr 
          WHERE cr.permissions ? 'canManageRoles'
        )
      )
    )
  );

-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  5. MIGRAR USUÁRIOS EXISTENTES PARA AS NOVAS ROLES                           ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- Atualizar usuários com role 'admin' para a nova role Administrador
UPDATE user_profiles 
SET custom_role_id = 'a0000000-0000-0000-0000-000000000001'
WHERE role = 'admin' AND custom_role_id IS NULL;

-- Atualizar usuários com role 'operator' para a nova role Operador
UPDATE user_profiles 
SET custom_role_id = 'a0000000-0000-0000-0000-000000000002'
WHERE role = 'operator' AND custom_role_id IS NULL;

-- Atualizar usuários com role 'requester' para a nova role Solicitante
UPDATE user_profiles 
SET custom_role_id = 'a0000000-0000-0000-0000-000000000003'
WHERE role = 'requester' AND custom_role_id IS NULL;

-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  6. FUNÇÃO AUXILIAR: Verificar permissão do usuário                          ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION user_has_permission(user_id UUID, permission_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  has_perm BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM user_profiles up
    JOIN custom_roles cr ON cr.id = up.custom_role_id
    WHERE up.id = user_id
    AND cr.permissions ? permission_key
  ) INTO has_perm;
  
  -- Fallback para sistema antigo (role column)
  IF has_perm IS NULL OR has_perm = false THEN
    SELECT CASE 
      WHEN up.role = 'admin' THEN true
      WHEN up.role = 'operator' AND permission_key NOT IN ('canViewDashboard', 'canManageUsers', 'canManageRoles') THEN true
      WHEN up.role = 'requester' AND permission_key IN ('canViewRequests', 'canAddRequests') THEN true
      ELSE false
    END INTO has_perm
    FROM user_profiles up
    WHERE up.id = user_id;
  END IF;
  
  RETURN COALESCE(has_perm, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  7. VIEW: Usuários com suas roles e permissões                               ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE VIEW user_roles_view AS
SELECT 
  up.id AS user_id,
  up.email,
  up.name AS user_name,
  up.role AS legacy_role,
  up.department,
  up.custom_role_id,
  cr.name AS role_name,
  cr.description AS role_description,
  cr.permissions,
  cr.is_system
FROM user_profiles up
LEFT JOIN custom_roles cr ON cr.id = up.custom_role_id;

-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  8. COMENTÁRIOS NAS TABELAS E COLUNAS                                        ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

COMMENT ON TABLE custom_roles IS 'Tabela de roles personalizáveis do sistema Flow LAB';
COMMENT ON COLUMN custom_roles.id IS 'Identificador único da role';
COMMENT ON COLUMN custom_roles.name IS 'Nome da role (ex: Analista Financeiro)';
COMMENT ON COLUMN custom_roles.description IS 'Descrição das responsabilidades da role';
COMMENT ON COLUMN custom_roles.permissions IS 'Array JSON com as chaves de permissão habilitadas';
COMMENT ON COLUMN custom_roles.is_system IS 'Se true, a role não pode ser excluída (roles originais do sistema)';
COMMENT ON COLUMN custom_roles.created_at IS 'Data/hora de criação';
COMMENT ON COLUMN custom_roles.updated_at IS 'Data/hora da última atualização';

COMMENT ON COLUMN user_profiles.custom_role_id IS 'Referência para a role personalizada do usuário';
