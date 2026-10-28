# 07: Editar os membros das Frentes na tela

**What to build:** quem gerencia Faturamento abre "Membros" no bloco da pontuação para incluir ou desativar uma pessoa em cada Frente. A pessoa é escolhida pelo usuário do apLIS, porque é por ele que as tarefas são contadas.

**Blocked by:** 02 (Tarefas pendentes, com os membros das Frentes).

**Status:** done

- [x] Botão "Membros" só para quem gerencia Faturamento. Ele abre a lista das duas Frentes, com o nome e o id do usuário do apLIS.
- [x] Incluir: busca o usuário do apLIS pelo nome, entre os usuários ativos, e grava o id e o nome.
  - Só o nome sai de `autusuario`, nunca outras colunas.
  - A mesma pessoa não pode entrar duas vezes na mesma Frente.
- [x] Desativar em vez de apagar, para o histórico continuar legível.
- [x] A prévia do mês aberto reflete a mudança na hora. Meses fechados não mudam (ver issue 06).

**Implementado (27/10/2026):** GET `/api/faturamento/pontuacao?consulta=membros|usuariosAplis` e POST `acao: incluirMembro|desativarMembro`, só para canManageBilling. O nome é lido do apLIS no servidor (`autusuario.NomUsuario`, `Inativo = 0`), nunca do corpo. Incluir quem já foi desativado reativa a mesma linha (o UNIQUE de Frente e usuário não deixa duplicar). Depende da migration `20261027130000_fat_pontuacao_membros.sql` aplicada (ver issue 02).
