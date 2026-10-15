# Horror Studio AI

A mobile-friendly web app for crafting original English horror stories for YouTube.

> **Version 0.1 — UI Prototype.** Story generation is not yet connected to an AI service. See [Connecting an AI Service](#-connecting-an-ai-service) below.

---

## Project Structure

```
horror-studio-ai/
├── index.html          # App markup
├── css/
│   └── style.css       # Dark cinematic horror theme + mobile styles
├── js/
│   └── app.js          # UI logic + AI service stub
├── README.md           # This file
└── AGENTS.md           # Project config (lint, test, etc.)
```

No build step is required. All files are plain HTML/CSS/JavaScript.

---

## Features

- **Dark cinematic horror theme** — deep blacks, crimson accents, subtle film-grain and flicker animations.
- **Mobile-first** — fully responsive, iOS- and Android-friendly, with large touch targets and `user-scalable=no` viewport.
- **Story idea input** — text field for your horror concept.
- **Story length selector** — dropdown for 3, 5, or 10 minute stories.
- **Generate Story** — produces a horror story based on your idea and selected length.
- **Demo Mode** — a toggle that fills the UI with clearly-labeled placeholder content so you can test every button flow without an AI backend.
- **Copy Story** — copies the generated story to your clipboard.
- **YouTube metadata** — generates (or previews) a title and description, with a copy button.

---

## How It Works

| Scenario | Behavior |
|---|---|
| No AI service connected (default) | "Generate Story" shows a status notice explaining that no service is connected, unless **Demo Mode** is enabled. |
| Demo Mode ON | The app displays clearly-labeled `[DEMO]` placeholder content so you can test the full UI. |
| AI service connected | Set `AI_SERVICE_CONNECTED = true` in `js/app.js` and implement `callAiService()` to send ideas to your backend. |

**Important:** By default the app never pretends AI generation is working. It either shows a notice or uses transparently-labeled demo content.

---

## Connecting an AI Service

The app is ready for a backend. To enable real generation:

1. **Set the flag** in `js/app.js` — change `AI_SERVICE_CONNECTED` to `true`.
2. **Implement the stub** — replace the commented-out `callAiService()` function with a real call to your backend or an AI API (OpenAI, Anthropic, Ollama, Gemini, etc.).
3. **Point to your endpoint** — update `API_ENDPOINT` if your server lives at a different URL.

Your backend should return:
- For stories: `{ story: "string" }`
- For YouTube metadata: `{ title: "string", description: "string" }`

Example backend stub (Node/Express):

```js
app.post('/api/generate', async (req, res) => {
  const { idea, length, type } = req.body;
  // Call your AI provider here. No paid services are required —
  // you can run Ollama locally with a small model.
  res.json({ story: generatedText });
});
```

---

## Preview & Testing

### On your phone (Android)

The simplest way is to serve the files over your local Wi-Fi so your phone and computer are on the same network.

1. **Install a static server** (Node.js required):

   ```bash
   npm install -g serve
   ```

2. **Start the server** from the project folder:

   ```bash
   serve
   ```

   You'll see a URL like `http://localhost:3000`.

3. **Find your computer's local IP address**:

   - **Windows:** `ipconfig` → look for IPv4 Address.
   - **macOS / Linux:** `ifconfig | grep "inet "` → look for your Wi-Fi IP (e.g. `192.168.1.10`).

4. **On your phone**, open the Chrome browser and go to:

   ```
   http://YOUR_COMPUTER_IP:3000
   ```

   Example: `http://192.168.1.10:3000`

5. The app is mobile-optimized — you can **Add to Home Screen** from Chrome's menu (⋮ → *Add to Home screen*) for an app-like experience.

> **Tip:** If your phone can't reach the address, make sure both devices are on the same Wi-Fi network and that no firewall is blocking port 3000.

### On desktop

Open `index.html` directly in any modern browser:

```bash
# If you have serve installed:
serve

# Or just double-click index.html — though a local server avoids
# browser security restrictions on some features.
```

---

## Testing Checklist

- [ ] Story idea textarea accepts input on mobile keyboard.
- [ ] Length dropdown shows 3 / 5 / 10 minutes and is tappable.
- [ ] "Generate Story" shows a notice when no service + Demo Mode is off.
- [ ] With "Demo Mode" ON, a sample story appears in the output box.
- [ ] "Copy Story" copies the text to the phone's clipboard.
- [ ] "Generate YouTube Title & Description" works after a story is generated.
- [ ] "Copy Metadata" copies the placeholder title + description.
- [ ] Layout looks correct in both portrait and landscape on a small phone.
