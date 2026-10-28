# Faturamento: histórico de NF cancelada no título

Status: done (4 issues concluídas, 28/Out/2026); falta a conferência manual no app das issues 01 a 03

## Problem Statement

Quando uma NF sai errada (convênio trocado, valor bruto errado, retenção errada,
competência errada, pedido do convênio), o setor cancela a NF no portal da
prefeitura e emite outra. Esse cancelamento acontece **fora do apLIS**: no banco
do apLIS a NF cancelada continua em `fatrps` sem nenhuma marca
(`DataCancelamento` está vazio em todas as NFs de 2026) e só deixa de estar
ligada a um lote, porque o lote passa a apontar para a NF nova.

Por isso o setor mantém, na planilha "CONTROLE DE EMISSÃO DE NOTAS", uma aba
"NF CANCELADAS FORA APLIS" com convênio, número, valor, data de emissão e o
motivo. É a única parte dessa planilha que o flowlab ainda não cobre. As regras
de prazo (aba DADOS) já estão no cadastro da operadora, os lotes sem NF já
aparecem nas Pendências não faturadas e cada mês é só um filtro de emissão na
lista de títulos.

Sem esse registro no sistema, quem procura a NF 7496 no Contas a Receber não
acha nada e não tem como saber que ela foi cancelada, por quê, nem qual NF a
substituiu. E quando a operadora corrige o número da nota de um título, o número
anterior some sem deixar rastro.

## Solution

O título passa a guardar o **histórico das NFs canceladas** que ele já teve.

- Na tela de edição do título, ao **trocar** um número de nota já preenchido, o
  operador informa que a NF anterior foi cancelada e o motivo. O sistema guarda
  a NF anterior (número, data, motivo e quem registrou) e grava o número novo.
  Também dá para registrar uma correção de digitação, sem cancelamento: nesse
  caso o motivo não é pedido e nada entra no histórico de canceladas.
- O painel lateral do título mostra uma seção **"NFs canceladas"** com cada NF
  anterior, o motivo, a data e o responsável.
- A busca da lista de títulos encontra o título também pelo número de uma NF
  cancelada dele, e a linha mostra que aquele número foi substituído.
- As 11 linhas da aba "NF CANCELADAS FORA APLIS" entram uma vez, por uma
  migration. Cada linha é ligada ao título que a substituiu quando o vínculo é
  único; as demais ficam registradas sem título, ligadas só à operadora, e
  aparecem na busca por número.

## User Stories

1. As a operador de faturamento, I want to record that the previous NF of a título was cancelled when I change its number, so that the old number is not lost.
2. As a operador de faturamento, I want to be required to write a motivo when I mark the previous NF as cancelled, so that anyone later knows why it was cancelled.
3. As a operador de faturamento, I want to choose between "NF anterior cancelada" and "correção de digitação" when changing the number, so that a typo fix does not pollute the cancellation history.
4. As a operador de faturamento, I want the first fill of an empty NF number to work as today, without asking anything, so that the common case stays one step.
5. As a operador de faturamento, I want the cancellation date to default to today and be editable, so that I can register a cancellation done days ago.
6. As a operador de faturamento, I want the previous number and the new one recorded atomically, so that a failure never leaves the título with the new number and no history (or the reverse).
7. As a operador de faturamento, I want the system to refuse a new number equal to the current one in "NF anterior cancelada" mode, so that I do not register a cancellation that did not happen.
8. As a operador de faturamento, I want the system to refuse a new number that is already a cancelled NF of the same título, so that I do not reactivate a cancelled NF by mistake.
9. As a operador de faturamento, I want a cancelled título (status cancelada) to keep refusing NF changes, so that the existing rule stays intact.
10. As a usuário com permissão de ver o faturamento, I want to see a "NFs canceladas" section in the título side panel, so that I know the título's NF history without asking anyone.
11. As a usuário com permissão de ver o faturamento, I want each cancelled NF to show number, cancellation date, motivo and who registered it, so that the record is auditable.
12. As a usuário com permissão de ver o faturamento, I want the section hidden when the título never had a cancelled NF, so that the panel stays clean.
13. As a usuário com permissão de ver o faturamento, I want to search the títulos list by a cancelled NF number and find the título that replaced it, so that a number coming from the convênio or from the accountant can be traced.
14. As a usuário com permissão de ver o faturamento, I want the matched row to say the number searched is a cancelled NF and which is the current one, so that I do not confuse the two.
15. As a usuário com permissão de ver o faturamento, I want a cancelled NF without a linked título (imported from the spreadsheet) to also be found by number, showing operadora, valor, date and motivo, so that the old spreadsheet records are not lost.
16. As a usuário sem permissão de gestão do faturamento, I want to see the history but not register cancellations, so that only the setor changes it.
17. As a coordenação do faturamento, I want the history to be append-only, so that nobody erases a cancellation after registering it.
18. As a coordenação do faturamento, I want the 11 cancellations of the spreadsheet imported once, so that we can stop maintaining that tab.
19. As a coordenação do faturamento, I want the import to link each spreadsheet line to a título only when there is a single clear candidate, so that no cancellation is attached to the wrong título.
20. As a coordenação do faturamento, I want an import report listing which lines were linked, which were not and why, so that I can link the rest by hand if needed.
21. As a operador de faturamento, I want "Atualizar do apLIS" to keep never overwriting a filled NF number, so that this feature does not change the automatic flow.

## Implementation Decisions

- **Linguagem.** "NF cancelada" é a NF emitida e depois cancelada no portal da
  prefeitura, fora do apLIS. É diferente de **título cancelado** (status
  `cancelada` do título), que continua como está. Vale registrar o termo no
  glossário `CONTEXT.md`, seção Faturamento.
- **Schema: nova tabela de NFs canceladas**, no mesmo molde das auditorias do
  Contas a Receber (`notas_lote_audit_logs`, `notas_lancamentos_audit_logs`):
  append-only, RLS de leitura para quem vê ou gere o faturamento, sem policy de
  INSERT/UPDATE/DELETE (a escrita é só por RPC `SECURITY DEFINER`). Campos:
  título (opcional, `ON DELETE SET NULL`), operadora (obrigatória), número da
  NF, valor (opcional), data de emissão (opcional), data do cancelamento,
  motivo (obrigatório, não vazio), origem (`edicao` ou `planilha`), quem
  registrou (id e nome) e quando. Índice pelo número da NF (para a busca) e
  pelo título. O número é único por operadora, para que a mesma NF não seja
  cancelada duas vezes.
- **RPC de troca do número.** `fat_atualizar_numero_nota` ganha um modo de
  cancelamento: com uma flag de "NF anterior cancelada", motivo e data, ela, numa
  única transação, valida (título existe, não está cancelado, já tem número, o
  número novo é diferente do atual e não é uma NF cancelada do mesmo título,
  motivo não vazio), grava a NF anterior na tabela nova (valor e emissão vêm do
  título) e troca o número. Sem a flag, o comportamento atual não muda, nem o
  modo `somenteSeVazio` usado pelo "Atualizar do apLIS". Se a assinatura mudar,
  usar DROP + CREATE, como em `20260930180000_fat_atualizar_numero_nota_somente_se_vazio`,
  e aplicar a migration antes do deploy do código.
- **Rota.** A rota existente `titulo-atualizar-numero-nota` aceita os campos
  opcionais do cancelamento (flag, motivo, data) e os repassa à RPC. Os erros de
  validação voltam com a mensagem da RPC, como hoje. Não é criada rota nova
  para a escrita.
- **Leitura.** O detalhe do título (o que alimenta o painel lateral) passa a
  trazer a lista de NFs canceladas dele. A busca da lista de títulos, além do
  número atual, casa com o número de uma NF cancelada e devolve qual NF casou.
  As NFs canceladas sem título entram como resultado próprio da busca.
- **Tela de edição.** Quando o título já tem número e o operador digita outro, o
  formulário mostra a escolha "NF anterior cancelada" ou "Correção de
  digitação". A primeira opção exige o motivo e mostra a data do cancelamento
  (padrão: hoje). Quando o número está vazio, o formulário é o de hoje.
- **Painel lateral.** Uma seção "NFs canceladas" aparece só se houver alguma,
  com a NF mais recente primeiro.
- **Importação da planilha.** É uma migration de dados única, gerada por um
  script em `supabase/scripts/`, no padrão do acerto de 20/10
  (`fat_acerto_titulos_planilha_pelo_aplis`): transação única, conferência no
  fim e relatório em `.scratch/faturamento-nf-cancelada/`. A origem é `planilha`.
  O vínculo com o título só é feito quando há um único candidato da mesma
  operadora, emitido depois da NF cancelada (até 30 dias) e com lote em comum ou
  com o mesmo valor. Sem candidato único, a linha entra sem título. O nome do
  convênio na planilha (ex.: "SIS", "STF MED", "BRADESCO") é resolvido para a
  operadora do flowlab no próprio script, e as linhas ambíguas vão para o
  relatório. O motivo é copiado da planilha como está.
- **Permissões.** A escrita exige `canManageBilling` (via
  `fat_exigir_permissao_gestao`). A leitura exige `canViewBilling` ou
  `canManageBilling`.

## Testing Decisions

- Um bom teste olha só para o comportamento externo: o que a rota responde e o
  que fica gravado, nunca o formato interno das queries.
- **Costura principal: o handler `titulo-atualizar-numero-nota`**, com Supabase
  mockado, seguindo o teste que já existe para esse handler. Cobrir: os campos
  de cancelamento chegam à RPC; a chamada sem os campos novos continua igual
  (inclusive `somenteSeVazio`); um erro de validação da RPC volta como erro
  legível; sem permissão, a resposta é recusada.
- **Regras da RPC:** conferir com um roteiro SQL de verificação junto da
  migration (no padrão das conferências das migrations de acerto): título
  cancelado é recusado, motivo vazio é recusado, número igual ao atual é
  recusado, número já cancelado no título é recusado, histórico e troca
  acontecem juntos.
- **Importação:** a função pura que decide o título candidato de cada linha da
  planilha recebe um teste vitest com casos de candidato único, nenhum candidato
  e mais de um candidato. Antes, conferir se o script do acerto de 20/10 já tem
  algo parecido para reaproveitar.
- **Interface:** sem teste automatizado de componente (o módulo não tem esse
  tipo de teste). A conferência é manual no app: trocar a NF de um título de
  teste, ver a seção no painel e buscar pelo número antigo.

## Out of Scope

- Cancelar a NF de fato no portal da prefeitura ou no apLIS. O flowlab só
  registra o que já foi feito.
- Detectar cancelamentos sozinho pelo apLIS: o apLIS não marca a NF cancelada, e
  "NF sem lote" não serve de sinal, porque cerca de 60% das NFs do mês não têm
  lote (são notas de requisição e particulares).
- Mudar o "Atualizar do apLIS" para trocar números já preenchidos.
- Editar ou apagar um registro de NF cancelada (o histórico é append-only).
- As outras abas da planilha: os meses viram filtro de emissão, a aba DADOS já
  está em `fat_regra_prazo`/operadoras e o checklist de emissão é coberto pelas
  Pendências não faturadas.

## Further Notes

- Conferido no banco do apLIS em 27/10/2026: das 11 NFs da aba, 9 estão em
  `fatrps` (7495, 7496, 7498, 7504, 7724, 7787, 7793, 7914, 7990), todas sem
  `DataCancelamento` e sem nenhum `fatlote.IdRPS` apontando para elas; 7831 e
  7996 não estão no apLIS. Nenhuma delas virou título no flowlab.
- A 7793 tem `StatusProcessamento = 8` com `MotivoStatus` "erro durante a
  tentativa de cancelamento" (código L073). O apLIS chegou a tentar cancelar e
  falhou. Os valores de `StatusProcessamento` não estão mapeados.
- Possível próximo passo, fora desta spec: o "Atualizar do apLIS" listar os
  títulos cujo lote passou a ter, no apLIS, uma NF diferente da do título. Seria
  o sinal automático de uma NF refeita, e o operador confirmaria a troca com o
  motivo usando a mesma RPC desta spec.
