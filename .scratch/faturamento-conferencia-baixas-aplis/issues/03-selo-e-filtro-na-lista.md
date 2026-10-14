# 03 — Selo e filtro "Divergente do apLIS" na lista de Títulos

**What to build:** o alerta no dia a dia. A lista de Títulos marca os títulos
divergentes e ganha um filtro para eles. Ver `../spec.md` — seção "Frontend".

**Blocked by:** 01

**Status:** needs-triage

- [x] O hook da aba Títulos busca a conferência uma vez por carga, sem
      bloquear a lista, e cruza por `idNota`
- [x] Selo na linha: "apLIS: recebido R$ X em DD/MM" (`so-no-aplis` e
      `aplis-maior`) ou "recebido só no sistema" (`sistema-maior`); tooltip com
      os dois valores
- [x] Filtro "Divergente do apLIS" junto dos demais filtros (combinável com
      operadora, período e status) e nas views salvas
- [x] Depois de salvar ou excluir uma baixa, a conferência é refeita e o selo
      some quando a diferença zera
- [x] Se a conferência falhar, a lista funciona normalmente e mostra um aviso
      discreto, sem selos

## Comments

- 14/10 — implementado (`hooks/useConferenciaAplis.ts`, `seloDivergencia` e
  `idsDivergentesNoPeriodo` em `utils/conferenciaAplis.ts` com teste vitest,
  `divergenteAplis` nas views salvas). Decisões além da issue:
  - o filtro recorta no servidor (`in('id_nota', …)`), com os ids da
    conferência já cortados pelo período de emissão para a URL não crescer;
  - filtro ligado com a conferência fora do ar → lista vazia com aviso
    ("desligue o filtro"), nunca a lista inteira como se fosse divergente;
  - data do selo = último recebimento no apLIS;
  - `sistema-maior` com algo recebido no apLIS diz "recebido a mais no
    sistema" ("recebido só no sistema" fica para apLIS = 0); `lote-ausente`
    também ganha selo ("lote ausente no apLIS") e entra no filtro;
  - a conferência é refeita ao fechar o "Lançar baixa"/"Editar título" depois
    de salvar ou excluir (não a cada gravação com o modal aberto), e também no
    cancelamento, no "Atualizar" da lista e depois do "Atualizar do apLIS";
  - cores do selo = as do modal (`COR_TIPO` agora em `utils/conferenciaAplis.ts`);
    o modal passou a usar o mesmo `buscarConferenciaAplis`.
  - Atenção: "Somente pendentes" vem ligado e esconde os `sistema-maior`
    (títulos recebidos) — para vê-los no filtro, desligue o atalho.
  - Não testado no navegador: depende de login e da réplica do apLIS.
