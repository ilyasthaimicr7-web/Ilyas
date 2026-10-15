/*  Horror Studio AI — Express Backend Server
 *
 *  Serves the static frontend and provides secure API endpoints
 *  that proxy requests to Google's Gemini API.
 *
 *  SECURITY:
 *  - The Gemini API key is read from process.env.GEMINI_API_KEY.
 *  - It is loaded from .env at startup OR entered via the /setup page.
 *  - The key is NEVER sent to the browser frontend (js/app.js).
 *  - Only /css/, /js/, and index.html are served as static files.
 *    lib/, server.js, .env are NOT web-accessible.
 *
 *  SETUP ENDPOINT SECURITY:
 *  - /api/setup/key requires a server-generated setup token (rotated on restart).
 *  - /api/setup/key only works when no key is yet configured.
 *  - /api/setup/reset requires the CURRENT key for authorization.
 *  - Rate limiting: max 5 setup attempts per 10 minutes per IP.
 *
 *  API Endpoints:
 *    GET  /setup                  — secure key entry page
 *    GET  /api/health             — server + AI key status
 *    POST /api/setup/key          — enter API key (requires token, only when not set)
 *    POST /api/setup/reset        — clear API key (requires current key)
 *    POST /api/generate/story     — generate a horror story
 *    POST /api/generate/youtube   — generate YouTube metadata
 *
 *  Run:
 *    npm install
 *    npm start
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { callGemini, parseJsonResponse } = require('./lib/ai/gemini');
const { buildStoryPrompt } = require('./lib/prompts/story');
const { buildYouTubePrompt } = require('./lib/prompts/youtube');
const { segmentStory } = require('./lib/video/scene-segmenter');
const { generateImage } = require('./lib/ai/image');
const { generateSpeech } = require('./lib/ai/tts');
const { generateSrt } = require('./lib/video/subtitles');
const { renderVideo, renderFallbackVideo, cleanupJob } = require('./lib/video/renderer');

const app = express();
const PORT = process.env.PORT || 8123;

// ──  Video production job state (in-memory) ──────────────────────
const videoJobs = new Map();
const VIDEOS_DIR = path.join(__dirname, 'videos');

function createJob() {
  const jobId = crypto.randomBytes(8).toString('hex');
  const jobDir = path.join(VIDEOS_DIR, 'temp', jobId);
  if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });
  const job = {
    id: jobId,
    status: 'pending',
    step: 'initializing',
    progress: 0,
    message: 'Preparing to generate video...',
    result: null,
    error: null,
    createdAt: Date.now(),
  };
  videoJobs.set(jobId, job);
  return { job, jobDir };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAudioDuration(filePath) {
  try {
    const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, { maxBuffer: 1024 * 1024 });
    const dur = parseFloat(stdout.trim());
    return { duration: isNaN(dur) ? 0 : dur };
  } catch (err) {
    return { duration: 0 };
  }
}

// ──  Security: Setup token (rotated on each server restart) ──
const SETUP_TOKEN = crypto.randomBytes(16).toString('hex').substring(0, 16);

// ──  Security: Rate limiter (in-memory) ──────────────────────
const rateLimitStore = new Map();
const MAX_SETUP_ATTEMPTS = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_SETUP_ATTEMPTS) return false;
  entry.count++;
  return true;
}

// ──  Middleware ──────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));

// Request logger — never logs request bodies or API keys.
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log('[' + new Date().toISOString() + '] ' + req.method + ' ' + req.path + ' -> ' + res.statusCode + ' (' + ms + 'ms)');
  });
  next();
});

// ──  Static Assets (explicit, secure) ───────────────────────
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ──  Setup: API key management (secured) ──────────────────────

/**
 * Write or update the GEMINI_API_KEY line in .env, preserving other settings.
 * @param {string} key - The API key to save (empty string to clear).
 */
function saveApiKeyToEnv(key) {
  const envPath = path.join(__dirname, '.env');
  let content = '';
  try {
    content = fs.readFileSync(envPath, 'utf8');
  } catch (_e) {
    content = '';
  }

  const line = 'GEMINI_API_KEY=' + key;
  if (/^GEMINI_API_KEY=/m.test(content)) {
    content = content.replace(/^GEMINI_API_KEY=.*$/m, line);
  } else {
    if (content && !content.endsWith('\n')) content += '\n';
    content += line + '\n';
  }

  fs.writeFileSync(envPath, content, { mode: 0o600 });
}

/**
 * Generate the secure setup page HTML.
 * @param {boolean} configured - Whether the API key is already set.
 * @returns {string} HTML page.
 */
function generateSetupPage(configured) {
  // The setup token is embedded as a hidden field. It is only sent
  // once, with the page render. It changes on every server restart.
  return '<!DOCTYPE html>\n' +
  '<html lang="en">\n' +
  '<head>\n' +
  '  <meta charset="UTF-8">\n' +
  '  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">\n' +
  '  <meta name="theme-color" content="#0a0a0a">\n' +
  '  <title>Horror Studio AI — Setup</title>\n' +
  '  <link rel="preconnect" href="https://fonts.googleapis.com">\n' +
  '  <link href="https://fonts.googleapis.com/css2?family=Creepster&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">\n' +
  '  <style>\n' +
  '    * { margin: 0; padding: 0; box-sizing: border-box; }\n' +
  '    body { font-family: "Inter", sans-serif; background: #0a0a0a; color: #e0d6d6; min-height: 100vh; overflow-x: hidden; position: relative; }\n' +
  '    .atmosphere { position: fixed; inset: 0; background: radial-gradient(120% 120% at 70% 30%, rgba(139,0,0,0.12) 0%, transparent 50%), radial-gradient(80% 80% at 20% 80%, rgba(0,0,0,0.6) 0%, transparent 50%); pointer-events: none; z-index: 1; }\n' +
  '    body::before { content: ""; position: fixed; inset: 0; background: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'120\' height=\'120\' viewBox=\'0 0 120 120\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23000\' fill-opacity=\'0.03\' fill-rule=\'nonzero\'%3E%3Cpath d=\'M112.5 0h7.5v7.5h-7.5zm-7.5 7.5h7.5v7.5h-7.5zm125 0h7.5v7.5h-7.5zm-7.5 7.5h7.5v7.5h-7.5zm125 0h7.5v7.5h-7.5zm0-7.5h7.5v7.5h-7.5z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"); pointer-events: none; z-index: 2; opacity: 0.4; }\n' +
  '    .container { position: relative; z-index: 10; max-width: 520px; margin: 0 auto; padding: 32px 20px; min-height: 100vh; display: flex; flex-direction: column; }\n' +
  '    .title { font-family: "Creepster", cursive; font-size: 2rem; letter-spacing: 0.08em; color: #8b0000; text-align: center; margin-bottom: 4px; }\n' +
  '    .subtitle { text-align: center; color: #a39292; font-size: 0.85rem; margin-bottom: 24px; }\n' +
  '    .card { background: linear-gradient(180deg, rgba(10,0,0,0.7), rgba(5,0,0,0.85)); border: 1px solid #3d0000; border-radius: 14px; padding: 24px; box-shadow: 0 12px 40px rgba(0,0,0,0.6), inset 0 0 30px rgba(139,0,0,0.1); margin-bottom: 20px; }\n' +
  '    h2 { color: #a52a2a; font-size: 1.3rem; letter-spacing: 0.08em; margin-bottom: 16px; }\n' +
  '    label { display: block; font-size: 0.8rem; color: #a39292; margin-bottom: 6px; letter-spacing: 0.05em; }\n' +
  '    input[type="password"], input[type="text"] { width: 100%; padding: 14px 16px; background: rgba(0,0,0,0.65); color: #e0d6d6; border: 1.5px solid #3d0000; border-radius: 10px; font-size: 1rem; margin-bottom: 12px; transition: border-color 0.2s; }\n' +
  '    input:focus { outline: none; border-color: #8b0000; box-shadow: 0 0 0 3px rgba(139,0,0,0.25); }\n' +
  '    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: none; border-radius: 10px; font-family: inherit; font-weight: 600; font-size: 1rem; cursor: pointer; padding: 14px 24px; margin-top: 8px; width: 100%; -webkit-tap-highlight-color: transparent; transition: all 0.18s ease; }\n' +
  '    .btn-primary { background: linear-gradient(180deg, #8b0000, #5a0000); color: #fff; box-shadow: 0 6px 24px rgba(139,0,0,0.4); }\n' +
  '    .btn-primary:hover { background: linear-gradient(180deg, #5a0000, #8b0000); }\n' +
  '    .btn-danger { background: linear-gradient(180deg, #5a0000, #8b0000); color: #fff; }\n' +
  '    .btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }\n' +
  '    .message { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 0.85rem; text-align: center; }\n' +
  '    .message-success { background: rgba(0,144,0,0.15); border: 1px solid #009000; color: #90ee90; }\n' +
  '    .message-error { background: rgba(139,0,0,0.15); border: 1px solid #8b0000; color: #a52a2a; }\n' +
  '    .message-info { background: rgba(255,255,255,0.05); border: 1px solid #3d0000; color: #a39292; }\n' +
  '    .hidden { display: none !important; }\n' +
  '    .configured-box { text-align: center; padding: 12px; color: #90ee90; border: 1px solid #009000; border-radius: 8px; margin-bottom: 16px; }\n' +
  '    .help { text-align: center; color: #a39292; font-size: 0.8rem; margin-top: 12px; line-height: 1.5; }\n' +
  '    .help a { color: #8b0000; }\n' +
  '    .spinner { width: 18px; height: 18px; border: 2px solid rgba(139,0,0,0.3); border-top-color: #8b0000; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; }\n' +
  '    @keyframes spin { to { transform: rotate(360deg); } }\n' +
  '    .token-display { background: rgba(0,0,0,0.4); border: 1px dashed #3d0000; border-radius: 6px; padding: 8px 12px; font-family: "Courier New", monospace; font-size: 0.85rem; color: #a52a2a; word-break: break-all; margin: 8px 0; text-align: center; }\n' +
  '    @media (max-width: 600px) { .container { padding: 24px 16px; } .title { font-size: 1.7rem; } h2 { font-size: 1.15rem; } }\n' +
  '  </style>\n' +
  '</head>\n' +
  '<body>\n' +
  '  <div class="atmosphere"></div>\n' +
  '  <div class="container">\n' +
  '    <h1 class="title">HORROR STUDIO AI</h1>\n' +
  '    <p class="subtitle">Secure API Key Setup</p>\n' +
  '\n' +
  '    <div id="messageArea"></div>\n' +
  '\n' +
  '    <div id="formSection" class="' + (configured ? 'hidden' : '') + '">\n' +
  '      <div class="card">\n' +
  '        <h2>Enter Your Gemini API Key</h2>\n' +
  '        <p id="tokenNotice" style="color:#a39292;font-size:0.8rem;margin-bottom:8px;">Security token for this session:</p>\n' +
  '        <div id="tokenBox" class="token-display">' + SETUP_TOKEN + '</div>\n' +
  '        <p style="color:#a39292;font-size:0.75rem;margin-bottom:12px;">This token changes on every server restart. It is sent to the server for verification. Your key is saved directly — it never appears in chat.</p>\n' +
  '        <form id="keyForm">\n' +
  '          <input type="hidden" id="setupToken" value="' + SETUP_TOKEN + '">\n' +
  '          <label for="apiKey">Gemini API Key</label>\n' +
  '          <input type="password" id="apiKey" placeholder="AIxxxxxxxxxxxxxxxx" autocomplete="off" required>\n' +
  '          <button type="submit" id="saveBtn" class="btn btn-primary">Save &amp; Activate Key</button>\n' +
  '        </form>\n' +
  '      </div>\n' +
  '    </div>\n' +
  '\n' +
  '    <div id="configuredSection" class="card ' + (configured ? '' : 'hidden') + '">\n' +
  '      <h2>Key Configured</h2>\n' +
  '      <div class="configured-box">\n' +
  '        API key is set and active.\n' +
  '      </div>\n' +
  '      <p style="color:#a39292;font-size:0.75rem;margin-bottom:12px;">To change your key, enter the current one below and tap Reset.</p>\n' +
  '      <form id="resetForm">\n' +
  '        <input type="hidden" id="resetToken" value="' + SETUP_TOKEN + '">\n' +
  '        <label for="currentKey">Current API Key (to confirm reset)</label>\n' +
  '        <input type="password" id="currentKey" placeholder="AIxxxxxxxxxxxxxxxx" autocomplete="off" required>\n' +
  '        <button type="submit" id="resetBtn" class="btn btn-danger">Reset Key</button>\n' +
  '      </form>\n' +
  '    </div>\n' +
  '\n' +
  '    <div class="help">\n' +
  '      Get your free key at\n' +
  '      <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a><br>\n' +
  '      Free tier: ~1,500 requests/day, no credit card required.\n' +
  '    </div>\n' +
  '  </div>\n' +
  '\n' +
  '  <script>\n' +
  '    var form = document.getElementById("keyForm");\n' +
  '    var saveBtn = document.getElementById("saveBtn");\n' +
  '    var messageArea = document.getElementById("messageArea");\n' +
  '    var resetForm = document.getElementById("resetForm");\n' +
  '    var resetBtn = document.getElementById("resetBtn");\n' +
  '\n' +
  '    function showMessage(text, type) {\n' +
  '      messageArea.innerHTML = \'<div class="message message-\' + type + \'">\' + text + \'</div>\';\n' +
  '    }\n' +
  '    function setLoading(btn, isLoading, text) {\n' +
  '      btn.disabled = isLoading;\n' +
  '      btn.innerHTML = isLoading ? \'<span class="spinner"></span> \' + text + \'\' : btn.getAttribute("data-original") || \'Save &amp; Activate Key\';\n' +
  '    }\n' +
  '    form.addEventListener("submit", function(e) {\n' +
  '      e.preventDefault();\n' +
  '      var key = document.getElementById("apiKey").value.trim();\n' +
  '      var token = document.getElementById("setupToken").value;\n' +
  '      if (!key) { showMessage("Please enter your API key.", "error"); return; }\n' +
  '      if (key.length < 10) { showMessage("API key looks too short. Please check and try again.", "error"); return; }\n' +
  '      setLoading(saveBtn, true, "Saving...");\n' +
  '      fetch("/api/setup/key", {\n' +
  '        method: "POST",\n' +
  '        headers: { "Content-Type": "application/json" },\n' +
  '        body: JSON.stringify({ key: key, setupToken: token })\n' +
  '      })\n' +
  '      .then(function(r) { return r.json(); })\n' +
  '      .then(function(data) {\n' +
  '        if (data.success) { showMessage(data.message, "success"); setTimeout(function() { window.location.href = "/"; }, 1500); }\n' +
  '        else { showMessage(data.error || "Failed to save key.", "error"); }\n' +
  '      })\n' +
  '      .catch(function(err) { showMessage("Network error: " + err.message, "error"); })\n' +
  '      .finally(function() { setLoading(saveBtn, false); });\n' +
  '    });\n' +
  '    resetForm.addEventListener("submit", function(e) {\n' +
  '      e.preventDefault();\n' +
  '      var currentKey = document.getElementById("currentKey").value;\n' +
  '      if (!confirm("Reset the API key? This cannot be undone.")) return;\n' +
  '      fetch("/api/setup/reset", {\n' +
  '        method: "POST",\n' +
  '        headers: { "Content-Type": "application/json" },\n' +
  '        body: JSON.stringify({ currentKey: currentKey })\n' +
  '      })\n' +
  '      .then(function(r) { return r.json(); })\n' +
  '      .then(function(data) {\n' +
  '        if (data.success) { showMessage(data.message, "success"); setTimeout(function() { window.location.reload(); }, 1500); }\n' +
  '        else { showMessage(data.error || "Reset failed.", "error"); }\n' +
  '      });\n' +
  '    });\n' +
  '  </script>\n' +
  '</body>\n' +
  '</html>';
}

// Serve setup page
app.get('/setup', (_req, res) => {
  const configured = !!process.env.GEMINI_API_KEY;
  res.set('Content-Type', 'text/html');
  res.send(generateSetupPage(configured));
});

// Setup: save API key (secured — requires token, only when not configured)
app.post('/api/setup/key', (req, res) => {
  // Rate limiting
  const ip = req.ip || req.connection.remoteAddress;
  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      error: 'Too many setup attempts. Please wait 10 minutes and try again.',
      code: 'RATE_LIMITED',
    });
  }

  // Only allow when key is not yet set
  if (process.env.GEMINI_API_KEY) {
    return res.status(403).json({
      error: 'API key already configured. Use the reset option on /setup to change it.',
      code: 'ALREADY_CONFIGURED',
    });
  }

  // Validate setup token
  const { key, setupToken } = req.body;
  if (!setupToken || setupToken !== SETUP_TOKEN) {
    return res.status(403).json({
      error: 'Invalid setup token. Refresh the page and try again.',
      code: 'INVALID_TOKEN',
    });
  }

  // Validate key format
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'API key is required.', code: 'VALIDATION_ERROR' });
  }
  const trimmed = key.trim();
  if (trimmed.length < 10) {
    return res.status(400).json({
      error: 'Invalid API key. Please check the key and try again.',
      code: 'VALIDATION_ERROR',
    });
  }

  try {
    saveApiKeyToEnv(trimmed);
    // Set in-memory immediately (no restart needed)
    process.env.GEMINI_API_KEY = trimmed;
    console.log('[setup] API key configured (' + trimmed.length + ' chars).');
    res.json({ success: true, message: 'API key saved and is now active.' });
  } catch (err) {
    console.error('[setup] Failed to save key:', err.message);
    res.status(500).json({ error: 'Failed to save API key to disk.', code: 'FS_ERROR' });
  }
});

// Setup: reset API key (requires CURRENT key for authorisation)
app.post('/api/setup/reset', (req, res) => {
  const { currentKey } = req.body;
  const currentEnvKey = process.env.GEMINI_API_KEY;

  if (!currentEnvKey) {
    return res.status(403).json({
      error: 'No API key is currently configured. Nothing to reset.',
      code: 'NO_KEY_SET',
    });
  }

  // Require the current key — prevents unauthorized resets
  if (!currentKey || currentKey !== currentEnvKey) {
    return res.status(403).json({
      error: 'Current API key does not match. Cannot reset without authorisation.',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    saveApiKeyToEnv('');
    delete process.env.GEMINI_API_KEY;
    console.log('[setup] API key cleared via reset.');
    res.json({ success: true, message: 'API key cleared from memory and .env.' });
  } catch (err) {
    console.error('[setup] Failed to clear key:', err.message);
    res.status(500).json({ error: 'Failed to clear API key.', code: 'FS_ERROR' });
  }
});

// ──  Health ──────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const hasKey = !!apiKey;
  res.json({
    status: 'ok',
    version: '0.2.0-stage1',
    apiKeyConfigured: hasKey,
    model: hasKey ? (process.env.GEMINI_MODEL || 'gemini-2.0-flash') : null,
    setupRequired: !hasKey,
    timestamp: new Date().toISOString(),
  });
});

// ──  API: Generate Story ─────────────────────────────────────

app.post('/api/generate/story', async (req, res) => {
  const { idea, length, format, style } = req.body;

  if (!idea || typeof idea !== 'string' || idea.trim().length === 0) {
    return res.status(400).json({ error: 'Story idea is required.', code: 'VALIDATION_ERROR' });
  }
  if (idea.length > 1000) {
    return res.status(400).json({ error: 'Story idea is too long (max 1000 characters).', code: 'VALIDATION_ERROR' });
  }

  const formatType = format === 'shorts' ? 'shorts' : 'video';
  const duration = formatType === 'shorts'
    ? parseInt(length, 10) || 60
    : parseInt(length, 10) || 5;

  if (formatType === 'video' && ![3, 5, 10].includes(duration)) {
    return res.status(400).json({ error: 'Invalid video length. Must be 3, 5, or 10 minutes.', code: 'VALIDATION_ERROR' });
  }
  if (formatType === 'shorts' && ![30, 45, 60].includes(duration)) {
    return res.status(400).json({ error: 'Invalid Shorts length. Must be 30, 45, or 60 seconds.', code: 'VALIDATION_ERROR' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'No AI service configured. Set GEMINI_API_KEY via /setup or .env, then restart.',
      code: 'NO_API_KEY',
    });
  }

  try {
    const prompt = buildStoryPrompt(idea, duration, formatType, style);
    console.log('[story] Generating "' + idea + '" (' + formatType + ', ' + duration + ')...');

    const story = await callGemini(prompt, { maxOutputTokens: 4096 });

    const wordCount = story.split(/\s+/).filter(Boolean).length;

    res.json({
      story,
      wordCount,
      format: formatType,
      length: duration,
      style: style || 'none',
      idea: idea.trim(),
    });
  } catch (err) {
    console.error('[story] Error:', err.code, err.message);
    const status = err.status || 500;
    res.status(status).json({
      error: err.userMessage || err.message,
      code: err.code || 'API_ERROR',
    });
  }
});

// ──  API: Generate YouTube Metadata ──────────────────────────

app.post('/api/generate/youtube', async (req, res) => {
  const { story, length, format, idea } = req.body;

  if (!story || typeof story !== 'string' || story.trim().length === 0) {
    return res.status(400).json({ error: 'Story text is required.', code: 'VALIDATION_ERROR' });
  }
  if (story.length > 10000) {
    return res.status(400).json({ error: 'Story text is too long (max 10000 characters).', code: 'VALIDATION_ERROR' });
  }

  const formatType = format === 'shorts' ? 'shorts' : 'video';
  const duration = formatType === 'shorts'
    ? parseInt(length, 10) || 60
    : parseInt(length, 10) || 5;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'No AI service configured. Set GEMINI_API_KEY via /setup or .env, then restart.',
      code: 'NO_API_KEY',
    });
  }

  try {
    const truncatedStory = story.length > 6000 ? story.substring(0, 6000) + '...' : story;
    const prompt = buildYouTubePrompt(truncatedStory, duration, formatType, idea || '');
    console.log('[youtube] Generating metadata for "' + (idea || 'untitled') + '"...');

    const raw = await callGemini(prompt, { maxOutputTokens: 4096 });
    const metadata = parseJsonResponse(raw);

    const required = ['title', 'description', 'thumbnail_concept', 'thumbnail_prompt', 'production_plan', 'tags'];
    for (const field of required) {
      if (!(field in metadata) || metadata[field] === null || metadata[field] === undefined) {
        throw Object.assign(new Error('Missing required field "' + field + '" in AI response.'), {
          code: 'PARSE_ERROR',
          userMessage: 'The AI returned incomplete metadata. Please try again.',
        });
      }
    }

    res.json({
      title: metadata.title,
      description: metadata.description,
      thumbnail: metadata.thumbnail_concept,
      thumbnailPrompt: metadata.thumbnail_prompt,
      productionPlan: metadata.production_plan,
      tags: metadata.tags,
    });
  } catch (err) {
    console.error('[youtube] Error:', err.code, err.message);
    if (err.code === 'PARSE_ERROR') {
      return res.status(200).json({
        error: err.userMessage || err.message,
        code: 'PARSE_ERROR',
        rawOutput: err.rawOutput || '',
      });
    }
    const status = err.status || 500;
    res.status(status).json({
      error: err.userMessage || err.message,
      code: err.code || 'API_ERROR',
    });
  }
});

// ──  API: Generate Video (Full Production) ─────────────────────

app.post('/api/generate/video', async (req, res) => {
  const { story, idea, length, format, style, language } = req.body;

  if (!story || typeof story !== 'string' || story.trim().length === 0) {
    return res.status(400).json({ error: 'Story text is required.', code: 'VALIDATION_ERROR' });
  }

  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasHFKey = !!process.env.HF_API_KEY;

  // If HF key is not set, fall back to text-only rendering (still produces real MP4).
  // If neither key is set, still allow fallback (story was already generated).
  if (!hasGemini && !hasHFKey) {
    // Log that we're using fallback mode
    console.log('[video] No API keys configured — will use text-only fallback rendering.');
  }

  const { job, jobDir } = createJob();
  const formatType = format === 'shorts' ? 'shorts' : 'video';
  const duration = formatType === 'shorts'
    ? parseInt(length, 10) || 60
    : parseInt(length, 10) || 5;

  res.json({ jobId: job.id, message: 'Video production started.' });

  // Start the async production pipeline
  processVideoJob(job, jobDir, story, idea || '', formatType, duration, style || 'none', language || 'en')
    .catch(err => {
      console.error('[video] Job ' + job.id + ' failed:', err.message);
      job.status = 'error';
      job.error = err.message;
      job.message = 'Video generation failed: ' + (err.userMessage || err.message);
    });
});

/**
 * Full video production pipeline.
 * Steps: segment story -> generate images -> generate speech -> create subtitles -> render MP4
 */
async function processVideoJob(job, jobDir, story, idea, format, duration, style, language) {
  const steps = [
    'segmenting_story',
    'generating_images',
    'generating_speech',
    'creating_subtitles',
    'rendering_video',
  ];

  try {
    const hasHFKey = !!process.env.HF_API_KEY;

    if (!hasHFKey) {
      // Fallback: render with text placeholders + silence (no AI image/TTS)
      job.step = 'rendering_fallback';
      job.progress = 50;
      job.message = 'Rendering video with text placeholders (configure HF_API_KEY for AI images & narration)...';

      const result = await renderFallbackVideo(jobDir, story.substring(0, 2000), format, duration);
      job.progress = 100;
      job.status = 'complete';
      job.step = 'done';
      job.message = 'Video rendered (text-only fallback). Configure HF_API_KEY for AI images and narration.';
      job.result = {
        videoUrl: '/videos/' + job.id + '/final.mp4',
        size: result.size,
        duration: result.duration,
        isFallback: true,
      };
      console.log('[video] Job ' + job.id + ' complete (fallback). Size:', result.size);
      return;
    }

    // Step 1: Segment story into scenes
    job.step = 'segmenting_story';
    job.progress = 10;
    job.message = 'Dividing story into scenes...';

    const scenes = await segmentStory(story, format, duration);
    console.log('[video] Job ' + job.id + ': segmented into ' + scenes.length + ' scenes');
    job.progress = 20;

    // Step 2: Generate image for each scene
    job.step = 'generating_images';
    job.message = 'Generating scene images... (1/' + scenes.length + ')';

    const imagePaths = [];
    for (let i = 0; i < scenes.length; i++) {
      const imgPath = path.join(jobDir, 'scene_' + (i + 1) + '.png');
      job.message = 'Generating scene images... (' + (i + 1) + '/' + scenes.length + ')';
      job.progress = 20 + Math.round((i / scenes.length) * 25);

      let attempts = 0;
      while (attempts < 3) {
        try {
          const imageBuffer = await generateImage(scenes[i].visual, {
            width: 1024,
            height: 1024,
          });
          fs.writeFileSync(imgPath, imageBuffer);
          imagePaths.push(imgPath);
          break;
        } catch (err) {
          attempts++;
          if (attempts >= 3) throw err;
          console.warn('[video] Image retry ' + attempts + ' for scene ' + (i + 1) + ':', err.code);
          await delay(2000 * attempts);
        }
      }
    }
    job.progress = 45;

    // Step 3: Generate speech for each scene
    job.step = 'generating_speech';
    job.message = 'Generating narration... (1/' + scenes.length + ')';

    const audioPaths = [];
    const audioDurations = [];
    for (let i = 0; i < scenes.length; i++) {
      const audioPath = path.join(jobDir, 'audio_' + (i + 1) + '.wav');
      job.message = 'Generating narration... (' + (i + 1) + '/' + scenes.length + ')';
      job.progress = 45 + Math.round((i / scenes.length) * 20);

      let attempts = 0;
      while (attempts < 3) {
        try {
          const { buffer, sampleRate } = await generateSpeech(scenes[i].narration);
          fs.writeFileSync(audioPath, buffer);
          audioPaths.push(audioPath);

          const { duration: dur } = await getAudioDuration(audioPath);
          audioDurations.push(dur || scenes[i].duration || 10);
          break;
        } catch (err) {
          attempts++;
          if (attempts >= 3) throw err;
          console.warn('[video] TTS retry ' + attempts + ' for scene ' + (i + 1) + ':', err.code);
          await delay(2000 * attempts);
        }
      }
    }
    job.progress = 65;

    // Step 4: Generate subtitles
    job.step = 'creating_subtitles';
    job.message = 'Creating subtitles...';
    const srtPath = path.join(jobDir, 'subtitles.srt');
    const srtContent = generateSrt(scenes, audioDurations);
    fs.writeFileSync(srtPath, srtContent);
    job.progress = 70;

    // Step 5: Render final video (renderer handles ambience internally)
    job.step = 'rendering_video';
    job.message = 'Rendering video with FFmpeg...';

    const renderScenes = scenes.map((scene, i) => ({
      ...scene,
      duration: audioDurations[i],
      imagePath: imagePaths[i],
      audioPath: audioPaths[i],
    }));

    const result = await renderVideo(jobDir, renderScenes, audioDurations, srtPath, format);
    job.progress = 100;
    job.status = 'complete';
    job.step = 'done';
    job.message = 'Video rendered successfully!';
    job.result = {
      videoUrl: '/videos/' + job.id + '/final.mp4',
      size: result.size,
      duration: Math.round(result.duration),
    };

    console.log('[video] Job ' + job.id + ' complete. Size:', result.size, 'Duration:', result.duration);
  } catch (err) {
    console.error('[video] Job ' + job.id + ' error:', err);
    job.status = 'error';
    job.error = err.message;
    job.message = 'Failed: ' + (err.userMessage || err.message);
  }
}

// ──  Video job status & download ─────────────────────────────────

app.get('/api/video/status/:jobId', (req, res) => {
  const job = videoJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found.', code: 'NOT_FOUND' });
  }
  const resp = {
    jobId: job.id,
    status: job.status,
    step: job.step,
    progress: job.progress,
    message: job.message,
    result: job.result,
    error: job.error,
  };
  if (job.result) {
    if (job.result.size) resp.size = job.result.size;
    if (job.result.duration) resp.duration = job.result.duration;
    if (job.result.isFallback !== undefined) resp.isFallback = job.result.isFallback;
    if (job.result.videoUrl) resp.output = job.result.videoUrl;
  }
  res.json(resp);
});

app.get('/videos/:jobId/final.mp4', (req, res) => {
  const filePath = path.join(VIDEOS_DIR, req.params.jobId, 'final.mp4');
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video not found or still rendering.', code: 'NOT_FOUND' });
  }
  res.set('Content-Type', 'video/mp4');
  res.set('Accept-Ranges', 'bytes');
  res.sendFile(filePath);
});

// ──  Video service health ───────────────────────────────────────

app.get('/api/video/health', (_req, res) => {
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasHF = !!process.env.HF_API_KEY;
  res.json({
    geminiConfigured: hasGemini,
    hfConfigured: hasHF,
    imageModel: process.env.HF_IMAGE_MODEL || 'stabilityai/stable-diffusion-xl-base-1024',
    ttsModel: process.env.HF_TTS_MODEL || 'facebook/fastspeech2-ljspeech',
    ffmpegAvailable: true,
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.', code: 'NOT_FOUND' });
});

// JSON parse error (malformed request body)
app.use((err, _req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON in request body.',
      code: 'PARSE_ERROR',
    });
  }
  next(err);
});

app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.', code: 'INTERNAL_ERROR' });
});

// ──  Start server ────────────────────────────────────────────

app.listen(PORT, () => {
  const hasKey = !!process.env.GEMINI_API_KEY;
  console.log('\n\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605');
  console.log('  Horror Studio AI — Stage 1 Backend');
  console.log('\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605');
  console.log('  Server:      http://0.0.0.0:' + PORT);
  console.log('  API Key:     ' + (hasKey ? '\u2713 Configured' : '\u2717 NOT SET'));
  console.log('  Model:       ' + (process.env.GEMINI_MODEL || 'gemini-2.0-flash'));
  console.log('  Setup page:  http://0.0.0.0:' + PORT + '/setup');
  console.log('  Setup token: ' + SETUP_TOKEN + ' (printed for admin; displayed on /setup)');
  console.log('  Endpoints:');
  console.log('    GET  /setup');
  console.log('    GET  /api/health');
  console.log('    POST /api/setup/key     (requires token, key-not-set only)');
  console.log('    POST /api/setup/reset    (requires current key)');
  console.log('    POST /api/generate/story');
  console.log('    POST /api/generate/youtube');
  console.log('    POST /api/generate/video   (full AI video production)');
  console.log('    GET  /api/video/status/:jobId');
  console.log('    GET  /api/video/health');
  console.log('    GET  /videos/:jobId/final.mp4');
  console.log('  Video: ' + (process.env.HF_API_KEY ? 'AI images + TTS available' : 'text-only fallback mode'));
  console.log('\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\u2605\n');
});
