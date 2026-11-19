# 05: Fechamento e reabertura do relatório de EPI por área

**What to build:** quem tem "Fechar relatórios de EPI" fecha o Relatório mensal de EPI de uma área num mês: as linhas ficam congeladas e o PDF passa a sair desse conteúdo, mesmo que solicitações ou produtos mudem depois. Para corrigir, reabre informando um motivo obrigatório; fica registrado quem fechou, quem reabriu, quando e por quê. A lista de áreas mostra a situação aberto/fechado. Spec: `.scratch/epi-relatorio-mensal/spec.md` (histórias 33–36; Situação de uma área no mês; Esquema → Fechamento e Histórico de reaberturas).

**Blocked by:** 04 (Aba EPIs na Qualidade e relatório por área).

**Status:** ready-for-agent

- [x] Nova chave "Fechar relatórios de EPI" (`canCloseEpiReport`).
- [x] Migration: tabela de fechamento por (área, mês), única por par, com situação, linhas congeladas, quem fechou e quando; tabela de histórico de reaberturas com motivo, quem e quando; RLS por `canViewEpiReport` (leitura) e `canCloseEpiReport` (escrita).
- [x] Domínio: regras de transição (fechar: aberto→fechado; reabrir: fechado/assinado→aberto com motivo obrigatório); transições inválidas recusadas.
- [x] Botões "Fechar" e "Reabrir" (com campo de motivo) só para quem tem `canCloseEpiReport`.
- [x] Área fechada: o PDF sai das linhas congeladas; alterar uma solicitação ou produto não muda o PDF.
- [x] Área reaberta: volta a calcular na hora; ao fechar de novo, congela o conteúdo atual.
- [x] A tela mostra o histórico de fechamento e reaberturas da área.
- [x] Testes do domínio cobrem cada transição válida e inválida, incluindo reabrir sem motivo.

## Comments

**Implementação (2026-11-19).** Migration `20261119120000_epi_relatorio_fechamento.sql`; domínio em `src/modules/qualidade/domain/epiRelatorioMensal.ts` (`transicaoFechamentoEpi`, `linhasDoRelatorioEpi`, `historicoFechamentoEpi`, `listarAreasEpiDoMes` com fechamentos).

Decisões que a issue 06 precisa seguir:
- **Escrita só por RPC.** As tabelas têm RLS apenas de leitura (`canViewEpiReport` ou `canCloseEpiReport`); fechar e reabrir passam por `epi_fechar_relatorio` / `epi_reabrir_relatorio` (SECURITY DEFINER, conferem `canCloseEpiReport` e a transição com a linha travada, erro PT409). Escrita direta é recusada, e o histórico não se apaga. O anexo deve seguir o mesmo padrão (`epi_anexar_relatorio`, de fechado/assinado → assinado).
- **Um registro por (área, mês), reaproveitado ao fechar de novo.** Anexos ligados por `fechamento_id` de um fechamento anterior continuam ligados ao mesmo registro: o "fechamento atual" de um anexo se distingue por `enviado_em >= fechado_em`. Reabrir põe a situação em aberto, então "assinado" só volta com um anexo novo.
- **Linhas congeladas vêm da tela.** O fechamento busca os dados de novo (sem cache) e envia as linhas calculadas pelo domínio; o banco guarda o array que recebe.
