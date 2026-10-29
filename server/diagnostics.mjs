import { appendFile, mkdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';

// An allowlist prevents prompts, diagram text, headers and credentials entering the log.
const fields = new Set(['requestId', 'event', 'provider', 'model', 'elapsedMs', 'attempt', 'attemptMs', 'httpStatus', 'providerStatus', 'errorCode', 'networkCode', 'inputCharacters', 'nodeCount', 'edgeCount', 'retryDelayMs']);
export function createDiagnostics(directory, { maxBytes = 512000, consoleImpl = console } = {}) {
  const filename = path.join(directory, 'network.jsonl');
  let queue = Promise.resolve();
  let warned = false;
  return details => {
    const record = { timestamp: new Date().toISOString() };
    for (const [key, value] of Object.entries(details)) {
      if (fields.has(key) && (typeof value === 'number' || typeof value === 'string')) record[key] = value;
    }
    const line = JSON.stringify(record);
    consoleImpl.info(line);
    queue = queue.catch(() => {}).then(async () => {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      if ((await stat(filename).catch(() => null))?.size >= maxBytes) await rename(filename, filename + '.previous');
      await appendFile(filename, line + '\n', { mode: 0o600 });
    }).catch(() => {
      if (!warned) { consoleImpl.warn('Sketchline could not save its network timing log.'); warned = true; }
    });
    return queue;
  };
}
