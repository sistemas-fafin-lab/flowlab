# 03 — Linha do tempo mostra o que mudou

**What to build:** na linha do tempo da cotação, a entrada "Informações
editadas" passa a listar cada campo alterado no formato "Campo: antes →
depois", para que quem acompanha a cotação (inclusive quem já aprovou) veja
exatamente o que foi corrigido, por quem e quando. Justificativas e
descrições longas aparecem cortadas, com "ver mais" para expandir.

Ver spec: `.scratch/cotacoes-edicao-informacoes/spec.md` (Implementation
Decisions — módulo puro, linha do tempo; Testing Decisions — seam 2).

**Blocked by:** 02 — Editar informações da cotação, de ponta a ponta.

**Status:** ready-for-agent

- [ ] Módulo puro de edição de informações ganha a formatação do detalhe: rótulo do campo em português, "—" para valor vazio, prioridade e datas no formato de exibição, corte em ~120 caracteres só em textos longos — com testes vitest.
- [ ] Entradas `info_edited` na linha do tempo listam todos os campos do `details`, um por linha, com o texto formatado.
- [ ] Textos cortados têm "ver mais" que expande o valor completo.
- [ ] Entradas registradas como "Sistema (SQL)" aparecem com esse nome.
- [ ] Entradas de outras ações na linha do tempo continuam iguais.
