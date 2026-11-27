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

**Calendário de recursos**:
A aba de Glosas e Recursos com os lotes de faturamento que ainda têm glosa não recorrida (status 6, com motivo de glosa), cada um no dia do prazo para recorrer (data de recebimento + regra "Glosa – Recurso" do convênio), com os painéis Hoje/Amanhã/Atrasados, pelas regras de `.scratch/glosas-recursos-calendario-pendencias/spec.md`. O item sai sozinho quando entra num lote de recurso enviado.
_Avoid_: Calendário de envios (é o do envio dos lotes de faturamento), agenda de recurso

**Pendências de glosa**:
O bloco do Dashboard de glosa com o que está vencido: glosa sem recurso com prazo para recorrer vencido, recurso com retorno atrasado (envio + Análise) e recurso com pagamento atrasado (envio + Análise + Pagamento).
_Avoid_: Pendências de faturamento (requisições não faturadas, NF), atraso do lote (é só o selo do lote de recurso)

**Instância do recurso**:
A rodada de recurso de uma requisição: 1º, 2º ou 3º. Vem do apLIS (evento 7 → 1º, 16 → 2º; não existe evento de 3º recurso), guarda a maior já vista e pode ser marcada à mão pelo lápis, que prevalece.
_Avoid_: lote de recurso (uma requisição em 2º recurso costuma ficar no mesmo lote ou sem lote), tentativa

### Estoque e Qualidade

**EPI**:
Produto do estoque marcado como Equipamento de Proteção Individual (`products.is_epi`), cadastrado pelo Compras. Só ele entra no Relatório mensal de EPI.
_Avoid_: material de proteção, EPC (proteção coletiva é outra coisa)

**Identificação do EPI**:
O tipo (CA, que é o Certificado de Aprovação do Ministério do Trabalho, ou Registro ANVISA), o número e a validade de um EPI. O cadastro do produto guarda a identificação de referência. Na retirada de uma solicitação de materiais, o estoquista confere essa identificação ou a informa, e ela é gravada no item da entrega; o relatório usa essa cópia, não o cadastro atual.
_Avoid_: código ECA, código do produto (`products.code` é o código interno)

**Relatório mensal de EPI**:
O PDF de uma área num mês, com uma linha por item de EPI de solicitação de materiais entregue (data da solicitação, produto, Identificação do EPI, quantidade e solicitante) ; no fim, um espaço de assinatura para cada colaborador e, só na última página, a do responsável da área. É impresso, assinado e anexado digitalizado na aba EPIs da Qualidade, pelas regras de `.scratch/epi-relatorio-mensal/spec.md`. O consolidado do mês junta todas as áreas, sem assinatura.
_Avoid_: ficha de EPI individual (o documento é por área, não por colaborador)

**Fechamento do relatório de EPI**:
O ato da Qualidade de congelar o Relatório mensal de EPI de uma área num mês (situações: aberto, fechado, assinado). Para reabrir é preciso informar um motivo.
_Avoid_: Fechamento da pontuação (é do Faturamento)

### Atendimento

**Gerador de Orçamento**:
A ferramenta da área Atendimento em que o atendente busca exames, monta o carrinho e gera o Orçamento do cliente particular.
_Avoid_: Tabela Particular, Pardini, Álvaro (como nome da ferramenta; "Álvaro" segue sendo o laboratório de apoio do Envio ao Álvaro)

**Orçamento**:
O documento entregue ao cliente particular com os exames, as quantidades, os preços, o Valor Total e o Valor com Desconto. Não fica guardado no sistema.
_Avoid_: Cotação (é o processo de compras), orçamento particular

**Conferência de cobertura**:
A checagem, no Gerador de Orçamento, de quais exames do carrinho ou do pedido médico lido a fonte pagadora escolhida atende — ou, com um convênio escolhido, aquele convênio (tabela associada da fonte), com `atendido` no cadastro. Só indica coberto / não coberto: sem preço de convênio e sem PDF.
_Avoid_: orçamento de convênio (Orçamento é só do cliente particular), autorização (é o processo junto ao convênio, fora do flowlab)

**Fonte pagadora × convênio**:
A fonte pagadora é quem paga a conta (ex.: AMHP-DF); o convênio é uma tabela associada dela (ex.: BACEN, BACEN - MEDICINA LABORATORIAL), como cadastrada em `custo_tabelas_associadas`. Uma fonte pode ter um ou vários convênios.
_Avoid_: plano (no cadastro é tabela associada)

**Exame elegível a desconto**:
Exame marcado, no cadastro de fontes pagadoras, com a marcação de desconto particular (`elegivel_desconto_particular`); só ele recebe e conta para o Desconto automático por volume.
_Avoid_: exame com desconto, exame promocional

**Desconto automático por volume**:
O percentual (10% ou 15%) que o Gerador de Orçamento aplica sozinho sobre os Exames elegíveis a desconto, conforme a quantidade de exames elegíveis distintos ou a soma do valor deles. As faixas não se somam.
_Avoid_: desconto particular, desconto manual

**Tabela Colaborador**:
O modo do Gerador de Orçamento para colaboradores do laboratório, liberado pela permissão "Usar Tabela Colaborador". Mostra o Valor colaborador de cada exame ao lado do preço particular, monta o carrinho pelo Valor colaborador e não aplica o Desconto automático por volume. O "Orçamento – Tabela Colaborador" é uma variante do Orçamento, também não guardada.
_Avoid_: planilha de colaboradores (a planilha só deu a regra), convênio colaborador, tabela de funcionários

**Valor colaborador**:
O preço de um exame na Tabela Colaborador: custo do Controle de Custos ÷ fator, com fator = (100 − parcela A − parcela B) / 100, arredondado em centavos. Calculado na hora, com os parâmetros da regra do Controle de Custos. Sem custo, com custo maior ou igual ao preço particular, ou a partir do limite de pouca vantagem (hoje 90% do particular), o exame fica sem Valor colaborador: "consultar a gestão".
_Avoid_: preço colaborador fixo, desconto colaborador

**Exame de uso interno**:
Exame do Controle de Custos marcado "Uso interno (só Tabela Colaborador)": só aparece na Tabela Colaborador, sem preço particular, e fica fora do Gerador particular, da integração da Tabela Particular e da Conferência de cobertura.
_Avoid_: exame oculto, exame inativo
