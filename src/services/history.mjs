import {Contract} from 'ethers';
import {ABIS} from '../lib/abis.mjs';
import {same,eth} from '../lib/format.mjs';
import {address,uniqueLogs} from '../lib/control.mjs';
async function logs(provider,filter,from,to){let step=1000;const all=[];for(let start=from;start<=to;){let end=Math.min(to,start+step-1);try{all.push(...await provider.getLogs({...filter,fromBlock:start,toBlock:end}));start=end+1;}catch(e){if(step<=25)throw e;step=Math.max(25,Math.floor(step/2));}}return all;}
export async function history(s,collection,tokenId,end,isAdmin=false){
 const nft=new Contract(address(collection),ABIS.DemoNFT,s.provider),latest=await s.provider.getBlockNumber();const to=end??latest;
 const known=s.config.collections.find(c=>same(c.address,collection));const start=Math.max(known?.deploymentBlock??0,to-1999);if(to<start)return {rows:[],next:null,from:start,to};
 const filter=await nft.filters.Transfer(null,null,tokenId).getTopicFilter();const transfers=await logs(s.provider,{address:collection,topics:filter},start,to);
 const rows=[];const blockTimes=new Map();async function time(n){if(!blockTimes.has(n))blockTimes.set(n,(await s.provider.getBlock(n))?.timestamp);return blockTimes.get(n);}
 const escrow=[s.config.contracts.Marketplace,s.config.contracts.AuctionHouse];
 for(const l of uniqueLogs(transfers)){const v=nft.interface.parseLog(l).args;const kind=Number(BigInt(v.from))===0?'铸造':Number(BigInt(v.to))===0?'销毁':escrow.some(x=>same(x,v.to))?'进入托管':escrow.some(x=>same(x,v.from))?'托管交付 / 退回':'转移（不代表买卖）';rows.push({key:l.transactionHash+':'+l.index,block:l.blockNumber,index:l.index,time:await time(l.blockNumber),kind,from:v.from,to:v.to,price:'',hash:l.transactionHash});}
 const m=s.contracts.Marketplace;const sales=await logs(s.provider,{address:m.target,topics:await m.filters.SaleCompleted().getTopicFilter()},start,to);
 for(const l of sales){const v=m.interface.parseLog(l).args;if(same(v.collection,collection)&&v.tokenId===BigInt(tokenId))rows.push({key:l.transactionHash+':'+l.index,block:l.blockNumber,index:l.index,time:await time(l.blockNumber),kind:'定价成交',from:v.seller,to:v.buyer,price:eth(v.grossPrice),hash:l.transactionHash});}
 const a=s.contracts.AuctionHouse;for(const l of await logs(s.provider,{address:a.target,topics:await a.filters.AuctionSettled().getTopicFilter()},start,to)){const v=a.interface.parseLog(l).args;const item=await a.getAuction(v.id,{blockTag:l.blockNumber});if(same(item.collection,collection)&&item.tokenId===BigInt(tokenId)&&v.price>0n)rows.push({key:l.transactionHash+':'+l.index,block:l.blockNumber,index:l.index,time:await time(l.blockNumber),kind:'拍卖成交（交付另记）',from:v.seller,to:v.winner,price:eth(v.price),hash:l.transactionHash});}
 return {rows:rows.filter(r=>isAdmin||same(r.from,s.account)||same(r.to,s.account)).sort((a,b)=>b.block-a.block||b.index-a.index),next:start>(known?.deploymentBlock??0)?start-1:null,from:start,to,latest};
}
