# 13: Títulos: saldo desconta a glosa acatada e o lançamento manual de glosa é desligado

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** o saldo do título passa a ser total − recebido − glosa acatada (vinda do apLIS), no lugar de descontar a glosa definitiva da tabela `glosas`. A linha expandida do título lista as glosas do apLIS. Saem o "Lançar glosa" manual e a parte de glosas do "Aplicar baixas e glosas do apLIS"; as baixas continuam. A tabela `glosas` fica no banco como histórico, sem uso na tela. Isso substitui o comportamento de glosas do spec `.scratch/faturamento-glosas-sincronizar-aplis/`.

**Blocked by:** 12

**Status:** ready-for-agent

- [ ] A migration muda o cálculo derivado do saldo e o status do título que depende dele, sem apagar a tabela `glosas`.
- [ ] Antes de aplicar, um levantamento compara o saldo antigo com o novo por título, e as maiores diferenças são anexadas ao ticket para conferência.
- [ ] A linha expandida mostra as glosas do apLIS (requisição, motivo, valor, classificação).
- [ ] O botão "Lançar glosa" sai da tela, assim como o campo de glosa na baixa, se houver.
- [ ] O "Aplicar baixas e glosas do apLIS" só aplica baixas; prévia e modal deixam de mostrar glosas.
- [ ] Os testes existentes do fluxo de baixas continuam passando; os testes de glosas desligadas são removidos ou ajustados.
