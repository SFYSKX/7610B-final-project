import test from 'node:test';import assert from 'node:assert/strict';import {Interface,parseEther} from 'ethers';
import {friendly} from '../src/lib/control.mjs';import {preflight} from '../src/lib/preflight.mjs';
test('nested ERC721 errors identify the approval destination',()=>{
 const i=new Interface(['error ERC721InsufficientApproval(address operator,uint256 tokenId)']);
 const e={shortMessage:'execution reverted (unknown custom error)',info:{error:{data:{data:i.encodeErrorResult('ERC721InsufficientApproval',['0x0000000000000000000000000000000000000011',1])}}}};
 assert.match(friendly(e,{method:'createAuction'}),/拍卖市场 AuctionHouse/);assert.match(friendly(e,{method:'createListing'}),/交易市场 Marketplace/);
});
test('budget errors expose requested and available amounts without raw computer errors',()=>{
 const i=new Interface(['error InsufficientBudget(uint256 requested,uint256 availableAmount)']);
 const result=friendly({data:i.encodeErrorResult('InsufficientBudget',[parseEther('.05'),parseEther('.001')])});assert.match(result,/0.05 ETH/);assert.match(result,/0.001 ETH/);assert.match(result,/批准票数不会增加余额/);
});
test('distinct failures have distinct natural Chinese messages',()=>{
 const cases=['Bid too low','Auction not live','Not NFT owner','Unsupported collection','NFT blocked','Invalid deadlines','Over budget'];
 const results=cases.map(reason=>friendly({reason}));assert.equal(new Set(results).size,cases.length);for(const result of results)assert.match(result,/[\u4e00-\u9fff]/);
 assert.match(friendly({code:4001}),/取消钱包/);assert.match(friendly({code:'INSUFFICIENT_FUNDS'}),/ETH 不足/);assert.doesNotMatch(friendly(Error('0xdeadbeef unknown custom error')),/0xdeadbeef/);
});
test('low-bid preflight reports latest minimum and refuses sending',async()=>{
 await assert.rejects(preflight({}, {getAuction:async()=>({highestBid:parseEther('.012'),reservePrice:parseEther('.01'),minIncrement:parseEther('.001')})},'bid',[1],{value:parseEther('.012')}),/0.013 ETH/);
});

test('login network errors distinguish wallet and local connections while transactions retain receipt advice',()=>{
 const error=Error('身份核验失败',{cause:{code:'NETWORK_ERROR',message:'missing response'}});
 const wallet=friendly(error,{action:'login',mode:'wallet'});
 const local=friendly(error,{action:'login',mode:'local'});
 assert.match(wallet,/MetaMask 当前网络的 RPC/);assert.match(wallet,/本地演示/);
 assert.match(local,/npm run demo/);assert.match(local,/部署清单/);
 for(const result of [wallet,local,friendly(Error('unknown error'),{action:'login'})]){
  assert.match(result,/未发送交易/);assert.doesNotMatch(result,/核对回执|重复提交|待确认交易/);
 }
 assert.match(friendly(error),/先核对回执/);
 assert.match(friendly({code:'TIMEOUT'},{action:'login',mode:'wallet'}),/RPC/);
});

test('cancelled and pending wallet connections do not show transaction signature advice',()=>{
 assert.match(friendly({code:4001},{action:'login'}),/取消钱包连接/);
 assert.match(friendly({info:{error:{code:-32002,message:'could not coalesce error'}}},{action:'login'}),/待处理的请求/);
 assert.match(friendly({code:4001}),/取消钱包签名/);
 assert.equal(friendly(Error('当前钱包没有本平台的管理员权限'),{action:'login'}),'当前钱包没有本平台的管理员权限');
});
