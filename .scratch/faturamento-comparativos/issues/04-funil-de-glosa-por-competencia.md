# 04: Funil de glosa por competência com vínculo ao lote

**What to build:** na aba Comparativos, o funil Faturado → Recebido → Glosa total (= recuperada + acatada + em disputa) → Saldo pendente, por competência (mês de emissão), para os 3 meses, com glosa, acatada e saldo atribuídos ao lote e as glosas sem lote como "Fora de lote". Recuperada aparece como detalhe do Recebido, sem somar duas vezes; o "recebido no mês" (caixa) aparece ao lado. Entrega o **mapeamento proposto de status do apLIS → Glosa recuperada** para a usuária revisar. Ver `../spec.md`.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Funil fecha: Faturado = Recebido + Acatada + Em disputa + Saldo; Recuperada não é somada duas vezes.
- [ ] Acatada usa os status 18 e 8; Recuperada usa uma constante de mapeamento revisável, documentada no corpo desta issue ao concluir.
- [ ] Glosas sem lote entram como "Fora de lote" e o total bate com a tela Glosas e Recursos.
- [ ] Título emitido em outro mês não entra no mês.
- [ ] Testes de função pura (competência, fechamento do funil, fora de lote, virada de ano) e da rota; `npm test` e typecheck passam.
