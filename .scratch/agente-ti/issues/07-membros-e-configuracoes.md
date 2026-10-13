# 07 — Membros e configurações do agente

**What to build:** as abas **Membros** e **Configurações** de `/it/eva`, só para quem tem `canApproveAgenteTI`.

**Membros:** liga um usuário do FlowLab aos nomes com que ele aparece nas reuniões (apelidos), ao WhatsApp e à adesão à cobrança. Sugestões iniciais de apelido: o nome completo e o primeiro nome do perfil. O número é guardado só com dígitos (ex.: `5561999924986`).

**Configurações:**
- pasta do Granola;
- dias para considerar um card parado;
- liga/desliga geral do WhatsApp e da cobrança (RF20);
- painel com a situação das integrações:
  - última sincronização com o Granola;
  - última análise com erro;
  - última mensagem enviada;
  - **IA:** chamadas da semana por provedor e por finalidade (reunião, chat, WhatsApp), quantas vezes o Gemini assumiu, tokens gastos e o último erro do Claude, com destaque quando for `configuracao` (chave ou workspace errado). Os dados vêm de `ti_agente_chamadas_ia`. O chat é o maior consumo esperado (plano §9.5).

A situação das integrações só mostra dados depois das issues 08, 10 e 12. Até lá, aparece "ainda não executado".

Plano: §2 (D10), §4.2 (RF10), §4.3 (RF20), §6.1 (`ti_agente_config`, `ti_agente_membros`) e §7.

**Blocked by:** 01, 05.

**Status:** done no código (13/Out/2026); falta conferir no navegador com um usuário só `canManageIT`

- [ ] `hooks/useMembrosAgente.ts` e `hooks/useConfigAgente.ts`.
- [ ] Aba Membros: lista, adicionar (escolhendo um usuário ativo), editar apelidos (chips), WhatsApp com máscara e validação, adesão, desativar.
- [ ] Mesmo apelido em dois membros: aviso na tela, porque quebraria a RN08.
- [ ] Aba Configurações: os campos da `ti_agente_config` e o painel de situação.
- [ ] Os dois liga/desliga começam **desligados**, e a tela explica o que cada um faz.
- [ ] Quem tem só `canManageIT` não vê as abas e recebe "Acesso negado" pela URL.

## Comments

**13/Out/2026 — implementado no código.**
- **Hooks:** ficaram juntos em `hooks/useAgenteAdmin.ts` (`useMembros`, `useConfigEva`, `useUsoIA`, `useSituacaoEva`), com um `useLista` comum que descarta resposta atrasada.
- **Membros** (`MembrosPage.tsx`):
  - lista, adicionar (só usuários ativos que ainda não são membros) e editar;
  - os apelidos sugeridos ao escolher a pessoa são o nome completo e o primeiro nome;
  - WhatsApp guardado só com dígitos (12 ou 13), exibido como `+55 61 99992-4986` (`formatarWhatsapp`, testado);
  - a adesão à cobrança só liga com número; "Ativo" desativa sem apagar;
  - aviso quando um apelido se repete em dois membros ativos (RN08).
- **Configurações** (`ConfiguracoesPage.tsx`):
  - pasta do Granola e dias para "parado" (1 a 60);
  - os dois liga/desliga, que vêm desligados da migration, com o texto do que cada um faz;
  - painel: última sincronização, última análise com erro, situação do WAHA (sem sinal depois de 5 min sem aviso da VPS) e última mensagem enviada;
  - IA dos últimos 7 dias por provedor e finalidade, vezes que o Gemini assumiu, tokens, e o último erro do Claude com destaque quando é `configuracao`.
- **Acesso:** as abas e as rotas `/it/eva/membros` e `/it/eva/configuracoes` exigem `canApproveAgenteTI` (issue 01).
- **Diferenças do texto da issue:**
  - os apelidos são um campo de texto separado por vírgula, não chips;
  - o WhatsApp não tem máscara de digitação. Aceita qualquer formato, guarda só os dígitos e valida o tamanho.
