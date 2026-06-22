# CREW Documents — project notes

## Build / release rules (IMPORTANT)

- **The exe must ship with NO bundled data.** No seed/sample crew, ports, ranks,
  nationalities, or `crew-data.json` inside the exe. The app starts **empty**
  (`createEmptyAppData()` in `src/app/data/empty-app-data.ts`) and uses whatever
  data already exists on the computer.
- Data lives **next to the exe** in a `data\` folder (or a shared path via
  `data-path.txt`). Updating the app = replace `CREW-Documents.exe` only; never
  touch the user's `data\` folder.
- The Angular **electron** build config (`angular.json`) ignores `crew-data.json`
  in assets so it is never packaged. Keep that ignore in place.
- Schema is **additive**: every field is read as `raw.X ?? default` in
  `normalizeAppData()` (`src/app/services/app-data-normalizer.ts`). New fields get
  empty defaults in old data; old data is preserved. Don't do destructive migrations.
- Ports/ranks/nationalities are **user-managed** lists: keep exactly what's saved
  (dedupe only), never re-inject `DEFAULT_PORTS`/defaults at runtime.

## State management architecture (IMPORTANT)

State is one `AppData` signal, persisted as one blob. It is split across a kernel +
feature stores. **Do not put new state logic back into a single god service.**

- **`AppStateStore`** (`app-state.store.ts`) — the kernel. Owns the single
  `data = signal<AppData>()`, plus `init()`, `persist(notify)`, `finishFormSession()`.
  Everything else injects it and shares state via `private readonly data = this.state.data;`.
- **Feature stores** own one domain's **mutations** each (read `this.data()`, write
  `this.data.update(...)`, then `void this.state.persist(notify)`):
  - `reference-lists.store.ts` — ports / terminals / ranks / nationalities
  - `crew.store.ts` — crew arrival/departure/archive + sync/preview/apply
  - `passenger.store.ts` — passengers (mirror of crew)
  - `dg-manifest.store.ts` — DG: CMA CGM + Unifeeder inventory, manifests, prestow
  - `reefer.store.ts` — reefer units / manifests / monitoring
  - `document-settings.store.ts` — overlay/stamps, output settings, print packages, custom docs
  - `forms.store.ts` — cash advance, narcotic, nil list, ship money, ship stores, crew effect, port-call history
- **`StorageService`** — a thin facade: ALL read **selectors** (`computed`) live here
  (many components read `storage.X()`), plus ship/voyage core (`updateShip` etc.),
  snapshots, and import/export. It delegates persistence to the kernel.
- **`app-data-normalizer.ts`** — pure normalization/migration functions (no signals/IO).

**Rule for new code (applies to Cursor + humans too):**
add a **mutation** to the matching feature store; add a read **selector** to
`StorageService`. A component injects `storage` for reads and the relevant store for writes.
Keep the persisted blob single — never add a second source of truth.

Keep `dg-manifest.store.ts` cross-tab transfer (CMA ↔ Unifeeder) in the store, not the
component. Pure normalization/migration belongs in `app-data-normalizer.ts`, not in stores.

## Component & UI conventions (IMPORTANT)

- **No inline `template`/`styles` in components.** Use `templateUrl` + `styleUrl` files
  (every component follows this). If you find an inline block, extract it to files.
- **Split big templates into child components** when a cohesive region grows large
  (modals, inventory tabs, edit forms). Pattern: child takes `[input]`, emits
  `(save)`/`(cancel)`/`(close)`, owns a local working draft via `linkedSignal`.
  Examples: `crew-edit-modal`, `passenger-edit-modal`, `dg-archive-modals`,
  `dg-unifeeder-inventory`.
- **Styles must move with the markup.** Angular scopes component CSS, so when you move
  markup into a child, move its CSS too. Shared/cross-component styles (modal, form,
  table, `.dg-*`/`.uf-*`) live in the **global** `src/styles.css` — that's where the
  modal/form/DG styles already are. Keep namespaced class names (`dg-`, `uf-`, `cma-`,
  `crew-form-`) so globalizing never collides.
- **Component-scoped services** (`providers: [X]` on the `@Component`) for per-instance
  lifecycle, e.g. object-URL previews that must be revoked on destroy
  (`CrewSignaturePreviewStore`). Root-`providedIn` for everything shared.
- **Reads vs writes:** components inject `StorageService` for read selectors and the
  relevant feature store for mutations (see state section above).
- Use modern Angular signals API: `signal`, `computed`, `linkedSignal`, `input()`,
  `output()`, `viewChild()`, `inject()`. Standalone components (no NgModules).

## Testing

- Runner: **vitest** via `@angular/build:unit-test`. Run: `npm test` (one-shot:
  `npx ng test --watch=false`). Spec files are excluded from the production build.
- **Prefer pure unit tests** over TestBed where possible: normalizers and feature stores
  test cleanly. For a store, `TestBed.inject(AppStateStore)`, `state.data.set(createEmptyAppData())`,
  then `TestBed.inject(TheStore)` and assert on `state.data()` after mutations.
  See `crew.store.spec.ts`, `reference-lists.store.spec.ts`, `app-data-normalizer.spec.ts`.
- **What to cover first:** anything in `app-data-normalizer.ts` (additive schema /
  migrations — the riskiest to break silently) and feature-store mutations.
- Components that use `RouterLink`/router need `provideRouter([])` in the TestBed providers.

## Verify before claiming done

- After any change run `npx tsc --noEmit -p tsconfig.app.json` **and** `npm run build`
  (AOT compiles templates — a broken binding fails the build). Both must be clean (exit 0,
  no `NG####` warnings). Run `npm test` when you touched store/normalizer/util logic.
- Refactors must be **behavior-preserving (1:1)** unless asked otherwise. The app starts
  empty, so interactive features can't be verified on a fresh dev instance — say so and
  ask the user to confirm on real data when visual verification matters.

## Build commands

- Web build: `npm run build`
- Tests: `npm test` (vitest)
- Portable exe: `npm run electron:build` → outputs `CREW-App\CREW-Documents.exe`.
- Electron setup is complete (`angular.json` `electron` config + `package.json` `build`);
  all referenced assets exist under `build/`. No extra setup needed to produce the exe.
