import { blobAuth } from './_auth.js';

export async function getBackendStatus() {
  const token = process.env.GITHUB_TOKEN || '';
  const repo = process.env.GITHUB_REPO || 'Karibrk/Bernov-Dragons-GPT';
  let githubReachable = false;
  let githubStatus = null;
  if (token) {
    try {
      const response = await fetch(`https://api.github.com/repos/${repo}`, { headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Bernov-Dragons-GPT',
      }});
      githubStatus = response.status;
      githubReachable = response.ok;
    } catch {}
  }
  return {
    ok: true,
    githubConfigured: !!token,
    githubReachable,
    githubStatus,
    blobConfigured: !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN),
    aiConfigured: !!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN),
    repo,
    branch: process.env.GITHUB_BRANCH || 'main',
    naming: 'DENÍK_CORE_V<version>.gpt.html',
  };
}
