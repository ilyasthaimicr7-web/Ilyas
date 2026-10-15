# AGENTS.md

Project configuration and conventions for Horror Studio AI.

## Project Type
Static web app — plain HTML, CSS, and JavaScript. No build step, no package.json.

## Linting & Formatting
This project uses no linter or compiler. Review changes manually.

```bash
# Quick HTML validation (if htmlhint is available)
npx htmlhint index.html

# Basic CSS check (if stylelint is available)
npx stylelint css/style.css
```

## Testing
There are no automated tests (UI prototype). Verify manually:

1. Open `index.html` in a modern browser (Chrome, Firefox, Safari, Edge).
2. Check the mobile-responsive design using browser DevTools device emulator.
3. See the testing checklist in `README.md`.
