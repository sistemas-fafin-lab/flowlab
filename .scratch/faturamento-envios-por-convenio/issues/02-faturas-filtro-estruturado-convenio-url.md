# 02 — FaturasDashboard: filtro estruturado por convênio + estado inicial via URL

**What to build:** a tela de Faturas (`/faturamento/faturas`,
`FaturasDashboard.tsx`) passa a poder ser filtrada por um convênio
específico de forma exata (não aproximada) e a poder abrir já com um
filtro de período e convênio pré-definidos, em vez de sempre começar do
zero com os padrões locais. Hoje ela não tem nenhuma das duas coisas: o
único jeito de filtrar por convênio é digitar um trecho do nome na busca
livre (que pode casar com nomes parecidos), e todo o estado de filtro é
`useState` local sem nenhuma sincronia com a URL.

- Filtro por convênio passa a aceitar um identificador exato de fonte
  pagadora (`IdFontePagadora`), não só texto aproximado — a busca livre
  continua existindo para os outros casos de uso da tela.
- A tela lê período e convênio iniciais de parâmetros de entrada (URL/query
  string), aplicando-os já no primeiro carregamento, sem exigir que o
  usuário refaça a seleção manualmente.
- Sem esses parâmetros, o comportamento atual da tela (padrões locais,
  filtros manuais) continua exatamente como é hoje — isso é aditivo, não
  troca nada pra quem acessa a rota direto.

Testável isoladamente montando a URL com os parâmetros e conferindo que a
lista carrega já filtrada — não depende de nenhuma outra tela apontar pra
cá ainda.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] É possível filtrar a lista de lotes por um convênio específico de
      forma exata (por id), sem depender de correspondência aproximada de
      texto
- [ ] A tela aceita período e convênio iniciais via parâmetro de
      entrada (query string) e já carrega filtrada por eles no primeiro
      render
- [ ] Acessar a rota sem esses parâmetros mantém o comportamento atual
      (período padrão local, sem filtro de convênio, busca livre como está)
- [ ] O filtro de busca livre existente continua funcionando normalmente,
      sem regressão
