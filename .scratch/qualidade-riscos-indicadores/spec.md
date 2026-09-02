# Qualidade: portar módulos Riscos e Indicadores (Requisições) do projeto de origem

Status: needs-triage

## Contexto

O módulo `qualidade/` deste repo foi originalmente portado de um projeto irmão,
`Flowlab_Controle_Qualidade` (mesmo código-base, histórico de git
independente — ver `docs/CLAUDE.md`: "ported from a separate project"). Um
membro da equipe continuou desenvolvendo lá e adicionou dois módulos novos
inteiros que ainda não existem aqui:

- **Riscos** (gestão de risco operacional: matriz, plano de ação, reavaliação,
  eficácia, contingência, correlação com Ocorrências)
- **Indicadores** (nova aba `/qualidade/indicadores` com 5 seções, alimentada
  por um novo espelho `qa_requisicoes` do LIS)

Commits de origem (branch `main` de `Flowlab_Controle_Qualidade`, sem overlap
de histórico com este repo — foram comparados arquivo a arquivo):

- `10cb3da` chore: tooling — issue tracker local e design-sync
- `aa18819` feat: qualidade — filtro select aninhado e colorido *(já existe
  aqui, convergente — não precisa portar)*
- `0608b0b` feat: ocorrências — descrição e filtro por tipo de pendência *(já
  existe aqui, convergente — não precisa portar)*
- `ad2efd4` fix: cortesias — valor particular/concedido e data do MySQL *(ver
  `.scratch/qualidade-cortesias-valor-particular-concedido/`, é uma
  divergência a investigar, não um port direto)*
- `cb05d94` feat: cortesias — categoria Não Autorizada e status renomeado
  *(já existe aqui, convergente — não precisa portar)*
- `d78e375` feat: qualidade — módulos Riscos e Indicadores (Requisições) —
  **é o commit que motiva as issues abaixo**
- `5aa8d90` fix: qualidade — patologista de requisições resolvido via
  `autusuario`, não `medico` *(correção pós-`d78e375` em
  `bdLabRequisicoes.ts` — carregar junto ao portar a 06, ver nota lá)*
- `cd932b3` chore: qualidade — script de correção do schema `qa_requisicoes`
  (teste) *(específico do banco de teste do repo de origem, não se aplica
  ao port aqui — contexto apenas)*

Os documentos originais de design/proposta do time de origem estão em
`openspec/changes/add-qualidade-riscos/`,
`openspec/changes/add-qualidade-riscos-ocorrencias-correlacao/` e
`openspec/changes/add-indicadores-gerais-laboratorio/` naquele repo (não
existem aqui ainda). Cada issue abaixo resume o que é relevante da proposta e
do design correspondente.

## Decisão de escopo

Recorte em fatias verticais (tracer bullets) via `/to-tickets`, revisado após
análise das 7 issues originais: o botão "Gerar risco a partir de ocorrência"
(capability `riscos-integracao-ocorrencias` da proposta original) tinha
ficado sem dono — foi incorporado à 01. `03` (contingência) foi solta da
dependência de `01`, já que o design de origem (D1) deixa
`qa_planos_contingencia` sem FK para `qa_riscos` — só precisa do shell de
navegação (`00`), não do schema de risco.

Grafo de dependências:

```
00 (shell/nav)
├─ 01 (cadastro + matriz + origem) ──┬─ 02 (gerenciamento) ──┬─ 04 (dashboard/mapa/alertas)
│                                     └─────────────────────┬─┘
│                                                            └─ 05 (correlação N:N)
└─ 03 (contingência) ────────────────────────────────────────┘

06 (indicadores/requisições) — sem blockers, módulo totalmente independente
├─ 07 (Biologia Molecular: TAT por exame) — sem blockers
├─ 08 (Patologia/AP: métricas ricas) — sem blockers
├─ 09 (Histologia/Citologia: métricas ricas) — reaproveita 1 coluna de 08
└─ 10 (IHQ/Parceiro: métricas ricas) — sem blockers
```

### Fase 2 de 06 (issues 07-10) — pesquisa 2026-09-01

06 entregou a página Indicadores com layout, gráficos e curadoria de
retificados, mas as 4 seções extras (Biologia Molecular, Patologia/AP,
Histologia/Citologia, IHQ/Parceiro) ficaram com um domínio genérico de 4
métricas (Requisições, Laudos liberados, TAT médio, Fora do prazo) em vez
das métricas ricas por seção do design de referência (`d78e375`). As
issues 07-10 fecham essa lacuna, uma seção por issue.

Diferente das issues 00-06 (que citavam a referência sem reconferir),
**07-10 foram escritas depois de reconferir cada `CodEvento`/`CodProblema`
ao vivo contra o MySQL de backup deste sistema** (mesma conexão do sync em
produção) — não só copiadas do projeto de origem. Isso corrigiu uma
alocação de seção errada (Microscopia Aguardando pertence a
Histologia/Citologia neste LIS, não a Patologia/AP como na referência) e
identificou 2 indicadores cujos `CodProblema` estão essencialmente mortos
neste LIS (Lâminas Inadequadas, Amostras Insatisfatórias — ver ressalvas em
cada issue antes de implementar).

Antes de qualquer issue virar implementação de fato, alguém precisa:
1. Confirmar que o design segue fazendo sentido no contexto deste repo (RLS,
   nomenclatura de tabelas `qa_*`, convenções do módulo `qualidade/` aqui
   podem ter divergido um pouco do projeto de origem).
2. Copiar/adaptar as migrations originais em vez de recriar do zero — elas
   existem prontas no repo de origem (`supabase/migrations/20260826*.sql`,
   `20260827*.sql`, `20260828*.sql` em diante) e podem servir de referência
   direta, ajustando apenas o que já diverge (ex.: nomes de policy/trigger que
   já existem aqui com outro padrão).

## Issues

0. `00-riscos-shell-navegacao.md` — prefactor: rota/menu vazios da aba Riscos
1. `01-riscos-cadastro-matriz-origem.md` — cadastro, matriz 5×5 configurável
   e origem por ocorrência (inclui o botão "Gerar risco a partir desta
   ocorrência")
2. `02-riscos-gerenciamento.md` — tratamento, plano de ação, reavaliação
   (risco residual antes/depois), avaliação de eficácia
3. `03-riscos-contingencia.md` — planos de contingência + histórico de testes
   (independente de Riscos)
4. `04-riscos-dashboard-mapa-alertas.md` — dashboard da aba, mapa por setor,
   alertas
5. `05-riscos-correlacao-ocorrencias.md` — vínculo N:N entre Riscos e
   Ocorrências existentes (distinto do vínculo de origem 1:N já coberto na 01)
6. `06-indicadores-requisicoes.md` — nova aba Indicadores (5 seções) + sync
   `qa_requisicoes` do LIS (sem blockers)
7. `07-indicadores-biologia-molecular-tat-por-exame.md` — TAT médio por
   tipo de exame (PCR vs. Captura Híbrida), sem migration
8. `08-indicadores-patologia-ap-metricas.md` — casos atrasados,
   recorte/coloração, consenso pendente, blocos refeitos
9. `09-indicadores-histologia-citologia-metricas.md` — blocos/lâminas
   produzidos, tempo de processamento, microscopia aguardando, qualidade de
   amostra
10. `10-indicadores-ihq-parceiro-metricas.md` — envio/retorno de material
    ao parceiro, TAT parceiro/interno, por tipo de exame
