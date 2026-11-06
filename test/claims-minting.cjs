const assert=require('node:assert/strict');
const hre=require('hardhat');
const {ethers,network}=hre;
const {deploy,councilCall}=require('../scripts/common.cjs');

describe('User appeals and browser NFT issuance',function(){
 let s,c,r,n,snap;const E=ethers.parseEther,H=ethers.id;
 const now=async()=>(await ethers.provider.getBlock('latest')).timestamp;
 const admin=(method,args)=>councilCall(hre,c,r,method,args);
 const submit=(who=4,incident=1,amount='.2',statement='Order 1: simulated loss; evidence reference')=>r.connect(s[who]).submitClaim(incident,H('order-1'),E(amount),statement,H('evidence'));
 before(async()=>{
  s=await ethers.getSigners();c=await deploy(hre,'LocalCouncil',[s.slice(0,3).map(x=>x.address)]);
  r=await deploy(hre,'RiskReserve',[c.target]);n=await deploy(hre,'DemoNFT');
  await r.deposit({value:E('1')});await admin('openIncident',[H('policy'),E('.6'),await now()+100,await now()+200]);
 });
 beforeEach(async()=>{snap=await network.provider.send('evm_snapshot');});
 afterEach(async()=>{await network.provider.send('evm_revert',[snap]);});

 it('ordinary users submit without administrator registration and retain readable evidence',async()=>{
  const receipt=await(await submit()).wait(),claim=await r.getClaim(1);
  assert.equal(await r.API_VERSION(),3n);assert.equal(r.interface.getFunction('registerEntitlement'),null);
  assert.equal(claim.state,2n);assert.equal(claim.beneficiary,s[4].address);assert.equal(claim.maxLoss,E('.2'));
  assert.equal(claim.statement,'Order 1: simulated loss; evidence reference');assert.equal(await r.claimOf(1,s[4].address),1n);
  assert.equal(await r.totalIncidentReserved(),E('.6'));assert.equal(await r.available(),E('.4'));
  const event=receipt.logs.map(l=>{try{return r.interface.parseLog(l);}catch{return null;}}).find(l=>l?.name==='ClaimSubmitted');
  assert.equal(event.args.beneficiary,s[4].address);assert.equal(event.args.incidentId,1n);
 });
 it('all administrator signers and the management contract are unable to submit appeals',async()=>{
  for(const i of [0,1,2])await assert.rejects(submit(i),/Administrators cannot submit claims/);
  await assert.rejects(admin('submitClaim',[1,H('admin'),E('.1'),'Admin cannot file',H('proof')]),/Administrators cannot submit claims/);
  assert.equal(await r.claimCount(),0n);
 });
 it('duplicates are scoped to incident and applicant; another user cannot front-run someone else out of a claim',async()=>{
  await submit(4);await assert.rejects(submit(4),/Already submitted/);await submit(5);
  assert.equal((await r.getClaim(2)).beneficiary,s[5].address);
  await admin('openIncident',[H('policy-2'),E('.3'),await now()+100,await now()+200]);await submit(4,2);
  assert.equal(await r.claimOf(2,s[4].address),3n);
 });
 it('nonexistent, expired and closed incidents cannot accept submissions',async()=>{
  await assert.rejects(submit(4,0),/Submission closed/);await assert.rejects(submit(4,99),/Submission closed/);
  await network.provider.send('evm_increaseTime',[101]);await network.provider.send('evm_mine');
  await assert.rejects(submit(),/Submission closed/);
  await network.provider.send('evm_increaseTime',[101]);await network.provider.send('evm_mine');await r.closeIncident(1);
  await assert.rejects(submit(),/Submission closed/);
 });
 it('rejects zero or excessive amounts, missing evidence and oversized UTF-8 text without recording a claim',async()=>{
  for(const value of [0n,E('.7')])await assert.rejects(r.connect(s[4]).submitClaim(1,H('k'),value,'Reason',H('e')),/Invalid claim amount/);
  for(const [key,text,evidence]of [[ethers.ZeroHash,'Reason',H('e')],[H('k'),'',H('e')],[H('k'),'Reason',ethers.ZeroHash],[H('k'),'中'.repeat(342),H('e')]]){
   await assert.rejects(r.connect(s[4]).submitClaim(1,key,E('.1'),text,evidence),/Invalid claim evidence/);
  }
  assert.equal(await r.claimCount(),0n);assert.equal(await r.claimOf(1,s[4].address),0n);
 });
 it('only multisig reviews; approval is capped by requested amount and aggregate incident budget',async()=>{
  await submit(4,1,'.4');await submit(5,1,'.4');
  await assert.rejects(r.connect(s[4]).approveClaim(1,E('.1')),/OwnableUnauthorized/);
  await assert.rejects(admin('approveClaim',[1,E('.5')]),/Over budget/);
  await admin('approveClaim',[1,E('.4')]);await assert.rejects(admin('approveClaim',[2,E('.3')]),/Over budget/);
  await admin('approveClaim',[2,E('.2')]);assert.equal((await r.getIncident(1)).approved,E('.6'));
 });
 it('approved payout remains available during pause and closure and cannot be redirected by another user or paid twice',async()=>{
  await submit();await admin('approveClaim',[1,E('.15')]);await admin('setPaused',[true]);
  await assert.rejects(submit(5),/New business paused/);
  await network.provider.send('evm_increaseTime',[201]);await network.provider.send('evm_mine');await r.closeIncident(1);
  await assert.rejects(r.connect(s[5]).claimPayout(1,s[5].address),/No entitlement/);
  await r.connect(s[4]).claimPayout(1,s[4].address);assert.equal((await r.getClaim(1)).state,5n);
  assert.equal(await r.totalIncidentReserved(),0n);await assert.rejects(r.connect(s[4]).claimPayout(1,s[4].address),/No entitlement/);
 });
 it('rejection preserves reason and prevents payout, review repetition and resubmission',async()=>{
  await submit();await admin('rejectClaim',[1,H('not covered')]);assert.equal((await r.getClaim(1)).reasonHash,H('not covered'));
  await assert.rejects(admin('approveClaim',[1,E('.1')]),/Review closed/);
  await assert.rejects(r.connect(s[4]).claimPayout(1,s[4].address),/No entitlement/);
  await assert.rejects(submit(),/Already submitted/);
 });
 it('late review is refused; failed recipient payment preserves approved entitlement',async()=>{
  await submit();await admin('approveClaim',[1,E('.1')]);const reject=await deploy(hre,'Adversary');await reject.configure(true,ethers.ZeroAddress,'0x');
  await assert.rejects(r.connect(s[4]).claimPayout(1,reject.target),/Payment failed/);assert.equal((await r.getClaim(1)).state,3n);
  await submit(5);await network.provider.send('evm_increaseTime',[201]);await network.provider.send('evm_mine');
  await assert.rejects(admin('rejectClaim',[2,H('late')]),/Review closed/);
 });
 it('the NFT issuer mints an atomic batch with correct owners, URIs, IDs and events',async()=>{
  const receipt=await(await n.mintBatch(s[3].address,3,'data:application/json,{}')).wait();
  assert.equal(await n.nextTokenId(),3n);assert.equal(await n.MINT_BATCH_LIMIT(),10n);
  for(let i=1;i<=3;i++){assert.equal(await n.ownerOf(i),s[3].address);assert.equal(await n.tokenURI(i),'data:application/json,{}');}
  const minted=receipt.logs.map(l=>{try{return n.interface.parseLog(l);}catch{return null;}}).filter(l=>l?.name==='DemoMinted');assert.equal(minted.length,3);
 });
 it('custom mint metadata survives single and batch minting and loads through NFTDetails parsing',async()=>{
  const {createMintMetadata}=await import('../src/services/mintMetadata.mjs');
  const {loadMetadata}=await import('../src/services/nftMetadata.mjs');
  const draft={name:'校园艺术 🌿',description:'第一行\n第二行',image:'ipfs://bafyexample/art.png'};
  const {uri}=createMintMetadata(draft);
  await n.mint(s[3].address,uri);await n.mintBatch(s[3].address,2,uri);
  for(const token of [1,2,3]){
   assert.equal(await n.tokenURI(token),uri);assert.equal(await n.ownerOf(token),s[3].address);
   const detail=await loadMetadata({readURI:()=>n.tokenURI(token)});
   assert.equal(detail.name,draft.name);assert.equal(detail.description,draft.description);
   assert.equal(detail.image,'https://ipfs.io/ipfs/bafyexample/art.png');
   assert.deepEqual(detail.attributes,[]);
  }
 });
 it('platform administrator status and NFT ownership do not substitute for issuer permission',async()=>{
  for(const i of [1,2,3,4])await assert.rejects(n.connect(s[i]).mintBatch(s[i].address,1,'test'),/OwnableUnauthorized/);
  await n.transferOwnership(s[4].address);await assert.rejects(n.mint(s[3].address,'test'),/OwnableUnauthorized/);
  await n.connect(s[4]).mintBatch(s[3].address,2,'test');assert.equal(await n.balanceOf(s[3].address),2n);
 });
 it('rejects empty/oversized batches and invalid recipient/metadata without consuming IDs',async()=>{
  for(const count of [0,11])await assert.rejects(n.mintBatch(s[3].address,count,'test'),/Invalid mint count/);
  await assert.rejects(n.mintBatch(ethers.ZeroAddress,2,'test'),/Invalid asset/);
  await assert.rejects(n.mintBatch(s[3].address,2,'x'.repeat(4097)),/Invalid asset/);assert.equal(await n.nextTokenId(),0n);
 });
 it('a receiver rejecting the second NFT rolls back the first NFT, IDs and callback state',async()=>{
  const receiver=await deploy(hre,'RejectSecondNFT');
  await assert.rejects(n.mintBatch(receiver.target,3,'test'),/Second NFT rejected/);
  assert.equal(await n.nextTokenId(),0n);assert.equal(await n.balanceOf(receiver.target),0n);assert.equal(await receiver.received(),0n);
 });
 it('single mint stays compatible and the maximum batch succeeds',async()=>{
  await n.mint(s[3].address,'single');await n.mintBatch(s[4].address,10,'batch');
  assert.equal(await n.nextTokenId(),11n);assert.equal(await n.balanceOf(s[4].address),10n);
 });
 it('receiver callbacks cannot interleave extra mints with the batch',async()=>{
  const owner=await deploy(hre,'ReentrantMintOwner',[n.target]);
  await n.transferOwnership(owner.target);
  await owner.issueBatch();
  assert.equal(await owner.attempted(),true);
  assert.equal(await owner.nestedMintSucceeded(),false);
  assert.equal(await n.nextTokenId(),2n);
  assert.equal(await n.balanceOf(owner.target),2n);
 });
});
