/*  Horror Studio AI — Story Generation Prompt Builder
 *  Builds prompts optimized for cinematic horror storytelling.
 *  Supports both long-form YouTube videos and Shorts.
 *  Supports horror subgenre styling.
 */

const WORDS_PER_MINUTE = 140;

const STYLE_INSTRUCTIONS = {
  none: '',
  psychological: 'Horror subgenre: Psychological. Focus on the character\'s deteriorating mental state, unreliable narration, and slowly-building dread. The scariest monsters are often internal or ambiguous — what is real may not be.',
  supernatural: 'Horror subgenre: Supernatural. Include ghosts, spirits, demons, or otherworldly phenomena. The threat comes from beyond the physical world. Build tension through unexplained occurrences and escalating paranormal events.',
  gothic: 'Horror subgenre: Gothic. Decay and ruin, ancient family curses, ancestral mansions, romantic melancholy, and dark secrets buried in history. Emphasise atmosphere and setting.',
  cosmic: 'Horror subgenre: Cosmic / Lovecraftian. Emphasise the insignificance of humanity against vast, unknowable entities from beyond space and time. Build to sanity-shattering revelations.',
  folk: 'Horror subgenre: Folk Horror. Rural or isolated settings, pagan rituals, community secrets, ancient folklore, and the clash between old and modern beliefs. The horror grows from the land itself.',
  slasher: 'Horror subgenre: Slasher. A relentless, methodical killer with a distinctive weapon or modus operandi. Build tension through the threat of pursuit and a final confrontation.',
  zombie: 'Horror subgenre: Zombie / Undead. Focus on survival against overwhelming hordes, resource scarcity, the breakdown of civilisation, and the horror of the infected.',
};

/**
 * Estimate word count for a given duration and format.
 */
function estimateWordCount(length, format) {
  const num = parseInt(length, 10);
  if (format === 'shorts') return Math.round((num / 60) * WORDS_PER_MINUTE);
  return Math.round(num * WORDS_PER_MINUTE);
}

/**
 * Build the full story generation prompt.
 * @param {string} idea    - The user's horror concept.
 * @param {number|string} length - Duration (minutes for video, seconds for shorts).
 * @param {string} format  - 'video' or 'shorts'
 * @param {string} style   - Horror subgenre (see STYLE_INSTRUCTIONS keys).
 * @returns {string} The prompt.
 */
function buildStoryPrompt(idea, length, format, style) {
  const wordCount = estimateWordCount(length, format);
  const isShorts = format === 'shorts';
  const styleInstruction = STYLE_INSTRUCTIONS[style] || '';

  const formatInstruction = isShorts
    ? 'Format: A complete, self-contained horror micro-story. The hook must be in the first sentence. Include sensory details and a twist ending. No markdown. Plain text only.'
    : 'Format: A complete horror story with clear paragraph breaks for scene changes. Start with a gripping hook. Build suspense gradually. End with a strong twist, revelation, or haunting conclusion. No markdown headers. Plain text only.';

  const endingNote = isShorts
    ? 'The ending must land in the final sentence — make it a punch to the gut.'
    : 'The ending should be a slow-burn revelation or a final twist that reframes the entire story.';

  const styleBlock = styleInstruction
    ? '\n\nHorror Style:\n' + styleInstruction
    : '';

  return 'You are a professional horror story writer creating ORIGINAL content for YouTube. Your stories are cinematic, with vivid sensory details, gradual suspense, and memorable endings. You never reuse clichéd tropes without a fresh twist.\n\n' +
    'Write a NEW, original horror story based on this idea:\n' +
    '"' + idea + '"\n\n' +
    'Requirements:\n' +
    '- Hook: Start with a gripping first line that compels the viewer to keep watching.\n' +
    '- Suspense: Build tension gradually with sensory details — what the character sees, hears, smells, feels.\n' +
    '- Cinematic narration: Use vivid, visual language. Describe settings, lighting, sounds.\n' +
    '- Ending: ' + endingNote + '\n' +
    '- Target length: ~' + wordCount + ' words (for approximately ' + (isShorts ? length + ' seconds' : length + ' minutes') + ' of narration).\n' +
    '' + formatInstruction +
    '' + styleBlock + '\n\n' +
    'Write the story now:';
}

module.exports = { buildStoryPrompt, estimateWordCount, STYLE_INSTRUCTIONS };
