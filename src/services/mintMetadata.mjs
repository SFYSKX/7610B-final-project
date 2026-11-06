import {encodeBase64,toUtf8Bytes} from 'ethers';
import {mediaURL} from './nftMetadata.mjs';

export const MINT_URI_LIMIT = 4096;

function text(value,label,limit) {
  if (typeof value !== 'string') throw Error(`${label}格式无效`);
  const result = value.trim();
  if (result.length > limit) throw Error(`${label}最多 ${limit} 个字符`);
  return result;
}

// Inline JSON keeps the content tied to the tokenURI accepted by existing NFTs.
// Only image references are external, using the same resolver as NFTDetails.
export function createMintMetadata({name = '',description = '',image = ''} = {}) {
  const metadata = {name:text(name,'NFT 名称',300)};
  if (!metadata.name) throw Error('请填写 NFT 名称');
  const detail = text(description,'描述',10000);
  const imageURI = text(image,'图片链接',4096);
  if (detail) metadata.description = detail;
  if (imageURI) {
    if (!/^(https:\/\/|ipfs:\/\/)/.test(imageURI) || !mediaURL(imageURI,{image:true})) {
      throw Error('图片链接须为可公开访问的 HTTPS 或 ipfs:// 地址');
    }
    metadata.image = imageURI;
  }
  const uri = 'data:application/json;base64,' + encodeBase64(toUtf8Bytes(JSON.stringify(metadata)));
  const bytes = toUtf8Bytes(uri).length;
  if (bytes > MINT_URI_LIMIT) {
    throw Error(`编码后的元数据为 ${bytes} 字节，超过合约的 ${MINT_URI_LIMIT} 字节上限。请缩短描述或图片链接。`);
  }
  return {metadata,uri,bytes};
}
