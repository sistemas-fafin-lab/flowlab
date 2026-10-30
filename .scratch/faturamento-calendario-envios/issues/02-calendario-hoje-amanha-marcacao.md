# 02: Calendário com Hoje/Amanhã e marcação de envio

**What to build:** no menu Faturamento aparece "Calendário de envios". A tela mostra os painéis **Hoje** e **Amanhã** (próximo dia útil) com os Agendamentos de envio de cada dia, e abaixo a grade do mês (segunda a sexta, feriados destacados, navegação entre meses). A faturista marca um convênio como enviado informando a data (hoje por padrão, editável), pode desmarcar, e pode criar um agendamento avulso num dia. Tudo vai para o histórico. Regras em `.scratch/faturamento-calendario-envios/spec.md`.

**Blocked by:** 01 (Permissões do Faturamento por tela).

**Status:** done

- [x] Migration: tabelas de Regras de envio, Agendamentos de envio, histórico do agendamento e feriados, com RLS (leitura com `canViewBilling` ou `canViewCalendarioEnvios`; escrita com `canManageCalendarioEnvios`).
- [x] Carga das regras da planilha (tabela da spec, FASCAL dentro da CASSI, AMHPDF Online/Física com membros, "envios sugeridos no mês" = 4 nos "todos os dias") e dos feriados nacionais e do DF de 2026 e 2027.
- [x] Módulo puro "Calendário de envios" no servidor, criado aqui com: dia útil com feriados (recebidos por parâmetro), próximo dia útil e os tipos de janela da spec. Testado em vitest.
- [x] GET do mês (agendamentos, regras, feriados) e POSTs de marcar enviado (com data), desmarcar e criar avulso; toda escrita grava o histórico com quem e quando.
- [x] Rota `/faturamento/calendario` e item de menu protegidos por `canViewBilling` ou `canViewCalendarioEnvios`; ações de escrita só aparecem com `canManageCalendarioEnvios`.
- [x] Painel "Amanhã" numa sexta mostra segunda; num dia antes de feriado pula o feriado.
- [x] Grade mensal só de segunda a sexta, feriado destacado com a descrição, enviados visualmente distintos dos pendentes.
- [x] Visual no padrão Flow LAB, com modo escuro e responsivo.
