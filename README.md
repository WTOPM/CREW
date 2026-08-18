# CREW Documents

Desktop application for ship documentation: voyage data, crew and passenger lists, and PDF forms for IMO and port authorities.

**Current release:** v0.8 · **Platform:** Windows portable · **Data:** stored locally next to the executable

The repository contains **no user data**. A fresh download or build starts with an empty database.

---

## Option 1 — Run from Release (recommended)

For end users. No Node.js, npm, or build tools required.

1. Open **[Releases](https://github.com/WTOPM/CREW/releases)**.
2. Download **`CREW-Documents.exe`** from the latest release (v0.8).
3. Save the file to any folder (Desktop, USB drive, or network location).
4. Double-click **`CREW-Documents.exe`** to launch.

**No installation is required.** Windows may show a SmartScreen prompt on first run — choose *Run anyway* if you trust the source.

### First launch

On first run, the application creates a **`data`** folder next to the executable:

```
CREW-Documents.exe
data/
  crew-data.json      ← all application data (created automatically)
  documents/          ← crew document scans (optional)
  assets/             ← ship stamp and signature (optional)
```

All lists, settings, and scans are stored in **`data`**, not inside the exe.

### Updating

Replace **`CREW-Documents.exe`** with the new version from Releases. **Do not delete or overwrite the `data` folder.**

### Shared data (multiple PCs)

To use one database from several computers:

1. Place the `data` folder on a network share.
2. Create **`data-path.txt`** next to the exe (see `data-path.txt.example` in the release bundle or repository).
3. Put the full path to the shared folder on the first line.

---

## Option 2 — Build and run from source

For developers who want to run or modify the application from this repository.

### Prerequisites

| Software | Version | Notes |
|----------|---------|--------|
| [Node.js](https://nodejs.org/) | **20 LTS or newer** | Includes **npm** |
| [Git](https://git-scm.com/) | Latest | To clone the repository |
| **Windows** | 10 / 11 | Required for the portable `.exe` build |

The project uses **Angular 21**, **Electron 42**, and **TypeScript**. These are installed automatically via `npm install` — you do not install Angular CLI globally.

### Clone and install

```bash
git clone https://github.com/WTOPM/CREW.git
cd CREW
npm install
```

Short command sheet (Windows / PowerShell): [docs/electron.md](docs/electron.md).

### Build portable executable

```bash
npm run electron:build
```

Output:

```
CREW-App/CREW-Documents.exe
```

This builds a **standalone, empty** application (PDF templates only, no crew or voyage data).

### Run in development mode

Starts the Angular dev server and Electron together (hot reload for UI changes):

```bash
npm run electron:dev
```

The app window opens when `http://localhost:4200` is ready.

### Other useful commands

| Command | Description |
|---------|-------------|
| `npm start` | Web UI only in the browser (no Electron) |
| `npm run build` | Production web build → `dist/crew/` |
| `npm run build:electron` | Angular build for Electron (without packaging exe) |
| `npm test` | Run unit tests |

### Local data when developing

- **Electron (exe / dev):** data is stored in **`data/`** next to the executable or project root when running unpackaged.
- **`data/`**, **`crew-data.json`**, and Excel import files are **gitignored** — your test data is never committed.

Optional import from Excel (writes to `data/crew-data.json` only):

```bash
npm run import:document DOCUMENT.xlsx
```

Place `DOCUMENT.xlsx` in the project root (the file itself is gitignored).

---

## How the application works

| Area | Description |
|------|-------------|
| **Home** | Current voyage (ports, dates), crew and passenger lists (Arrival / Departure), archive |
| **Documents** | Generate and print PDFs — crew list, passenger list, port of call, ship stores, crew effects, NIL list, ship money, cash advance, crew money list, narcotic list, MDH, and more |
| **Settings** | Ship stamp and signature, ports, ranks, nationalities, document packages per port |
| **Save to folder** | Save generated PDFs to a selected folder (click 📁 to add; **hold** 📁 to open the active folder in File Explorer) |

**Arrival / Departure lists** — when status is *Linked*, changes on Arrival apply to both lists. When lists have diverged, Departure is read-only for exit printing; use **FROM ARRIVAL** / **INTO ARRIVAL** to synchronise.

**Document packages** — configure per-port print sets in Settings; use **Open all** / **Print all** in the top bar for the current port of call.

---

## License and author

© WTOPM
