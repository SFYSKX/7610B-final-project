import test from 'node:test';
import assert from 'node:assert/strict';
import {toUtf8Bytes} from 'ethers';
import {createMintMetadata,MINT_URI_LIMIT} from '../src/services/mintMetadata.mjs';
import {loadMetadata} from '../src/services/nftMetadata.mjs';

test('minted UTF-8 fields round-trip through the existing NFT detail reader',async () => {
  const draft = {name:'春日艺术 🌿',description:'第一行\n第二行 "社团"',image:'ipfs://bafyexample/art.png'};
  const {metadata,uri,bytes} = createMintMetadata(draft);
  assert.deepEqual(metadata,draft);
  assert.equal(bytes,toUtf8Bytes(uri).length);
  const detail = await loadMetadata({readURI:async () => uri});
  assert.equal(detail.name,draft.name);
  assert.equal(detail.description,draft.description);
  assert.equal(detail.image,'https://ipfs.io/ipfs/bafyexample/art.png');
  assert.deepEqual(detail.attributes,[]);
});

test('optional fields can be omitted and attribute input is excluded from new mint metadata',() => {
  const {metadata} = createMintMetadata({name:'  NFT  ',description:'',image:'',attributes:[{trait_type:'旧属性',value:'旧内容'}]});
  assert.deepEqual(metadata,{name:'NFT'});
  assert.equal(createMintMetadata({name:'NFT',image:'https://example.org/art.png'}).metadata.image,'https://example.org/art.png');
});

test('invalid names and unsupported or credential-bearing image URLs are rejected before minting',() => {
  for (const name of ['', '   ', 'x'.repeat(301), 123]) assert.throws(() => createMintMetadata({name}));
  for (const image of ['http://example.org/art.png','javascript:alert(1)','file:///art.png','blob:https://example.org/id',
    'data:image/png;base64,AA==','https://name:secret@example.org/art.png','ipfs://','ipfs://cid/../art.png','not-a-link']) {
    assert.throws(() => createMintMetadata({name:'NFT',image}),/图片链接/);
  }
});

test('display-field lengths are validated without silent truncation',() => {
  assert.throws(() => createMintMetadata({name:'NFT',description:'x'.repeat(10001)}),/描述/);
  assert.throws(() => createMintMetadata({name:'NFT',image:'https://example.org/'+'x'.repeat(4096)}),/图片链接/);
});

test('the final base64 tokenURI, including its prefix, stays within the contract byte limit',() => {
  let longest;
  for (let length = 1; length <= MINT_URI_LIMIT; length++) {
    try {longest = createMintMetadata({name:'NFT',description:'x'.repeat(length)});}
    catch (error) {
      assert.match(error.message,/4096 字节/);
      assert.ok(longest.bytes <= MINT_URI_LIMIT && longest.bytes > MINT_URI_LIMIT - 4);
      return;
    }
  }
  assert.fail('Expected the encoded metadata size limit to be enforced');
});

test('multibyte text and image URLs count toward the encoded URI size',() => {
  assert.throws(() => createMintMetadata({name:'作品',description:'艺'.repeat(1200)}),/4096 字节/);
  assert.throws(() => createMintMetadata({name:'作品',image:'https://example.org/'+'a'.repeat(3500)}),/4096 字节/);
});
