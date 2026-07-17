/*
  # Fase 5 — Liga controla_consumo para Biologia Molecular (§5 / §2.7)

  Plano: docs/PLANO_FASE5_ESTOQUE_DEPARTAMENTAL.md (§5, §4.2)

  Decisão do usuário: Biologia Molecular é o setor opt-in do controle de consumo
  em 2 etapas (recebe a retirada de solicitação como TRANSFERÊNCIA e depois baixa
  o consumo real). Os demais setores seguem em baixa direta (out).

  Idempotente: reaplicar não muda nada. O CHECK ck_stock_locations_consumo_rastreavel
  já garante rastreavel=true (Biologia Molecular nasceu rastreável no seed aditivo).

  NB: só tem efeito real com o cutover aplicado + o frontend da Parte B, que
  resolve o department da solicitação para este local (processRetirada, com a
  normalização código↔rótulo).
*/

UPDATE stock_locations
   SET controla_consumo = true, updated_at = now()
 WHERE department = 'Biologia Molecular'
   AND rastreavel = true
   AND controla_consumo IS DISTINCT FROM true;
