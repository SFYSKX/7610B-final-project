import {recent} from './records.mjs';
import {claimRecord} from '../../lib/claims.mjs';
export async function readReserve(s,{block,options:o}) {
  const r=s.contracts.RiskReserve;
  const [ic,cc,rb,available,reserved,pausedR]=await Promise.all([
    r.incidentCount(o),r.claimCount(o),s.provider.getBalance(r.target,block.number),
    r.available(o),r.totalIncidentReserved(o),r.paused(o)
  ]);
  const [incidents,claims]=await Promise.all([
    recent(ic,id=>r.getIncident(id,o)),recent(cc,id=>r.getClaim(id,o),40,claimRecord)
  ]);
  return {incidents,claims,rb,available,reserved,pausedR,counts:{incidents:ic,claims:cc}};
}
