import { get, put } from '@vercel/blob';
import { Readable } from 'node:stream';
import { blobAuth } from './_auth.js';

export async function loadState() {
  const result = await get('runtime/latest.json', {
    access: 'private',
    useCache: false,
    ...blobAuth(),
  });
  if (!result || result.statusCode !== 200) return null;
  let text = '';
  for await (const chunk of Readable.fromWeb(result.stream)) text += chunk.toString('utf8');
  return JSON.parse(text);
}

export async function saveState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('Missing state');
  }
  const savedAt = new Date().toISOString();
  const payload = JSON.stringify({ savedAt, state });
  const safeStamp = savedAt.replace(/[:.]/g, '-');
  const auth = blobAuth();
  await put(`runtime/backups/state-${safeStamp}.json`, payload, {
    access: 'private', contentType: 'application/json', addRandomSuffix: false, ...auth,
  });
  await put('runtime/latest.json', payload, {
    access: 'private', contentType: 'application/json', allowOverwrite: true, addRandomSuffix: false, ...auth,
  });
  return { ok: true, savedAt };
}
