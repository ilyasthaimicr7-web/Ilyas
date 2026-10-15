/*  Horror Studio AI — app.js (Stage 1)
 *  Frontend logic for the Horror Studio AI web app.
 *
 *  Communicates with a secure server-side backend (see server.js).
 *  The Gemini API key NEVER resides in this file — all AI calls
 *  go through the backend at /api/generate/* endpoints.
 *
 *  Features:
 *    - Generate horror stories via Gemini API (long-form & Shorts)
 *    - Generate YouTube metadata (title, description, thumbnail, production plan)
 *    - Copy to clipboard (story & metadata)
 *    - Demo Mode for offline UI testing
 *    - Loading states, error handling, user-friendly messages
 */

// ===========================================================================
//  DOM references
// ===========================================================================

const $idea         = document.getElementById('storyIdea');
const $length       = document.getElementById('storyLength');
const $formatToggle = document.getElementById('formatToggle');
const $formatBtns   = document.querySelectorAll('.segment-button');
const $generate     = document.getElementById('generateBtn');
const $storyOut     = document.getElementById('storyOutput');
const $copyStory    = document.getElementById('copyStoryBtn');
const $ytGenerate   = document.getElementById('generateYoutubeBtn');
const $ytOut        = document.getElementById('youtubeOutput');
const $copyYt       = document.getElementById('copyYoutubeBtn');
const $status       = document.getElementById('status');
const $demoToggle   = document.getElementById('demoToggle');
const $loading      = document.getElementById('loadingOverlay');
const $loadingText  = document.getElementById('loadingText');

// ===========================================================================
//  State
// ===========================================================================

let currentFormat = 'video';
let currentStory = '';

// ===========================================================================
//  Demo placeholder content (clearly labeled — for offline UI testing only)
// ===========================================================================

const DEMO_STORY = `THE WEEPING CHILD

When Mara moved into the old Victorian on Sycamore Lane, the neighbors said the house had been empty for thirty years. But every night at exactly 3:17 a.m., she heard a child weeping in the walls.

On the seventh night, she followed the sound to the parlor — a room that had been papered over, its door hidden behind a bookshelf. Behind the makeshift wall, she found a child's bedroom frozen in time. A single porcelain doll sat on a rickety bed, its glassy eyes reflecting the moonlight.

"You're crying," Mara whispered to the doll.

The doll's head clicked to the side. "I'm not crying," it said in a girl's voice. "You are."

Mara looked down. Her cheeks were soaked. But she hadn't been crying.

The doll smiled — a crack splitting its painted-on grin. "Now you hear them too, don't you? All the children who never left."

When the police found Mara the next morning, she was sitting cross-legged in the parlor, rocking an invisible child. She kept whispering, "It's okay, it's okay," over and over, as if trying to comfort something no one else could see.

The house was sold last month. The new owners say the walls don't weep anymore. They say that's because nothing's left to weep for.`;

const DEMO_YOUTUBE = {
  title: '[CREEPY STORY] The Weeping Child in the Walls of Sycamore Lane',
  description: `In this unsettling tale, Mara moves into a long-abandoned Victorian only to discover that something far more sinister than dust has been waiting inside the walls. A child's weeping, a hidden room, and a porcelain doll with a voice that doesn't belong to it — some doors, once opened, can never be closed again.\n\n🔔 Subscribe for more horror stories every week!\n🔔 Turn on notifications so you never miss a new video!\n\n#HorrorStory #Creepy #ShortStory #Scary #Horror #TheWeepingChild #ShortFilm #ScaryStory`,
  thumbnail: `A cracked porcelain doll's face with one glassy eye reflecting a dark hallway. Deep crimson and black color palette. Vintage Victorian wallpaper peeling in the background. Text overlay: "IT'S NOT CRYING..." in distressed white font.`,
  productionPlan: [
    { scene: 1, description: 'Establish the Victorian house exterior at dusk, fog rolling in', duration: 15 },
    { scene: 2, description: 'Mara hears the weeping, follows it to the hidden parlor room', duration: 30 },
    { scene: 3, description: 'Close-up of the porcelain doll turning its head', duration: 20 },
    { scene: 4, description: 'Police arrive, find Mara rocking an invisible child', duration: 25 },
  ],
  tags: ['#HorrorStory', '#Creepy', '#ShortStory', '#Scary', '#Horror']
};

// ===========================================================================
//  Event listeners
// ===========================================================================

$generate.addEventListener('click', handleGenerateStory);
$copyStory.addEventListener('click', handleCopyStory);
$ytGenerate.addEventListener('click', handleGenerateYoutube);
$copyYt.addEventListener('click', handleCopyYoutube);

$formatBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    currentFormat = btn.dataset.format;
    $formatBtns.forEach((b) => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-checked', b === btn);
    });
    updateDurationOptions();
  });
});

// ===========================================================================
//  Initialization
// ===========================================================================

document.addEventListener('DOMContentLoaded', () => {
  updateDurationOptions();
  checkBackendStatus();
});

/**
 * Update the duration dropdown options based on selected format.
 */
function updateDurationOptions() {
  const options = currentFormat === 'shorts'
    ? [
        { value: 30, label: '30 seconds' },
        { value: 45, label: '45 seconds' },
        { value: 60, label: '60 seconds' },
      ]
    : [
        { value: 3, label: '3 minutes' },
        { value: 5, label: '5 minutes' },
        { value: 10, label: '10 minutes' },
      ];

  // Preserve selected value if possible
  const currentVal = $length.value;
  $length.innerHTML = '';
  options.forEach((opt) => {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    if (String(opt.value) === currentVal && currentFormat !== 'shorts' || 
        String(opt.value) === currentVal && currentFormat === 'shorts') {
      el.selected = true;
    }
    // Select first option if nothing matches or format changed
    if (!el.selected && options.indexOf(opt) === 0) {
      el.selected = true;
    }
    $length.appendChild(el);
  });
}

/**
 * Check if the backend is running and has an API key configured.
 */
async function checkBackendStatus() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (!data.apiKeyConfigured) {
      showStatus(
        'Backend is running but no Gemini API key is configured. ' +
        'Set GEMINI_API_KEY in .env and restart the server. ' +
        'Demo Mode is available for UI testing.',
        'warning'
      );
    }
  } catch (err) {
    showStatus(
      'Backend server is not reachable. Demo Mode is available for UI testing.',
      'warning'
    );
  }
}

// ===========================================================================
//  Handlers
// ===========================================================================

async function handleGenerateStory() {
  const idea = $idea.value.trim();
  const length = parseInt($length.value, 10);

  if (!idea) {
    showStatus('Please enter a story idea before generating.', 'warning');
    return;
  }

  if ($demoToggle.checked) {
    const demo = buildDemoStory(idea, length, currentFormat);
    renderStory(demo);
    currentStory = demo;
    showStatus('[DEMO MODE] Generated placeholder story for preview.', 'success');
    return;
  }

  // Real API call
  setLoading(true, 'Generating your horror story...');
  try {
    const res = await fetch('/api/generate/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea, length, format: currentFormat }),
    });

    const data = await res.json();

    if (!res.ok) {
      handleApiError(data, 'story generation');
      return;
    }

    renderStory(data.story);
    currentStory = data.story;
    showStatus(
      `Story generated via Gemini (${data.wordCount} words, ~${formatDuration(data.length, data.format)}).`,
      'success'
    );
  } catch (err) {
    showStatus('Network error: could not reach the backend server. ' + err.message, 'warning');
  } finally {
    setLoading(false);
  }
}

async function handleGenerateYoutube() {
  if (!currentStory) {
    showStatus('Generate a story first before creating YouTube metadata.', 'warning');
    return;
  }

  if ($demoToggle.checked) {
    renderYoutube(DEMO_YOUTUBE);
    showStatus('[DEMO MODE] Generated placeholder YouTube metadata for preview.', 'success');
    return;
  }

  // Real API call
  setLoading(true, 'Generating YouTube title, description, thumbnail, and production plan...');
  try {
    const res = await fetch('/api/generate/youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        story: currentStory,
        length: parseInt($length.value, 10),
        format: currentFormat,
        idea: $idea.value.trim(),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      handleApiError(data, 'metadata generation');
      return;
    }

    renderYoutube(data);
    showStatus('YouTube metadata generated via Gemini.', 'success');
  } catch (err) {
    showStatus('Network error: could not reach the backend server. ' + err.message, 'warning');
  } finally {
    setLoading(false);
  }
}

function handleCopyStory() {
  const text = $storyOut.textContent.trim();
  copyToClipboard(text, 'Story copied to clipboard.');
}

function handleCopyYoutube() {
  const meta = collectYoutubeMetadata();
  if (!meta) return;
  copyToClipboard(meta, 'YouTube metadata copied to clipboard.');
}

// ===========================================================================
//  Rendering
// ===========================================================================

function renderStory(text) {
  $storyOut.innerHTML = '';
  $storyOut.textContent = text;
}

/**
 * Render YouTube metadata in the output panel.
 * Supports both full metadata and error/parse responses.
 */
function renderYoutube(meta) {
  // If the backend returned a parse error with raw output, show it for inspection
  if (meta.code === 'PARSE_ERROR') {
    $ytOut.innerHTML = `
      <div class="meta-error">
        <strong>Response Parsing Issue</strong>
        <p>The AI response could not be parsed as JSON. The raw output is shown below for debugging:</p>
        <pre class="raw-output">${escapeHtml(meta.rawOutput || meta.error || 'No raw output available')}</pre>
      </div>
    `;
    return;
  }

  const planItems = (meta.productionPlan || meta.production_plan || [])
    .map((item) => {
      const sceneNum = item.scene || item.sceneNumber || '?';
      const desc = item.description || '';
      const dur = item.duration || 0;
      return `<li><strong>Scene ${sceneNum}</strong> — ${escapeHtml(desc)} · ~${dur}s</li>`;
    })
    .join('');

  const tags = (meta.tags || [])
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
    .join('');

  $ytOut.innerHTML = `
    <div class="meta-block">
      <div class="meta-section-title">Title</div>
      <div class="meta-title">${escapeHtml(meta.title || '')}</div>
    </div>

    <div class="meta-block">
      <div class="meta-section-title">Description</div>
      <div class="meta-description">${escapeHtml(meta.description || '')}</div>
    </div>

    <div class="meta-block">
      <div class="meta-section-title">Thumbnail Concept</div>
      <div class="meta-description">${escapeHtml(meta.thumbnail || '')}</div>
    </div>

    <div class="meta-block">
      <div class="meta-section-title">Production Plan</div>
      <ul class="production-plan">${planItems || '<li>No plan generated.</li>'}</ul>
    </div>

    <div class="meta-block">
      <div class="meta-section-title">Tags</div>
      <div class="tag-list">${tags}</div>
    </div>
  `;
}

// ===========================================================================
//  Utilities
// ===========================================================================

function buildDemoStory(idea, length, format) {
  const label = idea || 'Untitled Horror Concept';
  const dur = format === 'shorts' ? `${length}s` : `${length} min`;
  return `[DEMO] ${label}\n\nFormat: ${format} | Duration: ${dur}\n\n${DEMO_STORY}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function copyToClipboard(text, successMsg) {
  if (!text) {
    showStatus('Nothing to copy.', 'warning');
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    showStatus(successMsg, 'success');
  }).catch(() => {
    // Fallback for older browsers / mobile
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    document.execCommand('copy');
    ta.remove();
    showStatus(successMsg, 'success');
  });
}

/**
 * Collect all YouTube metadata text for copying.
 */
function collectYoutubeMetadata() {
  const titleEl = $ytOut.querySelector('.meta-title');
  const descEl = $ytOut.querySelector('.meta-description');

  if (!titleEl && !descEl) {
    showStatus('No YouTube metadata to copy. Generate metadata first.', 'warning');
    return null;
  }

  const title = titleEl ? titleEl.textContent : '';
  const desc = descEl ? descEl.textContent : '';

  // Collect production plan items
  const planItems = $ytOut.querySelectorAll('.production-plan li');
  const plan = Array.from(planItems).map((li) => li.textContent).join('\n');

  const parts = [];
  if (title) parts.push(`TITLE:\n${title}`);
  if (desc) parts.push(`DESCRIPTION:\n${desc}`);
  if (plan) parts.push(`PRODUCTION PLAN:\n${plan}`);
  return parts.join('\n\n');
}

/**
 * Format a duration for display (e.g. "5 min", "60s").
 */
function formatDuration(length, format) {
  return format === 'shorts' ? `${length}s` : `${length} min`;
}

/**
 * Show/hide loading overlay and disable inputs.
 */
function setLoading(isLoading, message) {
  $loading.classList.toggle('hidden', !isLoading);
  $generate.disabled = isLoading;
  $ytGenerate.disabled = isLoading;
  $formatToggle.style.pointerEvents = isLoading ? 'none' : 'auto';
  $length.disabled = isLoading;
  if (message) {
    $loadingText.textContent = message;
  }
}

/**
 * Show a status message.
 */
function showStatus(message, type) {
  $status.textContent = message;
  $status.className = `status status--${type}`;
}

/**
 * Handle API error responses from the backend.
 */
function handleApiError(data, context) {
  const code = data.code || 'UNKNOWN_ERROR';
  const message = data.error || 'An unknown error occurred';

  if (code === 'NO_API_KEY') {
    showStatus(
      `No AI service configured. Ask the admin to set GEMINI_API_KEY and restart the server. ` +
      `Demo Mode is available for testing. (${message})`,
      'warning'
    );
    return;
  }

  if (code === 'QUOTA_EXCEEDED') {
    showStatus(
      `AI quota exceeded during ${context}. The free Gemini tier has daily limits. ` +
      `Wait for the rate limit to reset (typically 1 minute) and try again. ` +
      `Consider upgrading your Google account for higher limits.`,
      'warning'
    );
    return;
  }

  if (code === 'INVALID_API_KEY') {
    showStatus(
      `The Gemini API key is invalid or expired. Ask the admin to update GEMINI_API_KEY and restart the server. (${message})`,
      'warning'
    );
    return;
  }

  showStatus(`Failed to generate ${context}: ${message}`, 'warning');
}
