/*
  # Correção do seed de module_categories

  A migração original 20260413120000_module_categories.sql não incluiu
  os módulos adicionados posteriormente:
    • Estoque Departamental
    • Controle de Custos
    • Análises Clínicas
    • Tecnologia (categoria inteira)

  Isso fazia com que, ao carregar categorias do banco, esses itens
  ficassem em "Sem Categoria" no editor e não mantivessem a posição
  esperada no menu.

  Idempotente: reaplicar não muda nada.
*/

-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  1. Atualiza categoria OPERAÇÕES com itens faltantes                         ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

UPDATE module_categories
   SET items = '["Produtos","Movimentações","Estoque Departamental","Solicitações","Fornecedores","Cotações","Faturamento","Controle de Custos","Análises Clínicas"]'::jsonb,
       updated_at = now()
 WHERE id = 'operacoes'
   AND items != '["Produtos","Movimentações","Estoque Departamental","Solicitações","Fornecedores","Cotações","Faturamento","Controle de Custos","Análises Clínicas"]'::jsonb;

-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  2. Adiciona categoria TECNOLOGIA (se ainda não existir)                   ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

INSERT INTO module_categories (id, name, sort_order, items)
VALUES ('tecnologia', 'TECNOLOGIA', 3, '["Tecnologia"]'::jsonb)
ON CONFLICT (id) DO NOTHING;
