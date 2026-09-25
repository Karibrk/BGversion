import { put, get } from '@vercel/blob';
import { requireKey, blobAuth } from './_auth.js';
import { Readable } from 'node:stream';

export default async function handler(req, res) {
  if (!requireKey(req,res)) return;
  const auth = blobAuth();
  if (req.method === 'GET') {
    try {
      const result = await get('runtime/latest.json', { access:'private', useCache:false, ...auth });
      if (!result || result.statusCode !== 200) return res.status(404).json({ok:false,error:'No cloud state yet'});
      let text='';
      for await (const chunk of Readable.fromWeb(result.stream)) text += chunk.toString('utf8');
      const parsed = JSON.parse(text);
      return res.status(200).json(parsed);
    } catch (e) { return res.status(500).json({ok:false,error:String(e.message||e)}); }
  }
  if (req.method !== 'POST') return res.status(405).json({ok:false,error:'Method not allowed'});
  try {
    const state = req.body && req.body.state;
    if (!state || typeof state !== 'object') return res.status(400).json({ok:false,error:'Missing state'});
    const savedAt = new Date().toISOString();
    const payload = JSON.stringify({savedAt,state});
    const safeStamp = savedAt.replace(/[:.]/g,'-');
    await put(`runtime/backups/state-${safeStamp}.json`, payload, {access:'private',contentType:'application/json',addRandomSuffix:false,...auth});
    await put('runtime/latest.json', payload, {access:'private',contentType:'application/json',allowOverwrite:true,addRandomSuffix:false,...auth});
    return res.status(200).json({ok:true,savedAt});
  } catch (e) { return res.status(500).json({ok:false,error:String(e.message||e)}); }
}
