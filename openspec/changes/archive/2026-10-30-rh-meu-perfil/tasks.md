## 1. Pré-requisito

- [x] 1.1 Confirmar que `rh-ficha-colaborador` está implementada (tabela `colaborador_dados_pessoais`, `ColaboradorResumoCard`, `RecibosPagamentoLista`)

## 2. Banco

- [x] 2.1 Migration `<timestamp>_rh_meu_perfil.sql`: RPC `rh_meu_perfil()` `SECURITY DEFINER`, `search_path` fixo, filtrando por `auth.uid()`, retornando a linha do colaborador + `gestor_nome` + `departamento_nome` (D3)
- [x] 2.2 Aplicar no dev e validar que a RPC devolve só o próprio registro (validado com o usuário logado; teste com um segundo usuário pendente — exige outro login)

## 3. Dados

- [x] 3.1 `hooks/useMeuColaborador.ts` (D2): RPC + dados pessoais, com `semVinculo`
- [x] 3.2 Reaproveitar o hook de recibos da proposta 1 (`useRecibosColaborador`) sem fetch duplicado do colaborador; `useMeusHolerites` removido

## 4. Tela

- [x] 4.1 `components/MeuPerfilPage.tsx`: título, subtítulo, card sticky ≥ 940px / recolhido abaixo, abas Dados pessoais/Documentos
- [x] 4.2 Aba Dados pessoais: componente de leitura dos 4 grupos (reaproveitar o layout de `DadosPessoaisSection` em modo leitura)
- [x] 4.3 Aba Documentos: card "Recibos de pagamento" (4 mais recentes + "Ver todos (N)") e modal de lista completa com `RecibosPagamentoLista` `visao='colaborador'`; rodapé de privacidade
- [x] 4.4 Estado vazio de conta sem vínculo
- [x] 4.5 `src/App.tsx`: rota `/meu-perfil`; exportar a página em `src/modules/rh/index.ts`

## 5. Sidebar e holerites

- [x] 5.1 `Layout.tsx`: card do rodapé clicável para `/meu-perfil` (desktop e mobile), com estado ativo
- [x] 5.2 `Layout.tsx`: item RH com `anyOf` das chaves de RH e `href` `/rh/colaboradores`; subitem Holerites com `anyOf` das chaves de holerites; atualizar comentários
- [x] 5.3 `App.tsx`: `ProtectedRoute` em `/rh/holerites` com `anyOf` das chaves de holerites
- [x] 5.4 `HoleritesPage.tsx`: remover o ramo de autoatendimento; remover `MeusHoleritesSection` se não houver outro consumidor

## 6. Verificação

- [x] 6.1 `npm test` e build sem erros
- [x] 6.2 Navegador (usuário RH): Meu perfil com dados e recibos, item RH visível, Holerites funcionando, sidebar recolhida, desktop e mobile
- [ ] 6.3 Navegador com colaborador comum (sem item RH, recibos via RLS própria) e conta sem vínculo (estado vazio) — exige login com outros usuários
