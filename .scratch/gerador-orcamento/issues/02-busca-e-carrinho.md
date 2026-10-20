# 02: Gerador de Orçamento — busca e carrinho

**What to build:** a primeira versão completa (tracer bullet) do Gerador de Orçamento. Um atendente com o cargo "atendente" entra no flowlab, vê a área **Atendimento** no menu, abre o **Gerador de Orçamento**, busca exames por nome ou código TUSS, vê preço particular e convênios que atendem cada exame e monta um carrinho com quantidades. Os preços vêm de um endpoint interno autenticado pela sessão do usuário, **sem custo**. Visual no padrão do flowlab (guia `flowlab-identity`), usando a tela `alvaro-orcamento` da Tabela-Particular (`../Tabela-Particular`) só como referência de comportamento.

Ver `.scratch/gerador-orcamento/spec.md` → histórias 1–19 e "Módulo e navegação", "Permissões e cargos", "Endpoint interno de preços", "Domínio".

**Blocked by:** 01 — Montagem da lista de preços com custo opcional

**Status:** done no código (20/Out/2026); falta aplicar a migration `20261020180000_gerador_orcamento_atendente.sql`, publicar e conferir no navegador

- [x] Chave `canUseGeradorOrcamento` ("Usar Gerador de Orçamento") registrada no grupo novo "Atendimento" da lista de permissões do app
- [x] Migration idempotente: cargo de sistema "atendente" (`is_system = true`) com `canUseGeradorOrcamento`, e merge com dedup da chave no cargo "Administrador"
- [x] Área "Atendimento" no menu lateral com o item "Gerador de Orçamento", visível só com `canUseGeradorOrcamento`
- [x] Rota `/atendimento/gerador-orcamento` protegida como as demais rotas protegidas; acesso direto sem permissão é barrado
- [x] Endpoint interno GET autenticado pelo JWT de sessão: sem token → 401, sessão inválida → 401, sem `canUseGeradorOrcamento` → 403, método diferente de GET → 405, autorizado → 200 com a lista **sem custo**
- [x] Tela: busca em tempo real por nome e por TUSS, preço particular e convênios aceitos por exame, itens com mesmo TUSS e nomes diferentes aparecem separados
- [x] Carrinho: adicionar com um clique, alterar quantidade, remover item, limpar tudo
- [x] Estado de carregamento enquanto a lista chega; mensagem clara e botão de tentar de novo quando falha
- [x] Testes do handler cobrindo os status acima
- [x] `CONTEXT.md` criado na raiz com os termos Gerador de Orçamento, Orçamento, Exame elegível a desconto e Desconto automático por volume, e com "Tabela Particular", "Pardini" e "Álvaro" como sinônimos a evitar
