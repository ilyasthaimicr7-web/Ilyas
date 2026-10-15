/*  Horror Studio AI — Scene Segmentation Module
 *  Uses Gemini to divide a full story into scenes with visual descriptions
 *  and narration text suitable for video generation.
 */

const { callGemini, parseJsonResponse } = require('../ai/gemini');

const SCENE_SEGMENTATION_PROMPT = (storyText, format, duration) => {
  const sceneCount = format === 'shorts' ? 3 : Math.max(4, Math.min(8, duration));
  return `You are a video production assistant. Break the following horror story into ${sceneCount} concise scenes suitable for video generation.

For each scene, provide:
- A scene number (1 to ${sceneCount})
- A 1-sentence visual description (what to show on screen — setting, characters, mood, lighting)
- The exact narration text to read aloud (a short excerpt from the story that matches this scene)
- Estimated duration in seconds

Format as STRICT JSON (no markdown, no prose outside JSON):
{
  "scenes": [
    {
      "scene": 1,
      "visual": "Visual description of the scene",
      "narration": "The exact text to be read aloud for this scene",
      "duration": 15
    },
    ...
  ]
}

STORY:
${storyText}

CONTENT TYPE: ${format === 'shorts' ? 'YouTube Short (vertical 9:16)' : 'YouTube Video (horizontal 16:9)'}
TARGET TOTAL DURATION: ${format === 'shorts' ? duration + ' seconds' : duration + ' minutes'}

Return ONLY valid JSON. No markdown.`;
};

async function segmentStory(storyText, format, duration) {
  const prompt = SCENE_SEGMENTATION_PROMPT(storyText, format, duration);
  const raw = await callGemini(prompt, { maxOutputTokens: 4096, temperature: 0.7 });
  const data = parseJsonResponse(raw);

  if (!data.scenes || !Array.isArray(data.scenes) || data.scenes.length === 0) {
    throw Object.assign(
      new Error('Scene segmentation returned no scenes.'),
      { code: 'PARSE_ERROR', userMessage: 'Failed to divide story into scenes. Please try again.', rawOutput: raw }
    );
  }

  return data.scenes.map((s, i) => ({
    scene: s.scene || i + 1,
    visual: s.visual || '',
    narration: s.narration || '',
    duration: s.duration || (format === 'shorts' ? 20 : 30),
  }));
}

module.exports = { segmentStory, SCENE_SEGMENTATION_PROMPT };
