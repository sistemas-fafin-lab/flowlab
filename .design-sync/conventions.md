# Flow LAB Design System — build conventions

This is a **scoped extraction from a live Vite + React + Tailwind app**, not a
published component package. `_ds/components/` ships 9 presentational
primitives pulled from `src/components/*` — dialogs/toasts, a detail modal, a
signature viewer, and the loading-skeleton atoms. The other ~70 components in
the app are data-coupled feature screens (Supabase, router, env) and are
intentionally out of scope.

## Wrapping and setup

No provider or root wrapper is required — none of the synced components read
from React context. Import and render them directly:

```tsx
import { ConfirmDialog } from '<component source>';

<ConfirmDialog
  isOpen
  type="danger"
  title="Excluir produto"
  message="Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita."
  confirmText="Excluir"
  onConfirm={handleConfirm}
  onCancel={handleCancel}
/>
```

The 5 dialog/toast components (`ConfirmDialog`, `InputDialog`, `Notification`,
`DetailModal`, `SignatureViewModal`) render as `fixed inset-0` overlays gated
by an `isOpen`/`isVisible` boolean prop — pass it `true` to show them. They
have no built-in "closed" placeholder; the host app is expected to
conditionally mount/unmount them.

## Styling idiom

**Plain Tailwind utility classes on stock tokens — no design-token layer, no
custom Tailwind theme.** `tailwind.config.js` extends nothing
(`theme.extend = {}`), so every color/spacing/radius class is Tailwind's
default palette (`blue-500`, `slate-800`, `rounded-2xl`, `rounded-3xl`, …).
There is no `bg-primary` / `text-accent` abstraction layer to imitate — pick
colors directly from Tailwind's stock scale, matching the semantic pattern
already in use:

| Semantic | Colors used |
|---|---|
| Danger / destructive | `red-600`/`red-700` (buttons), `red-500` (icons/borders) |
| Warning | `yellow-500`/`yellow-600`, `amber-500` |
| Info / primary action | `blue-500`/`blue-600`/`indigo-500` |
| Success | `green-500`/`emerald-500` |
| Neutral surface | `white` / `gray-800` (dark), `slate-*` for secondary text |

`darkMode: 'class'` — every component pairs each light class with a
`dark:` variant (e.g. `bg-white dark:bg-gray-800`, `text-gray-800
dark:text-gray-100`). Match that pairing when composing new usage; omitting
the `dark:` half is the most common way a composition looks broken in dark
mode.

**Custom animation utility classes** are defined in `src/index.css` (plain
CSS `@keyframes` + utility classes, not a Tailwind plugin) and are already
applied inside the synced components — you don't need to add them yourself,
just know they exist if composing something new: `animate-fade-in`,
`animate-fade-in-up`/`-down`, `animate-scale-in`, `animate-slide-in-right`,
`animate-bounce-in`, `hover-lift`, `glass` (backdrop-blur surface), `skeleton`
(loading placeholders). `src/index.css` defines a few more of these
(`animate-slide-up`, `focus-ring`, `animate-shimmer`, …) that aren't used by
any of the 9 synced components — check `styles.css` in this bundle before
relying on one, since anything not actually referenced in `src/` is purged
from the shipped stylesheet.

`DetailModal` additionally uses **framer-motion** (`motion.div` with
`initial`/`animate`/`exit`) for its mount transition, layered on top of the
same Tailwind classes — the other 4 overlay components use CSS-only
animation (`animate-fade-in`/`animate-scale-in`).

## Where the truth lives

- `styles.css` (bundle root) — the full compiled Tailwind output for the
  scoped components; read it for the exact class → CSS mapping actually
  shipped.
- Each component's `<Name>.prompt.md` — usage doc synthesized from its
  `.d.ts` props and the authored preview compositions in this bundle.
- `src/index.css` in the source repo — the canonical source for the custom
  animation utility classes listed above, if extending them.

## Idiomatic build snippet

A confirm dialog, matching the app's real usage (from `ConfirmDialog`'s own
preview composition):

```tsx
<ConfirmDialog
  isOpen
  type="danger"
  title="Excluir produto"
  message="Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita."
  confirmText="Excluir"
  cancelText="Cancelar"
  onConfirm={handleDelete}
  onCancel={() => setConfirming(false)}
/>
```

For layout glue around these components (containers, spacing, headings),
follow the same idiom: plain Tailwind utilities on the stock palette, paired
`dark:` variants, no custom design-token classes.
