import { requireKey } from './_auth.js';
import { getBackendStatus } from './_status.js';

export default async function handler(req, res) {
  if (!requireKey(req, res)) return;
  return res.status(200).json(await getBackendStatus());
}
