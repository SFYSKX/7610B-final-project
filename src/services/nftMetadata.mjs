import {Contract} from 'ethers';
const LIMIT=1024*1024;
export function mediaURL(value,{image=false}={}){
 if(typeof value!=='string'||value.length>LIMIT*2)return null;
 const uri=value.trim();
 if(image&&/^data:image\/(png|jpeg|gif|webp|avif|svg\+xml)[;,]/i.test(uri))return uri;
 if(uri.startsWith('ipfs://')){
  const path=uri.slice(7).replace(/^ipfs\//,'');
  if(!path||/[?#\\\s]/.test(path)||path.split('/').includes('..'))return null;
  return 'https://ipfs.io/ipfs/'+path;
 }
 try{const url=new URL(uri);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return null;return url.href;}catch{return null;}
}
export function normalizeMetadata(raw,uri){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('NFT 元数据格式无效');
 const text=(v,max)=>typeof v==='string'?v.slice(0,max):'';
 let image=mediaURL(raw.image,{image:true});
 if(!image&&typeof raw.image==='string'&&!/^[a-z][a-z0-9+.-]*:/i.test(raw.image)){
  const base=mediaURL(uri);if(base)try{image=mediaURL(new URL(raw.image,base).href,{image:true});}catch{}
 }
 const attributes=Array.isArray(raw.attributes)?raw.attributes.slice(0,100).filter(a=>a&&typeof a==='object'&&['string','number','boolean'].includes(typeof a.value)).map(a=>({trait:text(a.trait_type,200)||'属性',value:String(a.value).slice(0,1000)})):[];
 return {name:text(raw.name,300),description:text(raw.description,10000),image,attributes,uri};
}
async function readJSON(uri,signal,fetcher){
 if(typeof uri!=='string'||uri.length>LIMIT*2)throw Error('NFT 元数据过大或无效');
 if(/^data:application\/json(?:;charset=utf-8)?(?:;base64)?,/i.test(uri)){
  const comma=uri.indexOf(',');let body;
  try{body=/;base64$/i.test(uri.slice(0,comma))?new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(uri.slice(comma+1)),x=>x.charCodeAt(0))):decodeURIComponent(uri.slice(comma+1));}catch{throw Error('NFT 元数据编码无效');}
  if(new TextEncoder().encode(body).length>LIMIT)throw Error('NFT 元数据超过 1 MB');return JSON.parse(body);
 }
 const url=mediaURL(uri);if(!url)throw Error('暂不支持此 NFT 元数据地址');
 const response=await fetcher(url,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
 if(!response.ok)throw Error('NFT 元数据暂时无法读取');
 if(Number(response.headers.get('content-length'))>LIMIT)throw Error('NFT 元数据超过 1 MB');
 const reader=response.body.getReader();let length=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>LIMIT)throw Error('NFT 元数据超过 1 MB');chunks.push(value);}}finally{await reader.cancel();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
export async function loadMetadata({provider,collection,tokenId,signal,fetcher=fetch,readURI,timeout=10000}){
 const controller=new AbortController();const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 let timer;const stopped=new Promise((_,reject)=>{controller.signal.addEventListener('abort',()=>reject(Error('详情加载已取消或超时')),{once:true});if(controller.signal.aborted)reject(Error('详情加载已取消'));timer=setTimeout(abort,timeout);});
 try{return await Promise.race([(async()=>{const uri=await (readURI?readURI():new Contract(collection,['function tokenURI(uint256) view returns (string)'],provider).tokenURI(tokenId));if(controller.signal.aborted)throw Error('详情加载已取消');return normalizeMetadata(await readJSON(uri,controller.signal,fetcher),uri);})(),stopped]);}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
