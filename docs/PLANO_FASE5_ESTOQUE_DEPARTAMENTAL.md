# Fase 5 — Estoque Departamental (multi-local)

> **Status:** 🚧 em implementação — Parte A (aditiva **aplicada**; cutover pronto p/ ir com a Parte B) + Parte B (recebimento, baixa com local, retirada transfer/out, tela Consumo do Setor, dropdowns, **saldo por local no produto** ✅ e **aviso de destino não-rastreável** ✅). `controla_consumo` decidido: **Biologia Molecular** (migration `20260701140000_..._biomol.sql`); comparação de `department` na retirada normalizada código↔rótulo (`processRetirada`). Descartado: UI de transferência avulsa (não há transferência fora de solicitação). Testes de trigger (§10.4) **✅ executados no ambiente test (cutover+biomol aplicados): 9/9 cenários passaram, sem resíduo**. **Falta:** deploy em produção (cutover + biomol + frontend da Parte B, juntos).
> **Plano mestre:** `docs/PLANO_FLOWLAB_ANALISES_CLINICAS.md` (Fase 5)
> **Depende de:** Fase 4 ✅ (permissões). **Habilita:** Fase 6 (coleta dá baixa em estoque).

## 1. Objetivo

Hoje o FlowLab tem **um único saldo global por produto** (`products.quantity`), decrementado por movimentações `type = 'out'`. O campo `products.location` é **texto livre** e, nos dados reais, guarda o **nome do estoque/área** ("Estoque", "Depósito", "Copa", "Biologia Molecular"…) — ou seja, já existe um sistema de locais, só que **não-estruturado**.

A Fase 5 estrutura isso: cada produto passa a ter **saldo por local**, de forma que cada setor/clínica enxergue e movimente o estoque da sua área, sem perder a visão do total — e sem forçar rastreio formal onde ele não faz sentido (ex: Copa).

Além do "onde está o estoque", a Fase 5 resolve um segundo problema levantado: hoje **dar baixa mistura "saiu do estoque" com "foi consumido"**. Quando uma solicitação é retirada (`RequestManagement.tsx:2137/2222`), o item vira `out` na hora — some do controle, sem que ninguém saiba se o setor **usou de fato** ou apenas **recebeu e ainda tem em mãos**. Para os departamentos que **optarem por isso** (`controla_consumo`, §2.7), a Fase 5 introduz um modelo de **3 estados** — _estoque central → em posse do setor → consumido_ — separando "entregue ao setor" de "usado". Os demais departamentos **continuam como hoje** (retirada = baixa direta), sem rastreio de consumo.

## 2. Decisões travadas (com o usuário)

1. **Modelo plano, sem árvore.** Poucos departamentos/clínicas ⇒ nada de `parent_id`/recursão/`WITH RECURSIVE`. Uma lista simples de locais + uma tag `department`.
2. **`product_stock` é a fonte da verdade dos saldos** dos locais **rastreáveis** (todos, incluindo o principal).
3. **`products.quantity` vira cache do TOTAL** (`= SUM(product_stock.quantity)`), mantido por trigger. Nenhuma tela existente quebra; o número passa a significar "total nos locais rastreáveis".
4. **`products.location` é promovido para `stock_locations`.** A coluna permanece (é `NOT NULL` e usada no app), mas o formulário passa a ser um **dropdown de `stock_locations`**; a verdade dos saldos é `product_stock`.
5. **Migration defensiva.** O banco de produção **divergiu** das migrations versionadas (`category` é `text` **sem CHECK** — daí existir `'insumo técnico'`; `supplier`/`batch` viraram `NULL`-áveis). Toda a migration usa `IF EXISTS` / `IF NOT EXISTS` / `DROP … IF EXISTS` e não assume os CHECKs dos arquivos como verdade.
6. **Locais "não-rastreáveis" (ex: Copa).** Alguns setores não fazem baixa formal do que consomem. Para eles: `stock_locations.rastreavel = false`, e esses locais **nunca** ganham uma linha em `product_stock` — nem inicial, nem editável. Uma transferência para lá **debita a origem normalmente, mas não credita nada no destino**; fica só registrada em `stock_movements` como histórico ("isso foi enviado pra lá"). Ver §4.1.
7. **Consumo em duas etapas é opt-in por departamento (`controla_consumo`).** Só os departamentos que o usuário indicar passam a tratar a **retirada de solicitação como transferência** para o local do setor (o item fica "em posse do setor", não some) e exigem uma **baixa de consumo** posterior, feita pelo próprio setor, para sair do total. Todos os outros mantêm o comportamento atual (retirada = `out` direto). `controla_consumo` é uma flag do local (`stock_locations`), `DEFAULT false`, e implica `rastreavel = true`. Ver §4.2 e §7. **Pendente:** confirmar **quais departamentos** entram nesse regime antes de aplicar o seed (§5).

## 3. Modelo de dados

### 3.1 `stock_locations` — lista plana de locais
```sql
CREATE TABLE IF NOT EXISTS stock_locations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         text NOT NULL,
  department   text,                                 -- rótulo de setor p/ escopo/visibilidade
  posto_id     uuid REFERENCES ac_postos(id),        -- preenchido só quando o local é uma clínica de AC
  is_principal boolean NOT NULL DEFAULT false,       -- exatamente 1 = destino/origem default
  rastreavel   boolean NOT NULL DEFAULT true,        -- false = nunca mantém saldo em product_stock (§4.1)
  controla_consumo boolean NOT NULL DEFAULT false,   -- true = consumo em 2 etapas: recebe por transferência, baixa por consumo próprio (§4.2). Exige rastreavel=true.
  ativo        boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_stock_locations_consumo_rastreavel CHECK (NOT controla_consumo OR rastreavel),
  CONSTRAINT uq_stock_locations_nome UNIQUE (nome)
);
-- garante no máximo um local principal
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_locations_principal
  ON stock_locations (is_principal) WHERE is_principal;
```
- `department` liga o local ao setor (usa o vocabulário de `DEPARTMENTS` em `src/utils/permissions.ts`) — é o eixo de visibilidade, **sem recursão** (filtro de uma coluna).
- `posto_id` só é usado quando o local é uma clínica de AC (elo para nome/endereço em `ac_postos`, sem duplicar dado). Ver discussão em `PLANO_FLOWLAB_ANALISES_CLINICAS.md`.
- `rastreavel` decide se o local participa de `product_stock`/do total. Um local principal é sempre `rastreavel = true` (senão não haveria de onde debitar transferências).
- `controla_consumo` marca um **setor de consumo rastreado**: a retirada de uma solicitação desse `department` vira **transferência** para cá (§4.2), e o consumo real é uma baixa (`out`) posterior a partir daqui. Só faz sentido com `rastreavel = true` (precisa de saldo para o "recebido, não usado") — garantido pelo `CHECK ck_stock_locations_consumo_rastreavel`.

> **`rastreavel` × `controla_consumo` são eixos independentes — não confundir.** `rastreavel` responde *"o local tem saldo contável?"* (existe linha em `product_stock`); `controla_consumo` responde *"o local separa **recebeu** de **usou**?"* (a retirada é transferência + baixa em 2 passos, ou baixa direta). Combinações válidas:
> | Local | `rastreavel` | `controla_consumo` | Significado |
> |---|---|---|---|
> | Estoque / Depósito | ✅ | ❌ | Tem saldo, mas quando sai, saiu (sem etapa de consumo) |
> | Biologia Molecular (opt-in) | ✅ | ✅ | Tem saldo **e** separa recebido/usado (o controle de consumo por setor) |
> | Copa | ❌ | ❌ | Não guarda saldo nem controla nada; só histórico do que foi enviado |
> A 4ª combinação (`rastreavel=false` + `controla_consumo=true`) é **proibida** pelo `CHECK`: não dá pra separar "recebido" de "usado" sem antes guardar o saldo do recebido.

### 3.2 `product_stock` — saldo por local rastreável (fonte da verdade)
```sql
CREATE TABLE IF NOT EXISTS product_stock (
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES stock_locations(id) ON DELETE RESTRICT,
  quantity    integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, location_id)
);
CREATE INDEX IF NOT EXISTS idx_product_stock_location ON product_stock(location_id);
```
- `CHECK (quantity >= 0)` = nenhum local fica negativo (dá **atomicidade de graça**: um débito insuficiente faz o `UPDATE` falhar e **reverte a transação inteira**).
- Só existe linha aqui para locais com `rastreavel = true`. Locais não-rastreáveis nunca aparecem nesta tabela (§4.1).

### 3.3 `stock_movements` — ganha origem/destino
```sql
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS from_location_id uuid REFERENCES stock_locations(id),
  ADD COLUMN IF NOT EXISTS to_location_id   uuid REFERENCES stock_locations(id);

-- relaxar o CHECK de type (hoje só 'out') para incluir entrada e transferência
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_type_check;
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_type_check CHECK (type IN ('out','in','transfer'));
```
- `stock_movements` sempre grava, **mesmo quando o destino é não-rastreável** — é o log universal de auditoria ("o que aconteceu"), independente de `product_stock` manter saldo ou não.

### 3.4 `products.quantity` — cache do total
Passa a ser **derivado**. Um trigger em `product_stock` recalcula `products.quantity = SUM(product_stock.quantity)` do produto afetado a cada mudança de saldo (INSERT/UPDATE/DELETE). Como locais não-rastreáveis nunca têm linha em `product_stock`, eles nunca entram nessa soma — é o mecanismo que faz "sair do total" acontecer sem lógica especial.

## 4. Semântica de movimentação

| Operação | `type` | `from` | `to` | Efeito no total |
|---|---|---|---|---|
| **Recebimento** (entrada de NF) | `in` | `null` | local rastreável (default = principal) | +qtd |
| **Transferência entre locais rastreáveis** | `transfer` | X | Y | conserva |
| **Transferência para local não-rastreável** | `transfer` | X | Y (`rastreavel=false`) | **diminui** (debita X, não credita nada) — ver §4.1 |
| **Consumo / saída** (baixa) | `out` | X (default = local do produto) | `null` | −qtd |

**Onde os deltas são aplicados (o ponto delicado — ver §6):** um trigger `AFTER INSERT` em `stock_movements` interpreta `from`/`to` e aplica os deltas em `product_stock` (upsert no destino, débito na origem). Isso **reaproveita o padrão atual** (o app insere uma linha de movimentação; o trigger ajusta saldo) — `addMovement` muda pouco. Não é preciso RPC própria: a `CHECK (quantity >= 0)` + rollback dão a atomicidade.

### 4.1 Locais não-rastreáveis (ex: Copa)

Exemplo concreto — "Papel Toalha", 20 unidades no Estoque, transferindo 5 para a Copa (`rastreavel = false`):

| Passo | `stock_movements` | `product_stock` | Total (`products.quantity`) |
|---|---|---|---|
| Estado inicial | — | Estoque: 20 | **20** |
| Transfere 5 Estoque → Copa | ✅ `type:'transfer'`, `from:Estoque`, `to:Copa`, `qty:5` (fica gravado para sempre) | Estoque: 15 (debitado) · **Copa: nenhuma linha criada** | **15** |
| Uso na Copa, depois disso | — (ninguém registra nada) | — (não existe número, não é editável) | 15 (sem mudança) |

Regras:
- **Nunca existe saldo mostrável para um local não-rastreável.** Não há edição manual/opcional — a linha simplesmente nunca é criada.
- **"Quanto tem na Copa?" não é uma pergunta que o sistema responde com um número** — só dá pra reconstruir via histórico (`stock_movements` onde `to_location_id = Copa`).
- Como nunca há saldo lá, um local não-rastreável **nunca aparece** no seletor "de qual local dar baixa" nos 3 pontos do §7 — não precisa de filtro especial na UI, é consequência de não ter `product_stock`.

### 4.2 Consumo por setor (departamentos com `controla_consumo = true`)

Para os departamentos opt-in (§2.7), a retirada de uma solicitação **não some com o item** — ela o **move** para o local do setor, onde fica visível como "recebido, ainda não usado". O consumo de fato é uma **segunda** movimentação (`out`), feita depois pelo próprio setor.

Exemplo concreto — solicitação do setor "Biologia Molecular" (`controla_consumo = true`) retira 2 "Papel", saindo do Estoque:

| Passo | `stock_movements` | `product_stock` | Total (`products.quantity`) |
|---|---|---|---|
| Estado inicial | — | Estoque: 5 | **5** |
| Retirada da solicitação (transfere 2) | ✅ `type:'transfer'`, `from:Estoque`, `to:Biologia`, `qty:2`, `request_id` | Estoque: 3 · **Biologia: 2** | **5** (conserva — o item ainda existe, só mudou de local) |
| Setor confirma consumo de 1 | ✅ `type:'out'`, `from:Biologia`, `qty:1` | Estoque: 3 · Biologia: 1 | **4** |
| Sobra 1 "recebido e não usado" | — | Biologia: 1 | 4 |

Regras:
- **"Recebido, não usado" = saldo do setor em `product_stock`** (Biologia: 1 no exemplo). **"Usado" = histórico de `out` a partir do local do setor.** É a resposta direta para "o que foi usado e o que não foi", por setor.
- **Nenhuma tabela nova:** reaproveita `transfer` (entrega ao setor) + `out` (consumo), já cobertos pelo trigger do §6 — nenhuma lógica de trigger extra é necessária.
- **Departamentos sem `controla_consumo`:** a retirada continua sendo `out` direto (comportamento atual), sem etapa de consumo. Nada muda para eles.
- Quem decide `transfer` vs `out` na retirada é o **app**, a partir do `department` da solicitação (§7) — o trigger só aplica o delta da movimentação que recebe.

## 5. Seed / promoção do `products.location`

Vocabulário real (query em produção, 296 produtos) → **5 locais canônicos**:

| `location` bruto | qtd | → canônico | `department` | principal? | rastreável? |
|---|---|---|---|---|---|
| `Estoque` | 170 | **Estoque** | Estoque | ✅ `is_principal` | ✅ |
| `Depósito` | 113 | **Depósito** | Estoque | | ✅ |
| `Copa` | 9 | **Copa** | Copa/Limpeza | | ❌ `rastreavel=false` |
| `2°Andar- Biologia molecular` + `…Molecular` | 1+1 | **Biologia Molecular** (merge de casing) | Biologia Molecular | | ✅ |
| `Faturamento/Financeiro` | 1 | **Faturamento/Financeiro** | Faturamento | | ✅ |
| `Estoque/Copa` | 1 | **Estoque** *(composto → principal)* | Estoque | | ✅ |

Passos do seed (idempotente):
1. `INSERT` das 5 `stock_locations` canônicas (com `department`, `is_principal`, `rastreavel`). `ON CONFLICT (nome) DO NOTHING`.
2. Para cada produto: `INSERT INTO product_stock (product_id, location_id, quantity)` no local canônico correspondente ao `TRIM`/normalização do seu `location`, com `quantity = products.quantity` atual. Fallback: `location` não mapeado ⇒ local **principal (Estoque)**.
3. Como hoje cada produto tem **um** local, o invariante fecha no dia 1 para os locais rastreáveis: `SUM(product_stock) == products.quantity` anterior. Só diverge quando começar a distribuir (transferências).

> **⚠️ Decisão explícita sobre os 9 produtos hoje em "Copa":** como Copa vira não-rastreável (§4.1), eles **não podem** ganhar uma linha em `product_stock` lá. Para não zerar o total desses 9 produtos no dia da migration, o seed lança a quantidade atual deles no **local principal (Estoque)** em vez de Copa — o texto legado em `products.location` continua dizendo "Copa" até alguém editar o produto e escolher o local certo no novo dropdown. **Se preferir outro tratamento (ex: aceitar que esses 9 saiam do total já na migration), avise antes de aplicar.**

> As clínicas de AC (CLAFE ASA SUL etc.) **não** vêm de `products.location` (não há insumo distribuído ainda) — serão criadas a partir de `ac_postos` (com `department='Análises Clínicas'` + `posto_id`) sob demanda, na Fase 6.

> **`controla_consumo` nasce `false` para todos os 5 locais do seed.** Nenhum departamento entra no regime de consumo em 2 etapas (§4.2) automaticamente — isso é ligado sob demanda, por `UPDATE stock_locations SET controla_consumo = true WHERE department = …`, **só para os departamentos que o usuário indicar**. **✅ Decidido:** apenas **Biologia Molecular** (migration `20260701140000_fase5_controla_consumo_biomol.sql`). Requer o cutover aplicado + a normalização código↔rótulo do `department` no `processRetirada` para disparar.

## 6. O ponto de risco: reescrever `update_stock_on_movement`

O trigger atual (`20250610200221:248`) faz cegamente `UPDATE products SET quantity = quantity - NEW.quantity`. Precisa ser **substituído** para operar em `product_stock`, sem quebrar as movimentações existentes:

- **Novo trigger em `stock_movements` (`AFTER INSERT`)** aplica deltas em `product_stock`:
  - `from_location_id` não nulo → `UPDATE product_stock SET quantity = quantity - NEW.quantity WHERE …` (a `CHECK >= 0` barra saldo insuficiente).
  - `to_location_id` não nulo → **primeiro checa `stock_locations.rastreavel` do destino**:
    - `true` → `INSERT … ON CONFLICT (product_id, location_id) DO UPDATE SET quantity = quantity + NEW.quantity`.
    - `false` → **não faz nada** em `product_stock` (só a movimentação em si já foi gravada pelo INSERT original — é o comportamento do §4.1).
  - **Legadas** (`type='out'` **sem** `from_location_id`): debitar do **local que hoje detém o saldo do produto** (no caso single-location pós-seed, é inequívoco). Uma vez que a Parte B enviar `from_location_id`, esse caminho legado deixa de ser usado.
- **Trigger em `product_stock`** (`AFTER INSERT/UPDATE/DELETE`) recalcula `products.quantity = SUM(...)` e o `status` (via a lógica de `update_product_status`).
- **Regra anti-duplicidade:** os deltas são aplicados **em um único lugar** (o trigger de `stock_movements`); `products.quantity` nunca é escrito diretamente por movimentação — só pelo trigger de cache.

> Este item exige teste explícito (§10) para garantir que saída, entrada, transferência (rastreável e não-rastreável) mexem no saldo certo e que o total permanece consistente.

### 6.1 Gap encontrado: botão "Adicionar Estoque" bypassa `stock_movements`

`ProductList.tsx:305-325` (`handleAddStock`/`handleConfirmAddStock`) já é, hoje, o fluxo de restock de um produto existente — mas ele calcula `newQuantity = selectedProduct.quantity + quantity` e chama `updateProduct(id, { quantity: newQuantity })`, **sobrescrevendo `products.quantity` diretamente**, sem passar por `stock_movements` e sem perguntar local (não fica trilha de auditoria da entrada, só a saída aparece no histórico).

Isso é inofensivo hoje (saldo único), mas **quebra o invariante do cache** depois da Fase 5 (§3.4): se algo escrever `products.quantity` fora do trigger de `product_stock`, o cache diverge do `SUM(product_stock)` real na primeira sobrescrita. Precisa ser corrigido **na mesma Fase 5** (não pode ficar pendente para depois), junto com o rework do §7.

## 7. Frontend (Parte B — UI mínima de escrita)

- **`src/types/index.ts`:** `StockMovement.type` → `'out' | 'in' | 'transfer'`; novos campos `fromLocationId?`, `toLocationId?`. Novo tipo `StockLocation` (com `rastreavel`) e `ProductStock`.
- **`src/hooks/useInventory.ts`:**
  - `addMovement` (`:504`) passa a enviar `from_location_id`/`to_location_id`.
  - Novos: `fetchLocations`, `fetchProductStock(productId)`, `receiveStock` (entrada), `transferStock` (transferência entre locais).
- **Cadastro de produto novo (`AddProduct.tsx:131`):** deixa de escrever `quantity` direto em `products`; passa a criar o produto (quantity derivada) + chamar `receiveStock` com a quantidade inicial no local escolhido (default "Estoque"). Cadastro e restock passam a usar **o mesmo mecanismo** de recebimento.
- **Botão "Adicionar Estoque" (`ProductList.tsx:305-325`, gap do §6.1):** reescrito para não tocar mais em `updateProduct({ quantity })`. Passa a abrir um seletor de local (default "Estoque") e chamar `receiveStock(productId, locationId, quantity)` — `stock_movements` (`type:'in'`) + trigger cuidam do saldo e do cache.
- **Os 3 pontos de "dar baixa" existentes** — `MovementHistory.tsx:161`, `ProductList.tsx:327` (`handleRemoveStock`) e `RequestManagement.tsx:2137/2222` (retirada de solicitação) — hoje só pedem produto + quantidade (fazia sentido com saldo único). Passam a exigir **de qual local rastreável** sai o item (`from_location_id`), listado a partir de `product_stock` do produto (locais não-rastreáveis nunca aparecem aqui, por não terem saldo — §4.1). Origem default = local **principal**.
- **Retirada de solicitação — ramo por departamento (§4.2):** ao finalizar a retirada (`RequestManagement.tsx:2137/2222`), o app resolve o local do setor pelo `department` da solicitação:
  - **Há `stock_locations` com esse `department` e `controla_consumo = true`** → grava `type:'transfer'` (`from` = local de origem/principal, `to` = local do setor) em vez de `out`. O item entra no `product_stock` do setor como "recebido, não usado" e o total **conserva**.
  - **Caso contrário** → mantém `type:'out'` (comportamento atual). Nada muda para esse departamento.
  - O `request_id` é gravado na movimentação nos **dois** ramos (rastreabilidade da origem preservada).
- **Nova tela "Consumo do setor" (só p/ departamentos `controla_consumo`):** lista o `product_stock` do local do setor — o que ele **recebeu e ainda não usou** — e permite registrar consumo, gerando `type:'out'` a partir desse local. É a visão "cada setor vê seus itens e controla o que foi usado / não usado". Versão mínima nesta fase: saldo atual do setor (recebido-não-usado) + histórico de baixas do setor (usado); amarrar cada consumo de volta à linha da solicitação de origem é refinamento posterior.
- **Transferência para local não-rastreável:** ✅ **feito** — na tela Estoque Departamental, um destino não-rastreável aparece no dropdown com o sufixo "(sem rastreamento)" e, ao ser escolhido, exibe um aviso âmbar de que o item sai do total controlado e não poderá ser conferido depois. Não bloqueia (é operação válida, §4.1).
- **Formulário de produto (`ProductList`/modal):** campo `location` vira **dropdown de `stock_locations`** (em vez de texto livre); rotular como "Estoque/Local".
- **Visão de saldo por local:** ✅ **feito** — cada card de produto na lista tem um botão "Saldo por local" que abre um **popover flutuante** com a quebra de `product_stock` (local → qtd, só locais com saldo, principal destacado; fecha ao clicar fora). *Dashboard departamental completo fica para a Fase 8.*

## 8. RLS / visibilidade

- `stock_locations` e `product_stock`: habilitar RLS com policies **consistentes com o padrão atual** (`products`/`stock_movements` usam `USING (true)` para `authenticated`). Fundação permissiva agora.
- **Escopo por setor** (usuário só vê o estoque do seu `department`) usa a coluna `stock_locations.department` num filtro de uma coluna — **refinamento posterior** (quando a visão departamental amadurecer), para não arriscar quebrar telas existentes na fundação.

## 9. Escopo da Fase 5

- **Parte A — Fundação (obrigatória):** §3 (schema, incl. `rastreavel` e `controla_consumo`) + §4/§4.1/§4.2/§6 (movimentação e triggers, incl. local não-rastreável e consumo em 2 etapas) + §5 (seed/promoção, incl. resolução dos 9 produtos de Copa) + §8 (RLS permissiva). Entrega o modelo multi-local com o app existente funcionando.
- **Parte B — UI mínima de escrita:** §7 (dropdown de local, recebimento, transferência com aviso para não-rastreável, seletor de local nos 3 pontos de baixa, saldo por local, **ramo transfer/out na retirada de solicitação** e a **tela mínima "Consumo do setor"** para os departamentos opt-in).

> **Rollout da Parte A em 2 migrations (segurança).** Para não mudar nada antes do frontend estar pronto, a fundação é aplicada em duas etapas:
> 1. **Aditiva** (`20260701120000_fase5_estoque_aditiva.sql`) — cria `stock_locations`/`product_stock` + seed + colunas/CHECKs em `stock_movements` + RLS, **mantendo o trigger antigo**. Aplicável a qualquer momento: **zero mudança de comportamento** (products.quantity segue como fonte da verdade; product_stock nasce como snapshot).
> 2. **Cutover** (`20260701130000_fase5_estoque_cutover.sql`) — reconcilia `product_stock` com o `quantity` atual (cura o drift da janela, guardado p/ não achatar multi-local), liga o trigger de cache e troca o `update_stock_on_movement`. **Deve ir junto com o deploy da Parte B** — aplicá-lo com o frontend antigo quebra o botão "Adicionar Estoque"/cadastro antigo (§6.1) e faz baixa acima do saldo falhar.
- **Fora de escopo (fases seguintes):**
  - Consumo de insumo pela **coleta** → Fase 6 (`ac_coleta_insumos` dá baixa via `stock_movements`).
  - **Dashboard/KPIs** de estoque departamental (visão consolidada, gráficos, giro) → Fase 8. *A visão mínima "meu setor: recebido vs. usado" (§7) entra já na Parte B; o painel completo é que fica para depois.*
  - **RLS por setor** (visibilidade restrita) → refinamento posterior.
  - **Prateleira por local** (`product_stock.localizacao`) → futuro, só se necessário.

## 10. Verificação

1. **Type-check/lint:** `npm run lint` — sem novos erros.
2. **Migration (idempotência):** aplicar e reaplicar; `ON CONFLICT`/`IF NOT EXISTS` não duplicam.
3. **Invariante do cache:** após o seed, para todo produto `products.quantity == SUM(product_stock.quantity)` (considerando que Copa nunca contribui).
4. **Movimentação (o item crítico do §6) — ✅ executado no test (`supabase db query --linked`), 9/9 OK, rollback sem resíduo:**
   - Saída (`out`) reduz o saldo do local certo e o total.
   - Entrada (`in`) aumenta o local destino e o total.
   - Transferência entre locais rastreáveis conserva o total e move entre locais.
   - Transferência para local não-rastreável (Copa) reduz o total, debita a origem, e **não cria nenhuma linha** em `product_stock` para o destino.
   - Débito além do saldo → falha com rollback (nada fica negativo).
   - **Consumo por setor (opt-in, §4.2):** retirada de solicitação de departamento com `controla_consumo` gera `transfer` (item aparece no `product_stock` do setor, total **conserva**); baixa de consumo do setor gera `out` (total diminui); retirada de departamento **sem** `controla_consumo` continua gerando `out` direto (comportamento atual, total diminui na hora).
5. **UI:** dropdown de local aparece no form; recebimento/transferência refletem em `product_stock` e no total; os 3 pontos de baixa exigem local de origem; telas antigas (ProductList, ExpirationMonitor) continuam mostrando `quantity` coerente.

## 11. Riscos & mitigação

- **Reescrita do trigger (§6)** — maior risco; mitigado por testes explícitos (§10.4) e por aplicar deltas num único lugar.
- **Divergência de produção (§2.5)** — mitigado por migration defensiva.
- **`location` composto/sujo (§5)** — mitigado por normalização + fallback para o principal; os 3 casos ambíguos (2 compostos + merge de casing) têm mapeamento explícito e afetam 3 de 296 produtos.
- **Escrita direta em `products.quantity` fora do trigger (§6.1)** — o botão "Adicionar Estoque" (`ProductList.tsx:305-325`) sobrescreve `quantity` hoje; se não for corrigido **junto** com a Fase 5, dessincroniza o cache do total assim que alguém usar esse botão. Mitigado por incluir a reescrita desse fluxo como parte obrigatória da Parte B (§7), não como débito técnico posterior.
- **9 produtos hoje em "Copa" perderiam sua quantidade do total (§5)** — mitigado seedando-os no local principal em vez de Copa; **decisão sinalizada explicitamente para confirmação** antes de aplicar a migration.
- **Dois comportamentos de "retirada de solicitação" (§4.2/§7)** — transferir (opt-in) vs. baixar (demais) no mesmo botão pode confundir ou causar baixa dupla. Mitigado por dirigir a decisão por **uma única flag** (`controla_consumo`, resolvida do `department` da solicitação) e por teste explícito (§10.4) cobrindo os dois ramos; `request_id` é gravado nos dois para manter a rastreabilidade.
- **Quais departamentos entram no consumo em 2 etapas (§2.7/§5)** — precisa ser confirmado antes do seed ligar `controla_consumo`; enquanto indefinido, todos ficam no comportamento atual (`out`) e nada quebra. Não bloqueia a Parte A nem o restante da Parte B; só a configuração dos setores opt-in. (A antiga dúvida "origem da baixa: principal vs. escolhida" fica resolvida: **default = principal**, com o ramo transfer/out decidido pelo `department`.)
