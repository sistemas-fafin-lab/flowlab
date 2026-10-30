## 1. Banco e permissões

- [x] 1.1 Criar migration `supabase/migrations/<timestamp>_rh_ficha_colaborador.sql`: tabela `colaborador_dados_pessoais` (PK/FK `colaborador_id` ON DELETE CASCADE, colunas de D1, CHECKs de domínio e de `data_nascimento <= current_date`, trigger de `updated_at`)
- [x] 1.2 Na mesma migration: RLS de `colaborador_dados_pessoais` (SELECT para `canViewColaboradores` ou o próprio colaborador vinculado; INSERT/UPDATE para `canManageColaboradores`; sem DELETE)
- [x] 1.3 Na mesma migration: recriar `colaboradores_update` exigindo `canManageColaboradores`
- [x] 1.4 Na mesma migration: conceder `canManageColaboradores` ao Administrador (formato `'["canManageColaboradores"]'` + `cr.id = 'a0000000-0000-0000-0000-000000000001'`) e ao cargo "RH"; comentar quais cargos perdem a edição
- [x] 1.5 `src/utils/permissions.ts`: adicionar `canManageColaboradores` no grupo RH com comentário; ajustar o comentário de `canViewColaboradores` para "somente leitura"
- [x] 1.6 `src/utils/permissions.test.ts`: registrar a chave em `CHAVES_POSTERIORES`; rodar `npm test`
- [x] 1.7 Aplicar a migration no dev e validar com um usuário só com `canViewColaboradores` que UPDATE/INSERT são negados

## 2. Tipos, rótulos e utilitários

- [x] 2.1 `types.ts`: tipo `DadosPessoais` e unions dos domínios (nacionalidade, UF, cor/raça, gênero, estado civil)
- [x] 2.2 `utils/rotulosDadosPessoais.ts`: mapas valor→rótulo e listas de opções para os selects
- [x] 2.3 `utils/colaboradorFormato.ts`: máscara de CPF, iniciais, nome curto, data dd/mm/aaaa — com testes
- [x] 2.4 `utils/recibosFiltro.ts`: normalização sem acento, casamento por nome do mês/"MM/AAAA"/ano, agrupamento por ano desc, anos disponíveis — com testes

## 3. Hooks

- [x] 3.1 `hooks/useDadosPessoais.ts`: carregar por `colaborador_id` e `salvar` via upsert, retornando `string | null`
- [x] 3.2 Hook de recibos do colaborador para o RH (`useRecibosColaborador(colaboradorId)`): busca em `colaborador_holerites` + `storage.list` da pasta para marcar `indisponivel` (D6)

## 4. Componentes

- [x] 4.1 `components/ColaboradorResumoCard.tsx` (variação B, sem remuneração/centro de custo/atalho), responsivo com "Ver resumo completo" em tela estreita
- [x] 4.2 `components/recibos/RecibosPagamentoLista.tsx` extraído de `MeusHoleritesSection`, com `visao: 'rh' | 'colaborador'`, busca, filtro de ano, Visualizar/Baixar e estado indisponível; `MeusHoleritesSection` passa a usá-lo sem mudar o comportamento atual
- [x] 4.3 `sections/DadosPessoaisSection.tsx`: 4 grupos (Identificação, Naturalidade, Informações pessoais, Filiação), nome e CPF com cadeado, validação de data de nascimento, Editar/Cancelar/Salvar
- [x] 4.4 `sections/EditarCadastroSection.tsx`: modo explícito Editar/Cancelar/Salvar, status e data de desligamento somente leitura, e-mail com cadeado, gate por `podeGerenciar`
- [x] 4.5 `sections/VinculoUsuarioSection.tsx` e `GestorSection.tsx`: gate por `podeGerenciar` e respeitar `bloqueada`
- [x] 4.6 `ColaboradorDetalheModal.tsx`: novo layout (cabeçalho, coluna do card, abas Dados pessoais/Documentos), coordenação `secaoEmEdicao` (D4), aba Documentos só com permissão de holerites, tela cheia < 760px

## 5. Verificação

- [x] 5.1 `npm test` e `npm run build` (ou `tsc`) sem erros
- [x] 5.2 Testar no navegador com perfil RH (edita tudo) e com perfil só-visualização (sem ações), em desktop e mobile, tema claro e escuro
- [ ] 5.3 Conferir que `/rh/holerites` (Meus holerites) continua funcionando após a extração da lista — pendente: não há holerites no banco e o usuário de teste vê a visão de gestão
- [x] 5.4 Conferir o modal em largura de celular (< 768px)
