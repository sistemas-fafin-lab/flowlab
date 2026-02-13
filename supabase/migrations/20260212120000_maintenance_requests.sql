/*
  # Módulo de Manutenção - Tabelas e Políticas

  1. Novas Tabelas
    - `maintenance_requests` - Solicitações de manutenção (entidade independente)
    - `maintenance_inventory_items` - Vínculo com materiais do inventário

  2. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas para usuários autenticados
    - Políticas administrativas para gestão completa

  3. Índices
    - Índices para campos frequentemente consultados
    - Índices para foreign keys
*/

-- ============================================
-- TABELA PRINCIPAL: maintenance_requests
-- ============================================
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Identificador sequencial legível
  codigo TEXT NOT NULL UNIQUE,
  
  -- Dados do solicitante
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  department TEXT NOT NULL,
  
  -- Dados da ocorrência
  local_ocorrencia TEXT NOT NULL,
  descricao TEXT NOT NULL,
  impacto_operacional TEXT NOT NULL,
  data_identificacao TIMESTAMPTZ NOT NULL,
  
  -- Classificação
  prioridade TEXT NOT NULL DEFAULT 'common' CHECK (prioridade IN ('urgent', 'priority', 'common')),
  
  -- Status do ciclo de vida
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Aguardando análise
    'in_progress',  -- Em andamento
    'completed',    -- Concluído
    'cancelled'     -- Cancelado
  )),
  
  -- Imagens/Anexos (array de URLs do Supabase Storage)
  images TEXT[] DEFAULT '{}',
  
  -- Campos de auditoria
  assigned_to TEXT,
  assigned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA DE VÍNCULO: maintenance_inventory_items
-- ============================================
CREATE TABLE IF NOT EXISTS maintenance_inventory_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Referências
  maintenance_request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  movement_id UUID REFERENCES stock_movements(id) ON DELETE SET NULL,
  
  -- Dados do consumo
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  product_name TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ÍNDICES
-- ============================================

-- Índices para maintenance_requests
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_requester_id ON maintenance_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_department ON maintenance_requests(department);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status ON maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_prioridade ON maintenance_requests(prioridade);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_created_at ON maintenance_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_data_identificacao ON maintenance_requests(data_identificacao);

-- Índices para maintenance_inventory_items
CREATE INDEX IF NOT EXISTS idx_maintenance_inventory_items_request_id ON maintenance_inventory_items(maintenance_request_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_inventory_items_product_id ON maintenance_inventory_items(product_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_inventory_items_movement_id ON maintenance_inventory_items(movement_id);

-- ============================================
-- FUNÇÃO: Gerar código sequencial
-- ============================================
CREATE OR REPLACE FUNCTION generate_maintenance_code()
RETURNS TRIGGER AS $$
DECLARE
  next_id INTEGER;
BEGIN
  -- Obtém o próximo número sequencial
  SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 5) AS INTEGER)), 0) + 1
  INTO next_id
  FROM maintenance_requests
  WHERE codigo ~ '^MNT-[0-9]+$';
  
  -- Gera o novo código no formato MNT-XXX
  NEW.codigo = 'MNT-' || LPAD(next_id::TEXT, 4, '0');
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-gerar código
-- ============================================
DROP TRIGGER IF EXISTS trigger_generate_maintenance_code ON maintenance_requests;
CREATE TRIGGER trigger_generate_maintenance_code
  BEFORE INSERT ON maintenance_requests
  FOR EACH ROW
  WHEN (NEW.codigo IS NULL OR NEW.codigo = '')
  EXECUTE FUNCTION generate_maintenance_code();

-- ============================================
-- FUNÇÃO: Atualizar updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_maintenance_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-atualizar updated_at
-- ============================================
DROP TRIGGER IF EXISTS trigger_update_maintenance_requests_updated_at ON maintenance_requests;
CREATE TRIGGER trigger_update_maintenance_requests_updated_at
  BEFORE UPDATE ON maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_maintenance_requests_updated_at();

-- ============================================
-- RLS (Row Level Security)
-- ============================================

-- Habilitar RLS nas tabelas
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_inventory_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS: maintenance_requests
-- ============================================

-- Política de leitura: usuários veem suas próprias ou admins/operadores veem todas
CREATE POLICY "Users can view own maintenance requests"
  ON maintenance_requests
  FOR SELECT
  TO authenticated
  USING (
    requester_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'operator')
    )
  );

-- Política de inserção: usuários autenticados podem criar suas próprias solicitações
CREATE POLICY "Users can create own maintenance requests"
  ON maintenance_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (requester_id = auth.uid());

-- Política de atualização: próprio usuário pode atualizar se pendente, admins/operadores podem sempre
CREATE POLICY "Users can update maintenance requests"
  ON maintenance_requests
  FOR UPDATE
  TO authenticated
  USING (
    (requester_id = auth.uid() AND status = 'pending')
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'operator')
    )
  );

-- Política de exclusão: apenas admins podem excluir
CREATE POLICY "Admins can delete maintenance requests"
  ON maintenance_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================
-- POLÍTICAS: maintenance_inventory_items
-- ============================================

-- Política de leitura: todos autenticados podem ler
CREATE POLICY "Authenticated users can view maintenance inventory items"
  ON maintenance_inventory_items
  FOR SELECT
  TO authenticated
  USING (true);

-- Política de inserção: admins/operadores podem inserir
CREATE POLICY "Admins and operators can create maintenance inventory items"
  ON maintenance_inventory_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'operator')
    )
  );

-- Política de atualização: admins/operadores podem atualizar
CREATE POLICY "Admins and operators can update maintenance inventory items"
  ON maintenance_inventory_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'operator')
    )
  );

-- Política de exclusão: apenas admins podem excluir
CREATE POLICY "Admins can delete maintenance inventory items"
  ON maintenance_inventory_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================
-- COMENTÁRIOS
-- ============================================
COMMENT ON TABLE maintenance_requests IS 'Solicitações de manutenção - Módulo independente';
COMMENT ON COLUMN maintenance_requests.codigo IS 'Código único da solicitação (MNT-XXXX)';
COMMENT ON COLUMN maintenance_requests.local_ocorrencia IS 'Local físico onde ocorreu o problema';
COMMENT ON COLUMN maintenance_requests.descricao IS 'Descrição detalhada do problema';
COMMENT ON COLUMN maintenance_requests.impacto_operacional IS 'Descrição do impacto nas operações';
COMMENT ON COLUMN maintenance_requests.prioridade IS 'urgent: risco iminente, priority: alta prioridade, common: prioridade normal';
COMMENT ON COLUMN maintenance_requests.status IS 'pending: aguardando, in_progress: em andamento, completed: concluído, cancelled: cancelado';
COMMENT ON COLUMN maintenance_requests.images IS 'Array de URLs das imagens no Supabase Storage';

COMMENT ON TABLE maintenance_inventory_items IS 'Materiais do inventário consumidos em manutenções';
COMMENT ON COLUMN maintenance_inventory_items.movement_id IS 'Referência à movimentação de estoque (quando o material for consumido)';

-- ============================================
-- STORAGE: Bucket para imagens de manutenção
-- ============================================
-- NOTA: Executar manualmente no Supabase Dashboard ou via API
-- O Supabase não permite criar buckets diretamente via migrations SQL padrão

-- IMPORTANTE: O hook useMaintenanceRequest.ts usa o bucket "maintenance-images"
-- Criar bucket para armazenar imagens/anexos de manutenção
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'maintenance-images', 
--   'maintenance-images', 
--   true,
--   5242880, -- 5MB
--   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
-- );

-- Política para permitir upload de arquivos por usuários autenticados
-- CREATE POLICY "Allow authenticated uploads on maintenance-images"
-- ON storage.objects
-- FOR INSERT TO authenticated
-- WITH CHECK (bucket_id = 'maintenance-images');

-- Política para permitir atualização de arquivos por usuários autenticados
-- CREATE POLICY "Allow authenticated updates on maintenance-images"
-- ON storage.objects
-- FOR UPDATE TO authenticated
-- USING (bucket_id = 'maintenance-images');

-- Política para permitir exclusão de arquivos por usuários autenticados
-- CREATE POLICY "Allow authenticated deletes on maintenance-images"
-- ON storage.objects
-- FOR DELETE TO authenticated
-- USING (bucket_id = 'maintenance-images');

-- Política para permitir leitura pública dos arquivos
-- CREATE POLICY "Allow public read on maintenance-images"
-- ON storage.objects
-- FOR SELECT TO public
-- USING (bucket_id = 'maintenance-images');
