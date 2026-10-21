# 02: Escolha de tabela associada por lista, com "+ Nova tabela"

**What to build:** Ao importar uma planilha ou criar/editar uma linha de preço, o usuário escolhe a tabela associada da lista de tabelas ativas da fonte selecionada, em vez de digitar. Se a tabela não existe, cria ali mesmo por "+ Nova tabela", informando nome e vencimento. Ver spec: `../spec.md`.

**Blocked by:** 01 — Cadastro de tabelas associadas, com vencimento

**Status:** ready-for-agent

- [x] Campo de tabela associada do modal de importação vira escolha de lista das tabelas ativas da fonte.
- [x] Campo de tabela associada do modal de linha vira escolha de lista das tabelas ativas da fonte.
- [x] "+ Nova tabela" no campo cria a tabela (nome + vencimento opcional) e já a seleciona; nome repetido na fonte é recusado com mensagem clara.
- [x] Gravações usam `tabela_associada_id`; o texto continua sincronizado.
- [x] Sem fonte escolhida, o campo de tabela fica desabilitado.

## Comments

- Implementado com o campo `EscolhaTabelaAssociada` (usado nos dois modais) + domínio `domain/tabelasAssociadas.ts` (com testes). O campo passou a ser obrigatório nos dois modais: toda linha precisa de cadastro. Linhas com tabela `''` aparecem como "(sem nome)".
- Migração `20261021180000_custo_tabelas_associadas_id_manda.sql` inverte o trigger: quando a gravação traz o id (insert, troca de id, ou update que não mexe em texto/fonte), o cadastro manda e o texto é copiado dele; fonte da linha ≠ fonte do cadastro é recusada. Gravador só com texto (scripts) continua texto → id. A tela agora manda só o id. Conferida num Postgres local (cenários de insert/update por id, id de outra fonte, id inexistente, legado). Aplicar antes de publicar o front.
- O upsert da importação continua casando pelo nome exato do cadastro, como a prévia (`calcularAtendidoImportacao`): o casamento por id nos dois fica para o ticket 04.
- Pendências para o 03: "+ Nova tabela" grava o cadastro na hora, então cancelar o modal depois deixa a tabela criada sem linhas (excluir vem no 03). E o caminho "separa da linha geral" cria uma linha nova na tabela da linha editada, mesmo que ela esteja inativa: o 03 precisa barrar isso.
- Falta conferir no navegador.
