## Context

Holerites já seguem o padrão "tabela + bucket privado + signed URL de 60 s" (`colaborador_holerites`, `colaborador-holerites`, `holeritesStorage.ts`), com policies em `storage.objects` checando permissão ou dono pela pasta `<colaborador_id>/`. Documentos assinados seguem o mesmo padrão, mas sem parsing nem envio em lote — cada documento é enviado individualmente pela ficha.

## Goals / Non-Goals

**Goals:**
- Guardar PDFs assinados por colaborador, com tipo e data de assinatura.
- Consulta pelo próprio colaborador no Meu perfil.

**Non-Goals:**
- Assinatura eletrônica, status pendente/recusado/expirado, prazo.
- Envio em lote, versionamento, notificação.

## Decisions

### D1. Modelo
`colaborador_documentos(id uuid pk, colaborador_id fk ON DELETE CASCADE, tipo text CHECK in (...lista..., 'outro'), nome_outro text, data_assinatura date CHECK <= current_date, arquivo_path text unique, nome_arquivo text, enviado_por uuid fk user_profiles, created_at)`. CHECK garantindo `nome_outro` não vazio quando `tipo = 'outro'`. Rótulos dos tipos no front (`utils/rotulosDocumentos.ts`).
- **Alternativa**: tabela de tipos — desnecessária para uma lista de 8 itens que só muda via release.

### D2. Upload direto do cliente
Caminho `<colaborador_id>/<uuid>.pdf` no bucket `colaborador-documentos` (privado, `allowed_mime_types = {application/pdf}`, `file_size_limit` 20 MB). O cliente sobe o arquivo e depois insere o registro; se o INSERT falhar, remove o arquivo (compensação no cliente).
- **Alternativa**: endpoint em `api/rh/` — só valeria se houvesse processamento do PDF; não há.

### D3. Policies
- Tabela: SELECT para `canViewColaboradores OR canManageColaboradores OR` dono via `colaboradores.user_profile_id = auth.uid()`; INSERT/DELETE para `canManageColaboradores`; sem UPDATE (corrigir = excluir e reenviar).
- Storage (`bucket_id = 'colaborador-documentos'`): SELECT com a mesma regra, usando `(storage.foldername(name))[1]::uuid` como `colaborador_id`; INSERT/DELETE para `canManageColaboradores`.

### D4. Exclusão
Remove o arquivo do storage e depois o registro. Se o storage falhar, não apaga o registro (evita registro apontando para nada) e mostra erro.

### D5. UI
Componentes em `components/documentos/`: `DocumentosAssinadosCard` (4 mais recentes + "Ver todos"), `DocumentosAssinadosLista` (modal de lista completa) e `EnviarDocumentoModal`. O card recebe `visao: 'rh' | 'colaborador'` para os textos de estado vazio e para exibir Enviar/Excluir apenas com `canManageColaboradores`. Reaproveitar o visualizador de PDF usado pelos recibos.

## Risks / Trade-offs

- [Arquivo órfão se o INSERT falhar e a compensação também] → aceitável; documentar e, se aparecer, limpar por script.
- [RH sobe documento no colaborador errado] → exclusão disponível; o modal de envio mostra o nome do colaborador em destaque.
- [Dados sensíveis (rescisão, LGPD)] → bucket privado, signed URL de 60 s, sem acesso para gestor de equipe.

## Migration Plan

Migration cria tabela, policies e bucket; deploy junto do front. Rollback: o front antigo não lê a tabela; bucket e tabela podem permanecer.

## Open Questions

- Nenhuma.
