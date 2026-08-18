Status: done
Type: task

# Culturas: restringir cadastro a 3 tipos (SWAB)

Ver contexto completo em `../spec.md` seção 2.

## Objetivo

O cadastro de nova cultura deve aceitar apenas 3 tipos do catálogo, e não mais
texto livre.

## Arquivos envolvidos

- `supabase/migrations/20260709130000_fase7a_exames.sql` — seed de
  `ac_exames`, coluna `is_cultura`.
- `src/modules/analises-clinicas/components/CulturasPage.tsx` — modal
  `NovaCulturaModal` (linhas ~255–498), botão "Nova cultura" (~601–609). Busca
  hoje em `ac_exames` com `ativo = true AND is_cultura = true`, e permite
  digitar um tipo livre ("Usar "{busca}"") quando nada bate na busca.
- `src/modules/analises-clinicas/hooks/useCulturas.ts` — `createCultura`
  (~linha 102–103), validação atual é só "não vazio".
- `src/modules/analises-clinicas/components/PainelColetasPage.tsx` (~linha
  825+) — modal de recebimento de coleta, também lista exames com
  `is_cultura = true`; a RPC `registrar_coleta` cria automaticamente uma linha
  em `ac_culturas` para cada exame selecionado com essa flag. **Não precisa
  mudar nada aqui** — como o filtro já é `is_cultura = true`, ele
  automaticamente passa a oferecer só os exames corretos assim que a migration
  abaixo for aplicada.

## O que fazer

### 1. Nova migration

Criar `supabase/migrations/<timestamp>_ac_culturas_restringir_swab.sql` com:

```sql
UPDATE ac_exames
SET is_cultura = false
WHERE nome IN (
  'COPROCULTURA',
  'COPROCULTURA-FEZES',
  'CULTURA BACTERIANA (EM DIVERSOS MATERIAIS BIOLÓGICOS)',
  'CULTURA, URINA COM CONTAGEM DE COLÔNIAS',
  'UROCULTURA COM ANTIBIOGRAMA'
);
```

Não mexer em `ativo` — esses exames continuam solicitáveis fora do fluxo de
Culturas. Não mexer nos 3 exames que devem permanecer `is_cultura = true`
(`CULTURA SELETIVA PARA STREPTOCOCCUS GRUPO B`, `CULTURA PARA FUNGOS +
ANTIFUNGIGRAMA`, `CULTURA + ANTIBIOGRAMA`) — já estão corretos, não precisam de
UPDATE.

Confirmar antes de aplicar que os nomes acima batem exatamente (acentuação e
pontuação) com o que está no seed em
`20260709130000_fase7a_exames.sql` — copiar literal de lá, não retranscrever.

### 2. `CulturasPage.tsx` — `NovaCulturaModal`

- Remover o ramo de "tipo livre" (opção "Usar "{busca}"" / criar com
  `exame_id = null`). O modal passa a permitir **apenas** selecionar um item
  da lista vinda do catálogo (`ativo = true AND is_cultura = true`), que após
  a migration terá só 3 resultados.
- Como só restam 3 opções, considerar simplificar a UI de "busca com
  autocomplete" para algo mais direto (ex: lista/radio fixa) — mas isso é
  detalhe de implementação, não é obrigatório mudar o componente de busca em
  si, contanto que o texto livre não seja mais uma opção possível.

### 3. `useCulturas.ts` — `createCultura`

- Ajustar a validação: hoje só checa `nome` não vazio. Deve passar a exigir
  `exame_id` preenchido (não nulo) — já que não existe mais fluxo de tipo
  livre pela UI. Mantém `exame_nome` como snapshot do nome do exame
  selecionado, como já funciona hoje.

## Fora de escopo

- Não desativar (`ativo = false`) nenhum exame do catálogo geral.
- Não alterar `ac_culturas` já existentes (histórico intocado).
- Não mudar `PainelColetasPage.tsx` nem a RPC `registrar_coleta` — o filtro
  `is_cultura = true` já propaga a restrição automaticamente.

## Critério de aceite

- Formulário de nova cultura avulsa oferece exatamente 3 opções: Streptococcus
  Grupo B, Fungos + Antifungigrama, Cultura + Antibiograma (genérica).
- Não é mais possível cadastrar uma cultura com tipo digitado livremente.
- Recebimento de coleta (`PainelColetasPage`) também só oferece esses 3 tipos
  como "cultura" (outros exames continuam selecionáveis normalmente, só não
  geram mais linha em `ac_culturas`).
- Culturas de urina/fezes já existentes continuam visíveis no histórico/quadro
  de culturas sem erro.
