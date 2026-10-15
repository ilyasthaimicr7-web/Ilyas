/*  Horror Studio AI — YouTube Metadata Prompt Builder
 *  Builds prompts for generating YouTube titles, descriptions,
 *  thumbnail concepts, thumbnail prompts, and scene-by-scene
 *  production plans.
 */

/**
 * Build the prompt for YouTube metadata generation.
 * @param {string} storyText - The generated horror story text.
 * @param {number|string} length - Duration.
 * @param {string} format - 'video' or 'shorts'
 * @param {string} idea - The original user's story idea.
 * @returns {string} The prompt.
 */
function buildYouTubePrompt(storyText, length, format, idea) {
  const isShorts = format === 'shorts';
  const contentType = isShorts ? 'YouTube Short' : 'YouTube video';
  const aspectRatio = isShorts ? '9:16 (vertical)' : '16:9 (horizontal)';

  return `You are a YouTube horror channel strategist. Based on the following original horror story, generate YouTube metadata as STRICT JSON (no markdown, no prose outside JSON).

STORY IDEA: "${idea}"
CONTENT TYPE: ${contentType}
TARGET DURATION: ${isShorts ? length + ' seconds' : length + ' minutes'}

STORY:
${storyText}

Return a JSON object with EXACTLY these fields:
{
  "title": "A catchy, searchable title under 100 characters. Include relevant horror keywords. Make it intriguing but not clickbaity.",
  "description": "An engaging description. 1-2 sentences hooking the viewer, 1-2 sentences with a brief non-spoiler summary, a subscribe call-to-action, and 5-10 relevant hashtags. Use line breaks for readability.",
  "thumbnail_concept": "A detailed visual description for a custom thumbnail: subject, colors, lighting, mood, and suggested text overlay.",
  "thumbnail_prompt": "A detailed AI image generation prompt (suitable for Midjourney, DALL-E, or Stable Diffusion) for the thumbnail. Include: subject, artistic style (dark cinematic), color palette (deep reds, blacks, shadows), lighting (dramatic, low-key), mood (ominous, unsettling), suggested text overlay font and placement, composition, and aspect ratio ${aspectRatio}.",
  "production_plan": "An array of 3-5 key scenes as a production guide. Each entry: scene number, a 1-sentence visual description, and estimated duration in seconds. Focus on visuals that work well for ${isShorts ? 'vertical Shorts' : 'a narrated video'}.",
  "tags": ["array", "of", "5-8", "SEO-friendly", "tags"]
}

Return ONLY valid JSON. No markdown fences. No extra text.`;
}

module.exports = { buildYouTubePrompt };
