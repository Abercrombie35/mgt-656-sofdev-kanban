import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyWebhook,isSourceIssueEvent} from './webhook.mjs';
test('validates signed raw webhook body and rejects invalid secrets or altered content',()=>{
  const secret='test-webhook-secret-with-more-than-32-characters';
  const body=Buffer.from('{"action":"opened"}');
  const header='sha256='+createHmac('sha256',secret).update(body).digest('hex');
  assert.equal(verifyWebhook(body,header,secret),true);
  assert.equal(verifyWebhook(Buffer.from('{"action":"closed"}'),header,secret),false);
  assert.equal(verifyWebhook(body,null,secret),false);
  assert.equal(verifyWebhook(body,header,'short'),false);
});
test('only accepts issue events on the exact project repository',()=>{
  const payload={action:'opened',repository:{full_name:'tkg9/656Final-daunting-horizon'}};
  assert.equal(isSourceIssueEvent('issues',payload),true);
  assert.equal(isSourceIssueEvent('pull_request',payload),false);
  assert.equal(isSourceIssueEvent('issues',{...payload,repository:{full_name:'someone/other'}}),false);
});
