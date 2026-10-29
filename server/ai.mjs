import { diagramSchema, validateGraph } from '../shared/diagram.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import {DIAGRAM_INSTRUCTIONS as instructions,geminiRequestBody,geminiResponseText} from '../shared/gemini.mjs';

export class AIError extends Error {
  constructor(message, code, status = 502, details = {}) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.status = status;
    Object.assign(this, details);
  }
}


export function getAIConfig(env = process.env) {
  const geminiKey = (env.GEMINI_API_KEY || '').trim();
  const openaiKey = (env.OPENAI_API_KEY || '').trim();
  const provider = (env.AI_PROVIDER || (geminiKey ? 'gemini' : openaiKey ? 'openai' : 'gemini')).trim().toLowerCase();
  if (!['gemini', 'openai'].includes(provider)) throw new Error('Set AI_PROVIDER to gemini or openai in your local .env file.');
  return {
    provider,
    providerLabel: provider === 'gemini' ? 'Google Gemini' : 'OpenAI',
    model: (provider === 'gemini' ? env.GEMINI_MODEL || 'gemini-3.5-flash-lite' : env.OPENAI_MODEL || 'gpt-4.1-mini').trim().replace(/^models\//, ''),
    key: provider === 'gemini' ? geminiKey : openaiKey,
  };
}

export function getAIStatus(config = getAIConfig()) {
  return { aiConfigured: Boolean(config.key), provider: config.provider, providerLabel: config.providerLabel, model: config.model };
}

function requestFor(config, text, kind, signal) {
  const input = `Diagram type: ${kind}\n\nSource text:\n${text}`;
  if (!/^[a-zA-Z0-9._-]+$/.test(config.model)) throw new Error('Use a valid model ID in your local .env file.');
  if (config.provider === 'gemini') {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`,
      options: {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.key },
        body: JSON.stringify(geminiRequestBody(text,kind,config.model)),
      },
    };
  }
  return {
    url: 'https://api.openai.com/v1/responses',
    options: {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key}` },
      body: JSON.stringify({ model: config.model, store: false, instructions, input, text: { format: { type: 'json_schema', name: 'editable_diagram', strict: true, schema: diagramSchema } }, max_output_tokens: 6000 }),
    },
  };
}

function providerError(response, data, config) {
  const provider = config.providerLabel;
  const invalidKey = data?.error?.details?.some?.(d => d.reason === 'API_KEY_INVALID');
  const keyName = config.provider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
  if (invalidKey || response.status === 401 || response.status === 403) return new AIError(`${provider} did not accept the API key or its permissions. Check ${keyName} in your local .env file.`, 'AI_KEY_REJECTED', 400);
  if (response.status === 429) return new AIError(`${provider} reached an account quota or rate limit. Check your provider account, or choose the local generator.`, 'AI_QUOTA', 429);
  if (response.status === 404) return new AIError(`The selected ${provider} model is not available to this key. Update ${config.provider === 'gemini' ? 'GEMINI_MODEL' : 'OPENAI_MODEL'} in .env to a model available in your account.`, 'AI_MODEL_UNAVAILABLE', 400);
  if ([408, 500, 502, 503, 504].includes(response.status)) return new AIError(`${provider} is temporarily unavailable (${response.status}). Try again shortly, or use the local generator.`, 'AI_SERVICE_UNAVAILABLE', 503);
  return new AIError(`${provider} could not complete this request (${response.status}). Check your model and account settings, then try again.`, 'AI_REQUEST_REJECTED', 400);
}


function openaiText(data) {
  if (data.status === 'incomplete') throw new Error('The AI response was incomplete. Try a shorter passage.');
  const contents = (data.output || []).flatMap(o => o.content || []);
  if (contents.some(c => c.type === 'refusal')) throw new Error('The AI service declined this request. Try different source text.');
  return contents.filter(c => c.type === 'output_text').map(c => c.text).join('');
}

export async function generateWithAI(text, kind, signal, { config = getAIConfig(), fetchImpl = globalThis.fetch, onEvent = () => {}, attemptTimeoutMs = 35000, retryDelayMs = 1000 } = {}) {
  if (!config.key) throw new Error(`Add ${config.provider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY'} to your local .env file, then restart Sketchline.`);
  let data;
  for (let attempt = 1; attempt <= 2; attempt++) {
    signal?.throwIfAborted();
    const started = performance.now();
    const timeout = AbortSignal.timeout(attemptTimeoutMs);
    const attemptSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const { url, options } = requestFor(config, text, kind, attemptSignal);
    onEvent({ event: 'provider_request_started', attempt });
    let response;
    try {
      response = await fetchImpl(url, options);
      onEvent({ event: 'provider_headers_received', attempt, httpStatus: response.status, attemptMs: Math.round(performance.now() - started) });
      const raw = await response.text();
      try { data = JSON.parse(raw); } catch {
        if (response.ok) throw new AIError(`${config.providerLabel} returned an unreadable response. Please try again.`, 'AI_INVALID_RESPONSE');
        data = {};
      }
      onEvent({ event: 'provider_body_received', attempt, httpStatus: response.status, attemptMs: Math.round(performance.now() - started), providerStatus: /^[A-Z_]+$/.test(data.error?.status || '') ? data.error.status : undefined });
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      if (timeout.aborted) throw new AIError(`${config.providerLabel} did not respond within ${Math.round(attemptTimeoutMs / 1000)} seconds. Try again shortly, or use the local generator.`, 'AI_TIMEOUT', 504);
      if (error instanceof AIError) throw error;
      const networkCode = error.cause?.code || error.code;
      throw new AIError(`Could not reach ${config.providerLabel}. Check your internet connection and try again.`, 'AI_NETWORK_ERROR', 502, { networkCode: /^[A-Z_]+$/.test(networkCode || '') ? networkCode : undefined });
    }
    if (response.ok) break;
    // Only a definite temporary HTTP failure is retried; a lost response may already have used quota.
    if (attempt === 1 && [408, 500, 502, 503, 504].includes(response.status)) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const waitMs = Math.max(retryDelayMs, Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, 3000) : 0);
      onEvent({ event: 'provider_retry_scheduled', attempt, httpStatus: response.status, retryDelayMs: waitMs });
      await delay(waitMs, undefined, { signal });
      continue;
    }
    throw providerError(response, data, config);
  }
  const result = config.provider === 'gemini' ? geminiResponseText(data) : openaiText(data);
  if (!result) throw new Error(`${config.providerLabel} returned no diagram. Try a more specific passage.`);
  let graph;
  try { graph = JSON.parse(result); } catch { throw new Error(`${config.providerLabel} returned invalid diagram data. Please try again.`); }
  return validateGraph(graph);
}
