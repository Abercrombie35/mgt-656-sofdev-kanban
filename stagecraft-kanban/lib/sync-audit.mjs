import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {seed} from './seed.mjs';
const [file, flag]=process.argv.slice(2);
if(!file || !file.endsWith('/stories.json') || !['--preview','--apply'].includes(flag)){
  console.error('Usage: node sync-audit.mjs /path/to/stories.json --preview|--apply');
  process.exit(1);
}
const previous=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):[];
if(!Array.isArray(previous)||new Set(previous.map(s=>s.id)).size!==previous.length)throw new Error('Invalid existing board. No changes made.');
const known=new Map(seed.map(s=>[s.id,s]));
const byId=new Map(previous.map(s=>[s.id,s]));
const merged=seed.map(s=>{
  const old=byId.get(s.id);
  if(!old)return s;
  // Preserve estimates, add audit evidence, and respect work marked in progress.
  // Verified completed status takes precedence. Unverified Done is flagged for review.
  const stage=s.stage==='done'?'done':old.stage==='building'?'building':s.stage;
  const detail=old.detail?.startsWith(s.detail)?old.detail:
    s.detail+(old.detail?'\nPrevious board note: '+old.detail:'');
  return {...old,...s,points:old.points,stage,detail:detail.slice(0,2000)};
});
const custom=previous.filter(s=>!known.has(s.id));
const result=[...merged,...custom];
console.log('Audited cards:',merged.length,'; custom cards preserved:',custom.length);
for(const stage of ['backlog','ready','building','done'])console.log(stage+': '+result.filter(s=>s.stage===stage).length);
for(const item of merged){
  const old=byId.get(item.id);
  if(!old||old.stage!==item.stage)console.log((old?.stage||'NEW')+' -> '+item.stage+': '+item.title);
}
if(flag==='--apply'){writeFileSync(file,JSON.stringify(result,null,2)+'\n');console.log('Updated '+file);}
