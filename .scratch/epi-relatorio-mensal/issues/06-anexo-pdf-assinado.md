# 06: Anexo do PDF assinado do relatório de EPI

**What to build:** com a área fechada, quem tem "Fechar relatórios de EPI" anexa o PDF assinado e digitalizado; a área passa para "assinado". Novos anexos não apagam os anteriores, e quem tem "Ver relatórios de EPI" abre qualquer PDF assinado, de qualquer área e mês, para consulta e auditoria. Spec: `.scratch/epi-relatorio-mensal/spec.md` (histórias 37–42; Situação de uma área no mês; Esquema → Anexos assinados e armazenamento privado).

**Blocked by:** 05 (Fechamento e reabertura do relatório de EPI por área).

**Status:** ready-for-agent

- [x] Migration: armazenamento privado novo, só PDF, com políticas por `canViewEpiReport` (leitura) e `canCloseEpiReport` (envio); tabela de anexos ligada ao fechamento, com caminho, quem enviou e quando; nenhum delete exposto.
- [x] Domínio: transição "anexar" aceita só a partir de fechado ou assinado e leva a assinado; recusada com a área aberta.
- [x] Botão "Anexar assinado" só com a área fechada/assinada e a permissão de fechar; aceita só PDF.
- [x] "Ver assinado" abre o anexo mais recente; o histórico lista todos os anexos com quem enviou e quando.
- [x] Reabrir uma área assinada volta a situação para aberto, mas os anexos anteriores continuam no histórico.
- [x] Testes do domínio cobrem anexar com área aberta (recusado), fechada e já assinada.

## Comments

**Implementação (2026-11-19).** Migration `20261119140000_epi_relatorio_anexos.sql`: bucket privado `epi-relatorios-assinados` (só PDF, 20 MB; leitura por `canViewEpiReport`/`canCloseEpiReport`, envio por `canCloseEpiReport` só na pasta de um fechamento não aberto; sem UPDATE/DELETE), tabela `epi_relatorio_anexos` (só leitura pela RLS) e RPC `epi_anexar_relatorio` (SECURITY DEFINER; confere permissão, transição com a linha travada (PT409), pasta do fechamento e que o arquivo existe e foi enviado pelo usuário da sessão). Domínio: `transicaoFechamentoEpi` com `anexar`, `historicoFechamentoEpi` com anexos, `anexoMaisRecenteEpi`, `validarPdfAssinadoEpi`.

Limitação conhecida: se a área for reaberta entre o envio do arquivo e a RPC, o PDF fica no bucket sem registro (não há delete exposto); limpeza manual.
