import {ZeroAddress} from 'ethers';
import {address,tokenId} from './control.mjs';

export const APPROVAL_TARGETS={Marketplace:'交易市场 Marketplace',AuctionHouse:'拍卖市场 AuctionHouse'};
const same=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase();

export function approvalTarget(kind,contracts){
 if(!Object.hasOwn(APPROVAL_TARGETS,kind))throw Error('请选择交易市场或拍卖市场');
 return address(contracts[kind]);
}

export function approvalRights(approved,marketAll,auctionAll,contracts){
 return {
  marketSingle:same(approved,contracts.Marketplace),auctionSingle:same(approved,contracts.AuctionHouse),
  marketAll,auctionAll,
  market:marketAll||same(approved,contracts.Marketplace),auction:auctionAll||same(approved,contracts.AuctionHouse),
  singleLabel:same(approved,ZeroAddress)?'未设置单件授权':same(approved,contracts.Marketplace)?APPROVAL_TARGETS.Marketplace:same(approved,contracts.AuctionHouse)?APPROVAL_TARGETS.AuctionHouse:'其他合约或地址'
 };
}

/** Build the exact ERC-721 writes needed to revoke only this platform's rights.
 * Token approval is per NFT; operator approval applies to every NFT in the collection.
 * A third-party token approval is deliberately never cleared by these actions.
 */
export function approvalRevocationActions(snapshot,contracts,id){
 const token=tokenId(id),actions=[];
 if(snapshot.marketSingle)actions.push({target:'Marketplace',scope:'single',label:'取消交易市场单件授权',method:'approve',args:[ZeroAddress,token]});
 if(snapshot.auctionSingle)actions.push({target:'AuctionHouse',scope:'single',label:'取消拍卖市场单件授权',method:'approve',args:[ZeroAddress,token]});
 if(snapshot.marketAll)actions.push({target:'Marketplace',scope:'all',label:'取消交易市场全部 NFT 授权',method:'setApprovalForAll',args:[approvalTarget('Marketplace',contracts),false]});
 if(snapshot.auctionAll)actions.push({target:'AuctionHouse',scope:'all',label:'取消拍卖市场全部 NFT 授权',method:'setApprovalForAll',args:[approvalTarget('AuctionHouse',contracts),false]});
 return actions;
}

export async function readNFTApproval(nft,id,contracts,block){
 const o={blockTag:block},owner=await nft.ownerOf(tokenId(id),o);
 const [approved,marketAll,auctionAll]=await Promise.all([
  nft.getApproved(tokenId(id),o),nft.isApprovedForAll(owner,contracts.Marketplace,o),nft.isApprovedForAll(owner,contracts.AuctionHouse,o)
 ]);
 return {owner,approved,...approvalRights(approved,marketAll,auctionAll,contracts),block};
}
