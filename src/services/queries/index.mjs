import {readMarket} from './market.mjs';
import {readAuction} from './auction.mjs';
import {readReserve} from './reserve.mjs';
import {readAssets} from './assets.mjs';
import {readIdentity,readGovernance,readFees} from './governance.mjs';
import {readMinting} from './minting.mjs';

/** Query interface: async (Session, {block, options:{blockTag}}) -> domain fields.
 * Independent modules must not read each other's results. No writes in queries.
 * Module state is ready/error with its confirmed block; failed values are omitted.
 */
export const queryReaders=Object.freeze({
  market:readMarket,auction:readAuction,reserve:readReserve,assets:readAssets,
  identity:readIdentity,governance:readGovernance,fees:readFees,minting:readMinting
});
export {queryLabels,isReady} from '../queryState.mjs';
export function unavailableSnapshot(s,keys=Object.keys(queryReaders)) {
  return {isAdmin:false,isIssuer:false,isCouncilSigner:false,collections:s.config.collections||[],counts:{},
    modules:Object.fromEntries(keys.map(key=>[key,{status:'error',block:null,message:'暂时无法读取链上状态，请检查节点或网络后重试。'}]))};
}
async function bounded(read,timeoutMs) {
  let timer;
  try{return await Promise.race([
    Promise.resolve().then(read),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('链上读取超时')),timeoutMs);})
  ]);}finally{clearTimeout(timer);}
}
export async function snapshot(s,{readers=queryReaders,timeoutMs=s.mode==='local'?8000:15000}={}) {
  const block=await bounded(()=>s.provider.getBlock('latest'),timeoutMs);
  if(!block)throw Error('暂时无法读取最新区块');
  const context={block,options:{blockTag:block.number}};
  const entries=Object.entries(readers);
  const results=await Promise.allSettled(entries.map(([,read])=>bounded(()=>read(s,context),timeoutMs)));
  const data={...unavailableSnapshot(s,[]),block:block.number,time:block.timestamp};
  for(let i=0;i<entries.length;i++) {
    const [key]=entries[i],result=results[i];
    if(result.status==='fulfilled') {
      const {counts={},...values}=result.value;
      Object.assign(data,values);Object.assign(data.counts,counts);
      data.modules[key]={status:'ready',block:block.number};
    }else{
      data.modules[key]={status:'error',block:null,message:'暂时无法读取此模块，请稍后重试或检查节点连接。'};
    }
  }
  return data;
}
