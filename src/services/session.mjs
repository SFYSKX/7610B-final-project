import {JsonRpcProvider,BrowserProvider,Contract} from 'ethers';
import {ABIS} from '../lib/abis.mjs';
import {same} from '../lib/format.mjs';
import {address} from '../lib/control.mjs';
export async function connect(mode,index=3){
 let provider,signer,accounts=[];let localConfig;
 if(mode==='local'){const response=await fetch('/deployments/31337.json',{cache:'no-store'});if(!response.ok)throw Error('请先运行 npm run demo 初始化本地链');localConfig=await response.json();if(localConfig.apiVersion!==2)throw Error('本地部署的合约接口版本不匹配。请核对当前源码、节点和部署清单。');}
 if(mode==='local'){const url=localConfig.localRpcUrl||'http://127.0.0.1:8545';if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(url))throw Error('本地演示只连接本机节点');provider=new JsonRpcProvider(url,undefined,{cacheTimeout:-1});if((await provider.getNetwork()).chainId!==31337n)throw Error('本地连接只接受 chainId 31337');accounts=await provider.send('eth_accounts',[]);signer=await provider.getSigner(index);}
 else {if(!window.ethereum)throw Error('需要安装 MetaMask');provider=new BrowserProvider(window.ethereum,undefined,{cacheTimeout:-1});await provider.send('eth_requestAccounts',[]);signer=await provider.getSigner();}
 try{
 const chainId=Number((await provider.getNetwork()).chainId);if(![31337,11155111].includes(chainId))throw Error('请选择本地链或 Sepolia');
 const response=localConfig?null:await fetch(`/deployments/${chainId}.json`,{cache:'no-store'});if(!localConfig&&!response.ok)throw Error('没有部署清单，请先执行对应部署脚本');const config=localConfig||await response.json();
 if(config.chainId!==chainId||config.apiVersion!==2||config.status==='deploying')throw Error('部署清单版本不匹配或平台尚未部署完成');
 if(config.deploymentIdentity&&(await provider.getBlock(config.deploymentBlock))?.hash!==config.deploymentIdentity)throw Error('节点与部署清单不是同一次部署，请核对本地端口或钱包网络。');
 const contracts={};for(const n of ['Marketplace','AuctionHouse','RiskReserve','FeeRouter']){contracts[n]=new Contract(address(config.contracts[n]),ABIS[n],provider);if(await contracts[n].API_VERSION()!==2n||!same(await contracts[n].owner(),config.admin))throw Error(`${n} 合约版本或管理地址不匹配`);}
 if(chainId===31337&&config.adminMode==='LOCAL_COUNCIL')contracts.LocalCouncil=new Contract(config.admin,ABIS.LocalCouncil,provider);
 return {mode,provider,signer,account:await signer.getAddress(),chainId,config,contracts,accounts};
 }catch(e){provider.destroy();throw e;}
}
