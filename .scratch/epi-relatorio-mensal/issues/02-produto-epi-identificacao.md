# 02: Produto EPI e Identificação do EPI

**What to build:** no cadastro e na edição de produtos do Estoque, quem tem a permissão "Gerir EPI" marca o produto como **EPI** e, com a marcação ligada, informa a **Identificação do EPI**: tipo (CA ou Registro ANVISA), número e validade, todos opcionais. A lista de produtos mostra um selo "EPI" e um aviso "identificação vencida" quando a validade passou; nada é bloqueado. Spec: `.scratch/epi-relatorio-mensal/spec.md` (histórias 1–10, 48; Esquema → Produto; Permissões).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] Migration defensiva e idempotente adiciona ao produto: marcação de EPI (booleana, padrão desligada), tipo da identificação (CA ou ANVISA), número (texto) e validade (data).
- [x] Nova chave de permissão "Gerir EPI" (`canManageEpi`) na lista de permissões, com rótulo e grupo, atribuível por cargo.
- [x] Cadastro e edição de produto mostram a marcação de EPI; os campos de identificação só aparecem com a marcação ligada.
- [x] Sem a permissão "Gerir EPI", a marcação e a identificação aparecem só para leitura, e o salvamento não altera esses campos.
- [x] Um EPI pode ser salvo sem identificação.
- [x] A lista de produtos mostra o selo "EPI" e o aviso "identificação vencida" (validade anterior a hoje); dá para filtrar os EPIs e ver os que estão sem identificação.
- [x] Produtos existentes continuam iguais (nenhum vira EPI sozinho).

## Comments

- Implementado: `src/utils/epi.ts` (regras + testes), `src/components/FormularioEpi.tsx`, cadastro (`AddProduct`), edição e lista (`ProductList`), `useInventory`, migration `20261119100000_produtos_epi_identificacao.sql` (colunas, `canManageEpi` só no Administrador, trigger `products_guard_epi`). Ao desmarcar EPI, a identificação é apagada no salvamento. "Sem identificação" = EPI sem número. Filtros: EPIs, EPI sem identificação, Identificação vencida.
