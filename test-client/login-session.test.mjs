import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {pendingStore} from '../src/services/transactions.mjs';

const bundle=await build({entryPoints:['src/App.jsx'],bundle:true,write:false,format:'cjs',platform:'node',external:['ethers'],plugins:[{
  name:'login-fixture',setup(builder){
    builder.onResolve({filter:/^react$/},args=>args.namespace==='fixture-react'?{path:'react',external:true}:{path:'react',namespace:'fixture-react'});
    builder.onLoad({filter:/.*/,namespace:'fixture-react'},()=>({contents:`const R=require('react');module.exports={...R,useState:(v)=>globalThis.__loginHooks.useState(v),useRef:(v)=>globalThis.__loginHooks.useRef(v),useEffect:(...a)=>globalThis.__loginHooks.useEffect(...a)};`,loader:'js'}));
    builder.onLoad({filter:/services[\\/]session\.mjs$/},()=>({contents:'export const connect=(...args)=>globalThis.__loginFixture.connect(...args);',loader:'js'}));
    builder.onLoad({filter:/hooks[\\/]useSnapshot\.jsx$/},()=>({contents:'export default function useSnapshot(s){return s?globalThis.__loginFixture.snapshot:null;}',loader:'js'}));
  }
}]});
const module={exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const App=module.exports.default;
const account='0x0000000000000000000000000000000000000011';
const admin='0x0000000000000000000000000000000000000022';
function elements(tree){if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(elements);return [tree,...elements(tree.props?.children)];}
function text(node){return Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):node==null?'':String(node);}
function button(tree,label){const found=elements(tree).find(node=>node.type==='button'&&text(node)===label);assert.ok(found,label);return found;}

function fixture(t,{isAdmin=false,mode='local',entries=new Map()}={}){
  let slots=[],cursor=0,effects=[],dirty=false;
  const deps=new Map(),cleanups=new Map(),listeners=new Map(),connections=[];
  const prior={window:globalThis.window,storage:globalThis.localStorage};
  const storage={getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)};
  globalThis.localStorage=storage;
  globalThis.window={ethereum:{on:(name,fn)=>{listeners.set(name,fn);},removeListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}}};
  globalThis.__loginHooks={
    useState:initial=>{const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return [slots[index],value=>{const next=typeof value==='function'?value(slots[index]):value;if(!Object.is(next,slots[index])){slots[index]=next;dirty=true;}}];},
    useRef:initial=>{const index=cursor++;return slots[index]??(slots[index]={current:initial});},
    useEffect:(fn,list)=>{const index=cursor++;if(!deps.has(index)||list.some((value,n)=>!Object.is(value,deps.get(index)[n]))){deps.set(index,list);effects.push(()=>{cleanups.get(index)?.();cleanups.set(index,fn());});}}
  };
  const state={snapshot:{isAdmin,isIssuer:false,modules:{identity:{status:'ready'}},counts:{},block:42},
    makeSession(){
      const s={mode,account,chainId:31337,config:{admin,deploymentIdentity:'login-test',collections:[]},accounts:Array(10).fill(account),
        provider:{destroyed:false,destroy(){this.destroyed=true;},getBlock:async()=>({number:42,timestamp:1000}),send:async method=>method==='eth_accounts'?[account]:'0x7a69'},
        contracts:{LocalCouncil:{isSigner:async()=>isAdmin}}};
      connections.push(s);return s;
    },connect:async()=>state.makeSession()};
  globalThis.__loginFixture=state;
  function render(){
    for(let n=0;n<20;n++){
      cursor=0;dirty=false;const tree=App();
      const run=effects;effects=[];run.forEach(effect=>effect());
      if(!dirty)return tree;
    }
    throw Error('登录状态未稳定');
  }
  t.after(()=>{
    for(const cleanup of cleanups.values())cleanup?.();
    globalThis.window=prior.window;globalThis.localStorage=prior.storage;
    delete globalThis.__loginHooks;delete globalThis.__loginFixture;
  });
  return {state,storage,entries,connections,render,emit:name=>listeners.get(name)?.()};
}

test('first visit and reload show only login; legacy auto-login cannot bypass it or erase pending records',t=>{
  const entries=new Map([['ledger-local-session',JSON.stringify({index:0})],['ledger-pending-v2:keep','saved transaction']]);
  const f=fixture(t,{entries}),tree=f.render();
  assert.ok(tree.props.onConnect);assert.equal(tree.props.role,'user');
  assert.equal(elements(tree).some(node=>node.type==='nav'),false);
  assert.equal(f.connections.length,0);assert.equal(entries.has('ledger-local-session'),false);
  assert.equal(entries.get('ledger-pending-v2:keep'),'saved transaction');
  tree.props.onRoleChange('admin');assert.equal(f.render().props.localIndex,0);
});

test('user login hides management, logout preserves pending recovery, and reconnect restores it',async t=>{
  const f=fixture(t);let tree=f.render();await tree.props.onConnect('local');tree=f.render();
  assert.equal(elements(tree).find(node=>node.type==='nav').props['aria-label'],'用户导航');
  assert.ok(!elements(tree).some(node=>node.type==='button'&&['共同管理','风险准备金'].includes(text(node).replace(/\d+$/,''))));
  const s=f.connections[0];pendingStore(f.storage).save(s,{hash:'0xsaved',nonce:1,action:'购买'});
  button(tree,'退出登录 / 切换身份').props.onClick();tree=f.render();
  assert.ok(tree.props.onConnect);assert.equal(s.provider.destroyed,true);
  assert.equal(pendingStore(f.storage).get(s).hash,'0xsaved');
  await tree.props.onConnect('local');tree=f.render();
  assert.ok(elements(tree).some(node=>node.props?.pending?.hash==='0xsaved'));
});

test('ordinary wallet selecting the admin entrance remains on login after verification',async t=>{
  const f=fixture(t);f.render().props.onRoleChange('admin');
  await f.render().props.onConnect('local');const tree=f.render();
  assert.match(tree.props.error,/没有本平台的管理员权限/);
  assert.equal(elements(tree).some(node=>node.type==='nav'),false);
  assert.equal(f.connections[0].provider.destroyed,true);
});

test('failed login provides connection-specific recovery and can retry through local demo',async t=>{
  const f=fixture(t);
  f.state.connect=async()=>{throw Object.assign(Error('network unavailable'),{code:'NETWORK_ERROR'});};
  await f.render().props.onConnect('wallet');let tree=f.render();
  assert.match(tree.props.error,/MetaMask 当前网络的 RPC/);assert.match(tree.props.error,/未发送交易/);
  assert.equal(tree.props.busy,false);assert.equal(elements(tree).some(node=>node.type==='nav'),false);
  await tree.props.onConnect('local');tree=f.render();assert.match(tree.props.error,/npm run demo/);
  f.state.connect=async()=>f.state.makeSession();await tree.props.onConnect('local');tree=f.render();
  assert.equal(elements(tree).find(node=>node.type==='nav').props['aria-label'],'用户导航');
});

test('admin login opens management first; user view retains actual chain identity and separate issuer rights',async t=>{
  const f=fixture(t,{isAdmin:true});f.render().props.onRoleChange('admin');
  await f.render().props.onConnect('local');let tree=f.render();
  assert.equal(elements(tree).find(node=>node.type==='h1').props.children,'共同管理');
  const nav=elements(tree).find(node=>node.type==='nav');assert.equal(nav.props['aria-label'],'管理员导航');
  assert.equal(text(nav.props.children[0]),'共同管理06');
  await button(tree,'切换到用户端').props.onClick();tree=f.render();
  assert.equal(elements(tree).find(node=>node.type==='h1').props.children,'交易市场');
  assert.equal(elements(tree).find(node=>node.type==='nav').props['aria-label'],'用户导航');
  assert.ok(elements(tree).some(node=>node.props?.data?.isAdmin===true));
  assert.ok(!elements(tree).some(node=>node.type==='button'&&text(node).includes('铸造管理')));
});

test('wallet account, chain and disconnect events remove old admin pages and preserve pending transactions',async t=>{
  const f=fixture(t,{isAdmin:true,mode:'wallet'});
  for(const event of ['accountsChanged','chainChanged','disconnect']){
    let tree=f.render();tree.props.onRoleChange('admin');
    await f.render().props.onConnect('wallet');tree=f.render();
    const s=f.connections.at(-1);pendingStore(f.storage).save(s,{hash:'0xsaved',nonce:1});
    f.emit(event);tree=f.render();
    assert.ok(tree.props.onConnect);assert.match(tree.props.error,/已改变/);
    assert.equal(elements(tree).some(node=>node.type==='nav'),false);
    assert.equal(pendingStore(f.storage).get(s).hash,'0xsaved');
  }
});

test('cancelled login cannot publish a late connection over a newer user login',async t=>{
  const f=fixture(t);let release;const old=f.state.makeSession();
  f.state.connect=()=>new Promise(resolve=>{release=resolve;});
  const first=f.render().props.onConnect('local');let tree=f.render();
  assert.equal(tree.props.busy,true);tree.props.onCancel();f.render();
  f.state.connect=async()=>f.state.makeSession();await f.render().props.onConnect('local');
  release(old);await first;tree=f.render();
  assert.equal(old.provider.destroyed,true);
  assert.equal(elements(tree).find(node=>node.type==='nav').props['aria-label'],'用户导航');
  assert.equal(f.connections.at(-1).provider.destroyed,false);
});

test('wallet events during identity verification invalidate the candidate before a late success arrives',async t=>{
  const f=fixture(t,{isAdmin:true,mode:'wallet'});let release;
  f.state.connect=async()=>{const s=f.state.makeSession();s.contracts.LocalCouncil.isSigner=()=>new Promise(resolve=>{release=resolve;});return s;};
  f.render().props.onRoleChange('admin');const task=f.render().props.onConnect('wallet');
  await new Promise(resolve=>setImmediate(resolve));assert.equal(f.render().props.phase,'verifying');
  f.emit('accountsChanged');f.render();release(true);await task;
  const tree=f.render();assert.ok(tree.props.onConnect);assert.match(tree.props.error,/已改变/);
  assert.equal(f.connections[0].provider.destroyed,true);
});

test('live identity read failures suspend the workspace, and revoked admin membership returns to login',async t=>{
  const f=fixture(t,{isAdmin:true});f.render().props.onRoleChange('admin');
  await f.render().props.onConnect('local');f.render();
  f.state.snapshot={...f.state.snapshot,modules:{identity:{status:'error'}}};let tree=f.render();
  assert.ok(tree.props.onConnect);assert.match(tree.props.error,/身份核验暂时失败/);
  f.state.snapshot={...f.state.snapshot,modules:{identity:{status:'ready'}},isAdmin:false};tree=f.render();
  assert.ok(tree.props.onConnect);assert.match(tree.props.error,/权限已失效/);
  assert.equal(f.connections[0].provider.destroyed,true);
});

test('changing entrance after an identity failure cannot resume a hidden session when reads recover',async t=>{
  const f=fixture(t,{isAdmin:true});f.render().props.onRoleChange('admin');
  await f.render().props.onConnect('local');f.render();
  f.state.snapshot={...f.state.snapshot,modules:{identity:{status:'error'}}};
  f.render().props.onRoleChange('user');f.render();
  f.state.snapshot={...f.state.snapshot,modules:{identity:{status:'ready'}}};const tree=f.render();
  assert.ok(tree.props.onConnect);assert.equal(tree.props.role,'user');
  assert.equal(f.connections[0].provider.destroyed,true);
});
