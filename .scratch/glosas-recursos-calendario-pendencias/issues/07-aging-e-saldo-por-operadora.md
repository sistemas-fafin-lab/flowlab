# 07: Aging da glosa em recurso e Saldo de glosa por operadora

Spec: `.scratch/glosas-recursos-calendario-pendencias/spec.md`

**What to build:** no Dashboard de glosa, o aging do valor em recurso ainda em aberto, nas faixas A vencer, 1–30, 31–60, 61–90 e +90 dias desde a data de pagamento prevista, empilhado por operadora (7 maiores + Outras), com a nota "Fora das faixas". Ao lado, o saldo de glosa em disputa por operadora (10 maiores).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Funções puras de aging (a partir dos prazos por requisição da issue 02) e de saldo por operadora, com testes dos limites de faixa (0, 30, 31, 60, 61, 90, 91), "A vencer", fora das faixas e "Outras".
- [ ] O saldo por operadora usa a mesma classe "em disputa" do card Saldo pendente.
- [ ] Respeita o filtro de convênio; gráficos no padrão do Aging da carteira e do Saldo por operadora do Contas a Receber, nos temas claro e escuro.
