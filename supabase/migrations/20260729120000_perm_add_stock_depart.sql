/*
  # Permissão `canAddStockDepart` — entrada direta no Estoque Departamental

  Existem itens que chegam direto no setor/posto sem passar pelo estoque central
  (compra direta do setor, doação, brinde de fornecedor, item nunca cadastrado).
  Até aqui o estoque departamental só era abastecido por transferência empurrada
  pelo central ou por retirada de solicitação, então esses itens ficavam fora do
  saldo — e fora dos alertas de mínimo e validade.

  A key é registrada no app em `src/utils/permissions.ts` (ALL_PERMISSION_KEYS,
  grupo "Estoque Departamental") e controla o botão "Entrada direta" em
  `src/components/EstoqueDepartamental.tsx`. É deliberadamente independente de
  `canConsumeStockDepart` e `canManageStockPostos`: dá para liberar o registro de
  entrada sem liberar baixa de consumo nem a gestão do estoque dos postos.

  Backfill apenas do cargo de sistema "Administrador". Os demais cargos ficam a
  cargo do admin marcar em Usuários → Cargos, que é o ponto do recorte por cargo.

  Observação: como as demais permissões do módulo, o gate é de aplicação. As
  policies de `product_stock` / `stock_movements` (20260701120000) seguem
  permissivas (`USING (true)` para authenticated) — endurecer o RLS do módulo é
  um trabalho à parte.

  Idempotente: o merge com dedup faz reaplicar não duplicar a permissão.
*/

UPDATE custom_roles
SET permissions = (
  SELECT jsonb_agg(DISTINCT value)
  FROM jsonb_array_elements_text(
    permissions || '["canAddStockDepart"]'::jsonb
  ) AS value
)
WHERE name IN ('Administrador');
