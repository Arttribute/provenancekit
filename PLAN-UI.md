# @provenancekit/ui — Implementation Plan & Execution Log

> React component library for displaying provenance information. Consumes `@provenancekit/sdk` bundles and renders them as badges, popover cards, interactive graphs, live trackers, and search UIs.

---

## Status

**✅ Phase 1–7 complete. Builds clean. 0 tests.**

| Metric | Value |
|--------|-------|
| Source files | 42 (`.ts` / `.tsx`) |
| Public exports | ~35 components + 4 hooks + 1 provider |
| Build output | CJS + ESM + `.d.ts` + `styles.css` |
| Bundle size | 97 KB ESM / 112 KB CJS / 41 KB CSS |
| Test coverage | 0 — UI tests not yet written |
| Last build | 2026-03-01, zero errors |

---

## Architecture Overview

```
packages/provenancekit-ui/
├── src/
│   ├── index.ts                        # barrel — all public exports
│   ├── lib/
│   │   ├── utils.ts                    # cn() (clsx + tailwind-merge)
│   │   ├── format.ts                   # formatBytes, formatPercent, formatAddress
│   │   └── extensions.ts               # safe getters: getLicenseSafe, getAIToolSafe, …
│   ├── context/
│   │   └── provenance-kit-provider.tsx # ProvenanceKitProvider (config context)
│   ├── hooks/
│   │   ├── use-provenance-graph.ts     # fetch + layout a graph from CID
│   │   ├── use-provenance-bundle.ts    # fetch a ProvenanceBundle by CID
│   │   ├── use-session-provenance.ts   # subscribe to live session actions
│   │   └── use-distribution.ts        # fetch payment distribution for a CID
│   ├── styles/
│   │   └── provenancekit.css           # --pk-* tokens + Tailwind v4 @import
│   └── components/
│       ├── primitives/                 # 7 atomic display components
│       ├── badge/                      # ProvenanceBadge + ProvenancePopover
│       ├── bundle/                     # full bundle view + sub-cards
│       ├── graph/                      # canvas-based provenance graph
│       ├── extensions/                 # per-extension detail views
│       ├── tracker/                    # live session recording tracker
│       ├── search/                     # provenance search UI
│       └── tracker.tsx                 # re-export convenience barrel
├── tsup.config.ts
├── tsconfig.json
├── postcss.config.js
├── tailwind.config.ts
└── package.json
```

---

## Design Token System

All visual styling is driven by `--pk-*` CSS custom properties defined in `src/styles/provenancekit.css`. This allows host applications to theme the library without modifying source.

### Core Tokens

| Token | Default (light) | Purpose |
|-------|----------------|---------|
| `--pk-background` | `oklch(1 0 0)` | Page background |
| `--pk-foreground` | `oklch(0.145 0 0)` | Primary text |
| `--pk-surface` | `oklch(0.985 0 0)` | Card / popover surface |
| `--pk-surface-border` | `oklch(0.922 0 0)` | Card borders |
| `--pk-muted-foreground` | `oklch(0.556 0 0)` | Secondary text |
| `--pk-accent` | `oklch(0.97 0 0)` | Subtle fill |

### Semantic Role Colors

| Token | Purpose |
|-------|---------|
| `--pk-role-human` | Human entity accent (`oklch(0.6 0.15 240)`) |
| `--pk-role-ai` | AI entity accent (`oklch(0.65 0.2 280)`) |
| `--pk-role-org` | Organization accent (`oklch(0.6 0.15 200)`) |

### Graph Node Colors

| Token | Node type |
|-------|-----------|
| `--pk-node-entity` / `--pk-node-entity-border` / `--pk-node-entity-muted` | Entity nodes |
| `--pk-node-action` / `--pk-node-action-border` / `--pk-node-action-muted` | Action nodes |
| `--pk-node-resource` / `--pk-node-resource-border` / `--pk-node-resource-muted` | Resource nodes |

Dark mode is handled with `@media (prefers-color-scheme: dark)` — all `--pk-*` tokens are redefined with adjusted `oklch` values.

---

## Build Configuration

### `tsup.config.ts`
- Entry: `src/index.ts` + `src/styles/provenancekit.css`
- Output: `dist/index.{js,mjs,d.ts,d.mts}` + `dist/styles.{css}`
- Target: `esnext`
- External: `react`, `react-dom`, `react/jsx-runtime`
- DTS: enabled — full type declarations built alongside JS

### `package.json` exports map
```json
{
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.mjs",
    "require": "./dist/index.js"
  },
  "./styles.css": "./dist/styles.css"
}
```
`"type": "module"` is set to suppress the Node ESM parse warning from `postcss.config.js`.

### Peer dependencies
```
react ^19.1.0
react-dom ^19.1.0
tailwindcss ^4
```

---

## Component Reference

### Primitives (`src/components/primitives/`)

| File | Component | Props summary |
|------|-----------|---------------|
| `entity-avatar.tsx` | `EntityAvatar` | `role: string`, `size?: "xs"\|"sm"\|"md"\|"lg"`, `className?` |
| `role-badge.tsx` | `RoleBadge` | `role: string`, `className?` |
| `verification-indicator.tsx` | `VerificationIndicator` | `status: "verified"\|"unverified"\|"pending"\|"failed"`, `showLabel?`, `size?` |
| `license-chip.tsx` | `LicenseChip` | `license: LicenseExtension`, `showIcons?`, `className?` |
| `timestamp.tsx` | `Timestamp` | `iso: string`, `relative?`, `className?` |
| `cid-display.tsx` | `CidDisplay` | `cid: string`, `prefixLen?`, `suffixLen?`, `copyable?`, `className?` |
| `contribution-bar.tsx` | `ContributionBar` | `bps: number`, `showLabel?`, `className?` |

### Badge (`src/components/badge/`)

| File | Component | Props summary |
|------|-----------|---------------|
| `provenance-badge.tsx` | `ProvenanceBadge` | `bundle: ProvenanceBundle`, `cid?`, `variant?: "icon"\|"chip"\|"full"`, `onViewDetail?`, `showGraph?` |
| `provenance-popover.tsx` | `ProvenancePopover` | `bundle`, `cid?`, `children`, `side?`, `onViewDetail?`, `showGraph?` |

`ProvenanceBadge` is the primary consumer-facing component. It renders a small shield icon by default; clicking opens a `ProvenancePopover` with creator, creation date, AI disclosure, license, and verification status.

### Bundle (`src/components/bundle/`)

| File | Component | Props summary |
|------|-----------|---------------|
| `provenance-bundle-view.tsx` | `ProvenanceBundleView` | `bundle`, `showEntities?`, `showActions?`, `showResources?`, `showAttributions?`, `className?` |
| `entity-card.tsx` | `EntityCard` | `entity: Entity`, `className?` |
| `action-card.tsx` | `ActionCard` | `action: Action`, `showExtensions?`, `className?` |
| `resource-card.tsx` | `ResourceCard` | `resource: Resource`, `showExtensions?`, `className?` |
| `attribution-list.tsx` | `AttributionList` | `attributions: Attribution[]`, `entities: Entity[]`, `showContribution?`, `className?` |

### Graph (`src/components/graph/`)

| File | Purpose |
|------|---------|
| `layout.ts` | Pure layout engine: converts `ProvenanceBundle` → `{nodes, edges}` with column-based x/y positions |
| `graph-node.tsx` | `GraphNode` — SVG `<g>` for entity/action/resource with colour-coded rect + label |
| `graph-edge.tsx` | `GraphEdge` — SVG cubic bézier path between nodes with optional label |
| `graph-controls.tsx` | `GraphControls` — zoom in/out/reset buttons |
| `graph-legend.tsx` | `GraphLegend` — colour key for node types |
| `graph-canvas.tsx` | `GraphCanvas` — SVG viewport with pan/zoom state (wheel + drag) |
| `provenance-graph.tsx` | `ProvenanceGraph` — top-level: fetches bundle via hook, composes all graph sub-components |

**Pan/zoom:** Native SVG `viewBox` manipulation on wheel + pointer events. No external graph library dependency.

### Extensions (`src/components/extensions/`)

| File | Component | What it renders |
|------|-----------|----------------|
| `ai-extension-view.tsx` | `AIExtensionView` | Provider, model, version, autonomy level, session. `mode: "tool"\|"agent"` |
| `license-extension-view.tsx` | `LicenseExtensionView` | Full license detail: SPDX type, commercial, derivatives, share-alike, terms URL |
| `onchain-extension-view.tsx` | `OnchainExtensionView` | Chain, transaction hash (truncated + link), block number, timestamp |
| `verification-view.tsx` | `VerificationView` | Verification status + method + verifier |
| `contrib-extension-view.tsx` | `ContribExtensionView` | BPS weight, contribution bar, note |

### Tracker (`src/components/tracker/`)

| File | Component | Purpose |
|------|-----------|---------|
| `tracker-action-item.tsx` | `TrackerActionItem` | Single row: action type chip, entity avatar, timestamp, extension badges |
| `tracker-session-header.tsx` | `TrackerSessionHeader` | Session ID display, entity count, action count, live indicator dot |
| `provenance-tracker.tsx` | `ProvenanceTracker` | Full tracker panel: uses `useSessionProvenance` to subscribe to live actions, renders header + list |

### Search (`src/components/search/`)

| File | Component | Purpose |
|------|-----------|---------|
| `file-upload-zone.tsx` | `FileUploadZone` | Drag-and-drop or click-to-upload zone; emits `File` object via `onFile` callback |
| `search-result-card.tsx` | `SearchResultCard` | Single search result: similarity score bar, resource type, CID, creation date, creator |
| `provenance-search.tsx` | `ProvenanceSearch` | Full search panel: text or file input → calls API → renders `SearchResultCard` list |

### Context & Hooks

| Export | Purpose |
|--------|---------|
| `ProvenanceKitProvider` | Wraps app; provides API base URL, default chain, theme override via context |
| `useProvenanceGraph(cid)` | Fetches bundle, runs layout engine, returns `{nodes, edges, loading, error}` |
| `useProvenanceBundle(cid)` | Fetches a single `ProvenanceBundle` by CID via SDK |
| `useSessionProvenance(sessionId)` | Polls or subscribes to actions in a session; returns `{actions, entities, loading}` |
| `useDistribution(cid)` | Fetches payment distribution splits for a resource CID |

---

## Implementation Phases — Execution Log

### Phase 1: Foundation ✅
- `package.json` with `"type": "module"`, exports map, peer deps
- `tsup.config.ts` — dual CJS/ESM + CSS + DTS
- `tsconfig.json` — extends `tsconfig.base.json`, JSX react-jsx
- `postcss.config.js` — `@tailwindcss/postcss`
- `tailwind.config.ts` — content glob for src
- `src/styles/provenancekit.css` — full `--pk-*` token system, light + dark
- `src/lib/utils.ts` — `cn()`
- `src/lib/format.ts` — `formatBytes`, `formatPercent`, `formatAddress`, `formatDuration`
- `src/lib/extensions.ts` — safe getters for all extension types
- `src/context/provenance-kit-provider.tsx`
- `src/hooks/use-provenance-graph.ts`
- `src/hooks/use-provenance-bundle.ts`
- `src/hooks/use-session-provenance.ts`
- `src/hooks/use-distribution.ts`

### Phase 2: Primitives ✅
All 7 atomic components: `EntityAvatar`, `RoleBadge`, `VerificationIndicator`, `LicenseChip`, `Timestamp`, `CidDisplay`, `ContributionBar`.

**`LicenseChip` note:** Lucide icons do not accept a `title` prop — accessibility tooltips are implemented as wrapping `<span title>` elements with `aria-label` on the icon.

### Phase 3: Badge ✅
- `ProvenancePopover` — Radix `@radix-ui/react-popover` with creator, date, AI disclosure, license, verification, and "View full provenance" button
- `ProvenanceBadge` — shield icon trigger; `variant` prop: `"icon"` | `"chip"` | `"full"`

### Phase 4: Graph ✅
- `layout.ts` — column layout algorithm: entities col 0, actions col 1, resources col 2; evenly distributed y positions
- `GraphNode`, `GraphEdge`, `GraphControls`, `GraphLegend`, `GraphCanvas`, `ProvenanceGraph`
- Pan/zoom via SVG `viewBox` + `transform` matrix — zero external dependencies

### Phase 5: Extension Views + Bundle View ✅
- All 5 extension view components
- `EntityCard`, `ActionCard`, `ResourceCard`, `AttributionList`, `ProvenanceBundleView`

**TypeScript fixes during this phase:**
- `resource.address` is `ContentReference | undefined` — used optional chaining throughout
- `resource.locations` is `Location[] | undefined` — guarded with `?.length ?? 0`
- `entity.role` / `attr.role` are `string | undefined` — guarded before passing to `RoleBadge`

### Phase 6: Tracker ✅
`TrackerActionItem`, `TrackerSessionHeader`, `ProvenanceTracker` — live session view using `useSessionProvenance` hook.

### Phase 7: Search + Final Barrel ✅
`FileUploadZone`, `SearchResultCard`, `ProvenanceSearch`, `src/index.ts` barrel, `src/components/tracker.tsx` re-export.

**Build errors fixed (Phase 7 / post-build):**

| File | Error | Fix |
|------|-------|-----|
| `license-chip.tsx:50,58,66` | `title` not on `LucideProps` | Wrapped icons in `<span title>` |
| `provenance-popover.tsx:40` | `r.address` possibly undefined | `r.address?.ref` |
| `provenance-popover.tsx:86` | `creator.role` possibly undefined | `?? "human"` default |
| `action-card.tsx:51–57` | `action.inputs/outputs` possibly undefined | `?.length ?? 0` + `!` assertion after guard |
| `entity-card.tsx:27,33` | `entity.role` possibly undefined | `?? "human"` + conditional render |
| `attribution-list.tsx:44,46` | `attr.entityId` / `attr.role` possibly undefined | Guarded expressions |
| `resource-card.tsx:41,52,60` | `resource.address`, `resource.locations`, `loc.uri` possibly undefined | Optional chaining throughout |
| `provenance-bundle-view.tsx:65` | `resource.address` possibly undefined | `resource.address?.ref` |

---

## Known Gaps & Next Steps

### Priority 1 — Tests
No component tests exist. Recommended approach:
- **Vitest + @testing-library/react** for unit/integration tests
- Test each primitive in isolation with mock data
- Test `ProvenanceBundleView` with a full `ProvenanceBundle` fixture
- Test hooks with MSW (Mock Service Worker) to intercept API calls

Target: ~80 tests across primitives, bundle, and hooks.

### Priority 2 — Storybook
- Add Storybook for visual development and docs site integration
- One story per component with all prop variants
- `@storybook/addon-a11y` for accessibility checks

### Priority 3 — Accessibility Audit
- All interactive elements need `aria-label` / `role` attributes
- `ProvenanceBadge` trigger needs keyboard nav
- `FileUploadZone` needs `role="button"` + keyboard activation
- Graph canvas needs text fallback for screen readers

### Priority 4 — `ProvenanceBadge` Graph Integration
The `showGraph?` prop exists on `ProvenanceBadge` and `ProvenancePopover` but is not yet wired to render `ProvenanceGraph` inline. When `showGraph={true}`, the popover should expand to show the mini graph.

### Priority 5 — SSR Safety
All components use `"use client"` directives in the file but do not have explicit SSR guards. The `useEffect`-based hooks should be audited for hydration mismatches in Next.js App Router contexts.

---

## Dependency Map

```
@provenancekit/ui
  ├── @provenancekit/eaa-types     (Entity, Action, Resource, Attribution, ProvenanceBundle)
  ├── @provenancekit/extensions    (getLicense, getAITool, getVerification, etc.)
  ├── @provenancekit/sdk           (ProvenanceKitClient used in hooks)
  ├── @radix-ui/react-popover      (ProvenancePopover)
  ├── @radix-ui/react-dialog       (future modal use)
  ├── @radix-ui/react-tooltip      (future tooltip use)
  ├── @radix-ui/react-slot         (Slot primitive)
  ├── lucide-react                 (icons throughout)
  ├── class-variance-authority     (cva for variant props)
  ├── clsx + tailwind-merge        (cn() utility)
  └── tailwindcss ^4 (peer)        (CSS compilation)
```

---

*Last updated: 2026-03-01*
