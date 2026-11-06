import {Contract} from 'ethers';
import {ABIS} from '../../lib/abis.mjs';
import {same} from '../../lib/format.mjs';

// Issuance belongs to the NFT owner, independently of platform Safe membership.
export async function readMinting(s,{options:o}){
 const mintable=[];
 for(const collection of s.config.collections||[]){
  const nft=new Contract(collection.address,ABIS.DemoNFT,s.provider);
  let owner,nextTokenId;
  try{
   owner=await nft.owner(o);
   if(!same(owner,s.account))continue;
   nextTokenId=await nft.nextTokenId(o);
  }catch(error){
   if(error.code==='CALL_EXCEPTION'||error.code==='BAD_DATA')continue;
   throw error;
  }
  let limit=1;
  try{limit=Number(await nft.MINT_BATCH_LIMIT(o));}catch(error){
   if(error.code!=='CALL_EXCEPTION'&&error.code!=='BAD_DATA')throw error;
  }
  mintable.push({...collection,owner,nextTokenId,limit:Math.min(Math.max(limit,1),10)});
 }
 return {mintable,isIssuer:mintable.length>0};
}
