import React,{useState,useEffect} from 'react';
import {CardArt} from './common.jsx';
import {loadMetadata,mediaURL} from '../services/nftMetadata.mjs';
export default function NFTDetails({s,collection,tokenId}){
 const [result,setResult]=useState(null),[retry,setRetry]=useState(0),[failedImage,setFailedImage]=useState(null);
 const key=String(s?.chainId)+':'+collection+':'+String(tokenId);
 useEffect(()=>{
  let active=true;const controller=new AbortController();setResult(null);setFailedImage(null);
  if(s?.provider)loadMetadata({provider:s.provider,collection,tokenId,signal:controller.signal}).then(value=>{if(active)setResult({key,value,session:s});},()=>{if(active)setResult({key,error:true,session:s});});
  else setResult({key,error:true,session:s});
  return ()=>{active=false;controller.abort();};
 },[s,collection,String(tokenId),retry]);
 const current=result?.key===key&&result?.session===s?result:null,metadata=current?.value;
 return <div className="nft-details">
  {metadata?.image&&failedImage!==metadata.image?<img className="nft-image" src={metadata.image} alt={metadata.name||'NFT #'+String(tokenId)} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailedImage(metadata.image)}/>:<CardArt collection={collection} tokenId={tokenId}/>}
  <details className="nft-information"><summary>查看 NFT 详情</summary>
   {!current&&<p role="status">正在加载 NFT 详情…</p>}
   {current?.error&&<p role="status">暂时无法读取详情，仍可查看链上编号。<button type="button" className="secondary" onClick={()=>setRetry(x=>x+1)}>重试</button></p>}
   {metadata&&<><h3>{metadata.name||'未提供名称'}</h3><p className="nft-description">{metadata.description||'未提供描述'}</p>{(!metadata.image||failedImage===metadata.image)&&<p className="muted">{metadata.image?'图片加载失败':'未提供可显示的图片'}</p>}{metadata.attributes.length>0&&<dl className="nft-attributes">{metadata.attributes.map((a,i)=><div key={i}><dt>{a.trait}</dt><dd>{a.value}</dd></div>)}</dl>}</>}
   <dl className="nft-identifiers"><dt>集合地址</dt><dd>{collection}</dd><dt>Token ID</dt><dd>{String(tokenId)}</dd></dl>
   {metadata&&mediaURL(metadata.uri)&&<a href={mediaURL(metadata.uri)} target="_blank" rel="noopener noreferrer">查看原始元数据 ↗</a>}
  </details>
 </div>;
}
