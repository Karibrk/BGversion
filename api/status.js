import { requireKey } from './_auth.js';

export default async function handler(req, res) {
  if (!requireKey(req,res)) return;
  const token = process.env.GITHUB_TOKEN || '';
  const repo = process.env.GITHUB_REPO || 'Karibrk/Bernov-Dragons-GPT';
  let githubReachable = false, githubStatus = null;
  if (token) {
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}`, { headers: {
        Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json',
        'X-GitHub-Api-Version':'2022-11-28', 'User-Agent':'Bernov-Dragons-GPT'
      }});
      githubStatus = r.status; githubReachable = r.ok;
    } catch {}
  }
  res.status(200).json({
    ok:true,
    githubConfigured:!!token,
    githubReachable,
    githubStatus,
    blobConfigured:!!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN),
    aiConfigured:!!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN),
    repo,
    branch:process.env.GITHUB_BRANCH || 'main',
    naming:'DENÍK_CORE_V<version>.gpt.html'
  });
}
