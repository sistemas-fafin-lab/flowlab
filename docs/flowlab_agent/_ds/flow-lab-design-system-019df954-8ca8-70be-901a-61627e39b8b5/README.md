# Flow LAB Design System

> The Flow LAB brand and UI system used by **Lab. Medicina Diagnóstica** for its internal operations platform — billing, inventory, quotations, suppliers, requests, and IT.

---

## What this design system is for

This is the source-of-truth for designing any artifact (slide, prototype, mock, page, exported asset) that should look and feel like **FlowLab**. It contains the brand foundations, components, and a working UI kit you can paste from.

**Brand essence:** confidence, innovation, clarity. The visual language pulls away from rigid corporate dashboards and leans toward a "premium, lightweight" feel — designed for operators who deal with high-volume data (billing batches, partner clinics, supplier registrations) and need to stay focused without cognitive fatigue.

**Product:** FlowLab is a **single, multi-module operational web app** — not a marketing site, not a mobile app. The product is the dashboard.

Modules: Dashboard, Estoque (Inventory), Solicitações (Requests), Fornecedores (Suppliers), Cotações (Quotations), Faturamento (Billing), Movimentações (Movements), Usuários (Users), Sistema (System), Tecnologia (IT).

## Sources

- **Brand owner:** Laboratório Lab. (Lab. Medicina Diagnóstica) — internal sistema
- **Codebase:** `flowlab/` (mounted locally; React 18 + TS + Vite + Tailwind 3 + Framer Motion + lucide-react)
- **GitHub:** `sistemas-fafin-lab/flowlab` (private; access on demand)
- **Visual identity guide:** `flowlab/docs/GUIA_IDENTIDADE_VISUAL.md` — the long-form Portuguese reference. **Read this first** if you need detail beyond what's here.
- **Logo file delivered:** `uploads/LOGO-HOR.png` (horizontal lockup with "MEDICINA DIAGNÓSTICA" descriptor)
- **Architecture/system docs:** `flowlab/docs/ARQUITETURA_SISTEMA.md`, `MESSAGING_SYSTEM.md`

The visual identity guide is exhaustive — copy classes, gradient definitions, and motion primitives are all there in Portuguese.

---

## Index — what lives in this folder

| File / Folder | What it is |
|---|---|
| `README.md` | This file. Brand reference + manifest. |
| `SKILL.md` | Cross-compatible Agent Skill front-matter. |
| `colors_and_type.css` | All design tokens as CSS variables (colors, spacing, radius, shadows, type, motion). Import this into every artifact. |
| `assets/` | Logos (horizontal, mark, dark mode, white), favicons. |
| `preview/` | One small static HTML card per visual concept (colors, type, spacing, raw component sketches) — feeds the Design System tab. |
| `components/` | **Real, exported React components** — each a `<Name>.jsx` + `<Name>.d.ts` pair, compiled into the design system bundle and consumable elsewhere as `window.FlowLABDesignSystem_*.<Name>`. Atoms: `Icon`, `Button`, `Input`, `Badge`, `Card`, `StatCard`, `Modal`. Blocks: `Sidebar`, `Topbar`. Screens: `AuthScreen`, `DashboardScreen`, `ProductListScreen`, `RequestsScreen`. Each has its own `@dsCard` preview in the same folder. |
| `ui_kits/web/` | A single clickable walkthrough (`index.html`) — Login → Dashboard → Estoque → Solicitações — composed entirely from the components above (no duplicated component code). |

There is **one product** and therefore **one UI kit** (web app). Prefer importing from `components/` over copy-pasting when building something reusable; the `preview/` swatches remain the quickest reference for raw tokens and one-off visual patterns.

---

## Content fundamentals — voice & copy

The product is **in Brazilian Portuguese** (`lang="pt-BR"`). Treat that as the default; only translate when the user explicitly asks.

- **Tone:** direct, professional, calm. No marketing bombast; no "wow" copy. The user is at work.
- **Address:** **second-person formal-neutral**. Brazilian Portuguese mostly omits the pronoun and uses verb conjugation ("Faça login", "Selecione um departamento", "Tente novamente"). When needed, "você" — never "tu", never "vocês", never "o senhor".
- **Capitalization:** **Sentence case for everything** — page titles, buttons, menu items, modal titles. Acronyms stay caps (LAB, IT). Section dividers in the sidebar are **ALL CAPS** with `tracking-wider` ("OPERAÇÕES", "ADMINISTRAÇÃO", "GERENCIAL").
- **Naming pattern in UI:** noun-first for nav, verb-first for actions.
  - Nav: "Dashboard", "Estoque", "Solicitações", "Faturamento", "Cotações"
  - Actions: "Adicionar Produto", "Excluir", "Salvar", "Cancelar", "Entrar", "Criar Conta", "Enviar instruções"
- **Microcopy patterns**:
  - Auth welcome: "Bem-vindo" / "Faça login para continuar no FlowLab"
  - Empty / loading: never blank — show a skeleton with the same shape
  - Errors are **specific** and **actionable**: not "Erro de login", but "Email ou senha incorretos. Verifique suas credenciais e tente novamente. Se você não tem uma conta, clique em 'Cadastre-se'."
  - Success: "Produto excluído com sucesso!"
  - Confirmations: "Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita."
- **Status badges** are short, sentence-case nouns: "Ativo", "Estoque Baixo", "Vencido", "Aprovado", "Pendente".
- **No emoji in product UI.** The visual identity doc uses emoji as section anchors *in the doc*; the actual app uses Lucide icons exclusively.
- **No exclamation marks** except in success toasts.
- **Jargon:** domain-specific Portuguese is fine and expected — "Cotações", "Glosas", "Recebimentos", "Movimentações". Don't over-explain.

---

## Visual foundations

### Colors

- **Primary:** the **blue scale**, `blue-500` (#3b82f6) for actions, `blue-900` (#1e3a8a) for headlines/deep backgrounds. Always paired with **indigo** (`indigo-500`–`indigo-800`) in gradients.
- **Neutral base:** `slate-50` page background in light mode; `gray-900` and `gray-800` in dark. Cards are pure white in light, `gray-800` in dark. The product spends 80% of its surface area in these neutrals — color is reserved for state and emphasis.
- **Semantic:** green = success, red = error, amber/yellow = warning, blue = info. Status badges use the **`{color}-500/10` background + `{color}-600` text + `{color}-500/20` border** triplet (subtle, never loud).
- **Decorative:** purple/violet appears only in admin-tinted touches (category editor, drag handles) — never as primary brand.

See `preview/colors-*.html` for the full scales.

### Type

- **Display & UI:** Inter (substituted from Google Fonts — flag for replacement).
- **Headlines:** `text-3xl font-bold` with the signature **horizontal gradient** `from-blue-900 via-blue-700 to-indigo-800` clipped to the text. Used in auth, page heroes, big titles only.
- **Body:** `text-sm text-gray-600` (14px). Reading copy stays small and tight — this is a dense product UI, not a landing page.
- **Eyebrow / category labels:** `text-[10px] font-bold uppercase tracking-wider text-slate-500`.
- **Numbers in cards:** large, bold, often `tabular-nums`.

### Spacing & layout

- Tailwind 4px scale. Card padding `p-6` (24px), modal padding `p-4`/`px-6 py-5`, button padding `px-4 py-2.5`.
- Grids: dashboard cards `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6`. Lists `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.
- Sidebar: 256px expanded, 80px collapsed (icon-only with hover tooltips). Mobile drawer 280px.

### Backgrounds — what's actually used

- **Default page:** flat `slate-50` / `gray-50` (light) — no gradient.
- **Auth page (and ONLY auth):** softly tinted `gradient-to-br from-slate-50 via-blue-50 to-indigo-50`, layered with **animated blob orbs** (`blur-3xl rounded-full`) and a subtle **grid pattern overlay** at `rgba(30,58,138,0.03)` 64px tiles.
- **Sidebar header strip:** `gradient-to-r from-blue-50 via-indigo-50 to-purple-50`.
- **No hand-drawn illustrations. No photo backgrounds. No textures.** The brand has none.
- Imagery is reserved for the company logo. There are **no generic illustrations** in the codebase.

### Corner radii

- Cards & modals: **`rounded-2xl`** (16px), occasionally `rounded-3xl` (24px) for hero / auth cards
- Buttons & inputs: **`rounded-xl`** (12px)
- Badges & avatars: **`rounded-full`**
- Icon containers: `rounded-xl`

### Borders

- Standard: `border border-gray-100` (very faint) or `border-gray-200`. Borders are present but never assertive.
- On focus: `border-blue-500` plus `ring-2 ring-blue-500/30`.
- On hover: nudge to `border-gray-300` / `border-slate-300`.
- Dashed borders only for "drop here" / unassigned states, in `border-blue-300 dark:border-blue-700`.

### Shadows — the brand's signature move

Soft and **frequently colored**. There are 3 patterns:

1. **Subtle elevation:** `shadow-sm` on resting cards, `shadow-md` on hover.
2. **Modal/hero elevation:** `shadow-2xl shadow-slate-900/10` — large but soft, tinted toward slate.
3. **"Glow" shadows** (the signature): primary buttons carry `shadow-md shadow-blue-500/25` and on hover `shadow-lg shadow-blue-500/30`. Danger buttons carry `shadow-red-500/25`. This produces a contemporary halo effect — never use solid black drop shadows.

### Transparency & blur (glassmorphism)

Used **deliberately, not everywhere**:

- **Auth card:** `bg-white/80 backdrop-blur-2xl`
- **Sidebar (always):** `bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl`
- **Modal overlays:** `bg-black/60 backdrop-blur-sm`
- **Inputs:** `bg-white/70 backdrop-blur-sm` (in glass contexts)

The **rule**: blur is only applied on top of a non-trivial background (the auth gradient, the sidebar over scrolling content). Never blur an opaque flat surface — it does nothing visually.

### Animation system

- **CSS keyframe library** (defined in `index.css`): `animate-fade-in`, `animate-fade-in-up`, `animate-scale-in`, `animate-slide-in-right/left`, `animate-bounce-in`, `animate-pulse-soft`, `animate-shimmer`, `animate-blob`, `animate-spin-slow`, `animate-shake`.
- **Easing default:** `cubic-bezier(0.22, 1, 0.36, 1)` (custom out-quint). For modals/dropdowns: `cubic-bezier(0.4, 0, 0.2, 1)`. Bounces use `cubic-bezier(0.68, -0.55, 0.265, 1.55)`.
- **Durations:** 150–300ms is the entire range. Fades = 200ms, scale-in for modals = 200ms, slide-in for notifications = 300ms.
- **Stagger** with `stagger-1` … `stagger-5` (50ms steps) for list entries.
- **Framer Motion** is used for anything stateful: drawers (`type:'spring', damping:30, stiffness:300`), dropdowns, form view transitions, reorderable lists.

### Hover & press states

- **Hover lift:** `.hover-lift` translates `-2px` and adds a softer `0 8px 25px -5px rgba(0,0,0,0.10)` shadow.
- **Hover on icon buttons:** background fills to `bg-gray-100` / `dark:bg-gray-700`.
- **Hover on primary button:** gradient shifts darker (`from-blue-600 to-blue-700`) **and** the colored glow grows.
- **Active / press:** `transform: scale(0.98)` on every button (scoped out within `[data-rfd-droppable-id]` to avoid breaking DnD).
- **Ripple:** `.btn-ripple` adds a radial-gradient flash on click.
- **Card interactive:** `-1px` translate + soft glow, border tints to `rgba(59, 130, 246, 0.3)`.

### Loading states

- Never blank — always **skeletons** that match the final shape. Skeleton uses `linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)` with `animate-shimmer` (1.5s infinite).
- Inline button loading: a `div.animate-spin` border ring with the verb conjugated to the gerund ("Entrando…", "Criando conta…", "Enviando…").
- Notification badges pulse with `badge-pulse` (`scale 1 → 1.5`, opacity `1 → 0`, 2s).

### Layout rules

- Sidebar is **fixed** on desktop (lg+), drawer on mobile.
- Main content gets `py-4 px-4 sm:px-6 lg:px-8` and offset for the sidebar via Tailwind's `lg:pl-64`.
- Modals are centered, max-width `max-w-md` to `max-w-2xl`, with the standard 4-zone layout (header / body / footer + close button).
- Drawers slide from the right, default 760px, resizable via a left-edge handle.

### Decorative elements (used sparingly)

- **Animated blob orbs:** `w-96 h-96 blur-3xl rounded-full` with the `animate-blob` keyframe (7s ease-in-out, translate + scale). On the login page only.
- **Grid overlay:** subtle 64px tile pattern from two crossed `linear-gradient`s at 3% opacity. Login page only.
- **Rotating ring around the logo:** SVG gradient border + `animate-spin-slow` (8s linear).

These are the only "vibe" elements in the system. **Don't add more.**

---

## Iconography

- **Icon library:** [`lucide-react`](https://lucide.dev) (`^0.263`). Used everywhere in the codebase — no exceptions.
- **No custom-drawn SVGs** beyond logos. The brand has no proprietary icon family.
- **No emoji in UI.** No unicode glyph icons (✓, ★, etc.).
- **No icon font.** lucide is imported as React components.
- **Stroke style:** lucide default (1.5px stroke, rounded line caps, square viewBox).
- **Sizing:** `w-4 h-4` (16px) inside buttons, `w-5 h-5` (20px) in nav items and modals, `w-6 h-6` (24px) in module cards/larger contexts.
- **Colors:** icons inherit text color in most cases. In active nav state, icons go white on the gradient blue. In status badges, they match the badge text color.
- **Common icons used:** `LayoutDashboard, Package, FileText, Building2, Calculator, Receipt, History, Bell, Settings, Users, Shield, Plus, Edit, Trash2, X, Save, Search, Filter, ArrowUpDown, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, LogIn, LogOut, Eye, EyeOff, Loader2, Sun, Moon, GripVertical, KanbanSquare, Server, Wrench, DollarSign, MessageSquare`.

For HTML artifacts that can't run React, **use Lucide via CDN as inline SVGs** — fetch from `https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/{name}.svg` or use the `lucide-static` script tag. Never substitute another icon family.

### Logos

Files in `assets/`:
- `logo-hor.svg` — primary horizontal lockup, light backgrounds (LAB. wordmark + "MEDICINA DIAGNÓSTICA" descriptor in blue)
- `logo-hor-dm.svg` — same lockup tuned for dark backgrounds
- `logo-hor.png` — PNG version of the horizontal lockup (provided)
- `logo-mark.png` / `logo-mark-white.png` — square mark (used inside the rotating ring on auth, and as collapsed-sidebar icon)
- `favicon.ico`, `favicon-32x32.png`, `apple-touch-icon.png`

The wordmark is "**LAB.**" with a heavy black sans-serif and a final **blue dot** glyph. The descriptor "MEDICINA DIAGNÓSTICA" is in blue, smaller, two-line. **Never re-typeset the lockup** — always use the SVG.

In-product, the FlowLab application name appears as a **separate text gradient** under or near the rotating logo ring.

---

## Caveats

- **Fonts:** the app uses system / Tailwind defaults; no custom .ttf was shipped. We've substituted **Inter + Plus Jakarta Sans** from Google Fonts. **Please confirm or supply the official font files.**
- **No marketing site / mobile app exists** — only the operational web product. If you need a marketing page, treat the visual foundations as your starting point but design something new.
- **Decks / slide template** were not provided; no `slides/` folder is included.
- **Kanban (IT)** module exists in the codebase but is not separately styled — it inherits everything from the core system.
