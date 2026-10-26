# 13: Títulos: saldo desconta a glosa acatada e o lançamento manual de glosa é desligado

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** o saldo do título passa a ser total − recebido − glosa acatada (vinda do apLIS), no lugar de descontar a glosa definitiva da tabela `glosas`. A linha expandida do título lista as glosas do apLIS. Saem o "Lançar glosa" manual e a parte de glosas do "Aplicar baixas e glosas do apLIS"; as baixas continuam. A tabela `glosas` fica no banco como histórico, sem uso na tela. Isso substitui o comportamento de glosas do spec `.scratch/faturamento-glosas-sincronizar-aplis/`.

**Blocked by:** 12

**Status:** ready-for-human — falta rodar o levantamento no banco de produção antes de aplicar a migration

- [x] A migration muda o cálculo derivado do saldo e o status do título que depende dele, sem apagar a tabela `glosas`.
- [ ] Antes de aplicar, um levantamento compara o saldo antigo com o novo por título, e as maiores diferenças são anexadas ao ticket para conferência.
- [x] A linha expandida mostra as glosas do apLIS (requisição, motivo, valor, classificação).
- [x] O botão "Lançar glosa" sai da tela, assim como o campo de glosa na baixa, se houver.
- [x] O "Aplicar baixas e glosas do apLIS" só aplica baixas; prévia e modal deixam de mostrar glosas.
- [x] Os testes existentes do fluxo de baixas continuam passando; os testes de glosas desligadas são removidos ou ajustados.

## Notas da implementação

- **Migration** `supabase/migrations/20261026120000_fat_saldo_glosa_acatada.sql`:
  - `valor_saldo = total − recebido − valor_glosa_acatada`.
  - A coluna nova `notas.valor_glosa_acatada` é mantida por `fat_recalcular_nota`: Σ líquido − recebido das requisições da foto em 18 ou 8, nos lotes do título (`fat_glosa_acatada_nota`). É a mesma regra da coluna "Glosa acatada" (issue 12).
  - Status: 'liquidada' quando recebido + acatada ≥ total; 'glosada' com acatada e sem recebido.
  - `valor_glosado_definitivo` sai. `valor_glosado` segue calculado da tabela `glosas`, como histórico.
  - Gatilhos que recalculam o título:
    - na foto, um por comando, com tabelas de transição, para o upsert da sincronização não recalcular por linha;
    - em `nota_lote`;
    - em `lotes.aplis_id`.
  - Índice novo em `glosa_recurso_requisicoes(id_lote_faturamento)`.
  - A carga recalcula só os títulos com acatada na foto ou com glosa definitiva.
  - `fat_glosa_acatada_nota` é SECURITY DEFINER com `REVOKE` de PUBLIC/anon/authenticated.
- **Testada num Postgres local descartável**, com um esquema mínimo. Cobertura:
  - carga;
  - upsert, update (troca de lote) e delete na foto;
  - vínculo e desvínculo em `nota_lote`;
  - `aplis_id` preenchido depois;
  - título apagado em cascata;
  - lote vinculado duas vezes ao título, que conta uma vez.
- **Levantamento (pendente):** `supabase/scripts/fat_saldo_glosa_acatada_previa.sql` é somente leitura e deve rodar antes da migration. Devolve um resumo e as 50 maiores diferenças de saldo e status por título. Não foi rodado com dado real:
  - a base de dev não tem as tabelas da foto;
  - a leitura em produção não foi liberada nesta sessão.

  Quem aplicar a migration roda o script no banco de produção e anexa a saída aqui. Contra o esquema local, o script deu o mesmo resultado da migration.
- **Linha expandida:** `GET /api/faturamento/titulo-glosas-aplis?lotes=…` devolve as requisições da foto dos lotes do título. Cada uma mostra:
  - requisição (guia, paciente, lote);
  - motivos;
  - glosado (glosa fixada);
  - classificação: o chip de status do Dashboard e de Glosas recentes, com o evento do apLIS na dica;
  - o valor acatado, quando houver, que é o que sai do saldo.

  A lista é relida a cada expansão.
- **Desligado na tela:**
  - O botão "Lançar glosa" e o modo glosa do `BaixaModal`.
  - A seção de glosas da baixa. O restante da baixa passa a ser saldo − recebido, e a baixa vai com `glosas: []`.
  - A parte de glosas do "Aplicar baixas do apLIS" (rota, util e modal). A prévia só sugere baixas, e o saldo dela vem de `valor_saldo`.
  - Saíram `glosasAplis.ts`, o teste dele e `diferencasDosLotes` do bdLab.
  - A RPC `fat_lancar_glosas_aplis` e `glosas.origem` ficam no banco como histórico.
- **Testes:**
  - O handler da prévia e o util `aplicarBaixasAplis` foram ajustados só para baixas.
  - Testes novos do handler: saldo vindo de `valor_saldo` menos as baixas, e nenhuma glosa sugerida.
  - Os testes de glosa sugerida saíram com o módulo.
- **Pontos em aberto (fora do checklist, para decidir):**
  - O filtro "Glosa" de Títulos (com/em aberto/sem) e as views salvas ainda leem a tabela `glosas`.
  - A correção de lançamentos no "Editar título" ainda mostra e edita as glosas digitadas. Hoje elas mexem só em `valor_glosado`, não no saldo.
  - Os painéis de Contas a Receber (`glosas_por_motivo`, aging, RPCs do dashboard) e a coluna de glosado da conferência com o apLIS ainda usam a tabela `glosas`/`valor_glosado`.
  - O spec diz "sem uso na tela". Isso pede uma issue de acompanhamento.
  - A linha expandida não é relida se a foto for sincronizada com a linha aberta.
  - O mapeamento linha da foto → `RequisicaoFoto` agora está em oito handlers. A extração para `recursoGlosa` segue pendente.
