# 02 — Importar custos de Fontes Pagadoras

**What to build:** dentro de Controle de Custos > Fontes Pagadoras
(`PayorsScreen.tsx`), um botão "Importar" que abre um modal para adicionar
ou atualizar em massa os custos de exames de uma fonte pagadora, clonando
o padrão visual/fluxo já existente em `ExamImportModal.tsx` (upload →
validação → preview de válidos/inválidos → "Baixar modelo" → confirmar).

- Formatos aceitos: `.xlsx`, `.xls` e `.csv`.
- Antes do upload, o usuário escolhe no próprio modal a **Fonte
  Pagadora** e a **Tabela Associada** de destino — essas duas informações
  não vêm do arquivo, valem para todas as linhas do upload.
- Colunas do arquivo: `TUSS | Nome do Exame | Valor | Atendido` (Sim/Não).
  `Nome do Exame` é informativo (não é usado para casar a linha — o
  casamento é sempre por `TUSS`).
- Validação: linha cujo `TUSS` não existe em `custo_exames` é marcada como
  inválida no preview e não é gravada (mesmo padrão de preview
  válidos/inválidos do `ExamImportModal`).
- Duplicado (mesma Fonte Pagadora + TUSS já cadastrados em
  `custo_fontes_pagadoras`): upsert — atualiza `valor` e `atendido` da
  linha existente em vez de criar uma nova.
- TUSS novo (mesma fonte, TUSS ainda não cadastrado para ela): cria a
  linha.
- Botão "Baixar modelo" gera um arquivo de exemplo com as 4 colunas
  esperadas.
- Acesso: `canManageBilling` — mesma permissão de escrita já usada pelas
  RLS policies (`custo_fontes_pagadoras_write_billing`).

**Blocked by:** Nenhum — pode começar imediatamente.

**Status:** ready-for-agent

- [ ] Botão "Importar" visível na aba Fontes Pagadoras, para usuários com
      `canManageBilling`
- [ ] Modal exige a seleção de Fonte Pagadora (e opcionalmente Tabela
      Associada) antes de permitir o upload
- [ ] Aceita `.xlsx`, `.xls` e `.csv` com as colunas `TUSS | Nome do Exame
      | Valor | Atendido`
- [ ] Preview mostra separadamente linhas válidas e inválidas antes de
      confirmar a importação
- [ ] Linha com `TUSS` que não existe em `custo_exames` aparece como
      inválida e não é gravada
- [ ] Linha com `TUSS` já existente para aquela fonte pagadora atualiza
      (upsert) `valor` e `atendido` em vez de duplicar
- [ ] Linha com `TUSS` novo para aquela fonte pagadora cria um novo
      registro em `custo_fontes_pagadoras`
- [ ] Botão "Baixar modelo" disponível no modal
- [ ] Usuário sem `canManageBilling` não vê/não consegue acionar o botão
