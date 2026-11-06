import {readIdentity} from './queries/governance.mjs';
import {same} from '../lib/format.mjs';

/** Verify the real account at one block before opening either workspace. */
export async function verifyAccess(s,role,{readRole=readIdentity,timeoutMs=s.mode==='local'?8000:15000}={}){
  if(!['user','admin'].includes(role))throw Error('请选择用户入口或管理员入口。');
  let timer;
  try{
    const identity=await Promise.race([
      (async()=>{
        const block=await s.provider.getBlock('latest');
        if(!block)throw Error('无法读取核验区块');
        const value=await readRole(s,{block,options:{blockTag:block.number}});
        if(typeof value.isAdmin!=='boolean')throw Error('身份读取结果无效');
        if(s.mode==='wallet'){
          const [accounts,chainId]=await Promise.all([
            s.provider.send('eth_accounts',[]),s.provider.send('eth_chainId',[])
          ]);
          if(!same(accounts[0],s.account)||Number(chainId)!==s.chainId)throw Error('核验期间账户或网络已改变');
        }
        return {...value,block:block.number};
      })(),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('身份读取超时')),timeoutMs);})
    ]);
    if(role==='admin'&&!identity.isAdmin){
      throw Object.assign(Error('当前钱包没有本平台的管理员权限，请切换管理钱包，或选择用户入口。'),{code:'ADMIN_REQUIRED'});
    }
    return identity;
  }catch(error){
    if(error.code==='ADMIN_REQUIRED')throw error;
    throw Error('身份核验失败，请检查钱包账户、网络及节点连接后重试。',{cause:error});
  }finally{clearTimeout(timer);}
}
