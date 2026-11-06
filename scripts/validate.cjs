const {read}=require('./common.cjs');

// A single block snapshot; readiness errors must produce a nonzero exit status.
async function validateDeployment(hre,d,log=console.log){
 const {ethers}=hre,provider=ethers.provider;
 const chainId=Number((await provider.getNetwork()).chainId);
 if(![31337,11155111].includes(chainId)||d.chainId!==chainId||d.apiVersion!==2||d.status!=='complete')throw Error('Manifest chain/version/status mismatch');
 const block=await provider.getBlockNumber(),o={blockTag:block};
 const equal=(a,b)=>ethers.getAddress(a)===ethers.getAddress(b);
 const fail=(condition,message)=>{if(!condition)throw Error(message);};
 async function code(address,label){fail(await provider.getCode(address,block)!=='0x',label+': no contract code');}
 await code(d.admin,'Admin');const contracts={};
 for(const name of ['Marketplace','AuctionHouse','RiskReserve','FeeRouter']){
  const address=d.contracts?.[name];await code(address,name);
  const c=contracts[name]=await ethers.getContractAt(name,address);
  fail(await c.API_VERSION(o)===(name==='RiskReserve'?3n:2n)&&equal(await c.owner(o),d.admin),'Version/admin mismatch: '+name);
  log(name+' code/version/admin OK');
 }
 const {Marketplace:m,AuctionHouse:a,RiskReserve:r,FeeRouter:f}=contracts;
 fail(equal(await m.feeRouter(o),f.target),'Marketplace router mismatch');
 fail(equal(await a.feeRouter(o),f.target),'AuctionHouse router mismatch');
 fail(equal(await f.treasury(o),d.admin),'Treasury must be the configured admin');
 fail(await f.reserveShareBps(o)===5000n,'Reserve share must be 5000 bps');
 fail(equal(await f.reserve(o),r.target),'Reserve binding missing or incorrect');
 for(const [name,c]of [['Marketplace',m],['AuctionHouse',a]])fail(await c.feeBps(o)<=500n,name+' fee exceeds cap');
 if(chainId===11155111){
  fail(d.adminMode==='SAFE','Sepolia requires SAFE admin mode');
  const safe=new ethers.Contract(d.admin,['function getOwners() view returns(address[])','function getThreshold() view returns(uint256)'],provider);
  const owners=await safe.getOwners(o),threshold=await safe.getThreshold(o);
  fail(owners.length>=3&&threshold>=2n&&threshold<=BigInt(owners.length),'Safe owners/threshold are insufficient');
  fail(new Set(owners.map(x=>ethers.getAddress(x))).size===owners.length&&!owners.some(x=>equal(x,ethers.ZeroAddress)),'Invalid Safe owners');
  log('Safe owners: '+owners.join(', '));log('Safe threshold: '+threshold+' / '+owners.length);
 }else{
  fail(d.adminMode==='LOCAL_COUNCIL'&&equal(d.admin,d.contracts.LocalCouncil),'Local council manifest mismatch');
  const council=await ethers.getContractAt('LocalCouncil',d.admin);
  const owners=await Promise.all([0,1,2].map(i=>council.signers(i,o)));
  fail(new Set(owners.map(x=>ethers.getAddress(x))).size===3,'Invalid local council owners');
  for(const owner of owners)fail(!equal(owner,ethers.ZeroAddress)&&await council.isSigner(owner,o),'Invalid local council signer');
 }
 fail(Array.isArray(d.collections)&&d.collections.length>0,'No demo collections configured');
 for(const col of d.collections){
  await code(col.address,'Collection');
  const nft=new ethers.Contract(col.address,['function supportsInterface(bytes4) view returns(bool)'],provider);
  fail(await nft.supportsInterface('0x80ac58cd',o),'Collection is not ERC721: '+col.address);
  for(const [name,c]of [['Marketplace',m],['AuctionHouse',a]]){
   fail(await c.allowedCollections(col.address,o),name+' collection disabled: '+col.address);
   log(name+' '+col.address+' enabled: true');
  }
 }
 fail(!equal(await a.settlementKeeper(o),ethers.ZeroAddress),'Settlement keeper is not configured');
 log('Settlement keeper: '+await a.settlementKeeper(o)+'; service liveness must be checked separately');
 log('Reserve binding: '+await f.reserve(o));
 log('Pause states (informational): market='+await m.paused(o)+', auction='+await a.paused(o)+', reserve='+await r.paused(o));
 log('PASS: read-only strict deployment validation at block '+block+'. Verify Safe provenance and intended owner identities separately.');
 return {chainId,block};
}
async function main(){const hre=require('hardhat');const id=Number((await hre.ethers.provider.getNetwork()).chainId);await validateDeployment(hre,read(id));}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={validateDeployment};
