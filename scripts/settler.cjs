// Dedicated service; never uses a browser wallet. All writes are bounded by contract rules.
const fs=require('node:fs');
const {JsonRpcProvider,Wallet,Contract}=require('ethers');
async function fundedGas(contract,provider,account,id){
 const gasLimit=(await contract.settleAuction.estimateGas(id))*120n/100n;
 const fees=await provider.getFeeData(),price=fees.maxFeePerGas??fees.gasPrice;
 if(price==null||await provider.getBalance(account)<gasLimit*price)throw Error('结算账户 Gas 余额不足');
 return gasLimit;
}
async function dueAuctions(contract,provider){
 const block=await provider.getBlock('latest'),o={blockTag:block.number};
 const count=Number(await contract.auctionCount(o)),due=[];
 for(let first=1;first<=count;first+=50){
  const batch=await Promise.all(Array.from({length:Math.min(50,count-first+1)},async(_,n)=>{
   const id=first+n,a=await contract.getAuction(id,o);
   return a.status===1n&&a.endTime<=BigInt(block.timestamp)?id:null;
  }));due.push(...batch.filter(x=>x!==null));
 }
 return due;
}
async function main(){
 if(process.loadEnvFile&&fs.existsSync('.env'))process.loadEnvFile('.env');
 const local=process.argv.includes('--local'),chainId=local?31337:11155111;
 if(!local&&!process.argv.includes('--sepolia'))throw Error('请选择 --local 或 --sepolia');
 const d=JSON.parse(fs.readFileSync(`deployments/${chainId}.json`));
 const provider=new JsonRpcProvider(local?(process.env.LOCAL_RPC_URL||d.localRpcUrl||'http://127.0.0.1:8545'):process.env.SEPOLIA_RPC_URL,undefined,{cacheTimeout:-1});
 if(Number((await provider.getNetwork()).chainId)!==chainId)throw Error('网络不匹配，停止结算');
 if(!local&&!process.env.SETTLER_PRIVATE_KEY)throw Error('请为专用结算账户配置 SETTLER_PRIVATE_KEY');
 const signer=local?await provider.getSigner(9):new Wallet(process.env.SETTLER_PRIVATE_KEY,provider);
 if(d.apiVersion!==2||d.status!=='complete')throw Error('需要 v2 已完成部署');
 const a=new Contract(d.contracts.AuctionHouse,JSON.parse(fs.readFileSync('src/contracts/AuctionHouse.json')).abi,signer);
 if(await a.API_VERSION()!==2n||(await a.settlementKeeper()).toLowerCase()!==(await signer.getAddress()).toLowerCase())throw Error('当前账户不是多签配置的专用结算账户');
 fs.mkdirSync('reports',{recursive:true});
 const identity=(await provider.getBlock(d.deploymentBlock))?.hash;if(!identity||(d.deploymentIdentity&&identity!==d.deploymentIdentity))throw Error('无法确认部署身份');
 const file=`reports/settler-${chainId}-${a.target.toLowerCase()}-${identity.slice(2,18)}.json`,lock=file+'.lock';
 let lockFd;try{lockFd=fs.openSync(lock,'wx');}catch{throw Error('结算服务锁已存在；确认旧服务停止后再处理锁文件');}
 fs.writeFileSync(lockFd,String(process.pid));
 let stopping=false;const stop=()=>{stopping=true;};process.on('SIGINT',stop);process.on('SIGTERM',stop);
 const save=state=>{fs.writeFileSync(file+'.tmp',JSON.stringify(state));fs.renameSync(file+'.tmp',file);};
 let pending=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):null;
 try{
  console.log(`自动结算服务已启动：chain ${chainId}，账户 ${await signer.getAddress()}。每 3 秒扫描；请保持运行。`);
  while(!stopping){
   try{
    if((await a.settlementKeeper()).toLowerCase()!==(await signer.getAddress()).toLowerCase()){
     console.error('专用结算账户授权已变更，当前服务停止。');break;
    }
    if(pending){
     if(!pending.hash)throw Error('上次发送结果未知。停止自动重发；核对结算账户 nonce 和链上交易，确认后恢复检查点。');
     const receipt=await provider.getTransactionReceipt(pending.hash);
     if(!receipt){console.log('等待已提交结算确认：'+pending.hash);await new Promise(r=>setTimeout(r,3000));continue;}
     console.log(receipt.status===1?'结算已确认：'+pending.id:'结算已回滚，将重新检查拍卖状态：'+pending.id);pending=null;save(null);
    }
    if(await provider.getTransactionCount(await signer.getAddress(),'pending')!==await provider.getTransactionCount(await signer.getAddress(),'latest'))throw Error('结算账户有未确认交易，请等待或先处理原交易');
    for(const id of await dueAuctions(a,provider)){
     if(stopping)break;
     // Static check again: a concurrent service/governance transaction may have settled it.
     try{await a.settleAuction.staticCall(id);}catch{continue;}
     const gasLimit=await fundedGas(a,provider,await signer.getAddress(),id);
     const nonce=await provider.getTransactionCount(await signer.getAddress(),'pending');
     pending={id,nonce,preparedAt:new Date().toISOString()};save(pending);
     const sent=await a.settleAuction(id,{nonce,gasLimit});pending.hash=sent.hash;save(pending);
     console.log(`已提交拍卖 #${id} 的自动结算：${sent.hash}`);break;
    }
   }catch(e){
    // Do not print provider error objects: they may contain secret RPC URLs.
    console.error(pending&&!pending.hash?'发送结果未知，保留检查点，等待人工核对。':'本轮结算未完成；请检查服务授权、网络及专用账户余额。');
    if(pending&&!pending.hash)break;
   }
   if(!stopping)await new Promise(r=>setTimeout(r,3000));
  }
 }finally{fs.closeSync(lockFd);fs.unlinkSync(lock);provider.destroy();}
 if(pending&&!pending.hash)process.exitCode=1;
}
if(require.main===module)main().catch(()=>{console.error('自动结算服务无法启动。请检查 v2 部署、网络、专用账户配置及服务锁。');process.exitCode=1;});
module.exports={dueAuctions,fundedGas};
