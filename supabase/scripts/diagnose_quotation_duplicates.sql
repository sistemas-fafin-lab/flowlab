-- =====================================================
-- Script de Diagnóstico e Correção: Duplicação de Cotações
-- =====================================================
-- MODELO CORRETO:
-- 1 quotation = 1 produto sendo cotado (product_name, requested_quantity)
-- quotation_items = propostas dos FORNECEDORES (preços enviados)
-- Os items NÃO devem ser criados automaticamente!
-- =====================================================

-- 1. DIAGNÓSTICO: Verificar duplicação de fornecedores
SELECT 
  'Fornecedores duplicados por nome' as diagnostico,
  name, 
  COUNT(*) as quantidade
FROM suppliers
GROUP BY name
HAVING COUNT(*) > 1;

-- 2. DIAGNÓSTICO: Verificar cotações duplicadas por request + produto
SELECT 
  'Cotações duplicadas (mesmo request+produto)' as diagnostico,
  request_id,
  product_id,
  product_name,
  COUNT(*) as quantidade
FROM quotations
GROUP BY request_id, product_id, product_name
HAVING COUNT(*) > 1;

-- 3. DIAGNÓSTICO: Contar total de fornecedores ativos
SELECT 
  'Total fornecedores ativos' as diagnostico,
  COUNT(*) as quantidade
FROM suppliers
WHERE status = 'active';

-- 4. DIAGNÓSTICO: Cotações com items criados incorretamente (bug antigo)
-- Se total_items = número de fornecedores ativos, é o bug antigo
SELECT 
  'Cotações com items em excesso (bug: 1 item por fornecedor)' as diagnostico,
  q.id as quotation_id,
  q.product_name,
  COUNT(qi.id) as total_items
FROM quotations q
LEFT JOIN quotation_items qi ON qi.quotation_id = q.id
GROUP BY q.id, q.product_name
HAVING COUNT(qi.id) > 3
ORDER BY total_items DESC
LIMIT 20;

-- =====================================================
-- LIMPEZA DOS DADOS - EXECUTAR PARA CORRIGIR
-- =====================================================

-- 5. LIMPEZA: Remover TODOS os quotation_items criados pelo bug
-- Os items corretos serão criados quando fornecedores enviarem propostas
DELETE FROM quotation_items;

-- 6. OPCIONAL: Remover cotações duplicadas (manter apenas a mais antiga)
-- DELETE FROM quotations
-- WHERE id NOT IN (
--   SELECT MIN(id)
--   FROM quotations
--   GROUP BY request_id, product_id
-- );

-- =====================================================
-- PREVENÇÃO: Adicionar constraints
-- =====================================================

-- 7. Adicionar constraint unique para evitar duplicação futura de cotações
-- ALTER TABLE quotations 
--   ADD CONSTRAINT quotations_unique_request_product 
--   UNIQUE (request_id, product_id);

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================

-- 8. Verificar estrutura após limpeza (deve mostrar 0 items)
SELECT 
  q.id as quotation_id,
  q.product_name,
  q.requested_quantity,
  COUNT(qi.id) as total_items,
  q.status
FROM quotations q
LEFT JOIN quotation_items qi ON qi.quotation_id = q.id
GROUP BY q.id, q.product_name, q.requested_quantity, q.status
ORDER BY q.created_at DESC
LIMIT 20;
