import test from 'node:test';
import assert from 'node:assert/strict';
import {loadDeployment} from '../src/services/deployment.mjs';
import {friendly} from '../src/lib/errors.mjs';

const addr='0x0000000000000000000000000000000000000001';
const valid=()=>({chainId:11155111,apiVersion:2,status:'complete',admin:addr,
 contracts:Object.fromEntries(['Marketplace','AuctionHouse','RiskReserve','FeeRouter'].map(n=>[n,addr]))});
const json=value=>async()=>new Response(JSON.stringify(value));

test('reads own network manifest without caching and preserves its fields',async()=>{
 const config=valid();config.collections=[];
 const actual=await loadDeployment(11155111,async(url,options)=>{
  assert.equal(url,'/deployments/11155111.json');assert.equal(options.cache,'no-store');
  return new Response(JSON.stringify(config));
 });
 assert.deepEqual(actual,config);
});
test('missing Sepolia manifest gives actionable Chinese guidance through UI formatter',async()=>{
 await assert.rejects(loadDeployment(11155111,async()=>new Response('',{status:404})),e=>{
  const message=friendly(e);assert.match(message,/INDEPENDENT_DEPLOYMENT/);
  assert.match(message,/仅连接 MetaMask 不会创建平台/);return true;
 });
});
test('Vite HTML fallback does not expose a JSON parser error',async()=>{
 await assert.rejects(loadDeployment(11155111,async()=>new Response('<!doctype html><html></html>')),
  /Sepolia 部署配置缺失或不是有效 JSON/);
});
test('malformed or non-object JSON is rejected with deployment guidance',async()=>{
 await assert.rejects(loadDeployment(11155111,async()=>new Response('{')),/不是有效 JSON/);
 for(const value of [null,[],42])await assert.rejects(loadDeployment(11155111,json(value)),/不是有效 JSON/);
});
test('local missing config points to local demo rather than Sepolia setup',async()=>{
 await assert.rejects(loadDeployment(31337,async()=>new Response('',{status:404})),/npm run demo/);
});
test('transport and server failures are not misreported as a need to redeploy',async()=>{
 await assert.rejects(loadDeployment(11155111,async()=>{throw Error('private endpoint');}),
  e=>e.message.includes('网页服务')&&!e.message.includes('private endpoint'));
 await assert.rejects(loadDeployment(11155111,async()=>new Response('',{status:503})),/HTTP 503/);
});
test('wrong network, version, incomplete deployment and invalid addresses are rejected',async()=>{
 await assert.rejects(loadDeployment(11155111,json({...valid(),chainId:31337})),/网络与当前钱包不一致/);
 await assert.rejects(loadDeployment(11155111,json({...valid(),apiVersion:1})),/接口版本不匹配/);
 await assert.rejects(loadDeployment(11155111,json({...valid(),status:'deploying'})),/平台部署尚未完成/);
 await assert.rejects(loadDeployment(11155111,json({...valid(),contracts:{}})),/核心合约地址/);
 await assert.rejects(loadDeployment(11155111,json({...valid(),admin:'placeholder'})),/管理员/);
});
test('unsupported networks do not request a deployment file',async()=>{
 let called=false;
 await assert.rejects(loadDeployment(1,async()=>{called=true;}),/请选择本地链或 Sepolia/);
 assert.equal(called,false);
});
