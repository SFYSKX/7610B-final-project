import React,{useState,useEffect,useRef} from 'react';
import {Contract} from 'ethers';
import {ABIS} from '../../lib/abis.mjs';
import {same} from '../../lib/format.mjs';
import {address,tokenId,friendly} from '../../lib/control.mjs';
import {APPROVAL_TARGETS,approvalTarget,approvalRevocationActions,readNFTApproval} from '../../lib/approval.mjs';

export default function NFTApproval({s,data,selected,defaultCollection,tx,guarded,disabled}){
 const [collection,setCollection]=useState(selected?.collection||defaultCollection),[token,setToken]=useState(String(selected?.tokenId??'')),[kind,setKind]=useState('Marketplace');
 const [state,setState]=useState({status:'idle'}),[reload,setReload]=useState(0),[actionNote,setActionNote]=useState('');
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
 const nftAddress=(()=>{try{return address(collection);}catch{return null;}})();
 const revokeActions=current?approvalRevocationActions(state,s.config.contracts,token):[];
 const marketGranted=current&&state.market,auctionGranted=current&&state.auction;
 function submit(e){e.preventDefault();return guarded(()=>{
  if(!current)throw Error('请先查询并确认这件 NFT 的链上授权状态');
  if(!owned)throw Error('当前账户不是这件 NFT 的持有人');
  if(granted)throw Error(label+' 已获授权，无需重复提交');
  return tx('授权 NFT',new Contract(nftAddress,ABIS.DemoNFT,s.provider),'approve',[approvalTarget(kind,s.config.contracts),tokenId(token)]);
 });}
 async function runRevocations(actions,successMessage){
  if(!current)throw Error('请先查询并确认这件 NFT 的链上授权状态');
  if(!owned)throw Error('当前账户不是这件 NFT 的持有人，无法撤销该授权');
  if(!actions.length)throw Error('当前没有需要取消的平台授权');
  setActionNote('');
  const contract=new Contract(nftAddress,ABIS.DemoNFT,s.provider);
  for(let i=0;i<actions.length;i++){
   const action=actions[i];
   const receipt=await tx(action.label,contract,action.method,action.args);
   // App.tx reports the wallet/RPC error and returns undefined on failure. Stop
   // here so a partial multi-transaction revoke is never presented as complete.
   if(!receipt){
    setActionNote('授权取消未全部完成。请刷新链上授权状态；已确认的交易不会回滚，剩余授权可继续单独取消。');
    return;
   }
  }
  setActionNote(successMessage);
  setReload(n=>n+1);
 }
 function revokeTarget(targetKind){
  return guarded(()=>runRevocations(revokeActions.filter(action=>action.target===targetKind),APPROVAL_TARGETS[targetKind]+'授权已取消，正在重新读取链上状态。'));
 }
 function revokeBoth(){
  return guarded(()=>runRevocations(revokeActions,'交易市场与拍卖市场的现有授权均已取消，正在重新读取链上状态。'));
 }
 function permission(name,allowed,single,all,targetKind){
  const scopes=[];
  if(single)scopes.push('本 NFT 单件授权');
  if(all)scopes.push('该集合全部 NFT 授权');
  return <div className="approval-permission">
   <div className="approval-permission-top"><span>{name}</span><strong>{allowed?'已授权':'未授权'}</strong></div>
   <small>授权范围：{scopes.length?scopes.join(' + '):'无'}</small>
   {allowed&&<button type="button" className="secondary approval-revoke" disabled={disabled||!owned} onClick={()=>revokeTarget(targetKind)}>取消{targetKind==='Marketplace'?'交易市场':'拍卖市场'}授权</button>}
  </div>;
 }
 return <section className="panel"><h2>01 / NFT 授权管理</h2>
  <p className="muted">可分别授权或撤销交易市场、拍卖市场。授权与挂牌是独立交易，授权成功不会立即转移 NFT。</p>
  <form className="form" onSubmit={submit}>
   <div className="fields">
    <label>NFT 合约地址<input name="collection" value={collection} onChange={e=>{setCollection(e.target.value);setActionNote('');}} required autoComplete="off"/></label>
    <label>Token ID<input name="token" value={token} onChange={e=>{setToken(e.target.value);setActionNote('');}} required autoComplete="off"/></label>
    <label>授权用途<select aria-label="授权用途" name="targetKind" value={kind} onChange={e=>setKind(e.target.value)}>{Object.entries(APPROVAL_TARGETS).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
   </div>
   <p className="approval-target">本次授权给：<strong>{label}</strong><small>合约地址：<code>{target}</code></small></p>
   <button type="submit" disabled={disabled||!current||!owned||granted}>{granted?label+'已授权':'授权给'+label}</button>
  </form>
  <div className="approval-status" aria-live="polite">
   <div className="approval-status-heading"><h3>这件 NFT 的链上授权状态</h3><button type="button" className="text-btn" onClick={()=>{setActionNote('');setReload(n=>n+1);}}>刷新授权状态</button></div>
   {(!collection.trim()||!token.trim())?<p className="muted">选择上方资产，或填写 NFT 合约地址和 Token ID，即可查询。</p>:!current&&state.status!=='error'?<p>正在查询授权状态…</p>:null}
   {state.key===queryKey&&state.status==='error'&&<p role="alert">授权状态查询失败：{state.error}。请核对网络、地址和 Token ID 后重试。</p>}
   {current&&<>
    <p>当前持有人：<code>{state.owner}</code>{!owned&&<span>（当前账户无权撤销或修改这件 NFT 的授权）</span>}</p>
    <div className="approval-permissions">
     {permission(APPROVAL_TARGETS.Marketplace,state.market,state.marketSingle,state.marketAll,'Marketplace')}
     {permission(APPROVAL_TARGETS.AuctionHouse,state.auction,state.auctionSingle,state.auctionAll,'AuctionHouse')}
    </div>
    {(marketGranted||auctionGranted)&&<div className="approval-bulk-actions">
     <button type="button" className="danger-button" disabled={disabled||!owned||!revokeActions.length} onClick={revokeBoth}>一键取消两个市场授权</button>
     <small>会按链上实际状态依次撤销单件授权和全部 NFT 授权；每笔链上交易都需要在钱包中单独确认。</small>
    </div>}
    <p className="small">当前单件授权：{state.singleLabel}{state.singleLabel==='其他合约或地址'&&<> · <code>{state.approved}</code></>} · 查询区块 {state.block}{state.refreshing?' · 更新中…':''}</p>
   </>}
   {actionNote&&<p className="approval-action-note" role="status">{actionNote}</p>}
  </div>
  <p className="small muted">单件授权只影响当前 Token ID；“全部 NFT 授权”会影响当前持有人在此 NFT 合约下的全部资产。取消时不会修改其他第三方地址的单件授权。若单件和全部 NFT 授权同时存在，需要分别发送交易。NFT 转移后，应由新的持有人重新查询和管理授权。</p>
 </section>;
}
