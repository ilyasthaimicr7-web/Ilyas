/*  Horror Studio AI — Text-to-Speech Client
 *  Generates narration audio using Hugging Face Inference API.
 *  The API key is read from process.env.HF_API_KEY.
 */

const DEFAULT_TTS_MODEL = 'facebook/fastspeech2-ljspeech';
const SAMPLE_RATE = 22050;

async function generateSpeech(text, options = {}) {
  const apiKey = process.env.HF_API_KEY;

  if (!apiKey) {
    const err = new Error('HF_API_KEY is not configured.');
    err.code = 'NO_HF_KEY';
    err.userMessage =
      'Text-to-speech requires a Hugging Face API key. ' +
      'Set HF_API_KEY in .env and restart the server. ' +
      'Get a free key at: https://huggingface.co/settings/tokens';
    throw err;
  }

  const model = options.model || DEFAULT_TTS_MODEL;
  const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`;

  const body = {
    inputs: text,
    parameters: {
      // Some models support additional parameters
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
      throw Object.assign(new Error('TTS generation timed out.'), {
        code: 'TIMEOUT',
        userMessage: 'Speech generation timed out. Try again.',
      });
    }
    throw Object.assign(new Error('Unable to reach Hugging Face API.'), {
      code: 'NETWORK_ERROR',
      userMessage: 'Network error contacting TTS service.',
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
      err.userMessage = 'Speech generation rate limited. Please wait and try again.';
    } else {
      err.code = 'TTS_API_ERROR';
      err.userMessage = 'Speech generation failed. ' + apiMsg;
    }
    throw err;
  }

  const contentType = response.headers.get('content-type');
  let buffer;

  if (contentType && contentType.includes('application/json')) {
    // Some HF models return JSON with base64 audio
    const data = await response.json();
    if (data.audio && data.audio.length) {
      buffer = Buffer.from(data.audio, 'base64');
    } else {
      throw Object.assign(new Error('Unexpected TTS response format.'), {
        code: 'PARSE_ERROR',
        userMessage: 'TTS returned unexpected format. Try a different model.',
      });
    }
  } else {
    // Raw audio bytes
    buffer = Buffer.from(await response.arrayBuffer());
  }

  return { buffer, sampleRate: SAMPLE_RATE };
}

module.exports = { generateSpeech, DEFAULT_TTS_MODEL, SAMPLE_RATE };
