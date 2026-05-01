# Optional Cursor rule for the *receiving* project

Save the following as `.cursor/rules/raisely-visual-kit.mdc` inside the PM’s Cursor project (not inside the zip unless you want it there). Edit the `globs` path to match where they placed the kit (example uses `docs/raisely-visual-kit/`).

----- BEGIN FILE: raisely-visual-kit.mdc -----

---
description: Raisely static visual kit — tokens and r-* components only
globs:
  - "docs/raisely-visual-kit/**"
---

# Raisely visual kit (handoff)

When editing HTML/CSS under the Raisely visual kit folder:

- Use design tokens from `styles/tokens.css` — avoid one-off hex for brand colors; use `var(--…)` tokens.
- Use component classes from `styles/components.css` — all prefixed with `r-*` (see `design-system.html` in the kit).
- Prefer layout patterns from `styles/pages.css` (for example `.app`, `.sidebar`, `.main`, `.card`).
- Open `design-system.html` in a browser for the live component gallery.

----- END FILE -----
