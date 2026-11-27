import test from 'node:test';
import assert from 'node:assert/strict';
import {seed} from './seed.mjs';
import {queueIssue,desiredIssueState,reconcileIssues,managedBody,matchingIssue} from './live-issues.mjs';
import {mergeIssues} from './sync-issues.mjs';
const fixture=[7,8,9,10,11,12,13,14,15,16,17,18,19].map(number=>({
  number,title:'Issue '+number,body:'Original requirements',
  state:[8,10,17,18,19].includes(number)?'CLOSED':'OPEN',assignees:[],labels:[]
}));
test('add queues managed issue; retry finds same marker rather than duplicate',()=>{
  const card={id:'new-card',title:'Feature',detail:'Story',points:3,stage:'ready',createdByName:'Person'};
  const [queued]=queueIssue([], [card],{type:'add'},card.id,'person');
  assert.equal(queued.issuePending.create,true);
  assert.equal(queued.issuePending.actor,'person');
  const issue={number:23,title:'Feature',body:managedBody(queued),state:'OPEN',assignees:[],labels:[]};
  assert.equal(matchingIssue(queued,[issue]).number,23);
  const merged=reconcileIssues([queued],[...fixture,issue]);
  assert.equal(merged.filter(s=>s.issueNumber===23).length,1);
  assert.equal(merged.find(s=>s.id==='new-card').issuePending.create,true);
});
test('split story closes only after all linked cards are done',()=>{
  const cards=mergeIssues(seed,fixture);
  const invite=cards.find(c=>c.id==='invites');
  assert.equal(desiredIssueState(cards,invite),'open');
  const next=cards.map(c=>c.id==='invites'?{...c,stage:'done'}:c);
  assert.equal(desiredIssueState(next,next.find(c=>c.id==='invites')),'closed');
  const queued=queueIssue(cards,next,{type:'move',id:'invites'},null,'person');
  assert.equal(queued.find(c=>c.id==='invites').issuePending.state,true);
});
test('GitHub closing and reopening updates lane without reopening completed split work',()=>{
  const cards=mergeIssues(seed,fixture);
  const closed=reconcileIssues(cards,fixture.map(i=>i.number===7?{...i,state:'CLOSED'}:i));
  assert.equal(closed.find(c=>c.id==='invites').stage,'done');
  const reopened=reconcileIssues(closed,fixture);
  assert.equal(reopened.find(c=>c.id==='invites').stage,'ready');
  assert.equal(reopened.find(c=>c.id==='production').stage,'done');
});
test('legacy issue requirements are not overwritten by board card edits',()=>{
  const cards=mergeIssues(seed,fixture), next=cards.map(c=>c.id==='invites'?{...c,detail:'My local note'}:c);
  assert.equal(queueIssue(cards,next,{type:'edit',id:'invites'},null,'person').find(c=>c.id==='invites').issuePending,undefined);
});
