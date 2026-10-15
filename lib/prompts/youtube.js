/*  Horror Studio AI — YouTube Metadata Prompt Builder
 *  Builds prompts for generating YouTube titles, descriptions,
 *  thumbnail concepts, and scene-by-scene production plans.
 */

/**
 * Build the prompt for YouTube metadata generation.
 * @param {string} storyText - The generated horror story text.
 * @param {number|string} length - Duration in minutes or seconds.
 * @param {string} format - 'video' or 'shorts'
 * @param {string} idea - The original user's story idea.
 * @returns {string} The prompt to send to the AI model.
 */
function buildYouTubePrompt(storyText, length, format, idea) {
  const isShorts = format === 'shorts';
  const contentType = isShorts ? 'YouTube Short' : 'YouTube video';

  return `You are a YouTube horror channel strategist. Based on the following original horror story, generate YouTube metadata as STRICT JSON (no markdown, no prose outside JSON).

STORY IDEA: "${idea}"
CONTENT TYPE: ${contentType}
TARGET DURATION: ${isShorts ? length + ' seconds' : length + ' minutes'}

STORY:
${storyText}

Return a JSON object with exactly these fields:
{
  "title": "A catchy, searchable title under 100 characters. Include relevant horror keywords.",
  "description": "An engaging description: 1-2 sentences hooking the viewer, 1-2 sentences with a non-spoiler summary, a subscribe call-to-action, and 5-10 relevant hashtags.",
  "thumbnail_concept": "A detailed visual description for a custom thumbnail: subject, colors, lighting, mood, and suggested text overlay.",
  "production_plan": "An array of 3-5 key scenes as a production guide. Each entry: scene number, a 1-sentence description, and estimated duration in seconds. Focus on visuals that work well for ${isShorts ? 'vertical Shorts' : 'a narrated video'}.",
  "tags": ["array", "of", "5-8", "SEO-friendly", "tags"]
}

Return ONLY valid JSON. No markdown fences. No extra text.`;
}

module.exports = { buildYouTubePrompt };
