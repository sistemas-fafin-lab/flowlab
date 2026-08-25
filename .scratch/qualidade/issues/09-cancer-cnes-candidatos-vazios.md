Status: done
Type: bug

# Registro de Câncer: CNES e "candidatos" sempre vazios — qa_parametros/qa_cido_catalogo nunca foram semeados

## Onde

Reportado pelo usuário: na worklist de Registro de Câncer, a coluna CNES e a
coluna "Candidatura" (candidatos) sempre vêm vazias em produção.

## Causa raiz

`20260820120000_qualidade_piloto.sql` criou `qa_parametros` e
`qa_cido_catalogo`, mas nenhuma migration deste repositório nunca inseriu
uma linha sequer nelas (confirmado por busca em todo `supabase/migrations/`).

- **CNES**: vem de `qa_parametros` (`cancer.cnes`) via
  `carregarParametrosFixosCancer`/`buscarParametrosFixosCancer` — sem a
  linha, sempre `''`. Além disso `cnes` tinha sido deixado de fora de
  `CHAVES_PARAMETRO_FIXO_CANCER` (`types.ts`) "de propósito, pra ter sua
  própria edição depois" — só que essa edição própria nunca foi construída,
  então não existia NENHUM jeito de configurar o CNES pelo app.
- **Candidatos**: a coluna usa `avaliarCandidaturaCancer` (`cancerRegras.ts`),
  que compara o laudo/código do LIS contra `qa_cido_catalogo` (catálogo
  CID-O). Catálogo vazio → toda comparação falha → todo caso sai
  `candidato: false`. Efeito colateral mais sério: `salvarClassificacaoCancer`
  também valida contra esse catálogo (`validarCodigoCido`) — com ele vazio,
  **classificar qualquer caso como câncer confirmado estava impossível** em
  produção, não só a exibição da coluna.

## Correção

- `types.ts`/`CampoParametroFixo.tsx`: `cnes` entrou em
  `CHAVES_PARAMETRO_FIXO_CANCER`/`ROTULOS_PARAMETRO_FIXO`/
  `ORDEM_PARAMETRO_FIXO`/`valorDoParametroFixo` — agora editável pelo drawer,
  igual aos outros 15 campos fixos.
- Migration `20260825130000_qualidade_cancer_seed_parametros_cido.sql`:
  - `qa_parametros`: semeia as 16 chaves `cancer.*`. `cancer.cnes = '3744221'`
    — achado no MySQL de backup (`fatinstituicao.IdInstituicao = 1`, o
    próprio laboratório: CNPJ 00.421.800/0001-86, Local=1, Inativo=0) e
    **confirmado com o usuário**. Os outros 15 entram como placeholder vazio
    (só pra existirem — `atualizarParametroFixoCancer` recusa criar chave
    nova) até alguém do laboratório preencher pela tela.
  - `qa_cido_catalogo`: semeado a partir das tabelas `diagnostico` (167
    códigos de morfologia, `Positivo=1 AND CodInternacional LIKE 'M-%'` —
    formato bate com CID-O-3 morfologia sem a barra) e `topografia` (1.125
    códigos, `CodInternacional` casando `^T-[0-9X]{5}$`, 370 linhas
    descartadas por não seguirem esse padrão — texto livre/digitação
    legada). Dedup determinístico por menor id quando o código repete com
    descrições sinônimas.

## ⚠️ Ponto em aberto — formato do código de topografia

`topografia.CodInternacional` usa o eixo de Topografia do **SNOMED**
(`T-XXXXX`, convenção interna do LIS), **não** o código CID-O-3 de
topografia oficial (`CXX.X`) que o layout do RHC costuma exigir. A
exportação (`qualidade-gerar-exportacao-cancer.ts`) escreve
`cido_topografia_codigo` literalmente como está salvo, sem nenhuma
conversão. Decisão do usuário (25/08): importar assim mesmo pra destravar a
funcionalidade agora. **Antes da primeira exportação real ao RHC, confirmar
com quem faz a submissão se `T-XXXXX` é aceito nesse campo ou se precisa de
conversão SNOMED→CID-O.** Morfologia não tem esse problema (formato já bate
com CID-O-3).

## Comments

Depois de aplicar a migration em produção, abrir `/qualidade/cancer`, um
caso qualquer, e conferir: CNES aparece na tabela e é editável no drawer;
casos com laudo batendo morfologia aparecem com badge de candidatura.
