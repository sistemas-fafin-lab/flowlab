## 1. Pré-requisito

- [ ] 1.1 Confirmar que `rh-ficha-colaborador` e `rh-meu-perfil` estão implementadas

## 2. Banco

- [ ] 2.1 Migration `<timestamp>_rh_solicitacao_alteracao.sql`: tabela `colaborador_solicitacoes_alteracao` (D1), índice único parcial de pendente, RLS de SELECT (D3)
- [ ] 2.2 RPC `rh_solicitar_alteracao` (campos permitidos, diff real, `de` recalculado, validação de domínio, notificação ao RH)
- [ ] 2.3 RPC `rh_cancelar_solicitacao`
- [ ] 2.4 RPC `rh_decidir_solicitacao` (permissão, `FOR UPDATE`, trava de status, upsert dos dados pessoais, notificação ao colaborador)
- [ ] 2.5 RPC `rh_dispensar_resultado`
- [ ] 2.6 Aplicar no dev e validar: segunda pendente rejeitada; campo `cpf` rejeitado; colaborador não decide; decisão em solicitação cancelada rejeitada; notificações criadas

## 3. Dados

- [ ] 3.1 `types.ts`: `SolicitacaoAlteracao`, `AlteracaoCampo`, status
- [ ] 3.2 `utils/solicitacaoAlteracao.ts`: `calcularAlteracoes(atuais, editados)` e formatação "antes → depois" com rótulos — com testes Vitest
- [ ] 3.3 `hooks/useSolicitacaoAlteracao.ts` (D5)
- [ ] 3.4 `useColaboradores`: flag `temSolicitacaoPendente` por colaborador

## 4. Meu perfil (colaborador)

- [ ] 4.1 Modo edição na aba Dados pessoais: inputs, nome/CPF com cadeado, marcação "Alterado", rodapé com contagem, Cancelar e "Enviar para aprovação"
- [ ] 4.2 Banner "Alteração em análise pelo RH" + "Em análise: X" por campo + "Cancelar solicitação" + indicador na aba + Editar desabilitado
- [ ] 4.3 Banner de resultado (aprovada/recusada com motivo) dispensável
- [ ] 4.4 Estado de erro de envio com "Tentar novamente"

## 5. RH

- [ ] 5.1 `ColaboradorDetalheModal`: banner de pendência na seção Dados pessoais com Aprovar/Recusar (motivo opcional, Voltar/Confirmar recusa), alerta de "valor atual mudou", indicador na aba; ações só com `canManageColaboradores`
- [ ] 5.2 `ColaboradoresPage`: badge "Alteração pendente" (tabela e cards mobile) e abrir modal via `?colaborador=<id>`

## 6. Verificação

- [ ] 6.1 `npm test` e build sem erros
- [ ] 6.2 Navegador, ponta a ponta com dois usuários (colaborador e RH): enviar, cancelar, reenviar, aprovar, recusar com motivo, dispensar resultado, notificações no sino; desktop e mobile, claro e escuro
