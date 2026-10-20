# 05: Custos — PDF interno e custo controlado pela permissão

**What to build:** quem tem a permissão de custos vê o botão "Gerar PDF Interno" e baixa um PDF com custo, preço de venda e margem por exame, uma linha com o desconto automático aplicado (percentual e quantos exames elegíveis entraram) e a marca d'água "INTERNO". Quem não tem a permissão não vê o botão, e o **custo nem chega ao navegador**: o endpoint interno só consulta e devolve o custo para quem tem `canViewGeradorOrcamentoCustos`, e avisa a tela se o usuário pode ver custos.

Ver `.scratch/gerador-orcamento/spec.md` → histórias 32–36 e "Permissões e cargos", "Endpoint interno de preços".

**Blocked by:** 04 — Orçamento em PDF do cliente

**Status:** done no código (20/Out/2026); falta aplicar a migration `20261020190000_gerador_orcamento_custos.sql`, publicar e conferir no navegador

- [x] Chave `canViewGeradorOrcamentoCustos` ("Ver custos e margem no Gerador de Orçamento") no grupo "Atendimento"
- [x] Migration idempotente adicionando a chave ao cargo "Administrador" (o cargo "atendente" não recebe)
- [x] Endpoint interno: com uso e sem custos → 200 sem `custo` em nenhum item; com as duas permissões → 200 com custo; a resposta informa se o usuário pode ver custos
- [x] Botão "Gerar PDF Interno" visível só para quem pode ver custos
- [x] PDF interno com cabeçalho do flowlab, tabela custo × venda × margem, linha do desconto automático e marca d'água "INTERNO"
- [x] O cenário "Não Atendido" (markup 0,7x/0,8x) da Tabela-Particular **não** é portado
- [x] Testes do handler para os dois casos de permissão e testes do PDF interno portados

**Desvios deliberados do PDF interno da Tabela-Particular:** a coluna "Diferença (R$)" virou "Margem (R$)" (margem negativa em vermelho); a linha do desconto diz "N exame(s) elegível(is)" em vez de "N itens elegíveis"; o segundo total é "Valor com Desconto", como no PDF do cliente; sem a marca d'água do logo (o PNG do cabeçalho é branco e some no fundo branco), só o "INTERNO". O PDF interno recusa montar quando algum exame vem sem custo (ausente ou null), em vez de mostrar margem igual à venda.
