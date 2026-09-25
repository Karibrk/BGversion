import { requireKey } from './_auth.js';
import { loadState, saveState } from './_state.js';

export default async function handler(req, res) {
  if (!requireKey(req, res)) return;
  if (req.method === 'GET') {
    try {
      const state = await loadState();
      if (!state) return res.status(404).json({ ok: false, error: 'No cloud state yet' });
      return res.status(200).json(state);
    } catch (error) { return res.status(500).json({ ok: false, error: String(error.message || error) }); }
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  try {
    return res.status(200).json(await saveState(req.body?.state));
  } catch (error) {
    const status = error instanceof TypeError ? 400 : 500;
    return res.status(status).json({ ok: false, error: String(error.message || error) });
  }
}
