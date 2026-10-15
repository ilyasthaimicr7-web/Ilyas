/*  Horror Studio AI — Story Generation Prompt Builder
 *  Builds prompts optimized for cinematic horror storytelling.
 *  Supports both long-form YouTube videos and Shorts.
 */

// Average words-per-minute for a YouTube horror narrator.
const WORDS_PER_MINUTE = 140;

/**
 * Estimate the word count for a given duration.
 * @param {number|string} length  - Duration in minutes (video) or seconds (shorts).
 * @param {string} format         - 'video' or 'shorts'
 * @returns {number} Estimated word count
 */
function estimateWordCount(length, format) {
  const num = parseInt(length, 10);
  if (format === 'shorts') {
    // Shorts: seconds → minutes → words
    return Math.round((num / 60) * WORDS_PER_MINUTE);
  }
  // Long-form: minutes → words
  return Math.round(num * WORDS_PER_MINUTE);
}

/**
 * Build the full prompt for story generation.
 * @param {string} idea   - The user's horror concept.
 * @param {number|string} length - Duration (minutes for video, seconds for shorts).
 * @param {string} format - 'video' or 'shorts'
 * @returns {string} The prompt to send to the AI model.
 */
function buildStoryPrompt(idea, length, format) {
  const wordCount = estimateWordCount(length, format);
  const isShorts = format === 'shorts';

  const formatInstruction = isShorts
    ? `Format: A complete, self-contained horror micro-story. The hook must
      be in the first sentence. Include sensory details and a twist ending.
      No markdown. Plain text only.`
    : `Format: A complete horror story with clear paragraph breaks for scene
      changes. Start with a gripping hook. Build suspense gradually. End with
      a strong twist, revelation, or haunting conclusion.
      No markdown headers. Plain text only.`;

  const endingNote = isShorts
    ? 'The ending must land in the final sentence — make it a punch to the gut.'
    : 'The ending should be a slow-burn revelation or a final twist that reframes the entire story.';

  return `You are a professional horror story writer creating ORIGINAL content for YouTube. Your stories are cinematic, with vivid sensory details, gradual suspense, and memorable endings. You never reuse clichéd tropes without a fresh twist.

Write a NEW, original horror story based on this idea:
"${idea}"

Requirements:
- Hook: Start with a gripping first line that compels the viewer to keep watching.
- Suspense: Build tension gradually with sensory details — what the character sees, hears, smells, feels.
- Cinematic narration: Use vivid, visual language. Describe settings, lighting, sounds.
- Ending: ${endingNote}
- Target length: ~${wordCount} words (for approximately ${isShorts ? length + ' seconds' : length + ' minutes'} of narration).
${formatInstruction}

Write the story now:`;
}

module.exports = { buildStoryPrompt, estimateWordCount };
