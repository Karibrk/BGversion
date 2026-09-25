export async function asWebRequest(req) {
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
  return new Request(`${protocol}://${host}${req.url || '/'}`, init);
}

export async function sendWebResponse(res, response) {
  res.status(response.status);
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.send(Buffer.from(await response.arrayBuffer()));
}
