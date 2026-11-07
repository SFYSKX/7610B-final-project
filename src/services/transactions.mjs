import {same} from '../lib/format.mjs';
import {journalKey,recoverReceipt} from '../lib/control.mjs';
import {preflight as checkPreflight} from '../lib/preflight.mjs';

/** Storage port. The keys are compatible with existing pending transactions. */
export function pendingStore(storage) {
  return {
    get:s=>JSON.parse(storage.getItem(journalKey(s))||'null'),
    save(s,value) {
      if(value)storage.setItem(journalKey(s),JSON.stringify(value));
      else storage.removeItem(journalKey(s));
    }
  };
}

/** One write pipeline for all features. UI messages and persistence are injected.
 * No automatic resend: unknown outcomes retain the saved hash and nonce.
 * Static simulation is advisory; the contracts enforce the final business rules.
 */
export async function submitTransaction(request,ports) {
  const {label,contract,method,args=[],options={}}=request;
  const {gate,getSession,store,onPending,log,onMessage,onBusy,refresh,
    locks,preflight=checkPreflight}=ports;
  return gate.run(async()=>{
    const current=getSession();
    if(!current)throw Error('请先连接钱包或本地演示');
    if(request.session&&request.session!==current)throw Error('会话已切换，请重新操作');
    if(store.get(current))throw Error('先确认上一笔交易结果');
    const save=value=>{store.save(current,value);onPending(current,value);};
    onBusy(true);
    try{
      onMessage('预检与估算 Gas…');
      const execute=async()=>{
        if(getSession()!==current)throw Error('会话已切换');
        // Recheck after acquiring the cross-tab lock, before any wallet interaction.
        if(store.get(current))throw Error('先确认上一笔交易结果');
        const network=await current.provider.getNetwork();
        if(Number(network.chainId)!==current.chainId||!same(await current.signer.getAddress(),current.account))
          throw Error('账户或网络已切换，请重新连接');
        await preflight(current,contract,method,args,options);
        const writer=contract.connect(current.signer).getFunction(method);
        await writer.staticCall(...args,options);
        await writer.estimateGas(...args,options);
        if(getSession()!==current)throw Error('会话已切换，请重新连接并核验身份');
        onMessage('等待钱包签名…');
        const sent=await writer(...args,options);
        save({hash:sent.hash,nonce:sent.nonce,action:label,contract:contract.target});
        log({action:label,state:'submitted',hash:sent.hash});
        onMessage('交易已提交，等待确认…');
        let receipt;
        try{
          receipt=await sent.wait(1,90000);
          if(!receipt||receipt.status!==1)throw Object.assign(Error('交易执行失败'),{receipt});
        }catch(e){
          if(e.code==='TRANSACTION_REPLACED'&&e.receipt){
            save(null);
            log({action:label,state:e.cancelled?'cancelled':e.receipt.status===1?'success':'reverted',hash:e.receipt.hash});
            onMessage(e.cancelled?'交易已在钱包中取消':'替换交易已确认，请核对结果');
            await refresh();
            return e.receipt;
          }
          if(e.receipt){save(null);log({action:label,state:'reverted',hash:sent.hash});}
          throw e;
        }
        save(null);
        log({action:label,state:'success',hash:receipt.hash});
        onMessage(label+'已确认');
        await refresh();
        return receipt;
      };
      return locks?await locks.request(`ledger-write:${current.chainId}:${current.account}`,{ifAvailable:true},lock=>{
        if(!lock)throw Error('另一个标签页正在提交交易');
        return execute();
      }):await execute();
    }finally{onBusy(false);}
  });
}

export async function inspectPending(s,pending,replacement,save) {
  let hash=pending.hash;
  if(replacement){
    const tx=await s.provider.getTransaction(replacement);
    if(!tx||!same(tx.from,s.account)||tx.nonce!==pending.nonce)
      throw Error('替换交易必须来自同一账户且 nonce 相同');
    hash=tx.hash;save({...pending,hash});
  }
  return {hash,state:recoverReceipt(await s.provider.getTransactionReceipt(hash))};
}
