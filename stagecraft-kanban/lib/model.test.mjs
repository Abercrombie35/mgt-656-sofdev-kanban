import test from 'node:test';
import assert from 'node:assert/strict';
import { seed } from './seed.mjs';
import { applyChange } from './model.mjs';
test('seed has unique identifiers and valid points',()=>{
  assert.equal(new Set(seed.map(s=>s.id)).size,seed.length);
  assert.equal(seed.filter(s=>s.stage==='done').reduce((n,s)=>n+s.points,0),14);
});
test('move, edit and add without mutating original',()=>{
  const moved=applyChange(seed,{type:'move',id:'google',stage:'done'});
  assert.equal(moved.find(s=>s.id==='google').stage,'done');
  assert.equal(seed.find(s=>s.id==='google').stage,'building');
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
