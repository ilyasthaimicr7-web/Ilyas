# Horror Studio AI — Architecture & Stage Roadmap

> A mobile-friendly web app for creating original English horror stories for YouTube.
> **Current Stage: 1** (real AI generation implemented, tested, and live)

## Guiding Principles

1. **No API keys in browser JS** — secrets live only on the server.
2. **Phone-only operation** — everything works from a Samsung A25 via Kilo Cloud tunnel.
3. **Free-first** — prefer free tiers; always disclose limits.
4. **Transparent** — never pretend generation works when it doesn't; clear error messages.
5. **Stage-gated** — implement one stage at a time; nothing ships until tested.
6. **Private first** — test uploads are private by default; public publishing requires explicit enable.

---

## Project Structure

```
horror-studio-ai/
├── server.js              # Express backend (API + static files)
├── package.json           # Backend dependencies
├── .env.example           # Template — copy to .env, fill in keys
├── .env                   # REAL secrets (gitignored, never committed)
├── .gitignore
├── index.html             # Frontend markup
├── css/
│   └── style.css          # Dark cinematic horror theme + mobile styles
├── js/
│   └── app.js             # Frontend logic (calls backend API only)
├── lib/
│   ├── ai/
│   │   └── gemini.js      # Gemini API client (server-side only)
│   ├── prompts/
│   │   ├── story.js       # Story generation prompt builder
│   │   └── youtube.js     # YouTube metadata prompt builder
│   ├── storage.js         # [Placeholder] Published video log (Stage 3)
│   └── youtube/
│       └── oauth.js       # [Placeholder] YouTube OAuth + upload (Stage 3)
├── ARCHITECTURE.md        # This file
├── README.md              # Setup, usage, and testing guide
└── AGENTS.md              # Project conventions
```

## Stage Roadmap

### Stage 1 — Real AI Story & Metadata Generation  ✅ IN PROGRESS
**Status:** Backend implemented, syntax-verified, server starts, awaiting API key test.

| Requirement | Status |
|---|---|
| Secure Node.js backend (Express) | ✅ Done |
| API key loaded from `.env`, never sent to browser | ✅ Done |
| `/api/generate/story` → Gemini API | ✅ Done |
| `/api/generate/youtube` → title, description, thumbnail, production plan | ✅ Done |
| Video + Shorts format support (3/5/10 min, 30/45/60s) | ✅ Done |
| Error handling (missing key, quota, network, parse) | ✅ Done |
| Frontend calls real backend API | ✅ Done |
| Loading states + user-friendly messages | ✅ Done |
| Demo Mode preserved for offline UI testing | ✅ Done |
| Mobile-responsive UI (Samsung A25 verified) | ✅ Done |
| Free tier disclosure | ⏳ Pending user key |
| **Real AI test with live key** | 🔴 Pending user action |

### Stage 2 — Voice Generation & Subtitles  ⏳ NOT STARTED
- TTS integration (Google Cloud TTS or browser SpeechSynthesis as fallback).
- Waveform-style progress indicator.
- Subtitles (.srt) generated from the narration script.

### Stage 3 — Video Rendering & Publishing  ⏳ NOT STARTED
- Automated video assembly (narrator audio + background art + subtitles).
- YouTube OAuth flow for channel authorization.
- Private test uploads first; public publishing only after explicit enable.
- Configurable: upload limits, scheduling, duplicate prevention, publish log.

### Stage 4 — Sound Effects & Music  ⏳ NOT STARTED
- Licensed SFX library integration.
- Atmospheric music bed selection per story genre.
- Audio mixing (voice + music + SFX).

---

## Data Flow

```
Samsung A25 (browser)
    │  HTTPS (Cloudflare Tunnel)
    ▼
Kilo Cloud — Express server.js (port 8123)
    │
    ├── API key: process.env.GEMINI_API_KEY (from .env, server-side only)
    │
    ├── POST /api/generate/story
    │     → lib/prompts/story.js (build prompt)
    │     → lib/ai/gemini.js (call Gemini API)
    │     → returns { story, wordCount, format, length }
    │
    └── POST /api/generate/youtube
          → lib/prompts/youtube.js (build prompt)
          → lib/ai/gemini.js (call Gemini API)
          → returns { title, description, thumbnail, productionPlan, tags }
```

## Security Model

| Layer | Protection |
|---|---|
| Browser JS | No API keys. Only calls `/api/*` endpoints. |
| Backend | API key in `process.env`, loaded from `.env` at startup. |
| `.env` file | Listed in `.gitignore`. Never committed. |
| Static serving | Only `index.html`, `/css/`, `/js/` are served. `lib/`, `server.js`, `.env` are NOT accessible. |
| Tunnel | HTTPS via Cloudflare Tunnel (no self-hosted SSL needed). |

## Free Tier Disclosure

**Google Gemini (primary provider for Stage 1):**
- **Free tier:** No credit card required for sign-up at Google AI Studio.
- **Limits:** ~1,500 requests/day for Gemini 1.5 Flash / 2.0 Flash; 1,000 tokens/minute.
- **API key:** Required. User creates it at https://aistudio.google.com/apikey.
- **Cost:** Free within limits; pay-per-token if exceeded.
