import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyFilters,filterCatalog,assetKey} from '../src/lib/catalog.mjs';

const seller = '0x00000000000000000000000000000000000000AB';
const collection = '0x0000000000000000000000000000000000000011';
const rows = [
  {id:1n,collection,tokenId:0n,seller,price:1000000000000000001n},
  {id:2n,collection,tokenId:2n,seller:seller.toLowerCase(),price:1000000000000000002n},
  {id:3n,collection,tokenId:(1n<<256n)-1n,seller:'0x0000000000000000000000000000000000000022',price:0n}
];
const filter = (values={},options={}) => filterCatalog(rows,{...emptyFilters,...values},options);

test('catalog combines Unicode name, token/record, seller and exact ETH price filters',() => {
  const names = {[assetKey(rows[0])]:'校园 NFT Blue'};
  const found = filter({name:' nft BLUE ',token:'00',record:'01',seller:'00ab',minPrice:'1.000000000000000001',maxPrice:'1.000000000000000001'},{names});
  assert.deepEqual(found,[rows[0]]);
  assert.deepEqual(filter({token:String((1n<<256n)-1n)}),[rows[2]]);
  assert.deepEqual(filter({name:'unavailable'},{names:{}}),[]);
});

test('catalog keeps wei precision, zero bounds, chronological ordering and original rows',() => {
  assert.deepEqual(filter().map(row => row.id),[3n,2n,1n]);
  assert.deepEqual(filter({sort:'oldest'}).map(row => row.id),[1n,2n,3n]);
  assert.deepEqual(filter({sort:'priceAsc'}).map(row => row.id),[3n,1n,2n]);
  assert.deepEqual(filter({sort:'priceDesc'}).map(row => row.id),[2n,1n,3n]);
  assert.deepEqual(filter({maxPrice:'0'}),[rows[2]]);
  assert.deepEqual(rows.map(row => row.id),[1n,2n,3n]);
});

test('invalid ranges and IDs produce explicit errors',() => {
  for (const minPrice of ['-1','1e3','abc','1.0000000000000000001']) assert.throws(() => filter({minPrice}));
  assert.throws(() => filter({minPrice:'2',maxPrice:'1'}),/最低价格/);
  assert.throws(() => filter({token:'1.5'}),/整数/);
});

test('auction price uses winning bid or reserve, remaining-time sort keeps ended rows last',() => {
  const auctions = rows.map((row,index) => ({...row,status:1n,reservePrice:BigInt(10+index),highestBid:0n,endTime:BigInt(200+index*100)}));
  auctions[0].highestBid=30n;
  auctions[2].status=2n;
  const sorted = sort => filterCatalog(auctions,{...emptyFilters,sort},{kind:'auction',time:100}).map(row => row.id);
  assert.deepEqual(sorted('priceAsc'),[2n,3n,1n]);
  assert.deepEqual(sorted('endingSoon'),[1n,2n,3n]);
  assert.deepEqual(sorted('endingLast'),[2n,1n,3n]);
  assert.deepEqual(filterCatalog(auctions,{...emptyFilters,sort:'endingSoon'},{kind:'auction',time:250}).map(row => row.id),[2n,3n,1n]);
});
