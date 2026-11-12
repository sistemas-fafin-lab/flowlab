# 08: Bipagem do protocolo de recebimento de guias (futuro)

**What to build:** nada. A ideia era o cadastro bipar o envio das guias e o faturamento bipar o recebimento, formando o "caderno de protocolo" no Flow como fonte dos marcos do SLA.

**Blocked by:** None

**Status:** wontfix

## Comments

**Grilling de 12/11/2026:** descartada.

- A bipagem com papel não é necessária.
- Um registro digital de envio/recebido no Flow duplicaria as tarefas 34 (envio) e 37/44 (recebido no faturamento) que o apLIS já tem.
- A lacuna (só 72% das requisições faturadas com tarefa de recebido) é esquecimento de lançar, não falta de ferramenta. Ela será tratada pela issue 13 (lista de requisições faturadas sem tarefa, para cobrar o lançamento no apLIS).
- Os marcos do SLA continuam vindo só do apLIS.
