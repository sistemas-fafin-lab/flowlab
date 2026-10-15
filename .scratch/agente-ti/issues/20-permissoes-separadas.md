# 20 — Permissões separadas: configurar, gestor e aprovar sugestões

**What to build:** pedido do usuário em 15/Out ("vamos separar as permissões, sobre quem pode configurar, quem é gestor e quem pode aprovar sugestões"). Até aqui, `canApproveAgenteTI` ("Aprovar sugestões e configurar a EVA") fazia os três papéis. Passam a ser três chaves de cargo:

| Chave | O que libera |
|---|---|
| `canConfigureAgenteTI` (nova) | Abas Membros e Configurações, "Enviar teste", "Buscar reuniões agora", aviso de falha da IA |
| `canManageAgenteTI` (nova) | Cobrar cards de outras pessoas (botão e WhatsApp), avisar o grupo, fila do WhatsApp e "último contato" no Início, aviso de card bloqueado |
| `canApproveAgenteTI` (a atual) | Aprovar e rejeitar (tela e WhatsApp), "sugestões pendentes", aplicar na hora um pedido de mudança, reanalisar reunião, aviso de sugestão nova |

Decisões do usuário:
- **Fila do WhatsApp no Início:** só o gestor.
- **Transição:** nenhuma migration grava nos cargos; ele marca as chaves novas.

Plano: §2 (D31), §6.2, §6.3 e §7.

**Blocked by:** 18, 19.

**Status:** done no código (15/Out/2026); falta aplicar a migration, publicar e marcar as chaves nos cargos

- [x] `src/utils/permissions.ts`: as duas chaves novas, o rótulo novo da atual e o `operator` legado sem nenhuma das três.
- [x] `src/modules/eva/domain/papeis.ts`:
  - `papeisEva`, pelas permissões da sessão;
  - `papeisDoPerfil`, pela regra do banco: admin tem os três, e removido ou desativado não tem nenhum.
- [x] Migration `20261015120000_eva_papeis.sql`:
  - RLS das tabelas da EVA por papel;
  - `ti_agente_tem_permissao(uuid, chave)` no lugar de `ti_agente_eh_gestor`;
  - as funções de aprovar e rejeitar "como" com a chave de aprovar;
  - a contagem de cobranças também para o gestor e para quem aprova.
- [x] Servidor:
  - botão Cobrar, com o gestor;
  - "Enviar teste", com quem configura;
  - chat: a fila no contexto só do gestor;
  - WhatsApp: cada comando confere a chave dele, também no SIM;
  - avisos no sino para quem tem o papel do aviso.
- [x] Telas:
  - rotas e menu (quem só configura entra pelas Configurações);
  - abas Membros e Configurações;
  - Início: a fila e o Cobrar com o gestor; aprovar na hora e o chip de pendentes com quem aprova;
  - selos "Configura", "Gestor" e "Aprova" na aba Membros;
  - textos de ajuda.
- [ ] Aplicar a migration no projeto do app.
- [ ] Marcar as chaves novas nos cargos (Usuários → Cargos e Permissões).
- [ ] Conferir com um usuário que tenha só uma das chaves.

## Comments

**15/Out/2026 — implementado no código.**

- **Leitura no banco (RLS):**
  - quem configura também lê as mensagens (histórico de cada membro, resultado do "Enviar teste", situação em Configurações), a config, as reuniões e o uso da IA;
  - o gestor lê os membros (quem tem WhatsApp, para o botão Cobrar) e as mensagens;
  - gravar membros e config é só de quem configura.
- **Admin:** no banco e no servidor, `role = 'admin'` tem os três papéis. Na tela, um admin com cargo fica com as chaves do cargo, como em todo o FlowLab (`AuthContext`).
  - **Atenção na transição:** os dois Gabriels são admin com o cargo "Desenvolvedor Master".
  - Pelo WhatsApp, continuam com tudo.
  - Na tela, só veem as abas Membros e Configurações, a fila e o Cobrar quando as chaves novas forem marcadas no cargo.
- **O Vinicius** (cargo "Desenvolvedor Master", sem ser admin) fica só com Aprovar até as chaves serem marcadas. Marcar no Desenvolvedor Master dá a ele também: para separar, ele precisa de outro cargo.
- **O Início continua com `canManageIT`.** A fila e o botão Cobrar aparecem para quem tem `canManageIT` e `canManageAgenteTI`.
- **Testes:**
  - 267 da EVA, incluindo papel isolado no WhatsApp (só aprova não cobra, só gestor não decide sugestões, o SIM confere o papel do pedido), a ajuda por papel e os papéis pelo perfil;
  - 72 cenários da migration (PGlite): cada chave sozinha lê e grava só o que deve, a versão "como" só aceita a chave de aprovar, e a função antiga saiu.
