-- ============================================================================
-- MÓDULO DE GESTÃO DE FATURAMENTO E RECEBÍVEIS
-- Espelho financeiro sincronizado com sistema APLIS
-- ============================================================================

-- ============================================================================
-- 1. TABELA: OPERADORAS (Convênios/Planos de Saúde)
-- ============================================================================
CREATE TABLE IF NOT EXISTS operadoras (
  id_operadora UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  prazo_pagamento_dias INTEGER DEFAULT 30,
  contato_email TEXT,
  contato_telefone TEXT,
  aplis_id TEXT UNIQUE, -- ID de referência no sistema APLIS
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operadoras_nome ON operadoras(nome);
CREATE INDEX IF NOT EXISTS idx_operadoras_aplis_id ON operadoras(aplis_id);

-- ============================================================================
-- 2. TABELA: LOTES (Agrupamento de Requisições)
-- ============================================================================
CREATE TABLE IF NOT EXISTS lotes (
  id_lote UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operadora_id UUID NOT NULL REFERENCES operadoras(id_operadora) ON DELETE CASCADE,
  codigo_lote TEXT NOT NULL,
  data_criacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_envio DATE,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'enviado', 'processado', 'fechado')),
  valor_total DECIMAL(15, 2) DEFAULT 0,
  qtd_requisicoes INTEGER DEFAULT 0,
  aplis_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lotes_operadora ON lotes(operadora_id);
CREATE INDEX IF NOT EXISTS idx_lotes_status ON lotes(status);
CREATE INDEX IF NOT EXISTS idx_lotes_data_criacao ON lotes(data_criacao);
CREATE INDEX IF NOT EXISTS idx_lotes_aplis_id ON lotes(aplis_id);

-- ============================================================================
-- 3. TABELA: REQUISICOES (Guias/Procedimentos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS requisicoes (
  id_requisicao UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id UUID REFERENCES lotes(id_lote) ON DELETE SET NULL,
  numero_guia TEXT NOT NULL,
  data_criacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_execucao DATE,
  valor DECIMAL(15, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_lote', 'faturada', 'paga', 'glosada')),
  paciente_nome TEXT,
  procedimento_codigo TEXT,
  procedimento_descricao TEXT,
  aplis_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requisicoes_lote ON requisicoes(lote_id);
CREATE INDEX IF NOT EXISTS idx_requisicoes_status ON requisicoes(status);
CREATE INDEX IF NOT EXISTS idx_requisicoes_data_criacao ON requisicoes(data_criacao);
CREATE INDEX IF NOT EXISTS idx_requisicoes_aplis_id ON requisicoes(aplis_id);

-- ============================================================================
-- 4. TABELA: NOTAS (Faturas emitidas para operadoras)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notas (
  id_nota UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operadora_id UUID NOT NULL REFERENCES operadoras(id_operadora) ON DELETE CASCADE,
  numero_nota TEXT NOT NULL,
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE,
  valor_total DECIMAL(15, 2) NOT NULL DEFAULT 0,
  valor_recebido DECIMAL(15, 2) DEFAULT 0,
  valor_glosado DECIMAL(15, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'parcialmente_recebida', 'recebida', 'glosada', 'cancelada')),
  competencia TEXT, -- Mês/Ano de competência (ex: "2026-03")
  observacoes TEXT,
  aplis_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notas_operadora ON notas(operadora_id);
CREATE INDEX IF NOT EXISTS idx_notas_status ON notas(status);
CREATE INDEX IF NOT EXISTS idx_notas_data_emissao ON notas(data_emissao);
CREATE INDEX IF NOT EXISTS idx_notas_data_vencimento ON notas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_notas_aplis_id ON notas(aplis_id);

-- ============================================================================
-- 5. TABELA ASSOCIATIVA: NOTA_LOTE (N:N)
-- ============================================================================
CREATE TABLE IF NOT EXISTS nota_lote (
  id_nota UUID NOT NULL REFERENCES notas(id_nota) ON DELETE CASCADE,
  id_lote UUID NOT NULL REFERENCES lotes(id_lote) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id_nota, id_lote)
);

CREATE INDEX IF NOT EXISTS idx_nota_lote_nota ON nota_lote(id_nota);
CREATE INDEX IF NOT EXISTS idx_nota_lote_lote ON nota_lote(id_lote);

-- ============================================================================
-- 6. TABELA: RECEBIMENTOS (Contas a Receber / Baixas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS recebimentos (
  id_receb UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nota_id UUID REFERENCES notas(id_nota) ON DELETE SET NULL,
  lote_id UUID REFERENCES lotes(id_lote) ON DELETE SET NULL,
  data_prevista DATE NOT NULL,
  data_receb DATE,
  valor_previsto DECIMAL(15, 2) NOT NULL DEFAULT 0,
  valor_recebido DECIMAL(15, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'previsto' CHECK (status IN ('previsto', 'recebido', 'parcial', 'cancelado')),
  banco_nome TEXT,
  banco_conta TEXT,
  comprovante_url TEXT,
  observacoes TEXT,
  registrado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recebimentos_nota ON recebimentos(nota_id);
CREATE INDEX IF NOT EXISTS idx_recebimentos_lote ON recebimentos(lote_id);
CREATE INDEX IF NOT EXISTS idx_recebimentos_status ON recebimentos(status);
CREATE INDEX IF NOT EXISTS idx_recebimentos_data_prevista ON recebimentos(data_prevista);
CREATE INDEX IF NOT EXISTS idx_recebimentos_data_receb ON recebimentos(data_receb);

-- ============================================================================
-- 7. TABELA: GLOSAS (Valores não pagos pelas operadoras)
-- ============================================================================
CREATE TABLE IF NOT EXISTS glosas (
  id_glosa UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recebimento_id UUID NOT NULL REFERENCES recebimentos(id_receb) ON DELETE CASCADE,
  nota_id UUID REFERENCES notas(id_nota) ON DELETE SET NULL,
  requisicao_id UUID REFERENCES requisicoes(id_requisicao) ON DELETE SET NULL,
  valor DECIMAL(15, 2) NOT NULL DEFAULT 0,
  motivo TEXT NOT NULL,
  codigo_glosa TEXT, -- Código ANS ou interno da operadora
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_recurso', 'revertida', 'definitiva')),
  recurso BOOLEAN DEFAULT FALSE,
  data_recurso DATE,
  resultado_recurso TEXT,
  responsavel TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_glosas_recebimento ON glosas(recebimento_id);
CREATE INDEX IF NOT EXISTS idx_glosas_nota ON glosas(nota_id);
CREATE INDEX IF NOT EXISTS idx_glosas_status ON glosas(status);
CREATE INDEX IF NOT EXISTS idx_glosas_recurso ON glosas(recurso);

-- ============================================================================
-- 8. TABELA: SYNC_LOG (Log de sincronização com APLIS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS billing_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('operadoras', 'notas', 'lotes', 'requisicoes', 'full')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error', 'partial')),
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  details JSONB
);

CREATE INDEX IF NOT EXISTS idx_billing_sync_log_type ON billing_sync_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_billing_sync_log_status ON billing_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_billing_sync_log_started ON billing_sync_log(started_at);

-- ============================================================================
-- TRIGGERS: Atualização automática de updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_billing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_operadoras_updated_at ON operadoras;
CREATE TRIGGER trigger_operadoras_updated_at
  BEFORE UPDATE ON operadoras FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

DROP TRIGGER IF EXISTS trigger_lotes_updated_at ON lotes;
CREATE TRIGGER trigger_lotes_updated_at
  BEFORE UPDATE ON lotes FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

DROP TRIGGER IF EXISTS trigger_requisicoes_updated_at ON requisicoes;
CREATE TRIGGER trigger_requisicoes_updated_at
  BEFORE UPDATE ON requisicoes FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

DROP TRIGGER IF EXISTS trigger_notas_updated_at ON notas;
CREATE TRIGGER trigger_notas_updated_at
  BEFORE UPDATE ON notas FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

DROP TRIGGER IF EXISTS trigger_recebimentos_updated_at ON recebimentos;
CREATE TRIGGER trigger_recebimentos_updated_at
  BEFORE UPDATE ON recebimentos FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

DROP TRIGGER IF EXISTS trigger_glosas_updated_at ON glosas;
CREATE TRIGGER trigger_glosas_updated_at
  BEFORE UPDATE ON glosas FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

-- ============================================================================
-- TRIGGER: Atualizar valor_glosado e valor_recebido na nota
-- ============================================================================
CREATE OR REPLACE FUNCTION update_nota_valores()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualiza totais na nota relacionada
  IF NEW.nota_id IS NOT NULL THEN
    UPDATE notas SET
      valor_recebido = COALESCE((
        SELECT SUM(valor_recebido) FROM recebimentos 
        WHERE nota_id = NEW.nota_id AND status IN ('recebido', 'parcial')
      ), 0),
      valor_glosado = COALESCE((
        SELECT SUM(valor) FROM glosas 
        WHERE nota_id = NEW.nota_id AND status IN ('aberta', 'em_recurso', 'definitiva')
      ), 0),
      status = CASE
        WHEN (SELECT SUM(valor_recebido) FROM recebimentos WHERE nota_id = NEW.nota_id AND status IN ('recebido', 'parcial')) >= valor_total THEN 'recebida'
        WHEN (SELECT SUM(valor_recebido) FROM recebimentos WHERE nota_id = NEW.nota_id AND status IN ('recebido', 'parcial')) > 0 THEN 'parcialmente_recebida'
        WHEN (SELECT COUNT(*) FROM glosas WHERE nota_id = NEW.nota_id AND status = 'definitiva') > 0 THEN 'glosada'
        ELSE 'aberta'
      END,
      updated_at = NOW()
    WHERE id_nota = NEW.nota_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_recebimento_update_nota ON recebimentos;
CREATE TRIGGER trigger_recebimento_update_nota
  AFTER INSERT OR UPDATE ON recebimentos FOR EACH ROW EXECUTE FUNCTION update_nota_valores();

DROP TRIGGER IF EXISTS trigger_glosa_update_nota ON glosas;
CREATE TRIGGER trigger_glosa_update_nota
  AFTER INSERT OR UPDATE ON glosas FOR EACH ROW EXECUTE FUNCTION update_nota_valores();

-- ============================================================================
-- RLS (Row Level Security) - Habilitação
-- ============================================================================
ALTER TABLE operadoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE nota_lote ENABLE ROW LEVEL SECURITY;
ALTER TABLE recebimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE glosas ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_sync_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES - OPERADORAS
-- ============================================================================
CREATE POLICY "Authenticated users can view operadoras" ON operadoras
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert operadoras" ON operadoras
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update operadoras" ON operadoras
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete operadoras" ON operadoras
  FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- RLS POLICIES - LOTES
-- ============================================================================
CREATE POLICY "Authenticated users can view lotes" ON lotes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert lotes" ON lotes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update lotes" ON lotes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete lotes" ON lotes
  FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- RLS POLICIES - REQUISICOES
-- ============================================================================
CREATE POLICY "Authenticated users can view requisicoes" ON requisicoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert requisicoes" ON requisicoes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update requisicoes" ON requisicoes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete requisicoes" ON requisicoes
  FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- RLS POLICIES - NOTAS
-- ============================================================================
CREATE POLICY "Authenticated users can view notas" ON notas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert notas" ON notas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update notas" ON notas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete notas" ON notas
  FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- RLS POLICIES - NOTA_LOTE
-- ============================================================================
CREATE POLICY "Authenticated users can view nota_lote" ON nota_lote
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert nota_lote" ON nota_lote
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete nota_lote" ON nota_lote
  FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- RLS POLICIES - RECEBIMENTOS
-- ============================================================================
CREATE POLICY "Authenticated users can view recebimentos" ON recebimentos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert recebimentos" ON recebimentos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update recebimentos" ON recebimentos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete recebimentos" ON recebimentos
  FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- RLS POLICIES - GLOSAS
-- ============================================================================
CREATE POLICY "Authenticated users can view glosas" ON glosas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert glosas" ON glosas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update glosas" ON glosas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete glosas" ON glosas
  FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- RLS POLICIES - BILLING_SYNC_LOG
-- ============================================================================
CREATE POLICY "Authenticated users can view billing_sync_log" ON billing_sync_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage billing_sync_log" ON billing_sync_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- COMMENTS - Documentação das tabelas
-- ============================================================================
COMMENT ON TABLE operadoras IS 'Operadoras de planos de saúde/convênios (sincronizado do APLIS)';
COMMENT ON TABLE lotes IS 'Lotes de faturamento agrupando requisições (sincronizado do APLIS)';
COMMENT ON TABLE requisicoes IS 'Guias/procedimentos médicos individuais (sincronizado do APLIS)';
COMMENT ON TABLE notas IS 'Notas fiscais/faturas emitidas para operadoras (sincronizado do APLIS)';
COMMENT ON TABLE nota_lote IS 'Relacionamento N:N entre notas e lotes';
COMMENT ON TABLE recebimentos IS 'Registro de recebimentos financeiros (contas a receber)';
COMMENT ON TABLE glosas IS 'Registro de glosas e recursos junto às operadoras';
COMMENT ON TABLE billing_sync_log IS 'Log de sincronização com sistema APLIS';
