const lanes=[['backlog','Backlog','Ideas'],['wip','WIP','Work in progress'],['ready','Ready','Next up'],['building','Building','In progress'],['done','Done','Shipped']];
let stories=[], revision=null, login=null, busy=false, editing=null, editRevision=null, syncEnabled=false;
const $=id=>document.getElementById(id);
const feedback=message=>{$('feedback').textContent=message;};
const total=()=>stories.reduce((n,s)=>n+s.points,0);
const done=()=>stories.filter(s=>s.stage==='done').reduce((n,s)=>n+s.points,0);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const authorLabel=s=>`<p style="font-size:11px;margin:5px 0"><span class="points">Added by: ${escape(s.createdByName||'Default')}</span>${s.issuePending?' · Pending issue sync':''}</p>`;
const issueLink=s=>{
  if(!Number.isSafeInteger(s.issueNumber)||s.issueNumber<1)return '';
  const url='https://github.com/tkg9/656Final-daunting-horizon/issues/'+s.issueNumber;
  const state=s.issueState==='CLOSED'?' · Closed':s.issueState==='OPEN'?' · Open':'';
  const people=Array.isArray(s.issueAssignees)?s.issueAssignees.filter(x=>typeof x==='string').map(x=>'@'+x).join(', '):'';
  const related=Array.isArray(s.issueRelated)?s.issueRelated.filter(i=>Number.isSafeInteger(i.number)&&i.number>0).map(i=>`<a href="https://github.com/tkg9/656Final-daunting-horizon/issues/${i.number}" target="_blank" rel="noopener noreferrer">#${i.number} (closed)</a>`).join(', '):'';
  return `<p><a href="${url}" target="_blank" rel="noopener noreferrer">GitHub #${s.issueNumber}${state} ↗</a>${people?' · '+escape(people):''}${related?'<br>Related: '+related:''}</p>${s.issueBody?`<details><summary>GitHub acceptance criteria</summary><p>${escape(s.issueBody)}</p></details>`:''}`;
};
function render(){
  $('progress').textContent=login?`${done()} / ${total()} points complete`:'Sign in to view progress';
  $('story-count').textContent=login?`${stories.length} stories`:'Private board';
  $('identity').textContent=login?'Signed in as @'+login:'';
  $('sign-in').hidden=!!login;
  $('sign-out').hidden=!login;
  $('sync-issues').hidden=!login;
  $('sync-issues').disabled=busy;
  $('new-story').querySelectorAll('input,textarea,select,button').forEach(el=>el.disabled=!login||busy);
  const disabled=busy||!login?'disabled':'';
  $('board').innerHTML=lanes.map(([id,label,cue],i)=>{
    const cards=stories.filter(s=>s.stage===id),pts=cards.reduce((n,s)=>n+s.points,0);
    return `<div class="lane"><div class="lane-head"><div><b>${label}</b><small>${cue}</small></div><span class="points">${pts} pts</span></div><div class="notes">${cards.map((s)=>`<article class="note ${id}"><div class="note-top"><strong>${escape(s.title)}</strong><span class="points">${escape(s.points)} pts</span></div>${authorLabel(s)}<p>${escape(s.detail)}</p>${issueLink(s)}<div class="note-actions">${i?`<button ${disabled} data-action="move" data-id="${escape(s.id)}" data-stage="${lanes[i-1][0]}">Back</button>`:''}<button ${disabled} data-action="edit" data-id="${escape(s.id)}">Edit</button>${i<lanes.length-1?`<button ${disabled} class="move" data-action="move" data-id="${escape(s.id)}" data-stage="${lanes[i+1][0]}">Move to ${lanes[i+1][1]}</button>`:''}</div></article>`).join('')}</div></div>`;
  }).join('');
}
async function getBoard({quiet=false}={}){
  if(busy||$('editor').open)return;
  try{
    const res=await fetch('/api/board',{cache:'no-store'});
    const data=await res.json();
    if(!res.ok){
      if([401,403].includes(res.status)){login=null;stories=[];revision=null;render();}
      if(!quiet||res.status===403)feedback(data.error);
      return;
    }
    if(busy||$('editor').open)return;
    ({stories,revision,login}=data);syncEnabled=data.syncStatus==='available';render();
    if(!quiet)feedback(syncEnabled?'Shared board · GitHub issue synchronization enabled':'Shared board · issue sync needs setup');
  }catch{if(!quiet)feedback('Unable to connect to the board. Refresh to retry.');}
}
async function save(change,expected=revision){
  if(!login||busy)return false;
  busy=true;render();feedback('Saving…');
  try{
    const res=await fetch('/api/board',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...change,revision:expected})});
    const data=await res.json();
    if(!res.ok){
      feedback(data.error||'Could not save.');
      if([401,403].includes(res.status)){login=null;stories=[];revision=null;}
      if(res.status===409){busy=false;await getBoard({quiet:true});feedback('Another teammate updated the board. Review the changes and try again.');}
      return false;
    }
    ({stories,revision,login}=data);syncEnabled=data.syncStatus!=='not-configured';
    feedback(data.syncStatus==='synced'?'Board and GitHub issues synchronized.':syncEnabled?'Board saved; syncing linked issue…':'Board saved; issue synchronization awaits setup.');
    if(data.syncStatus==='pending')queueMicrotask(()=>syncNow());
    return true;
  }catch{feedback('Connection lost. Your change was not confirmed. Refresh before retrying.');return false;}
  finally{busy=false;render();}
}
async function syncNow({quiet=false}={}){
  if(!login||busy||$('editor').open)return;
  busy=true;render();
  if(!quiet)feedback('Syncing GitHub issues…');
  try{
    const res=await fetch('/api/board?action=sync',{method:'POST'});
    const data=await res.json();
    if(!res.ok){
      if(res.status===409){if(!quiet)feedback('Another teammate is syncing. Retrying automatically.');}
      else feedback(data.error||'Issue sync unavailable.');
      return;
    }
    ({stories,revision,login}=data);
    syncEnabled=data.syncStatus!=='not-configured';
    if(data.syncStatus==='not-configured')feedback('Issue sync needs a GitHub project-repository authorization.');
    else if(data.syncStatus==='pending')feedback('Some issue updates are queued. They will retry automatically.');
    else if(!quiet)feedback('Board and GitHub issues synchronized.');
  }catch{feedback('Issue sync could not connect. Board edits remain saved.');}
  finally{busy=false;render();}
}
const cardFrom=prefix=>({title:$(prefix+'-title').value,detail:$(prefix+'-detail').value||'Acceptance criteria to decide together.',points:+$(prefix+'-points').value,stage:$(prefix+'-stage').value});
$('board').addEventListener('click',e=>{
  const button=e.target.closest('button[data-action]');if(!button||!login||busy)return;
  const id=button.dataset.id;
  if(button.dataset.action==='move')return save({type:'move',id,stage:button.dataset.stage});
  const s=stories.find(x=>String(x.id)===id);if(!s)return;
  editing=s.id;editRevision=revision;
  for(const k of ['title','detail','points','stage'])$('edit-'+k).value=s[k];
  $('editor').returnValue='cancel';$('editor').showModal();
});
$('new-story').addEventListener('submit',async e=>{
  e.preventDefault(); if(await save({type:'add',card:cardFrom('new')}))e.target.reset();
});
$('editor').addEventListener('close',()=>{
  if($('editor').returnValue==='save')save({type:'edit',id:editing,card:cardFrom('edit')},editRevision);
});
$('sign-out').addEventListener('click',async()=>{
  try{const response=await fetch('/api/board?action=logout',{method:'POST'}); if(response.ok){login=null;stories=[];revision=null;render();feedback('Signed out.');}}catch{feedback('Unable to sign out. Try again.');}
});
$('sync-issues').addEventListener('click',()=>syncNow());
render();getBoard().then(()=>{if(syncEnabled)syncNow();});
setInterval(()=>getBoard({quiet:true}),15000);
setInterval(()=>{if(syncEnabled)syncNow({quiet:true});},60000);
