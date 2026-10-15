/*  Horror Studio AI — Image Generation Client
 *  Generates scene images using Hugging Face Inference API.
 *  The API key is read from process.env.HF_API_KEY.
 */

const DEFAULT_IMAGE_MODEL = 'stabilityai/stable-diffusion-xl-base-1024';

async function generateImage(prompt, options = {}) {
  const apiKey = process.env.HF_API_KEY;

  if (!apiKey) {
    const err = new Error('HF_API_KEY is not configured.');
    err.code = 'NO_HF_KEY';
    err.userMessage =
      'Image generation requires a Hugging Face API key. ' +
      'Set HF_API_KEY in .env and restart the server. ' +
      'Get a free key at: https://huggingface.co/settings/tokens';
    throw err;
  }

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
    options: {
      wait_for_model: true,
      use_cache: false,
    },
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
  } catch (networkErr) {
    if (networkErr.name === 'TimeoutError') {
      throw Object.assign(new Error('Image generation timed out.'), {
        code: 'TIMEOUT',
        userMessage: 'Image generation timed out. Try again.',
      });
    }
    throw Object.assign(new Error('Unable to reach Hugging Face API.'), {
      code: 'NETWORK_ERROR',
      userMessage: 'Network error contacting image generation service.',
    });
  }

  if (!response.ok) {
    let errorData = {};
    try {
      errorData = await response.json();
    } catch (_) {}

    const apiMsg = errorData.error || `HTTP ${response.status}`;
    const err = new Error(apiMsg);
    err.status = response.status;

    if (response.status === 401 || response.status === 403) {
      err.code = 'INVALID_API_KEY';
      err.userMessage = 'The Hugging Face API key is invalid. Check your HF_API_KEY.';
    } else if (response.status === 429) {
      err.code = 'RATE_LIMITED';
      err.userMessage = 'Image generation rate limited. Please wait and try again.';
    } else {
      err.code = 'IMAGE_API_ERROR';
      err.userMessage = 'Image generation failed. ' + apiMsg;
    }
    throw err;
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}

module.exports = { generateImage, DEFAULT_IMAGE_MODEL };
