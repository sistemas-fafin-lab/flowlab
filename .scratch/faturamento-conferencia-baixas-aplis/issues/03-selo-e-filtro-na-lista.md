# 03 — Selo e filtro "Divergente do apLIS" na lista de Títulos

**What to build:** o alerta no dia a dia. A lista de Títulos marca os títulos
divergentes e ganha um filtro para eles. Ver `../spec.md` — seção "Frontend".

**Blocked by:** 01

**Status:** needs-triage

- [ ] O hook da aba Títulos busca a conferência uma vez por carga, sem
      bloquear a lista, e cruza por `idNota`
- [ ] Selo na linha: "apLIS: recebido R$ X em DD/MM" (`so-no-aplis` e
      `aplis-maior`) ou "recebido só no sistema" (`sistema-maior`); tooltip com
      os dois valores
- [ ] Filtro "Divergente do apLIS" junto dos demais filtros (combinável com
      operadora, período e status) e nas views salvas
- [ ] Depois de salvar ou excluir uma baixa, a conferência é refeita e o selo
      some quando a diferença zera
- [ ] Se a conferência falhar, a lista funciona normalmente e mostra um aviso
      discreto, sem selos

## Comments
