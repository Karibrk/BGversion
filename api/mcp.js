import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { z } from 'zod';
import { authenticateMcpToken, hasScope, protectedResourceUrl, requiredScopeForMcpRequest } from './_mcp-auth.js';
import { asWebRequest, sendWebResponse } from './_web.js';
import { loadState, saveState } from './_state.js';
import { getBackendStatus } from './_status.js';

const text = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });

const mcpHandler = createMcpHandler((server) => {
  server.registerTool('get_backend_status', { description: 'Return the Bernov & Dragons backend, GitHub, and Blob status.', inputSchema: z.object({}) }, async () => text(await getBackendStatus()));
  server.registerTool('get_game_state', { description: 'Read the complete authoritative game state from private Vercel Blob storage.', inputSchema: z.object({}) }, async () => text((await loadState()) || { ok: false, error: 'No cloud state yet' }));
  server.registerTool('save_game_state', { description: 'Replace the complete game state. A timestamped private Blob backup is created before the latest state is overwritten.', inputSchema: z.object({ state: z.record(z.string(), z.unknown()) }) }, async ({ state }) => text(await saveState(state)));
}, { serverInfo: { name: 'bernov-dragons-state', version: '1.1.0' } });

const securedMcpHandler = withMcpAuth(mcpHandler, async (_request, token) => authenticateMcpToken(token), {
  required: true,
  resourceUrl: protectedResourceUrl(),
});

export default async function handler(req, res) {
  const request = await asWebRequest(req);
  let payload;
  try { payload = await request.clone().json(); } catch {}
  const requiredScope = requiredScopeForMcpRequest(payload);
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  let auth;
  try { auth = await authenticateMcpToken(token); } catch {}
  if (requiredScope && auth && !hasScope(auth, requiredScope)) {
    return sendWebResponse(res, new Response(JSON.stringify({ jsonrpc: '2.0', id: payload?.id ?? null, error: { code: -32001, message: `Missing required scope: ${requiredScope}` } }), { status: 403, headers: { 'content-type': 'application/json', 'www-authenticate': `Bearer error="insufficient_scope", scope="${requiredScope}", resource_metadata="https://500900.website/.well-known/oauth-protected-resource"` } }));
  }
  return sendWebResponse(res, await securedMcpHandler(request));
}
