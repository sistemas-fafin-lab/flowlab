/*
  # Corrigir políticas RLS para fornecedores

  1. Problemas identificados
    - Políticas RLS muito restritivas
    - Mapeamento incorreto de campos

  2. Correções
    - Simplificar políticas RLS
    - Permitir operações CRUD para usuários autenticados
*/

-- Remover políticas existentes
DROP POLICY IF EXISTS "Allow authenticated inserts" ON suppliers;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON suppliers;
DROP POLICY IF EXISTS "ROW" ON suppliers;

-- Criar políticas simplificadas
CREATE POLICY "Allow all operations for authenticated users"
  ON suppliers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);