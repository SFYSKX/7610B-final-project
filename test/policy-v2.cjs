const assert=require('node:assert/strict');
const hre=require('hardhat');const {ethers,network}=hre;
const {deploy,councilCall}=require('../scripts/common.cjs');
const {dueAuctions}=require('../scripts/settler.cjs');
describe('v2 access, token restrictions and automated settlement',function(){
 let s,c,m,a,r,f,n,snap;const E=ethers.parseEther;
 const now=async()=>(await ethers.provider.getBlock('latest')).timestamp;
 const admin=(target,method,args=[])=>councilCall(hre,c,target,method,args);
 before(async()=>{
  s=await ethers.getSigners();c=await deploy(hre,'LocalCouncil',[s.slice(0,3).map(x=>x.address)]);
  r=await deploy(hre,'RiskReserve',[c.target]);f=await deploy(hre,'FeeRouter',[c.target,5000]);
  m=await deploy(hre,'Marketplace',[c.target,f.target]);a=await deploy(hre,'AuctionHouse',[c.target,f.target]);n=await deploy(hre,'DemoNFT');
  await admin(m,'setCollection',[n.target,true]);await admin(a,'setCollection',[n.target,true]);await admin(a,'setSettlementKeeper',[s[9].address]);await admin(f,'setReserveOnce',[r.target]);
  for(let i=0;i<3;i++)await n.mint(s[3].address,'test');await n.connect(s[3]).setApprovalForAll(m.target,true);await n.connect(s[3]).setApprovalForAll(a.target,true);
 });
 beforeEach(async()=>{snap=await network.provider.send('evm_snapshot');});
 afterEach(async()=>{await network.provider.send('evm_revert',[snap]);});
 it('ordinary users cannot collect fees, close incidents or execute approved proposals',async()=>{
  for(const [target,method,args]of [[m,'flushFees',[]],[a,'flushFees',[]],[f,'flushReserve',[]],[f,'withdrawTreasury',[]],[r,'closeIncident',[1]],[r,'deposit',[]]])await assert.rejects(target.connect(s[4])[method](...args),/AdminOnly/);
  await c.propose(m.target,m.interface.encodeFunctionData('setPaused',[true]));const id=await c.proposalCount();await c.connect(s[1]).approve(id);
  await assert.rejects(c.connect(s[4]).execute(id),/Not signer/);await c.connect(s[2]).execute(id);assert.equal(await m.paused(),true);
 });
 it('all current signers can route fixed funds but one cannot configure policy',async()=>{
  for(let i=0;i<3;i++)assert.equal(await m.isAdministrator(s[i].address),true);assert.equal(await m.isAdministrator(s[4].address),false);
  await m.connect(s[3]).createListing(n.target,1,E('1'),await now()+300);await m.connect(s[4]).buy(1,1,s[4].address,{value:E('1')});
  await m.connect(s[1]).flushFees();await f.connect(s[2]).flushReserve();await f.connect(s[1]).withdrawTreasury();assert.equal(await r.available(),E('.005'));
  await assert.rejects(m.connect(s[1]).setTokenBlocked(n.target,1,true),/OwnableUnauthorized/);
 });
 it('single NFT prohibition does not disable other tokens or trap existing custody',async()=>{
  await m.connect(s[3]).createListing(n.target,1,E('1'),await now()+300);
  await admin(m,'setTokenBlocked',[n.target,1,true]);await assert.rejects(m.connect(s[4]).buy(1,1,s[4].address,{value:E('1')}),/NFT blocked/);
  await m.connect(s[3]).cancelListing(1,s[3].address);await assert.rejects(m.connect(s[3]).createListing(n.target,1,E('1'),await now()+300),/NFT blocked/);
  await m.connect(s[3]).createListing(n.target,2,E('1'),await now()+300);assert.equal(await m.allowedCollections(n.target),true);
  await admin(m,'setTokenBlocked',[n.target,1,false]);await m.connect(s[3]).createListing(n.target,1,E('1'),await now()+300);
 });
 it('blocked auction NFT stops new bids but preserves settlement and winner delivery',async()=>{
  await a.connect(s[3]).createAuction(n.target,1,E('1'),E('.1'),await now()+100);await a.connect(s[4]).bid(1,{value:E('1')});
  await admin(a,'setTokenBlocked',[n.target,1,true]);await assert.rejects(a.connect(s[5]).bid(1,{value:E('1.1')}),/NFT blocked/);
  await a.connect(s[3]).createAuction(n.target,2,E('1'),E('.1'),await now()+100);
  await network.provider.send('evm_increaseTime',[101]);await network.provider.send('evm_mine');
  await a.connect(s[9]).settleAuction(1);await a.connect(s[4]).claimNFT(1,s[4].address);assert.equal(await n.ownerOf(1),s[4].address);
 });
 it('only configured keeper or multisig may settle, and never before the deadline or twice',async()=>{
  await a.connect(s[3]).createAuction(n.target,1,E('1'),E('.1'),await now()+100);
  await assert.rejects(a.connect(s[9]).settleAuction(1),/Not ready/);
  await network.provider.send('evm_increaseTime',[101]);await network.provider.send('evm_mine');
  for(const i of [0,3,4])await assert.rejects(a.connect(s[i]).settleAuction(1),/SettlementOnly/);
  await admin(a,'setSettlementKeeper',[s[8].address]);await assert.rejects(a.connect(s[9]).settleAuction(1),/SettlementOnly/);
  await a.connect(s[8]).settleAuction(1);await assert.rejects(a.connect(s[8]).settleAuction(1),/Not ready/);
 });
 it('due scan includes old IDs beyond the recent-40 UI and ignores cancelled/settled/future records',async()=>{
  const fake={auctionCount:async()=>105n,getAuction:async(id,o)=>{assert.equal(o.blockTag,9);return {status:id===2?2n:id===3?3n:1n,endTime:id===4?101n:100n};}};
  const ids=await dueAuctions(fake,{getBlock:async()=>({number:9,timestamp:100})});assert.equal(ids.length,102);assert.ok(ids.includes(1)&&ids.includes(105));assert.ok(!ids.includes(2)&&!ids.includes(3)&&!ids.includes(4));
 });
 it('even three approvals cannot spend unfunded budget; funding permits retry of the same proposal',async()=>{
  const data=r.interface.encodeFunctionData('openIncident',[ethers.id('policy'),E('.05'),await now()+3600,await now()+7200]);
  await c.propose(r.target,data);const id=await c.proposalCount();await c.connect(s[1]).approve(id);await c.connect(s[2]).approve(id);
  await assert.rejects(c.execute(id),/InsufficientBudget/);assert.equal((await c.getProposal(id)).executed,false);assert.equal(await r.incidentCount(),0n);
  await r.deposit({value:E('.1')});await c.execute(id);assert.equal(await r.available(),E('.05'));assert.equal(await r.totalIncidentReserved(),E('.05'));
 });
 it('policy, zero budget and insufficient funds have separate errors',async()=>{
  for(const [policy,budget,error]of [[ethers.ZeroHash,1n,/InvalidPolicy/],[ethers.id('p'),0n,/InvalidBudget/],[ethers.id('p'),1n,/InsufficientBudget/]])await assert.rejects(admin(r,'openIncident',[policy,budget,await now()+3600,await now()+7200]),error);
 });
});
