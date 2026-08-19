---
name: add-module
description: Scaffold for wiring a new bounded-context module into FlowLab — frontend module folder, permission keys, protected routes, sidebar nav, optional API dispatcher route, and DB/RLS migration. Manual-only — consult this skill ONLY when the user explicitly runs `/add-module` or asks for it by that exact name. Do NOT auto-trigger on generic mentions of "new module", "new feature", "permission", "nova aba", "novo módulo" or similar — those are handled with normal judgment, not this checklist.
---

# Add Module

FlowLab is a bounded-context monolith: each business area (`faturamento`, `analises-clinicas`,
`quotations`, `messaging`, ...) lives as a self-contained module under `src/modules/`, wired into
the same shell (auth, permissions, routing, sidebar). Adding a new one touches the same handful of
seams every time. This skill is that checklist, grounded in how `faturamento` and
`analises-clinicas` (the two most recently added modules) actually did it — read those two for a
live reference whenever a step below feels ambiguous.

This skill only runs when explicitly invoked (`/add-module`). It is not meant to fire on generic
"add a feature" requests — most of those don't need the full seam-by-seam treatment below.

## 0. Nail down identity before writing any code

Ask (or infer from the request) and confirm with the user if unclear:

- **Slug** — kebab-case, used for the folder, routes, and API path (e.g. `faturamento`).
- **Display name** — the PT-BR label that will show up in permission groups and sidebar nav (e.g.
  `Faturamento`, `Análises Clínicas`). The whole UI is Brazilian Portuguese — don't introduce
  English labels.
- **Does it need server-side endpoints?** Some modules are pure client + Supabase queries with RLS
  doing the access control; others (e.g. `faturamento`, `analises-clinicas`) need Vercel API
  routes because they integrate external systems, do heavier queries, or need service-role access.
  Skip step 6 if not.
- **Which existing permission keys, if any, are close enough to reuse** — check
  `src/utils/permissions.ts` before inventing new ones.

## 1. Frontend module skeleton — `src/modules/<slug>/`

```
src/modules/<slug>/
├── index.ts          # barrel: re-export everything App.tsx / other modules need
├── types.ts           (or types/index.ts for larger modules)
├── domain/            # pure business logic — status transitions, date math, calculations
│   └── *.ts + *.test.ts  (co-located tests, see analises-clinicas/domain/)
├── hooks/              # use<Thing>.ts — data fetching / mutation, wraps Supabase calls
├── components/         # pages + modals for this module
└── utils/               # formatting helpers, also co-located *.test.ts
```

Keep domain logic (`domain/`) free of React and Supabase imports — it's the part worth unit
testing in isolation. `hooks/` is the seam that talks to Supabase; `components/` stays dumb and
consumes hooks.

`src/modules/index.ts` re-exports `quotations` but the two newer modules (`faturamento`,
`analises-clinicas`) are imported directly by path from `App.tsx` instead
(`import { X } from './modules/<slug>'`). Follow the direct-import pattern unless the user asks
otherwise — it's what the codebase has converged on.

UI conventions to match (full detail in `docs/DESIGN_SYSTEM_FLOWLAB.md` and the root
`docs/CLAUDE.md`): Tailwind, modal = overlay + header/body/footer, status badges as a
`{ label, className }` config map, currency in BRL, dates in Brazilian format.

## 2. Permission keys — `src/utils/permissions.ts`

Add new keys to `ALL_PERMISSION_KEYS`, grouped under the module's display name so they cluster in
the role-management UI:

```ts
// ── <Display Name> ──────────────────────────────────────────────────────────
{ key: 'canView<Module>',   label: 'Visualizar <Display Name>', group: '<Display Name>' },
{ key: 'canManage<Module>', label: 'Gerenciar <Display Name>',  group: '<Display Name>' },
```

Naming convention: `canView*` for read access, `canManage*` for write/admin actions. Split further
(like `analises-clinicas` did with `canManageColetas`, `canCorrigirIdentidade`,
`canDeleteAgendamentos`, ...) when different actions genuinely need independent grant/revoke —
don't over-split for actions that are always granted together.

Two things that are easy to miss:

- `LEGACY_ROLE_PERMISSIONS` inherits differently per role, and it's easy to get backwards:
  `admin` maps over `ALL_PERMISSION_KEYS` (new keys included automatically), `operator` is a
  **denylist** — `ALL_PERMISSION_KEYS` minus a short excluded-keys array — so it *also* inherits
  new keys automatically unless you explicitly add them to that exclusion list, and only
  `requester` is a true **allowlist** requiring the key to be added explicitly. So: for
  admin-or-operator-but-not-requester access, do nothing extra; for anything that should stay out
  of operator's hands, add the new key to operator's exclusion list; for requester access, add it
  to requester's list.
- A permission key existing in this file does nothing on its own. It has to be (a) assignable via
  the custom-role management UI (automatic, since it reads `ALL_PERMISSION_KEYS`), (b) checked in
  RLS via `current_user_has_permission()` (step 3) if the table needs server-side enforcement, and
  (c) referenced from `<ProtectedRoute>` / sidebar nav (steps 4–5) to actually gate anything.

## 3. Database & RLS — `supabase/migrations/`

New migration file, `YYYYMMDDHHMMSS_<description>.sql` (use today's date/time, matches existing
files like `20260818140000_ac_tipos_frasco.sql`). Gate access with the same helper every other
module uses:

```sql
IF NOT (public.current_user_has_permission('canView<Module>')
        OR public.current_user_has_permission('canManage<Module>')) THEN
  ...
END IF;
```

`current_user_has_permission()` reads `custom_roles.permissions` (or `role = 'admin'`) — it does
**not** know about the legacy-role fallback that lives only in the frontend
(`getPermissionsForLegacyRole`). A profile with no `custom_role_id` has zero permissions at the RLS
layer, so if the new module needs to be usable immediately, make sure relevant roles (at least the
default "Solicitante" role, `SOLICITANTE_ROLE_ID`) get the new keys seeded, not just definable.

## 4. Routes — `src/App.tsx`

Import the module's page components at the top (direct path import, see step 1), then add routes
grouped under a comment banner (`{/* <Display Name> Routes */}`) next to the other module route
blocks (~line 238 for `faturamento`, ~line 263 for `analises-clinicas`):

```tsx
<Route
  path="/<slug>/<page>"
  element={
    <ProtectedRoute permission="canView<Module>" permissions={userPermissions}>
      <SomePage />
    </ProtectedRoute>
  }
/>
```

Use `anyOf={['permA', 'permB']}` instead of `permission` when a page should be reachable by more
than one permission (see `/analises-clinicas/temperatura`, which accepts either
`canViewTemperatura` or `canManageColetas`).

## 5. Sidebar navigation — `src/components/Layout.tsx`

Three spots to touch — the first two are both required for the item to actually render in the
right place; skipping either leaves it working but visually stranded:

1. The nav-items array: add an entry (or a section with children) —
   `{ name: '<Label>', href: '/<slug>/<page>', icon: <LucideIcon>, permission: 'canView<Module>' }`
   (or `anyOf: [...]`), following the existing `faturamento`/`analises-clinicas` blocks as a
   template. Pick a `lucide-react` icon that isn't already claimed by another nav item. Note that
   the `category:` field on this item is **not** what controls its sidebar section — see next
   step.
2. `DEFAULT_CATEGORIES` near the top of the file: each category (e.g. `'OPERAÇÕES'`) carries an
   `items: string[]` array of nav item **names**, and that's what the grouping logic actually
   matches against (`groupedNavigation`, further down) — not the `category` field from step 1.
   Add the new item's `name` to the right category's `items` array (`'OPERAÇÕES'` is where
   `faturamento` and `analises-clinicas` both live). Skip this and the item silently falls through
   to a catch-all "OUTROS" group instead of sitting with its peers.
3. Further down, a block of `if ([...].includes(path)) return [...]` lines maps route paths to a
   label used only to decide which sidebar group starts expanded when a user lands directly on
   one of the module's pages — despite the name, this is unrelated to the `DEPARTMENTS` /
   `DEPARTMENT_ROLES` business concept in `permissions.ts`. Add the new paths here for a better
   default-expand experience; harmless to skip if the module isn't opened via direct links often.

## 6. API layer — `api/<slug>/[action].ts` (skip if the module is client + RLS only)

FlowLab is on Vercel's Hobby plan, capped at 12 serverless functions, so every module funnels
through **one** dynamic-route dispatcher instead of one file per endpoint:

```ts
// api/<slug>/[action].ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import someHandler from '../_lib/handlers/<slug>-some-action.js';

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

const ROTAS: Record<string, Handler> = {
  'some-action': someHandler,
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const raw = req.query.action;
  const action = Array.isArray(raw) ? raw[0] : raw;
  const rota = action ? ROTAS[action] : undefined;
  if (!rota) {
    res.status(404).json({ success: false, error: 'Rota não encontrada.' });
    return;
  }
  await rota(req, res);
}
```

Individual handlers live in `api/_lib/handlers/<slug>-<action>.ts` — the `_lib` underscore prefix
excludes that whole directory from Vercel's function count, so the dispatcher pattern doesn't cost
a function per action. Each handler owns its own auth check, parsing, and validation; nothing at
the dispatcher level does authorization, so don't skip the permission check inside the handler
itself just because the route is already permission-gated in the UI.

## 7. Docs & planning

- For anything beyond a trivial module, write a short plan under `docs/plans/<slug>/` before
  writing code — that's the pattern the `faturamento` and `analises-clinicas` history follows.
- Track implementation work as local issues, one file per ticket, under `.scratch/<slug>/issues/`
  (see `docs/agents/issue-tracker.md`).
- If the module introduces domain vocabulary or decisions worth recording long-term, check
  `docs/agents/domain.md` for whether this repo has a `CONTEXT.md` / `docs/adr/` to update — don't
  create those speculatively if they don't already exist.

## 8. Before calling it done

- `npm run lint` and typecheck clean.
- New `domain/` and `utils/` logic has co-located `*.test.ts` (that's the existing convention —
  every module with a `domain/` folder has matching test files).
- Walk through the permission chain end to end: key exists in `ALL_PERMISSION_KEYS` → assignable in
  the role management UI → enforced in RLS (if server-backed) → gated in the route → gated (or
  intentionally not) in the sidebar. A module that's fully coded but never wired into a role is
  invisible to every non-admin user — confirm that's not accidental.
- Update `docs/CLAUDE.md`'s module list if this is a new top-level module, not a page added to an
  existing one.
