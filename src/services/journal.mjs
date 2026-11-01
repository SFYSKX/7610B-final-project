import {same} from '../lib/format.mjs';
export const JOURNAL_KEY='ledger-diagnostics-v1';
export function appendJournal(previous,s,entry,at=new Date().toISOString()) {
  return [{at,account:s?.account,chainId:s?.chainId,admin:s?.config.admin,
    deploymentIdentity:s?.config.deploymentIdentity,...entry},...previous].slice(0,100);
}
export function selectJournal(journal,s,isAdmin) {
  if(!s)return [];
  return journal.filter(v=>v.chainId===s.chainId&&v.deploymentIdentity===s.config.deploymentIdentity
    &&same(v.admin,s.config.admin)&&(isAdmin||same(v.account,s.account)));
}
