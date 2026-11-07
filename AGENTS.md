# AGENTS.md

Project engineering notes live in `CLAUDE.md` (state architecture, component/UI
conventions, testing, build commands, HTML forms). Read that first. The rules under
`.cursor/rules/` also apply.

## Cursor Cloud specific instructions

CREW Documents is an Angular 21 + Electron desktop app with **no backend and no
database** — all state is a single `AppData` JSON blob. Persistence is a local
`crew-data.json` file under Electron, or browser `localStorage` in plain web dev.

Running in this environment:
- Web dev (works headless): `npm start` → `http://localhost:4200/`. Uses `localStorage`.
  This is the simplest way to exercise the app end to end here.
- Full desktop dev: `npm run electron:dev` (starts `ng serve` + Electron). Electron needs
  a display; in a headless VM it must run under a virtual framebuffer (e.g. `xvfb-run`),
  otherwise use `npm start`.
- Build/test/format commands are in `CLAUDE.md` / `package.json` — don't duplicate here.
  There is **no `lint` script**; the closest check is `npm run format:check` (Prettier),
  and it currently reports pre-existing style warnings in many files.

Expected "empty app" behavior (not bugs): a fresh instance starts with no data, so the
crew edit modal's Rank / Nationality / Port dropdowns are empty until you add those
user-managed lists in Settings. Adding a crew member with just a name still works.

Known pre-existing test failure: `src/app/utils/ship-stores-html-pdf.util.spec.ts` has one
failing case on a clean checkout (unrelated to environment setup); the rest pass.
