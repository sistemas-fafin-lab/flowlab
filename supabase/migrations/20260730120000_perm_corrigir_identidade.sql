/*
  # Permissão `canCorrigirIdentidade` — correção de CPF/nascimento do paciente

  No LAB-HUB, CPF e data de nascimento do paciente viraram imutáveis depois que
  a conta é vinculada (trigger `trg_pacientes_identidade`, migration
  20260730120000 daquele projeto). Isso fechou o caminho pelo qual um paciente
  reescrevia o próprio CPF e puxava o laudo de outra pessoa — mas deixou sem
  saída o erro de digitação percebido depois do cadastro.

  A única saída é a RPC `corrigir_identidade_paciente`, exposta pela rota
  `POST /integracao/pacientes/:pacienteId/correcao-identidade` do LAB-HUB, no
  canal de API key. Ou seja: a correção é operação da recepção do FlowLab, e é
  esta permissão que a controla — ela libera a tela
  `/analises-clinicas/correcao-identidade` e o proxy
  `/api/analises-clinicas/corrigir-identidade`.

  Por que é uma key própria e não `canManageColetas`: nenhum dado que o sistema
  guarda prova que o CPF novo é de quem está pedindo (CPF antigo, nascimento,
  e-mail e telefone são todos coisas que o dono da conta já tem). Quem prova é o
  operador conferindo o documento físico. Dar isso a todo mundo que faz check-in
  seria dar a chave da porta que acabou de ser trancada.

  A operação também descarta o cache de laudos do paciente no LAB-HUB (as linhas
  foram buscadas nos LIS com o CPF antigo) e grava uma trilha append-only lá com
  quem autorizou e qual documento foi conferido.

  Backfill apenas do cargo de sistema "Administrador", como em
  20260729120000_perm_add_stock_depart.sql. Os demais cargos ficam a cargo do
  admin marcar em Usuários → Cargos.

  Idempotente: o merge com dedup faz reaplicar não duplicar a permissão.
*/

UPDATE custom_roles
SET permissions = (
  SELECT jsonb_agg(DISTINCT value)
  FROM jsonb_array_elements_text(
    permissions || '["canCorrigirIdentidade"]'::jsonb
  ) AS value
)
WHERE name IN ('Administrador');
