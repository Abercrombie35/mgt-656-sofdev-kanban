import test from 'node:test';
import assert from 'node:assert/strict';
import { seed } from './seed.mjs';
import { applyChange } from './model.mjs';
test('seed has unique identifiers and valid points',()=>{
  assert.equal(new Set(seed.map(s=>s.id)).size,seed.length);
  assert.equal(seed.filter(s=>s.stage==='done').length,12);
});
test('move, edit and add without mutating original',()=>{
  const moved=applyChange(seed,{type:'move',id:'google',stage:'done'});
  assert.equal(moved.find(s=>s.id==='google').stage,'done');
  assert.equal(seed.find(s=>s.id==='google').stage,'ready');
  const edited=applyChange(moved,{type:'edit',id:'google',card:{title:'New title',detail:'Verified',points:2,stage:'done'}});
  assert.equal(edited.find(s=>s.id==='google').points,2);
  const added=applyChange(edited,{type:'add',card:{title:'New',detail:'',points:1,stage:'ready'}},'new');
  assert.equal(added.length,seed.length+1);
});
test('invalid card and stage rejected',()=>{
  assert.throws(()=>applyChange(seed,{type:'move',id:'google',stage:'bad'}));
  assert.throws(()=>applyChange(seed,{type:'edit',id:'google',card:{title:'',detail:'',points:1,stage:'done'}}));
  assert.throws(()=>applyChange(seed,{type:'move',id:'missing',stage:'done'}));
});
test('author is set by server and cannot be changed via card edit',()=>{
  const author={name:'Real Name',login:'example',createdAt:'2026-11-27T00:00:00Z'};
  const card={title:'Task',detail:'Details',points:3,stage:'ready',createdByName:'Spoof'};
  const added=applyChange([],{type:'add',card},'new',author);
  assert.equal(added[0].createdByName,'Real Name');
  const edited=applyChange(added,{type:'edit',id:'new',card:{...card,title:'Updated'}});
  assert.equal(edited[0].createdByName,'Real Name');
  assert.equal(edited[0].createdByLogin,'example');
});
test('WIP is a valid stage for adding, editing and moving cards',()=>{
  const card={title:'First task',detail:'Details',points:3,stage:'wip'};
  const added=applyChange([],{type:'add',card},'w');
  assert.equal(added[0].stage,'wip');
  const moved=applyChange(added,{type:'move',id:'w',stage:'ready'});
  assert.equal(moved[0].stage,'ready');
  assert.equal(applyChange(moved,{type:'edit',id:'w',card})[0].stage,'wip');
});
