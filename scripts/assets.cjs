const {read,save}=require('./common.cjs');
const fs=require('node:fs');

// Stable request IDs resume an existing deployment; a new ID deliberately creates a collection.
async function deployAssets(hre,d,{persist=save,env=process.env,log=console.log}={}){
 const {ethers}=hre,provider=ethers.provider;
 const chainId=Number((await provider.getNetwork()).chainId);
 if(![31337,11155111].includes(chainId))throw Error('Test network only');
 if(chainId===11155111&&env.CONFIRM_TESTNET_DEPLOY!=='yes')throw Error('Explicit testnet acknowledgement required');
 if(d.chainId!==chainId||d.status!=='complete')throw Error('Complete core deployment required');
 for(const name of ['Marketplace','AuctionHouse','RiskReserve','FeeRouter'])if(await provider.getCode(d.contracts[name])==='0x')throw Error('Missing core code: '+name);
 const requestId=env.NFT_DEPLOYMENT_ID||'demo-v1';
 if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(requestId))throw Error('NFT_DEPLOYMENT_ID must be 1..64 letters, digits, dots, underscores or hyphens');
 const [signer]=await ethers.getSigners();const issuer=await signer.getAddress();
 const equal=(a,b)=>ethers.getAddress(a)===ethers.getAddress(b);
 d.testAssetDeployments||={};d.collections||=[];
 let record=Object.hasOwn(d.testAssetDeployments,requestId)?d.testAssetDeployments[requestId]:null;
 if(!record&&Object.values(d.testAssetDeployments).some(r=>r.status!=='complete'))throw Error('Resolve the unfinished NFT deployment request before starting a new one');
 async function verify(address){
  if(await provider.getCode(address)==='0x')throw Error('Recorded NFT has no code; inspect checkpoint before retrying');
  const nft=await ethers.getContractAt('DemoNFT',address);
  if(!equal(await nft.owner(),issuer)||!await nft.supportsInterface('0x80ac58cd'))throw Error('Recorded NFT issuer/interface mismatch');
 }
 function finish(receipt){
  if(!d.collections.some(c=>equal(c.address,record.address)))d.collections.push({address:record.address,name:'Campus Digital Objects',deploymentBlock:receipt.blockNumber});
  record.status='complete';record.deploymentBlock=receipt.blockNumber;persist(d);
  log('Test NFT ready: '+record.address+' (request '+requestId+'). Repeating this request reuses it.');return record.address;
 }
 if(!record&&requestId==='demo-v1'&&d.collections.length){
  const col=d.collections.at(-1);await verify(col.address);
  record={address:col.address,issuer,status:'complete',deploymentBlock:col.deploymentBlock,adopted:true};
  Object.defineProperty(d.testAssetDeployments,requestId,{value:record,enumerable:true,writable:true,configurable:true});
  persist(d);log('Reusing existing collection: '+col.address+'. Use a new NFT_DEPLOYMENT_ID only for an intentional additional collection.');return col.address;
 }
 if(record){
  if(!equal(record.issuer,issuer))throw Error('Cannot resume with a different NFT issuer');
  if(record.status==='complete'){await verify(record.address);persist(d);log('Reusing confirmed test NFT: '+record.address);return record.address;}
  if(!record.hash&&env.NFT_DEPLOYMENT_TX){
   const tx=await provider.getTransaction(env.NFT_DEPLOYMENT_TX);
   const factory=await ethers.getContractFactory('DemoNFT',signer),expected=await factory.getDeployTransaction();
   if(!tx||!equal(tx.from,issuer)||tx.nonce!==record.nonce||tx.to!==null||tx.data!==expected.data)throw Error('Recovery transaction does not match issuer, nonce and NFT deployment data');
   record.hash=tx.hash;record.status='submitted';persist(d);
  }
  if(!record.hash)throw Error('Deployment outcome unknown. Inspect issuer '+issuer+' nonce '+record.nonce+' expected address '+record.address+'; set NFT_DEPLOYMENT_TX to the verified original hash. No transaction resent.');
  const receipt=await provider.getTransactionReceipt(record.hash);
  if(!receipt)throw Error('Submitted NFT deployment has no receipt: '+record.hash+'. No transaction resent.');
  if(receipt.status!==1||!receipt.contractAddress||!equal(receipt.contractAddress,record.address))throw Error('NFT deployment failed/mismatched; inspect '+record.hash+' before changing the checkpoint');
  await verify(record.address);return finish(receipt);
 }
 const nonce=await signer.getNonce('pending');
 record={issuer,nonce,address:ethers.getCreateAddress({from:issuer,nonce}),status:'prepared'};
 Object.defineProperty(d.testAssetDeployments,requestId,{value:record,enumerable:true,writable:true,configurable:true});
 persist(d); // Save nonce/address before submission; an uncertain response must not auto-resend.
 const factory=await ethers.getContractFactory('DemoNFT',signer),nft=await factory.deploy({nonce}),tx=nft.deploymentTransaction();
 record.hash=tx.hash;record.status='submitted';persist(d);log('Submitted NFT deployment: '+tx.hash+' expected address '+record.address);
 const receipt=await tx.wait(1,90000);
 if(!receipt||receipt.status!==1||!receipt.contractAddress||!equal(receipt.contractAddress,record.address))throw Error('NFT deployment not confirmed; retain checkpoint');
 await verify(record.address);return finish(receipt);
}
async function main(){
 const hre=require('hardhat');const id=Number((await hre.ethers.provider.getNetwork()).chainId);
 fs.mkdirSync('deployments',{recursive:true});const lock=`deployments/${id}.assets.lock`;
 let fd;try{fd=fs.openSync(lock,'wx');}catch(e){if(e.code==='EEXIST')throw Error('NFT deployment lock exists: '+lock+'. Check the recorded process; do not delete a live lock.');throw e;}
 try{fs.writeFileSync(fd,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()})+'\n');await deployAssets(hre,read(id));}
 finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={deployAssets};
