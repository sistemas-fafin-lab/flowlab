## ADDED Requirements

### Requirement: Heatmap de risco (Probabilidade × Severidade)
O sistema SHALL exibir, no topo da tela de Riscos, um heatmap com grade fixa 5×5 (Probabilidade no eixo X, Severidade no eixo Y, ambos de 1 a 5), com o fundo de cada célula colorido segundo a faixa de classificação de risco (Baixo/Médio/Alto/Crítico) configurada em `qa_parametros`. Cada risco cadastrado SHALL ser plotado como um ponto individual dentro da célula correspondente ao seu par Probabilidade/Severidade, nunca agregado com outros riscos da mesma célula, colorido segundo o Nível do risco.

#### Scenario: Vários riscos na mesma célula P×S
- **WHEN** existem 2 ou mais riscos com a mesma Probabilidade e a mesma Severidade
- **THEN** cada um aparece como um ponto separado e clicável dentro da célula, sem sobreposição exata entre eles

#### Scenario: Hover num ponto do heatmap
- **WHEN** o usuário passa o mouse sobre o ponto de um risco no heatmap
- **THEN** o sistema exibe um tooltip com Setor, Processo, Risco, Probabilidade, Severidade, Nível e Status daquele risco

#### Scenario: Clique num ponto do heatmap
- **WHEN** o usuário clica no ponto de um risco no heatmap
- **THEN** o sistema abre o drawer de gerenciamento daquele risco (mesmo drawer usado ao clicar numa linha da tabela)

### Requirement: Ocultação condicional do heatmap sob filtro ativo
O sistema SHALL esconder o heatmap por completo (não apenas filtrar os pontos exibidos) sempre que a busca por texto ou o filtro de Setor estiverem preenchidos, e SHALL voltar a exibi-lo assim que ambos os filtros forem limpos.

#### Scenario: Usuário digita um termo de busca
- **WHEN** o campo de busca por texto contém algum valor
- **THEN** o heatmap não é renderizado na tela

#### Scenario: Usuário seleciona um Setor no filtro
- **WHEN** o select de Setor tem um setor selecionado
- **THEN** o heatmap não é renderizado na tela

#### Scenario: Usuário limpa os filtros
- **WHEN** tanto a busca de texto quanto o filtro de Setor estão vazios
- **THEN** o heatmap é renderizado normalmente

### Requirement: Busca e filtro de Setor
O sistema SHALL oferecer uma busca por texto livre que casa com o nome do risco identificado ou com o processo, e um select de Setor. Os dois filtros, quando aplicados, SHALL restringir simultaneamente: a visibilidade do heatmap (ver requisito acima), quais Seções de Setor aparecem, e quais linhas/séries aparecem dentro de cada Seção.

#### Scenario: Busca por parte do nome do risco
- **WHEN** o usuário digita um trecho que aparece no campo "Risco identificado" de algum risco
- **THEN** apenas riscos cujo nome ou processo contenham esse trecho permanecem visíveis nas tabelas e gráficos

#### Scenario: Filtro por Setor
- **WHEN** o usuário seleciona um Setor específico
- **THEN** apenas a Seção daquele Setor é exibida, com todos os seus riscos

### Requirement: Seletor de Ano global
O sistema SHALL oferecer um único seletor de ano (ano-calendário, Janeiro a Dezembro) que controla os gráficos de incidência de todas as Seções ao mesmo tempo. A lista de anos disponíveis SHALL ser calculada dinamicamente a partir dos anos em que existe pelo menos uma ocorrência vinculada a algum risco no sistema, sem depender dos filtros de busca/Setor ativos no momento. O valor inicial SHALL ser o ano mais recente com dado disponível; se não houver nenhum dado, o ano atual.

#### Scenario: Anos sem nenhuma ocorrência vinculada não aparecem
- **WHEN** um ano não tem nenhuma ocorrência vinculada a nenhum risco no sistema
- **THEN** esse ano não aparece como opção no seletor

#### Scenario: Trocar o ano selecionado
- **WHEN** o usuário escolhe outro ano no seletor
- **THEN** os gráficos de incidência de todas as Seções visíveis são recalculados para o ano escolhido

### Requirement: Seções por Setor
O sistema SHALL agrupar os riscos visíveis (após aplicar busca/filtro) em uma Seção por Setor, ordenadas alfabeticamente pelo nome do Setor. Um Setor sem nenhum risco visível no momento (seja porque não tem risco cadastrado, seja porque nenhum risco dele sobrevive ao filtro ativo) SHALL NOT ter Seção exibida.

#### Scenario: Setor sem risco cadastrado
- **WHEN** um Setor não tem nenhum risco cadastrado
- **THEN** nenhuma Seção é exibida para esse Setor

#### Scenario: Setor cujos riscos foram todos filtrados
- **WHEN** um Setor tem riscos cadastrados, mas nenhum deles casa com a busca/filtro ativo
- **THEN** a Seção desse Setor não é exibida enquanto o filtro estiver ativo

### Requirement: Tabela de riscos por Seção
Cada Seção SHALL exibir uma tabela com os riscos daquele Setor, contendo as colunas Processo, Risco, Probabilidade, Severidade, Score, Nível, Status (tratamento) e Cor. Clicar em uma linha da tabela, fora da célula de Cor, SHALL abrir o drawer de gerenciamento daquele risco.

#### Scenario: Clique numa linha da tabela
- **WHEN** o usuário clica numa linha da tabela, fora da bolinha de cor
- **THEN** o drawer de gerenciamento do risco correspondente é aberto

### Requirement: Cor customizável por risco
O sistema SHALL permitir que um usuário com permissão de gerenciar Qualidade escolha uma cor para cada risco, através de um controle na coluna Cor da tabela. A cor escolhida SHALL ser persistida no banco de dados e ser a mesma para todos os usuários que acessarem a tela (não é uma preferência local por usuário). Enquanto nenhuma cor tiver sido escolhida manualmente, o sistema SHALL aplicar uma cor padrão determinística (o mesmo risco sempre recebe a mesma cor padrão).

#### Scenario: Usuário sem permissão de gerenciar Qualidade
- **WHEN** um usuário sem a permissão de gerenciar Qualidade visualiza a tabela
- **THEN** a bolinha de cor é exibida, mas não é possível abrir o seletor de cor

#### Scenario: Usuário escolhe uma cor
- **WHEN** um usuário com permissão escolhe uma cor para um risco
- **THEN** a cor é salva no banco e passa a ser usada tanto na tabela quanto na linha correspondente do gráfico de incidência daquela Seção, para todos os usuários

#### Scenario: Risco sem cor escolhida
- **WHEN** um risco nunca teve uma cor escolhida manualmente
- **THEN** o sistema exibe e usa uma cor padrão calculada a partir do identificador do risco, sempre a mesma entre acessos

### Requirement: Gráfico de incidência mensal de ocorrências por risco
Cada Seção SHALL exibir, abaixo da tabela, um gráfico de linha com uma série por risco daquele Setor (respeitando o filtro ativo), com um ponto por mês do ano selecionado (12 pontos), cujo valor é a quantidade de Ocorrências vinculadas àquele risco cuja data de ocorrência cai naquele mês. Ao passar o mouse sobre um mês, o tooltip SHALL mostrar, além da contagem, a lista das datas exatas das ocorrências que compõem aquele total.

#### Scenario: Mês sem nenhuma ocorrência vinculada
- **WHEN** um risco não tem nenhuma ocorrência vinculada em um determinado mês do ano selecionado
- **THEN** o ponto daquele mês na série do risco tem valor zero

#### Scenario: Hover num mês com ocorrências
- **WHEN** o usuário passa o mouse sobre um ponto do gráfico que tem 1 ou mais ocorrências vinculadas naquele mês
- **THEN** o tooltip exibe a contagem total e a lista das datas exatas de cada ocorrência que contribuiu para esse total

### Requirement: Redirecionamento da rota antiga de Mapa por Setor
A rota `/qualidade/riscos/mapa` SHALL NOT mais renderizar uma tela própria; SHALL redirecionar automaticamente para `/qualidade/riscos/matriz`.

#### Scenario: Acesso a um link antigo do Mapa por Setor
- **WHEN** um usuário acessa `/qualidade/riscos/mapa` (ex: link salvo)
- **THEN** o sistema redireciona automaticamente para `/qualidade/riscos/matriz`
