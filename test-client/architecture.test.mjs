import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {createRefresh} from '../src/lib/control.mjs';
import {readMarket} from '../src/services/queries/market.mjs';
import {readIdentity} from '../src/services/queries/governance.mjs';
import {selectJournal,appendJournal} from '../src/services/journal.mjs';

// Bundle just the query entry so JSON ABIs use the same loader as the application.
const bundle=await build({entryPoints:['src/services/queries/index.mjs'],bundle:true,write:false,format:'cjs',platform:'node',external:['ethers']});
const mod={exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
const {snapshot,unavailableSnapshot}=mod.exports;
const account='0x0000000000000000000000000000000000000011';
const other='0x0000000000000000000000000000000000000022';
const session={account,chainId:31337,config:{admin:other,deploymentIdentity:'deployment-a',collections:[]},provider:{getBlock:async()=>({number:42,timestamp:1000})}};

test('a failed reserve query does not hide successful market data or invent a zero balance',async()=>{
  const data=await snapshot(session,{readers:{
    market:async()=>({ms:7n,listings:[],counts:{listings:3n}}),
    reserve:async()=>{throw Error('RPC broke');},identity:async()=>({isAdmin:true})
  }});
  assert.equal(data.modules.market.status,'ready');assert.equal(data.ms,7n);
  assert.equal(data.modules.reserve.status,'error');assert.equal(Object.hasOwn(data,'available'),false);
  assert.equal(data.counts.listings,3n);assert.equal(data.isAdmin,true);
});

test('unknown identity is denied after a previously successful administrator read',async()=>{
  const first=await snapshot(session,{readers:{identity:async()=>({isAdmin:true,isCouncilSigner:true})}});
  const next=await snapshot(session,{readers:{identity:async()=>{throw Error('offline');}}});
  assert.equal(first.isAdmin,true);assert.equal(next.isAdmin,false);assert.equal(next.isCouncilSigner,false);
  assert.equal(next.modules.identity.status,'error');
});

test('all modules receive one pinned block; market records and funds use that block',async()=>{
  const seen=[];
  const m=Object.fromEntries(['listingCount','sellerCredit','paused','feeBps'].map(name=>[name,async(...args)=>{
    seen.push(args.at(-1).blockTag);return name==='listingCount'?1n:0n;
  }]));
  m.getListing=async(id,o)=>{seen.push(o.blockTag);return {toObject:()=>({price:2n})};};
  const data=await snapshot({...session,contracts:{Marketplace:m}},{readers:{market:readMarket,probe:async({account},ctx)=>{seen.push(ctx.block.number,ctx.options.blockTag);return {account};}}});
  assert.ok(seen.length>=7);assert.ok(seen.every(n=>n===42));assert.equal(data.modules.market.block,42);
  assert.equal(data.listings[0].id,1);assert.equal(data.listings[0].price,2n);
});

test('one hung module times out and late results cannot mutate an already-published snapshot',async()=>{
  let release;
  const data=await snapshot(session,{timeoutMs:20,readers:{
    reserve:()=>new Promise(r=>release=r),market:async()=>({ms:9n})
  }});
  assert.equal(data.modules.reserve.status,'error');assert.equal(data.ms,9n);
  release({available:999n});await new Promise(r=>setImmediate(r));
  assert.equal(data.available,undefined);assert.equal(data.modules.reserve.status,'error');
});

test('a global node failure removes previously displayed financial state and admin rights',()=>{
  const data=unavailableSnapshot(session);
  assert.equal(data.isAdmin,false);assert.equal(data.rb,undefined);assert.equal(data.ms,undefined);
  assert.ok(Object.values(data.modules).every(v=>v.status==='error'&&v.block===null));
});

test('stopping an in-flight module refresh cannot publish to a new account',async()=>{
  let release;const applied=[];
  const controller=createRefresh(()=>snapshot(session,{readers:{market:()=>new Promise(r=>release=r)}}),d=>applied.push(d),()=>{});
  const task=controller.request();await new Promise(r=>setImmediate(r));controller.stop();release({ms:3n});await task;
  assert.deepEqual(applied,[]);
});

test('administrator query uses governance directly and propagates unreadable roles',async()=>{
  let calls=0;
  const s={...session,contracts:{LocalCouncil:{isSigner:async(who,o)=>{calls++;assert.equal(who,account);assert.equal(o.blockTag,42);return true;}}}};
  assert.deepEqual(await readIdentity(s,{options:{blockTag:42}}),{isAdmin:true,isCouncilSigner:true});assert.equal(calls,1);
  s.contracts.LocalCouncil.isSigner=async()=>{throw Error('offline');};
  await assert.rejects(readIdentity(s,{options:{blockTag:42}}),/offline/);
});

test('journal selection keeps deployment/account boundaries and rejects unscoped legacy entries',()=>{
  const mine=appendJournal([],session,{action:'mine'});
  const all=appendJournal(mine,{...session,account:other},{action:'admin'});
  all.push({action:'legacy',account});
  assert.deepEqual(selectJournal(all,session,false).map(v=>v.action),['mine']);
  assert.deepEqual(selectJournal(all,session,true).map(v=>v.action),['admin','mine']);
  assert.deepEqual(selectJournal(all,{...session,config:{...session.config,deploymentIdentity:'other'}},true),[]);
});
