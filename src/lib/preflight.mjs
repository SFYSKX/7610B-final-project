import {Contract,formatEther} from 'ethers';
export async function preflight(s,contract,method,args,options={}){
 if(['createListing','createAuction'].includes(method)){
  const [collection,id]=args;
  const nft=new Contract(collection,['function ownerOf(uint256) view returns(address)','function getApproved(uint256) view returns(address)','function isApprovedForAll(address,address) view returns(bool)'],s.provider);
  const owner=await nft.ownerOf(id),target=contract.target;
  if(owner.toLowerCase()!==s.account.toLowerCase())throw Error('当前账户不是这件 NFT 的持有人。');
  if((await nft.getApproved(id)).toLowerCase()!==target.toLowerCase()&&!await nft.isApprovedForAll(owner,target))throw Error(`请先授权给${method==='createAuction'?'拍卖市场 AuctionHouse':'交易市场 Marketplace'}。请在“我的资产”中选择对应授权用途；授权给另一个市场不能用于本次操作。`);
 }
 if(method==='bid'){
  const a=await contract.getAuction(args[0]),min=a.highestBid===0n?a.reservePrice:a.highestBid+a.minIncrement;
  if(options.value<min)throw Error(`报价过低：本次至少需要 ${formatEther(min)} ETH，请填写完整出价金额。`);
 }
}
export async function previewManagement(s,target,data){
 // Simulate the actual call from the multisig, without signing or bypassing it.
 return s.provider.call({from:s.config.admin,to:target,data});
}
