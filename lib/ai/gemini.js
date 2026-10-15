/*  Horror Studio AI — Gemini API Client
 *  Handles communication with Google's Gemini API.
 *  The API key (process.env.GEMINI_API_KEY) is used ONLY on the server.
 *  It is never sent to or readable by the browser.
 */

const DEFAULT_MODEL = 'gemini-2.0-flash';

/**
 * Map HTTP status codes and error messages to internal error codes.
 * @param {number} status  - HTTP status code.
 * @param {string} message - Error message from the API (optional).
 * @returns {string} Internal error code.
 */
function mapErrorCode(status, message) {
  // Check message for specific error types first.
  // Gemini sometimes returns HTTP 400 (not 401) for invalid/expired keys.
  if (message && /api.?key|invalid.?key|key.?invalid|unauthorized|authentication/i.test(message)) {
    return 'INVALID_API_KEY';
  }
  if (message && /quota|rate.?limit|exceeded/i.test(message)) {
    return 'QUOTA_EXCEEDED';
  }
  // Then check HTTP status codes
  if (status === 400) return 'BAD_REQUEST';
  if (status === 401 || status === 403) return 'INVALID_API_KEY';
  if (status === 429) return 'QUOTA_EXCEEDED';
  if (status === 503) return 'SERVICE_UNAVAILABLE';
  return 'API_ERROR';
}

/**
 * Call the Gemini API with a text prompt.
 * @param {string} prompt         - The full prompt text.
 * @param {object} options        - Optional settings.
 * @param {string} [options.model]         - Model name override.
 * @param {number} [options.temperature]   - Sampling temperature (0-1).
 * @param {number} [options.topP]          - Top-p sampling (0-1).
 * @param {number} [options.maxOutputTokens] - Max output tokens.
 * @returns {Promise<string>} The generated text.
 */
async function callGemini(prompt, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY environment variable is not set.');
    err.code = 'NO_API_KEY';
    err.userMessage =
      'No AI service is configured. Add your Gemini API key to the .env file ' +
      '(see .env.example) and restart the server.';
    throw err;
  }

  const model = options.model || process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: options.temperature ?? 0.8,
      topP: options.topP ?? 0.9,
      maxOutputTokens: options.maxOutputTokens ?? 2048,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_SEXUAL', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    const err = new Error('Unable to reach the Gemini API. Check your network connection.');
    err.code = 'NETWORK_ERROR';
    throw err;
  }

  if (!response.ok) {
    let errorData = {};
    try {
      errorData = await response.json();
    } catch (_) {
      /* response body isn't JSON */
    }

    const apiMsg = errorData.error?.message || `HTTP ${response.status}`;
    const err = new Error(apiMsg);
    err.status = response.status;
    err.code = mapErrorCode(response.status, apiMsg);
    err.userMessage = getFriendlyMessage(err.code, apiMsg);
    throw err;
  }

  const data = await response.json();

  // Validate response structure
  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw Object.assign(
      new Error('Gemini returned an empty response (no candidates).'),
      { code: 'EMPTY_RESPONSE', userMessage: 'The AI returned an empty response. Please try again.' }
    );
  }

  const text = candidate.content?.parts?.[0]?.text;
  if (!text) {
    throw Object.assign(
      new Error('Gemini response contained no generated text.'),
      { code: 'EMPTY_RESPONSE', userMessage: 'The AI returned no text. Please try again with a different idea.' }
    );
  }

  // Handle safety blocks (finishReason === "SAFETY")
  if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
    throw Object.assign(
      new Error(`Generation stopped (${candidate.finishReason}). The content may have been filtered.`),
      { code: 'CONTENT_FILTERED', userMessage: 'The AI stopped generating due to content safety. Try rephrasing your story idea.' }
    );
  }

  return text.trim();
}

/**
 * Provide a user-friendly, actionable message for each error code.
 * @param {string} code   - Internal error code.
 * @param {string} detail - Raw API error message (for context).
 * @returns {string} Friendly message.
 */
function getFriendlyMessage(code, detail) {
  switch (code) {
    case 'NO_API_KEY':
      return 'AI service is not configured. Add GEMINI_API_KEY to .env and restart the server.';
    case 'INVALID_API_KEY':
      return 'The Gemini API key is invalid or expired. Update GEMINI_API_KEY in .env and restart.';
    case 'QUOTA_EXCEEDED':
      return 'AI service quota exhausted. Wait for the rate limit to reset (typically 1 minute) and try again.';
    case 'SERVICE_UNAVAILABLE':
      return 'The Gemini API is temporarily unavailable. Please try again in a moment.';
    case 'NETWORK_ERROR':
      return 'Could not reach the AI service. Check the network connection.';
    case 'CONTENT_FILTERED':
      return 'Content was filtered for safety reasons. Try a different story idea.';
    default:
      return 'AI generation failed. See server logs for details.';
  }
}

/**
 * Parse a JSON response from the model, stripping any markdown fences.
 * @param {string} text - Raw model output.
 * @returns {object} Parsed JSON object.
 * @throws {Error} If parsing fails.
 */
function parseJsonResponse(text) {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\n([\s\S]*?)\n```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw Object.assign(new Error('Failed to parse AI response as JSON.'), {
      code: 'PARSE_ERROR',
      userMessage: 'The AI returned an invalid response format. Please try again.',
      rawOutput: cleaned,
    });
  }
}

module.exports = { callGemini, parseJsonResponse, mapErrorCode, getFriendlyMessage };
