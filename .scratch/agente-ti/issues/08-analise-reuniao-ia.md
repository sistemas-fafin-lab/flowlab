# 08 — Análise de reunião com IA

**What to build:** o coração do agente. Dada uma linha de `ti_agente_reunioes`, `analisarReuniao`:
1. monta o contexto: membros, cards abertos, projetos e sprints;
2. chama o `gerarEstruturado` da 06 (Claude Sonnet 5.5 com `effort: 'medium'`, Gemini 3.8 Flash de reserva);
3. valida o resultado (RN08 a RN10);
4. grava as sugestões;
5. atualiza a reunião (status, `provedor`, `motivo_reserva`);
6. avisa os aprovadores no sino.

O resultado é testado com um resumo **fictício** no mesmo modelo das reuniões da TI: REVIEW / PLANNING / "Próximas ações" com `**ação** — @Responsável — Prazo: …`. Nenhum dado real de reunião entra no repositório. A reunião real de 21/09 só passa pelo `dryRun`, depois da 04.

Plano: §3 (formato da nota), §4.4 (RN07 a RN11, RN14, RN15), §9 inteiro e §14.2/§14.4.

**Blocked by:** 06, 07. Para rodar de verdade na Vercel, também a 04 (chaves do Claude e do Gemini cadastradas lá). Localmente, já funciona.

**Status:** done no código (13/Out/2026); primeira análise real pela tela em 13/Out, com a correção abaixo

- [ ] `api/_lib/ti-agente/extracao.ts`:
  - instruções fixas em pt-BR (§9.2), as mesmas para os dois provedores, com o conteúdo entre `<reuniao>…</reuniao>` tratado como dado;
  - schema zod da §9.3, no formato aceito pela saída estruturada: tudo em `required`, opcionais `nullable`, sem campos extras;
  - montagem do contexto, com cards abertos um por linha.
- [ ] Chamada **só** via `gerarEstruturado({ finalidade: 'analise_reuniao', esforco: 'medium', … })`. Nada de SDK de IA direto nesta issue.
- [ ] Validação pós-IA (§9.4): ids fora da lista, código inexistente vira "criar" com confiança baixa, datas inválidas, `sprint` resolvida para `sprint_id`, atualização igual ao estado atual descartada, `avisos` preenchido. É a mesma validação, seja quem for o provedor.
- [ ] `analisarReuniao.ts`:
  - marca `analisando`, grava as sugestões e marca `analisada` com `provedor` e `motivo_reserva`;
  - se os dois provedores falharem, marca `erro` com as duas mensagens;
  - ao reanalisar, as sugestões pendentes antigas viram `substituida` (RN11).
- [ ] Aviso no sino (`user_notifications`, módulo `IT`) para os aprovadores: "N sugestões novas da reunião X".
- [ ] Aviso no sino quando o Gemini assumir **3 vezes seguidas** (lendo `ti_agente_chamadas_ia`): "O Claude não está respondendo; o Gemini está assumindo. Último erro: …".
- [ ] `extracao.test.ts` com o resumo fictício, cobrindo os casos da §14.2, com `gerarEstruturado` falso devolvendo uma resposta fixa. Incluir um caso em que a resposta veio do Gemini, para conferir que a validação é a mesma.
- [ ] `dryRun` devolve as sugestões validadas sem gravar e diz qual provedor respondeu.
- [ ] Rodar o `dryRun` com a reunião real de 21/09 e registrar nos comentários quantas sugestões saíram, quais fazem sentido e os tokens gastos. Se as sugestões não convencerem, testar `esforco: 'high'` antes de mexer no prompt.

## Comments

**13/Out/2026 — implementado.**
- `extracao.ts`: instruções, schema, contexto e validação da §9.4.
- `analisarReuniao.ts`: substitui as pendentes antigas, grava as sugestões e a reunião (`provedor`, `motivo_reserva`, `observacoes`), avisa os gestores e manda o aviso de 3 reservas seguidas, uma vez só.
- `dados.ts`: enquanto a aba Membros estiver vazia, usa as pessoas do departamento TI como membros, com o primeiro nome como apelido.
- 11 testes da extração com reunião fictícia.

**Dry-run com a reunião real de 21/09** (sem gravar; contexto: 7 pessoas, 18 cards abertos, 6 projetos, 3 sprints):
- **Primeira rodada do Claude:** 7 sugestões, todas "criar card", mesmo havendo cards abertos sobre os mesmos assuntos. Isso geraria duplicados.
- **Gemini, com as mesmas instruções:** ligou os itens aos cards IT-056, IT-120, IT-118 e IT-050.
- **Correção:** as instruções passaram a mandar procurar primeiro na lista de cards, comparando pelo sentido (a transcrição escreve "Área", "Áurea" e "Oria" para o Oria), e a sempre preencher o responsável.
- **Segunda rodada do Claude:** comentou no IT-120 (auditoria no Oria: falta o deploy) e no IT-118 (Hub interno do Oria). Criou 4 cards novos: robô de pré-faturamento; chamado para o Jonathan, com o Gabriel; validação do Hub de Laudos; reunião com a Erika. O "Hub de Laudos" pode ou não ser o IT-050 ("Envio de Laudos Via API"); quem aprova decide.
- **Custo medido:** cerca de 11 mil tokens de entrada e 2 mil de saída (~US$ 0,04 por reunião), em 10 a 15 s. Esforço `medium` mantido.

**13/Out/2026 — primeira análise real pela tela (Reuniões → "Buscar reuniões agora") e correção.**
- **Resultado:** a sincronização trouxe a nota da pasta, o Claude analisou e gravou 11 sugestões pendentes. Mesmo assim, a reunião ficou como "Erro" com "invalid input syntax for type json".
- **Causa:** `lerGestores` filtrava `custom_roles.permissions` com `.contains(..., ['canApproveAgenteTI'])`. A coluna é `jsonb`, e o array JS vira o literal de array do Postgres (`{…}`), que não é JSON. O teste no PGlite não pegou porque o stub tinha `permissions` como `text[]`.
- **Correção:**
  - o filtro agora vai como JSON (`'["canApproveAgenteTI"]'`);
  - uma falha no aviso do sino não marca mais como erro uma análise que já foi gravada.
  
  Dois testes novos em `analisarReuniao.test.ts`.
