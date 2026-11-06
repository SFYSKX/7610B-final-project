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
const Activity=(await component('src/features/activity/Activity.jsx')).default;
const PendingPanel=(await component('src/components/PendingPanel.jsx')).default;
const FeatureHost=(await component('src/components/FeatureHost.jsx')).default;
const DashboardStats=(await component('src/components/DashboardStats.jsx')).default;
const AdminCharts=(await component('src/features/admin/AdminCharts.jsx')).default;
const Admin=(await component('src/features/admin/Admin.jsx')).default;
const {features,visibleFeatures}=await component('src/features/registry.jsx');
const History=(await component('src/features/history/History.jsx')).default;
const Inventory=(await component('src/features/assets/Inventory.jsx')).default;
const NFTApproval=(await component('src/features/assets/NFTApproval.jsx')).default;
const {default:Auctions,AuctionCard}=await component('src/features/auction/Auctions.jsx');
const {default:Reserve,MyClaims,ClaimCard,IncidentRow}=await component('src/features/reserve/Reserve.jsx');
const Mint=(await component('src/features/mint/Mint.jsx')).default;
const RecordLookup=(await component('src/components/RecordLookup.jsx')).default;
const mintDraft={name:'校园艺术展',description:'社团作品说明',image:'https://example.org/art.png'};
const account='0x0000000000000000000000000000000000000011',other='0x0000000000000000000000000000000000000022';
function hooks(overrides={}){let i=0;globalThis.__ledgerHooks={useState:init=>[Object.hasOwn(overrides,i)?overrides[i++]:((i++),typeof init==='function'?init():init),()=>{}],useRef:v=>({current:v}),useEffect:()=>{}};}
function elementText(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(elementText).join('');
  return node?.props ? elementText(node.props.children) : '';
}
function elements(tree){if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(elements);return [tree,...elements(tree.props?.children)];}
const s={account,chainId:31337,config:{collections:[],contracts:{Marketplace:account,AuctionHouse:other}},contracts:{AuctionHouse:{},RiskReserve:{}}};
function common(){const calls=[];return {s,data:{time:1000,pausedA:false,pausedR:false},disabled:false,guarded:fn=>fn(),tx:(...args)=>calls.push(args),calls};}

test('ordinary users can submit their own appeal and administrators have review controls without a filing form',()=>{
 const p=common();p.data={...p.data,isAdmin:false,incidents:[],claims:[]};hooks();
 const tree=MyClaims(p),form=elements(tree).find(x=>x.props?.submit==='提交申诉');assert.ok(form);
 form.props.onSubmit({incident:'1',reference:'order 2',requested:'0.001',reason:'settlement issue',evidence:'receipt 1'});
 assert.equal(p.calls[0][2],'submitClaim');assert.equal(p.calls[0][3].length,5);assert.equal(p.calls[0][3][0],1n);
 p.data.isAdmin=true;hooks();assert.equal(elements(MyClaims(p)).some(x=>x.props?.submit==='提交申诉'),false);
 hooks();p.data={...p.data,proposals:[],approvals:{}};
 const options=elements(Admin(p)).filter(x=>x.type==='option').map(x=>String(x.props.children));
 assert.ok(options.some(x=>x.includes('批准用户申诉')));assert.ok(options.some(x=>x.includes('拒绝申请')));
 assert.equal(options.some(x=>x.includes('登记受影响权益')),false);
});

test('mint page submits issuer-owned collection, recipient and count through the normal transaction pipeline',()=>{
 const p=common();p.data={...p.data,mintable:[{address:account,name:'Test NFT',owner:s.account,nextTokenId:0n,limit:10}],isIssuer:true};hooks({1:mintDraft});
 const tree=Mint(p),form=elements(tree).find(x=>x.props?.submit==='确认铸造 NFT');assert.ok(form);
 assert.equal(elements(tree).some(x=>x.type==='button'&&elementText(x).includes('添加属性')),false);
 assert.equal(elements(tree).some(x=>x.props?.className==='mint-attributes'),false);
 form.props.onSubmit({recipient:other,count:'3'});assert.equal(p.calls[0][2],'mintBatch');assert.deepEqual(p.calls[0][3].slice(0,2),[other,3n]);
 const metadata=JSON.parse(Buffer.from(p.calls[0][3][2].split(',')[1],'base64').toString('utf8'));assert.deepEqual(metadata,mintDraft);
 form.props.onSubmit({recipient:other,count:'1'});assert.equal(p.calls[1][2],'mint');
 assert.throws(()=>form.props.onSubmit({recipient:other,count:'11'}));assert.throws(()=>form.props.onSubmit({recipient:'0x0',count:'1'}));
 assert.ok(visibleFeatures(false,true).some(f=>f.key==='mint'));assert.equal(visibleFeatures(true,false).some(f=>f.key==='mint'),false);
 assert.equal(renderToStaticMarkup(React.createElement(FeatureHost,{feature:features.find(f=>f.key==='mint'),data:{isAdmin:true,isIssuer:false,modules:{}}})), '');
});

test('legacy single-mint collections remain usable and non-issuers do not receive a mint form',()=>{
 const p=common();p.data={...p.data,mintable:[]};hooks();assert.equal(elements(Mint(p)).some(x=>x.props?.submit==='确认铸造 NFT'),false);
 p.data.mintable=[{address:account,owner:account,nextTokenId:7n,limit:1}];hooks({1:mintDraft});
 const form=elements(Mint(p)).find(x=>x.props?.submit==='确认铸造 NFT');
 assert.throws(()=>form.props.onSubmit({recipient:other,count:'2'}));form.props.onSubmit({recipient:other,count:'1'});assert.equal(p.calls[0][2],'mint');
});

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

test('admin charts use on-chain snapshot values and label the bounded activity sample',()=>{
 const data={block:88,time:1000,listings:[{status:1,expiresAt:1200},{status:2,expiresAt:900},{status:1,expiresAt:900},{status:3,expiresAt:800}],auctions:[{status:1,endTime:1200},{status:1,endTime:900},{status:2,endTime:800}],rb:10n**18n,available:6n*10n**17n,reserved:4n*10n**17n,mp:1n*10n**16n,ap:2n*10n**16n,rr:3n*10n**16n,tr:4n*10n**16n};
 const html=renderToStaticMarkup(React.createElement(AdminCharts,{data}));
 assert.match(html,/业务状态分布/);assert.match(html,/准备金资金结构/);assert.match(html,/待归集手续费/);
 assert.match(html,/最近最多 40 条链上记录/);assert.match(html,/区块 #88/);
 assert.match(html,/有效挂牌/);assert.match(html,/待结算拍卖/);assert.match(html,/60\.0%/);
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
 elements(Inventory(p)).find(x=>x.props?.submit==='托管并创建拍卖').props.onSubmit({collection:account,token:'0',reserve:'0.001',increment:'0.0001',minutes:'2'});
 assert.equal(p.calls[2][3][1],0n);
});
test('approval form names both destinations and submits the chosen AuctionHouse address',()=>{
 const p=common();p.s={...s,provider:{}};
 hooks({0:account,1:'1',2:'AuctionHouse',3:{status:'ready',key:account.toLowerCase()+':1',owner:account,market:false,auction:false,singleLabel:'未设置单件授权',block:7}});
 const tree=NFTApproval({...p,defaultCollection:account});const html=renderToStaticMarkup(tree);
 assert.match(html,/交易市场 Marketplace/);assert.match(html,/拍卖市场 AuctionHouse/);assert.match(html,/授权给拍卖市场 AuctionHouse/);
 elements(tree).find(x=>x.type==='form').props.onSubmit({preventDefault(){}});assert.deepEqual(p.calls[0][3],[other,1n]);
});
test('approval status renders per-market revoke controls without a combined action',()=>{
 const p=common();p.s={...s,provider:{}};
 hooks({0:account,1:'1',3:{status:'ready',key:account.toLowerCase()+':1',owner:account,approved:account,market:true,auction:true,marketSingle:true,auctionSingle:false,marketAll:true,auctionAll:true,singleLabel:'交易市场 Marketplace',block:7}});
 const tree=NFTApproval({...p,defaultCollection:account}),buttons=elements(tree).filter(x=>x.type==='button');
 assert.ok(buttons.some(x=>elementText(x)==='取消交易市场授权'));
 assert.ok(buttons.some(x=>elementText(x)==='取消拍卖市场授权'));
 assert.equal(buttons.some(x=>x.props.children==='一键取消两个市场授权'),false);
 assert.match(renderToStaticMarkup(tree),/该集合全部 NFT 授权/);
});
test('per-market revoke clears only that market and retains single plus collection-wide revocation',async()=>{
 const p=common();p.s={...s,provider:{}};p.tx=(...args)=>{p.calls.push(args);return {hash:'0xconfirmed'};};
 hooks({0:account,1:'1',3:{status:'ready',key:account.toLowerCase()+':1',owner:account,approved:account,market:true,auction:true,marketSingle:true,auctionSingle:false,marketAll:true,auctionAll:true,singleLabel:'交易市场 Marketplace',block:7}});
 const tree=NFTApproval({...p,defaultCollection:account});
 await elements(tree).find(x=>x.type==='button'&&elementText(x)==='取消交易市场授权').props.onClick();
 assert.deepEqual(p.calls.map(x=>[x[2],x[3]]),[
  ['approve',[require('ethers').ZeroAddress,1n]],['setApprovalForAll',[account,false]]
 ]);
 await elements(tree).find(x=>x.type==='button'&&elementText(x)==='取消拍卖市场授权').props.onClick();
 assert.deepEqual(p.calls.map(x=>[x[2],x[3]]),[
  ['approve',[require('ethers').ZeroAddress,1n]],
  ['setApprovalForAll',[account,false]],
  ['setApprovalForAll',[other,false]]
 ]);
});
test('already-authorized target and non-owner cannot issue another approval',()=>{
 for(const status of [{owner:account,market:true,auction:false},{owner:other,market:true,auction:false}]){
  const p=common();p.s={...s,provider:{}};hooks({0:account,1:'1',3:{status:'ready',key:account.toLowerCase()+':1',singleLabel:'交易市场 Marketplace',block:7,...status}});
  const tree=NFTApproval({...p,defaultCollection:account});const button=elements(tree).find(x=>x.type==='button'&&x.props.type==='submit');assert.equal(button.props.disabled,true);
  const revoke=elements(tree).find(x=>x.type==='button'&&elementText(x)==='取消交易市场授权');if(status.owner!==account)assert.equal(revoke.props.disabled,true);
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

test('merged admin page retains charts, original actions and all four batch actions', () => {
  hooks();
  const props = common();
  props.data = {
    ...props.data, isAdmin: true, block: 1, listings: [], auctions: [],
    rb: 0n, available: 0n, reserved: 0n, mp: 0n, ap: 0n, rr: 0n, tr: 0n,
    binding: account
  };
  const tree = Admin(props);
  const options = elements(tree).filter(node => node.type === 'option');
  for (const key of ['marketTokensBatch', 'auctionTokensBatch',
    'marketCollectionsBatch', 'auctionCollectionsBatch', 'marketToken',
    'auctionToken', 'incident', 'approve', 'reject']) {
    assert.ok(options.some(option => option.props.value === key), key);
  }
  const html = renderToStaticMarkup(tree);
  assert.match(html, /准备金资金结构/);
  assert.match(html, /手续费归集/);
});

const {default:CatalogFilters,CatalogSort}=await component('src/components/CatalogFilters.jsx');
const Market=(await component('src/features/market/Market.jsx')).default;
const catalogDefaults={name:'',token:'',record:'',seller:'',minPrice:'',maxPrice:'',sort:'newest'};

test('catalog controls expose both markets filters and auction-only remaining-time sorting',()=>{
 let updated;
 for(const kind of ['market','auction']){
  hooks({0:{...catalogDefaults,name:'校园'}});updated=undefined;
  const tree=CatalogFilters({kind,value:{...catalogDefaults,sort:'priceAsc'},onChange:value=>{updated=value;},total:2,count:2});
  const nodes=elements(tree);
  for(const name of ['name','token','record','seller','minPrice','maxPrice'])assert.ok(nodes.some(node=>node.type==='input'&&node.props.name===name));
  const sortNodes=elements(CatalogSort({kind,value:catalogDefaults,onChange:value=>{updated=value;}}));
  assert.equal(sortNodes.some(node=>node.type==='option'&&node.props.value==='endingSoon'),kind==='auction');
  sortNodes.find(node=>node.type==='select').props.onChange({target:{value:'priceAsc'}});
  assert.equal(updated.sort,'priceAsc');
  updated=undefined;
  nodes.find(node=>node.type==='input'&&node.props.name==='name').props.onChange({target:{name:'name',value:'新条件'}});
  assert.equal(updated,undefined);
  nodes.find(node=>node.type==='form').props.onSubmit({preventDefault(){}});
  assert.equal(updated.name,'校园');assert.equal(updated.sort,'priceAsc');
  assert.ok(nodes.some(node=>node.type==='button'&&node.props.type==='submit'&&node.props.children==='搜索'));
 }
});

test('market filter integration retains purchase handlers and exports only completed records',()=>{
 const p=common();p.s={...s,contracts:{...s.contracts,Marketplace:{}}};
 const row={id:1n,collection:account,tokenId:0n,seller:other,price:100n,feeBps:100n,revision:1n,expiresAt:2000n,status:1n};
 p.data={...p.data,listings:[row,{...row,id:2n,status:2n}],mFee:100n,ms:0n,block:1};
 p.watch=[];p.toggleWatch=()=>{};hooks({0:'all'});
 const tree=Market(p),nodes=elements(tree);
 const receipts=nodes.filter(node=>node.props?.kind==='market'&&node.props?.recordId);
 assert.equal(receipts.length,1);assert.equal(receipts[0].props.recordId,2n);
 nodes.find(node=>node.type==='button'&&elementText(node).includes('ETH 购买')).props.onClick();
 assert.equal(p.calls[0][2],'buy');assert.deepEqual(p.calls[0][3],[1n,1n,account]);assert.deepEqual(p.calls[0][4],{value:100n});
});

test('auction receipt entry requires a settled winning bid and preserves NFT claiming',()=>{
 const p=common();const base={id:1n,collection:account,tokenId:0n,seller:other,highestBid:10n,reservePrice:5n,highestBidder:account,status:2n,endTime:999n,entitledRecipient:account,assetClaimed:false};
 for(const [row,expected]of [[base,true],[{...base,status:1n},false],[{...base,highestBid:0n},false]]){
  const nodes=elements(AuctionCard({...p,v:row}));
  assert.equal(nodes.some(node=>node.props?.kind==='auction'&&node.props?.recordId===1n),expected);
 }
 const claim=elements(AuctionCard({...p,v:base})).find(node=>node.props?.submit==='领取 NFT');
 claim.props.onSubmit({recipient:account});assert.equal(p.calls[0][2],'claimNFT');
});

test('activity log export offers CSV and Excel and disables empty or pending downloads',()=>{
  const entry={action:'购买',state:'success'};
  for(const [journal,busy,disabled] of [[[],false,true],[[entry],false,false],[[entry],true,true]]){
    hooks({1:busy});
    const tree=Activity({s,journal});
    const nodes=elements(tree);
    assert.deepEqual(nodes.filter(node=>node.type==='option').map(node=>node.props.value),['csv','xlsx']);
    assert.equal(nodes.find(node=>node.type==='select').props.value,'csv');
    assert.equal(nodes.find(node=>node.type==='button').props.disabled,disabled);
    assert.equal(nodes.find(node=>node.type==='select').props.disabled,busy);
  }
});

test('market and auction layouts keep sorting above cards and search inside the ID lookup panel',()=>{
  const p=common();
  p.data={...p.data,listings:[],auctions:[],mFee:100n,ms:0n,refund:0n,as:0n};
  p.watch=[];p.toggleWatch=()=>{};
  for(const [Component,label,kind] of [[Market,'查询任意订单 ID','market'],[Auctions,'查询任意拍卖 ID','auction']]){
    hooks();
    const tree=Component(p),nodes=elements(tree);
    const lookup=nodes.find(node=>node.props?.label===label);
    assert.equal(lookup.props.searchControls.props.kind,kind);
    assert.equal(nodes.some(node=>node.props?.total!==undefined),false);
    const toolbar=nodes.find(node=>node.props?.className==='catalog-toolbar');
    assert.equal(toolbar.props.children[0].props.kind,kind);
    assert.ok(elements(toolbar).some(node=>node.type==='select'));
    assert.equal(nodes.some(node=>node.props?.submit==='托管并创建拍卖'),false);
  }
});

test('auction scope selects active, owned, pending, settled and cancelled rows before search',()=>{
  const p=common();
  const base={collection:account,tokenId:0n,seller:other,highestBid:0n,reservePrice:5n,status:1n,endTime:2000n};
  p.data={...p.data,refund:0n,as:0n,auctions:[
    {...base,id:1n},{...base,id:2n,endTime:1000n},{...base,id:3n,status:2n},
    {...base,id:4n,status:3n},{...base,id:5n,seller:account}
  ]};
  for(const [scope,expected] of [['active',[5n,1n]],['mine',[5n]],['pending',[2n]],['settled',[3n]],['cancelled',[4n]],['all',[5n,4n,3n,2n,1n]]]){
    hooks({1:scope});
    const nodes=elements(Auctions(p));
    assert.deepEqual(nodes.filter(node=>node.props?.v).map(node=>node.props.v.id),expected);
  }
  hooks({0:{...catalogDefaults,record:'1'},1:'all'});
  assert.deepEqual(elements(Auctions(p)).filter(node=>node.props?.v).map(node=>node.props.v.id),[1n]);
});

test('asset selection fills both creation forms and independently gates market and auction availability',()=>{
  const p=common(),selected={collection:other,tokenId:0n};
  p.data={...p.data,pausedM:false,inventory:[],collections:[],modules:{market:{status:'ready'},auction:{status:'ready'}}};
  hooks({0:selected});
  const nodes=elements(Inventory(p));
  const column=nodes.find(node=>node.props?.className==='asset-creation-forms');
  const forms=elements(column).filter(node=>node.props?.submit);
  assert.deepEqual(forms.map(node=>node.props.submit),['托管 NFT 并挂牌','托管并创建拍卖']);
  for(const form of forms){
    assert.equal(form.props.fields.find(field=>field.name==='collection').value,other);
    assert.equal(form.props.fields.find(field=>field.name==='token').value,0n);
    assert.equal(form.props.disabled,false);
  }
  forms[1].props.onSubmit({collection:other,token:'0',reserve:'0.01',increment:'0.001',minutes:'10'});
  assert.equal(p.calls[0][1],s.contracts.AuctionHouse);
  assert.equal(p.calls[0][2],'createAuction');
  assert.deepEqual(p.calls[0][3],[other,0n,10n**16n,10n**15n,1600n]);
  assert.throws(()=>forms[1].props.onSubmit({collection:other,token:'0',reserve:'0.01',increment:'0.001',minutes:'43201'}));
  for(const [market,auction,pausedM,pausedA,listingDisabled,auctionDisabled] of [
    ['error','ready',false,false,true,false],['ready','error',false,false,false,true],
    ['ready','ready',true,false,true,false],['ready','ready',false,true,false,true]
  ]){
    p.data={...p.data,pausedM,pausedA,modules:{market:{status:market},auction:{status:auction}}};
    hooks();const current=elements(Inventory(p)).filter(node=>node.props?.submit);
    assert.equal(current.find(node=>node.props.submit==='托管 NFT 并挂牌').props.disabled,listingDisabled);
    assert.equal(current.find(node=>node.props.submit==='托管并创建拍卖').props.disabled,auctionDisabled);
  }
});

test('navigation places assets first and hides personal claims for administrators at every entry',()=>{
  assert.deepEqual(visibleFeatures(false).slice(0,2).map(feature=>[feature.key,feature.order]),[['inventory','01'],['market','02']]);
  assert.ok(visibleFeatures(false).some(feature=>feature.key==='claims'));
  assert.equal(visibleFeatures(true).some(feature=>feature.key==='claims'),false);
  assert.ok(visibleFeatures(true).some(feature=>feature.key==='reserve'));
  const feature=features.find(feature=>feature.key==='claims');
  assert.equal(renderToStaticMarkup(React.createElement(FeatureHost,{feature,data:{isAdmin:true,modules:{}}})), '');
  assert.equal(MyClaims({data:{isAdmin:true}}),null);
});

test('auction funds retain both withdrawal handlers in a single row',()=>{
  const p=common();p.data={...p.data,auctions:[],refund:1n,as:2n};hooks();
  const row=elements(Auctions(p)).find(node=>node.props?.className==='auction-funds');
  const buttons=elements(row).filter(node=>node.type==='button');
  assert.equal(buttons.length,2);
  for(const button of buttons){assert.equal(button.props.disabled,false);button.props.onClick();}
  assert.deepEqual(p.calls.map(call=>[call[2],call[3]]),[['withdrawRefund',[account]],['withdrawSellerCredit',[account]]]);
});

test('mint form blocks incomplete and oversized metadata while preserving valid metadata during pending operations',()=>{
 const p=common();p.data={...p.data,mintable:[{address:account,owner:account,nextTokenId:0n,limit:10}]};
 for(const draft of [{...mintDraft,name:''},{...mintDraft,image:'javascript:alert(1)'},{...mintDraft,description:'艺'.repeat(1200)}]){
  hooks({1:draft});const tree=Mint(p),form=elements(tree).find(x=>x.props?.submit==='确认铸造 NFT');
  assert.equal(form.props.disabled,true);assert.throws(()=>form.props.onSubmit({recipient:other,count:'1'}));
 }
 assert.equal(p.calls.length,0);
 hooks({1:mintDraft});p.disabled=true;const tree=Mint(p);
 assert.equal(elements(tree).find(x=>x.props?.submit==='确认铸造 NFT').props.disabled,true);
 assert.equal(elements(tree).find(x=>x.type==='fieldset').props.disabled,true);
});
