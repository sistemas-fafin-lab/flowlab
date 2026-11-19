# Qualidade: Relatório mensal de EPI

Status: ready-for-agent

## Problem Statement

Muitos produtos que os setores pedem ao Estoque são **EPIs**. A NR-6 exige comprovar a entrega de cada EPI ao colaborador. Exige também que o documento de entrega traga a **Identificação do EPI**: o número do CA ou, quando for o caso, o registro na ANVISA. Hoje o FlowLab não ajuda em nada disso:

- **O produto não diz se é EPI.** O cadastro só tem uma categoria em texto livre, sem campo para CA, registro ANVISA ou validade.
- **O Compras não sabe quais EPIs estão com a identificação vencida ou faltando.**
- **Não existe documento mensal.** A Qualidade não tem como saber, por área e por mês, quais EPIs foram entregues, a quem e com qual identificação. Também não tem um documento para os colaboradores assinarem e para ela arquivar e apresentar em auditoria.
- **A finalização tem um defeito.** Ela registra só um nome digitado e uma assinatura desenhada para a solicitação inteira. Quando a solicitação de materiais é finalizada direto do estado pendente, o nome e a assinatura se perdem sem nenhum aviso, mas o estoque é baixado e a solicitação é concluída mesmo assim.

O fluxo de solicitação e fornecimento **não muda**: o supervisor continua conferindo e assinando o recebimento na finalização. O que se acrescenta é uma comprovação mensal, que não substitui o registro feito em cada fornecimento.

## Solution

1. **No cadastro de produtos do Estoque**, o Compras marca o produto como **EPI**. Quando a marcação está ligada, ele informa a Identificação do EPI: tipo (CA ou Registro ANVISA), número e validade, todos opcionais. A lista de produtos mostra um selo "EPI" e um aviso "identificação vencida" quando for o caso. O aviso não bloqueia nada.
2. **Na finalização de uma solicitação de materiais**, o sistema copia a Identificação do EPI vigente para cada item que é EPI. Se o Compras trocar o CA depois, as entregas antigas continuam com o CA da época.
3. **Na Qualidade**, uma aba nova **"EPIs"**:
   - Escolhendo o mês, aparece a lista das áreas com a situação de cada uma: aberto, fechado ou assinado.
   - Também aparece um aviso quando uma área tem pedidos de EPI daquele mês ainda não entregues.
   - Para cada área, a Qualidade gera o **Relatório mensal de EPI** em PDF. Ele tem uma linha por EPI entregue e uma assinatura por linha, e é impresso para a coleta das assinaturas.
   - A Qualidade **fecha** a área para congelar o conteúdo, **reabre** quando precisa corrigir (informando o motivo) e **anexa o PDF assinado e digitalizado**, com histórico.
   - Há também o **consolidado do mês**, com todas as áreas e os totais por produto e por área, em PDF e em Excel.
4. **A finalização de uma solicitação de materiais pendente** passa a gravar o nome e a assinatura de quem recebeu, como já acontece com uma aprovada.

## User Stories

### Cadastro do EPI (Compras)

1. Como Compras, quero marcar um produto como EPI, para que ele passe a entrar no Relatório mensal de EPI.
2. Como Compras, quero informar se a identificação do EPI é um CA ou um Registro ANVISA, para que o relatório mostre o tipo certo.
3. Como Compras, quero informar o número da identificação, para que ele saia no relatório ao lado do produto.
4. Como Compras, quero informar a validade da identificação, para saber quando atualizar o cadastro.
5. Como Compras, quero poder salvar um EPI sem identificação, porque nem todo EPI tem CA ("quando aplicável").
6. Como Compras, quero ver na lista de produtos quais são EPIs, para conferir o cadastro rapidamente.
7. Como Compras, quero ver um aviso nos EPIs com a identificação vencida, para providenciar a atualização.
8. Como Compras, quero ver quais EPIs estão sem identificação, para completar o cadastro.
9. Como Compras, quero que só quem tem a permissão de gerir EPI possa alterar a marcação e a identificação, para que o dado normativo não seja alterado por engano.
10. Como Compras, quero que, ao desmarcar um produto como EPI, os campos de identificação fiquem ocultos, para não confundir.

### Finalização da solicitação de materiais (Estoque)

11. Como estoquista, quero finalizar a solicitação de materiais exatamente como faço hoje, para que a rotina operacional não mude.
12. Como estoquista, quero que o sistema grave sozinho a identificação de cada EPI entregue, sem que eu precise digitar nada.
13. Como Qualidade, quero que a identificação gravada seja a vigente no momento da entrega, para que uma troca de CA posterior não altere entregas passadas.
14. Como estoquista, quero que a finalização de uma solicitação pendente grave o nome e a assinatura de quem recebeu, assim como acontece com uma aprovada.
15. Como estoquista, quero ver um erro quando a gravação do recebedor e da assinatura falhar, em vez de ver a solicitação concluída sem assinatura.

### Relatório mensal de EPI por área (Qualidade)

16. Como Qualidade, quero uma aba "EPIs" dentro de Qualidade, para concentrar o controle de EPI no meu módulo.
17. Como Qualidade, quero escolher o mês e ver a lista de áreas que tiveram EPI entregue nele, para saber quais relatórios preciso gerar.
18. Como Qualidade, quero ver a situação de cada área no mês (aberto, fechado ou assinado), para acompanhar o que falta.
19. Como Qualidade, quero filtrar por área, para trabalhar uma de cada vez.
20. Como Qualidade, quero gerar o PDF do relatório de uma área e mês, para imprimir e colher as assinaturas.
21. Como Qualidade, quero que o cabeçalho traga a área e o mês/ano, para identificar o documento arquivado.
22. Como Qualidade, quero que cada linha traga a data da solicitação, o produto, a Identificação do EPI, a quantidade e o solicitante, para que a entrega fique rastreável.
23. Como colaborador, quero uma coluna de assinatura em cada linha, para assinar cada EPI que recebi.
24. Como responsável da área, quero um campo de assinatura e data no rodapé, para atestar a conferência do relatório.
25. Como Qualidade, quero que entrem só as solicitações de materiais já entregues, para que ninguém assine o recebimento de algo que não recebeu.
26. Como Qualidade, quero que uma solicitação de um mês entregue no mês seguinte apareça no mês da solicitação, porque é a data da solicitação que aparece na linha.
27. Como Qualidade, quero que itens pulados por falta de estoque na entrega fiquem fora do relatório, porque não foram entregues.
28. Como Qualidade, quero que itens digitados à mão, sem produto cadastrado, e produtos que não são EPI fiquem fora do relatório.
29. Como Qualidade, quero que as solicitações de compra fiquem fora do relatório, porque não são entregas a colaboradores.
30. Como Qualidade, quero que as entregas feitas antes desta funcionalidade, sem identificação gravada, usem a identificação atual do produto, para que o relatório de meses passados também saia.
31. Como Qualidade, quero as linhas ordenadas por data e depois por solicitante, para facilitar a conferência na hora da assinatura.
32. Como Qualidade, quero ver um aviso quando uma área tem pedidos de EPI do mês ainda não entregues, para não fechar o relatório antes da hora.

### Fechamento, reabertura e arquivamento (Qualidade)

33. Como Qualidade, quero fechar o relatório de uma área no mês, para que o conteúdo impresso não mude depois.
34. Como Qualidade, quero que o PDF de uma área fechada saia sempre do conteúdo congelado, mesmo que alguém altere uma solicitação ou um produto depois.
35. Como Qualidade, quero reabrir uma área fechada informando um motivo obrigatório, para corrigir um erro com justificativa.
36. Como auditor, quero ver quem fechou, quem reabriu, quando e por qual motivo, para conferir a integridade do documento.
37. Como Qualidade, quero anexar o PDF assinado e digitalizado de uma área fechada, para arquivá-lo no sistema.
38. Como Qualidade, quero que o anexo só seja aceito com a área fechada, para que o documento assinado corresponda ao conteúdo congelado.
39. Como Qualidade, quero que a área passe para "assinado" ao receber o anexo, para saber que o mês está concluído.
40. Como Qualidade, quero que anexar um novo PDF não apague o anterior, mantendo o histórico para auditoria.
41. Como Qualidade ou auditor, quero abrir o PDF assinado de qualquer área e mês, para comprovar o fornecimento.
42. Como Qualidade, quero que os PDFs assinados fiquem num armazenamento privado, aberto só a quem tem permissão, porque contêm nomes e assinaturas.

### Consolidado do mês

43. Como Qualidade ou Compras, quero o consolidado do mês com todas as áreas, para ter a visão geral do consumo de EPI.
44. Como Qualidade, quero que o consolidado siga as mesmas regras de inclusão do relatório por área, para que os números batam.
45. Como Compras, quero no consolidado os totais por produto, para planejar as compras.
46. Como Qualidade, quero no consolidado os totais por área, para comparar o consumo entre setores.
47. Como Qualidade, quero baixar o consolidado em PDF e em Excel, para apresentar ou analisar.

### Acesso

48. Como administrador, quero dar a cada cargo as permissões de gerir EPI, ver os relatórios de EPI e fechar os relatórios de EPI separadamente, para distribuir as responsabilidades entre o Compras, o Estoque e a Qualidade.
49. Como usuário sem permissão de ver os relatórios de EPI, não quero ver a aba nem abri-la pela URL.
50. Como usuário com permissão só de ver, quero gerar e imprimir os PDFs, mas não fechar, reabrir nem anexar.

## Implementation Decisions

### Vocabulário

Os termos **EPI**, **Identificação do EPI**, **Relatório mensal de EPI** e **Fechamento do relatório de EPI** estão no `CONTEXT.md`, seção Estoque e Qualidade.

### Módulos

- **Domínio do Relatório mensal de EPI (novo, sem banco e sem tela, no módulo Qualidade).** É o ponto de teste principal. Interface:
  - **Montar as linhas de uma área e mês.** Recebe as solicitações, os produtos e as movimentações de estoque e devolve as linhas ordenadas.
  - **Listar as áreas do mês.** Devolve a situação de cada área e a contagem de pedidos de EPI ainda não entregues.
  - **Montar o consolidado do mês.** Devolve as linhas com a área e os totais por produto e por área.
  - **Copiar a Identificação do EPI para os itens na finalização.** Recebe os itens e os produtos e devolve os itens, com a cópia da identificação nos que são EPI.
  - **Regras de fechamento.** Diz quais transições são válidas a partir de cada situação:
    - fechar: de aberto para fechado;
    - reabrir: de fechado ou assinado para aberto, com motivo obrigatório;
    - anexar: de fechado ou assinado para assinado.
- **PDF do Relatório mensal de EPI por área (novo).** Recebe as linhas e o cabeçalho e devolve o PDF. Segue o padrão dos PDFs do Gerador de Orçamento (`jspdf` + `autotable`).
- **Consolidado:** PDF e Excel gerados a partir da saída do domínio. O Excel segue o padrão de exportação da lista de produtos.
- **Cadastro e lista de produtos (alterados).** Ganham a marcação EPI, os campos de identificação e os selos.
- **Finalização da solicitação de materiais (alterada).**
  - Passa a chamar a função de domínio que copia a identificação dos EPIs.
  - A gravação do recebedor e da assinatura passa a aceitar as mesmas situações em que as ações de solicitação permitem finalizar uma solicitação de materiais (pendente ou aprovada).
  - Quando nenhuma linha for gravada, a finalização gera um erro.
- **Aba "EPIs" na Qualidade (nova).** Traz o seletor de mês, o filtro de área, a lista de áreas com a situação e as ações.

### Regras de inclusão das linhas

Um item entra no relatório de uma área e mês quando atende a todas estas condições:

- é de uma solicitação de materiais, não de uma solicitação de compra;
- a solicitação está concluída;
- o mês e o ano da **data da solicitação** são os do relatório;
- o setor gravado na solicitação é a área do relatório;
- o item tem um produto cadastrado e esse produto é EPI;
- existe movimentação de estoque daquela solicitação para aquele produto, ou seja, o item foi de fato baixado.

**Colunas:** Data (da solicitação), Produto, Identificação (por exemplo, "CA 12345" ou "ANVISA 80495510226"), Qtd., Solicitante (quem criou a solicitação) e Assinatura.

- A identificação vem da cópia gravada no item. Sem cópia, vem do cadastro atual do produto. Sem nenhuma das duas, a coluna fica vazia.
- A quantidade é a do item. Hoje ela é igual à entregue, porque o sistema não aceita entrega parcial.
- Ordenação: por data e depois por solicitante.

### Área

A área é o setor gravado na solicitação, que vem do perfil de quem pediu. Variações de grafia de um mesmo setor aparecem como áreas distintas, e não haverá normalização nesta entrega.

### Situação de uma área no mês

- **aberto**, quando nunca foi fechada ou foi reaberta. O PDF e as linhas são calculados na hora.
- **fechado**. As linhas ficam congeladas e o PDF sai do conteúdo congelado.
- **assinado**, quando há pelo menos um PDF assinado anexado ao fechamento atual.

Reabrir exige motivo e registra quem reabriu e quando. Os anexos nunca são apagados.

### Layout do PDF por área

- Página A4 na horizontal.
- Cabeçalho: "EPIs — \<Área\> — \<Mês\>/\<Ano\>".
- Tabela com as colunas acima. A coluna Assinatura é larga, com uma assinatura por linha.
- Rodapé: "Responsável da área: ______  Data: __/__/____" e o número da página.

### Consolidado

- Mesmas regras de inclusão do relatório por área, juntando todas as áreas.
- Colunas: Área, Data, Produto, Identificação, Qtd. e Solicitante, sem assinatura.
- Quadros de totais por produto e por área.
- Sem fechamento: sempre usa os dados atuais.

### Esquema (Supabase)

- **Produto:** marcação de EPI (booleana, desligada por padrão), tipo da identificação (CA ou ANVISA), número (texto) e validade (data).
- **Item da solicitação:** o item já é guardado como JSON e ganha a cópia opcional `{tipo, numero, validade}` da Identificação do EPI, gravada na finalização.
- **Fechamento por (área, mês), tabela nova:** situação, linhas congeladas, quem fechou e quando. Uma (área, mês) tem um único registro.
- **Histórico de reaberturas, tabela nova:** motivo, quem reabriu e quando.
- **Anexos assinados, tabela nova:** ligados ao fechamento, com o caminho do arquivo, quem enviou e quando.
- **Armazenamento privado novo** para os PDFs assinados, aceitando só PDF.
- **RLS:** as tabelas novas e o armazenamento seguem as permissões abaixo.

### Permissões (chaves novas, atribuídas por cargo)

| Chave | Para quem | O que libera |
|---|---|---|
| Gerir EPI (`canManageEpi`) | Compras | editar a marcação e a identificação do produto |
| Ver relatórios de EPI (`canViewEpiReport`) | Qualidade, Estoque | ver a aba, gerar os PDFs e o consolidado |
| Fechar relatórios de EPI (`canCloseEpiReport`) | Qualidade | fechar, reabrir e anexar o PDF assinado |

## Testing Decisions

- **O que é um bom teste:** só o comportamento externo, com entradas e saídas das funções de domínio e o texto do PDF gerado. Nenhum teste depende da forma interna de cálculo nem do banco.
- **Ponto 1, domínio do Relatório mensal de EPI.** Casos de teste:
  - **Montagem das linhas:**
    - solicitação de compra ignorada;
    - solicitação não concluída ignorada;
    - item sem produto ignorado;
    - produto que não é EPI ignorado;
    - item sem movimentação ignorado;
    - solicitação de um mês concluída no mês seguinte, que entra no mês da solicitação;
    - filtro por área;
    - identificação gravada no item × cadastro atual × nenhuma;
    - ordenação.
  - **Lista de áreas:** situação de cada área e contagem de pedidos de EPI ainda não entregues.
  - **Consolidado:** totais por produto e por área, batendo com as linhas.
  - **Cópia da identificação na finalização:** só os itens que são EPI recebem a cópia, e os demais ficam intactos.
  - **Regras de fechamento:** cada transição válida e inválida, incluindo reabrir sem motivo e anexar com a área aberta.
  - **Prior art:** os testes de domínio da Qualidade (indicadores e regras).
- **Ponto 2, PDF por área.** O teste extrai o texto do PDF e confere cabeçalho, colunas, uma linha por item, rodapé do responsável e identificação formatada. **Prior art:** os testes de PDF do Gerador de Orçamento, com o helper de extração de texto.
- **Correção da finalização:** coberta pelos testes já existentes das ações de solicitação. A gravação passa a usar a mesma regra de situações que podem ser finalizadas, e o teste existente ganha o caso "solicitação de materiais pendente pode ser finalizada".

## Out of Scope

- Assinatura digital do colaborador: a assinatura é em papel, e o PDF digitalizado é anexado.
- Distribuição de um item entre vários colaboradores, ou um campo "para quem". O solicitante é quem criou a solicitação, e o risco de um supervisor pedir pela equipe foi aceito.
- Entrega parcial de quantidade.
- Bloquear a entrega por identificação vencida ou ausente.
- Geração agendada no fim do mês.
- Normalizar os nomes de setor.
- Usar o cadastro de colaboradores do RH.

## Further Notes

- Um número de 11 dígitos começando com 8, como o 80495510226 do exemplo do usuário, costuma ser registro na ANVISA, não CA. Por isso existe o campo de tipo.
- O relatório por área atende ao pedido de "um local para assinatura dos responsáveis": há uma assinatura por linha e outra do responsável no rodapé. O texto do usuário falava em um "demonstrativo individual por colaborador", mas o modelo de relatório que ele mandou depois é por área, e foi esse que se adotou.
