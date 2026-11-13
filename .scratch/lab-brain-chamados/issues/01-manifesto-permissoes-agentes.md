# 01: Manifesto de permissões por agente (prefactor)

**What to build:** um lugar único no código que diz quais operações cada agente pode fazer, e a pergunta "o agente X pode a operação Y?". As consultas que o LAB-BRAIN já faz ao Envio ao Álvaro passam a checar `apoio.ler` por esse manifesto, sem nenhuma mudança visível para o LAB-BRAIN. Ver `../spec.md`, D3 e D8.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] O manifesto declara `lab-brain` com as operações `apoio.ler`, `chamados.criar` e `chamados.ler`.
- [x] As três rotas de consulta do apoio checam `apoio.ler` depois da chave e antes dos parâmetros (D8).
- [x] Um agente sem a operação recebe recusa (403) antes de qualquer consulta, cota ou auditoria.
- [x] Os testes atuais da integração do LAB-BRAIN com o apoio continuam verdes, sem alteração de comportamento.
- [x] Um teste novo pela rota cobre a recusa de um agente sem a operação.

## Comments

- 13/11/2026: implementado. Manifesto em `api/_lib/agentes/permissoes.ts` (`agentePode(agente, operacao)`); as três rotas do apoio checam `apoio.ler` em `criarHandlerLabBrainApoio` (`api/_lib/labBrainApoio.ts`), depois da chave e antes dos parâmetros, com 403 sem cota nem auditoria. O agente tem constante própria (`AGENTE_LAB_BRAIN`), separada do nome da integração na auditoria, para a 02 usar `lab-brain-chamados` como integração (D9). Guia `docs/apoio-alvaro/INTEGRACAO_LAB_BRAIN.md` ganhou a linha do 403.
