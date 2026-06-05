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
  `StorageService.normalize`. New fields get empty defaults in old data; old data
  is preserved. Don't do destructive migrations.
- Ports/ranks/nationalities are **user-managed** lists: keep exactly what's saved
  (dedupe only), never re-inject `DEFAULT_PORTS`/defaults at runtime.

## Build commands

- Web build: `npm run build`
- Portable exe: `npm run electron:build` → outputs `CREW-App\CREW-Documents.exe`.
