# 06: Histórico das requisições

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** a cada sincronização, o FlowLab compara a foto anterior de cada requisição e de cada lote com a nova e grava eventos com data. A aba Histórico do card "Detalhes do recurso" mostra esses eventos em ordem cronológica.

**Blocked by:** 05

**Status:** done

- [x] Existe uma tabela de histórico (por requisição e por lote: data, tipo, valor anterior, valor novo, usuário quando houver), com RLS no padrão do faturamento.
- [x] Geram evento:
  - entrada em lote de recurso;
  - envio do lote;
  - mudança de status da requisição, com texto legível (por exemplo, 7 → 16 "foi para 2º recurso", 7 → 18 "glosa acatada");
  - mudança no recebido.
- [x] A primeira sincronização de uma requisição gera um único evento de "início do acompanhamento". Não há reconstrução do passado.
- [x] A aba Histórico do card mostra os eventos.
- [x] Testes do módulo de regras cobrem a geração de eventos a partir de duas fotos.
- [x] Testes do handler de sincronização confirmam a gravação dos eventos.

## Notas da implementação

- **Tabela** `glosa_recurso_historico` (migration `20261023170000`): evento da requisição tem `id_requisicao` (e o lote dela naquele momento); evento do lote tem só `id_lote_recurso`. RLS: lê quem vê o faturamento, insere quem gerencia; sem UPDATE/DELETE (auditoria). Sem FK para a foto.
- **Regras** (`recursoGlosa.ts`): `eventosDaRequisicao(anterior, nova)` gera entrada em lote, mudança de status (texto por status de destino: 7 → 16 "Foi para 2º recurso", → 18 "Glosa acatada (recebido a menor)" etc.) e mudança no recebido (centavos); sem foto anterior, só "Início do acompanhamento". `eventosDoLote(anterior, novo, { acompanhado })` gera o envio (e a troca de data de envio no apLIS); lote novo só registra o envio se juntar requisições já acompanhadas — senão é carga inicial.
- **Sincronização:** grava os eventos antes da foto. Uma falha no meio (ou duas sincronizações simultâneas) repete eventos na próxima, em vez de perdê-los — troca aceita. Data do evento = hora da sincronização; a data de envio do apLIS fica em `valor_novo` e no texto.
- **Leitura:** `GET glosas-recursos-detalhe?idRequisicao` devolve `historico`: eventos da requisição + eventos dos lotes por onde ela passou, a partir do primeiro evento dela em cada lote.
- **Aba Histórico** passa a ser a aba inicial do card.
- Requisições que já estavam na foto antes desta entrega não ganham "início do acompanhamento"; o histórico delas começa na próxima mudança.
- Migration **não testada em banco** nem aplicada no Supabase.
- Fica para o ticket 07: eventos de edição manual e supressão dos campos editados.
