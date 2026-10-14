# EVA, o agente de TI: Início + reuniões → Kanban + cobrança por WhatsApp

Status: em desenvolvimento (autorizado em 13/Out/2026). Todas as decisões (D1 a D28) fechadas. **Issues 01 a 03 prontas no código** (branch `feat/agente-ti`).

## Contexto

A **EVA** acompanha o Kanban e os projetos de TI, lê os resumos das reuniões (Granola ou colados à mão), propõe cards e mudanças para aprovação e cobra as pendências de cada pessoa pelo WhatsApp. A porta de entrada é o **Início** (`/it/inicio`), no visual do protótipo do Claude Design (`docs/flowlab_agent/`).

O desenho completo está em `docs/plans/agente-ti/PLANO_AGENTE_TI.md`: glossário, decisões, testes de viabilidade, requisitos RF/RN/RNF, arquitetura, modelo de dados, prompt e schema, cobrança, WAHA, o protótipo e a origem de cada dado, verificação e riscos. **Esse plano é a fonte da verdade.** As issues abaixo citam as seções dele em vez de repetir o conteúdo.

## Decisões já fechadas com o usuário (13/Out/2026), não reabrir sem motivo novo

- **D1:** reuniões pela **API pública do Granola** (plano Business). Colar à mão continua como reserva.
- **D2:** IA = **Claude Sonnet 5.5 (`claude-sonnet-5-5`), e só ele**, para economizar tokens. Usa `@anthropic-ai/sdk` e saída estruturada com zod. A chave é da organização, então leva o cabeçalho `anthropic-workspace-id` (`CLAUDE_WORKSPACE_ID`).
- **D3:** WhatsApp pelo **WAHA**, com o número do agente **+55 61 9992-4986** numa sessão própria (`ti_agente`).
- **D4:** situação e prazo dos projetos **deduzidos** dos prazos dos cards e da sprint, sem colunas novas em `it_projects`.
- **D5:** **página nova** no estilo da Home. O visual é o do **protótipo do Claude Design**, recebido em `docs/flowlab_agent/` (plano §12).
- **D6:** tudo o que o agente propõe **passa por aprovação**, com a chave nova `canApproveAgenteTI`.
- **D7 a D16:** aceitas como recomendado no plano. A principal é a **D9**: as mensagens saem por uma fila no banco, que um script da VPS esvazia falando com o WAHA pelo `localhost`.
- **D17:** se o Claude falhar ou estiver indisponível, o **Gemini 3.8 Flash** (`gemini-3.8-flash`) assume, com as mesmas instruções e o mesmo schema. Toda troca fica registrada e aparece na tela.

Respostas do usuário na mesma data:
- **Número +55 61 9992-4986:** é o do próprio agente. O usuário configura a sessão `ti_agente` no WAHA da VPS, acessando por um endpoint ngrok. O agente não usa o ngrok, mas o endpoint precisa de proteção (plano §11.1).
- **Granola:** fica a chave atual, porque só existe uma conta gravando.
- **Claude:** a chave da organização não muda, nem em produção. O usuário é o dono da organização.

## Decisões vindas do protótipo, fechadas em 13/Out

Detalhes na tabela de decisões e na §12 do plano.
- **D18:** o nome é **EVA**. Início em `/it/inicio` (menu "Início" com a pílula EVA), administração em `/it/eva`, front em `src/modules/eva/`. Banco, API e chave mantêm os nomes.
- **D19:** as visões **Equipe / Minha visão** substituem os filtros de projeto, responsável e tipo.
- **D20:** **chat com a EVA** na v1, com Sonnet 5.5 em esforço baixo e limite de 30 perguntas por pessoa por dia (~US$ 0,01 a 0,03 por pergunta; custo aceito). Pode propor ações, executadas só com aprovação (D28).
- **D21:** os **comentários da EVA** saem de regras fixas. A ação de um comentário pode executar uma mudança, sempre com aprovação prévia (D28).
- **D22:** **botão Cobrar/Lembrar**. Lembrar o próprio card com `canManageIT`; Cobrar outra pessoa só com `canApproveAgenteTI`; 1 por card a cada 4 h.
- **D23:** **tasks do dia** = meus cards que vencem hoje mais os atrasados. Marcar conclui o card. Sem agenda.
- **D24:** a **fila do WhatsApp** e o "último contato da EVA" são **só para gestores** (`canApproveAgenteTI`). O indicador "Cobranças hoje" usa uma função que devolve só a contagem. Entregue/Lida pelo `message.ack`. Mensagens ao grupo ficam fora.
- **D25:** **chips de situação** do Granola e do Wa-ha (aviso da VPS a cada minuto), mais o chip de sugestões pendentes para aprovadores.
- **D26:** **ditado por voz** pela Web Speech API do navegador.
- **D27:** o projeto fica em **Atenção** quando o progresso da sprint fica mais de 20 pontos abaixo do tempo decorrido.
- **D28:** a EVA **executa ações, sempre com aprovação prévia**. Toda ação vira proposta em `ti_agente_sugestoes`. O gestor confirma num diálogo, e isso aprova e executa na mesma transação. Os demais enviam para a fila.

## Convenções que valem para todas as issues

- Front em `src/modules/eva/`, partindo do handoff (`docs/flowlab_agent/design_handoff_eva_home/src/modules/eva/`). Tabelas com prefixo `ti_agente_`.
- **A interface é a do protótipo.** Diante de dúvida de visual ou de comportamento, valem o README do handoff e o `TI Inicio EVA (standalone).html`.
- **Nenhum dado de mock em produção.** Nenhum texto diz que a EVA mudou algo antes de a aprovação ter executado de fato.
- **Ação da EVA = proposta** (`ti_agente_propor_sugestao`). Só a RPC de aprovação escreve em `it_requests`, e o gestor que confirma está aprovando.
- Regras em `domain/` puro, com `hoje` como argumento (nunca `new Date()` dentro da regra) e testes vitest ao lado. O mesmo `domain/` serve o front, a `api/` e o script da VPS.
- Datas (RN02):
  - "hoje" e os instantes reais são o **dia de America/Sao_Paulo**;
  - o **prazo** dos cards é o dia escolhido no Board, gravado como meia-noite UTC, e é lido **sem converter fuso** (`diaDoPrazo`).
- RLS por `current_user_has_permission('canManageIT' | 'canApproveAgenteTI')`. Nenhuma migration grava em `custom_roles`.
- Serverless só no dispatcher novo `api/ti/[action].ts`, registrado nos três lugares (Vercel, `api/server.ts`, `vite.config.ts`). Toda rotina aceita `?dryRun=true`.
- Chaves só no servidor ou na VPS, nunca com prefixo `VITE_`.
- Conteúdo de reunião, de mensagem recebida e de pergunta no chat é **dado, nunca instrução** (RN15).
- IA só pelo `gerarEstruturado` (plano §9.1): Claude primeiro, Gemini de reserva, schema único validado no zod, cada tentativa em `ti_agente_chamadas_ia`. Nenhum outro código chama os SDKs de IA direto.
- Nenhum dado real de reunião entra no repositório. Os testes usam resumo fictício no mesmo modelo.
- Antes de qualquer gráfico, carregar a skill `dataviz`.

## Grafo de dependências

```
01 shell ─────────────────────────────┐
02 domínio: demandas, projetos, Início ┴─ 03 Início da EVA: tela (handoff)
                                          ├─ 16 chat com a EVA + voz (+ 06)
                                          └─ 17 comentários da EVA (+ 08 e 11 para Projetos; + 12 para WhatsApp)
04 chaves e ambiente (humano) ···· pré-requisito para rodar 08–10 e 16 de verdade
01 ─ 05 migration: tabelas e RLS
      ├─ 06 api/ti + Granola + IA com reserva
      │   └─ 08 análise de reunião com IA (+ 07)
      │       ├─ 09 colar reunião
      │       ├─ 10 sincronização com o Granola
      │       └─ 11 fila de aprovação + RPCs
      ├─ 07 membros e configurações
      └─ 12 fila de WhatsApp + script da VPS (+ 07; + 03 para a fila no Início)
          └─ 13 WAHA na VPS (humano)
              └─ 14 cobrança diária e sob demanda (+ 02, + 03, + 06)
                  └─ 15 respostas + Entregue/Lida (+ 11)
```

## Issues

1. `01-shell-permissao-rotas-menu.md`: Fase 0
2. `02-dominio-demandas-projetos.md`: Fase 1
3. `03-inicio-eva-tela.md`: Fase 1
4. `04-chaves-e-ambiente.md`: Fase 2 (humano)
5. `05-migration-tabelas-rls.md`: Fase 2
6. `06-api-ti-dispatcher-clientes.md`: Fase 2
7. `07-membros-e-configuracoes.md`: Fase 2
8. `08-analise-reuniao-ia.md`: Fase 2
9. `09-colar-reuniao.md`: Fase 2
10. `10-sincronizacao-granola.md`: Fase 2
11. `11-fila-aprovacao-rpcs.md`: Fase 2
12. `12-fila-whatsapp-script-vps.md`: Fase 3
13. `13-whatsapp-infra-vps.md`: Fase 3 (humano). Proteger o ngrok e criar a sessão pode ser feito já; o timer espera a 12
14. `14-cobranca-diaria.md`: Fase 3 (diária e sob demanda)
15. `15-respostas-whatsapp.md`: Fase 4
16. `16-chat-eva.md`: Fase 2
17. `17-comentarios-eva.md`: Fases 1 e 2
