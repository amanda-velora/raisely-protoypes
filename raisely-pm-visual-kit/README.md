# Raisely visual kit — for Cursor (PM & design handoff)

This folder documents how to share **static files** (CSS, assets, HTML starters) with people who **cannot use GitHub** (for example because of org SAML/SSO). There is no server, no login, and no npm install required to **preview and tweak layouts**.

## What you get after building the bundle

Someone on your team runs the build script (once), then zips the output folder and shares it (Google Drive, Slack, email attachment, internal portal). PMs download and unzip.

The bundle contains:

| Path | Purpose |
|------|--------|
| `styles/` | Design tokens and component CSS (`tokens.css`, `components.css`, `pages.css`) |
| `assets/` | Font Awesome Pro kit and Raisely logo (same paths the CSS expects) |
| `design-system.html` | Live gallery of tokens and `r-*` components — open in a browser |
| `prototype-starter.html` | Minimal app shell (sidebar + main) to duplicate or edit |
| `README.md` | This file (copied into the bundle) |

All paths are **relative** (`./styles/…`, `./assets/…`), so the folder can live **anywhere** inside another project.

## Build the downloadable kit (maintainers / design ops)

From the **machine that already has this repo** (developer with Git access):

```bash
cd /path/to/raisely-prototype-kit
chmod +x scripts/build-pm-visual-kit.sh
./scripts/build-pm-visual-kit.sh
```

Output:

```text
dist/raisely-pm-visual-kit/
```

Zip that directory and distribute:

```bash
cd dist && zip -r raisely-pm-visual-kit.zip raisely-pm-visual-kit
```

## Add the kit to an existing Cursor project (PMs)

1. Unzip `raisely-pm-visual-kit.zip`.
2. Move the folder into the project, for example:
   - `docs/raisely-visual-kit/`, or
   - `_design/raisely-kit/`, or
   - `vendor/raisely-visual-kit/`
3. In Cursor: **File → Add Folder to Workspace…** and pick that folder *if* you want it in the sidebar alongside the main repo. Otherwise, leaving it as a subfolder of an already-opened project is enough.
4. Preview in a browser:
   - **Terminal:** `cd docs/raisely-visual-kit` (or your path) then  
     `python3 -m http.server 8765`  
     Open `http://localhost:8765/design-system.html` and `http://localhost:8765/prototype-starter.html`  
     (Use another port if `8765` is busy, e.g. `8766`.)
   - Or use any “Live Preview” / “Open with Live Server” extension pointed at those HTML files.

## Making visual updates with your components

1. Open **`design-system.html`** to see every supported class (buttons, fields, pills, progress, layout shells).
2. Copy patterns from **`prototype-starter.html`** or from internal examples your team ships separately.
3. Prefer **only**:
   - CSS variables from `styles/tokens.css` (e.g. `var(--primary)`, `var(--space-4)`), and  
   - Component classes from `styles/components.css` (`r-btn`, `r-field`, …).
4. Ask Cursor in natural language, for example:  
   *“Using only classes from `design-system.html`, add a donation card with tier buttons and a progress bar.”*  
   Attach or `@` the `design-system.html` / `styles` files so the model follows your system.

## SSO / SAML and GitHub

- **Problem:** PMs often do not have (or do not want) GitHub Enterprise SSO linked to their laptop, so `git clone` of a private org repo fails.
- **Workaround:** Treat this kit as a **release artifact**: engineers build `dist/raisely-pm-visual-kit`, publish the zip through a channel PMs already use. No Git required on their side.
- **Optional:** Put the same zip on an internal wiki or artifact store with versioning (`raisely-pm-visual-kit-v0.2.zip`).

## Updating the kit when the design system changes

Whenever `styles/` or `assets/` change on `main` (or your release branch), re-run `./scripts/build-pm-visual-kit.sh`, re-zip, and bump the filename or release notes.

## Limitations (set expectations)

- This is **static HTML + CSS**, not React/Vue. PMs prototype **structure and visuals**; engineers later map patterns to production components.
- Font Awesome **Pro** files ship in `assets/`; treat the zip as **internal-only** per your Font Awesome license.
- Large zips (~15 MB) are normal because of webfonts; that is still practical for Drive/Slack in most orgs.

## Optional: Cursor rules in the *receiving* project

So every chat in their repo remembers the design system, add a rule under **their** project:

`.cursor/rules/raisely-visual-kit.mdc`

Use the snippet in `pm-cursor-pack/cursor-rule-snippet.md` from this repo as a starting point (copy into their repo and adjust paths to where they placed the kit).
