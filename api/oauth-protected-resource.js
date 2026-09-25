import { generateProtectedResourceMetadata } from 'mcp-handler';
import { auth0Issuer, protectedResourceUrl } from './_mcp-auth.js';
import { sendWebResponse } from './_web.js';

export default async function handler(req, res) {
  const issuer = auth0Issuer();
  if (!issuer) return res.status(503).json({ error: 'Auth0 OAuth is not configured.' });
  const metadata = generateProtectedResourceMetadata({
    authServerUrls: [issuer],
    resourceUrl: protectedResourceUrl(),
    additionalMetadata: { scopes_supported: ['state:read', 'state:write'] },
  });
  return sendWebResponse(res, new Response(JSON.stringify(metadata), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } }));
}
