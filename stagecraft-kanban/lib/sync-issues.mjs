import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {seed} from './seed.mjs';

const repository='tkg9/656Final-daunting-horizon';
// Existing canonical issues from docs/user-stories.md. Split implementation
// cards may share the parent issue, but never create a duplicate GitHub issue.
const links={
  production:7, permissions:7, invites:7, script:8, ai:9,'ai-expanded':9,
  casting:11,rehearsal:12,attendance:13,actor:14,cue:15,inventory:16
};
const required=[7,8,9,11,12,13,14,15,16];
const aliases={17:7,18:8,19:9};
const metadata=issue=>({
  issueNumber:issue.number,
  issueState:issue.state,
  issueAssignees:(issue.assignees||[]).map(a=>a.login).filter(Boolean),
  issueLabels:(issue.labels||[]).map(l=>l.name).filter(Boolean)
});
export function mergeIssues(previous,issues){
  if(!Array.isArray(previous)||!Array.isArray(issues))throw new Error('Invalid board or issue list');
  if(new Set(previous.map(s=>s.id)).size!==previous.length)throw new Error('Duplicate board IDs');
  const byNumber=new Map(issues.filter(i=>Number.isSafeInteger(i.number)&&['OPEN','CLOSED'].includes(i.state)).map(i=>[i.number,i]));
  const missing=required.filter(n=>!byNumber.has(n));
  if(missing.length)throw new Error('Expected user-story issues not returned: '+missing.join(', ')+'. No board changes made.');
  const existing=new Map(previous.map(s=>[s.id,s]));
  // Ensure every audited story exists without discarding team-created cards.
  const all=[...previous,...seed.filter(s=>!existing.has(s.id))];
  const consumed=new Set(Object.keys(aliases).map(Number).filter(n=>byNumber.has(n)&&byNumber.get(n).state==='CLOSED'));
  const board=all.map(card=>{
    // Issue #10 is specifically cited for character extraction; when present
    // as an actual issue, link the completed AI task directly to it.
    const number=card.id==='ai'&&byNumber.has(10)?10:links[card.id]||card.issueNumber;
    const issue=byNumber.get(number);
    if(!issue)return card;
    consumed.add(number);
    const imported=card.id==='github-issue-'+number;
    const related=[...consumed].filter(n=>aliases[n]===number).map(n=>({number:n,state:byNumber.get(n).state}));
    return {...card,...metadata(issue),issueRelated:related,issueBody:(issue.body||'').slice(0,12000),
      ...(imported?{title:issue.title.slice(0,120),stage:issue.state==='CLOSED'?'done':card.stage==='done'?'ready':card.stage}:{}),
    };
  });
  for(const issue of byNumber.values()){
    if(consumed.has(issue.number))continue;
    // Match a uniquely titled existing unlinked card where possible.
    const matches=board.filter(c=>!c.issueNumber&&c.title.trim().toLowerCase()===issue.title.trim().toLowerCase());
    if(matches.length===1){
      Object.assign(matches[0],metadata(issue));
      continue;
    }
    board.push({id:'github-issue-'+issue.number,title:issue.title.slice(0,120),
      detail:(issue.body||'See GitHub issue for details.').slice(0,2000),points:3,
      stage:issue.state==='CLOSED'?'done':'backlog',...metadata(issue)});
  }
  if(board.length>250)throw new Error('Board limit exceeded; no changes made.');
  return board;
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]){
  const [file,mode,jsonFile]=process.argv.slice(2);
  if(!file||!file.endsWith('/stories.json')||!['--preview','--apply'].includes(mode)){
    console.error('Usage: node sync-issues.mjs /path/to/stories.json --preview|--apply [issues.json]');
    process.exit(1);
  }
  const previous=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):[];
  const issues=JSON.parse(jsonFile?readFileSync(jsonFile,'utf8'):execFileSync('gh',[
    'issue','list','-R',repository,'--state','all','--limit','1000','--json','number,title,state,body,assignees,labels'
  ],{encoding:'utf8',maxBuffer:16*1024*1024}));
  const board=mergeIssues(previous,issues);
  console.log('Fetched '+issues.length+' issues; linked '+board.filter(s=>s.issueNumber).length+' cards.');
  console.log('Total cards: '+board.length+'; new cards: '+(board.length-previous.length));
  if(mode==='--apply')writeFileSync(file,JSON.stringify(board,null,2)+'\n');
}
