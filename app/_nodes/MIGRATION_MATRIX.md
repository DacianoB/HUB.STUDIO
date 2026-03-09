# Dynamic Migration Validation Matrix

This matrix tracks route-level validation for the dynamic node migration.

## Buckets

- `A`: public low-risk pages
- `B`: public dynamic-interaction pages
- `C`: critical catch-all commerce/learning routes
- `D`: protected/auth-sensitive routes

## Validation checklist per route

- Slug resolves to correct preset
- Auth policy matches legacy behavior
- Route indexability policy (`indexable/internalRoute/hidden`) is correct
- Node rendering has no missing registry entries
- Storage snapshot restore works without schema warnings
- Mobile/desktop layout remains usable

## Initial mapped routes

| Bucket | Legacy Route | Dynamic Preset Slug | Status |
|---|---|---|---|
| A | `/privacidade` | `site/institucional/privacidade` | migrated |
| A | `/contrato` | `site/institucional/contrato` | migrated |
| A | `/status` | `site/institucional/status` | migrated |
| A | `/FAQ` | `site/institucional/faq` | migrated |
| A | `/eventos/neville-page-25` | `site/eventos/neville-page-25` | migrated |
| A | `/eventos/novo-mundo` | `site/eventos/novo-mundo` | migrated |
| A | `/lp/neville-exp` | `site/eventos/lp-neville-exp` | migrated |
| B | `/forum` | `site/comunidade` | migrated |
| B | `/room` | `site/comunidade/room` | migrated |
| B | `/nexus` | `site/comunidade/nexus` | migrated |
| C | `/curso/[...info]` | `learning/curso` | policy mapped |
| C | `/trilha/[...info]` | `learning/trilha` | policy mapped |
| C | `/pagamento/[...pid]` | `learning/pagamento` | policy mapped |
| C | `/pedido/[...pedidoid]` | `learning/pedido` | policy mapped |
| D | `/sala/[...idturma]` | `learning/sala` | policy mapped |

## Observability hooks

- Runtime events are emitted as `window` event `dynamic-grid:event`.
- Current event sources:
  - `dynamic-route-mounted`
  - `invalid-storage-payload`
  - `invalid-history-snapshot`
  - `missing-component-registry-entry`
