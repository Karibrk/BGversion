import { put } from '@vercel/blob';
import { InferenceClient } from '@huggingface/inference';
import { requireKey, blobAuth } from './_auth.js';

const REGISTRY={
 karibrk:{path:'/denik-media/refs/portraits/karibrk.webp',note:'adult male hobbit necromancer; preserve exact face and hobbit proportions'},
 elie:{path:'/denik-media/refs/portraits/elie.webp',note:'9-year-old girl; preserve exact face and age'},
 tina:{path:'/denik-media/refs/portraits/tina.webp',note:'adult woman rogue; preserve exact face'},
 sandor:{path:'/denik-media/refs/portraits/sandor.webp',note:'adult half-orc fighter; preserve exact face and half-orc traits'},
 mer:{path:'/denik-media/refs/portraits/mer.webp',note:'adult grave cleric; preserve exact face'},
 ula:{path:'/denik-media/refs/portraits/ula.webp',note:'girl appearing about 14; preserve exact face and apparent age'},
 dedek:{path:'/denik-media/refs/portraits/dedek.webp',note:'boy appearing about 11; preserve exact face and apparent age'}
};

function abs(req,p){const proto=String(req.headers['x-forwarded-proto']||'https').split(',')[0];return `${proto}://${req.headers.host}${p}`;}
function slug(s){return String(s||'fragment').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'fragment';}
function parseGatewayImage(message){const arr=message?.images;if(Array.isArray(arr)){for(const im of arr){const u=im?.image_url?.url||im?.url;if(u)return u;}}return null;}
async function toBytes(src){
 if(src.startsWith('data:')){const m=src.match(/^data:([^;]+);base64,(.+)$/s);if(!m)throw new Error('Bad data URL');return {type:m[1],bytes:Buffer.from(m[2],'base64')};}
 const r=await fetch(src);if(!r.ok)throw new Error(`Image fetch ${r.status}`);return {type:r.headers.get('content-type')||'image/png',bytes:Buffer.from(await r.arrayBuffer())};
}
function promptFor(text,day,refs){
 const identity=refs.length?`Characters in this scene are canonical campaign characters. Preserve the described age, species, build and identity. Canon notes: ${refs.map(r=>r.id+': '+r.note).join('; ')}.`:'No canonical face reference was supplied; avoid close portrait framing of unreferenced named characters.';
 return `Create one cinematic dark-fantasy illustration for a Dungeons & Dragons / Forgotten Realms campaign memory fragment. ${identity}\nScene source of truth: ${text}\nDay: ${day}.\nStyle: grounded cinematic realism, natural medieval materials, subtle painterly finish, emotionally truthful, no glamour posing, no modern objects. Keep hobbits visibly hobbit-sized. Do not add text, captions, logos or UI. Do not invent extra named characters. Landscape 16:9 unless the scene clearly needs a tighter composition.`;
}
function configured(){
 const out=[];
 if(process.env.HF_TOKEN)out.push('huggingface');
 if(process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN)out.push('gateway');
 if(process.env.OPENAI_API_KEY)out.push('openai');
 return out;
}
function shuffled(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

async function huggingFaceImage(prompt){
 const token=process.env.HF_TOKEN;if(!token)throw Object.assign(new Error('HF_TOKEN není nastaven.'),{code:'PROVIDER_NOT_CONFIGURED'});
 const model=process.env.HF_IMAGE_MODEL||'black-forest-labs/FLUX.1-schnell';
 const client=new InferenceClient(token);
 const blob=await client.textToImage({model,inputs:prompt,provider:'auto',parameters:{width:1344,height:768}});
 return {provider:'huggingface',model,type:blob.type||'image/png',bytes:Buffer.from(await blob.arrayBuffer())};
}

async function openAIImage(prompt,refs){
 const key=process.env.OPENAI_API_KEY;if(!key)throw Object.assign(new Error('OPENAI_API_KEY není nastaven.'),{code:'PROVIDER_NOT_CONFIGURED'});
 const model=process.env.OPENAI_IMAGE_MODEL||'gpt-image-2.5-flare';
 let r;
 if(refs.length){
  const fd=new FormData();fd.append('model',model);fd.append('prompt',prompt);fd.append('size','1536x1024');fd.append('quality','medium');
  for(const ref of refs){const ir=await fetch(ref.url);if(!ir.ok)throw new Error(`Reference ${ref.id} ${ir.status}`);const type=ir.headers.get('content-type')||'image/webp';fd.append('image[]',new Blob([await ir.arrayBuffer()],{type}),`${ref.id}.${type.includes('png')?'png':type.includes('jpeg')?'jpg':'webp'}`);}
  r=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:fd});
 }else{
  r=await fetch('https://api.openai.com/v1/images/generations',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,prompt,size:'1536x1024',quality:'medium'})});
 }
 const raw=await r.text();let j={};try{j=JSON.parse(raw)}catch{j={raw}};
 if(!r.ok)throw new Error(`OpenAI ${r.status}: ${j?.error?.message||raw.slice(0,300)}`);
 const b64=j?.data?.[0]?.b64_json;if(!b64)throw new Error('OpenAI nevrátil obrazová data.');
 return {provider:'openai',model,type:'image/png',bytes:Buffer.from(b64,'base64')};
}

async function gatewayImage(prompt,refs){
 const model=process.env.BANDD_IMAGE_MODEL||'google/gemini-3.1-flash-image-preview';
 const apiKey=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN;if(!apiKey)throw Object.assign(new Error('AI Gateway není nakonfigurovaný.'),{code:'PROVIDER_NOT_CONFIGURED'});
 const content=[{type:'text',text:prompt},...refs.map(r=>({type:'image_url',image_url:{url:r.url,detail:'high'}}))];
 const g=await fetch('https://ai-gateway.vercel.sh/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'user',content}],modalities:['text','image'],stream:false})});
 const raw=await g.text();let j={};try{j=JSON.parse(raw)}catch{j={raw}};
 if(!g.ok){const msg=String(j?.error?.message||raw||'');const type=String(j?.error?.type||'');const billing=g.status===403&&(type==='customer_verification_required'||/credit card|payment method|free credits/i.test(msg));const e=new Error(billing?'Vercel AI Gateway vyžaduje ověřenou platební metodu.':`AI Gateway ${g.status}: ${msg.slice(0,300)}`);e.code=billing?'AI_BILLING_REQUIRED':'AI_GATEWAY_ERROR';throw e;}
 const src=parseGatewayImage(j?.choices?.[0]?.message);if(!src)throw new Error('AI Gateway nevrátil obrázek.');const im=await toBytes(src);
 return {provider:'gateway',model,type:im.type,bytes:im.bytes};
}

async function runProvider(name,prompt,refs){if(name==='huggingface')return huggingFaceImage(prompt);if(name==='gateway')return gatewayImage(prompt,refs);if(name==='openai')return openAIImage(prompt,refs);throw new Error(`Neznámý provider ${name}`);}

export default async function handler(req,res){
 if(!requireKey(req,res))return;if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
 const id=String(req.body?.id||'fragment'),day=Number(req.body?.day||0),text=String(req.body?.text||'').trim();if(!text)return res.status(400).json({ok:false,error:'Missing fragment text'});
 const chars=Array.isArray(req.body?.characters)?req.body.characters.filter(x=>REGISTRY[x]):[];
 const refs=chars.map(c=>({id:c,url:abs(req,REGISTRY[c].path),note:REGISTRY[c].note}));
 const prompt=promptFor(text,day,refs),requested=String(req.body?.provider||'auto').toLowerCase();
 const available=configured();
 if(!available.length)return res.status(503).json({ok:false,code:'PROVIDER_NOT_CONFIGURED',error:'Není nakonfigurovaný žádný generátor.',hint:'Přidej HF_TOKEN, OPENAI_API_KEY nebo zprovozni Vercel AI Gateway.'});
 let order;if(requested==='auto')order=['huggingface','gateway','openai'].filter(x=>available.includes(x));else if(requested==='random')order=shuffled(available);else{if(!available.includes(requested))return res.status(503).json({ok:false,code:'PROVIDER_NOT_CONFIGURED',error:`Provider ${requested} není nakonfigurovaný.`,hint:requested==='huggingface'?'Na Vercelu přidej HF_TOKEN.':requested==='openai'?'Na Vercelu přidej OPENAI_API_KEY.':'Zkontroluj AI Gateway.'});order=[requested];}
 const failures=[];
 for(const provider of order){try{
   const im=await runProvider(provider,prompt,refs);const ext=im.type.includes('webp')?'webp':im.type.includes('jpeg')?'jpg':'png';const path=`art/fragments/day-${String(day).padStart(3,'0')}/${slug(id)}-${Date.now()}.${ext}`;
   const blob=await put(path,im.bytes,{access:'public',contentType:im.type,addRandomSuffix:false,...blobAuth()});
   return res.status(200).json({ok:true,url:blob.url,pathname:blob.pathname,provider:im.provider,model:im.model,characters:chars,references:provider==='huggingface'?[]:refs.map(r=>r.id),createdAt:new Date().toISOString(),tried:failures.map(x=>x.provider).concat(provider)});
  }catch(e){failures.push({provider,error:String(e.message||e).slice(0,260),code:e.code||''});}}
 const billingOnly=failures.length&&failures.every(x=>x.code==='AI_BILLING_REQUIRED');
 return res.status(billingOnly?424:502).json({ok:false,code:billingOnly?'AI_BILLING_REQUIRED':'ALL_PROVIDERS_FAILED',error:'Žádný zvolený generátor nedokončil obrázek.',failures});
}
