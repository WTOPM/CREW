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

## Build commands

- Web build: `npm run build`
- Portable exe: `npm run electron:build` → outputs `CREW-App\CREW-Documents.exe`.
- Electron setup is complete (`angular.json` `electron` config + `package.json` `build`);
  all referenced assets exist under `build/`. No extra setup needed to produce the exe.
