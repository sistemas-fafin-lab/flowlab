# Cadastro de fornecedor direto no fluxo de cotação

Status: done

## Onde

- `src/modules/quotations/components/CreateQuotationModal.tsx` (etapa
  "suppliers", linhas ~694-787)
- `src/modules/quotations/components/AddProposalModal.tsx` (busca de
  fornecedor, linhas ~239-367)
- `src/components/SupplierManagement.tsx` (formulário de referência, linhas
  ~20-113 em diante)
- `src/hooks/useInventory.ts` (`addSupplier`)

## O que fazer

Hoje, tanto na etapa de Fornecedores do `CreateQuotationModal` quanto no
picker de fornecedor do `AddProposalModal`, só é possível escolher entre
fornecedores já cadastrados. Adicionar um botão "Novo fornecedor" nos dois
lugares que abre um modal de cadastro.

O modal deve usar o **formulário completo** já existente em
`SupplierManagement.tsx` (nome, CNPJ, email, telefone, endereço, contato,
produtos, status) — extrair esse formulário para um componente
compartilhado (ex.: `SupplierFormModal.tsx`) reaproveitado nos dois lugares
(`SupplierManagement.tsx` continua usando a mesma lógica, sem duplicar
código).

Reaproveitar `useInventory().addSupplier` — não criar tabela nem hook novo.

## Critérios de aceite

- Botão "Novo fornecedor" visível na etapa de Fornecedores do
  `CreateQuotationModal` e na busca de fornecedor do `AddProposalModal`.
- Ao salvar, o fornecedor aparece imediatamente na lista/dropdown do fluxo
  atual, já pré-selecionado.
- `SupplierManagement.tsx` (tela de gestão de fornecedores) continua
  funcionando sem regressão após a extração do formulário compartilhado.

## Comments

Implementado: formulário extraído para `src/components/SupplierFormModal.tsx`
(reaproveita `useInventory().addSupplier`/`updateSupplier`, agora retornando o
fornecedor criado). Botão "Novo fornecedor" adicionado na etapa Fornecedores
do `CreateQuotationModal` e ao lado do label Fornecedor no `AddProposalModal`;
em ambos o fornecedor criado é mesclado localmente (`mergeSuppliers`) e
pré-selecionado só depois que `useQuotation().refreshSuppliers()` (novo,
exposto pelo hook) resolve — evita uma condição de corrida em que um submit
rápido logo após criar o fornecedor não o encontrava na lista ainda não
atualizada. `SupplierFormModal` é montado condicionalmente (só quando aberto)
para não disparar um segundo `useInventory()` completo à toa.
`SupplierManagement.tsx` foi migrado para o mesmo componente compartilhado,
sem alterar seu comportamento de listagem/edição/exclusão.
