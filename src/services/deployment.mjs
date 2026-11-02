import {isAddress} from 'ethers';

const coreContracts=['Marketplace','AuctionHouse','RiskReserve','FeeRouter'];
function setupHint(chainId){
 return chainId===31337
  ? '本地部署配置缺失或不是有效 JSON。请在本项目运行 npm run demo，等待初始化完成后再点击“本地演示”。'
  : 'Sepolia 部署配置缺失或不是有效 JSON。独立部署包不附带现成合约地址；请先按 docs/INDEPENDENT_DEPLOYMENT.md 配置自己的 Safe 并完成部署，生成 public/deployments/11155111.json 后再连接钱包。仅连接 MetaMask 不会创建平台。';
}

export async function loadDeployment(chainId,fetcher=fetch){
 if(![31337,11155111].includes(chainId))throw Error('请选择本地链或 Sepolia');
 let response;
 try{response=await fetcher(`/deployments/${chainId}.json`,{cache:'no-store'});}
 catch{throw Error('无法读取平台部署配置，请检查网页服务与网络连接后重试。');}
 if(!response.ok){
  if(response.status===404)throw Error(setupHint(chainId));
  throw Error(`平台部署配置请求失败（HTTP ${response.status}），请检查网页服务后重试。`);
 }
 let config;
 // Vite may return index.html with HTTP 200 for a missing public file.
 // Do not surface parser errors or response bodies that may contain unrelated data.
 try{config=await response.json();}catch{throw Error(setupHint(chainId));}
 if(!config||Array.isArray(config)||typeof config!=='object')throw Error(setupHint(chainId));
 if(config.chainId!==chainId)throw Error('部署清单的网络与当前钱包不一致，请核对网络及本项目的部署文件。');
 if(config.apiVersion!==2)throw Error('部署清单接口版本不匹配，请使用与当前源码配套的部署清单。');
 if(config.status!=='complete')throw Error('平台部署尚未完成。请保留部署清单，核对已提交交易并按部署手册恢复，不要重复创建平台。');
 if(!isAddress(config.admin)||!coreContracts.every(name=>isAddress(config.contracts?.[name]))){
  throw Error('部署清单缺少有效的管理员或核心合约地址。请使用部署脚本生成的完整清单，不要手填示例地址。');
 }
 return config;
}
