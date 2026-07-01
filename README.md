# Waha PWA Builder

Offline-capable Warhammer 40k army list builder (11th edition). Data from [Wahapedia](https://wahapedia.ru/) and [MFM](https://mfm.warhammer-community.com/).

## Run locally (on your computer)

Commands run in a **terminal on your machine**, not in the GitHub website or GitHub Desktop UI.

1. **Clone the repo** (once):

   ```bash
   git clone https://github.com/sVuMPaR/WahaPWABuilder.git
   cd WahaPWABuilder
   ```

2. **Install dependencies** (Node.js 22+ required):

   ```bash
   npm install
   ```

3. **Start the dev server** (leave this terminal open):

   ```bash
   npm run dev
   ```

4. Open the URL Vite prints in the terminal:
   - On the **same computer**: `http://localhost:5173/`
   - From **phone on the same Wi‑Fi**: use the **Network** URL (e.g. `http://192.168.1.42:5173/`) — `localhost` on a phone means the phone itself, not your PC

### “Cannot access the site” / connection refused

| Cause | Fix |
|-------|-----|
| Dev server not running | Run `npm run dev` and keep the terminal open |
| Opened `localhost` on phone | Use the PC’s **Network** IP from the `npm run dev` output |
| Wrong folder | `cd` into the cloned repo (must contain `package.json`) |
| Node missing | Install [Node.js 22+](https://nodejs.org/), then `npm install` |
| Port in use | Stop other Vite apps or run `npm run dev -- --port 5174` |

Quick check on the PC:

```bash
cd WahaPWABuilder
npm install
npm run dev
```

You should see `VITE … ready` and `Local: http://localhost:5173/`. If the terminal shows errors instead, copy them when asking for help.

Rosters are stored in **IndexedDB in your browser** on that device. They are not synced to GitHub.

### Other commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the built app locally |
| `npm run data:update` | Re-fetch Wahapedia + MFM and rebuild data packs |

## GitHub Pages (hosted app)

After merge to `main`, CI deploys the built PWA to GitHub Pages. You can use the app in the browser without installing Node — open the Pages URL from the repository **Settings → Pages**.

That hosted version is the same app; only **where** you run `npm` commands differs:

- **Local development** → your terminal + `npm run dev`
- **Using the app** → browser (local dev URL or GitHub Pages)

## Features

- Faction browser with MFM points
- Roster builder: detachments, enhancements (up to 3), leader attachments, export/copy
- PWA offline support via service worker
