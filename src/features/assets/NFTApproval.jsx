import React,{useState,useEffect,useRef} from 'react';
import {Contract} from 'ethers';
import {ABIS} from '../../lib/abis.mjs';
import {same} from '../../lib/format.mjs';
import {address,tokenId,friendly} from '../../lib/control.mjs';
import {APPROVAL_TARGETS,approvalTarget,readNFTApproval} from '../../lib/approval.mjs';

export default function NFTApproval({s,data,selected,defaultCollection,tx,guarded,disabled}){
 const [collection,setCollection]=useState(selected?.collection||defaultCollection),[token,setToken]=useState(String(selected?.tokenId??'')),[kind,setKind]=useState('Marketplace');
 const [state,setState]=useState({status:'idle'}),[reload,setReload]=useState(0);
 const generation=useRef(0),queryKey=collection.trim().toLowerCase()+':'+token.trim();
 const target=approvalTarget(kind,s.config.contracts),label=APPROVAL_TARGETS[kind];
 useEffect(()=>{
  const current=++generation.current;
  if(!collection.trim()||!token.trim()){setState({status:'idle'});return;}
  let col,id;
  try{col=address(collection);id=tokenId(token);}catch(e){setState({status:'error',key:queryKey,error:friendly(e)});return;}
  setState(prev=>prev.key===queryKey&&prev.status==='ready'?{...prev,refreshing:true}:{status:'loading',key:queryKey});
  const nft=new Contract(col,ABIS.DemoNFT,s.provider);
  Promise.resolve().then(async()=>readNFTApproval(nft,id,s.config.contracts,data.block??await s.provider.getBlockNumber())).then(value=>{
   if(current===generation.current)setState({status:'ready',key:queryKey,...value});
  }).catch(e=>{if(current===generation.current)setState({status:'error',key:queryKey,error:friendly(e)});});
  return()=>{generation.current++;};
 },[s,collection,token,data.block,reload]);
 const current=state.key===queryKey&&state.status==='ready',owned=current&&same(state.owner,s.account);
 const granted=current&&(kind==='Marketplace'?state.market:state.auction);
 function submit(e){e.preventDefault();return guarded(()=>{
  if(!current)throw Error('请先查询并确认这件 NFT 的链上授权状态');
  if(!owned)throw Error('当前账户不是这件 NFT 的持有人');
  if(granted)throw Error(label+' 已获授权，无需重复提交');
  return tx('授权 NFT',new Contract(address(collection),ABIS.DemoNFT,s.provider),'approve',[approvalTarget(kind,s.config.contracts),tokenId(token)]);
 });}
 function permission(name,allowed,single,all){return <div className="approval-permission"><span>{name}</span><strong>{allowed?'已授权':'未授权'}</strong><small>{allowed?(all?'当前持有人已对该合约授予全部 NFT 授权':'本 NFT 的单件授权'):'该合约目前不能仅凭授权转移此 NFT'}</small></div>;}
 return <section className="panel"><h2>01 / 单件授权</h2>
  <p className="muted">选择用途后再授权。授权与挂牌是独立交易，授权成功不会立即转移 NFT。</p>
  <form className="form" onSubmit={submit}>
   <div className="fields">
    <label>NFT 合约地址<input name="collection" value={collection} onChange={e=>setCollection(e.target.value)} required autoComplete="off"/></label>
    <label>Token ID<input name="token" value={token} onChange={e=>setToken(e.target.value)} required autoComplete="off"/></label>
    <label>授权用途<select aria-label="授权用途" name="targetKind" value={kind} onChange={e=>setKind(e.target.value)}>{Object.entries(APPROVAL_TARGETS).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
   </div>
   <p className="approval-target">本次授权给：<strong>{label}</strong><small>合约地址：<code>{target}</code></small></p>
   <button type="submit" disabled={disabled||!current||!owned||granted}>{granted?label+'已授权':'授权给'+label}</button>
  </form>
  <div className="approval-status" aria-live="polite">
   <h3>这件 NFT 的链上授权状态</h3>
   <button type="button" className="text-btn" onClick={()=>setReload(n=>n+1)}>刷新授权状态</button>
   {(!collection.trim()||!token.trim())?<p className="muted">选择上方资产，或填写 NFT 合约地址和 Token ID，即可查询。</p>:!current&&state.status!=='error'?<p>正在查询授权状态…</p>:null}
   {state.key===queryKey&&state.status==='error'&&<p role="alert">授权状态查询失败：{state.error}。请核对网络、地址和 Token ID 后重试。</p>}
   {current&&<>
    <p>当前持有人：<code>{state.owner}</code>{!owned&&<span>（当前账户无权授权此 NFT）</span>}</p>
    <div className="approval-permissions">{permission(APPROVAL_TARGETS.Marketplace,state.market,state.marketSingle,state.marketAll)}{permission(APPROVAL_TARGETS.AuctionHouse,state.auction,state.auctionSingle,state.auctionAll)}</div>
    <p className="small">当前单件授权：{state.singleLabel}{state.singleLabel==='其他合约或地址'&&<> · <code>{state.approved}</code></>} · 查询区块 {state.block}{state.refreshing?' · 更新中…':''}</p>
   </>}
  </div>
  <p className="small muted">改授另一个市场会替换原来的单件授权；已有“全部 NFT 授权”不会因此取消。NFT 转移后，应按新的持有人重新查询。</p>
 </section>;
}
