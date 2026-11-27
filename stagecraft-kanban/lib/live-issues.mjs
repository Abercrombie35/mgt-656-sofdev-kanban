import {createSign} from 'node:crypto';
import {mergeIssues} from './sync-issues.mjs';
export const sourceRepo='tkg9/656Final-daunting-horizon';
const endpoint='/repos/'+sourceRepo;
let cachedToken;
export function syncConfigured(env=process.env){
  return !!(env.SOURCE_GITHUB_TOKEN||(env.SOURCE_GITHUB_APP_ID&&env.SOURCE_GITHUB_APP_PRIVATE_KEY));
}
async function request(path,token,options={}){
  const response=await fetch('https://api.github.com'+path,{...options,headers:{
    Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',
    'Content-Type':'application/json',...options.headers
  }});
  if(!response.ok)throw new Error('GitHub issue service returned HTTP '+response.status);
  return response.json();
}
async function accessToken(){
  if(process.env.SOURCE_GITHUB_TOKEN)return process.env.SOURCE_GITHUB_TOKEN;
  if(cachedToken&&cachedToken.expires>Date.now()+60000)return cachedToken.token;
  const id=process.env.SOURCE_GITHUB_APP_ID, key=process.env.SOURCE_GITHUB_APP_PRIVATE_KEY;
  if(!id||!key)throw new Error('Issue sync has not been configured.');
  const now=Math.floor(Date.now()/1000);
  const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const payload=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iat:now-60,exp:now+540,iss:id});
  const jwt=payload+'.'+createSign('RSA-SHA256').update(payload).sign(key.replace(/\\n/g,'\n'),'base64url');
  const installation=await request(endpoint+'/installation',jwt);
  const result=await request('/app/installations/'+installation.id+'/access_tokens',jwt,{
    method:'POST',body:JSON.stringify({repositories:['656Final-daunting-horizon'],permissions:{issues:'write'}})
  });
  cachedToken={token:result.token,expires:Date.parse(result.expires_at)};
  return cachedToken.token;
}
export async function openIssueService(boardToken){
  const token=await accessToken();
  const [source,board]=await Promise.all([
    request(endpoint,token),request('/repos/Abercrombie35/mgt-656-sofdev-kanban',boardToken)
  ]);
  if(source.private&&!board.private)throw new Error('Private source issues cannot sync into a public board repository.');
  return {
    async canWrite(login){
      if(typeof login!=='string'||!/^[a-z\d-]{1,39}$/i.test(login))return false;
      try{
        const result=await request(endpoint+'/collaborators/'+encodeURIComponent(login)+'/permission',token);
        return ['admin','write','maintain'].includes(result.permission);
      }catch{return false;}
    },
    async list(){
      const all=[];
      for(let page=1;page<=10;page++){
        const batch=await request(endpoint+'/issues?state=all&per_page=100&page='+page,token);
        all.push(...batch.filter(i=>!i.pull_request).map(normalize));
        if(batch.length<100)return all;
      }
      throw new Error('Issue list is too large to sync safely.');
    },
    async create(card){
      return normalize(await request(endpoint+'/issues',token,{method:'POST',body:JSON.stringify({
        title:card.title,body:managedBody(card)
      })}));
    },
    async update(number,patch){
      if(!Number.isSafeInteger(number)||number<1)throw new Error('Invalid issue number.');
      return normalize(await request(endpoint+'/issues/'+number,token,{method:'PATCH',body:JSON.stringify(patch)}));
    }
  };
}
const normalize=i=>({...i,state:i.state.toUpperCase()});
const marker=id=>'<!-- stagecraft-card:'+id+' -->';
export const managedBody=card=>card.detail+'\n\n---\nAdded via StageCraft Kanban by '+(card.createdByName||'Default')+'.\n'+marker(card.id);
export const matchingIssue=(card,issues)=>issues.find(i=>i.number===card.issueNumber)||issues.find(i=>(i.body||'').includes(marker(card.id)));
const detailFromBody=body=>(body||'').split('\n\n---\nAdded via StageCraft Kanban by ')[0].slice(0,2000);
export function queueIssue(previous,next,change,id,login){
  if(change.type==='add')return next.map(c=>c.id===id?{...c,issueManaged:true,issuePending:{create:true,state:true,content:true,actor:login}}:c);
  const before=previous.find(c=>c.id===change.id),after=next.find(c=>c.id===change.id);
  if(!before||!after||(!after.issueNumber&&!after.issuePending))return next;
  const state=(before.stage==='done')!==(after.stage==='done');
  const content=!!after.issueManaged&&(before.title!==after.title||before.detail!==after.detail);
  if(!state&&!content)return next;
  return next.map(c=>c.id===after.id?{...c,issuePending:{...c.issuePending,...(state?{state:true}:{}),...(content?{content:true}:{}),actor:login}}:c);
}
export function desiredIssueState(cards,card){
  const siblings=cards.filter(c=>c.id===card.id||(card.issueNumber&&c.issueNumber===card.issueNumber));
  return siblings.every(c=>c.stage==='done')?'closed':'open';
}
// Preserve internal board notes and the completed portion of split user stories.
export function reconcileIssues(cards,issues){
  const matched=cards.map(c=>{
    const issue=matchingIssue(c,issues);
    return issue?{...c,issueNumber:issue.number}:c;
  });
  const oldById=new Map(matched.map(c=>[c.id,c]));
  const merged=mergeIssues(matched,issues);
  const pendingNumbers=new Set(matched.filter(c=>c.issuePending).map(c=>c.issueNumber));
  const reopen=new Set();
  for(const card of matched){
    const issue=issues.find(i=>i.number===card.issueNumber);
    if(issue?.state==='OPEN'&&card.issueState==='CLOSED'&&!pendingNumbers.has(card.issueNumber))reopen.add(card.issueNumber);
  }
  return merged.map(card=>{
    const old=oldById.get(card.id);
    const issue=issues.find(i=>i.number===card.issueNumber);
    if(!issue)return card;
    if(old?.issuePending||pendingNumbers.has(card.issueNumber))return {...card,stage:old?.stage||card.stage};
    const stateChanged=old&&old.issueState!==issue.state;
    let stage=card.stage;
    if(stateChanged&&issue.state==='CLOSED')stage='done';
    if(reopen.has(card.issueNumber)){
      const siblings=matched.filter(c=>c.issueNumber===card.issueNumber);
      const target=siblings.find(c=>c.id==='invites'||c.id==='ai-expanded')||siblings.at(-1);
      if(target?.id===card.id&&stage==='done')stage='ready';
    }
    const managed=!!card.issueManaged;
    return {...card,stage,
      ...(managed?{title:issue.title.slice(0,120),detail:detailFromBody(issue.body)}:{}),
      ...(!old?{createdByName:'Imported from GitHub'}:{})
    };
  });
}
