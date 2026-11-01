const assert=require('node:assert/strict');
const hre=require('hardhat');
const {ethers,network}=hre;
const {deployAssets}=require('../scripts/assets.cjs');
const {validateDeployment}=require('../scripts/validate.cjs');
const {deploy,councilCall}=require('../scripts/common.cjs');

describe('Deployment tooling regression',function(){
 let d,c,r,f,m,a,s,snapshot;
 const silent=()=>{};
 const options=()=>({persist:()=>{},env:{},log:silent});
 before(async()=>{
  s=await ethers.getSigners();c=await deploy(hre,'LocalCouncil',[s.slice(0,3).map(x=>x.address)]);
  r=await deploy(hre,'RiskReserve',[c.target]);f=await deploy(hre,'FeeRouter',[c.target,5000]);
  m=await deploy(hre,'Marketplace',[c.target,f.target]);a=await deploy(hre,'AuctionHouse',[c.target,f.target]);
 });
 beforeEach(async()=>{snapshot=await network.provider.send('evm_snapshot');d={chainId:31337,apiVersion:2,status:'complete',adminMode:'LOCAL_COUNCIL',admin:c.target,contracts:{LocalCouncil:c.target,RiskReserve:r.target,FeeRouter:f.target,Marketplace:m.target,AuctionHouse:a.target},collections:[]};});
 afterEach(async()=>{await network.provider.send('evm_revert',[snapshot]);});
 async function ready(){
  await councilCall(hre,c,a,'setSettlementKeeper',[s[9].address]);
  const address=await deployAssets(hre,d,options());
  await councilCall(hre,c,f,'setReserveOnce',[r.target]);
  await councilCall(hre,c,m,'setCollection',[address,true]);await councilCall(hre,c,a,'setCollection',[address,true]);return address;
 }
 it('isolated tests have no interval miner',()=>assert.equal(hre.config.networks.hardhat.mining.interval,0));
 it('records prepared/submitted/complete and retries do not redeploy or append twice',async()=>{
  const records=[];const o={...options(),persist:state=>records.push(structuredClone(state))};
  const address=await deployAssets(hre,d,o),nonce=await s[0].getNonce();
  assert.equal(records[0].testAssetDeployments['demo-v1'].status,'prepared');
  assert.equal(records[1].testAssetDeployments['demo-v1'].status,'submitted');
  assert.ok(records[1].testAssetDeployments['demo-v1'].hash);
  assert.equal(await deployAssets(hre,d,o),address);assert.equal(await s[0].getNonce(),nonce);assert.equal(d.collections.length,1);
 });
 it('resumes a submitted checkpoint without a second transaction',async()=>{
  const snapshots=[];const address=await deployAssets(hre,d,{...options(),persist:x=>snapshots.push(structuredClone(x))});
  const submitted=snapshots.find(x=>x.testAssetDeployments['demo-v1'].status==='submitted');
  const nonce=await s[0].getNonce();assert.equal(await deployAssets(hre,submitted,options()),address);
  assert.equal(await s[0].getNonce(),nonce);assert.equal(submitted.collections.length,1);
 });
 it('an RPC timeout after broadcast requires the original hash and never resends',async()=>{
  let originalHash;
  const uncertain={...hre,ethers:{...ethers,getContractFactory:async(...args)=>{
   const factory=await ethers.getContractFactory(...args);
   return {deploy:async(...params)=>{const contract=await factory.deploy(...params);originalHash=contract.deploymentTransaction().hash;throw Error('Simulated response lost');}};
  }}};
  await assert.rejects(deployAssets(uncertain,d,options()),/response lost/);
  assert.equal(d.testAssetDeployments['demo-v1'].status,'prepared');
  const nonce=await s[0].getNonce();await assert.rejects(deployAssets(hre,d,options()),/outcome unknown/);
  await assert.rejects(deployAssets(hre,d,{...options(),env:{NFT_DEPLOYMENT_ID:'bypass'}}),/unfinished/);
  await deployAssets(hre,d,{...options(),env:{NFT_DEPLOYMENT_TX:originalHash}});
  assert.equal(await s[0].getNonce(),nonce);assert.equal(d.collections.length,1);
 });
 it('unknown receipts stop and a mismatched recovery transaction is rejected',async()=>{
  await deployAssets(hre,d,options());const record=d.testAssetDeployments['demo-v1'];record.status='submitted';
  const absent={...hre,ethers:{...ethers,provider:new Proxy(ethers.provider,{get:(target,key)=>key==='getTransactionReceipt'?async()=>null:typeof target[key]==='function'?target[key].bind(target):target[key]})}};
  const nonce=await s[0].getNonce();await assert.rejects(deployAssets(absent,d,options()),/no receipt/);
  record.status='prepared';delete record.hash;
  const unrelated=await s[0].sendTransaction({to:s[1].address,value:0n});
  await assert.rejects(deployAssets(hre,d,{...options(),env:{NFT_DEPLOYMENT_TX:unrelated.hash}}),/does not match/);
  assert.equal(await s[0].getNonce(),nonce+1);
 });
 it('reuses legacy collections and only a new request creates a new collection',async()=>{
  const first=await deployAssets(hre,d,options());delete d.testAssetDeployments;
  const nonce=await s[0].getNonce();assert.equal(await deployAssets(hre,d,options()),first);assert.equal(await s[0].getNonce(),nonce);
  const second=await deployAssets(hre,d,{...options(),env:{NFT_DEPLOYMENT_ID:'demo-v2'}});assert.notEqual(first,second);assert.equal(d.collections.length,2);
 });
 it('strict validation fails for missing reserve binding',async()=>{
  await deployAssets(hre,d,options());await assert.rejects(validateDeployment(hre,d,silent),/Reserve binding/);
 });
 it('strict validation rejects an empty collection list',async()=>{
  await councilCall(hre,c,f,'setReserveOnce',[r.target]);await assert.rejects(validateDeployment(hre,d,silent),/No demo collections/);
 });
 it('strict validation rejects each disabled collection and passes a ready deployment',async()=>{
  const address=await ready();await validateDeployment(hre,d,silent);
  await councilCall(hre,c,m,'setCollection',[address,false]);await assert.rejects(validateDeployment(hre,d,silent),/Marketplace collection disabled/);
  await councilCall(hre,c,m,'setCollection',[address,true]);await councilCall(hre,c,a,'setCollection',[address,false]);
  await assert.rejects(validateDeployment(hre,d,silent),/AuctionHouse collection disabled/);
 });
 it('strict validation rejects a market wired to another router',async()=>{
  await ready();const other=await deploy(hre,'FeeRouter',[c.target,5000]);const wrong=await deploy(hre,'Marketplace',[c.target,other.target]);d.contracts.Marketplace=wrong.target;
  await assert.rejects(validateDeployment(hre,d,silent),/Marketplace router mismatch/);
 });
});
