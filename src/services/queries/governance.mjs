import {Contract} from 'ethers';
import {same} from '../../lib/format.mjs';
import {recent} from './records.mjs';

// Match AdminAccess: the owner itself, local council signers, or Sepolia Safe owners.
// This read does not depend on Marketplace availability. Failure is handled closed.
export async function readIdentity(s,{options:o}) {
  const c=s.contracts.LocalCouncil;
  const isCouncilSigner=c?await c.isSigner(s.account,o):false;
  if(same(s.account,s.config.admin))return {isAdmin:true,isCouncilSigner};
  if(c)return {isAdmin:isCouncilSigner,isCouncilSigner};
  const owner=new Contract(s.config.admin,[
    'function isSigner(address) view returns (bool)',
    'function isOwner(address) view returns (bool)'
  ],s.provider);
  const method=s.chainId===31337?'isSigner':'isOwner';
  return {isAdmin:await owner[method](s.account,o),isCouncilSigner:false};
}
export async function readGovernance(s,{options:o}) {
  const c=s.contracts.LocalCouncil;
  if(!c)return {proposals:[],approvals:{}};
  const proposals=await recent(await c.proposalCount(o),id=>c.getProposal(id,o),20);
  const entries=await Promise.all(proposals.map(async p=>[p.id,await c.approved(p.id,s.account,o)]));
  return {proposals,approvals:Object.fromEntries(entries)};
}
export async function readFees(s,{options:o}) {
  const {Marketplace:m,AuctionHouse:a,FeeRouter:f}=s.contracts;
  const [mp,ap,tr,rr,binding]=await Promise.all([
    m.pendingFees(o),a.pendingFees(o),f.treasuryCredit(o),f.reserveCredit(o),f.reserve(o)
  ]);
  return {mp,ap,tr,rr,binding};
}
