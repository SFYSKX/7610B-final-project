import test from 'node:test';
import assert from 'node:assert/strict';
import {ZeroAddress} from 'ethers';
import {approvalTarget,approvalRights,approvalRevocationActions,readNFTApproval} from '../src/lib/approval.mjs';
const market='0x0000000000000000000000000000000000000011',auction='0x0000000000000000000000000000000000000022',owner='0x0000000000000000000000000000000000000033';
const config={Marketplace:market,AuctionHouse:auction};
test('named approval targets map only to the two configured platform contracts',()=>{assert.equal(approvalTarget('Marketplace',config),market);assert.equal(approvalTarget('AuctionHouse',config),auction);for(const value of ['other',market,'constructor'])assert.throws(()=>approvalTarget(value,config));});
test('single Marketplace approval does not imply AuctionHouse approval',()=>{const r=approvalRights(market,false,false,config);assert.equal(r.market,true);assert.equal(r.auction,false);assert.equal(r.singleLabel,'交易市场 Marketplace');});
test('single AuctionHouse approval replaces the single market permission',()=>{const r=approvalRights(auction,false,false,config);assert.equal(r.market,false);assert.equal(r.auction,true);assert.equal(r.singleLabel,'拍卖市场 AuctionHouse');});
test('operator approvals can authorize both markets and survive changing single approval',()=>{const r=approvalRights(auction,true,false,config);assert.equal(r.market,true);assert.equal(r.marketAll,true);assert.equal(r.auction,true);assert.equal(approvalRights(ZeroAddress,true,true,config).auction,true);});
test('zero and third-party approvals are not mislabelled as platform permission',()=>{for(const approved of [ZeroAddress,owner]){const r=approvalRights(approved,false,false,config);assert.equal(r.market,false);assert.equal(r.auction,false);}assert.equal(approvalRights(owner,false,false,config).singleLabel,'其他合约或地址');});
test('authorization reads use one block, support token zero and query operators for the current NFT owner',async()=>{
 const calls=[];
 const nft={ownerOf:async(id,o)=>{calls.push(['owner',id,o]);return owner;},getApproved:async(id,o)=>{calls.push(['single',id,o]);return auction;},isApprovedForAll:async(who,target,o)=>{calls.push(['operator',who,target,o]);return target===market;}};
 const r=await readNFTApproval(nft,'0',config,42);assert.equal(r.owner,owner);assert.equal(r.market,true);assert.equal(r.auction,true);assert.equal(r.block,42);
 assert.deepEqual(calls,[['owner',0n,{blockTag:42}],['single',0n,{blockTag:42}],['operator',owner,market,{blockTag:42}],['operator',owner,auction,{blockTag:42}]]);
});
test('RPC authorization failures remain errors rather than false not-authorized results',async()=>{await assert.rejects(readNFTApproval({ownerOf:async()=>owner,getApproved:async()=>{throw Error('RPC unavailable');},isApprovedForAll:async()=>false},1,config,4),/RPC unavailable/);});


test('revocation plan clears token approvals and collection-wide operators independently',()=>{
 const both={marketSingle:true,auctionSingle:false,marketAll:true,auctionAll:true};
 const actions=approvalRevocationActions(both,config,'0');
 assert.deepEqual(actions.map(({target,scope,method,args})=>({target,scope,method,args})),[
  {target:'Marketplace',scope:'single',method:'approve',args:[ZeroAddress,0n]},
  {target:'Marketplace',scope:'all',method:'setApprovalForAll',args:[market,false]},
  {target:'AuctionHouse',scope:'all',method:'setApprovalForAll',args:[auction,false]}
 ]);
 assert.deepEqual(approvalRevocationActions({marketSingle:false,auctionSingle:true,marketAll:false,auctionAll:false},config,9).map(a=>[a.target,a.method,a.args]),[['AuctionHouse','approve',[ZeroAddress,9n]]]);
});
test('revocation plan does not touch a third-party single approval or already-revoked targets',()=>{
 assert.deepEqual(approvalRevocationActions({marketSingle:false,auctionSingle:false,marketAll:false,auctionAll:false,approved:owner},config,1),[]);
 assert.deepEqual(approvalRevocationActions({marketSingle:false,auctionSingle:false,marketAll:true,auctionAll:false},config,1).map(a=>[a.target,a.method]),[['Marketplace','setApprovalForAll']]);
});
