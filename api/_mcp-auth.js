import { createRemoteJWKSet, jwtVerify } from 'jose';
import { isAllowedKey } from './_auth.js';

const resource = 'https://500900.website/api/mcp';
let jwks;

function auth0Config() {
  const issuer = process.env.AUTH0_ISSUER;
  const audience = process.env.AUTH0_AUDIENCE;
  if (!issuer || !audience) return null;
  return { issuer: issuer.endsWith('/') ? issuer : `${issuer}/`, audience };
}

function scopesFromToken(payload) {
  if (typeof payload.scope === 'string') return payload.scope.split(' ').filter(Boolean);
  if (Array.isArray(payload.permissions)) return payload.permissions.filter((scope) => typeof scope === 'string');
  return [];
}

export function auth0Issuer() {
  return auth0Config()?.issuer || null;
}

export async function authenticateMcpToken(token) {
  if (!token) return undefined;
  if (isAllowedKey(token)) {
    return { token, clientId: 'legacy-bandd-agent', scopes: ['state:read', 'state:write'] };
  }
  const config = auth0Config();
  if (!config) return undefined;
  if (!jwks) jwks = createRemoteJWKSet(new URL('.well-known/jwks.json', config.issuer));
  const { payload } = await jwtVerify(token, jwks, {
    issuer: config.issuer,
    audience: config.audience,
  });
  const scopes = scopesFromToken(payload);
  return {
    token,
    clientId: typeof payload.azp === 'string' ? payload.azp : typeof payload.sub === 'string' ? payload.sub : 'auth0-client',
    scopes,
    expiresAt: payload.exp,
  };
}

export function hasScope(auth, scope) {
  return Boolean(auth?.scopes?.includes(scope));
}

export function requiredScopeForMcpRequest(body) {
  if (body?.method !== 'tools/call') return null;
  switch (body.params?.name) {
    case 'get_backend_status':
    case 'get_game_state':
      return 'state:read';
    case 'save_game_state':
      return 'state:write';
    default:
      return null;
  }
}

export function protectedResourceUrl() {
  return resource;
}
