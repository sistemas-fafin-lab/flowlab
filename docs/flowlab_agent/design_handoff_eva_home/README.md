# Handoff: Homepage de TI com a EVA (agente de IA)

## Visão geral
Esta é a nova homepage do módulo **Tecnologia** do FlowLab, na rota `/it/inicio`. É um dashboard central das demandas de TI, acompanhado pela **EVA**, o agente de IA. A EVA:
- comenta direto em cada bloco (insights inline com uma ação);
- cobra tasks atrasadas pelo WhatsApp (Wa-ha);
- lê os resumos de reunião do Granola via API;
- responde perguntas num drawer de chat.

O visual segue o FlowLab (cards de vidro do Hub de Aplicações), e a identidade da EVA é inspirada na Siri: orb animado, borda cônica colorida girando e brilho nas bordas da tela enquanto ela responde.

## Sobre os arquivos
- `prototype/TI Inicio EVA (standalone).html` é a **referência visual** validada com o usuário, num arquivo único que abre offline. Ela traz modo claro/escuro (botão de lua/sol no topo da barra lateral), ditado por voz e a barra flutuante. Não vai para produção.
- `src/modules/eva/` é a **implementação React** já no padrão do repositório: React 18 + TS 5.6 + Tailwind 3.4 + lucide-react 0.263 + framer-motion 12. Copie a pasta para `flowlab/src/modules/eva/`.

**Fidelidade:** alta (hi-fi). As classes Tailwind reproduzem 1:1 os valores do protótipo: cores, raios, sombras, tamanhos e animações.

---

## Integração (3 passos)

### 1. Copiar o módulo
```
flowlab/src/modules/eva/   ← conteúdo de src/modules/eva/ deste pacote
```
Opcional: em `src/modules/index.ts`, adicionar `export * from './eva';`.

### 2. Rota — `src/App.tsx`
```tsx
import { EvaHomePage } from './modules/eva';
// ...junto das rotas do módulo de TI:
<Route
  path="/it/inicio"
  element={
    <ProtectedRoute permission="canManageIT" permissions={userPermissions}>
      <EvaHomePage />
    </ProtectedRoute>
  }
/>
```

### 3. Menu — `src/components/Layout.tsx`
**a) Item Tecnologia.** Apontar o item pai para a nova home e incluir "Início" como primeiro subitem:
```tsx
{
  name: 'Tecnologia',
  href: canManageIT ? '/it/inicio' : '/it/gastos',
  icon: Server,
  anyOf: ['canManageIT', 'canViewGastosTI', 'canManageGastosTI'],
  category: 'TECNOLOGIA',
  subItems: [
    { name: 'Início', href: '/it/inicio', icon: Sparkles, permission: 'canManageIT', badge: 'EVA' },
    { name: 'Hub de Aplicações', href: '/it/dashboard', icon: Server, permission: 'canManageIT' },
    // ...Board, Mind Map, Gastos de TI (sem mudança)
  ],
},
```
Importar `Sparkles` de `lucide-react`.

**b) Expandir o grupo Tecnologia na rota nova.** Em `expandedItems` (estado inicial), incluir `'/it/inicio'` na lista de rotas que abrem "Tecnologia".

**c) Pill "EVA" no subitem.** Adicionar `badge?: string` em `NavigationItem` e, no `<Link>` de subitem do modo expandido, trocar `{subItem.name}` por:
```tsx
<span className="inline-flex items-center gap-2">
  {subItem.name}
  {subItem.badge && (
    <span className="text-[10px] font-bold tracking-wider px-1.5 py-px rounded-full text-white bg-gradient-to-r from-blue-500 to-violet-500">
      {subItem.badge}
    </span>
  )}
</span>
```
O `Link` atual usa `block`. Para alinhar a pill, use `flex items-center` nele.

---

## Arquitetura

```
src/modules/eva/
├── index.ts                     exports públicos
├── types.ts                     tipos de domínio (snapshot, insights, fila Wa-ha…)
├── constants.ts                 cores/rótulos do kanban (iguais ao ITProjectDashboard), prioridades, status
├── mocks.ts                     dados de exemplo (visões Equipe e Minha visão)
├── domain/chatReplies.ts        respostas fixas do chat + helpers de data (pt-BR)
├── services/evaService.ts       PONTO ÚNICO de integração com o backend (hoje: mocks)
├── hooks/
│   ├── useEvaHome.ts            estado da página: visão, filtro, cobranças, tasks, insights aceitos
│   ├── useEvaChat.ts            estado do chat: aberto, "pensando", mensagens, ask()
│   ├── useVoiceInput.ts         ditado por voz pt-BR (Web Speech API), mensagens de erro
│   └── useScrolledPast.ts       IntersectionObserver: detecta quando o campo do hero saiu da tela
└── components/
    ├── eva.css                  @keyframes da EVA + prefers-reduced-motion
    ├── EvaUIContext.tsx         flags visuais: showInsights, animatedGlow
    ├── EvaOrb.tsx               orb estilo Siri (size, speed)
    ├── EvaGlow.tsx              GlowLayer + GlowFrame (borda cônica girando)
    ├── ui.tsx                   GlassCard, SectionHeader, Segmented, StatusBadge, Avatar
    ├── EvaInsight.tsx           comentário inline da EVA (ação + "Perguntar à EVA")
    ├── EvaHero.tsx              orb + saudação + briefing + campo de pergunta + sugestões
    ├── EvaControls.tsx          Equipe/Minha visão + status Granola/Wa-ha + atualizar
    ├── EvaStatCards.tsx         4 cards (padrão statCards do Hub)
    ├── KanbanSummaryCard.tsx    barra proporcional + 5 colunas com 2 cards cada
    ├── OverdueCard.tsx          atrasadas + filtro + botão Cobrar/Lembrar
    ├── WhatsAppQueueCard.tsx    fila do Wa-ha com status
    ├── ProjectsCard.tsx         projetos + sprint + progresso
    ├── MyTasksCard.tsx          checklist do dia
    ├── EvaChatDrawer.tsx        drawer de chat (portal + framer-motion) e EvaEdgeGlow
    ├── EvaFloatingChat.tsx      barra flutuante (orb + campo + microfone) exibida ao rolar
    └── EvaHomePage.tsx          composição da página
```

**Fluxo de dados:**
- `EvaHomePage` usa `useEvaHome()` e `useEvaChat()`.
- Os hooks chamam `evaService`.
- Os componentes de bloco são apresentacionais: recebem dados por props e o insight via `footer`.

### Onde plugar o backend (`services/evaService.ts`)
- **`getSnapshot(view)`**: montar a partir do Supabase.
  - Kanban: `it_requests` agrupado por `kanban_status`.
  - Projetos/sprints: mesma fonte do `useITProjectDashboard`.
  - Fila: registros do módulo `messaging`.
  - Insights: tabela sugerida `eva_insights`, gerada pelo worker do agente.
- **`ask(question)`**: endpoint do agente (sugestão: `api/eva/ask`), com o board e os resumos do Granola como contexto.
- **`sendCharge(task, member)`**: enviar via `src/modules/messaging` (MessagingService + WAHAProvider, já usado em Cotações).
- **`acceptInsight(id)`**: registrar o aceite e executar a ação correspondente.
- **Granola:** sincronização semanal via API num worker em `workers/`. O chip "Granola · sincronizado às HH:mm" vem de `INTEGRATIONS` em `mocks.ts`; trocar pela última sincronização real.

---

## Comportamento

| Interação | Resultado |
|---|---|
| Equipe / Minha visão | Troca o snapshot inteiro (stats, kanban, atrasadas, fila, projetos, insights). Saudação: "Bom dia, equipe de TI" ou "Bom dia, {nome}". |
| Clique no orb, no microfone ou em "Perguntar à EVA" | Abre o drawer. Se houver texto/prompt, envia como pergunta. |
| Enter no campo do hero ou chip de sugestão | Abre o drawer e envia a pergunta. |
| Enquanto a EVA responde (`thinking`) | Orbs aceleram (`speed` 2.2–2.5), aparecem 3 pontos pulando, status "Analisando board, projetos e reuniões…" e brilho de borda na tela (`EvaEdgeGlow`). |
| Cobrar | Otimista: botão vira "Cobrada" (verde), status "Cobrança enviada agora via WhatsApp", nova mensagem "Enviando" logo após as agendadas na fila, que muda para "Entregue" quando `sendCharge` resolve. O card Cobranças soma +1. |
| Filtro Todas / Crítica e alta | Filtra a lista de atrasadas por prioridade. |
| Ação principal do insight | Substitui os botões pelo texto de confirmação em verde (`doneText`). Em Projetos, também abre o chat com o resumo da reunião. |
| Checkbox de task | Alterna feito/não feito, com risco no título. Atualiza o subtítulo "X de 5 concluídas" e, na Minha visão, o card Hoje. |
| Esc / clique no overlay | Fecha o drawer. |
| Rolar até o campo do hero sair da tela | A barra flutuante aparece no canto inferior direito: `right-6 bottom-6`, 400px, entra com fade + 16px de subida + scale .96→1 em 300ms. Some quando o drawer abre ou quando o usuário volta ao topo. |
| Barra flutuante | O orb abre o drawer. O campo e o Enter enviam a pergunta, que abre o drawer com a resposta. O microfone inicia o ditado ali mesmo. |
| Microfone (hero, drawer ou barra flutuante) | Inicia o ditado pt-BR. O botão fica vermelho (`bg-red-500/10 text-red-500 ring-4 ring-red-500/[.12]`), o placeholder vira "Ouvindo…", a transcrição aparece ao vivo no campo, o orb acelera e o brilho de borda acende. Ao parar de falar, a pergunta é enviada. Um segundo clique para o ditado. |
| Erros de voz | Mensagens em vermelho (12px) junto ao campo ativo, somem depois de 6s: navegador sem suporte ("Use o Chrome ou o Edge"), permissão negada, sem fala, sem microfone, sem rede. |

### Animações (`eva.css`)
| Keyframe | Uso | Duração |
|---|---|---|
| `eva-spin` / `eva-spin-rev` | grupos de manchas do orb; borda cônica | 7s / 10s (orb), 6s (borda), linear infinito |
| `eva-morph` | cada mancha do orb | 5–7s ease-in-out |
| `eva-breathe` | halo do orb | 4s |
| `eva-edge` | brilho de borda da tela | 1.6s |
| `eva-dot` | "digitando" | 1.2s, atraso de 0.15s por ponto |

- As durações do orb são divididas por `speed`.
- `prefers-reduced-motion` desliga todas as animações via a classe `.eva-anim`.
- Entradas usam `animate-fade-in-up`, que já existe em `index.css`.
- O drawer usa spring `damping 30 / stiffness 300`, o padrão do sistema.

### Layout responsivo
- Página: `flex-col gap-7`, `max-w-[1440px]`, dentro do `<main>` do Layout (que já aplica `py-3 px-3 … xl:px-8`).
- Stat cards: `auto-fit minmax(220px,1fr)`. Colunas do kanban: `minmax(170px,1fr)`.
- Atrasadas + WhatsApp: `minmax(min(100%,420px),1fr)`. Projetos + Minhas tasks: `minmax(min(100%,380px),1fr)`. Ambos viram coluna única em telas estreitas.
- Linha de projeto: `flex-wrap`. Nome com `flex-[1_1_240px]`, barra de progresso com `flex-[1_1_160px] max-w-[260px]`.
- Drawer: `w-[440px] max-w-[calc(100vw-2rem)]`, flutuando com `top-4 right-4 bottom-4`.

---

## Tokens visuais

**Superfícies**
- Card de vidro: `bg-white/60 backdrop-blur-2xl border-white/50 rounded-3xl p-6 shadow-sm`.
- Linhas de lista: `bg-slate-50/60 rounded-2xl`, hover `bg-slate-100/80`.
- Insight: GlowFrame de 1.5px, opacidade 0.55, raio 16, interior `bg-white/[.94]`.
- Campo do hero: GlowFrame de 2px, opacidade 1, raio 20, com halo `blur(14px)` a 45%.

**Cores da EVA**
- Gradiente cônico: `#3b82f6 → #6366f1 → #8b5cf6 → #ec4899 → #06b6d4` (as mesmas do `EVENT_COLORS` do Hub).
- Orb:
  - esfera `radial #e0e7ff → #a5b4fc`;
  - manchas azul `#3b82f6`, rosa `#ec4899`, violeta `#8b5cf6` e ciano `#06b6d4`;
  - blur das manchas = 16% do tamanho;
  - halo `radial rgba(99,102,241,.45) → rgba(236,72,153,.18)`.
- Rótulo "EVA": `text-[10px] font-bold tracking-[.08em] uppercase`, gradiente `blue-600 → violet-600` recortado no texto.

**Kanban:** backlog `#64748b`, a fazer `#3b82f6`, em progresso `#f59e0b`, revisão `#8b5cf6`, concluído `#10b981`.

**Prioridade:** crítica `#ef4444`, alta `#f97316`, média `#f59e0b`, baixa `#94a3b8`. O ponto leva um anel de 4px na mesma cor a 15%.

**Badges:** triplet do DS, `{cor}-500/10` de fundo, `{cor}-600` no texto e `{cor}-500/20` na borda; 11px, semibold.

**Tipografia**
- Saudação: 30px bold, tracking -0.02em, gradiente `slate-800 → slate-600`.
- Briefing: 14px `gray-500`. Eyebrow: 10px bold uppercase `slate-500`.
- Título de bloco: 14px bold `slate-800`. Subtítulo: 12px `slate-400`.
- Número do stat: 44px extrabold `tabular-nums`.
- Linhas de lista: 13px semibold; meta 12px `slate-500`.

## Assets
- Ícones: lucide-react 0.263.
  - Blocos: `KanbanSquare`, `AlertTriangle`, `MessageCircle`, `FolderOpen`, `Calendar`, `CheckCircle2`.
  - Controles e ações: `Users`, `User`, `Mic`, `Send`, `RefreshCw`, `ArrowUpRight`, `X`, `Check`.
  - Menu: `Sparkles`.
- O orb e o brilho são CSS puro. Não há imagens novas.

## Modo escuro
O tema escuro foi revisado no protótipo e segue o `darkMode: 'class'` do projeto, ou seja, o `ThemeToggle` existente. Mapeamento usado:
- Página: `from-gray-900 to-gray-800`, igual ao Layout.
- Cards de vidro: `slate-900/60` com borda `slate-700/50`.
- Linhas de lista: `slate-800/40`, hover `slate-700/40`.
- Superfície interna da borda Siri: `slate-900/[.94]`. Drawer: `gray-900/85`.
- Textos: títulos `slate-100`, corpo `slate-300`, meta `slate-400`, terciário `slate-500`.
- Badges: texto passa de `-600` para `-400` para manter o contraste.
- Orb: esfera mais saturada (`#c7d2fe → #818cf8`, classe `.eva-sphere` em `eva.css`). Manchas, halo e borda cônica são iguais aos do modo claro.

## Pendências
- **Dados:** todos os dados e respostas do chat são mocks. Ver `evaService.ts`.
- **Ditado por voz:** usa a Web Speech API do navegador. Funciona no Chrome e no Edge e exige HTTPS e permissão de microfone. Para Firefox ou transcrição no servidor, trocar o `useVoiceInput` por gravação (`MediaRecorder`) + endpoint de transcrição, mantendo a mesma interface (`listening`, `transcript`, `notice`, `toggle`).
