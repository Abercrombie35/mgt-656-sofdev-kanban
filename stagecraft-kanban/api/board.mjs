import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { seed } from '../lib/seed.mjs';
import { applyChange } from '../lib/model.mjs';
import { syncConfigured, openIssueService, queueIssue, desiredIssueState, matchingIssue, managedBody, reconcileIssues } from '../lib/live-issues.mjs';

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
class BoardConflict extends Error {}
function pendingSignature(card,c){
  const {signature:ignored,...pending}=card.issuePending||{};
  return signature(JSON.stringify({
    id:card.id,title:card.title,detail:card.detail,stage:card.stage,
    issueNumber:pending.create?null:card.issueNumber||null,
    issueManaged:!!card.issueManaged,createdByName:card.createdByName||null,pending
  }),c);
}
function verifiedPending(card,c){
  const signed=card?.issuePending?.signature;
  if(typeof signed!=='string')return false;
  const expected=pendingSignature(card,c);
  return signed.length===expected.length&&timingSafeEqual(Buffer.from(signed),Buffer.from(expected));
}
async function saveBoard(c,current,stories,message){
  const data={message,branch,content:Buffer.from(JSON.stringify(stories,null,2)+'\n').toString('base64')};
  if(current.revision)data.sha=current.revision;
  const saved=await github(`/repos/${repo}/contents/${path}`,c.token,{method:'PUT',body:JSON.stringify(data)});
  if(saved.status===409||saved.status===422)throw new BoardConflict();
  if(!saved.ok)throw new Error('Unable to save changes to GitHub.');
  return {stories,revision:(await saved.json()).content.sha};
}
async function syncBoard(c){
  let current=await board(c);
  if(!syncConfigured())return {...current,syncStatus:'not-configured'};
  // A short optimistic lease prevents overlapping pollers from both creating
  // an issue for the same card. Retrying finds its unique body marker.
  if(current.stories.some(s=>s.issuePending&&s.issueLease?.expires>Date.now()))return {...current,syncStatus:'pending'};
  const service=await openIssueService(c.token);
  let issues=await service.list();
  let stories=reconcileIssues(current.stories,issues);
  const pending=stories.find(s=>s.issuePending);
  if(!pending){
    if(JSON.stringify(stories)!==JSON.stringify(current.stories))
      current=await saveBoard(c,current,stories,'Synchronize StageCraft GitHub issues');
    return {...current,syncStatus:'synced'};
  }
  if(!verifiedPending(current.stories.find(s=>s.id===pending.id),c)||
     !await service.canWrite(pending.issuePending.actor))throw new Error('The pending edit was not made by an authorized source-repository collaborator.');
  const lease={id:randomUUID(),expires:Date.now()+90000};
  stories=stories.map(s=>s.id===pending.id?{...s,issueLease:lease}:s);
  current=await saveBoard(c,current,stories,'Claim StageCraft issue sync');
  try{
    let issue=matchingIssue(pending,issues);
    if(!issue){
      if(!pending.issuePending.create)throw new Error('Linked GitHub issue no longer exists.');
      issue=await service.create(pending);
    }
    const desired=desiredIssueState(stories,{...pending,issueNumber:issue.number});
    const patch={};
    if(pending.issuePending.state&&issue.state.toLowerCase()!==desired)patch.state=desired;
    if(pending.issueManaged&&pending.issuePending.content){
      if(issue.title!==pending.title)patch.title=pending.title;
      if(issue.body!==managedBody(pending))patch.body=managedBody(pending);
    }
    if(Object.keys(patch).length)issue=await service.update(issue.number,patch);
    issues=[...issues.filter(i=>i.number!==issue.number),issue];
    stories=stories.map(s=>{
      if(s.id!==pending.id)return s;
      const {issuePending,issueLease,...rest}=s;
      return {...rest,issueNumber:issue.number,issueState:issue.state};
    });
    stories=reconcileIssues(stories,issues);
    current=await saveBoard(c,current,stories,'Sync linked GitHub issue #'+issue.number);
    return {...current,syncStatus:stories.some(s=>s.issuePending)?'pending':'synced'};
  }catch(error){
    // Do not discard a pending operation on provider failure. Release its
    // lease if this revision still exists, so the next poll can retry.
    if(!(error instanceof BoardConflict)){
      try{await saveBoard(c,current,current.stories.map(s=>{
        if(s.id!==pending.id)return s;
        const {issueLease,...rest}=s;return rest;
      }),'Release failed issue sync lease');}catch{}
    }
    throw error;
  }
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
      if(req.method==='GET') return json({...await board(c),login,syncStatus:syncConfigured()?'available':'not-configured'});
      if(req.method==='POST'&&action==='sync'){
        try{return json({...await syncBoard(c),login});}
        catch(e){
          if(e instanceof BoardConflict)return json({error:'Another teammate is syncing. Refresh and retry.'},409);
          console.error('Issue sync failed:',e.message);
          return json({error:'GitHub issue sync unavailable. Board changes remain saved; retry after checking the integration.'},503);
        }
      }
      if(req.method!=='POST') return json({error:'Method not allowed.'},405);
      if(!req.headers.get('content-type')?.includes('application/json')) return json({error:'JSON required.'},415);
      const raw=await req.text();
      if(raw.length>20000) return json({error:'Request too large.'},413);
      let change;
      try { change=JSON.parse(raw); } catch { return json({error:'Invalid request.'},400); }
      const current=await board(c);
      if(change.revision!==current.revision) return json({error:'The board changed. Refresh and try again.'},409);
      const existing=current.stories.find(s=>s.id===change.id);
      if(existing?.issuePending&&!verifiedPending(existing,c))return json({error:'This card has an invalid pending issue update. Ask the board administrator to review it.'},409);
      let stories;
      let author;
      if(change?.type==='add'){
        const profile=await github('/users/'+encodeURIComponent(login),c.token);
        if(!profile.ok) return json({error:'Unable to verify your GitHub display name. Try again.'},502);
        const name=(await profile.json()).name;
        author={name:typeof name==='string'&&name.trim()?name.trim().slice(0,200):'GitHub display name not set',login,createdAt:new Date().toISOString()};
      }
      const id=randomUUID();
      try {
        stories=queueIssue(current.stories,applyChange(current.stories,change,id,author),change,id,login);
        const changedId=change.type==='add'?id:change.id;
        stories=stories.map(s=>s.id===changedId&&s.issuePending?{
          ...s,issuePending:{...s.issuePending,signature:pendingSignature(s,c)}
        }:s);
      } catch(e) { return json({error:e.message},400); }
      let saved;
      try{saved=await saveBoard(c,current,stories,`Update board by @${login}`);}
      catch(e){if(e instanceof BoardConflict)return json({error:'Unable to save this revision. Refresh and try again.'},409);throw e;}
      return json({...saved,login,syncStatus:syncConfigured()?'pending':'not-configured'});
    } catch(e) {
      console.error('Board operation failed:',e.message);
      return json({error:'Board unavailable. Check deployment configuration or try again later.'},503);
    }
  }
};
