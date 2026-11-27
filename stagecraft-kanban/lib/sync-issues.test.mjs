import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeIssues} from './sync-issues.mjs';
const issues=[7,8,9,10,11,12,13,14,15,16,30].map(number=>({
  number,title:'Issue '+number,state:number===8||number===30?'CLOSED':'OPEN',
  body:'Description',assignees:[{login:'teammate'}],labels:[{name:'feature'}]
}));
test('links all nine stories, imports extra issues once and preserves custom cards',()=>{
  const board=mergeIssues([{id:'custom',title:'Custom task',detail:'A note',stage:'building',points:5}],issues);
  assert.equal(board.find(s=>s.id==='custom').stage,'building');
  assert.equal(board.find(s=>s.id==='invites').issueNumber,7);
  assert.equal(board.find(s=>s.id==='ai').issueNumber,10);
  assert.equal(board.find(s=>s.id==='ai-expanded').issueNumber,9);
  assert.equal(board.find(s=>s.id==='github-issue-30').stage,'done');
  assert.equal(mergeIssues(board,issues).length,board.length);
  assert.ok([7,8,9,11,12,13,14,15,16].every(n=>board.some(s=>s.issueNumber===n)));
});
test('refuses incomplete issue export',()=>assert.throws(()=>mergeIssues([],[])));
