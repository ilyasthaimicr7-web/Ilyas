/*  Horror Studio AI — Image Generation Client
 *  Generates scene images using Hugging Face Inference API with fallback to Pollinations.ai (no key).
 */

const DEFAULT_IMAGE_MODEL = 'stabilityai/stable-diffusion-xl-base-1024';

async function generateImageWithPollinations(prompt, options = {}) {
  const width = options.width || 1024;
  const height = options.height || 1024;
  const encoded = encodeURIComponent(prompt.substring(0, 1000));
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=flux&seed=-1&private=false&enhance=true`;
  
  const response = await fetch(url, {
    method: 'GET',
    signal: AbortSignal.timeout(90000),
  });
  
  if (!response.ok) {
    const err = new Error(`Pollinations HTTP ${response.status}`);
    err.code = 'POLLINATIONS_ERROR';
    throw err;
  }
  
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}

async function generateImage(prompt, options = {}) {
  const apiKey = process.env.HF_API_KEY;

  if (apiKey) {
    const model = options.model || DEFAULT_IMAGE_MODEL;
    const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`;
    const body = {
      inputs: prompt,
      parameters: {
        num_inference_steps: options.steps || 20,
        guidance_scale: options.guidance || 7.5,
        width: options.width || 1024,
        height: options.height || 1024,
      },
      options: { wait_for_model: true, use_cache: false },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });

      if (response.ok) {
        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer);
      }
    } catch (e) {
      console.warn('[image] HF failed, trying fallback:', e.code || e.message);
    }
  }

  // Fallback: Pollinations (no API key required)
  try {
    return await generateImageWithPollinations(prompt, options);
  } catch (e) {
    console.error('[image] Pollinations failed:', e.message);
    const err = new Error('Image generation unavailable.');
    err.code = apiKey ? 'IMAGE_API_ERROR' : 'NO_IMAGE_SERVICE';
    err.userMessage = apiKey
      ? 'Image generation failed. Try again.'
      : 'No free image service accessible. Consider adding HF_API_KEY from https://huggingface.co/settings/tokens';
    throw err;
  }
}

module.exports = { generateImage, DEFAULT_IMAGE_MODEL };
