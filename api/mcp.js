import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { z } from 'zod';
import { isAllowedKey } from './_auth.js';
import { loadState, saveState } from './_state.js';
import { getBackendStatus } from './_status.js';

const text = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });

const mcpHandler = createMcpHandler((server) => {
  server.registerTool('get_backend_status', {
    description: 'Return the Bernov & Dragons backend, GitHub, and Blob status.',
    inputSchema: z.object({}),
  }, async () => text(await getBackendStatus()));

  server.registerTool('get_game_state', {
    description: 'Read the complete authoritative game state from private Vercel Blob storage.',
    inputSchema: z.object({}),
  }, async () => {
    const state = await loadState();
    return text(state || { ok: false, error: 'No cloud state yet' });
  });

  server.registerTool('save_game_state', {
    description: 'Replace the complete game state. A timestamped private Blob backup is created before the latest state is overwritten.',
    inputSchema: z.object({ state: z.record(z.string(), z.unknown()) }),
  }, async ({ state }) => text(await saveState(state)));
}, {
  serverInfo: { name: 'bernov-dragons-state', version: '1.0.0' },
});

const securedMcpHandler = withMcpAuth(
  mcpHandler,
  async (_request, bearerToken) => {
    if (!bearerToken || !isAllowedKey(bearerToken)) return undefined;
    return { token: bearerToken, clientId: 'bernov-dragons-agent', scopes: ['state:read', 'state:write'] };
  },
  { required: true, resourceUrl: 'https://500900.website/api/mcp' },
);

async function asWebRequest(req) {
  const protocol = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host || '500900.website';
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) headers.set(name, value.join(','));
    else if (value !== undefined) headers.set(name, String(value));
  }
  if (!headers.has('authorization') && headers.has('x-bandd-key')) {
    headers.set('authorization', `Bearer ${headers.get('x-bandd-key')}`);
  }
  const init = { method: req.method, headers };
  if (!['GET', 'HEAD'].includes(req.method || 'GET') && req.body !== undefined) {
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }
  return new Request(`${protocol}://${host}${req.url || '/api/mcp'}`, init);
}

export default async function handler(req, res) {
  const response = await securedMcpHandler(await asWebRequest(req));
  res.status(response.status);
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.send(Buffer.from(await response.arrayBuffer()));
}
