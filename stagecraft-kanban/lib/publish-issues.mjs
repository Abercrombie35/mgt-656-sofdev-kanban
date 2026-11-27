// Run from the user's authenticated local terminal. Never force-push.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,existsSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mergeIssues} from './sync-issues.mjs';
const project=dirname(dirname(fileURLToPath(import.meta.url)));
const source='tkg9/656Final-daunting-horizon';
const target='Abercrombie35/mgt-656-sofdev-kanban';
const command=(name,args,cwd)=>execFileSync(name,args,{cwd,encoding:'utf8',maxBuffer:16*1024*1024}).trim();
const visibility=repo=>JSON.parse(command('gh',['repo','view',repo,'--json','visibility'])).visibility;
const sourceVisibility=visibility(source),targetVisibility=visibility(target);
if(sourceVisibility!=='PUBLIC'&&targetVisibility==='PUBLIC'){
  throw new Error('The source repository is not public but the Kanban repository is public. Stop to avoid exposing issue contents.');
}
const temp=mkdtempSync(join(tmpdir(),'stagecraft-publish-'));
console.log('Working copies: '+temp);
const remote='https://github.com/'+target+'.git';
const main=join(temp,'main'),data=join(temp,'data');
command('git',['clone','--branch','main',remote,main]);
command('git',['clone','--branch','board-data',remote,data]);
const app=existsSync(join(main,'stagecraft-kanban','public','board.js'))?join(main,'stagecraft-kanban'):main;
if(!existsSync(join(app,'api','board.mjs')))throw new Error('Expected Kanban app not found. No changes pushed.');
const file=join(data,'stories.json');
if(existsSync(file)){
  const old=JSON.parse(readFileSync(file,'utf8'));
  // Apply the feature audit only if the earlier original board is still present.
  if(old.some(s=>s.id==='script'&&s.title==='Script, scenes and characters')){
    console.log(command(process.execPath,[join(project,'lib','sync-audit.mjs'),file,'--apply']));
  }
}
const previous=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):[];
const issues=JSON.parse(command('gh',['issue','list','-R',source,'--state','all','--limit','1000','--json','number,title,state,body,assignees,labels']));
const merged=mergeIssues(previous,issues).map(s=>({...s,createdByName:s.createdByName||'Default'}));
writeFileSync(file,JSON.stringify(merged,null,2)+'\n');
console.log('Retrieved '+issues.length+' issues; '+merged.filter(s=>s.issueNumber).length+' linked cards; '+merged.length+' total cards.');
const files=['public/board.js','api/board.mjs','lib/model.mjs','lib/model.test.mjs','lib/seed.mjs','lib/sync-issues.mjs','lib/sync-issues.test.mjs','lib/sync-audit.mjs','lib/publish-issues.mjs'];
for(const name of files)copyFileSync(join(project,name),join(app,name));
console.log(command('npm',['test'],app));
function commitAndPush(cwd,paths,message){
  command('git',['add','--',...paths],cwd);
  if(!command('git',['diff','--cached','--name-only'],cwd)){console.log('No changes to '+cwd);return;}
  console.log(command('git',['commit','-m',message],cwd));
  console.log(command('git',['push'],cwd));
}
commitAndPush(main,files.map(f=>app===main?f:'stagecraft-kanban/'+f),'Link StageCraft issues and attribute new stories');
commitAndPush(data,['stories.json'],'Import StageCraft issues and label existing stories Default');
console.log('Published both branches. Vercel will deploy the updated app from main.');
