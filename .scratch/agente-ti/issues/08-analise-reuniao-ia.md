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

**Status:** ready-for-agent

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
