const test=require('node:test'),assert=require('node:assert/strict');
const ethers=require('ethers');const {validateDeployment}=require('../scripts/validate.cjs');
function fixture({threshold=2n,owners}={}){
 const address=n=>ethers.getAddress('0x'+n.toString(16).padStart(40,'0'));
 const admin=address(1),router=address(2),reserve=address(3),market=address(4),auction=address(5),nft=address(6);
 owners||=[address(10),address(11),address(12)];
 const base={API_VERSION:async()=>2n,owner:async()=>admin,paused:async()=>false};
 const contracts={Marketplace:{...base,target:market,feeRouter:async()=>router,feeBps:async()=>100n,allowedCollections:async()=>true},AuctionHouse:{settlementKeeper:async()=>owners[0],...base,target:auction,feeRouter:async()=>router,feeBps:async()=>100n,allowedCollections:async()=>true},RiskReserve:{...base,target:reserve},FeeRouter:{...base,target:router,treasury:async()=>admin,reserveShareBps:async()=>5000n,reserve:async()=>reserve}};
 const provider={getNetwork:async()=>({chainId:11155111n}),getBlockNumber:async()=>42,getCode:async()=> '0x01'};
 function Contract(target){return target===admin?{getOwners:async()=>owners,getThreshold:async()=>threshold}:{supportsInterface:async()=>true};}
 const hre={ethers:{...ethers,provider,Contract,getContractAt:async name=>contracts[name]}};
 const d={chainId:11155111,status:'complete',apiVersion:2,adminMode:'SAFE',admin,contracts:{Marketplace:market,AuctionHouse:auction,RiskReserve:reserve,FeeRouter:router},collections:[{address:nft}]};
 return {hre,d,contracts};
}
test('Sepolia validation accepts sufficient owners and reports the threshold (mock interfaces)',async()=>{const {hre,d}=fixture();const logs=[];await validateDeployment(hre,d,x=>logs.push(x));assert.ok(logs.some(x=>x==='Safe threshold: 2 / 3'));});
test('Sepolia validation rejects one signature or too few owners (mock interfaces)',async()=>{for(const opts of [{threshold:1n},{owners:[ethers.ZeroAddress]}]){const {hre,d}=fixture(opts);await assert.rejects(validateDeployment(hre,d,()=>{}),/insufficient/);}});
test('strict validation rejects wrong treasury and reserve split',async()=>{const {hre,d,contracts}=fixture();contracts.FeeRouter.treasury=async()=>ethers.ZeroAddress;await assert.rejects(validateDeployment(hre,d,()=>{}),/Treasury/);contracts.FeeRouter.treasury=async()=>d.admin;contracts.FeeRouter.reserveShareBps=async()=>100n;await assert.rejects(validateDeployment(hre,d,()=>{}),/5000/);});
test('strict validation rejects wrong network and incomplete manifests',async()=>{const {hre,d}=fixture();await assert.rejects(validateDeployment(hre,{...d,chainId:31337},()=>{}),/Manifest/);await assert.rejects(validateDeployment(hre,{...d,status:'deploying'},()=>{}),/Manifest/);});
