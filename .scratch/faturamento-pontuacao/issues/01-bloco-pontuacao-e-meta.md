# 01: Bloco "Pontuação do setor" com a meta

**What to build:** na página Faturamento → Indicadores, abaixo dos rankings, aparece o bloco "Pontuação do setor". Ele tem um card para cada Frente (Faturamento e Recurso de Glosa), com o total em destaque e a tabela de critérios: critério, pontos base, pontos atingidos e observação. Nesta issue, só os critérios "Meta mensal" e "Meta superada" da frente Faturamento são calculados, ao vivo, pela meta mensal que já existe no FlowLab. O bloco segue o mês do cabeçalho e mostra o selo "Prévia". No modo Período, mostra o aviso da pontuação mensal. Regras em `.scratch/faturamento-pontuacao/spec.md`.

**Blocked by:** None (can start immediately).

**Status:** done (28/Out/2026; meta de set/2026 conferida no banco de produção); falta ver o detalhe "Meta mensal" na tela de produção

- [x] Módulo puro de pontuação no servidor, ao lado do módulo dos Indicadores, sem banco nem relógio.
  - Recebe o mês, os fatos, os lançamentos e os membros. Devolve, por Frente, os critérios (tipo, pontos base, pontos atingidos, observação, detalhe) e o total.
  - A tabela de critérios fica numa constante só: chave, Frente, rótulo, tipo e pontos base, na ordem da spec.
  - Os critérios que ainda não têm fato nem lançamento (das próximas issues) não aparecem.
- [x] Meta: o faturado vem do mesmo cálculo do widget "Meta mensal" das Faturas: emissão no mês, operadoras consideradas e títulos não cancelados.
  - Abaixo da meta: 0 nos dois critérios.
  - A partir da meta e abaixo de 115%: 5 em "Meta mensal".
  - A partir de 115%: 10 em "Meta superada" e 0 em "Meta mensal".
  - Mês sem meta cadastrada: "meta não cadastrada" e 0.
  - O detalhe mostra meta, faturado e % atingido.
- [x] Pontos com uma casa decimal; o total arredonda no fim.
- [x] GET da pontuação do mês, no roteador do Faturamento, com a mesma permissão de ver Faturamento dos Indicadores.
  - Mês inválido dá 400.
  - Falha do banco dá a mensagem clara, como nos Indicadores.
- [x] Na tela: esqueleto ao carregar, tema claro e escuro, selo "Prévia" e "dados até" quando houver fato do apLIS.
  - No modo Período, o aviso "A pontuação é mensal; escolha um mês", sem chamar a API.
- [x] Testes do módulo:
  - abaixo da meta;
  - igual à meta;
  - entre 100% e 115%;
  - exatamente 115%;
  - sem meta;
  - total da Frente.
- [ ] Conferido à mão: o detalhe "Meta mensal" da pontuação de setembro/2026 bate com a meta e o faturado por emissão do banco. Em produção (consulta no SQL Editor, 27/10/2026): meta R$ 1.100.000,08, faturado R$ 1.229.069,26 (181 títulos), atingido 111,7% → 5 em "Meta mensal" e 0 em "Meta superada"; falta ver na tela de produção.
  - No Supabase de teste a tela bate com o banco (27/10/2026): meta de teste R$ 5.000,00, faturado R$ 1.119.037,54 (160 títulos), 22.380,8% → 0 em "Meta mensal" e 10 em "Meta superada".
  - O widget "Meta mensal" das Faturas mostra sempre o mês atual; o R$ 1.114.775,43 citado antes era a meta de 10/2026, não o faturado de setembro.
