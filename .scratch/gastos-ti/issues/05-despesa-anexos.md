# 05 — Despesa: anexos

**What to build:** no painel e no formulário da despesa, o usuário anexa contrato,
proposta ou o e-mail de autorização (PDF, PNG, JPEG até 10 MB) e baixa depois. Os
arquivos ficam num bucket **privado** e só abrem por URL assinada. A mesma
infraestrutura serve depois aos comprovantes de pagamento (06).

Plano: §4.2 (storage), RF09, RNF01. Padrão: `src/modules/rh/holeritesStorage.ts` e
`supabase/migrations/20260916120000_rh_holerites.sql` §3.

**Blocked by:** 03

**Status:** done (migration gerada, ainda não aplicada; upload real não testado)

- [x] Migration: bucket privado `ti-gastos-anexos` com policies por `canViewGastosTI`/`canManageGastosTI`.
- [x] `storage.ts` do módulo: upload, remoção e URL assinada.
- [x] `ti_despesas.anexos` guarda `[{path, nome, tamanho, tipo, enviado_em}]`; anexar e remover entram na auditoria (o UPDATE do jsonb passa pelo trigger de `ti_despesas`).
- [x] Validação de tipo e tamanho antes do upload, com mensagem clara.
- [x] Verificado no PGlite: as policies de `storage.objects` recusam leitura e envio sem as chaves. Fica para conferir no Supabase real que o arquivo não abre sem URL assinada.
- [x] `npx tsc --noEmit`, `npm run lint` e `npm test` sem erros novos.

## Comments

**01/Out/2026 — implementado.**

**Migration:** `supabase/migrations/20261009150000_gastos_ti_anexos.sql`.
- Bucket `ti-gastos-anexos`: privado, 10 MB, PDF/PNG/JPEG.
- 4 policies em `storage.objects`: SELECT para quem tem view ou manage; INSERT, UPDATE e DELETE só para manage.
- O comentário da coluna `anexos` na migration 03 foi atualizado para o formato gravado. Ela também ainda não foi aplicada.

**Teste da migration (PGlite, com stub de `storage.buckets`/`storage.objects` e a RLS ligada como no Supabase):** 15 de 15 verificações passaram.
- Bucket privado com os limites certos, sem duplicar na reaplicação.
- Quem gerencia envia, lê e remove.
- Quem visualiza lê, mas não envia nem remove.
- Sem chave, ou com chave de outro módulo, não lê nem envia.
- As policies novas não liberam outro bucket.
- Os 4 testes de migration juntos somam 102 verificações, todas passando.

**Frontend:**
- `domain/anexos.ts`, com 7 testes: validação de tipo e tamanho, nome seguro para o storage (sem acento, até 80 caracteres preservando a extensão), caminho `despesas/<id>/<uuid>-<nome>` e tamanho legível.
- `storage.ts`: um arquivo ruim não impede os outros, e `removerArquivos` só registra falha no console.
- `useDespesasTI`:
  - `criarDespesa` agora devolve o id.
  - `adicionarAnexos` relê o jsonb do banco antes de gravar, para dois usuários não apagarem o anexo um do outro. Se o vínculo falhar, remove os arquivos que subiram, para não deixar órfãos.
  - `removerAnexo` faz o mesmo.
- `AnexosSecao` no painel da despesa:
  - "Abrir" abre a aba já no clique, antes de buscar a URL assinada, para o navegador não bloquear como pop-up.
  - Remover pede confirmação em dois cliques.
  - A seção é reaproveitável pelos comprovantes da issue 06.
- `CampoArquivos` no formulário, no bloco "Autorização": os arquivos sobem depois que a despesa é gravada. Se algum falhar, o formulário fecha mesmo assim, porque salvar de novo duplicaria a despesa, e um aviso na página manda anexar pelo painel.

**Verificação:**
- `npm test`: 66 arquivos, 691 testes passando.
- `tsc`: nenhum erro em `gastos-ti`.
- `eslint` limpo no módulo.
- Build do Vite: ok.

**Não verificado:** upload, abertura e remoção reais no Supabase Storage. O bucket ainda não existe em nenhum ambiente.
