# 01: Registrar a NF anterior como cancelada ao trocar o número

**What to build:** na edição de um título que já tem número de nota, quando o operador digita outro número, o formulário pede uma escolha: "NF anterior cancelada" ou "Correção de digitação". Na primeira opção, o motivo é obrigatório e a data do cancelamento vem com hoje, podendo ser editada. Ao salvar, a NF anterior entra no histórico de NFs canceladas do título e o número novo é gravado, numa única transação. Na correção de digitação, o número é trocado como hoje e nada entra no histórico. Quando o número está vazio, o formulário é o de hoje. Regras em `.scratch/faturamento-nf-cancelada/spec.md`.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] Nova tabela de NFs canceladas, no molde das auditorias do Contas a Receber.
  - Append-only.
  - RLS de leitura para quem vê ou gere o faturamento.
  - Sem policy de INSERT, UPDATE ou DELETE: a escrita é só por RPC `SECURITY DEFINER`.
  - Campos:
    - título (opcional, `ON DELETE SET NULL`);
    - operadora (obrigatória);
    - número da NF;
    - valor (opcional);
    - data de emissão (opcional);
    - data do cancelamento;
    - motivo (obrigatório, não vazio);
    - origem (`edicao` ou `planilha`);
    - quem registrou (id e nome) e quando.
  - Índice pelo número da NF e pelo título.
  - Número único por operadora.
- [x] `fat_atualizar_numero_nota` ganha o modo de cancelamento (flag, motivo, data). Numa única transação, ela:
  - valida que o título existe;
  - valida que o título não está cancelado;
  - valida que o título já tem número;
  - valida que o número novo é diferente do atual;
  - valida que o número novo não é uma NF cancelada do mesmo título;
  - valida que o motivo não está vazio;
  - grava a NF anterior, com valor e emissão vindos do título;
  - troca o número.
- [x] Sem a flag, o comportamento da RPC não muda, inclusive no modo `somenteSeVazio` do "Atualizar do apLIS".
- [x] Se a assinatura da RPC mudar, usar DROP + CREATE, como em `20260930180000_fat_atualizar_numero_nota_somente_se_vazio`. Aplicar a migration antes do deploy do código.
- [x] A escrita exige `canManageBilling` (via `fat_exigir_permissao_gestao`).
- [x] A rota `titulo-atualizar-numero-nota` aceita os campos opcionais do cancelamento e os repassa à RPC. Os erros de validação voltam com a mensagem da RPC. Não é criada rota nova.
- [x] Tela de edição:
  - a escolha aparece só quando já existe número e o operador digita outro;
  - "NF anterior cancelada" exige o motivo e mostra a data;
  - o primeiro preenchimento continua num passo só.
- [x] Testes do handler, com Supabase mockado, seguindo o teste que já existe:
  - os campos de cancelamento chegam à RPC;
  - a chamada sem os campos novos continua igual, inclusive com `somenteSeVazio`;
  - um erro de validação da RPC volta como erro legível;
  - sem permissão, a resposta é recusada.
- [x] Roteiro SQL de verificação junto da migration. Ele confere que:
  - título cancelado é recusado;
  - motivo vazio é recusado;
  - número igual ao atual é recusado;
  - número já cancelado no título é recusado;
  - histórico e troca acontecem juntos.
- [x] O termo "NF cancelada" entra no glossário `CONTEXT.md`, seção Faturamento, distinto de "título cancelado".
- [ ] Conferência manual no app: trocar a NF de um título de teste com "NF anterior cancelada" e ver o registro no banco.
