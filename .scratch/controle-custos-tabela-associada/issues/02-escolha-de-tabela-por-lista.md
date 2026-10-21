# 02: Escolha de tabela associada por lista, com "+ Nova tabela"

**What to build:** Ao importar uma planilha ou criar/editar uma linha de preço, o usuário escolhe a tabela associada da lista de tabelas ativas da fonte selecionada, em vez de digitar. Se a tabela não existe, cria ali mesmo por "+ Nova tabela", informando nome e vencimento. Ver spec: `../spec.md`.

**Blocked by:** 01 — Cadastro de tabelas associadas, com vencimento

**Status:** ready-for-agent

- [ ] Campo de tabela associada do modal de importação vira escolha de lista das tabelas ativas da fonte.
- [ ] Campo de tabela associada do modal de linha vira escolha de lista das tabelas ativas da fonte.
- [ ] "+ Nova tabela" no campo cria a tabela (nome + vencimento opcional) e já a seleciona; nome repetido na fonte é recusado com mensagem clara.
- [ ] Gravações usam `tabela_associada_id`; o texto continua sincronizado.
- [ ] Sem fonte escolhida, o campo de tabela fica desabilitado.
