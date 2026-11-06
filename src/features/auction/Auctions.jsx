import NFTDetails from '../../components/NFTDetails.jsx';
import React,{useState} from 'react';
import CatalogFilters,{CatalogSort} from '../../components/CatalogFilters.jsx';
import TradeReceipt from '../../components/TradeReceipt.jsx';
import useAssetNames from '../../hooks/useAssetNames.jsx';
import {emptyFilters,filterCatalog} from '../../lib/catalog.mjs';
import {eth,short,same} from '../../lib/format.mjs';
import {address,amount} from '../../lib/control.mjs';
import {Form,State,Empty,f,date} from '../../components/common.jsx';
import RecordLookup from '../../components/RecordLookup.jsx';

export function AuctionCard({s,data,tx,guarded,disabled,v}){
 const a=s.contracts.AuctionHouse;
 return <article className="asset-card"><NFTDetails s={s} tokenId={v.tokenId} collection={v.collection}/><div className="card-body">
  <h3>拍卖 #{String(v.id)} · NFT #{String(v.tokenId)}</h3><p className="muted">卖方 {short(v.seller)} · {date(v.endTime)}</p>
  <div className="price">{eth(v.highestBid||v.reservePrice)} <span>ETH</span></div>
  <p className="small">{v.highestBid>0n?'最高出价 '+short(v.highestBidder):'尚无出价 / 当前显示底价'}</p>
  <State>{['未知','进行中','已结算','已取消'][Number(v.status)]}{Number(v.status)===1&&data.time>=Number(v.endTime)?' / 待结算':''}</State>
  {Number(v.status)===2&&v.highestBid>0n&&<TradeReceipt s={s} kind="auction" recordId={v.id}/>}
  {Number(v.status)===1&&data.time<Number(v.endTime)&&!same(v.seller,s.account)&&<Form fields={[f('bid','完整出价 ETH',eth(v.highestBid?v.highestBid+v.minIncrement:v.reservePrice))]} submit="提交出价" disabled={disabled||data.pausedA||same(v.highestBidder,s.account)} onSubmit={x=>guarded(()=>tx('拍卖出价',a,'bid',[v.id],{value:amount(x.bid)}))}/>}
  {Number(v.status)===1&&data.time>=Number(v.endTime)&&<p role="status">已截止，等待后台自动结算。若长时间未完成，请联系管理员检查结算服务。</p>}
  {Number(v.status)===1&&same(v.seller,s.account)&&v.highestBid===0n&&<button className="secondary block" disabled={disabled} onClick={()=>tx('取消拍卖',a,'cancelAuction',[v.id])}>取消无出价拍卖</button>}
  {same(v.entitledRecipient,s.account)&&!v.assetClaimed&&<Form fields={[f('recipient','NFT 接收地址',s.account)]} submit="领取 NFT" disabled={disabled} onSubmit={x=>guarded(()=>tx('领取 NFT',a,'claimNFT',[v.id,address(x.recipient)]))}/>}
 </div></article>;
}
export default function Auctions({s,data,tx,guarded,disabled}){
 const a=s.contracts.AuctionHouse,common={s,data,tx,guarded,disabled};
 const [filters,setFilters]=useState({...emptyFilters});
 const [only,setOnly]=useState('active');
 const names=useAssetNames(s,data.auctions,!!filters.name.trim());
 const scoped=data.auctions.filter(row=>only==='all'
   || only==='mine'&&same(row.seller,s.account)
   || only==='active'&&Number(row.status)===1&&Number(row.endTime)>data.time
   || only==='pending'&&Number(row.status)===1&&Number(row.endTime)<=data.time
   || only==='settled'&&Number(row.status)===2
   || only==='cancelled'&&Number(row.status)===3);
 let filtered=[],error='';
 try{filtered=filterCatalog(scoped,filters,{kind:'auction',names:names.names,time:data.time});}
 catch(failure){error=failure.message;}
 return <>
 <section className="panel"><h2>公开竞价</h2>
  <div className="catalog-toolbar">
   <CatalogSort kind="auction" value={filters} onChange={setFilters}/>
   <label>拍卖范围<select aria-label="拍卖范围" value={only} onChange={event=>setOnly(event.target.value)}>
    <option value="active">可竞价</option><option value="mine">我的拍卖</option>
    <option value="pending">待结算</option><option value="settled">已结算</option>
    <option value="cancelled">已取消</option><option value="all">全部近期拍卖</option>
   </select></label>
  </div>
  {data.pausedA&&<p className="warning">新竞价已暂停，退款和领取卖款仍可进行。</p>}
  <div className="cards">{filtered.map(v=><AuctionCard key={v.id} {...common} v={v}/>)}</div>
  {!filtered.length&&<Empty>{names.loading?'正在读取名称，请稍候…':'当前筛选没有拍卖。可调整条件或在“我的资产”创建拍卖。'}</Empty>}
 </section>
 <RecordLookup s={s} block={data.block} label="查询任意拍卖 ID"
  searchControls={<CatalogFilters kind="auction" value={filters} onChange={setFilters} total={data.auctions.length} count={filtered.length}
    loading={names.loading} failed={names.failed} onRetry={names.retry} error={error}/>}
  read={async(id,options)=>{const v=await a.getAuction(id,options);if(v.status===0n)throw Error('拍卖不存在');return v.toObject();}}>{v=><AuctionCard {...common} v={v}/>}</RecordLookup>
 <section className="panel"><h2>我的拍卖资金</h2><div className="auction-funds"><p>可退竞价款：{eth(data.refund)} ETH</p>
  <button disabled={disabled||data.refund===0n} onClick={()=>tx('领取竞价退款',a,'withdrawRefund',[s.account])}>退回到当前账户</button><p>可领取卖款：{eth(data.as)} ETH</p>
  <button disabled={disabled||data.as===0n} onClick={()=>tx('领取拍卖卖款',a,'withdrawSellerCredit',[s.account])}>领取拍卖卖款</button></div><p className="muted small">退款不收平台费，领取需要 Gas。合约也支持本人指定其他可收款地址。</p>
 </section></>;
}
