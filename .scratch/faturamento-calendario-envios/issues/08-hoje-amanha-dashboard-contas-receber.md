# 08: Hoje/Amanhã no Dashboard de Contas a Receber

**What to build:** no topo da aba Dashboard de Contas a Receber aparecem os painéis compactos **Hoje** e **Amanhã** do Calendário de envios, com as cores de status e a quantidade de atrasados, e um link para o Calendário. Quem tem `canManageCalendarioEnvios` marca o envio dali mesmo. Só aparece para quem pode ver o Calendário.

**Blocked by:** 03 (Atrasos: classificação, bloco Atrasados e contador no menu).

**Status:** done

- [x] Painéis compactos reaproveitam os componentes e o GET do Calendário (sem lógica duplicada).
- [x] Visíveis só com `canViewBilling` ou `canViewCalendarioEnvios`; marcação só com `canManageCalendarioEnvios`.
- [x] Indicador de atrasados com link para o bloco Atrasados do Calendário.
- [x] Não atrasa o carregamento do dashboard (carregam à parte, com o próprio estado de loading).
