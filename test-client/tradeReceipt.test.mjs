import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface} from 'ethers';
import {readTradeReceipt} from '../src/services/tradeReceipt.mjs';
import {createReceiptFile,receiptRows} from '../src/lib/receiptExport.mjs';

const seller='0x0000000000000000000000000000000000000011';
const buyer='0x0000000000000000000000000000000000000022';
const recipient='0x0000000000000000000000000000000000000033';
const collection='0x0000000000000000000000000000000000000044';
const market='0x0000000000000000000000000000000000000055';
const hash='0x'+'a'.repeat(64),blockHash='0x'+'b'.repeat(64);
const metadata={name:'中文 NFT',description:'=HYPERLINK("bad")',image:'https://example.com/image.png',attributes:[],uri:'data:application/json,{}'};
function fixture(kind='market',{claimed=false}={}) {
  const abi=new Interface([
    'event SaleCompleted(uint256 indexed id,address indexed seller,address indexed buyer,address recipient,address collection,uint256 tokenId,uint256 grossPrice,uint256 fee,uint256 revision)',
    'event AuctionSettled(uint256 indexed id,address indexed seller,address indexed winner,uint256 price,uint256 fee)',
    'event NFTClaimed(uint256 indexed id,address indexed account,address indexed recipient)'
  ]);
  const args=kind==='market'?[7,seller,buyer,recipient,collection,0,1000000000000000001n,10000000000000000n,1]:[7,seller,buyer,1000000000000000001n,10000000000000000n];
  const sale=abi.encodeEventLog(abi.getEvent(kind==='market'?'SaleCompleted':'AuctionSettled'),args);
  const delivered=abi.encodeEventLog(abi.getEvent('NFTClaimed'),[7,buyer,recipient]);
  const log={...sale,address:market,transactionHash:hash,blockNumber:2501,blockHash};
  const row={collection,tokenId:0n,status:2n,seller,highestBid:1000000000000000001n,assetClaimed:claimed};
  const filters=Object.fromEntries(['SaleCompleted','AuctionSettled','NFTClaimed'].map(name=>[name,id=>({getTopicFilter:async()=>abi.encodeFilterTopics(abi.getEvent(name),[id])})]));
  const contract={target:market,interface:abi,filters,getListing:async()=>row,getAuction:async()=>row};
  const calls=[];
  const provider={getNetwork:async()=>({chainId:31337n}),getBlockNumber:async()=>6000,
    getLogs:async request=>{calls.push(request);if(request.topics[0]===abi.getEvent('NFTClaimed').topicHash)return [{...log,...delivered,transactionHash:'0x'+'c'.repeat(64)}];return request.fromBlock<=2501&&request.toBlock>=2501?[log]:[];},
    getBlock:async()=>({hash:blockHash,timestamp:1000}),
    getTransactionReceipt:async()=>({status:1,blockHash,gasUsed:21000n,fee:42000n,from:buyer})};
  return {s:{chainId:31337,provider,config:{deploymentBlock:1},contracts:{Marketplace:contract,AuctionHouse:contract}},row,calls};
}

test('sale receipt preserves actual buyer, recipient, fee, wei precision and confirmed transaction identity',async()=>{
  const {s,calls}=fixture();
  const receipt=await readTradeReceipt(s,'market',7,{metadataLoader:async()=>metadata});
  assert.equal(receipt.buyer,buyer);assert.equal(receipt.recipient,recipient);assert.equal(receipt.tokenId,'0');
  assert.equal(receipt.gross,'1.000000000000000001');assert.equal(receipt.fee,'0.01');assert.equal(receipt.net,'0.990000000000000001');
  assert.equal(receipt.hash,hash);assert.equal(receipt.time,'1970-01-01T00:16:40.000Z');
  assert.equal(receipt.gasUsed,'21000');assert.equal(receipt.metadata.name,'中文 NFT');
  assert.equal(calls.length,2);assert.ok(calls.every(call=>call.toBlock-call.fromBlock<2000));
});

test('auction receipt distinguishes settlement winner from claimed recipient and no-bid return',async()=>{
  const {s,row}=fixture('auction');
  let receipt=await readTradeReceipt(s,'auction',7,{metadataLoader:async()=>metadata});
  assert.equal(receipt.buyer,buyer);assert.equal(receipt.recipient,'');assert.match(receipt.delivery,/等待/);
  row.assetClaimed=true;
  receipt=await readTradeReceipt(s,'auction',7,{metadataLoader:async()=>metadata});
  assert.equal(receipt.recipient,recipient);assert.equal(receipt.deliveryHash,'0x'+'c'.repeat(64));
  row.highestBid=0n;await assert.rejects(readTradeReceipt(s,'auction',7),/已成交/);
});

test('metadata failure is explicit and never discards verified receipt facts',async()=>{
  const {s}=fixture();
  const receipt=await readTradeReceipt(s,'market',7,{metadataLoader:async()=>{throw Error('offline');}});
  assert.equal(receipt.hash,hash);assert.equal(receipt.metadata,null);assert.match(receipt.metadataStatus,/读取失败/);
});

test('network switch, unfinished records, missing logs and reorg mismatch prevent export',async()=>{
  let {s,row}=fixture();row.status=1n;await assert.rejects(readTradeReceipt(s,'market',7),/已成交/);
  ({s}=fixture());s.provider.getNetwork=async()=>({chainId:1n});await assert.rejects(readTradeReceipt(s,'market',7),/网络/);
  ({s}=fixture());s.provider.getLogs=async()=>[];await assert.rejects(readTradeReceipt(s,'market',7),/未找到/);
  ({s}=fixture());s.provider.getBlock=async()=>({hash:'other',timestamp:1000});await assert.rejects(readTradeReceipt(s,'market',7),/区块/);
});

test('restricted log ranges retry in smaller windows and cancellation stops scanning',async()=>{
  const {s}=fixture();const read=s.provider.getLogs;let rejected=0;
  s.provider.getLogs=async request=>{if(request.toBlock-request.fromBlock>499){rejected++;throw Error('range');}return read(request);};
  await readTradeReceipt(s,'market',7,{metadataLoader:async()=>metadata});assert.ok(rejected>0);
  const controller=new AbortController();controller.abort();
  await assert.rejects(readTradeReceipt(s,'market',7,{signal:controller.signal}),/取消/);
});

test('CSV is UTF-8 BOM, escapes quotes and neutralizes formula prefixes including whitespace',async()=>{
  const {s}=fixture();const receipt=await readTradeReceipt(s,'market',7,{metadataLoader:async()=>metadata});
  receipt.metadata.name='  =1+1';
  const file=await createReceiptFile(receipt,'csv');
  assert.equal(file.content[0],'\uFEFF');assert.match(file.name,/\.csv$/);
  assert.ok(file.content.includes('"\'  =1+1"'));assert.ok(file.content.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(file.content.includes(receipt.gross));assert.ok(receiptRows(receipt).some(([field])=>field==='平台手续费 ETH'));
});

test('Excel is a genuine reopenable workbook and keeps large IDs, exact ETH and formulas as text',async()=>{
  const {s}=fixture();const receipt=await readTradeReceipt(s,'market',7,{metadataLoader:async()=>metadata});
  receipt.tokenId=String((1n<<256n)-1n);
  const file=await createReceiptFile(receipt,'xlsx');
  const {default:ExcelJS}=await import('exceljs');
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(file.content);
  const sheet=workbook.getWorksheet('交易凭证');const values={};
  sheet.eachRow(row=>{values[row.getCell(1).value]=row.getCell(2).value;});
  assert.equal(values['Token ID'],receipt.tokenId);assert.equal(values['成交金额 ETH'],receipt.gross);
  assert.equal(values['NFT 描述'],metadata.description);assert.equal(typeof values['NFT 描述'],'string');
  assert.match(file.name,/\.xlsx$/);assert.equal(Buffer.from(file.content).subarray(0,2).toString(),'PK');
  await assert.rejects(createReceiptFile(receipt,'pdf'),/格式/);
});

test('Excel splits long metadata into lossless continuation rows within cell limits',async()=>{
  const {s}=fixture();const receipt=await readTradeReceipt(s,'market',7,{metadataLoader:async()=>({...metadata})});
  receipt.metadata.uri='data:image/svg+xml,'+'🎨'.repeat(33000);
  const file=await createReceiptFile(receipt,'xlsx');
  const {default:ExcelJS}=await import('exceljs');const workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load(file.content);const parts=[];
  workbook.getWorksheet('交易凭证').eachRow(row=>{
    if(String(row.getCell(1).value).startsWith('tokenURI')){
      const value=row.getCell(2).value;assert.ok(value.length<=30000);parts.push(value);
      assert.equal(/[\uD800-\uDBFF]$/.test(value),false);
    }
  });
  assert.equal(parts.join(''),receipt.metadata.uri);assert.ok(parts.length>1);
});
