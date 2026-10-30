# 07: Confirmação automática D+1 pelo backup

**What to build:** ao abrir um mês do Calendário, o sistema lê no backup do apLIS os lotes enviados daquele mês e os casa com os Agendamentos de envio. Um agendamento que ninguém marcou passa a "enviado" sozinho, com a data do lote; um já marcado à mão ganha o selo **"confirmado no apLIS"** e mantém a data informada. Lotes que não casam aparecem na lista **"Envios não planejados"**, só informativa. Regras de casamento na spec.

**Blocked by:** 02 (Calendário com Hoje/Amanhã e marcação de envio).

**Status:** done

- [x] Levantar no banco do lab os ids de fonte pagadora de cada Regra de envio (incluindo os membros dos agrupadores AMHPDF) e gravá-los nas regras; registrar no fim desta issue as linhas sem correspondência.
- [x] Leitura no backup dos lotes do mês com os status considerados "enviados" (os mesmos da aba Envios de Contas a Receber), com fonte pagadora e `DtaEnvio`.
- [x] Casamento no módulo de domínio, com testes: pendente mais próximo de D dentro da janela, lote fora da janela vai para não planejados, no máximo um lote por agendamento, marcado à mão só ganha selo, agrupador casa pelos membros.
- [x] O GET do mês aplica o casamento e grava as confirmações de forma idempotente (rodar duas vezes não muda nada); histórico "confirmou_aplis".
- [x] Selo "confirmado no apLIS" no painel, na grade e no detalhe; lista "Envios não planejados" na tela.
- [x] Falha no backup não derruba a tela: mostra o calendário sem confirmações e um aviso.

## Levantamento das fontes pagadoras (28/10/2026)

Ids gravados por `supabase/migrations/20261028190000_fat_envio_confirmacao_aplis.sql`, levantados no backup (fontes com lote em 2025–2026; variantes inativas e sem lote ficaram de fora).

**Os membros dos agrupadores AMHPDF não são fontes pagadoras.** As fontes AFEB, SERPRO, BACEN, CASEMBRAPA etc. de `fatinstituicao` estão inativas e sem lote desde 2025. No apLIS, eles são **convênios** (`fatconvenio.IdConvenio`, em `requisicao.IdConvenio`) da fonte AMHP-DF (1025), com um convênio por lote. Por isso a regra ganhou `convenios_aplis`: o agrupador recebe os lotes da fonte 1025 cujos convênios são membros dele, e a regra "AMHP" (só a fonte) fica com os lotes de AMHP-DF que nenhum agrupador cobre (REAL GRANDEZA, CAMED, STF…). A edição de `convenios_aplis` ainda não está no modal de regras: hoje só a migration grava.

**Linhas sem correspondência:** nenhuma ficou sem id. Ressalvas:

- **AMPLA** → AMPLA SAÚDE (1362), que ainda não tem nenhum lote no backup.
- **BACEN** está em "AMHP – BACEN" e também nos membros de "AMHPDF – Online", como na planilha. O lote vai para o agendamento pendente mais próximo das duas regras. Vale decidir em qual das duas o BACEN fica.
- **AMHPDF – Online:** quase todos os lotes desses membros estão sem `DtaEnvio` no apLIS (status Faturado, mas sem data de envio). Sem a data não há como casar, então esses envios dependem da marcação manual.
- **CASSI** inclui FASCAL (1253) e CASSI-PER (1098). **GAMA** inclui as duas fontes GAMA SAÚDE (1343, inativa mas com lote em 2026, e 1344).
