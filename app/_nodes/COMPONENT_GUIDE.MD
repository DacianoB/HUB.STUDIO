# Dynamic Grid Component Guide

This guide defines the standard for adding new components to the dynamic grid system used by `dynamic-grid.tsx`.

Use this file as the source of truth for future prompts/agents creating components in this area.

## 1) How the dynamic system works

- `dynamic-grid.tsx` renders cards from `items[]` using `ComponentRegistry[item.type]`.
- Each rendered card receives:
  - `...item.props` (custom props stored in layout item state)
  - `gridItemId={item.i}` (always injected by grid renderer)
- `components.json` is the component catalog used by:
  - search/suggestions
  - default size (`defaultLayout`)
  - auth gating (`requiresAuth`)
  - internal-only visibility (`internal`)
- `pages.json` defines preset layouts/routes and initial `items`.

If a component is missing in either `ComponentRegistry` or `components.json`, the experience becomes inconsistent (missing render, missing search metadata, bad sizing).

## 2) Mandatory files to update for a new component

When creating a new grid component `my-component`:

1. Create file:
   - `src/app/_nodes/node-my-component/node.tsx`
2. Ensure key exists in:
   - `src/app/_nodes/components.json`
3. Add catalog entry in:
   - `src/app/_nodes/components.json`
4. (Optional) Add to a preset in:
   - `src/app/pages.json`

## 3) Naming and conventions

- **Type key**: kebab-case (`"my-component"`).
- **Component export**: default export is recommended for `node.tsx` modules (named exports are also supported).
- **Folder name**: kebab-case with `node-` prefix to match type key convention.
- **Client components**: prefer `"use client"` unless fully static and server-safe.
- **Visual style**: dark glass/gradient panel style used by existing dashboard components.

## 4) Component contract (important)

`dynamic-grid.tsx` only guarantees:

- `gridItemId?: string`
- Anything inside `item.props` when item was created/loaded

So component props must be defensive:

- Accept optional values (`?`) for runtime safety.
- Provide safe empty/loading/fallback states.
- Never assume auth/session exists unless checked in component.
- Avoid hard crash on malformed `item.props`.

Recommended prop shape example:

```tsx
type DashboardMyComponentProps = {
  gridItemId?: string;
  mode?: "compact" | "full";
  itemId?: number;
};

export function DashboardMyComponent({
  gridItemId,
  mode = "compact",
  itemId,
}: DashboardMyComponentProps) {
  // ...
}
```

## 5) Layout metadata rules (`components.json`)

Every new component entry should include:

- `name`: user-facing title
- `description`: short functional description
- `tags`: searchable keywords (pt-BR + product words)
- `defaultLayout`:
  - `w`: default width in columns (array or number; existing standard commonly uses array)
  - `h`: default height in rows (array or number)
  - `minW`: minimum width
  - `minH`: minimum height
- optional `requiresAuth`: `true` for protected data components
- optional `internal`: `true` — system-only component, invisible everywhere (search, scroll, library). Can only be placed by presets (`pages.json`) or spawned by other components.
- optional `searchable`: `false` — cannot be found via the search bar or component library. Still appears in infinite scroll if `discoverable` is not false.
- optional `discoverable`: `false` — does not appear in the infinite scroll feed. Still appears in search results if `searchable` is not false.

Precedence: `internal: true` overrides both `searchable` and `discoverable` (hides from everything).

Suggested baseline:

```json
{
  "my-component": {
    "name": "Meu Componente",
    "description": "Resumo do que este bloco mostra",
    "tags": ["dashboard", "categoria", "palavra-chave"],
    "requiresAuth": true,
    "defaultLayout": {
      "w": [2],
      "h": [8],
      "minW": 1,
      "minH": 4
    }
  }
}
```

## 6) Registry rules (`component-registry.tsx`)

- Registry is convention-based and auto-loads from `node-*/node.tsx`.
- Keep `components.json` and node folder names aligned by type key.
- Include a loading fallback card style in registry defaults (already implemented).

## 7) UI/UX guidelines for new cards

- Fill full tile area (`h-full w-full`).
- Respect rounded container (`rounded-xl`) and avoid overflow leaks.
- Prefer shared primitives from `lib/ui.tsx`:
  - `DashboardPanel`
  - `DashboardTableContainer`
  - `DashboardPager`
- Keep header concise and scannable (`title`, optional `subtitle`, optional right icon).
- Empty/loading/error states are required.
- For table-like cards: sticky header + paginated body if large.

## 8) Data and auth guidelines

- For protected endpoints, gate requests with session status:
  - `enabled: status === "authenticated"`
- Provide unauthenticated fallback UI inside the component when needed.
- Keep queries localized to component.
- Avoid expensive effects that run on every render.
- If component emits events for grid orchestration, use stable event names and clean up listeners.

## 9) Preset integration (`pages.json`)

Add a component to a preset only when it is product-ready.

Item shape:

```json
{
  "i": "dashboard-my-component",
  "type": "my-component",
  "x": 0,
  "y": 0,
  "w": 2,
  "h": 8
}
```

Notes:

- `i` must be unique in that preset.
- `type` must exist in registry + config.
- Keep sizes close to `defaultLayout` unless there is a strong reason.

## 10) AI checklist before finalizing

- [ ] Component file created in `node-my-component/node.tsx`
- [ ] Export name and type key are consistent
- [ ] Added to `component-registry.tsx` with dynamic import + loading fallback
- [ ] Added to `components.json` with tags and `defaultLayout`
- [ ] Handles loading/empty/error states
- [ ] Handles unauthenticated state if using protected data
- [ ] Accepts `gridItemId?` and safe optional props
- [ ] No assumptions that can crash when `item.props` is missing
- [ ] Optional: inserted into `pages.json` preset

## 11) Prompt template for future agents

Copy and adapt:

```md
Create a new dynamic grid component called `my-component`.

Requirements:
- File: `src/app/_nodes/node-my-component/node.tsx`
- Export: default component (or named export if needed)
- Accept props: `{ gridItemId?: string, ... }`
- Use existing dashboard visual language (panel/table primitives from `lib/ui.tsx` when useful)
- Add loading/empty/error states
- If data is protected, gate queries by auth status and render unauthenticated fallback

Also update:
1) `src/app/_nodes/components.json` (metadata + defaultLayout + tags)
2) `src/app/pages.json` (only if requested to include in a preset)
3) `src/app/_nodes/component-registry.tsx` only if you are changing loader conventions

Do not break existing components.
```

## 12) Common mistakes to avoid

- Key mismatch between registry/config/type (`my-component` vs `my_component`).
- Missing `components.json` entry (component becomes hard to discover/size correctly).
- Missing fallback states (blank/unstable tile).
- Using rigid props that crash when `item.props` is absent.
- Adding unfinished/internal components to public presets.

