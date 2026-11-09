# flowlab

Sistema interno do laboratório: estoque, solicitações e cotações, faturamento, análises clínicas, qualidade, RH, TI e atendimento, atrás de um login e de permissões por cargo.

## Language

### Faturamento

**Pontuação do setor**:
Os pontos do mês de cada Frente do Faturamento, pelas regras de `.scratch/faturamento-pontuacao/spec.md`: critérios automáticos (meta, guias sem lote, zero glosa, tarefas pendentes) somados aos lançados pela coordenação.
_Avoid_: Lab Points, nota individual, pontuação da faturista

**Frente**:
Cada parte do setor de Faturamento que é pontuada à parte: Faturamento e Recurso de Glosa. Cada uma tem sua lista de membros (usuários do apLIS) e seus critérios.
_Avoid_: equipe, time, setor (o setor é o Faturamento inteiro)

**Fechamento da pontuação**:
O ato da coordenação de congelar a Pontuação do setor de um mês; depois dele os números não mudam mais, a não ser que o mês seja reaberto.
_Avoid_: fechamento do lote (é outra coisa: o lote fechado no apLIS)

**NF cancelada**:
A NF emitida para um título e depois cancelada no portal da prefeitura, fora do apLIS, com motivo e data. Fica no histórico do título (`fat_nfs_canceladas`), e o título segue valendo com a NF que a substituiu.
_Avoid_: título cancelado (é o título com status `cancelada`, que deixa de ser cobrado), nota cancelada

**Calendário de envios**:
A tela do Faturamento com os Agendamentos de envio do mês, os painéis Hoje/Amanhã e os atrasados, pelas regras de `.scratch/faturamento-calendario-envios/spec.md`.
_Avoid_: agenda de faturamento, calendário do Google

**Regra de envio**:
A janela em que um convênio aceita o envio dos lotes (ex.: "1 ao 15", "1º ao 5º dia útil", "todos os dias"). Um convênio pode ter mais de uma janela. Não bloqueia nada; só orienta a sugestão e os avisos.
_Avoid_: regra de prazo (é a do recurso de glosa), data de faturamento

**Agendamento de envio**:
Um convênio numa data prevista do Calendário de envios, pendente ou enviado (com a data do envio e quem marcou); atrasado quando a data passou, fora do prazo quando a janela da Regra de envio acabou.
_Avoid_: envio (é o lote enviado no apLIS), tarefa

**Elegíveis**:
O valor (`ValorLiquido` dos procedimentos) das requisições de um mês, pela data de solicitação, de convênios marcados como "considerada na meta" e fora dos status não cobráveis. Base do cálculo da Meta sugerida; vem do apLIS, não do lote faturado.
_Avoid_: faturado (só conta o que já tem lote), admissões (inclui convênios fora da meta), Exame elegível a desconto (é outra coisa, do Atendimento)

**Meta sugerida**:
Cada uma das três candidatas que o modal "Definir meta" calcula a partir dos Elegíveis dos meses anteriores: 90/10 (90% do mês anterior + 10% do retrasado), média de 2 meses e média de 3 meses. Nada é salvo sem ação da coordenação; ao salvar, grava-se a origem (`90_10`, `media_2`, `media_3` ou `manual`).
_Avoid_: meta calculada, meta automática (a meta salva nunca muda sozinha)

**Glosa da DRE**:
A glosa que o financeiro leva para a DRE, por mês de solicitação: soma de (líquido − recebido) das cobranças (`fatrequisicaoprocedimento`) com motivo de glosa preenchido e saldo positivo, de requisições cobráveis. É a conta que ele faz sobre a Análise de Faturamento do apLIS; aparece no bloco "Glosa por mês de solicitação" da aba Comparativos. É um saldo: o valor de um mês cai conforme os recursos são pagos.
_Avoid_: glosa total do funil (é por mês de emissão do título e soma recuperada + acatada + em disputa), glosa da tabela `glosas` (lançamentos importados de planilha)

### Atendimento

**Gerador de Orçamento**:
A ferramenta da área Atendimento em que o atendente busca exames, monta o carrinho e gera o Orçamento do cliente particular.
_Avoid_: Tabela Particular, Pardini, Álvaro (como nome da ferramenta; "Álvaro" segue sendo o laboratório de apoio do Envio ao Álvaro)

**Orçamento**:
O documento entregue ao cliente particular com os exames, as quantidades, os preços, o Valor Total e o Valor com Desconto. Não fica guardado no sistema.
_Avoid_: Cotação (é o processo de compras), orçamento particular

**Exame elegível a desconto**:
Exame marcado, no cadastro de fontes pagadoras, com a marcação de desconto particular (`elegivel_desconto_particular`); só ele recebe e conta para o Desconto automático por volume.
_Avoid_: exame com desconto, exame promocional

**Desconto automático por volume**:
O percentual (10% ou 15%) que o Gerador de Orçamento aplica sozinho sobre os Exames elegíveis a desconto, conforme a quantidade de exames elegíveis distintos ou a soma do valor deles. As faixas não se somam.
_Avoid_: desconto particular, desconto manual
