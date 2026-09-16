# 05 — Holerites: upload consolidado pelo RH (auto-split) e autoatendimento

**What to build:** a contabilidade gera um PDF consolidado da folha do mês (todos os
colaboradores, um atrás do outro — cada colaborador ocupa um bloco de páginas com seu
próprio CPF impresso). RH sobe esse PDF único numa aba nova "Holerites" dentro do módulo
de RH; o sistema quebra o PDF automaticamente por colaborador e distribui pra cada perfil.
Cada colaborador, logado com sua conta vinculada, acessa a mesma aba e vê/baixa só os
próprios documentos. Motivação: cliente de RH pediu essa prioridade explicitamente (reunião
de 16/09) — é a reclamação mais comum sobre o sistema atual da contabilidade (Domínio),
que exige login individual com CPF+senha e é instável.

Substitui a v1 anterior deste ticket (upload manual, um PDF por colaborador por vez) —
decisão tomada depois de inspecionar um holerite real de exemplo: o texto do PDF é
extraível (não é imagem escaneada) e cada página traz CPF, "Código" (matrícula na
contabilidade) e "Ref.: Mês/Ano" em texto puro, o que torna o auto-split viável sem
depender de OCR.

Escopo mínimo de propósito: resolver a dor de acesso a holerite. Fica de fora desta leva
(ver "Fora de escopo" abaixo) qualquer coisa que não seja estritamente necessária pra isso
— em especial, **sem assinatura eletrônica**.

**Blocked by:** Nenhuma pendente — 01 (schema/backfill de colaboradores) e 03
(vínculo usuário↔colaborador) já foram implementadas.

**Status:** ready-for-agent

## Schema e storage

- [ ] Migration cria tabela `colaborador_holerites`: `id`, `colaborador_id` (FK
      `colaboradores`), `competencia` (date, sempre dia 1 do mês/ano, ex. `2026-08-01` pra
      "Agosto/2026"), `arquivo_path` (referência ao objeto no storage, não URL pública),
      `uploaded_by` (FK `user_profiles`), `created_at`. Unique constraint em
      `(colaborador_id, competencia)` — reenvio da mesma competência substitui o arquivo
      anterior (upsert), não duplica.
- [ ] Bucket de storage **privado** (diferente do `request-attachments`, que é público) para
      os PDFs individuais — holerite é dado financeiro pessoal sensível, acesso só via
      signed URL de curta duração, nunca URL direta.
- [ ] RLS em `colaborador_holerites`: quem tem `canManageHolerites` tem acesso total;
      colaborador autenticado só enxerga linhas onde `colaborador_id` resolve pro seu
      próprio `user_profile_id` (join via `colaboradores.user_profile_id = auth.uid()`).

## Permissão e navegação

- [ ] Nova permission key `canManageHolerites` em `src/utils/permissions.ts`, separada de
      `canViewColaboradores` (RH pode querer restringir quem mexe com holerite
      independente de quem só visualiza/edita cadastro).
- [ ] Item "RH" da sidebar (`src/components/Layout.tsx`) deixa de ser um link único gated
      por `canViewColaboradores` e vira um item com `subItems`, no mesmo padrão já usado
      por "Qualidade": sub-aba **"Colaboradores"** (`/rh/colaboradores`, permission
      `canViewColaboradores`, comportamento inalterado) e sub-aba nova **"Holerites"**
      (`/rh/holerites`, sem gate de permissão — visível a todo usuário autenticado). O
      conteúdo da página de Holerites que muda conforme a permissão, não o acesso à aba.

## Upload consolidado com conferência (lado RH)

- [ ] Tela "Holerites" (visível só com `canManageHolerites`): RH escolhe a competência e
      sobe o PDF consolidado.
- [ ] Parsing extrai o texto de cada página (nova dependência de parsing de PDF, ex.
      `pdf-parse`), lê o CPF impresso e agrupa **páginas consecutivas que compartilham o
      mesmo CPF** em um bloco por colaborador — não assumir um número fixo de páginas por
      pessoa (o exemplo inspecionado tem 2 páginas idênticas por colaborador, mas isso não
      é garantido pra todo caso real).
- [ ] Cada bloco é casado contra `colaboradores.cpf` (normalizar pontuação antes de
      comparar) — **CPF é a única chave de matching**. O "Código" (matrícula na
      contabilidade) impresso no PDF não é usado para matching nem para backfill de
      `colaboradores.matricula` nesta leva.
- [ ] Antes de gravar qualquer coisa, mostra uma **tela de conferência**: lista de
      colaboradores identificados (nome, competência detectada a partir do "Ref.:" da
      página, indicação se já existe holerite pra essa competência e será substituído),
      CPFs do PDF que não bateram com nenhum `colaboradores.cpf`, e páginas sem CPF
      legível. RH revisa e confirma explicitamente antes de efetivar — não distribuir
      automaticamente sem esse passo (é o risco que a própria reunião levantou: colaborador
      receber holerite de outro).
- [ ] Ao confirmar: para cada bloco casado, fatia as páginas do PDF original (ex.
      `pdf-lib`) em um arquivo individual, sobe no bucket privado, faz upsert em
      `colaborador_holerites`. Blocos não casados **não bloqueiam o restante do lote** —
      ficam reportados no resultado final para tratamento manual (ex.: colaborador novo
      ainda não cadastrado em `colaboradores`).
- [ ] Após confirmar, dispara e-mail de notificação (reaproveitar infra existente em
      `api/_lib/email.ts`) só para os colaboradores casados que têm `user_profile_id`
      vinculado, avisando que um novo holerite está disponível. Sem WhatsApp nesta leva —
      `WAHAProvider` hoje está escopado só para fornecedores e a integração ainda não foi
      verificada (ação separada da reunião, fora desta issue).

## Autoatendimento (lado colaborador)

- [ ] Mesma rota `/rh/holerites`: usuário sem `canManageHolerites` vê só a lista dos
      próprios holerites (via RLS), ordenada por competência mais recente primeiro, com
      botão de download que gera signed URL sob demanda (não expõe path direto no HTML).
- [ ] Se o usuário logado não tem colaborador vinculado (`colaboradores.user_profile_id`),
      mostra estado vazio claro em vez de erro.

## Fora de escopo (fica para depois)

- Assinatura eletrônica (confirmação de recebimento/ciência do holerite).
- Outros tipos de documento (13º, férias, informe de rendimentos, adiantamento) — só
  holerite mensal por enquanto.
- Notificação por WhatsApp — depende de verificar o status da integração WAHA para uso
  interno (hoje é só pra fornecedores); ação separada, fora desta issue.
- Atalho de "últimos holerites" embutido no `ColaboradorDetalheModal.tsx` — a aba
  "Holerites" com filtro por colaborador já cobre a consulta; embutir no modal é
  melhoria de UI, não bloqueia a dor principal.
- Backfill de `colaboradores.matricula` a partir do "Código" impresso no PDF.
- Histórico de quem visualizou/baixou (auditoria de acesso).
- Campo de "data de corte" agendada para acesso de ex-colaborador — o controle de quando
  desativar o acesso continua manual, via `disabled_at` (já existente em `user_profiles`);
  RH simplesmente não desativa a conta até a janela de acesso a rescisão/IR terminar.
