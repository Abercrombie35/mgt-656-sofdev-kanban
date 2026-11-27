import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { seed } from '../lib/seed.mjs';
import { applyChange } from '../lib/model.mjs';

const repo = 'Abercrombie35/mgt-656-sofdev-kanban';
const branch = 'board-data';
const path = 'stories.json';
const config = () => {
  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, BOARD_GITHUB_TOKEN, SESSION_SECRET, APP_URL } = process.env;
  if (![GITHUB_CLIENT_ID,GITHUB_CLIENT_SECRET,BOARD_GITHUB_TOKEN,SESSION_SECRET,APP_URL].every(Boolean) ||
      SESSION_SECRET.length < 32 || !APP_URL.startsWith('https://')) throw new Error('Deployment setup incomplete.');
  return {clientId:GITHUB_CLIENT_ID, clientSecret:GITHUB_CLIENT_SECRET, token:BOARD_GITHUB_TOKEN, secret:SESSION_SECRET, origin:new URL(APP_URL).origin};
};
const cookie = (name,value,age) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const cookies = req => Object.fromEntries((req.headers.get('cookie') || '').split(';').map(s=>s.trim().split(/=(.*)/s).slice(0,2)).filter(x=>x.length===2));
const signature = (value,c) => createHmac('sha256',c.secret).update(value).digest('base64url');
function sign(login,c) {
  const body = Buffer.from(JSON.stringify({login,exp:Date.now()+8*3600000})).toString('base64url');
  return body+'.'+signature(body,c);
}
function session(req,c) {
  try {
    const [body,mac] = (cookies(req).board_session || '').split('.');
    const expected = signature(body,c);
    if (!mac || mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac),Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(body,'base64url'));
    return data.exp > Date.now() && /^[a-z\d-]{1,39}$/i.test(data.login) ? data.login : null;
  } catch { return null; }
}
const json = (data,status=200,headers={}) => Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
const redirect = (url,values=[]) => {
  const headers = new Headers({Location:url,'Cache-Control':'no-store'});
  for(const value of values) headers.append('Set-Cookie',value);
  return new Response(null,{status:302,headers});
};
async function github(endpoint,token,options={}) {
  return fetch('https://api.github.com'+endpoint,{...options,headers:{
    Accept:'application/vnd.github+json', Authorization:`Bearer ${token}`,
    'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',...options.headers
  }});
}
async function permission(login,c) {
  const res = await github(`/repos/${repo}/collaborators/${encodeURIComponent(login)}/permission`,c.token);
  if(res.status===404) return false;
  if(!res.ok) throw new Error('Unable to verify repository membership.');
  return ['admin','write','maintain'].includes((await res.json()).permission);
}
async function board(c) {
  const res = await github(`/repos/${repo}/contents/${path}?ref=${branch}`,c.token);
  if(res.status===404) {
    // Only fall back to seed when the data branch is known to exist.
    const ref=await github(`/repos/${repo}/branches/${branch}`,c.token);
    if(!ref.ok) throw new Error('Create the board-data branch before using the board.');
    return {stories:seed, revision:null};
  }
  if(!res.ok) throw new Error('Unable to load shared board.');
  const file=await res.json();
  const stories=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
  if(!Array.isArray(stories)) throw new Error('Invalid board storage.');
  return {stories,revision:file.sha};
}
export default {
  async fetch(req) {
    try {
      const c=config(), action=new URL(req.url).searchParams.get('action');
      if(req.method==='GET' && action==='login') {
        const state=randomBytes(32).toString('hex');
        const target=new URL('https://github.com/login/oauth/authorize');
        target.searchParams.set('client_id',c.clientId);
        target.searchParams.set('redirect_uri',c.origin+'/api/board?action=callback');
        target.searchParams.set('state',state);
        return redirect(target.toString(),[cookie('board_state',state,600)]);
      }
      if(req.method==='GET' && action==='callback') {
        const params=new URL(req.url).searchParams;
        const code=params.get('code'), state=params.get('state');
        if(!code || !state || state!==cookies(req).board_state) return json({error:'Sign-in expired. Return to the board and try again.'},400);
        const exchange=await fetch('https://github.com/login/oauth/access_token',{
          method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},
          body:JSON.stringify({client_id:c.clientId,client_secret:c.clientSecret,code,redirect_uri:c.origin+'/api/board?action=callback'})
        });
        const token=(await exchange.json()).access_token;
        if(!token) return json({error:'Unable to sign in.'},401);
        const userResponse=await github('/user',token);
        if(!userResponse.ok) return json({error:'Unable to verify GitHub identity.'},401);
        const login=(await userResponse.json()).login;
        if(!await permission(login,c)) return json({error:'Only accepted collaborators with write access to the Kanban repository can use this board.'},403);
        return redirect(c.origin+'/',[cookie('board_state','',0),cookie('board_session',sign(login,c),28800)]);
      }
      if(req.method==='POST' && req.headers.get('origin')!==c.origin) return json({error:'Invalid request origin.'},403);
      if(req.method==='POST' && action==='logout') return json({ok:true},200,{'Set-Cookie':cookie('board_session','',0)});
      const login=session(req,c);
      if(!login) return json({error:'Sign in with GitHub to continue.'},401);
      if(!await permission(login,c)) return json({error:'Repository write access is required.'},403);
      if(req.method==='GET') return json({...await board(c),login});
      if(req.method!=='POST') return json({error:'Method not allowed.'},405);
      if(!req.headers.get('content-type')?.includes('application/json')) return json({error:'JSON required.'},415);
      const raw=await req.text();
      if(raw.length>20000) return json({error:'Request too large.'},413);
      let change;
      try { change=JSON.parse(raw); } catch { return json({error:'Invalid request.'},400); }
      const current=await board(c);
      if(change.revision!==current.revision) return json({error:'The board changed. Refresh and try again.'},409);
      let stories;
      let author;
      if(change?.type==='add'){
        const profile=await github('/users/'+encodeURIComponent(login),c.token);
        if(!profile.ok) return json({error:'Unable to verify your GitHub display name. Try again.'},502);
        const name=(await profile.json()).name;
        author={name:typeof name==='string'&&name.trim()?name.trim().slice(0,200):'GitHub display name not set',login,createdAt:new Date().toISOString()};
      }
      try { stories=applyChange(current.stories,change,randomUUID(),author); } catch(e) { return json({error:e.message},400); }
      const data={message:`Update board by @${login}`,branch,content:Buffer.from(JSON.stringify(stories,null,2)+'\n').toString('base64')};
      if(current.revision) data.sha=current.revision;
      const saved=await github(`/repos/${repo}/contents/${path}`,c.token,{method:'PUT',body:JSON.stringify(data)});
      if(saved.status===409 || saved.status===422) return json({error:'Unable to save this revision. Refresh and try again.'},409);
      if(!saved.ok) return json({error:'Unable to save changes to GitHub.'},502);
      return json({stories,revision:(await saved.json()).content.sha,login});
    } catch(e) {
      console.error('Board operation failed:',e.message);
      return json({error:'Board unavailable. Check deployment configuration or try again later.'},503);
    }
  }
};
