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
 *    - i18n: English & Arabic (RTL) support
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
const $copyYt       = document.getElementById('copyYoutubeBtn');
const $status       = document.getElementById('status');
const $demoToggle   = document.getElementById('demoToggle');
const $loading      = document.getElementById('loadingOverlay');
const $loadingText  = document.getElementById('loadingText');

const $langToggle   = document.getElementById('langToggle');
const $langBtns     = document.querySelectorAll('.lang-btn');
const $horrorStyle = document.getElementById('horrorStyle');

// YouTube metadata editable fields
const $ytTitle          = document.getElementById('ytTitle');
const $ytDescription    = document.getElementById('ytDescription');
const $ytThumbnail      = document.getElementById('ytThumbnail');
const $ytThumbnailPrompt = document.getElementById('ytThumbnailPrompt');
const $ytProductionPlan = document.getElementById('ytProductionPlan');
const $ytTags           = document.getElementById('ytTags');

// ===========================================================================
//  State
// ===========================================================================

let currentFormat = 'video';
let currentStory = '';
let currentLanguage = 'en';
let currentStyle = 'none';

// ===========================================================================
//  Translations
// ===========================================================================

const translations = {
  en: {
    title: 'HORROR STUDIO AI',
    subtitle: 'Craft cinematic horror stories for YouTube',
    storySeed: 'Story Seed',
    ideaHelp: 'Describe your horror concept in a few words. The AI will turn it into a full cinematic story.',
    ideaPlaceholder: 'e.g. A child\'s doll that whispers the names of the dead...',
    contentType: 'Content Type',
    youtubeVideo: 'YouTube Video',
    youtubeShorts: 'YouTube Shorts',
    duration: 'Duration',
    horrorStyle: 'Horror Style',
    styles: {
      none: 'General Horror',
      psychological: 'Psychological',
      supernatural: 'Supernatural',
      gothic: 'Gothic',
      cosmic: 'Cosmic',
      folk: 'Folk Horror',
      slasher: 'Slasher',
      zombie: 'Zombie',
    },
    demoMode: 'Demo Mode (test UI without AI)',
    demoHelp: 'When ON, the app fills the interface with clearly-labeled [DEMO] placeholder content.',
    generateStory: 'Generate Story',
    generatedStory: 'Generated Story',
    storyPlaceholder: 'Your horror story will appear here.',
    copyStory: 'Copy Story',
    generateYoutube: 'Generate YouTube Title & Description',
    loadingStory: 'Generating your horror story...',
    loadingYoutube: 'Generating YouTube title, description, thumbnail, and production plan...',
    youtubeMetadata: 'YouTube Metadata',
    title: 'Title',
    description: 'Description',
    thumbnail: 'Thumbnail Concept',
    thumbnailPrompt: 'Thumbnail Prompt',
    productionPlan: 'Production Plan',
    tags: 'Tags',
    copyMetadata: 'Copy Metadata',
    ytTitlePlaceholder: 'YouTube title will appear here',
    ytDescriptionPlaceholder: 'YouTube description will appear here',
    ytThumbnailPlaceholder: 'Thumbnail concept will appear here',
    ytThumbnailPromptPlaceholder: 'AI image generation prompt will appear here',
    ytTagsPlaceholder: 'Tags will appear here, separated by commas',
  },
  ar: {
    title: 'هورر ستوديو آي أيه',
    subtitle: 'اصنع قصص رعب سينمائية ليوتيوب',
    storySeed: 'بذرة القصة',
    ideaHelp: 'اكتب فكرة رعبك بكلمات قليلة. سيحوّلها الذكاء الاصطناعي إلى قصة سينمائية كاملة.',
    ideaPlaceholder: 'مثال: كتلة دمي قديمة تهمس بأسماء الموتى...',
    contentType: 'نوع المحتوى',
    youtubeVideo: 'فيديو يوتيوب',
    youtubeShorts: 'شورتس يوتيوب',
    duration: 'المدة',
    horrorStyle: 'نمط الرعب',
    styles: {
      none: 'رعب عام',
      psychological: 'نفساني',
      supernatural: 'خارق',
      gothic: 'قوطي',
      cosmic: 'كوني',
      folk: 'شعبي',
      slasher: 'قاتل متكرر',
      zombie: 'ميت شرى',
    },
    demoMode: 'وضع العرض التوضيحي (اختبار الواجهة بدون ذكاء اصطناعي)',
    demoHelp: 'عند التشغيل، يملأ التطبيق الواجهة بمحتوى تجريبي مُعلّق [تجريبي].',
    generateStory: 'إنشاء القصة',
    generatedStory: 'القصة المنشأة',
    storyPlaceholder: 'ستظهر قصتك الرعب هنا.',
    copyStory: 'نسخ القصة',
    generateYoutube: 'إنشئ عنوان يوتيوب ووصف',
    loadingStory: 'جارٍ إنشاء قصتك الرعب...',
    loadingYoutube: 'جارٍ إنشاء عنوان ووصف ويوتيوب والصورة المصغرة وخطة الإنتاج...',
    youtubeMetadata: 'بيانات يوتيوب الوصفية',
    title: 'العنوان',
    description: 'الوصف',
    thumbnail: 'فكرة الصورة المصغرة',
    thumbnailPrompt: 'موجه صورة مصغرة',
    productionPlan: 'خطة الإنتاج',
    tags: 'العلامات',
    copyMetadata: 'نسخ البيانات الوصفية',
    ytTitlePlaceholder: 'سيظهر عنوان يوتيوب هنا',
    ytDescriptionPlaceholder: 'سيظهر وصف يوتيوب هنا',
    ytThumbnailPlaceholder: 'سيظهر مفهوم الصورة المصغرة هنا',
    ytThumbnailPromptPlaceholder: 'سيظهر موجه لتوليد صورة مصغرة هنا',
    ytTagsPlaceholder: 'سيظهر العلامات هنا، مفصولة بفواصل',
  },
};

// ===========================================================================
//  i18n
// ===========================================================================

function switchLanguage(lang) {
  currentLanguage = lang;
  $langBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  document.documentElement.lang = lang;
  document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
  updateTexts();
}

function getText(key) {
  const lang = translations[currentLanguage] || translations.en;
  return key.split('.').reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : ''), lang);
}

function updateTexts() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const value = getText(key);
    if (value) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        el.placeholder = value;
      } else {
        el.textContent = value;
      }
    }
  });

  // Update length options
  updateDurationOptions();

  // Update style options text
  updateStyleOptions();
}

function updateStyleOptions() {
  const options = $horrorStyle.querySelectorAll('option');
  options.forEach((opt) => {
    const key = opt.getAttribute('data-i18n');
    if (key) {
      const value = getText(key);
      if (value) opt.textContent = value;
    }
  });
}

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
  thumbnailPrompt: `A cracked porcelain doll face, one glassy eye reflecting a dark hallway, deep crimson and black color palette, vintage Victorian wallpaper peeling, distressed white text overlay "IT'S NOT CRYING...", dark cinematic style, dramatic low-key lighting, ominous mood, 16:9 aspect ratio`,
  productionPlan: [
    { scene: 1, description: 'Establish the Victorian house exterior at dusk, fog rolling in', duration: 15 },
    { scene: 2, description: 'Mara hears the weeping, follows it to the hidden parlor room', duration: 30 },
    { scene: 3, description: 'Close-up of the porcelain doll turning its head', duration: 20 },
    { scene: 4, description: 'Police arrive, find Mara rocking an invisible child', duration: 25 },
  ],
  tags: ['#HorrorStory', '#Creepy', '#ShortStory', '#Scary', '#Horror'],
};

const FETCH_TIMEOUT = 30000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
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

$langBtns.forEach((btn) => {
  btn.addEventListener('click', () => switchLanguage(btn.dataset.lang));
});

if ($horrorStyle) {
  $horrorStyle.addEventListener('change', () => {
    currentStyle = $horrorStyle.value;
  });
}

// ===========================================================================
//  Initialization
// ===========================================================================

document.addEventListener('DOMContentLoaded', () => {
  updateDurationOptions();
  updateStyleOptions();
  switchLanguage(currentLanguage);
  checkBackendStatus();
});

// Clear loading overlay if user switches tabs (prevents stuck spinner)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (loadingSafetyTimer) {
      clearTimeout(loadingSafetyTimer);
      loadingSafetyTimer = null;
    }
    if (!$loading.classList.contains('hidden')) {
      setLoading(false);
    }
  }
});

// Global error handler — ensures spinner never stays stuck
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason);
  e.preventDefault();
});

/**
 * Update the duration dropdown options based on selected format.
 */
function updateDurationOptions() {
  const options = currentFormat === 'shorts'
    ? [
        { value: 30, label: translations.en.duration_30s || '30 seconds' },
        { value: 45, label: translations.en.duration_45s || '45 seconds' },
        { value: 60, label: translations.en.duration_60s || '60 seconds' },
      ]
    : [
        { value: 3, label: translations.en.duration_3m || '3 minutes' },
        { value: 5, label: translations.en.duration_5m || '5 minutes' },
        { value: 10, label: translations.en.duration_10m || '10 minutes' },
      ];

  if (currentLanguage === 'ar') {
    options[0].label = '30 ثوانٍ';
    options[1].label = '45 ثانية';
    options[2].label = '60 ثانية';
    if (currentFormat === 'video') {
      options[0] = { value: 3, label: '3 دقائق' };
      options[1] = { value: 5, label: '5 دقائق' };
      options[2] = { value: 10, label: '10 دقائق' };
    }
  }

  const currentVal = $length.value;
  $length.innerHTML = '';
  let selectedSet = false;
  options.forEach((opt) => {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    if (String(opt.value) === currentVal) {
      el.selected = true;
      selectedSet = true;
    }
    $length.appendChild(el);
  });
  if (!selectedSet && options.length > 0) {
    $length.selectedIndex = 0;
  }
}

/**
 * Check if the backend is running and has an API key configured.
 */
async function checkBackendStatus() {
  try {
    const res = await fetchWithTimeout('/api/health');
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

  setLoading(true, getText('loadingStory'));
  try {
    const res = await fetchWithTimeout('/api/generate/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idea,
        length,
        format: currentFormat,
        style: currentStyle,
        language: currentLanguage,
      }),
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
    if (err.name === 'AbortError') {
      showStatus('Request timed out after 30 seconds. Please try again.', 'warning');
    } else {
      showStatus('Network error: could not reach the backend server. ' + err.message, 'warning');
    }
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

  setLoading(true, getText('loadingYoutube'));
  try {
    const res = await fetchWithTimeout('/api/generate/youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        story: currentStory,
        length: parseInt($length.value, 10),
        format: currentFormat,
        idea: $idea.value.trim(),
        style: currentStyle,
        language: currentLanguage,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      handleApiError(data, 'metadata generation');
      return;
    }

    if (data.code === 'PARSE_ERROR') {
      renderYoutubeError(data);
      return;
    }

    renderYoutube(data);
    showStatus('YouTube metadata generated via Gemini.', 'success');
  } catch (err) {
    if (err.name === 'AbortError') {
      showStatus('Request timed out after 30 seconds. Please try again.', 'warning');
    } else {
      showStatus('Network error: could not reach the backend server. ' + err.message, 'warning');
    }
  } finally {
    setLoading(false);
  }
}

function handleCopyStory() {
  const text = $storyOut.value.trim();
  copyToClipboard(text, getText('copyStory') + ' ' + (currentLanguage === 'ar' ? 'تم النسخ' : 'copied.'));
}

function handleCopyYoutube() {
  const meta = collectYoutubeMetadata();
  if (!meta) return;
  copyToClipboard(meta, getText('copyMetadata') + ' ' + (currentLanguage === 'ar' ? 'تم النسخ' : 'copied.'));
}

// ===========================================================================
//  Rendering
// ===========================================================================

function renderStory(text) {
  $storyOut.value = text;
}

/**
 * Render YouTube metadata into the editable fields.
 */
function renderYoutube(meta) {
  if ($ytTitle) $ytTitle.value = meta.title || '';
  if ($ytDescription) $ytDescription.value = meta.description || '';
  if ($ytThumbnail) $ytThumbnail.value = meta.thumbnail || '';
  if ($ytThumbnailPrompt) $ytThumbnailPrompt.value = meta.thumbnailPrompt || '';

  const plan = meta.productionPlan || [];
  if ($ytProductionPlan) {
    $ytProductionPlan.innerHTML = '';
    plan.forEach((item) => {
      const sceneNum = item.scene || item.sceneNumber || '?';
      const desc = item.description || '';
      const dur = item.duration || 0;
      const li = document.createElement('li');
      li.textContent = `Scene ${sceneNum} — ${desc} (~${dur}s)`;
      $ytProductionPlan.appendChild(li);
    });
    if (plan.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No plan generated.';
      $ytProductionPlan.appendChild(li);
    }
  }

  if ($ytTags) {
    const tags = Array.isArray(meta.tags) ? meta.tags : [];
    $ytTags.value = tags.join(', ');
  }
}

/**
 * Render a parse error with raw output for debugging.
 */
function renderYoutubeError(meta) {
  const plan = $ytProductionPlan;
  if (plan) {
    plan.innerHTML = `<li class="error-item">${escapeHtml(meta.rawOutput || meta.error || 'No raw output available')}</li>`;
  }
  showStatus('YouTube metadata could not be parsed. Raw output shown for debugging.', 'warning');
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
 * Collect all YouTube metadata text from editable fields for copying.
 */
function collectYoutubeMetadata() {
  const title = $ytTitle ? $ytTitle.value.trim() : '';
  const desc = $ytDescription ? $ytDescription.value.trim() : '';

  let plan = '';
  if ($ytProductionPlan) {
    const items = $ytProductionPlan.querySelectorAll('li');
    plan = Array.from(items).map((li) => li.textContent).join('\n');
  }

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

let loadingSafetyTimer = null;

/**
 * Show/hide loading overlay and disable inputs.
 * Includes a safety timeout to prevent infinite hanging.
 */
function setLoading(isLoading, message) {
  if (loadingSafetyTimer) {
    clearTimeout(loadingSafetyTimer);
    loadingSafetyTimer = null;
  }

  $loading.classList.toggle('hidden', !isLoading);
  $generate.disabled = isLoading;
  $ytGenerate.disabled = isLoading;
  $formatToggle.style.pointerEvents = isLoading ? 'none' : 'auto';
  $length.disabled = isLoading;
  if ($horrorStyle) $horrorStyle.disabled = isLoading;
  if (message) {
    $loadingText.textContent = message;
  }

  if (isLoading) {
    // Safety: auto-clear loading after 45 seconds to prevent infinite spinner
    loadingSafetyTimer = setTimeout(() => {
      setLoading(false);
      showStatus('Operation timed out. If this persists, refresh the page.', 'warning');
    }, 45000);
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