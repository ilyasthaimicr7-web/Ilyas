# AGENTS.md

Project configuration and conventions for Horror Studio AI.

## Project Type
Static web app (HTML/CSS/JS frontend) + Node.js Express backend (server.js).
Backend serves static files and provides secure API endpoints.
No build step. Uses CommonJS modules (`require()`).

## Dependencies
Installed via `npm install`. See `package.json`:
- `express` — web framework / static file serving / API routes
- `dotenv` — load `.env` secrets at server startup

## Running
```bash
npm install          # install dependencies (one-time)
npm start            # starts the Express server on PORT (default 8123)
```

## Linting & Formatting
This project uses no linter or compiler. Review changes manually.

```bash
# Quick HTML validation (if htmlhint is available)
npx htmlhint index.html
```

## API Key Security
- **NEVER** commit `.env`. It is in `.gitignore`.
- The Gemini API key is read from `process.env.GEMINI_API_KEY` on the server only.
- The frontend (`js/app.js`) never sees or handles the API key.
- Only `/css/`, `/js/`, and `index.html` are served as static files.

## Testing
Verify manually (phone-only workflow via Cloudflare Tunnel):

1. Start the backend: `npm start`
2. Tunnel to public URL: `npx cloudflared tunnel --url http://localhost:PORT`
3. Open the tunnel URL in Chrome on your Samsung A25.
4. Use Chrome DevTools → device emulator (or phone) to check responsive layout.
5. Test flow: enter idea → Generate Story → view output → Copy → Generate YouTube metadata → Copy.
6. See the testing checklist in `README.md`.

## Stage Progression
- Stage 1: Real AI story & metadata generation (current)
- Stage 2: Voice generation & subtitles
- Stage 3: Video rendering, YouTube OAuth upload, publishing rules
- Stage 4: Sound effects & music

See `ARCHITECTURE.md` for the full roadmap.
