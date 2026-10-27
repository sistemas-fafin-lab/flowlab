# Pendências: status da requisição, laudo liberado e tarefas

Aba Faturamento → Contas a Receber → Pendências. Decisões do grilling de 27/10/2026.

## Onde

As três sub-abas. Em "Sem NF (lotes)", só na sub-tabela de requisições que abre ao expandir o lote; em "Particulares" e "Sem lote", na tabela principal.

## Colunas

Antes de "Valor", nesta ordem: `… | Status da requisição | Laudo liberado | Valor | ícone de tarefas`.

- **Status da requisição:** `requisicao.CodEvento` → `evento.DesEvento`. Chip verde para laudo concluído (11 "Laudo Concluído (Definitivo)" e 56 "Concluído - Laudo em Fotos"), vermelho para cancelado (8), cinza para o resto. Em Particulares, a coluna "Evento" que já existia virou esta.
- **Laudo liberado:** `requisicao.DtaFinalizacao`, só o dia; "—" sem liberação. Conferido no banco: só vem preenchida nos eventos 11 e 56. A `Dta1aLiberacao` (primeira liberação) cai em outro dia em ~2% dos casos, por laudo complementar; a escolha foi a liberação final.
- **Ícone de tarefas:** em toda linha, com contador das tarefas abertas (`tarefa.Concluido` diferente de 1, a mesma regra do modal) e esmaecido sem nenhuma. O contador vem na própria consulta da lista.

## Modal de tarefas

- Todas as tarefas do apLIS da requisição (`tarefa.IdRequisicao`), de qualquer setor, abertas e concluídas, da mais recente para a mais antiga.
- Cada uma mostra tipo, "Para" (setor ou, sem setor, o usuário destinatário: `CodSetor` vem nulo em ~99,8% das linhas), data, mensagem, remetente, situação (com data de conclusão) e observação de conclusão.
- A mensagem do apLIS às vezes traz HTML (link "Clique aqui"): o modal mostra texto puro.
- Só leitura, carregado ao abrir. Backup MySQL (D-1), com aviso no modal.

## Fora do escopo

Filtro ou ordenação pelas colunas novas; criar ou concluir tarefa pelo FlowLab.
