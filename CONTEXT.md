# flowlab

Sistema interno do laboratório: estoque, solicitações e cotações, faturamento, análises clínicas, qualidade, RH, TI e atendimento, atrás de um login e de permissões por cargo.

## Language

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
