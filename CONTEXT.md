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
