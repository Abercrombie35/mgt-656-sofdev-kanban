import {createHmac,timingSafeEqual} from 'node:crypto';
export function verifyWebhook(body,header,secret){
  if(typeof secret!=='string'||secret.length<32||typeof header!=='string'||!/^sha256=[a-f0-9]{64}$/i.test(header))return false;
  const expected='sha256='+createHmac('sha256',secret).update(body).digest('hex');
  return timingSafeEqual(Buffer.from(header.toLowerCase()),Buffer.from(expected));
}
export function isSourceIssueEvent(event,payload){
  return event==='issues'&&payload?.repository?.full_name?.toLowerCase()==='tkg9/656final-daunting-horizon'&&
    ['opened','edited','closed','reopened','assigned','unassigned','labeled','unlabeled','deleted','transferred'].includes(payload.action);
}
