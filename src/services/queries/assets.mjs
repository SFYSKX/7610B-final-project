import {Contract} from 'ethers';
import {ABIS} from '../../lib/abis.mjs';
export async function readAssets(s,{options:o}) {
  const inventory=[],collections=[];
  for(const col of s.config.collections||[]) {
    const nft=new Contract(col.address,ABIS.DemoNFT,s.provider);
    // A market's unavailable permission badge must not prevent NFT inspection.
    const permissions=await Promise.allSettled([
      s.contracts.Marketplace.allowedCollections(col.address,o),
      s.contracts.AuctionHouse.allowedCollections(col.address,o)
    ]);
    const value=result=>result.status==='fulfilled'?result.value:null;
    collections.push({...col,marketAllowed:value(permissions[0]),auctionAllowed:value(permissions[1])});
    let count=0;
    try{count=Number(await nft.nextTokenId(o));}catch(e){
      // External ERC-721s may not enumerate tokens; explicit IDs remain supported.
      if(e.code!=='CALL_EXCEPTION'&&e.code!=='BAD_DATA')throw e;
    }
    const tokens=await Promise.all(Array.from({length:Math.min(count,60)},(_,i)=>count-i).map(async id=>{
      try{return {collection:col.address,tokenId:id,owner:await nft.ownerOf(id,o),name:col.name};}
      catch(e){if(e.code==='CALL_EXCEPTION')return null;throw e;} // Burned IDs are allowed; network failures are not empty inventory.
    }));
    inventory.push(...tokens.filter(Boolean));
  }
  return {inventory,collections};
}
