# 06: Leitura do pedido médico por IA

**What to build:** o atendente envia fotos ou PDFs do pedido médico (até 5 arquivos, até 10MB cada), a IA identifica os exames e os liga aos exames da lista de preços, o atendente revisa os reconhecidos e os sem correspondência e adiciona ao carrinho. Fluxo igual ao do envio ao apoio do flowlab: o navegador sobe os arquivos direto num bucket privado novo e manda ao servidor só os caminhos (evita o limite de corpo da Vercel); o servidor chama o Gemini pelo `@google/genai` com o prompt versionado no repositório e **apaga os arquivos** ao terminar, com sucesso ou falha. Sem Google Drive.

Ver `.scratch/gerador-orcamento/spec.md` → histórias 37–42 e "Leitura do pedido médico por IA (fase 2)".

**Blocked by:** 02 — Gerador de Orçamento: busca e carrinho

**Status:** ready-for-human — código pronto (20/Out/2026); falta o responsável confirmar o prompt contra o `prompt.txt` do Drive, aplicar em produção a migration `20261020200000_gerador_orcamento_pedidos_medicos_bucket.sql` (já aplicada no teste em 20/Out), configurar `GEMINI_API_KEY` na Vercel e conferir um pedido real

- [x] Migration do bucket privado temporário, com policy de upload para autenticados com `canUseGeradorOrcamento`
- [ ] Prompt da IA trazido da Tabela-Particular para o repositório (o conteúdo atual está no `prompt.txt` do Drive; a cópia local `lib/prompt.txt` da Tabela-Particular serve de ponto de partida — confirmar com o responsável se está em dia)
- [x] Endpoint de análise autenticado pela sessão (401/403 como os demais), validando os caminhos (1 a 5, sem vazio, sem `..`), baixando com service role e chamando o Gemini (`GEMINI_API_KEY`, `GEMINI_MODEL` opcional)
- [x] Arquivos apagados do bucket ao fim da análise, também quando o Gemini falha ou estoura o tempo
- [x] Leitura do texto da IA e casamento com a lista de preços portados das regras puras da Tabela-Particular, com os testes portados
- [x] Janela de envio na tela com validação de quantidade, tamanho e tipo; mensagens claras para arquivo grande, arquivos demais, demora e falha
- [x] Revisão do resultado mostrando reconhecidos e sem correspondência antes de adicionar ao carrinho
- [x] Testes do handler com Gemini e Storage falsos, incluindo a limpeza do bucket na falha

**Prompt:** `api/_lib/atendimento/promptPedidoMedico.ts` é cópia literal de `lib/prompt.txt` da Tabela-Particular, com o mesmo complemento da lista de exames que `app/api/analyze/route.ts` acrescentava. **Falta o responsável confirmar** que está igual ao `prompt.txt` do Drive (por isso o item segue aberto). A Tabela-Particular também tem um `lib/prompt-novo.txt`, mais detalhado (marcações em formulários, "não invente correspondências"), que não foi usado. Os dois prompts falam em lista "MNEMONICO - DESCRIÇÃO", mas a lista enviada (lá e aqui) tem só o nome do exame. Vale ajustar o texto quando o prompt for revisado.

**Desvios deliberados da Tabela-Particular:**
- O casamento roda no servidor, sobre a lista de preços sem custo. A resposta traz `{ tuss, nome }` de cada item, e a tela liga isso aos exames que já carregou, para o custo continuar valendo no PDF interno.
- Resposta da IA sem lista de exames vira erro 502 com mensagem, em vez de mostrar o texto bruto.
- Sem o comparativo "Total IA × Total Selecionado". Os exames reconhecidos são revisados com caixas de marcar e vão ao carrinho, onde o total já aparece.
- O mesmo exame da lista lido duas vezes no pedido aparece uma vez só.
- Os arquivos sobem em `<user id>/<uuid>/`. A policy de upload exige a pasta do próprio usuário, e o endpoint só aceita (e só apaga) paths dessa pasta.
- A policy de DELETE (só o dono do objeto) existe para a tela limpar um lote cujo upload falhou no meio.
- `vercel.json`: `api/atendimento/*.ts` com `maxDuration` 60. O tempo-limite do Gemini é 40s (resposta 504) e o do navegador é 60s.

**Lacuna conhecida:** se a aba fecha ou a rede cai entre o upload e a chamada da análise, os arquivos ficam no bucket. O envio ao apoio tem a mesma lacuna. Uma limpeza periódica do bucket resolveria.
