import test from 'node:test';
import assert from 'node:assert/strict';
import {createGate} from '../src/lib/control.mjs';
import {submitTransaction,pendingStore,inspectPending} from '../src/services/transactions.mjs';
const account='0x0000000000000000000000000000000000000011';
function fixture(wait=async()=>({status:1,hash:'0xconfirmed'})) {
  const entries=new Map(),events=[],messages=[],busy=[];
  const storage={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
  const s={chainId:31337,account,config:{admin:account,deploymentIdentity:'a'},provider:{getNetwork:async()=>({chainId:31337n})},signer:{getAddress:async()=>account}};
  let sent=0;
  const writer=async()=>{sent++;return {hash:'0xsent',nonce:7,wait};};
  writer.staticCall=async()=>{};writer.estimateGas=async()=>21000n;
  const contract={target:account,connect:()=>({getFunction:()=>writer})};
  const ports={gate:createGate(),getSession:()=>s,store:pendingStore(storage),onPending:()=>{},log:e=>events.push(e),onMessage:m=>messages.push(m),onBusy:v=>busy.push(v),refresh:async()=>{},preflight:async()=>{}};
  return {s,ports,writer,events,busy,storage,request:{label:'测试交易',contract,method:'buy',session:s},sent:()=>sent};
}
test('write pipeline saves submitted hash then clears only after successful receipt',async()=>{
  const f=fixture();await submitTransaction(f.request,f.ports);
  assert.equal(f.sent(),1);assert.equal(f.ports.store.get(f.s),null);
  assert.deepEqual(f.events.map(e=>e.state),['submitted','success']);assert.deepEqual(f.busy,[true,false]);
});
test('uncertain receipt preserves hash and nonce, blocks resend and survives reload',async()=>{
  const f=fixture(async()=>{throw Error('timeout');});
  await assert.rejects(submitTransaction(f.request,f.ports),/timeout/);
  const saved=pendingStore(f.storage).get(f.s);assert.equal(saved.hash,'0xsent');assert.equal(saved.nonce,7);
  await assert.rejects(submitTransaction(f.request,f.ports),/上一笔/);assert.equal(f.sent(),1);
});
test('duplicate requests cannot clear busy state of the active transaction',async()=>{
  let release;const f=fixture(()=>new Promise(r=>release=r));const first=submitTransaction(f.request,f.ports);
  await new Promise(r=>setImmediate(r));await assert.rejects(submitTransaction(f.request,f.ports),/处理中/);
  assert.deepEqual(f.busy,[true]);release({status:1,hash:'0xconfirmed'});await first;
  assert.deepEqual(f.busy,[true,false]);assert.equal(f.sent(),1);
});
test('a refused cross-tab lock never submits a transaction',async()=>{
  const f=fixture();f.ports.locks={request:async(name,options,fn)=>{assert.equal(options.ifAvailable,true);return fn(null);}};
  await assert.rejects(submitTransaction(f.request,f.ports),/另一个标签页/);assert.equal(f.sent(),0);
});
test('a stale session or failed preflight cannot request a signature',async()=>{
  const stale=fixture();stale.ports.getSession=()=>({...stale.s});
  await assert.rejects(submitTransaction(stale.request,stale.ports),/会话已切换/);assert.equal(stale.sent(),0);
  const f=fixture();f.ports.preflight=async()=>{throw Error('not allowed');};
  await assert.rejects(submitTransaction(f.request,f.ports),/not allowed/);assert.equal(f.sent(),0);
});

test('logout or wallet change during preflight stops the transaction before a signature is requested',async()=>{
  const f=fixture();let current=f.s;
  f.ports.getSession=()=>current;
  f.writer.estimateGas=async()=>{current=null;return 21000n;};
  await assert.rejects(submitTransaction(f.request,f.ports),/会话已切换/);
  assert.equal(f.sent(),0);assert.equal(f.ports.store.get(f.s),null);
  assert.deepEqual(f.busy,[true,false]);
});
test('wallet replacements and reversions resolve pending without automatic resubmission',async()=>{
  for(const [status,cancelled,expected]of [[1,false,'success'],[1,true,'cancelled'],[0,false,'reverted']]){
    const f=fixture(async()=>{throw {code:'TRANSACTION_REPLACED',cancelled,receipt:{hash:'0xreplacement',status}};});
    await submitTransaction(f.request,f.ports);assert.equal(f.ports.store.get(f.s),null);
    assert.equal(f.events.at(-1).state,expected);assert.equal(f.sent(),1);
  }
  const f=fixture(async()=>({status:0,hash:'0xreverted'}));
  await assert.rejects(submitTransaction(f.request,f.ports),/执行失败/);assert.equal(f.ports.store.get(f.s),null);
});
test('replacement recovery requires the same sender and nonce',async()=>{
  const f=fixture(),pending={hash:'0xsent',nonce:7};let saved;
  f.s.provider.getTransaction=async()=>({from:account,nonce:8,hash:'0xbad'});
  await assert.rejects(inspectPending(f.s,pending,'0xbad',v=>saved=v),/nonce/);assert.equal(saved,undefined);
  f.s.provider.getTransaction=async()=>({from:account,nonce:7,hash:'0xgood'});
  f.s.provider.getTransactionReceipt=async()=>({status:1});
  assert.deepEqual(await inspectPending(f.s,pending,'0xgood',v=>saved=v),{state:'success',hash:'0xgood'});assert.equal(saved.hash,'0xgood');
});
