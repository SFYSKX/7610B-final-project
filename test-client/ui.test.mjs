import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {tokenId,integer} from '../src/lib/control.mjs';
const require=createRequire(import.meta.url);
async function component(file){
 const result=await build({entryPoints:[file],bundle:true,write:false,format:'cjs',platform:'node',external:['ethers'],plugins:[{name:'controlled-react-state',setup(b){
  b.onResolve({filter:/^react$/},args=>args.namespace==='fixture-react'?{path:'react',external:true}:{path:'react',namespace:'fixture-react'});
  b.onLoad({filter:/.*/,namespace:'fixture-react'},()=>({contents:`const R=require('react');module.exports={...R,useState:(v)=>globalThis.__ledgerHooks.useState(v),useRef:(v)=>globalThis.__ledgerHooks.useRef(v),useEffect:(...a)=>globalThis.__ledgerHooks.useEffect(...a)};`,loader:'js'}));
 }}]});
 const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports);return module.exports;
}
const PendingPanel=(await component('src/components/PendingPanel.jsx')).default;
const FeatureHost=(await component('src/components/FeatureHost.jsx')).default;
const DashboardStats=(await component('src/components/DashboardStats.jsx')).default;
const {features,visibleFeatures}=await component('src/features/registry.jsx');
const History=(await component('src/features/history/History.jsx')).default;
const Inventory=(await component('src/features/assets/Inventory.jsx')).default;
const NFTApproval=(await component('src/features/assets/NFTApproval.jsx')).default;
const {default:Auctions,AuctionCard}=await component('src/features/auction/Auctions.jsx');
const {default:Reserve,ClaimCard,IncidentRow}=await component('src/features/reserve/Reserve.jsx');
const RecordLookup=(await component('src/components/RecordLookup.jsx')).default;
const account='0x0000000000000000000000000000000000000011',other='0x0000000000000000000000000000000000000022';
function hooks(overrides={}){let i=0;globalThis.__ledgerHooks={useState:init=>[Object.hasOwn(overrides,i)?overrides[i++]:((i++),typeof init==='function'?init():init),()=>{}],useRef:v=>({current:v}),useEffect:()=>{}};}
function elements(tree){if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(elements);return [tree,...elements(tree.props?.children)];}
const s={account,chainId:31337,config:{collections:[],contracts:{Marketplace:account,AuctionHouse:other}},contracts:{AuctionHouse:{},RiskReserve:{}}};
function common(){const calls=[];return {s,data:{time:1000,pausedA:false,pausedR:false},disabled:false,guarded:fn=>fn(),tx:(...args)=>calls.push(args),calls};}

test('pending panel renders replacement hash controls with real JSX imports',()=>{hooks();const html=renderToStaticMarkup(React.createElement(PendingPanel,{pending:{action:'pending test',hash:'0x1234'},onCheck:()=>{}}));assert.match(html,/待确认交易/);assert.match(html,/核对替换交易/);});
test('feature dependencies gate failed views while keeping independent pages available',()=>{
 const data={isAdmin:false,modules:{market:{status:'error'},auction:{status:'ready'}}};
 const view={key:'probe',label:'查询页面',dependencies:['market'],Component:()=>React.createElement('div',null,'live view')};
 let html=renderToStaticMarkup(React.createElement(FeatureHost,{feature:view,data,retry:()=>{}}));
 assert.match(html,/暂时不可用/);assert.doesNotMatch(html,/live view/);
 html=renderToStaticMarkup(React.createElement(FeatureHost,{feature:{...view,dependencies:['auction']},data}));
 assert.match(html,/live view/);
 assert.equal(renderToStaticMarkup(React.createElement(FeatureHost,{feature:{...view,adminOnly:true},data})), '');
 assert.ok(visibleFeatures(false).every(f=>!f.adminOnly));
 assert.equal(new Set(features.map(f=>f.key)).size,features.length);
});
test('dashboard never renders unreadable balances as zero or claims an unknown role is verified',()=>{
 const html=renderToStaticMarkup(React.createElement(DashboardStats,{data:{isAdmin:false,modules:{},counts:{}}}));
 assert.match(html,/身份待核验/);assert.match(html,/暂不可用/);assert.doesNotMatch(html,/0\.0|<strong>交易用户/);
});
test('nonempty history renders addresses and CSV without ReferenceError',()=>{hooks({1:{from:1,to:2,next:null,rows:[{key:'log',time:1,kind:'铸造',block:1,from:account,to:other,hash:'0xabc',price:''}]}});const html=renderToStaticMarkup(React.createElement(History,{s,guarded:fn=>fn()}));assert.match(html,/导出 CSV/);assert.match(html,/0x0000/);});
test('ERC721 token IDs accept zero and uint256; business IDs still require one',()=>{assert.equal(tokenId('0'),0n);assert.equal(tokenId(String((1n<<256n)-1n)),(1n<<256n)-1n);for(const value of ['-1','1.2','1e3',String(1n<<256n)])assert.throws(()=>tokenId(value));assert.throws(()=>integer('0',{min:1n}));});
test('asset and auction forms pass token zero to their actual transaction handlers',()=>{
 hooks();const p=common();p.data={...p.data,inventory:[],collections:[]};p.s={...s,provider:{},contracts:{...s.contracts,Marketplace:{}}};
 const tree=Inventory(p),forms=elements(tree).filter(x=>x.props?.submit);
 forms.find(x=>x.props.submit==='托管 NFT 并挂牌').props.onSubmit({collection:account,token:'0',price:'0.001',hours:'1'});
 assert.equal(p.calls[0][3][1],0n);
 hooks({0:account,1:'0',3:{status:'ready',key:account.toLowerCase()+':0',owner:account,market:false,auction:false}});
 elements(NFTApproval({...p,defaultCollection:account})).find(x=>x.type==='form').props.onSubmit({preventDefault(){}});
 assert.equal(p.calls[1][3][1],0n);
 hooks();p.data={...p.data,auctions:[],refund:0n,as:0n};
 elements(Auctions(p)).find(x=>x.props?.submit==='托管并创建拍卖').props.onSubmit({collection:account,token:'0',reserve:'0.001',increment:'0.0001',minutes:'2'});
 assert.equal(p.calls[2][3][1],0n);
});
test('approval form names both destinations and submits the chosen AuctionHouse address',()=>{
 const p=common();p.s={...s,provider:{}};
 hooks({0:account,1:'1',2:'AuctionHouse',3:{status:'ready',key:account.toLowerCase()+':1',owner:account,market:false,auction:false,singleLabel:'未设置单件授权',block:7}});
 const tree=NFTApproval({...p,defaultCollection:account});const html=renderToStaticMarkup(tree);
 assert.match(html,/交易市场 Marketplace/);assert.match(html,/拍卖市场 AuctionHouse/);assert.match(html,/授权给拍卖市场 AuctionHouse/);
 elements(tree).find(x=>x.type==='form').props.onSubmit({preventDefault(){}});assert.deepEqual(p.calls[0][3],[other,1n]);
});
test('already-authorized target and non-owner cannot issue another approval',()=>{
 for(const status of [{owner:account,market:true,auction:false},{owner:other,market:false,auction:false}]){
  const p=common();p.s={...s,provider:{}};hooks({0:account,1:'1',3:{status:'ready',key:account.toLowerCase()+':1',singleLabel:'交易市场 Marketplace',block:7,...status}});
  const tree=NFTApproval({...p,defaultCollection:account});const button=elements(tree).find(x=>x.type==='button'&&x.props.type==='submit');assert.equal(button.props.disabled,true);
  assert.throws(()=>elements(tree).find(x=>x.type==='form').props.onSubmit({preventDefault(){}}));assert.equal(p.calls.length,0);
 }
});
test('selecting an asset gives a pressed state and a visible filled-form confirmation',()=>{
 const selected={collection:account,tokenId:1,owner:account,name:'Test NFT'};const p=common();p.data={...p.data,inventory:[selected],collections:[]};
 hooks({0:selected});const html=renderToStaticMarkup(React.createElement(Inventory,p));assert.match(html,/aria-pressed="true"/);assert.match(html,/asset-selected/);assert.match(html,/已选择 NFT #1/);
});
test('old auction card waits for service and permits entitled NFT claiming by exact ID',()=>{
 const p=common(),v={id:1n,tokenId:0n,collection:account,seller:other,reservePrice:1n,highestBid:2n,highestBidder:account,endTime:999n,status:1n,entitledRecipient:account,assetClaimed:false};
 let tree=AuctionCard({...p,v});assert.equal(elements(tree).some(x=>x.props?.children==='触发结算'),false);
 tree=AuctionCard({...p,v:{...v,status:2n}});elements(tree).find(x=>x.props?.submit==='领取 NFT').props.onSubmit({recipient:account});
 assert.deepEqual(p.calls.map(x=>[x[2],x[3]]),[['claimNFT',[1n,account]]]);
 const denied=AuctionCard({...p,s:{...s,account:other},v:{...v,status:2n}});assert.equal(elements(denied).some(x=>x.props?.submit==='领取 NFT'),false);
});
test('old approved claim remains claimable during pause; paid and other-account claims do not',()=>{
 const p=common();p.data.pausedR=true;const c={id:1n,incidentId:1n,beneficiary:account,state:3n,maxLoss:10n,amount:5n};
 const form=elements(ClaimCard({...p,c})).find(x=>x.props?.submit==='领取赔付');assert.equal(form.props.disabled,false);form.props.onSubmit({recipient:account});
 assert.deepEqual(p.calls[0].slice(2),['claimPayout',[1n,account]]);
 for(const row of [{...c,state:5n},{...c,beneficiary:other}])assert.equal(elements(ClaimCard({...p,c:row})).some(x=>x.props?.submit==='领取赔付'),false);
 const i={id:1n,policyHash:'0x1234',budget:10n,approved:5n,paid:0n,claimDeadline:500n,reviewDeadline:999n,closed:false};
 assert.equal(elements(IncidentRow({...p,i})).some(x=>x.props?.children==='释放未批准预算'),false);p.data.isAdmin=true;
 elements(IncidentRow({...p,i})).find(x=>x.props?.children==='释放未批准预算').props.onClick();assert.equal(p.calls[1][2],'closeIncident');
});
test('lookup read callbacks use requested IDs and reject nonexistent records',async()=>{
 const seen=[];hooks();const p=common();p.data={...p.data,block:7,auctions:[],collections:[],refund:0n,as:0n};
 p.s={...s,contracts:{AuctionHouse:{getAuction:async(id,o)=>{seen.push([id,o]);return {status:0n};}}}};
 const lookup=elements(Auctions(p)).find(x=>x.props?.label==='查询任意拍卖 ID');await assert.rejects(lookup.props.read(1n,{blockTag:7}),/不存在/);assert.deepEqual(seen,[[1n,{blockTag:7}]]);
 hooks();p.data.isAdmin=true;p.s={...s,contracts:{RiskReserve:{getClaim:async()=>({state:0n}),getIncident:async()=>({budget:0n})}}};p.data={...p.data,incidents:[],claims:[]};
 for(const lookup of elements(Reserve(p)).filter(x=>x.props?.read))await assert.rejects(lookup.props.read(1n,{}),/不存在/);
});
test('lookup discards an asynchronous response after account change',async()=>{
 let slots=[],cursor=0,effects=[],changed=false,cleanups=new Map(),deps=new Map();
 globalThis.__ledgerHooks={
  useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=init;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;changed=true;}];},
  useRef:init=>{const i=cursor++;return slots[i]??(slots[i]={current:init});},
  useEffect:(fn,list)=>{const i=cursor++;if(!deps.has(i)||list.some((v,n)=>v!==deps.get(i)[n])){deps.set(i,list);effects.push(()=>{cleanups.get(i)?.();cleanups.set(i,fn());});}}
 };
 let resolve;const props={s,block:1,label:'test',read:()=>new Promise(r=>resolve=r),children:row=>React.createElement('div',null,'record '+row.id)};
 function render(){let tree;for(let n=0;n<10;n++){cursor=0;changed=false;tree=RecordLookup(props);const run=effects;effects=[];run.forEach(x=>x());if(!changed)return tree;}throw Error('unstable render');}
 let tree=render();elements(tree).find(x=>x.props?.submit==='按 ID 查询').props.onSubmit({id:'1'});render();await Promise.resolve();
 props.s={...s,account:other};render();resolve({state:3n});await new Promise(r=>setImmediate(r));tree=render();
 assert.equal(elements(tree).some(x=>typeof x.props?.children==='string'&&x.props.children.startsWith('record ')),false);
});

const NFTDetails=(await component('src/components/NFTDetails.jsx')).default;
test('NFT details render image, escaped description, traits and full identity',()=>{
 const session={...s,provider:{}},collection=account,token=0n,key='31337:'+collection+':0';
 const value={name:'校园艺术',description:'<script>alert(1)</script>',image:'https://example.org/art.png',attributes:[{trait:'颜色',value:'蓝'}],uri:'https://example.org/0.json'};
 hooks({0:{key,value,session}});const html=renderToStaticMarkup(React.createElement(NFTDetails,{s:session,collection,tokenId:token}));
 assert.match(html,/校园艺术/);assert.match(html,/art.png/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/颜色/);assert.match(html,/Token ID/);assert.match(html,/no-referrer/);
});
test('NFT details discard other-session data and expose retry after metadata failure',()=>{
 const session={...s,provider:{}},key='31337:'+account+':1';
 hooks({0:{key,value:{name:'STALE'},session:{...session}}});let html=renderToStaticMarkup(React.createElement(NFTDetails,{s:session,collection:account,tokenId:1}));assert.doesNotMatch(html,/STALE/);assert.match(html,/正在加载/);
 hooks({0:{key,error:true,session}});html=renderToStaticMarkup(React.createElement(NFTDetails,{s:session,collection:account,tokenId:1}));assert.match(html,/重试/);assert.match(html,/暂时无法读取/);
});
test('failed NFT images fall back without hiding details',()=>{
 const session={...s,provider:{}},key='31337:'+account+':1',value={name:'Test',description:'Description',image:'https://example.org/broken.png',attributes:[],uri:''};
 hooks({0:{key,value,session},2:value.image});const html=renderToStaticMarkup(React.createElement(NFTDetails,{s:session,collection:account,tokenId:1}));assert.doesNotMatch(html,/<img/);assert.match(html,/图片加载失败/);assert.match(html,/Description/);
});
