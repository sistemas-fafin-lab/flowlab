## 1. Pré-requisito

- [x] 1.1 Confirmar que `rh-ficha-colaborador` e `rh-meu-perfil` estão implementadas

## 2. Banco

- [x] 2.1 Migration `<timestamp>_rh_solicitacao_alteracao.sql`: tabela `colaborador_solicitacoes_alteracao` (D1), índice único parcial de pendente, RLS de SELECT (D3)
- [x] 2.2 RPC `rh_solicitar_alteracao` (campos permitidos, diff real, `de` recalculado, validação de domínio, notificação ao RH)
- [x] 2.3 RPC `rh_cancelar_solicitacao`
- [x] 2.4 RPC `rh_decidir_solicitacao` (permissão, `FOR UPDATE`, trava de status, upsert dos dados pessoais, notificação ao colaborador)
- [x] 2.5 RPC `rh_dispensar_resultado`
- [x] 2.6 Aplicar no dev e validar: segunda pendente rejeitada; campo `cpf` rejeitado; colaborador não decide; decisão em solicitação cancelada rejeitada; notificações criadas (validado com o usuário RH/colaborador; "colaborador não decide" e notificações pendentes — exigem um segundo login, pois quem age não é notificado)

## 3. Dados

- [x] 3.1 `types.ts`: `SolicitacaoAlteracao`, `AlteracaoCampo`, status
- [x] 3.2 `utils/solicitacaoAlteracao.ts`: `calcularAlteracoes(atuais, editados)` e formatação "antes → depois" com rótulos — com testes Vitest
- [x] 3.3 `hooks/useSolicitacaoAlteracao.ts` (D5)
- [x] 3.4 Flag de pendência por colaborador — feito em `hooks/useSolicitacoesPendentes.ts` (consulta à parte; `useColaboradores` também serve a tela de holerites)

## 4. Meu perfil (colaborador)

- [x] 4.1 Modo edição na aba Dados pessoais: inputs, nome/CPF com cadeado, marcação "Alterado", rodapé com contagem, Cancelar e "Enviar para aprovação"
- [x] 4.2 Banner "Alteração em análise pelo RH" + "Em análise: X" por campo + "Cancelar solicitação" + indicador na aba + Editar desabilitado
- [x] 4.3 Banner de resultado (aprovada/recusada com motivo) dispensável
- [x] 4.4 Estado de erro de envio com "Tentar novamente"

## 5. RH

- [x] 5.1 `ColaboradorDetalheModal`: banner de pendência na seção Dados pessoais com Aprovar/Recusar (motivo opcional, Voltar/Confirmar recusa), alerta de "valor atual mudou", indicador na aba; ações só com `canManageColaboradores`
- [x] 5.2 `ColaboradoresPage`: badge "Alteração pendente" (tabela; a lista não tem cards mobile) e abrir modal via `?colaborador=<id>`

## 6. Verificação

- [x] 6.1 `npm test` e build sem erros
- [ ] 6.2 Navegador, ponta a ponta com dois usuários (feito com um usuário que é RH e colaborador: enviar, cancelar, reenviar, aprovar, recusar com motivo, dispensar, badge, link `?colaborador=`, mobile e tema claro; falta o sino e o segundo usuário) (colaborador e RH): enviar, cancelar, reenviar, aprovar, recusar com motivo, dispensar resultado, notificações no sino; desktop e mobile, claro e escuro
