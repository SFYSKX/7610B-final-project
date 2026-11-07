import {JsonRpcProvider,BrowserProvider,Contract} from 'ethers';
import {ABIS} from '../lib/abis.mjs';
import {same} from '../lib/format.mjs';
import {address} from '../lib/control.mjs';
import {loadDeployment} from './deployment.mjs';
export async function connect(mode,index=3){
 let provider,signer,accounts=[];let localConfig;
 try{
 if(mode==='local')localConfig=await loadDeployment(31337);
 if(mode==='local'){const url=localConfig.localRpcUrl||'http://127.0.0.1:8545';if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(url))throw Error('本地演示只连接本机节点');provider=new JsonRpcProvider(url,undefined,{cacheTimeout:-1});if((await provider.getNetwork()).chainId!==31337n)throw Error('本地连接只接受 chainId 31337');accounts=await provider.send('eth_accounts',[]);signer=await provider.getSigner(index);}
 else {if(!window.ethereum)throw Error('需要安装 MetaMask');provider=new BrowserProvider(window.ethereum,undefined,{cacheTimeout:-1});await provider.send('eth_requestAccounts',[]);signer=await provider.getSigner();}
 const chainId=Number((await provider.getNetwork()).chainId);if(![31337,11155111].includes(chainId))throw Error('请选择本地链或 Sepolia');
 const config=localConfig||await loadDeployment(chainId);
 if(config.deploymentIdentity&&(await provider.getBlock(config.deploymentBlock))?.hash!==config.deploymentIdentity)throw Error('节点与部署清单不是同一次部署，请核对本地端口或钱包网络。');
 const contracts={};for(const n of ['Marketplace','AuctionHouse','RiskReserve','FeeRouter']){contracts[n]=new Contract(address(config.contracts[n]),ABIS[n],provider);if(await contracts[n].API_VERSION()!==(n==='RiskReserve'?3n:2n)||!same(await contracts[n].owner(),config.admin))throw Error(`${n} 合约版本或管理地址不匹配。用户申诉版要求 RiskReserve API 3，请连接本版本部署的平台。`);}
 if(chainId===31337&&config.adminMode==='LOCAL_COUNCIL')contracts.LocalCouncil=new Contract(config.admin,ABIS.LocalCouncil,provider);
 return {mode,provider,signer,account:await signer.getAddress(),chainId,config,contracts,accounts};
 }catch(e){provider?.destroy();throw e;}
}
