## 1. Pré-requisito

- [ ] 1.1 Confirmar que `rh-ficha-colaborador` está implementada (tabela `colaborador_dados_pessoais`, `ColaboradorResumoCard`, `RecibosPagamentoLista`)

## 2. Banco

- [ ] 2.1 Migration `<timestamp>_rh_meu_perfil.sql`: RPC `rh_meu_perfil()` `SECURITY DEFINER`, `search_path` fixo, filtrando por `auth.uid()`, retornando a linha do colaborador + `gestor_nome` + `departamento_nome` (D3)
- [ ] 2.2 Aplicar no dev e validar com dois usuários que cada um só recebe o próprio registro

## 3. Dados

- [ ] 3.1 `hooks/useMeuColaborador.ts` (D2): RPC + dados pessoais, com `semVinculo`
- [ ] 3.2 Reaproveitar `useMeusHolerites` (ou o hook de recibos da proposta 1) sem fetch duplicado do colaborador

## 4. Tela

- [ ] 4.1 `components/MeuPerfilPage.tsx`: título, subtítulo, card sticky ≥ 940px / recolhido abaixo, abas Dados pessoais/Documentos
- [ ] 4.2 Aba Dados pessoais: componente de leitura dos 4 grupos (reaproveitar o layout de `DadosPessoaisSection` em modo leitura)
- [ ] 4.3 Aba Documentos: card "Recibos de pagamento" (4 mais recentes + "Ver todos (N)") e modal de lista completa com `RecibosPagamentoLista` `visao='colaborador'`; rodapé de privacidade
- [ ] 4.4 Estado vazio de conta sem vínculo
- [ ] 4.5 `src/App.tsx`: rota `/meu-perfil`; exportar a página em `src/modules/rh/index.ts`

## 5. Sidebar e holerites

- [ ] 5.1 `Layout.tsx`: card do rodapé clicável para `/meu-perfil` (desktop e mobile), com estado ativo
- [ ] 5.2 `Layout.tsx`: item RH com `anyOf` das chaves de RH e `href` `/rh/colaboradores`; subitem Holerites com `anyOf` das chaves de holerites; atualizar comentários
- [ ] 5.3 `App.tsx`: `ProtectedRoute` em `/rh/holerites` com `anyOf` das chaves de holerites
- [ ] 5.4 `HoleritesPage.tsx`: remover o ramo de autoatendimento; remover `MeusHoleritesSection` se não houver outro consumidor

## 6. Verificação

- [ ] 6.1 `npm test` e build sem erros
- [ ] 6.2 Navegador: colaborador comum (sem item RH, Meu perfil com dados e recibos), conta sem vínculo (estado vazio), RH (item RH visível, Holerites funcionando), desktop e mobile, claro e escuro
