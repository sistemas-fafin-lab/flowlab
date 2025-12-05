-- Criação da tabela de solicitações de pagamento
CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL,
  codigo_compacto TEXT NOT NULL,
  tipo_solicitacao TEXT NOT NULL CHECK (tipo_solicitacao IN ('NOTA_FISCAL', 'BOLETO', 'REEMBOLSO', 'ADIANTAMENTO', 'OUTROS')),
  documento_numero TEXT,
  fornecedor TEXT NOT NULL,
  cpf_cnpj TEXT,
  valor_total DECIMAL(15, 2) NOT NULL,
  forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('PIX', 'TED', 'BOLETO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO')),
  dados_pagamento TEXT NOT NULL,
  descricao_detalhada TEXT NOT NULL,
  solicitado_por TEXT NOT NULL,
  autorizado_por TEXT,
  data_pagamento DATE NOT NULL,
  email_usuario TEXT NOT NULL,
  department TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid', 'cancelled')),
  pdf_url TEXT,
  approved_by TEXT,
  approval_date TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_department ON payment_requests(department);
CREATE INDEX IF NOT EXISTS idx_payment_requests_data_pagamento ON payment_requests(data_pagamento);
CREATE INDEX IF NOT EXISTS idx_payment_requests_created_at ON payment_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_requests_solicitado_por ON payment_requests(solicitado_por);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_payment_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payment_requests_updated_at ON payment_requests;
CREATE TRIGGER trigger_update_payment_requests_updated_at
  BEFORE UPDATE ON payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_requests_updated_at();

-- Habilitar RLS (Row Level Security)
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura para usuários autenticados
CREATE POLICY "Users can view payment requests" ON payment_requests
  FOR SELECT
  TO authenticated
  USING (true);

-- Política para permitir inserção para usuários autenticados
CREATE POLICY "Users can insert payment requests" ON payment_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política para permitir atualização para usuários autenticados
CREATE POLICY "Users can update payment requests" ON payment_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política para permitir exclusão para usuários autenticados
CREATE POLICY "Users can delete payment requests" ON payment_requests
  FOR DELETE
  TO authenticated
  USING (true);

-- Comentários na tabela
COMMENT ON TABLE payment_requests IS 'Tabela de solicitações de pagamento';
COMMENT ON COLUMN payment_requests.codigo IS 'Código completo do pedido (PEDIDO DE PAGAMENTO DD/MM - XX)';
COMMENT ON COLUMN payment_requests.codigo_compacto IS 'Código compacto (DD/MM - XX)';
COMMENT ON COLUMN payment_requests.tipo_solicitacao IS 'Tipo: NOTA_FISCAL, BOLETO, REEMBOLSO, ADIANTAMENTO, OUTROS';
COMMENT ON COLUMN payment_requests.documento_numero IS 'Número do documento (NF, boleto, etc)';
COMMENT ON COLUMN payment_requests.fornecedor IS 'Nome do fornecedor ou beneficiário';
COMMENT ON COLUMN payment_requests.cpf_cnpj IS 'CPF ou CNPJ do beneficiário';
COMMENT ON COLUMN payment_requests.valor_total IS 'Valor total do pagamento';
COMMENT ON COLUMN payment_requests.forma_pagamento IS 'Forma: PIX, TED, BOLETO, CARTAO_CREDITO, CARTAO_DEBITO, DINHEIRO';
COMMENT ON COLUMN payment_requests.dados_pagamento IS 'Dados para realizar o pagamento (chave PIX, dados bancários, etc)';
COMMENT ON COLUMN payment_requests.descricao_detalhada IS 'Descrição detalhada do motivo do pagamento';
COMMENT ON COLUMN payment_requests.solicitado_por IS 'Nome de quem solicitou';
COMMENT ON COLUMN payment_requests.autorizado_por IS 'Nome de quem autorizou (opcional)';
COMMENT ON COLUMN payment_requests.data_pagamento IS 'Data desejada para pagamento (apenas terças e quintas)';
COMMENT ON COLUMN payment_requests.email_usuario IS 'Email do usuário que criou a solicitação';
COMMENT ON COLUMN payment_requests.department IS 'Departamento do solicitante';
COMMENT ON COLUMN payment_requests.status IS 'Status: pending, approved, rejected, paid, cancelled';
COMMENT ON COLUMN payment_requests.pdf_url IS 'URL do PDF gerado';
