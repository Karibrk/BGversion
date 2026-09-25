import { requireKey } from './_auth.js';
export default async function handler(req,res){
 if(!requireKey(req,res))return;
 const token=process.env.GITHUB_TOKEN,repo=process.env.GITHUB_REPO||'Karibrk/Bernov-Dragons-GPT',branch=process.env.GITHUB_BRANCH||'main',path='.gpt-write-test.txt';
 if(!token)return res.status(503).json({ok:false,error:'GITHUB_TOKEN missing'});
 const headers={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Bernov-Dragons-GPT'};
 const url=`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`;let sha=null;
 const g=await fetch(`${url}?ref=${encodeURIComponent(branch)}`,{headers});if(g.ok){sha=(await g.json()).sha||null}else if(g.status!==404)return res.status(g.status).json({ok:false,error:(await g.text()).slice(0,300)});
 const content=`Bernov & Dragons GPT write test\nTimestamp: ${new Date().toISOString()}\nNaming: DENÍK_CORE_V<version>.gpt.html\n`;
 const body={message:'test: verify Vercel GitHub write access',content:Buffer.from(content).toString('base64'),branch};if(sha)body.sha=sha;
 const w=await fetch(url,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});const txt=await w.text();
 if(!w.ok)return res.status(w.status).json({ok:false,error:txt.slice(0,400)});let j={};try{j=JSON.parse(txt)}catch{}
 return res.status(200).json({ok:true,path,commitSha:j?.commit?.sha||null});
}
