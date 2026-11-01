import {ZeroAddress} from 'ethers';
import {address,tokenId} from './control.mjs';

export const APPROVAL_TARGETS={Marketplace:'交易市场 Marketplace',AuctionHouse:'拍卖市场 AuctionHouse'};
export function approvalTarget(kind,contracts){
 if(!Object.hasOwn(APPROVAL_TARGETS,kind))throw Error('请选择交易市场或拍卖市场');
 return address(contracts[kind]);
}
const same=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase();
export function approvalRights(approved,marketAll,auctionAll,contracts){
 return {
  marketSingle:same(approved,contracts.Marketplace),auctionSingle:same(approved,contracts.AuctionHouse),
  marketAll,auctionAll,
  market:marketAll||same(approved,contracts.Marketplace),auction:auctionAll||same(approved,contracts.AuctionHouse),
  singleLabel:same(approved,ZeroAddress)?'未设置单件授权':same(approved,contracts.Marketplace)?APPROVAL_TARGETS.Marketplace:same(approved,contracts.AuctionHouse)?APPROVAL_TARGETS.AuctionHouse:'其他合约或地址'
 };
}
export async function readNFTApproval(nft,id,contracts,block){
 const o={blockTag:block},owner=await nft.ownerOf(tokenId(id),o);
 const [approved,marketAll,auctionAll]=await Promise.all([
  nft.getApproved(tokenId(id),o),nft.isApprovedForAll(owner,contracts.Marketplace,o),nft.isApprovedForAll(owner,contracts.AuctionHouse,o)
 ]);
 return {owner,approved,...approvalRights(approved,marketAll,auctionAll,contracts),block};
}
