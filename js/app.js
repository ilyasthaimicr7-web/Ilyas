/*  Horror Studio AI — app.js
 *  UI prototype. Story generation requires a backend/AI service.
 *  See README.md for integration instructions.
 */

// ---------------------------------------------------------------------------
//  Configuration
// ---------------------------------------------------------------------------

// Set this to `true` and implement `callAiService()` to enable real generation.
const AI_SERVICE_CONNECTED = false;

// Where the backend would live. Change as needed.
const API_ENDPOINT = '/api/generate';

// ---------------------------------------------------------------------------
//  DOM references
// ---------------------------------------------------------------------------

const $idea        = document.getElementById('storyIdea');
const $length      = document.getElementById('storyLength');
const $generate    = document.getElementById('generateBtn');
const $storyOut    = document.getElementById('storyOutput');
const $copyStory   = document.getElementById('copyStoryBtn');
const $ytGenerate  = document.getElementById('generateYoutubeBtn');
const $ytOut       = document.getElementById('youtubeOutput');
const $copyYt      = document.getElementById('copyYoutubeBtn');
const $status      = document.getElementById('status');
const $demoToggle  = document.getElementById('demoToggle');

// ---------------------------------------------------------------------------
//  Demo placeholder content (clearly marked as such)
// ---------------------------------------------------------------------------

const DEMO_STORY = `THE WEeping CHILD

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
  description: `In this unsettling tale, Mara moves into a long-abandoned Victorian only to discover that something far more sinister than dust has been waiting inside the walls. A child's weeping, a hidden room, and a porcelain doll with a voice that doesn't belong to it — some doors, once opened, can never be closed again.

🔔 Subscribe for more horror stories every week!
🔔 Turn on notifications so you never miss a new video!

#HorrorStory #Creepy #ShortStory #Scary #Horror #TheWeepingChild #ShortFilm #ScaryStory`,
};

// ---------------------------------------------------------------------------
//  Event listeners
// ---------------------------------------------------------------------------

$generate.addEventListener('click', handleGenerateStory);
$copyStory.addEventListener('click', handleCopyStory);
$ytGenerate.addEventListener('click', handleGenerateYoutube);
$copyYt.addEventListener('click', handleCopyYoutube);

// ---------------------------------------------------------------------------
//  Handlers
// ---------------------------------------------------------------------------

function handleGenerateStory() {
  const idea = $idea.value.trim();
  const length = $length.value;

  if (!idea) {
    showStatus('Please enter a story idea before generating.', 'warning');
    return;
  }

  if (AI_SERVICE_CONNECTED) {
    // Real generation path — not implemented in this prototype.
    return callAiService({ idea, length })
      .then(renderStory)
      .catch((err) => showStatus('Generation failed: ' + err.message, 'warning'));
  }

  if ($demoToggle.checked) {
    const demo = buildDemoStory(idea, length);
    renderStory(demo);
    showStatus('Demo mode: generated placeholder story for preview.', 'success');
    return;
  }

  // No AI service and demo mode off.
  showStatus(
    'No AI service is connected. Enable "Demo Mode" below to preview the interface, ' +
    'or connect an AI service to generate real stories. See README.md.',
    'warning'
  );
}

function handleGenerateYoutube() {
  const storyText = $storyOut.textContent.trim();

  if (!storyText || storyText.includes('placeholder-text')) {
    showStatus('Generate a story first before creating YouTube metadata.', 'warning');
    return;
  }

  if (AI_SERVICE_CONNECTED) {
    return callAiService({ type: 'youtube', story: storyText })
      .then(renderYoutube)
      .catch((err) => showStatus('Metadata generation failed: ' + err.message, 'warning'));
  }

  if ($demoToggle.checked) {
    renderYoutube(DEMO_YOUTUBE);
    showStatus('Demo mode: generated placeholder YouTube metadata for preview.', 'success');
    return;
  }

  showStatus('No AI service is connected. Enable "Demo Mode" to preview, or connect an AI service.', 'warning');
}

function handleCopyStory() {
  copyToClipboard($storyOut.textContent.trim(), 'Story copied to clipboard.');
}

function handleCopyYoutube() {
  const lines = $ytOut.querySelectorAll('.meta-title, .meta-description');
  const text = Array.from(lines).map((l) => l.textContent).join('\n\n');
  copyToClipboard(text, 'YouTube metadata copied to clipboard.');
}

// ---------------------------------------------------------------------------
//  Rendering helpers
// ---------------------------------------------------------------------------

function renderStory(text) {
  $storyOut.innerHTML = '';
  $storyOut.textContent = text;
}

function renderYoutube(meta) {
  $ytOut.innerHTML = `
    <div class="meta-title">${escapeHtml(meta.title)}</div>
    <div class="meta-description">${escapeHtml(meta.description)}</div>
  `;
}

// ---------------------------------------------------------------------------
//  Utilities
// ---------------------------------------------------------------------------

function buildDemoStory(idea, length) {
  const label = idea || 'Untitled Horror Concept';
  return `[DEMO] ${label}\n\nLength: ${length} minutes\n\n${DEMO_STORY}`;
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
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showStatus(successMsg, 'success');
  });
}

function showStatus(message, type) {
  $status.textContent = message;
  $status.className = `status status--${type}`;
}

// ---------------------------------------------------------------------------
//  AI service integration stub
// ---------------------------------------------------------------------------
// When you're ready to connect a backend, implement this function and set
// AI_SERVICE_CONNECTED = true. It should resolve with the generated text
// (for stories) or { title, description } (for YouTube metadata).
//
// async function callAiService(payload) {
//   const res = await fetch(API_ENDPOINT, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(payload),
//   });
//   if (!res.ok) throw new Error(`HTTP ${res.status}`);
//   return res.json();
// }
